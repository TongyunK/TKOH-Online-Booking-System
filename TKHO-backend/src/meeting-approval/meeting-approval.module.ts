import { Module } from '@nestjs/common';
import { DisplayEventsModule } from '../display-events/display-events.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { MeetingApprovalController } from './meeting-approval.controller';
import { MeetingApprovalService } from './meeting-approval.service';

@Module({
  imports: [SystemSettingsModule, DisplayEventsModule],
  controllers: [MeetingApprovalController],
  providers: [MeetingApprovalService],
  exports: [MeetingApprovalService],
})
export class MeetingApprovalModule {}
