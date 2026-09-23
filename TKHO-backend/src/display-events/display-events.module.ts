import { Module } from '@nestjs/common';
import { DisplayEventsController } from './display-events.controller';
import { DisplayEventsService } from './display-events.service';

@Module({
  controllers: [DisplayEventsController],
  providers: [DisplayEventsService],
  exports: [DisplayEventsService],
})
export class DisplayEventsModule {}
