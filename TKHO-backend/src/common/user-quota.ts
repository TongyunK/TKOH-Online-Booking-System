import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  formatDbDateAsAppYmd,
  getAppCalendarYear,
} from './app-timezone';

type DbClient = PrismaClient | Prisma.TransactionClient;

type QuotaKind = 'ev' | 'venue';

const QUOTA_EXCEEDED: Record<QuotaKind, string> = {
  ev: 'EV booking quota exceeded.',
  venue: 'Venue booking quota exceeded.',
};

/** EV 占用年额度的活跃状态（与创建扣减口径一致） */
const EV_ACTIVE_STATUSES = ['pending', 'confirmed'] as const;

function isQuotaLimited(annual: number | null | undefined): boolean {
  return (annual ?? 0) >= 0;
}

function yearFromBookingDate(bookingDate: Date | string): number {
  if (typeof bookingDate === 'string') {
    const ymd = bookingDate.trim().slice(0, 10);
    const year = Number.parseInt(ymd.slice(0, 4), 10);
    if (!Number.isFinite(year) || year < 1970) {
      throw new ForbiddenException('Invalid booking date for quota check.');
    }
    return year;
  }
  const ymd = formatDbDateAsAppYmd(bookingDate);
  const year = Number.parseInt(ymd.slice(0, 4), 10);
  if (!Number.isFinite(year) || year < 1970) {
    throw new ForbiddenException('Invalid booking date for quota check.');
  }
  return year;
}

function yearDateBounds(year: number): { start: Date; endExclusive: Date } {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    endExclusive: new Date(Date.UTC(year + 1, 0, 1)),
  };
}

async function loadDefaultAndOverride(
  tx: DbClient,
  userId: bigint,
  year: number,
  kind: QuotaKind,
): Promise<{ annual: number | null | undefined }> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      annualQuotaEv: true,
      annualQuotaVenue: true,
    },
  });
  if (!user) {
    throw new NotFoundException('User not found');
  }

  const override = await tx.userYearlyQuotas.findUnique({
    where: { userId_year: { userId, year } },
    select: {
      annualQuotaEv: true,
      annualQuotaVenue: true,
    },
  });

  if (kind === 'ev') {
    const annual =
      override?.annualQuotaEv !== undefined && override?.annualQuotaEv !== null
        ? override.annualQuotaEv
        : user.annualQuotaEv;
    return { annual };
  }

  const annual =
    override?.annualQuotaVenue !== undefined &&
    override?.annualQuotaVenue !== null
      ? override.annualQuotaVenue
      : user.annualQuotaVenue;
  return { annual };
}

/**
 * EV 已用次数：按车牌所属用户（Reserved By）统计，不含 Submitted By。
 * 管理员代订时占用被代订人额度。
 */
export async function countEvUsedForYear(
  tx: DbClient,
  userId: bigint,
  year: number,
): Promise<number> {
  const { start, endExclusive } = yearDateBounds(year);
  return tx.evBookings.count({
    where: {
      bookingDate: { gte: start, lt: endExclusive },
      status: { in: [...EV_ACTIVE_STATUSES] },
      licensePlate: { user_id: userId },
    },
  });
}

/**
 * Venue 已用次数：按 reserved_by（Reserved By）统计，不含 submitter（Submitted By）。
 * 管理员代订时占用被代订人额度。
 */
export async function countVenueUsedForYear(
  tx: DbClient,
  userId: bigint,
  year: number,
): Promise<number> {
  const { start, endExclusive } = yearDateBounds(year);
  return tx.venueBookings.count({
    where: {
      reservedByUserId: userId,
      bookingDate: { gte: start, lt: endExclusive },
      AND: [
        {
          OR: [
            { status: null },
            { status: { notIn: ['cancelled', 'canceled'], mode: 'insensitive' } },
          ],
        },
        {
          OR: [
            { approvalStatus: null },
            {
              approvalStatus: {
                in: ['pending', 'approved'],
                mode: 'insensitive',
              },
            },
          ],
        },
      ],
    },
  });
}

export async function resolveQuotaLimitForYear(
  tx: DbClient,
  userId: bigint,
  year: number,
  kind: QuotaKind,
): Promise<number | null | undefined> {
  const { annual } = await loadDefaultAndOverride(tx, userId, year, kind);
  return annual;
}

export async function getUserQuotaSnapshotForYear(
  tx: DbClient,
  userId: bigint,
  year: number,
): Promise<{
  year: number;
  usedEv: number;
  annualEv: number | null | undefined;
  usedVenue: number;
  annualVenue: number | null | undefined;
}> {
  const [usedEv, usedVenue, annualEv, annualVenue] = await Promise.all([
    countEvUsedForYear(tx, userId, year),
    countVenueUsedForYear(tx, userId, year),
    resolveQuotaLimitForYear(tx, userId, year, 'ev'),
    resolveQuotaLimitForYear(tx, userId, year, 'venue'),
  ]);
  return { year, usedEv, annualEv, usedVenue, annualVenue };
}

