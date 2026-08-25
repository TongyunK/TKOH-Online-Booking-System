import { Module } from '@nestjs/common';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { DataBackupController } from './data-backup.controller';
import { DataBackupMailService } from './data-backup-mail.service';
import { DataBackupReportService } from './data-backup-report.service';
import { DataBackupSchedulerService } from './data-backup-scheduler.service';

@Module({
  imports: [SystemSettingsModule],
  controllers: [DataBackupController],
  providers: [
    DataBackupReportService,
    DataBackupMailService,
    DataBackupSchedulerService,
  ],
  exports: [DataBackupSchedulerService],
})
export class DataBackupModule {}
