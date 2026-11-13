import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { APP_TIMEZONE } from '../common/app-timezone';
import {
  assertFutureBookingDateForUser,
  assertPublicHolidayBookableForUser,
  assertWeekendBookableForUser,
  isWeekendDate,
} from '../common/booking-date-restriction';
import { PrismaService } from '../prisma/prisma.service';
import { parse1823HolidayJson } from './hk-public-holidays.parser';
import { SystemSettingsService } from './system-settings.service';

type SyncTrigger = 'startup' | 'cron' | 'manual';

@Injectable()
export class HkPublicHolidaysService implements OnModuleInit {
  private readonly logger = new Logger(HkPublicHolidaysService.name);
  private syncInProgress = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  async onModuleInit() {
    const count = await this.prisma.hk_public_holidays.count();
    if (count === 0) {
      await this.syncFromRemote('startup');
    }
  }

  /** 每天 03:00（APP_TIMEZONE）同步香港公众假期 */
  @Cron('0 3 * * *', { timeZone: APP_TIMEZONE })
  async handleHolidaySyncCron() {
    await this.syncFromRemote('cron');
  }

  private parseDateOnlyYmd(ymd: string): Date {
    const text = String(ymd || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new BadRequestException('Invalid date format, expected YYYY-MM-DD');
    }
    return new Date(`${text}T00:00:00.000Z`);
  }

  private toYmd(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  async getLatestSyncedAt(): Promise<string | null> {
    const row = await this.prisma.hk_public_holidays.findFirst({
      orderBy: { synced_at: 'desc' },
      select: { synced_at: true },
    });
    return row?.synced_at?.toISOString() ?? null;
  }

  async listHolidays(fromYmd: string, toYmd: string) {
    const from = this.parseDateOnlyYmd(fromYmd);
    const to = this.parseDateOnlyYmd(toYmd);
    if (to < from) {
      throw new BadRequestException('to must be on or after from');
    }

    const rows = await this.prisma.hk_public_holidays.findMany({
      where: { holiday_date: { gte: from, lte: to } },
      orderBy: { holiday_date: 'asc' },
    });

    return {
      holidays: rows.map((row) => ({
        date: this.toYmd(row.holiday_date),
        summary: row.summary ?? 'Public Holiday',
      })),
      syncedAt: await this.getLatestSyncedAt(),
    };
  }

  async isPublicHoliday(date: Date): Promise<boolean> {
    const row = await this.prisma.hk_public_holidays.findUnique({
      where: { holiday_date: date },
      select: { holiday_date: true },
    });
    return Boolean(row);
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  async isWorkingDay(date: Date): Promise<boolean> {
    if (isWeekendDate(date)) return false;
    return !(await this.isPublicHoliday(date));
  }

  /** 从 fromYmd 起向后找第一个工作日（跳过周末及香港公众假期）。 */
  async getNextWorkingDayYmd(fromYmd: string): Promise<string> {
    let date = this.parseDateOnlyYmd(fromYmd);
    do {
      date = this.addDays(date, 1);
    } while (!(await this.isWorkingDay(date)));
    return this.toYmd(date);
  }

  async assertNotPublicHoliday(date: Date) {
    const row = await this.prisma.hk_public_holidays.findUnique({
      where: { holiday_date: date },
      select: { summary: true },
    });
    if (!row) return;
    const label = String(row.summary ?? '').trim() || 'Public Holiday';
    throw new BadRequestException(
      `Booking is not allowed on Hong Kong public holidays (${label})`,
    );
  }

  /**
   * 普通用户：周末/公众假期不可订；管理员不受限。
   * allowSameDay：Venue 为 true（可订当日）；EV 默认 false（不可订当日）。
   */
  async assertBookableForUser(
    date: Date,
    auth: { role?: string; system?: string } | null | undefined,
    options?: { allowSameDay?: boolean },
  ) {
    assertFutureBookingDateForUser(date, auth, options);
    assertWeekendBookableForUser(date, auth);
    const row = await this.prisma.hk_public_holidays.findUnique({
      where: { holiday_date: date },
      select: { summary: true },
    });
    assertPublicHolidayBookableForUser(date, row?.summary, auth);
  }

  async syncFromRemote(trigger: SyncTrigger) {
    if (this.syncInProgress) {
      return { skipped: true, count: 0, syncedAt: await this.getLatestSyncedAt() };
    }

    this.syncInProgress = true;
    try {
      const url = await this.systemSettingsService.getHkPublicHolidaysUrl();
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        throw new BadRequestException(
          `Failed to fetch Hong Kong public holidays (${response.status})`,
        );
      }

      const payload = await response.json();
      const holidays = parse1823HolidayJson(payload);
      if (!holidays.length) {
        throw new BadRequestException('No public holidays found in remote feed');
      }

      const syncedAt = new Date();
      await this.prisma.$transaction(
        holidays.map((holiday) =>
          this.prisma.hk_public_holidays.upsert({
            where: { holiday_date: this.parseDateOnlyYmd(holiday.date) },
            create: {
              holiday_date: this.parseDateOnlyYmd(holiday.date),
              summary: holiday.summary,
              source_uid: holiday.sourceUid || null,
              synced_at: syncedAt,
            },
            update: {
              summary: holiday.summary,
              source_uid: holiday.sourceUid || null,
              synced_at: syncedAt,
            },
          }),
        ),
      );

      this.logger.log(
        `HK public holidays sync (${trigger}): upserted ${holidays.length} day(s) from ${url}`,
      );

      return {
        skipped: false,
        count: holidays.length,
        syncedAt: syncedAt.toISOString(),
      };
    } catch (err) {
      this.logger.error(`HK public holidays sync failed (${trigger})`, err);
      throw err;
    } finally {
      this.syncInProgress = false;
    }
  }
}
