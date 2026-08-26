import { BadRequestException, Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  DISPLAY_CONFIG_DEFAULTS,
  DisplayConfigKey,
  DisplayConfigKeyName,
} from './display-config.keys';
import { UpdateDisplayConfigDto } from './dto/update-display-config.dto';
import { VenueDisplayRuleDto } from './dto/venue-display-rule.dto';

const venueRuleSelect = {
  venue_id: true,
  display_name: true,
  arrow_direction: true,
} as const;

type SettingsMap = Map<string, string>;

@Injectable()
export class DisplayManagementService {
  private readonly uploadsBasePath = '/api/uploads/display/';

  constructor(private readonly prisma: PrismaService) {}

  private async unlinkDisplayUploadFile(imagePath: string | null | undefined) {
    const path = imagePath || '';
    if (!path.startsWith(this.uploadsBasePath)) return;
    const filename = path.replace(this.uploadsBasePath, '');
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return;
    }
    const abs = join(process.cwd(), 'uploads', 'display', filename);
    await fs.unlink(abs).catch(() => null);
  }

  private normalizeQrCodeValueForSave(raw?: string): string {
    const value = String(raw ?? '').trim();
    if (!value) return '';
    if (value.startsWith('data:')) {
      throw new BadRequestException(
        'Use POST /api/display-management/merge-qr-image to upload the QR image file',
      );
    }
    return value;
  }

  private async setSettingValue(key: DisplayConfigKeyName, value: string) {
    const now = new Date();
    await this.prisma.display_config_settings.upsert({
      where: { config_key: key },
      create: {
        config_key: key,
        config_value: value,
        updated_at: now,
      },
      update: {
        config_value: value,
        updated_at: now,
      },
    });
  }

  private async loadSettingsMap(): Promise<SettingsMap> {
    const rows = await this.prisma.display_config_settings.findMany();
    return new Map(rows.map((r) => [r.config_key, r.config_value ?? '']));
  }

  private getSetting(map: SettingsMap, key: DisplayConfigKeyName): string {
    const value = map.get(key);
    if (value !== undefined && value !== '') return value;
    return DISPLAY_CONFIG_DEFAULTS[key] ?? '';
  }

  /** Only persisted file paths; legacy base64 in KV is ignored. */
  private getMergeQrImagePath(map: SettingsMap): string {
    const raw = this.getSetting(map, DisplayConfigKey.mergeQrCodeImage);
    const value = String(raw ?? '').trim();
    if (!value || value.startsWith('data:')) return '';
    if (value.startsWith(this.uploadsBasePath)) return value;
    return '';
  }

  private async ensureDefaultSettings(): Promise<SettingsMap> {
    const map = await this.loadSettingsMap();
    const missing = (Object.keys(DISPLAY_CONFIG_DEFAULTS) as DisplayConfigKeyName[]).filter(
      (key) => !map.has(key),
    );
    if (!missing.length) return map;

    const now = new Date();
    await this.prisma.$transaction(
      missing.map((key) =>
        this.prisma.display_config_settings.upsert({
          where: { config_key: key },
          create: {
            config_key: key,
            config_value: DISPLAY_CONFIG_DEFAULTS[key],
            updated_at: now,
          },
          update: {},
        }),
      ),
    );
    return this.loadSettingsMap();
  }

  private normalizeVenueDisplayType(value: string | null | undefined): string {
    const x = String(value ?? '').trim().toLowerCase();
    return x === 'merge' ? 'merge' : 'single';
  }

  private computeVenueDisplayMode(
    venueRules: VenueDisplayRuleDto[],
  ): 'single' | 'merge' | 'mixed' {
    const editable = venueRules.filter((r) => r.venueId != null && r.venueId !== '');
    const hasSingle = editable.some((r) => r.displayType === 'single');
    const hasMerge = editable.some((r) => r.displayType === 'merge');
    if (hasSingle && hasMerge) return 'mixed';
    if (hasMerge) return 'merge';
    return 'single';
  }

  private buildVenueRulesResponse(
    evDisplayMode: string,
    venues: Array<{
      id: bigint;
      name: string;
      displayType: string | null;
      status: string | null;
    }>,
    rules: Array<{
      venue_id: bigint;
      display_name: string | null;
      arrow_direction: string | null;
    }>,
  ) {
    const ruleByVenueId = new Map(rules.map((r) => [r.venue_id.toString(), r]));

    const venueRules = venues.map((venue) => {
      const id = venue.id.toString();
      const rule = ruleByVenueId.get(id);
      return {
        venueId: id,
        venueName: venue.name,
        displayType: this.normalizeVenueDisplayType(venue.displayType),
        status: String(venue.status || 'active').toLowerCase() || 'active',
        displayName: rule?.display_name ?? '',
        arrowDirection: rule?.arrow_direction ?? '',
      };
    });

    venueRules.push({
      venueId: null,
      venueName: 'EV',
      displayType: this.normalizeVenueDisplayType(evDisplayMode),
      status: 'active',
      displayName: 'EV',
      arrowDirection: '',
    });

    return venueRules;
  }

  private mapConfigResponse(
    settings: SettingsMap,
    venueRules: Array<{
      venueId: string | null;
      venueName: string;
      displayType: string;
      status: string;
      displayName: string;
      arrowDirection: string;
    }>,
  ) {
    const updatedAtRaw = this.getSetting(settings, DisplayConfigKey.metaUpdatedAt);
    const updatedAt = updatedAtRaw ? new Date(updatedAtRaw) : null;

    return {
      venueDisplayMode: this.getSetting(settings, DisplayConfigKey.venueDisplayMode),
      evDisplayMode: this.getSetting(settings, DisplayConfigKey.evDisplayMode),
      mergeDisplaySettings: {
        panelTitleText: this.getSetting(settings, DisplayConfigKey.mergePanelTitleText),
        footerTickerText: this.getSetting(settings, DisplayConfigKey.mergeFooterTickerText),
        qrCodeImage: this.getMergeQrImagePath(settings),
      },
      evDisplaySettings: {
        footerTickerText: this.getSetting(settings, DisplayConfigKey.evFooterTickerText),
      },
      venueRules,
      updatedBy: this.getSetting(settings, DisplayConfigKey.metaUpdatedBy) || null,
      updatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null,
    };
  }

  async saveMergeQrImage(filename: string) {
    await this.ensureDefaultSettings();
    const map = await this.loadSettingsMap();
    const previous = this.getSetting(map, DisplayConfigKey.mergeQrCodeImage);
    const qrCodeImage = `${this.uploadsBasePath}${filename}`;
    await this.unlinkDisplayUploadFile(previous);
    await this.setSettingValue(DisplayConfigKey.mergeQrCodeImage, qrCodeImage);
    return { qrCodeImage };
  }

  async clearMergeQrImage(updatedBy: string) {
    await this.ensureDefaultSettings();
    const map = await this.loadSettingsMap();
    const previous = this.getSetting(map, DisplayConfigKey.mergeQrCodeImage);
    await this.unlinkDisplayUploadFile(previous);
    await this.setSettingValue(DisplayConfigKey.mergeQrCodeImage, '');
    await this.setSettingValue(DisplayConfigKey.metaUpdatedBy, updatedBy);
    await this.setSettingValue(
      DisplayConfigKey.metaUpdatedAt,
      new Date().toISOString(),
    );
    return { qrCodeImage: '' };
  }

  async getEvDisplayPublicSettings() {
    const settings = await this.ensureDefaultSettings();
    return {
      footerTickerText: this.getSetting(settings, DisplayConfigKey.evFooterTickerText),
    };
  }

  async getMergeDisplayPublicSettings() {
    const settings = await this.ensureDefaultSettings();
    return {
      panelTitleText: this.getSetting(settings, DisplayConfigKey.mergePanelTitleText),
      footerTickerText: this.getSetting(settings, DisplayConfigKey.mergeFooterTickerText),
      qrCodeImage: this.getMergeQrImagePath(settings),
    };
  }

  async getConfig() {
    const settings = await this.ensureDefaultSettings();
    const evDisplayMode = this.getSetting(settings, DisplayConfigKey.evDisplayMode);

    const [venues, rules] = await Promise.all([
      this.prisma.venues.findMany({
        orderBy: { id: 'asc' },
        select: { id: true, name: true, displayType: true, status: true },
      }),
      this.prisma.display_venue_rules.findMany({
        select: venueRuleSelect,
      }),
    ]);

    const venueRules = this.buildVenueRulesResponse(evDisplayMode, venues, rules);
    return this.mapConfigResponse(settings, venueRules);
  }

  async saveConfig(dto: UpdateDisplayConfigDto, updatedBy: string) {
    const venueRules = dto.venueRules ?? [];
    const evRule = venueRules.find(
      (r) => r.venueId == null || r.venueId === '',
    );
    const editableRules = venueRules.filter(
      (r) => r.venueId != null && r.venueId !== '',
    );

    const venueDisplayMode =
      dto.venueDisplayMode ?? this.computeVenueDisplayMode(venueRules);
    const evDisplayMode =
      evRule?.displayType ?? dto.evDisplayMode ?? 'single';

    const venueIds = editableRules.map((r) => {
      const raw = String(r.venueId).trim();
      if (!/^\d+$/.test(raw)) {
        throw new BadRequestException(`Invalid venue id: ${r.venueId}`);
      }
      return BigInt(raw);
    });

    const venues = venueIds.length
      ? await this.prisma.venues.findMany({
          where: { id: { in: venueIds } },
          select: { id: true },
        })
      : [];
    if (venues.length !== venueIds.length) {
      throw new BadRequestException('One or more venues not found');
    }

    const settingsBefore = await this.loadSettingsMap();
    const existingQrPath = this.getMergeQrImagePath(settingsBefore);
    const nextQrFromDto = this.normalizeQrCodeValueForSave(
      dto.mergeDisplaySettings?.qrCodeImage,
    );

    await this.prisma.$transaction(async (tx) => {
      for (const rule of editableRules) {
        const venueId = BigInt(String(rule.venueId).trim());
        const overlay = {
          display_name: rule.displayName?.trim() || null,
          arrow_direction: rule.arrowDirection?.trim() || null,
        };

        await tx.venues.update({
          where: { id: venueId },
          data: {
            displayType: this.normalizeVenueDisplayType(rule.displayType),
          },
        });

        await tx.display_venue_rules.upsert({
          where: { venue_id: venueId },
          create: {
            venue_id: venueId,
            ...overlay,
          },
          update: overlay,
        });
      }

      const now = new Date();
      const kvRows = [
        { key: DisplayConfigKey.venueDisplayMode, value: venueDisplayMode },
        { key: DisplayConfigKey.evDisplayMode, value: evDisplayMode },
        {
          key: DisplayConfigKey.mergePanelTitleText,
          value: dto.mergeDisplaySettings?.panelTitleText?.trim() ?? '',
        },
        {
          key: DisplayConfigKey.mergeFooterTickerText,
          value: dto.mergeDisplaySettings?.footerTickerText?.trim() ?? '',
        },
        {
          key: DisplayConfigKey.mergeQrCodeImage,
          value: nextQrFromDto || existingQrPath,
        },
        {
          key: DisplayConfigKey.evFooterTickerText,
          value: dto.evDisplaySettings?.footerTickerText?.trim() ?? '',
        },
        { key: DisplayConfigKey.metaUpdatedBy, value: updatedBy },
        { key: DisplayConfigKey.metaUpdatedAt, value: now.toISOString() },
      ];

      for (const { key, value } of kvRows) {
        await tx.display_config_settings.upsert({
          where: { config_key: key },
          create: {
            config_key: key,
            config_value: value,
            updated_at: now,
          },
          update: {
            config_value: value,
            updated_at: now,
          },
        });
      }
    });

    return this.getConfig();
  }
}
