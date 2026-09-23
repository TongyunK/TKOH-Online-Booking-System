import { Module } from '@nestjs/common';
import { DisplayEventsModule } from '../display-events/display-events.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { EvBookingRateLimitGuard } from './guards/ev-booking-rate-limit.guard';
import { ParkingController } from './parking.controller';
import { ParkingService } from './parking.service';

@Module({
  imports: [SystemSettingsModule, DisplayEventsModule],
  controllers: [ParkingController],
  providers: [ParkingService, EvBookingRateLimitGuard],
})
export class ParkingModule {}
