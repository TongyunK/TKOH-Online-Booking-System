import { Module } from '@nestjs/common';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { DataRetentionMailService } from './data-retention-mail.service';
import { DataRetentionSchedulerService } from './data-retention-scheduler.service';
import { DataRetentionService } from './data-retention.service';

@Module({
  imports: [SystemSettingsModule],
  providers: [
    DataRetentionService,
    DataRetentionMailService,
    DataRetentionSchedulerService,
  ],
})
export class DataRetentionModule {}
