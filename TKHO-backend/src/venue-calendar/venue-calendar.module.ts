import { Module } from '@nestjs/common';
import { DisplayEventsModule } from '../display-events/display-events.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { VenueCalendarController } from './venue-calendar.controller';
import { VenueCalendarService } from './venue-calendar.service';

@Module({
  imports: [SystemSettingsModule, DisplayEventsModule],
  controllers: [VenueCalendarController],
  providers: [VenueCalendarService],
})
export class VenueCalendarModule {}
