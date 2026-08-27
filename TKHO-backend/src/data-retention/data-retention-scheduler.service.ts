import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { APP_TIMEZONE, formatYmdInTimeZone } from '../common/app-timezone';
import { DataRetentionMailService } from './data-retention-mail.service';
import { DataRetentionService } from './data-retention.service';
import { DataRetentionPurgeSummary } from './data-retention.types';

@Injectable()
export class DataRetentionSchedulerService {
  private readonly logger = new Logger(DataRetentionSchedulerService.name);
  private runInProgress = false;
  /** Prevent duplicate runs within the same HKT calendar month (e.g. process restart). */
  private lastRunMonthKey: string | null = null;

  constructor(
    private readonly retentionService: DataRetentionService,
    private readonly mailService: DataRetentionMailService,
  ) {}

  /** 每月 1 日 03:00（HKT）清理超龄数据 */
  @Cron('0 3 1 * *', { timeZone: APP_TIMEZONE })
  async handleMonthlyPurgeCron() {
    await this.runScheduledPurge();
  }

  private async runScheduledPurge() {
    if (this.runInProgress) {
      this.logger.warn('Data retention purge skipped: already in progress');
      return;
    }

    const monthKey = formatYmdInTimeZone(new Date(), APP_TIMEZONE).slice(0, 7);
    if (this.lastRunMonthKey === monthKey) {
      this.logger.log(
        `Data retention purge skipped: already ran for ${monthKey} HKT`,
      );
      return;
    }

    this.runInProgress = true;
    let summary: DataRetentionPurgeSummary | null = null;
    try {
      summary = await this.retentionService.runMonthlyPurge();
      if (summary.ok) {
        this.lastRunMonthKey = monthKey;
      }
    } catch (err) {
      summary = {
        retentionMonths: 0,
        cutoffIso: '',
        venueBookingsDeleted: 0,
        evBookingsDeletedByAge: 0,
        evBookingsDeletedForUserPlates: 0,
        licensePlatesDeleted: 0,
        usersDeleted: 0,
        startedAtIso: new Date().toISOString(),
        finishedAtIso: new Date().toISOString(),
        ok: false,
        errorMessage:
          err instanceof Error ? err.message : String(err ?? 'unknown error'),
      };
    } finally {
      this.runInProgress = false;
    }

    if (summary) {
      try {
        await this.mailService.sendPurgeReport(summary);
      } catch (mailErr) {
        this.logger.error(
          'Failed to send data retention ops email',
          mailErr instanceof Error ? mailErr.stack : mailErr,
        );
      }
    }
  }
}
