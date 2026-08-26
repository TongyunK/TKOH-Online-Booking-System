import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  decryptSettingSecret,
  encryptSettingSecret,
  isEncryptedSettingSecret,
} from '../common/settings-secret.crypto';
import { UpdateSystemSettingsDto } from './dto/update-system-settings.dto';
import {
  SYSTEM_SETTING_DEFAULTS,
  SYSTEM_SETTING_DESCRIPTIONS,
  SystemSettingKey,
  SystemSettingKeyName,
} from './system-setting.keys';

const DEFAULT_INACTIVE_AFTER_MONTHS = 6;

type SettingsMap = Map<string, string>;

@Injectable()
export class SystemSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveInactiveAfterMonthsFromEnv(): number {
    const raw = Number.parseInt(
      String(process.env.USER_INACTIVE_AFTER_MONTHS ?? '').trim(),
      10,
    );
    if (Number.isFinite(raw) && raw > 0) return raw;
    return DEFAULT_INACTIVE_AFTER_MONTHS;
  }

  private async loadSettingsMap(): Promise<SettingsMap> {
    const rows = await this.prisma.system_settings.findMany();
    return new Map(rows.map((r) => [r.setting_key, r.setting_value ?? '']));
  }

  private getSetting(map: SettingsMap, key: SystemSettingKeyName): string {
    const value = map.get(key);
    if (value !== undefined && value !== '') return value;
    return SYSTEM_SETTING_DEFAULTS[key] ?? '';
  }

  private async ensureDefaultSettings(): Promise<SettingsMap> {
    const map = await this.loadSettingsMap();
    const missing = (
      Object.keys(SYSTEM_SETTING_DEFAULTS) as SystemSettingKeyName[]
    ).filter((key) => !map.has(key));
    if (!missing.length) {
      await this.migratePlaintextEncryptedSettings(map);
      return map;
    }

    const now = new Date();
    await this.prisma.$transaction(
      missing.map((key) =>
        this.prisma.system_settings.upsert({
          where: { setting_key: key },
          create: {
            setting_key: key,
            setting_value: SYSTEM_SETTING_DEFAULTS[key],
            description: SYSTEM_SETTING_DESCRIPTIONS[key],
            updated_at: now,
          },
          update: {},
        }),
      ),
    );
    const refreshed = await this.loadSettingsMap();
    await this.migratePlaintextEncryptedSettings(refreshed);
    return refreshed;
  }

  private parseInactiveAfterMonths(raw: string): number | null {
    const months = Number.parseInt(String(raw ?? '').trim(), 10);
    if (Number.isFinite(months) && months > 0) return months;
    return null;
  }

  private parseEvDateUpdateTime(raw: string): string | null {
    const value = String(raw ?? '').trim();
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return value;
    return null;
  }

  private parseEvWeeklyBookingLimit(raw: string): number | null {
    const value = Number.parseInt(String(raw ?? '').trim(), 10);
    if (Number.isFinite(value) && value >= 1 && value <= 7) return value;
    return null;
  }

  private parseVenueBookingMinGapMinutes(raw: string): number | null {
    const value = Number.parseInt(String(raw ?? '').trim(), 10);
    if (Number.isFinite(value) && value >= 0 && value <= 120) return value;
    return null;
  }

  private parseVenueMeetingEventTitleMaxLength(raw: string): number | null {
    const value = Number.parseInt(String(raw ?? '').trim(), 10);
    if (Number.isFinite(value) && value >= 1 && value <= 500) return value;
    return null;
  }

  private parseDataBackupTimeSpan(raw: string): number | null {
    const value = Number.parseInt(String(raw ?? '').trim(), 10);
    if (Number.isFinite(value) && value >= 1 && value <= 365) return value;
    return null;
  }

  private parseDataBackupEmailInterval(raw: string): string | null {
    const value = String(raw ?? '').trim().toLowerCase();
    if (value === 'daily' || value === 'weekly' || value === 'monthly') {
      return value;
    }
    return null;
  }

  private parseDataBackupEmailSendTime(raw: string): string | null {
    const value = String(raw ?? '').trim();
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return value;
    return null;
  }

  private resolveHiddenSettingFromEnv(
    key: SystemSettingKeyName,
    envKey: string,
  ): string {
    const fromEnv = String(process.env[envKey] ?? '').trim();
    if (fromEnv) return fromEnv;
    return SYSTEM_SETTING_DEFAULTS[key] ?? '';
  }

  private async upsertEncryptedSetting(
    key: SystemSettingKeyName,
    plaintext: string,
  ): Promise<void> {
    const value = String(plaintext ?? '').trim();
    if (!value) return;
    const encrypted = encryptSettingSecret(value);
    const now = new Date();
    await this.prisma.system_settings.upsert({
      where: { setting_key: key },
      create: {
        setting_key: key,
        setting_value: encrypted,
        description: SYSTEM_SETTING_DESCRIPTIONS[key],
        updated_at: now,
      },
      update: {
        setting_value: encrypted,
        updated_at: now,
      },
    });
  }

  private async migratePlaintextEncryptedSettings(
    map: SettingsMap,
  ): Promise<void> {
    const passwordKey = SystemSettingKey.dataBackupSendingEmailPassword;
    const storedPassword = String(map.get(passwordKey) ?? '').trim();
    if (storedPassword && !isEncryptedSettingSecret(storedPassword)) {
      await this.upsertEncryptedSetting(passwordKey, storedPassword);
      map.set(passwordKey, encryptSettingSecret(storedPassword));
    }
  }

  private decryptStoredSettingSecret(stored: string): string {
    const value = String(stored ?? '').trim();
    if (!value) return '';
    if (!isEncryptedSettingSecret(value)) return value;
    try {
      return decryptSettingSecret(value);
    } catch {
      throw new Error(
        'Failed to decrypt data backup sending email password. Verify SETTINGS_ENCRYPTION_KEY or JWT_SECRET matches the value used when the secret was encrypted.',
      );
    }
  }

  async getDataBackupSendingEmail(): Promise<string> {
    const map = await this.ensureDefaultSettings();
    const fromDb = String(
      map.get(SystemSettingKey.dataBackupSendingEmail) ?? '',
    ).trim();
    if (fromDb) return fromDb;
    return this.resolveHiddenSettingFromEnv(
      SystemSettingKey.dataBackupSendingEmail,
      'DATA_BACKUP_SENDING_EMAIL',
    );
  }

  async getDataBackupSendingEmailHost(): Promise<string> {
    const map = await this.ensureDefaultSettings();
    const fromDb = String(
      map.get(SystemSettingKey.dataBackupSendingEmailHost) ?? '',
    ).trim();
    if (fromDb) return fromDb;
    return this.resolveHiddenSettingFromEnv(
      SystemSettingKey.dataBackupSendingEmailHost,
      'DATA_BACKUP_SENDING_EMAIL_HOST',
    );
  }

  async getDataBackupSendingEmailPassword(): Promise<string> {
    const map = await this.ensureDefaultSettings();
    const fromDb = String(
      map.get(SystemSettingKey.dataBackupSendingEmailPassword) ?? '',
    ).trim();
    if (fromDb) {
      try {
        return this.decryptStoredSettingSecret(fromDb);
      } catch (err) {
        const fromEnv = this.resolveHiddenSettingFromEnv(
          SystemSettingKey.dataBackupSendingEmailPassword,
          'DATA_BACKUP_SENDING_EMAIL_PASSWORD',
        );
        if (fromEnv) return fromEnv;
        throw err;
      }
    }
    return this.resolveHiddenSettingFromEnv(
      SystemSettingKey.dataBackupSendingEmailPassword,
      'DATA_BACKUP_SENDING_EMAIL_PASSWORD',
    );
  }

  async getEvDateUpdateTime(): Promise<string> {
    const map = await this.ensureDefaultSettings();
    return (
      this.parseEvDateUpdateTime(
        this.getSetting(map, SystemSettingKey.evDateUpdateTime),
      ) ?? SYSTEM_SETTING_DEFAULTS[SystemSettingKey.evDateUpdateTime]
    );
  }

  async getEvWeeklyBookingLimit(): Promise<number> {
    const map = await this.ensureDefaultSettings();
    return (
      this.parseEvWeeklyBookingLimit(
        this.getSetting(map, SystemSettingKey.evWeeklyBookingLimit),
      ) ?? Number.parseInt(SYSTEM_SETTING_DEFAULTS[SystemSettingKey.evWeeklyBookingLimit], 10)
    );
  }

  async getVenueBookingMinGapMinutes(): Promise<number> {
    const map = await this.ensureDefaultSettings();
    return (
      this.parseVenueBookingMinGapMinutes(
        this.getSetting(map, SystemSettingKey.venueBookingMinGapMinutes),
      ) ??
      Number.parseInt(
        SYSTEM_SETTING_DEFAULTS[SystemSettingKey.venueBookingMinGapMinutes],
        10,
      )
    );
  }

  async getVenueMeetingEventTitleMaxLength(): Promise<number> {
    const map = await this.ensureDefaultSettings();
    return (
      this.parseVenueMeetingEventTitleMaxLength(
        this.getSetting(map, SystemSettingKey.venueMeetingEventTitleMaxLength),
      ) ??
      Number.parseInt(
        SYSTEM_SETTING_DEFAULTS[
          SystemSettingKey.venueMeetingEventTitleMaxLength
        ],
        10,
      )
    );
  }

  async assertMeetingEventTitleLength(
    title: string | null | undefined,
  ): Promise<void> {
    const value = String(title ?? '').trim();
    if (!value) return;
    const maxLength = await this.getVenueMeetingEventTitleMaxLength();
    if (value.length > maxLength) {
      throw new BadRequestException(
        `Meeting / Event Title must be at most ${maxLength} characters`,
      );
    }
  }

  async getUserInactiveAfterMonths(): Promise<number> {
    const map = await this.ensureDefaultSettings();
    const fromDb = this.parseInactiveAfterMonths(
      this.getSetting(map, SystemSettingKey.userInactiveAfterMonths),
    );
    if (fromDb != null) return fromDb;
    return this.resolveInactiveAfterMonthsFromEnv();
  }

  async getHkPublicHolidaysUrl(): Promise<string> {
    const map = await this.ensureDefaultSettings();
    return this.getSetting(map, SystemSettingKey.hkPublicHolidaysUrl);
  }

  async getSettings() {
    const map = await this.ensureDefaultSettings();
    const userInactiveAfterMonths =
      this.parseInactiveAfterMonths(
        this.getSetting(map, SystemSettingKey.userInactiveAfterMonths),
      ) ?? this.resolveInactiveAfterMonthsFromEnv();
    const hkPublicHolidaysUrl = this.getSetting(
      map,
      SystemSettingKey.hkPublicHolidaysUrl,
    );
    const evDateUpdateTime =
      this.parseEvDateUpdateTime(
        this.getSetting(map, SystemSettingKey.evDateUpdateTime),
      ) ?? SYSTEM_SETTING_DEFAULTS[SystemSettingKey.evDateUpdateTime];
    const evWeeklyBookingLimit =
      this.parseEvWeeklyBookingLimit(
        this.getSetting(map, SystemSettingKey.evWeeklyBookingLimit),
      ) ??
      Number.parseInt(SYSTEM_SETTING_DEFAULTS[SystemSettingKey.evWeeklyBookingLimit], 10);
    const venueBookingMinGapMinutes =
      this.parseVenueBookingMinGapMinutes(
        this.getSetting(map, SystemSettingKey.venueBookingMinGapMinutes),
      ) ??
      Number.parseInt(
        SYSTEM_SETTING_DEFAULTS[SystemSettingKey.venueBookingMinGapMinutes],
        10,
      );
    const venueMeetingEventTitleMaxLength =
      this.parseVenueMeetingEventTitleMaxLength(
        this.getSetting(
          map,
          SystemSettingKey.venueMeetingEventTitleMaxLength,
        ),
      ) ??
      Number.parseInt(
        SYSTEM_SETTING_DEFAULTS[
          SystemSettingKey.venueMeetingEventTitleMaxLength
        ],
        10,
      );
    const dataBackupReceivingEmail = String(
      this.getSetting(map, SystemSettingKey.dataBackupReceivingEmail),
    ).trim();
    const dataBackupTimeSpan =
      this.parseDataBackupTimeSpan(
        this.getSetting(map, SystemSettingKey.dataBackupTimeSpan),
      ) ??
      Number.parseInt(
        SYSTEM_SETTING_DEFAULTS[SystemSettingKey.dataBackupTimeSpan],
        10,
      );
    const dataBackupEmailInterval =
      this.parseDataBackupEmailInterval(
        this.getSetting(map, SystemSettingKey.dataBackupEmailInterval),
      ) ?? SYSTEM_SETTING_DEFAULTS[SystemSettingKey.dataBackupEmailInterval];
    const dataBackupEmailSendTime =
      this.parseDataBackupEmailSendTime(
        this.getSetting(map, SystemSettingKey.dataBackupEmailSendTime),
      ) ?? SYSTEM_SETTING_DEFAULTS[SystemSettingKey.dataBackupEmailSendTime];

    const allKeys = Object.values(SystemSettingKey);
    const rows = await this.prisma.system_settings.findMany({
      where: {
        setting_key: {
          in: allKeys,
        },
      },
      select: { updated_at: true },
      orderBy: { updated_at: 'desc' },
    });
    const latestUpdatedAt = rows[0]?.updated_at?.toISOString() ?? null;

    return {
      userInactiveAfterMonths,
      hkPublicHolidaysUrl,
      evDateUpdateTime,
      evWeeklyBookingLimit,
      venueBookingMinGapMinutes,
      venueMeetingEventTitleMaxLength,
      dataBackupReceivingEmail,
      dataBackupTimeSpan,
      dataBackupEmailInterval,
      dataBackupEmailSendTime,
      updatedAt: latestUpdatedAt,
    };
  }

  async saveSettings(dto: UpdateSystemSettingsDto) {
    const now = new Date();
    if (dto.userInactiveAfterMonths != null) {
      await this.prisma.system_settings.upsert({
        where: { setting_key: SystemSettingKey.userInactiveAfterMonths },
        create: {
          setting_key: SystemSettingKey.userInactiveAfterMonths,
          setting_value: String(dto.userInactiveAfterMonths),
          description:
            SYSTEM_SETTING_DESCRIPTIONS[
              SystemSettingKey.userInactiveAfterMonths
            ],
          updated_at: now,
        },
        update: {
          setting_value: String(dto.userInactiveAfterMonths),
          updated_at: now,
        },
      });
    }

    if (dto.hkPublicHolidaysUrl != null) {
      const url = String(dto.hkPublicHolidaysUrl).trim();
      await this.prisma.system_settings.upsert({
        where: { setting_key: SystemSettingKey.hkPublicHolidaysUrl },
        create: {
          setting_key: SystemSettingKey.hkPublicHolidaysUrl,
          setting_value: url,
          description:
            SYSTEM_SETTING_DESCRIPTIONS[SystemSettingKey.hkPublicHolidaysUrl],
          updated_at: now,
        },
        update: {
          setting_value: url,
          updated_at: now,
        },
      });
    }

    if (dto.evDateUpdateTime != null) {
      const time = String(dto.evDateUpdateTime).trim();
      await this.prisma.system_settings.upsert({
        where: { setting_key: SystemSettingKey.evDateUpdateTime },
        create: {
          setting_key: SystemSettingKey.evDateUpdateTime,
          setting_value: time,
          description:
            SYSTEM_SETTING_DESCRIPTIONS[SystemSettingKey.evDateUpdateTime],
          updated_at: now,
        },
        update: {
          setting_value: time,
          updated_at: now,
        },
      });
    }

    if (dto.evWeeklyBookingLimit != null) {
      const limit = String(dto.evWeeklyBookingLimit);
      await this.prisma.system_settings.upsert({
        where: { setting_key: SystemSettingKey.evWeeklyBookingLimit },
        create: {
          setting_key: SystemSettingKey.evWeeklyBookingLimit,
          setting_value: limit,
          description:
            SYSTEM_SETTING_DESCRIPTIONS[SystemSettingKey.evWeeklyBookingLimit],
          updated_at: now,
        },
        update: {
          setting_value: limit,
          updated_at: now,
        },
      });
    }

    if (dto.venueBookingMinGapMinutes != null) {
      const gap = String(dto.venueBookingMinGapMinutes);
      await this.prisma.system_settings.upsert({
        where: { setting_key: SystemSettingKey.venueBookingMinGapMinutes },
        create: {
          setting_key: SystemSettingKey.venueBookingMinGapMinutes,
          setting_value: gap,
          description:
            SYSTEM_SETTING_DESCRIPTIONS[
              SystemSettingKey.venueBookingMinGapMinutes
            ],
          updated_at: now,
        },
        update: {
          setting_value: gap,
          updated_at: now,
        },
      });
    }

    if (dto.venueMeetingEventTitleMaxLength != null) {
      const maxLength = String(dto.venueMeetingEventTitleMaxLength);
      await this.prisma.system_settings.upsert({
        where: {
          setting_key: SystemSettingKey.venueMeetingEventTitleMaxLength,
        },
        create: {
          setting_key: SystemSettingKey.venueMeetingEventTitleMaxLength,
          setting_value: maxLength,
          description:
            SYSTEM_SETTING_DESCRIPTIONS[
              SystemSettingKey.venueMeetingEventTitleMaxLength
            ],
          updated_at: now,
        },
        update: {
          setting_value: maxLength,
          updated_at: now,
        },
      });
    }

    if (dto.dataBackupReceivingEmail != null) {
      const email = String(dto.dataBackupReceivingEmail).trim();
      await this.prisma.system_settings.upsert({
        where: { setting_key: SystemSettingKey.dataBackupReceivingEmail },
        create: {
          setting_key: SystemSettingKey.dataBackupReceivingEmail,
          setting_value: email,
          description:
            SYSTEM_SETTING_DESCRIPTIONS[
              SystemSettingKey.dataBackupReceivingEmail
            ],
          updated_at: now,
        },
        update: {
          setting_value: email,
          updated_at: now,
        },
      });
    }

    if (dto.dataBackupTimeSpan != null) {
      const span = String(dto.dataBackupTimeSpan);
      await this.prisma.system_settings.upsert({
        where: { setting_key: SystemSettingKey.dataBackupTimeSpan },
        create: {
          setting_key: SystemSettingKey.dataBackupTimeSpan,
          setting_value: span,
          description:
            SYSTEM_SETTING_DESCRIPTIONS[SystemSettingKey.dataBackupTimeSpan],
          updated_at: now,
        },
        update: {
          setting_value: span,
          updated_at: now,
        },
      });
    }

    if (dto.dataBackupEmailInterval != null) {
      const interval = String(dto.dataBackupEmailInterval).trim().toLowerCase();
      await this.prisma.system_settings.upsert({
        where: { setting_key: SystemSettingKey.dataBackupEmailInterval },
        create: {
          setting_key: SystemSettingKey.dataBackupEmailInterval,
          setting_value: interval,
          description:
            SYSTEM_SETTING_DESCRIPTIONS[
              SystemSettingKey.dataBackupEmailInterval
            ],
          updated_at: now,
        },
        update: {
          setting_value: interval,
          updated_at: now,
        },
      });
    }

    if (dto.dataBackupEmailSendTime != null) {
      const sendTime = String(dto.dataBackupEmailSendTime).trim();
      await this.prisma.system_settings.upsert({
        where: { setting_key: SystemSettingKey.dataBackupEmailSendTime },
        create: {
          setting_key: SystemSettingKey.dataBackupEmailSendTime,
          setting_value: sendTime,
          description:
            SYSTEM_SETTING_DESCRIPTIONS[
              SystemSettingKey.dataBackupEmailSendTime
            ],
          updated_at: now,
        },
        update: {
          setting_value: sendTime,
          updated_at: now,
        },
      });
    }

    return this.getSettings();
  }
}
