import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { APP_TIMEZONE, getAppCalendarYear } from '../common/app-timezone';
import { PrismaService } from '../prisma/prisma.service';

/** 持久化于 display_config_settings，记录最近一次配额年切换检查的自然年 */
export const QUOTA_LAST_RESET_YEAR_KEY = 'system.quota_last_reset_year';

type QuotaResetTrigger = 'startup' | 'cron';

/**
 * 额度已用改为按 booking_date 自然年实时 COUNT 后，不再清零 user.used_quota_*。
 * 本服务仅记录自然年切换，便于运维观察；默认额度与按年覆盖表不受影响。
 */
@Injectable()
export class QuotaResetService implements OnModuleInit {
  private readonly logger = new Logger(QuotaResetService.name);
  private resetInProgress = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureAnnualQuotaReset('startup');
  }

  /** 每年 1 月 1 日 00:00（APP_TIMEZONE，默认香港） */
  @Cron('0 0 1 1 *', { timeZone: APP_TIMEZONE })
  async handleAnnualQuotaResetCron() {
    await this.ensureAnnualQuotaReset('cron');
  }

  private async ensureAnnualQuotaReset(trigger: QuotaResetTrigger) {
    if (this.resetInProgress) return;

    this.resetInProgress = true;
    try {
      const currentYear = getAppCalendarYear();
      const outcome = await this.prisma.$transaction(async (tx) => {
        const lastResetYear = await this.readLastResetYear(tx);
        if (currentYear <= lastResetYear) {
          return { skipped: true as const, lastResetYear };
        }

        await tx.display_config_settings.upsert({
          where: { config_key: QUOTA_LAST_RESET_YEAR_KEY },
          create: {
            config_key: QUOTA_LAST_RESET_YEAR_KEY,
            config_value: String(currentYear),
            updated_at: new Date(),
          },
          update: {
            config_value: String(currentYear),
            updated_at: new Date(),
          },
        });

        return { skipped: false as const, lastResetYear };
      });

      if (outcome.skipped) {
        this.logger.log(
          `Annual quota year marker skipped (${trigger}): already at ${outcome.lastResetYear}`,
        );
        return;
      }

      this.logger.log(
        `Annual quota year marker updated (${trigger}): year=${currentYear} (used counts are derived from bookings)`,
      );
    } catch (err) {
      this.logger.error(`Annual quota year marker failed (${trigger})`, err);
    } finally {
      this.resetInProgress = false;
    }
  }

  private async readLastResetYear(
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const row = await tx.display_config_settings.findUnique({
      where: { config_key: QUOTA_LAST_RESET_YEAR_KEY },
    });
    const parsed = Number.parseInt(String(row?.config_value ?? ''), 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;

    return getAppCalendarYear() - 1;
  }
}
