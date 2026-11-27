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
        `Data retention purge plan: venueBookings=${planned.venueBookings}, evBookingsByAge=${planned.evBookingsByAge}`,
      );

      summary.venueBookingsDeleted =
        await this.deleteVenueBookingsByAgeAndPastDate(cutoff, todayDate);
      summary.evBookingsDeletedByAge =
        await this.deleteEvBookingsByAgeAndPastDate(cutoff, todayDate);

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
    const venueWhere = this.agedVenueBookingWhere(cutoff, todayDate);
    const evWhere = this.agedEvBookingWhere(cutoff, todayDate);
    const [venueBookings, evBookingsByAge] = await Promise.all([
      this.prisma.venueBookings.count({ where: venueWhere }),
      this.prisma.evBookings.count({ where: evWhere }),
    ]);

    return { venueBookings, evBookingsByAge };
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
}
