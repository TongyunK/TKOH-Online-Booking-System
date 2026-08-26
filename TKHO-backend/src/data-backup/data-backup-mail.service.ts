import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { APP_TIMEZONE } from '../common/app-timezone';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import {
  DataBackupDateRange,
  DataBackupWorkbookResult,
} from './data-backup-report.service';

@Injectable()
export class DataBackupMailService {
  private readonly logger = new Logger(DataBackupMailService.name);

  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  private resolveSmtpPort(): number {
    // WiseSystem mail uses SSL on 465 (same as existing ERP nodemailer scripts).
    const raw = Number.parseInt(
      String(process.env.DATA_BACKUP_SMTP_PORT ?? '465').trim(),
      10,
    );
    return Number.isFinite(raw) && raw > 0 ? raw : 465;
  }

  async sendBackupEmail(
    workbook: DataBackupWorkbookResult,
    range: DataBackupDateRange,
    receivingEmail: string,
  ): Promise<void> {
    const to = String(receivingEmail ?? '').trim();
    if (!to) {
      throw new Error('Data backup receiving email is not configured.');
    }

    const from = await this.systemSettingsService.getDataBackupSendingEmail();
    const host = await this.systemSettingsService.getDataBackupSendingEmailHost();
    const pass =
      await this.systemSettingsService.getDataBackupSendingEmailPassword();

    if (!from || !host || !pass) {
      throw new Error(
        'Data backup SMTP credentials are incomplete (sender email, host, or password).',
      );
    }

    const port = this.resolveSmtpPort();
    const secure = port === 465;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      tls: {
        // Match existing Wise ERP mail scripts; mail server may use a non-public CA.
        rejectUnauthorized: false,
      },
      auth: { user: from, pass },
    });

    const subject = `TKOH GA Service Center System Data Backup — ${range.startYmd} to ${range.endYmd}`;
    const text = [
      'Scheduled TKOH Online Booking System data backup.',
      '',
      `Timezone: ${APP_TIMEZONE}`,
      `Booking date range: ${range.startYmd} to ${range.endYmd} (${range.timeSpanDays} day(s))`,
      '',
      'Workbook sheets:',
      `- Venue Bookings: ${workbook.summary.venueBookings}`,
      `- EV Bookings: ${workbook.summary.evBookings}`,
      `- Users: ${workbook.summary.users}`,
      `- Pending Users: ${workbook.summary.pendingUsers}`,
      `- Venues: ${workbook.summary.venues}`,
      `- Venue Blocks: ${workbook.summary.venueBlocks}`,
      `- License Plates: ${workbook.summary.licensePlates}`,
      `- EV Parking Slots: ${workbook.summary.evParkingSlots}`,
      `- EV Time Periods: ${workbook.summary.evTimePeriods}`,
      `- Departments: ${workbook.summary.departments}`,
      `- Access Roles: ${workbook.summary.accessRoles}`,
      `- Booking Windows: ${workbook.summary.bookingWindows}`,
      `- Prompts: ${workbook.summary.prompts}`,
      `- System Settings: ${workbook.summary.systemSettings}`,
      `- Display Config Settings: ${workbook.summary.displayConfigSettings}`,
      '',
      'The Excel file is attached.',
    ].join('\n');

    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      attachments: [
        {
          filename: workbook.fileName,
          content: workbook.buffer,
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    });

    this.logger.log(`Data backup email sent to ${to} (${workbook.fileName})`);
  }
}
