import { Module } from '@nestjs/common';
import { DisplayEventsModule } from '../display-events/display-events.module';
import { DisplayManagementController } from './display-management.controller';
import { DisplayManagementService } from './display-management.service';

@Module({
  imports: [DisplayEventsModule],
  controllers: [DisplayManagementController],
  providers: [DisplayManagementService],
  exports: [DisplayManagementService],
})
export class DisplayManagementModule {}
