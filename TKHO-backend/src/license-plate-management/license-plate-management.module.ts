import { Module } from '@nestjs/common';
import { DisplayEventsModule } from '../display-events/display-events.module';
import { LicensePlateManagementController } from './license-plate-management.controller';
import { LicensePlateManagementService } from './license-plate-management.service';

@Module({
  imports: [DisplayEventsModule],
  controllers: [LicensePlateManagementController],
  providers: [LicensePlateManagementService],
})
export class LicensePlateManagementModule {}
