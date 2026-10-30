import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EvRedisCacheService } from '../redis/ev-redis-cache.service';
import { OccupyDto } from './dto/occupy.dto';
import { CreateEvBookingDto } from './dto/create-ev-booking.dto';
import { isSuperAdminAuth } from '../auth/super-admin.util';
import { isAdminRole } from '../auth/admin-role.util';
import { consumeEvQuota } from '../common/user-quota';
import { assertEvWeeklyBookingLimit } from '../common/ev-weekly-booking-limit';
import { HkPublicHolidaysService } from '../system-settings/hk-public-holidays.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { DisplayEventsService } from '../display-events/display-events.service';

const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed'] as const;
const MAX_BOOKING_SLOT_ATTEMPTS = 5;

type DbClient = PrismaService | Prisma.TransactionClient;

type FreeSlotRow = {
  id: bigint;
  ev_space: string;
  location: string | null;
};

type FreeSlot = {
  id: bigint;
  evSpace: string;
  location: string | null;
};

@Injectable()
export class ParkingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evCache: EvRedisCacheService,
    private readonly hkPublicHolidaysService: HkPublicHolidaysService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly displayEvents: DisplayEventsService,
  ) {}

  private toDateOnlyString(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  /** Prisma @db.Date 写入与 raw SQL 比较统一用 YYYY-MM-DD 字面量，避免 Date/timestamptz 时区偏差。 */
  private parseBookingDateYmd(ymd: string): { dateKey: string; date: Date } {
    const dateKey = ymd.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      throw new BadRequestException('bookingDate must be YYYY-MM-DD');
    }
    return { dateKey, date: new Date(`${dateKey}T00:00:00.000Z`) };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    );
  }

  private mapFreeSlotRow(row: FreeSlotRow): FreeSlot {
    return {
      id: row.id,
      evSpace: row.ev_space,
      location: row.location,
    };
  }

  private parseAuthSub(auth: { sub?: string }): bigint {
    const sub = String(auth?.sub ?? '').trim();
    if (!/^\d+$/.test(sub)) {
      throw new UnauthorizedException('Invalid session');
    }
    return BigInt(sub);
  }

  private async assertLicensePlateForUser(
    userId: bigint,
    licensePlateId: bigint,
    db: Pick<PrismaService, 'license_plates'>,
  ) {
    const plate = await db.license_plates.findUnique({ where: { id: licensePlateId } });
    if (!plate || plate.status !== 'active') {
      throw new BadRequestException('License plate unavailable.');
    }
    if (plate.user_id !== userId) {
      throw new BadRequestException('License plate does not belong to the reserved-by user.');
    }
    return plate;
  }

  private async resolveReservedByUserId(
    auth: { sub?: string; role?: string; system?: string },
    reservedByUserIdRaw: string | undefined,
    actorUserId: bigint,
  ): Promise<bigint> {
    const raw = String(reservedByUserIdRaw ?? '').trim();
    if (!raw) return actorUserId;
    if (!/^\d+$/.test(raw)) {
      throw new BadRequestException('Invalid reservedByUserId');
    }
    const reservedByUserId = BigInt(raw);
    if (reservedByUserId === actorUserId) return actorUserId;
    if (!isAdminRole(auth)) {
      throw new ForbiddenException('Only administrators can book on behalf of another user.');
    }
    return reservedByUserId;
  }

  private mapBooking(row: {
    id: bigint;
    userCorpId: string | null;
    licensePlateId: bigint;
    slotId: bigint;
    periodId: bigint | null;
    bookingDate: Date;
    bookedOn: Date | null;
    status: string;
    createdAt: Date;
    licensePlate?: { plate_number: string } | null;
    slot?: { evSpace: string; location: string | null } | null;
    period?: { period: string; startTime: Date; endTime: Date } | null;
  }) {
    return {
      id: row.id.toString(),
      userCorpId: row.userCorpId ?? undefined,
      licensePlateId: row.licensePlateId.toString(),
      plateNumber: row.licensePlate?.plate_number,
      slotId: row.slotId.toString(),
      periodId: row.periodId != null ? row.periodId.toString() : undefined,
      bookingDate: this.toDateOnlyString(row.bookingDate),
      bookedOn: row.bookedOn?.toISOString() ?? undefined,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      evSpace: row.slot?.evSpace,
      location: row.slot?.location ?? undefined,
      period: row.period?.period,
    };
  }

  private async countActiveParkingSlots(db: DbClient = this.prisma): Promise<number> {
    return db.evParkingSlots.count({
      where: { status: 'active' },
    });
  }

  private async countBookedForPeriod(
    periodId: bigint,
    bookingDate: Date,
    db: DbClient = this.prisma,
  ): Promise<number> {
    return db.evBookings.count({
      where: {
        periodId,
        bookingDate,
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
      },
    });
  }

  /** 单次 count 得到余量，避免拉全表车位 */
  private async getPeriodAvailabilitySummary(
    periodId: bigint,
    bookingDate: Date,
    db: DbClient = this.prisma,
  ) {
    const total = await this.countActiveParkingSlots(db);
    if (total === 0) {
      return { total, booked: 0, remaining: 0 };
    }
    const booked = await this.countBookedForPeriod(periodId, bookingDate, db);
    return {
      total,
      booked,
      remaining: Math.max(0, total - booked),
    };
  }

  private async queryFreeSlotsForPeriod(
    periodId: bigint,
    dateKey: string,
    db: DbClient,
    limit: number,
  ): Promise<FreeSlot[]> {
    const rows = await db.$queryRaw<FreeSlotRow[]>`
      SELECT s.id, s.ev_space, s.location
      FROM ev_parking_slots s
      WHERE s.status = 'active'
        AND NOT EXISTS (
          SELECT 1
          FROM ev_bookings b
          WHERE b.slot_id = s.id
            AND b.period_id = ${periodId}
            AND b.booking_date = ${dateKey}::date
            AND b.status IN ('pending', 'confirmed')
        )
      ORDER BY s.id
      LIMIT ${limit}
    `;
    return rows.map((row) => this.mapFreeSlotRow(row));
  }

  /**
   * 按 (时段, 日期) 串行选位，避免在 ev_parking_slots 行上做 FOR UPDATE：
   * 物理车位只有 3 行，若对其加行锁，跨日期/跨时段的并发会互相 SKIP，误报「已满」。
   */
  private async acquirePeriodDateAdvisoryLock(
    tx: Prisma.TransactionClient,
    periodId: bigint,
    dateKey: string,
  ) {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtext(concat(cast(${periodId} AS text), ':', ${dateKey}))
      )
    `;
  }

  /** 事务内选取一个该时段+日期的空闲车位（不加 ev_parking_slots 行锁）。 */
  private async pickOneFreeSlot(
    tx: Prisma.TransactionClient,
    periodId: bigint,
    dateKey: string,
    preferredSlotId?: bigint,
  ): Promise<FreeSlot | null> {
    await this.acquirePeriodDateAdvisoryLock(tx, periodId, dateKey);

    if (preferredSlotId != null) {
      const preferred = await tx.$queryRaw<FreeSlotRow[]>`
        SELECT s.id, s.ev_space, s.location
        FROM ev_parking_slots s
        WHERE s.id = ${preferredSlotId}
          AND s.status = 'active'
          AND NOT EXISTS (
            SELECT 1
            FROM ev_bookings b
            WHERE b.slot_id = s.id
              AND b.period_id = ${periodId}
              AND b.booking_date = ${dateKey}::date
              AND b.status IN ('pending', 'confirmed')
          )
        LIMIT 1
      `;
      if (preferred[0]) {
        return this.mapFreeSlotRow(preferred[0]);
      }
    }

    const rows = await tx.$queryRaw<FreeSlotRow[]>`
      SELECT s.id, s.ev_space, s.location
      FROM ev_parking_slots s
      WHERE s.status = 'active'
        AND NOT EXISTS (
          SELECT 1
          FROM ev_bookings b
          WHERE b.slot_id = s.id
            AND b.period_id = ${periodId}
            AND b.booking_date = ${dateKey}::date
            AND b.status IN ('pending', 'confirmed')
        )
      ORDER BY s.id
      LIMIT 1
    `;
    return rows[0] ? this.mapFreeSlotRow(rows[0]) : null;
  }

  private async resolveFreeSlotsForPeriod(
    periodId: bigint,
    bookingDate: Date,
    db: DbClient = this.prisma,
  ) {
    const dateKey = this.toDateOnlyString(bookingDate);
    const summary = await this.getPeriodAvailabilitySummary(periodId, bookingDate, db);
    if (summary.remaining === 0) {
      return { ...summary, freeSlots: [] as FreeSlot[] };
    }
    const freeSlots = await this.queryFreeSlotsForPeriod(
      periodId,
      dateKey,
      db,
      summary.remaining,
    );
    return { ...summary, freeSlots };
  }

  private pickRandomSlot<T>(slots: T[]): T | null {
    if (slots.length === 0) return null;
    return slots[Math.floor(Math.random() * slots.length)];
  }

  private mapSlotPreview(slot: { id: bigint; evSpace: string; location: string | null }) {
    return {
      id: slot.id.toString(),
      evSpace: slot.evSpace,
      location: slot.location ?? undefined,
    };
  }

  async getAssignmentPreview(bookingDate: string, periodIdRaw: string, preferredSlotId?: string) {
    const { dateKey, date: bookingDateObj } = this.parseBookingDateYmd(bookingDate);

    const cached = await this.evCache.getAssignmentPreview(dateKey, periodIdRaw);
    if (cached) {
      return this.buildAssignmentPreviewResponse(cached, preferredSlotId);
    }

    const base = await this.loadAssignmentPreviewBase(periodIdRaw, bookingDateObj);
    await this.evCache.setAssignmentPreview(dateKey, periodIdRaw, base);
    return this.buildAssignmentPreviewResponse(base, preferredSlotId);
  }

  async getSlotOptions(
    bookingDate: string,
    periodIdRaw: string,
    excludeBookingIdRaw?: string,
  ) {
    const { dateKey } = this.parseBookingDateYmd(bookingDate);
    const periodId = BigInt(periodIdRaw);

    const period = await this.prisma.evTimePeriods.findUnique({ where: { id: periodId } });
    if (!period || period.status !== 'active') {
      throw new BadRequestException('Time period unavailable.');
    }

    const excludeBookingId =
      excludeBookingIdRaw && /^\d+$/.test(String(excludeBookingIdRaw).trim())
        ? BigInt(String(excludeBookingIdRaw).trim())
        : null;

    type SlotOptionRow = {
      id: bigint;
      ev_space: string;
      location: string | null;
      available: boolean;
    };

    const rows: SlotOptionRow[] = excludeBookingId
      ? await this.prisma.$queryRaw<SlotOptionRow[]>`
          SELECT
            s.id,
            s.ev_space,
            s.location,
            NOT EXISTS (
              SELECT 1
              FROM ev_bookings b
              WHERE b.slot_id = s.id
                AND b.period_id = ${periodId}
                AND b.booking_date = ${dateKey}::date
                AND b.status IN ('pending', 'confirmed')
                AND b.id <> ${excludeBookingId}
            ) AS available
          FROM ev_parking_slots s
          WHERE s.status = 'active'
          ORDER BY s.id
        `
      : await this.prisma.$queryRaw<SlotOptionRow[]>`
          SELECT
            s.id,
            s.ev_space,
            s.location,
            NOT EXISTS (
              SELECT 1
              FROM ev_bookings b
              WHERE b.slot_id = s.id
                AND b.period_id = ${periodId}
                AND b.booking_date = ${dateKey}::date
                AND b.status IN ('pending', 'confirmed')
            ) AS available
          FROM ev_parking_slots s
          WHERE s.status = 'active'
          ORDER BY s.id
        `;

    const slots = rows.map((row) => ({
      id: row.id.toString(),
      evSpace: row.ev_space,
      location: row.location ?? undefined,
      available: Boolean(row.available),
    }));
    const availableCount = slots.filter((slot) => slot.available).length;

    return {
      bookingDate: dateKey,
      periodId: periodId.toString(),
      total: slots.length,
      booked: slots.length - availableCount,
      remaining: availableCount,
      slots,
    };
  }

  private buildAssignmentPreviewResponse(
    base: {
      total: number;
      booked: number;
      remaining: number;
      isFull: boolean;
      freeSlots: Array<{ id: string; evSpace: string; location?: string }>;
    },
    preferredSlotId?: string,
  ) {
    if (base.isFull) {
      return {
        total: base.total,
        booked: base.booked,
        remaining: 0,
        isFull: true,
        suggestedSlot: null,
      };
    }

    const freeSlots = base.freeSlots.map((s) => ({
      id: BigInt(s.id),
      evSpace: s.evSpace,
      location: s.location ?? null,
    }));

    let slot = preferredSlotId
      ? freeSlots.find((s) => s.id.toString() === preferredSlotId) ?? null
      : null;
    if (!slot) {
      slot = this.pickRandomSlot(freeSlots);
    }

    return {
      total: base.total,
      booked: base.booked,
      remaining: base.remaining,
      isFull: false,
      suggestedSlot: slot ? this.mapSlotPreview(slot) : null,
    };
  }

  private async loadAssignmentPreviewBase(periodIdRaw: string, bookingDateObj: Date) {
    const periodId = BigInt(periodIdRaw);

    const period = await this.prisma.evTimePeriods.findUnique({ where: { id: periodId } });
    if (!period || period.status !== 'active') {
      throw new BadRequestException('Time period unavailable.');
    }

    const { freeSlots, total, booked, remaining } = await this.resolveFreeSlotsForPeriod(
      periodId,
      bookingDateObj,
    );

    if (remaining === 0) {
      return {
        total,
        booked,
        remaining: 0,
        isFull: true,
        freeSlots: [] as Array<{ id: string; evSpace: string; location?: string }>,
      };
    }

    return {
      total,
      booked,
      remaining,
      isFull: false,
      freeSlots: freeSlots.map((s) => ({
        id: s.id.toString(),
        evSpace: s.evSpace,
        location: s.location ?? undefined,
      })),
    };
  }

  async getCalendarAvailability(startDate: string, endDate: string) {
    const cached = await this.evCache.getCalendar(startDate, endDate);
    if (cached) {
      return cached;
    }

    const data = await this.loadCalendarAvailabilityFromDb(startDate, endDate);
    await this.evCache.setCalendar(startDate, endDate, data);
    return data;
  }

  private async loadCalendarAvailabilityFromDb(startDate: string, endDate: string) {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);
    if (end < start) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    const total = await this.countActiveParkingSlots();
    const availability: Record<string, { available: number; total: number; booked: number }> =
      {};

    if (total === 0) {
      return { totalSpaces: 0, availability };
    }

    const rows = await this.prisma.evBookings.groupBy({
      by: ['bookingDate', 'periodId'],
      where: {
        bookingDate: { gte: start, lte: end },
        periodId: { not: null },
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
      },
      _count: { _all: true },
    });

    for (const row of rows) {
      if (row.periodId == null) continue;
      const dateKey = this.toDateOnlyString(row.bookingDate);
      const periodKey = row.periodId.toString();
      const booked = row._count._all;
      const key = `${dateKey}-${periodKey}`;
      availability[key] = {
        booked,
        total,
        available: Math.max(0, total - booked),
      };
    }

    return { totalSpaces: total, availability };
  }

  async createBooking(auth: { corpId?: string; sub?: string; role?: string; isSuperAdmin?: boolean; system?: string }, dto: CreateEvBookingDto) {
    if (isSuperAdminAuth(auth)) {
      throw new ForbiddenException('Super admin is not allowed to book resources');
    }
    const actorUserId = this.parseAuthSub(auth);
    const reservedByUserId = await this.resolveReservedByUserId(auth, dto.reservedByUserId, actorUserId);
    const reservedUser = await this.prisma.user.findUnique({
      where: { id: reservedByUserId },
      select: { corpId: true, status: true },
    });
    if (!reservedUser) {
      throw new BadRequestException('Reserved-by user not found');
    }
    if (String(reservedUser.status || '').toLowerCase() !== 'active') {
      throw new BadRequestException('Reserved-by user is not active');
    }
    const userCorpId = String(reservedUser.corpId ?? '').trim();
    if (!userCorpId) {
      throw new BadRequestException('Reserved-by user is missing CORP User ID');
    }

    const licensePlateId = BigInt(dto.licensePlateId);
    const periodId = BigInt(dto.periodId);
    const { dateKey, date: bookingDate } = this.parseBookingDateYmd(dto.bookingDate);
    await this.hkPublicHolidaysService.assertBookableForUser(bookingDate, auth);
    const preferredSlotId =
      dto.slotId != null && /^\d+$/.test(String(dto.slotId).trim())
        ? BigInt(String(dto.slotId).trim())
        : undefined;

    let lastError: unknown;
    const weeklyLimit = await this.systemSettingsService.getEvWeeklyBookingLimit();

    for (let attempt = 0; attempt < MAX_BOOKING_SLOT_ATTEMPTS; attempt++) {
      try {
        const booking = await this.prisma.$transaction(async (tx) => {
          const period = await tx.evTimePeriods.findUnique({ where: { id: periodId } });
          if (!period || period.status !== 'active') {
            throw new ConflictException('Time period unavailable.');
          }

          await this.assertLicensePlateForUser(reservedByUserId, licensePlateId, tx);

          const tryPreferred = attempt === 0 ? preferredSlotId : undefined;
          const slot = await this.pickOneFreeSlot(
            tx,
            periodId,
            dateKey,
            tryPreferred,
          );
          if (!slot) {
            throw new ConflictException('This time slot is fully booked.');
          }

          await assertEvWeeklyBookingLimit(
            tx,
            reservedByUserId,
            dateKey,
            weeklyLimit,
            {
              bypassWeeklyLimit:
                isAdminRole(auth) && reservedByUserId !== actorUserId,
            },
          );
          await consumeEvQuota(tx, reservedByUserId, bookingDate);

          const now = new Date();

          return tx.evBookings.create({
            data: {
              userCorpId,
              submitterUserId: actorUserId,
              licensePlateId,
              slotId: slot.id,
              periodId,
              bookingDate,
              bookedOn: now,
              status: 'confirmed',
            },
            include: {
              licensePlate: { select: { plate_number: true } },
              slot: { select: { evSpace: true, location: true } },
              period: { select: { period: true, startTime: true, endTime: true } },
            },
          });
        });

        await this.evCache.bumpCalendarVersion();

        this.displayEvents.notify(['ev'], 'ev-booking-create');
        return {
          message: 'Booking created',
          booking: this.mapBooking(booking),
        };
      } catch (error) {
        if (
          error instanceof ConflictException ||
          error instanceof BadRequestException ||
          error instanceof ForbiddenException
        ) {
          throw error;
        }
        if (this.isUniqueViolation(error)) {
          lastError = error;
          continue;
        }
        throw new InternalServerErrorException((error as Error).message);
      }
    }

    if (lastError) {
      throw new ConflictException('This time slot is fully booked.');
    }
    throw new ConflictException('This time slot is fully booked.');
  }

  async occupy(dto: OccupyDto) {
    const slotId = BigInt(dto.slotId);
    const periodId = BigInt(dto.periodId);
    const { date: bookingDate } = this.parseBookingDateYmd(dto.bookingDate);
    const licensePlateId = BigInt(dto.licensePlateId);

    try {
      const booking = await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<FreeSlotRow[]>`
          SELECT s.id, s.ev_space, s.location
          FROM ev_parking_slots s
          WHERE s.id = ${slotId}
            AND s.status = 'active'
          FOR UPDATE OF s
        `;
        if (!locked[0]) {
          throw new ConflictException('Parking slot unavailable.');
        }

        const conflict = await tx.evBookings.count({
          where: {
            slotId,
            periodId,
            bookingDate,
            status: { in: [...ACTIVE_BOOKING_STATUSES] },
          },
        });
        if (conflict >= 1) {
          throw new ConflictException(
            'This EV space is already occupied for the selected period.',
          );
        }

        return tx.evBookings.create({
          data: {
            userCorpId: dto.userCorpId,
            licensePlateId,
            slotId,
            periodId,
            bookingDate,
            bookedOn: new Date(),
            status: 'confirmed',
          },
          include: {
            licensePlate: { select: { plate_number: true } },
            slot: { select: { evSpace: true, location: true } },
          },
        });
      });

      await this.evCache.bumpCalendarVersion();

      return { message: 'occupied', booking: this.mapBooking(booking) };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'This EV space is already occupied for the selected period.',
        );
      }
      throw new InternalServerErrorException((error as Error).message);
    }
  }
}