/** 批量：当前自然年已用次数（管理端列表） */
export async function batchCountUsedForYear(
  prisma: DbClient,
  userIds: bigint[],
  year: number,
): Promise<{
  evUsedByUserId: Map<string, number>;
  venueUsedByUserId: Map<string, number>;
}> {
  const evUsedByUserId = new Map<string, number>();
  const venueUsedByUserId = new Map<string, number>();
  if (!userIds.length) {
    return { evUsedByUserId, venueUsedByUserId };
  }

  const { start, endExclusive } = yearDateBounds(year);
  const idStrings = userIds.map((id) => id.toString());

  const evRows = await prisma.$queryRaw<Array<{ user_id: bigint; cnt: bigint }>>`
    SELECT lp.user_id AS user_id, COUNT(*)::bigint AS cnt
    FROM ev_bookings b
    INNER JOIN license_plates lp ON lp.id = b.license_plate_id
    WHERE lp.user_id IN (${Prisma.join(userIds)})
      AND b.booking_date >= ${start}
      AND b.booking_date < ${endExclusive}
      AND LOWER(b.status) IN ('pending', 'confirmed')
    GROUP BY lp.user_id
  `;

  for (const row of evRows) {
    if (row.user_id == null) continue;
    evUsedByUserId.set(row.user_id.toString(), Number(row.cnt));
  }

  const venueRows = await prisma.$queryRaw<
    Array<{ reserved_by: bigint; cnt: bigint }>
  >`
    SELECT v.reserved_by AS reserved_by, COUNT(*)::bigint AS cnt
    FROM venue_bookings v
    WHERE v.reserved_by IN (${Prisma.join(userIds)})
      AND v.booking_date >= ${start}
      AND v.booking_date < ${endExclusive}
      AND (v.status IS NULL OR LOWER(v.status) NOT IN ('cancelled', 'canceled'))
      AND (
        v.approval_status IS NULL
        OR LOWER(v.approval_status) IN ('pending', 'approved')
      )
    GROUP BY v.reserved_by
  `;

  for (const row of venueRows) {
    if (row.reserved_by == null) continue;
    venueUsedByUserId.set(row.reserved_by.toString(), Number(row.cnt));
  }

  // 保证调用方对每个 id 有默认 0 可读
  for (const id of idStrings) {
    if (!evUsedByUserId.has(id)) evUsedByUserId.set(id, 0);
    if (!venueUsedByUserId.has(id)) venueUsedByUserId.set(id, 0);
  }

  return { evUsedByUserId, venueUsedByUserId };
}

/** 批量读取某年覆盖额度 */
export async function batchLoadYearlyOverrides(
  prisma: DbClient,
  userIds: bigint[],
  year: number,
): Promise<
  Map<
    string,
    { annualQuotaEv: number | null; annualQuotaVenue: number | null }
  >
> {
  const map = new Map<
    string,
    { annualQuotaEv: number | null; annualQuotaVenue: number | null }
  >();
  if (!userIds.length) return map;

  const rows = await prisma.userYearlyQuotas.findMany({
    where: { userId: { in: userIds }, year },
    select: {
      userId: true,
      annualQuotaEv: true,
      annualQuotaVenue: true,
    },
  });
  for (const row of rows) {
    map.set(row.userId.toString(), {
      annualQuotaEv: row.annualQuotaEv,
      annualQuotaVenue: row.annualQuotaVenue,
    });
  }
  return map;
}

async function assertQuotaAvailable(
  tx: Prisma.TransactionClient,
  userId: bigint,
  kind: QuotaKind,
  bookingDate: Date | string,
): Promise<void> {
  const year = yearFromBookingDate(bookingDate);
  const { annual } = await loadDefaultAndOverride(tx, userId, year, kind);
  if (!isQuotaLimited(annual)) {
    return;
  }

  const used =
    kind === 'ev'
      ? await countEvUsedForYear(tx, userId, year)
      : await countVenueUsedForYear(tx, userId, year);

  if (used >= (annual ?? 0)) {
    throw new ForbiddenException(QUOTA_EXCEEDED[kind]);
  }
}

/**
 * 按 booking_date 所属自然年校验额度（实时 COUNT）。
 * 不再写入 user.used_quota_*。
 */
export function consumeEvQuota(
  tx: Prisma.TransactionClient,
  userId: bigint,
  bookingDate: Date | string,
): Promise<void> {
  return assertQuotaAvailable(tx, userId, 'ev', bookingDate);
}

export function consumeVenueQuota(
  tx: Prisma.TransactionClient,
  userId: bigint,
  bookingDate: Date | string,
): Promise<void> {
  return assertQuotaAvailable(tx, userId, 'venue', bookingDate);
}

/** 已用由预订表推导；取消时无需改计数器 */
export async function releaseEvQuota(
  _tx: Prisma.TransactionClient,
  _userId: bigint,
): Promise<void> {
  return;
}

export async function releaseVenueQuota(
  _tx: Prisma.TransactionClient,
  _userId: bigint,
): Promise<void> {
  return;
}

export { getAppCalendarYear, yearFromBookingDate, yearDateBounds };
