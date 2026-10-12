import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getAppTodayYmd } from '../common/app-timezone';
import { PrismaService } from '../prisma/prisma.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { DataRetentionPurgeSummary } from './data-retention.types';

const BATCH_SIZE = 500;

function cutoffBeforeMonths(months: number): Date {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return cutoff;
}

/** Prisma @db.Date 比较用：业务日历日 YYYY-MM-DD → UTC 午夜 */
function parseDateOnlyYmd(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  async runMonthlyPurge(): Promise<DataRetentionPurgeSummary> {
    const startedAt = new Date();
    const retentionMonths =
      await this.systemSettingsService.getDataRetentionMonths();
    const cutoff = cutoffBeforeMonths(retentionMonths);
    const todayYmd = getAppTodayYmd();
    const todayDate = parseDateOnlyYmd(todayYmd);

    const summary: DataRetentionPurgeSummary = {
      retentionMonths,
      cutoffIso: cutoff.toISOString(),
      venueBookingsDeleted: 0,
      evBookingsDeletedByAge: 0,
      evBookingsDeletedForUserPlates: 0,
      licensePlatesDeleted: 0,
      usersDeleted: 0,
      startedAtIso: startedAt.toISOString(),
      finishedAtIso: startedAt.toISOString(),
      ok: false,
    };

    this.logger.log(
      `Data retention purge starting: months=${retentionMonths}, cutoff=${summary.cutoffIso}, todayYmd=${todayYmd}`,
    );

    try {
      const planned = await this.countPlannedDeletes(cutoff, todayDate);
      this.logger.log(
        `Data retention purge plan: venueBookings=${planned.venueBookings}, evBookingsByAge=${planned.evBookingsByAge}, inactiveUsers=${planned.inactiveUsers}, licensePlates=${planned.licensePlates}`,
      );

      summary.venueBookingsDeleted =
        await this.deleteVenueBookingsByAgeAndPastDate(cutoff, todayDate);
      summary.evBookingsDeletedByAge =
        await this.deleteEvBookingsByAgeAndPastDate(cutoff, todayDate);

      const userPurge = await this.deleteInactiveUsersAndPlates(cutoff);
      summary.evBookingsDeletedForUserPlates = userPurge.evBookingsForPlates;
      summary.licensePlatesDeleted = userPurge.licensePlates;
      summary.usersDeleted = userPurge.users;

      summary.ok = true;
      summary.finishedAtIso = new Date().toISOString();
      this.logger.log(
        `Data retention purge completed: ${JSON.stringify(summary)}`,
      );
      return summary;
    } catch (err) {
      summary.ok = false;
      summary.errorMessage =
        err instanceof Error ? err.message : String(err ?? 'unknown error');
      summary.finishedAtIso = new Date().toISOString();
      this.logger.error(
        `Data retention purge failed: ${summary.errorMessage}`,
        err instanceof Error ? err.stack : undefined,
      );
      return summary;
    }
  }

  /**
   * Venue：created_at 超龄，且 booking_date 早于今天（HKT）或为空。
   */
  private agedVenueBookingWhere(
    cutoff: Date,
    todayDate: Date,
  ): Prisma.VenueBookingsWhereInput {
    return {
      createdAt: { lt: cutoff },
      OR: [{ bookingDate: null }, { bookingDate: { lt: todayDate } }],
    };
  }

  /**
   * EV：created_at 超龄 且 booking_date 早于今天（HKT）。
   */
  private agedEvBookingWhere(
    cutoff: Date,
    todayDate: Date,
  ): Prisma.EvBookingsWhereInput {
    return {
      createdAt: { lt: cutoff },
      bookingDate: { lt: todayDate },
    };
  }

  private async countPlannedDeletes(cutoff: Date, todayDate: Date) {
    const inactiveUserWhere = this.inactiveUserWhere(cutoff);
    const venueWhere = this.agedVenueBookingWhere(cutoff, todayDate);
    const evWhere = this.agedEvBookingWhere(cutoff, todayDate);
    const [venueBookings, evBookingsByAge, inactiveUserRows] =
      await Promise.all([
        this.prisma.venueBookings.count({ where: venueWhere }),
        this.prisma.evBookings.count({ where: evWhere }),
        this.prisma.user.findMany({
          where: inactiveUserWhere,
          select: { id: true },
        }),
      ]);

    const inactiveUsers = inactiveUserRows.length;
    const licensePlates =
      inactiveUsers === 0
        ? 0
        : await this.prisma.license_plates.count({
            where: {
              user_id: { in: inactiveUserRows.map((u) => u.id) },
            },
          });

    return { venueBookings, evBookingsByAge, inactiveUsers, licensePlates };
  }

  private inactiveUserWhere(cutoff: Date): Prisma.UserWhereInput {
    return {
      status: { equals: 'inactive', mode: 'insensitive' },
      inactiveTime: { not: null, lt: cutoff },
      isSystemHidden: false,
      AND: [
        {
          OR: [
            { accessRoleId: null },
            {
              access_roles: {
                is: {
                  role_name: { not: 'SuperAdmin', mode: 'insensitive' },
                },
              },
            },
          ],
        },
      ],
    };
  }

  private async deleteVenueBookingsByAgeAndPastDate(
    cutoff: Date,
    todayDate: Date,
  ): Promise<number> {
    const where = this.agedVenueBookingWhere(cutoff, todayDate);
    let deleted = 0;
    for (;;) {
      const rows = await this.prisma.venueBookings.findMany({
        where,
        select: { id: true },
        take: BATCH_SIZE,
        orderBy: { id: 'asc' },
      });
      if (!rows.length) break;
      const ids = rows.map((r) => r.id);
      const result = await this.prisma.venueBookings.deleteMany({
        where: { id: { in: ids } },
      });
      deleted += result.count;
      if (rows.length < BATCH_SIZE) break;
    }
    return deleted;
  }

  private async deleteEvBookingsByAgeAndPastDate(
    cutoff: Date,
    todayDate: Date,
  ): Promise<number> {
    const where = this.agedEvBookingWhere(cutoff, todayDate);
    let deleted = 0;
    for (;;) {
      const rows = await this.prisma.evBookings.findMany({
        where,
        select: { id: true },
        take: BATCH_SIZE,
        orderBy: { id: 'asc' },
      });
      if (!rows.length) break;
      const ids = rows.map((r) => r.id);
      const result = await this.prisma.evBookings.deleteMany({
        where: { id: { in: ids } },
      });
      deleted += result.count;
      if (rows.length < BATCH_SIZE) break;
    }
    return deleted;
  }

  private async deleteInactiveUsersAndPlates(cutoff: Date): Promise<{
    users: number;
    licensePlates: number;
    evBookingsForPlates: number;
  }> {
    let usersDeleted = 0;
    let platesDeleted = 0;
    let evForPlatesDeleted = 0;

    for (;;) {
      const users = await this.prisma.user.findMany({
        where: this.inactiveUserWhere(cutoff),
        select: { id: true },
        take: BATCH_SIZE,
        orderBy: { id: 'asc' },
      });
      if (!users.length) break;

      const userIds = users.map((u) => u.id);
      const plates = await this.prisma.license_plates.findMany({
        where: { user_id: { in: userIds } },
        select: { id: true },
      });
      const plateIds = plates.map((p) => p.id);

      if (plateIds.length) {
        // EV bookings FK to plates is ON DELETE NO ACTION; clear remaining refs first.
        const evResult = await this.prisma.evBookings.deleteMany({
          where: { licensePlateId: { in: plateIds } },
        });
        evForPlatesDeleted += evResult.count;

        const plateResult = await this.prisma.license_plates.deleteMany({
          where: { id: { in: plateIds } },
        });
        platesDeleted += plateResult.count;
      }

      const userResult = await this.prisma.user.deleteMany({
        where: {
          id: { in: userIds },
          // Re-check status so Active users are never deleted even if race occurs.
          status: { equals: 'inactive', mode: 'insensitive' },
        },
      });
      usersDeleted += userResult.count;

      if (users.length < BATCH_SIZE) break;
    }

    return {
      users: usersDeleted,
      licensePlates: platesDeleted,
      evBookingsForPlates: evForPlatesDeleted,
    };
  }
}
