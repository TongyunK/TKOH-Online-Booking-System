import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { APP_TIMEZONE } from '../common/app-timezone';
import { PrismaService } from '../prisma/prisma.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';

type InactivityTrigger = 'startup' | 'cron';

function cutoffBeforeMonths(months: number): Date {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return cutoff;
}

@Injectable()
export class UserInactivityService implements OnModuleInit {
  private readonly logger = new Logger(UserInactivityService.name);
  private runInProgress = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  async onModuleInit() {
    await this.deactivateStaleUsers('startup');
  }

  /** 每天 02:00（APP_TIMEZONE）检查长期未登录用户 */
  @Cron('0 2 * * *', { timeZone: APP_TIMEZONE })
  async handleInactivityCron() {
    await this.deactivateStaleUsers('cron');
  }

  private async deactivateStaleUsers(trigger: InactivityTrigger) {
    if (this.runInProgress) return;

    this.runInProgress = true;
    try {
      const months =
        await this.systemSettingsService.getUserInactiveAfterMonths();
      const cutoff = cutoffBeforeMonths(months);

      const result = await this.prisma.user.updateMany({
        where: {
          status: 'Active',
          isSystemHidden: false,
          AND: [
            {
              OR: [
                { lastLoginTime: { lt: cutoff } },
                {
                  lastLoginTime: null,
                  createdAt: { lt: cutoff },
                },
              ],
            },
            {
              OR: [
                { accessRoleId: null },
                {
                  access_roles: {
                    is: {
                      role_name: { not: 'SuperAdmin', mode: 'insensitive' },
                    },
                  },
                },
              ],
            },
          ],
        },
        data: {
          status: 'Inactive',
          inactiveTime: new Date(),
          inactivedBy: 'by System',
        },
      });

      if (result.count > 0) {
        this.logger.log(
          `User inactivity check (${trigger}): deactivated ${result.count} user(s), cutoff=${cutoff.toISOString()}, months=${months}`,
        );
      } else {
        this.logger.log(
          `User inactivity check (${trigger}): no users to deactivate (months=${months})`,
        );
      }
    } catch (err) {
      this.logger.error(`User inactivity check failed (${trigger})`, err);
    } finally {
      this.runInProgress = false;
    }
  }
}
