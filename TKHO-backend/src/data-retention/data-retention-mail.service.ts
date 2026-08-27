import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { APP_TIMEZONE } from '../common/app-timezone';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { DataRetentionPurgeSummary } from './data-retention.types';

@Injectable()
export class DataRetentionMailService {
  private readonly logger = new Logger(DataRetentionMailService.name);

  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  private resolveSmtpPort(): number {
    const raw = Number.parseInt(
      String(process.env.DATA_BACKUP_SMTP_PORT ?? '465').trim(),
      10,
    );
    return Number.isFinite(raw) && raw > 0 ? raw : 465;
  }

  async sendPurgeReport(summary: DataRetentionPurgeSummary): Promise<void> {
    const to = await this.systemSettingsService.getDataRetentionOpsEmail();
    if (!to) {
      this.logger.warn(
        'Data retention ops email is not configured; skip purge notification.',
      );
      return;
    }

    const from = await this.systemSettingsService.getDataBackupSendingEmail();
    const host =
      await this.systemSettingsService.getDataBackupSendingEmailHost();
    const pass =
      await this.systemSettingsService.getDataBackupSendingEmailPassword();

    if (!from || !host || !pass) {
      throw new Error(
        'Data retention notification SMTP credentials are incomplete (reuse data backup sender settings).',
      );
    }

    const port = this.resolveSmtpPort();
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      tls: { rejectUnauthorized: false },
      auth: { user: from, pass },
    });

    const status = summary.ok ? 'SUCCESS' : 'FAILED';
    const subject = `TKOH Data Retention Purge ${status} — ${summary.cutoffIso.slice(0, 10)}`;
    const text = [
      `TKOH Online Booking System — monthly data retention purge (${status})`,
      '',
      `Timezone: ${APP_TIMEZONE}`,
      `Retention months: ${summary.retentionMonths}`,
      `Cutoff (created_at / inactive_time): ${summary.cutoffIso}`,
      `Started: ${summary.startedAtIso}`,
      `Finished: ${summary.finishedAtIso}`,
      '',
      `Venue bookings deleted (by created_at): ${summary.venueBookingsDeleted}`,
      `EV bookings deleted (by created_at): ${summary.evBookingsDeletedByAge}`,
      `EV bookings deleted (plates of purged users): ${summary.evBookingsDeletedForUserPlates}`,
      `License plates deleted: ${summary.licensePlatesDeleted}`,
      `Inactive users deleted: ${summary.usersDeleted}`,
      '',
      summary.ok
        ? 'Active users are never deleted by this job.'
        : `Error: ${summary.errorMessage || 'unknown'}`,
    ].join('\n');

    await transporter.sendMail({ from, to, subject, text });
    this.logger.log(`Data retention purge report emailed to ${to} (${status})`);
  }
}
