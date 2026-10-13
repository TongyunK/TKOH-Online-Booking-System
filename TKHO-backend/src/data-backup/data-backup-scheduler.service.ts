import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  APP_TIMEZONE,
  formatYmdInTimeZone,
  getAppWeekBoundsYmd,
  getIsoWeekdayInTimeZone,
} from '../common/app-timezone';
import { DataBackupEmailInterval } from '../system-settings/system-setting.keys';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { DataBackupMailService } from './data-backup-mail.service';
import { DataBackupReportService } from './data-backup-report.service';

type BackupTrigger = 'cron' | 'manual';

export type DataBackupRunResult = {
  fileName: string;
  receivingEmail: string;
  dateRange: {
    startYmd: string;
    endYmd: string;
    timeSpanDays: number;
  };
  summary: {
    venueBookings: number;
    evBookings: number;
    users: number;
    pendingUsers: number;
    venues: number;
    venueBlocks: number;
    licensePlates: number;
    evParkingSlots: number;
    evTimePeriods: number;
    departments: number;
    accessRoles: number;
    bookingWindows: number;
    prompts: number;
    systemSettings: number;
    displayConfigSettings: number;
  };
};

@Injectable()
export class DataBackupSchedulerService {
  private readonly logger = new Logger(DataBackupSchedulerService.name);
  private runInProgress = false;
  private lastSentKey: string | null = null;

  constructor(
    private readonly systemSettingsService: SystemSettingsService,
    private readonly reportService: DataBackupReportService,
    private readonly mailService: DataBackupMailService,
  ) {}

  /** 每分钟检查是否到达 HKT 配置的发送时刻 */
  @Cron('* * * * *', { timeZone: APP_TIMEZONE })
  async handleBackupCron() {
    await this.maybeRunScheduledBackup('cron');
  }

  async runBackupNow(): Promise<DataBackupRunResult> {
    if (this.runInProgress) {
      throw new ConflictException('A data backup is already in progress.');
    }
    const result = await this.executeBackup('manual', { throwOnError: true });
    return result as DataBackupRunResult;
  }

  private async maybeRunScheduledBackup(trigger: BackupTrigger) {
    if (this.runInProgress) return;

    try {
      const settings = await this.systemSettingsService.getSettings();
      // Auto-send off: skip silently (avoid per-minute DEBUG noise in local/cloud).
      if (!settings.dataBackupEmailEnabled) return;

      const receivingEmail = String(
        settings.dataBackupReceivingEmail ?? '',
      ).trim();
      if (!receivingEmail) return;

      const sendTime = String(settings.dataBackupEmailSendTime ?? '09:00').trim();
      const interval = settings.dataBackupEmailInterval as DataBackupEmailInterval;
      const now = new Date();
      const todayYmd = formatYmdInTimeZone(now, APP_TIMEZONE);
      const currentHm = this.formatHmInTimeZone(now, APP_TIMEZONE);

      if (trigger === 'cron') {
        if (!this.isConfiguredSendMinute(now, sendTime)) return;
        if (!this.shouldSendForInterval(interval, todayYmd)) {
          this.logger.debug(
            `Data backup cron skipped at ${currentHm} HKT: interval=${interval} does not apply today (${todayYmd})`,
          );
          return;
        }

        // Include sendTime so changing Send time the same day can be re-tested.
        const sentKey = this.buildSentKey(interval, todayYmd, sendTime);
        if (this.lastSentKey === sentKey) {
          this.logger.debug(
            `Data backup cron skipped at ${currentHm} HKT: already sent for key ${sentKey}`,
          );
          return;
        }

        this.logger.log(
          `Data backup cron matched ${sendTime} HKT (${interval}); starting send…`,
        );
        const result = await this.executeBackup(trigger, { throwOnError: false });
        // Only mark sent after success, so a failed minute can retry next tick / after fix.
        if (result) {
          this.lastSentKey = sentKey;
        }
        return;
      }

      await this.executeBackup(trigger, { throwOnError: false });
    } catch (err) {
      this.logger.error(`Data backup scheduler check failed (${trigger})`, err);
    }
  }

  private async executeBackup(
    trigger: BackupTrigger,
    options: { throwOnError: boolean },
  ): Promise<DataBackupRunResult | void> {
    if (this.runInProgress) {
      if (options.throwOnError) {
        throw new ConflictException('A data backup is already in progress.');
      }
      return;
    }

    this.runInProgress = true;
    try {
      const settings = await this.systemSettingsService.getSettings();
      const receivingEmail = String(
        settings.dataBackupReceivingEmail ?? '',
      ).trim();
      if (!receivingEmail) {
        const message = 'Data backup receiving email is not configured.';
        if (options.throwOnError) {
          throw new BadRequestException(message);
        }
        this.logger.warn(`Data backup skipped (${trigger}): ${message}`);
        return;
      }

      const timeSpanDays = settings.dataBackupTimeSpan;
      const range = this.reportService.resolveDateRange(timeSpanDays);
      const workbook = await this.reportService.buildWorkbook(timeSpanDays);

      await this.mailService.sendBackupEmail(
        workbook,
        range,
        receivingEmail,
      );

      const result: DataBackupRunResult = {
        fileName: workbook.fileName,
        receivingEmail,
        dateRange: range,
        summary: workbook.summary,
      };

      this.logger.log(
        `Data backup completed (${trigger}): ${workbook.fileName} → ${receivingEmail}`,
      );
      return result;
    } catch (err) {
      this.logger.error(`Data backup failed (${trigger})`, err);
      if (options.throwOnError) {
        throw err;
      }
    } finally {
      this.runInProgress = false;
    }
  }

  private isConfiguredSendMinute(now: Date, sendTime: string): boolean {
    const currentHm = this.formatHmInTimeZone(now, APP_TIMEZONE);
    return currentHm === sendTime;
  }

  private shouldSendForInterval(
    interval: DataBackupEmailInterval,
    todayYmd: string,
  ): boolean {
    if (interval === 'daily') return true;
    if (interval === 'weekly') {
      return getIsoWeekdayInTimeZone(todayYmd, APP_TIMEZONE) === 1;
    }
    if (interval === 'monthly') {
      return Number(todayYmd.slice(8, 10)) === 1;
    }
    return false;
  }

  private buildSentKey(
    interval: DataBackupEmailInterval,
    todayYmd: string,
    sendTime: string,
  ): string {
    const hm = String(sendTime || '').trim() || '09:00';
    if (interval === 'daily') return `${todayYmd}-daily-${hm}`;
    if (interval === 'weekly') {
      const { weekStartYmd } = getAppWeekBoundsYmd(todayYmd, APP_TIMEZONE);
      return `${weekStartYmd}-weekly-${hm}`;
    }
    return `${todayYmd.slice(0, 7)}-monthly-${hm}`;
  }

  private formatHmInTimeZone(date: Date, timeZone: string): string {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(date)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    ) as Record<string, string>;
    // Some Node/ICU builds may omit leading zeros even with hour: '2-digit'.
    const hour = String(parts.hour ?? '').padStart(2, '0');
    const minute = String(parts.minute ?? '').padStart(2, '0');
    return `${hour}:${minute}`;
  }
}
