import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { DataBackupSchedulerService } from './data-backup-scheduler.service';

@ApiTags('data-backup')
@ApiBearerAuth()
@UseGuards(AdminRoleGuard)
@Controller('api/data-backup')
export class DataBackupController {
  constructor(
    private readonly schedulerService: DataBackupSchedulerService,
  ) {}

  @Post('send-now')
  sendBackupNow() {
    return this.schedulerService.runBackupNow();
  }
}
