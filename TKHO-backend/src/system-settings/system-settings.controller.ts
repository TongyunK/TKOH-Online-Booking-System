import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { UpdateSystemSettingsDto } from './dto/update-system-settings.dto';
import { HkPublicHolidaysService } from './hk-public-holidays.service';
import { SystemSettingsService } from './system-settings.service';

@ApiTags('system-settings')
@ApiBearerAuth()
@Controller('api/system-settings')
export class SystemSettingsController {
  constructor(
    private readonly systemSettingsService: SystemSettingsService,
    private readonly hkPublicHolidaysService: HkPublicHolidaysService,
  ) {}

  /** 任意已登录用户可读：会话空闲自动登出策略 */
  @Get('session-policy')
  async getSessionPolicy() {
    return {
      userAutoLogoutMinutes:
        await this.systemSettingsService.getUserAutoLogoutMinutes(),
    };
  }

  @Get()
  @UseGuards(AdminRoleGuard)
  async getSettings() {
    const settings = await this.systemSettingsService.getSettings();
    return {
      ...settings,
      hkPublicHolidaysSyncedAt:
        await this.hkPublicHolidaysService.getLatestSyncedAt(),
    };
  }

  @Put()
  @UseGuards(AdminRoleGuard)
  async saveSettings(@Body() dto: UpdateSystemSettingsDto) {
    const settings = await this.systemSettingsService.saveSettings(dto);
    if (dto.hkPublicHolidaysUrl != null) {
      await this.hkPublicHolidaysService.syncFromRemote('manual');
    }
    return {
      ...settings,
      hkPublicHolidaysSyncedAt:
        await this.hkPublicHolidaysService.getLatestSyncedAt(),
    };
  }

  @Post('sync-hk-holidays')
  @UseGuards(AdminRoleGuard)
  syncHkHolidays() {
    return this.hkPublicHolidaysService.syncFromRemote('manual');
  }
}
