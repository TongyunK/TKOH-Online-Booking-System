import { Module } from '@nestjs/common';
import { DisplayEventsModule } from '../display-events/display-events.module';
import { DisplayManagementModule } from '../display-management/display-management.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { VenueManagementController } from './venue-management.controller';
import { VenueManagementService } from './venue-management.service';

@Module({
  imports: [
    PrismaModule,
    DisplayManagementModule,
    DisplayEventsModule,
    SystemSettingsModule,
  ],
  controllers: [VenueManagementController],
  providers: [VenueManagementService],
})
export class VenueManagementModule {}

