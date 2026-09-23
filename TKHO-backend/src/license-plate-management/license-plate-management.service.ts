import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DisplayEventsService } from '../display-events/display-events.service';
import { CreateLicensePlateDto } from './dto/create-license-plate.dto';
import { UpdateLicensePlateDto } from './dto/update-license-plate.dto';
import {
  formatUserDisplayName,
  userDisplayNameSelect,
} from '../common/user-display-name';

const plateSelect = {
  id: true,
  user_id: true,
  plate_number: true,
  is_default: true,
  status: true,
  created_at: true,
} satisfies Prisma.license_platesSelect;

type PlateRow = Prisma.license_platesGetPayload<{ select: typeof plateSelect }>;

type OwnerUser = {
  id: bigint;
  corpId: string;
  firstName: string;
  lastName: string;
  status?: string;
};

@Injectable()
export class LicensePlateManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly displayEvents: DisplayEventsService,
  ) {}

  private notifyEvDisplay(reason: string) {
    this.displayEvents.notify(['ev'], reason);
  }

  private normalizePlateNumber(raw: string): string {
    const cleaned = String(raw ?? '')
      .replace(/[^A-Za-z0-9]/g, '')
      .trim()
      .slice(0, 8);
    if (!cleaned) {
      throw new BadRequestException(
        'plateNumber can only contain letters and numbers (max 8)',
      );
    }
    return cleaned.toUpperCase();
  }

  private async nextLicensePlateId(): Promise<bigint> {
    const latest = await this.prisma.license_plates.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    return latest ? latest.id + BigInt(1) : BigInt(1);
  }

  private async resolveOwnerUser(corpId?: string, ownerName?: string) {
    const corp = corpId?.trim();
    if (corp) {
      const byCorp = await this.prisma.user.findFirst({
        where: { corpId: corp },
        select: { id: true, corpId: true, ...userDisplayNameSelect, status: true },
      });
      if (byCorp) return byCorp;
    }

    const name = ownerName?.trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      const where: Prisma.UserWhereInput =
        parts.length >= 2
          ? {
              firstName: parts[0],
              lastName: parts.slice(1).join(' '),
            }
          : {
              OR: [{ firstName: name }, { lastName: name }],
            };

      const candidates = await this.prisma.user.findMany({
        where,
        select: { id: true, corpId: true, ...userDisplayNameSelect, status: true },
        take: 20,
      });
      const matches = candidates.filter((u) => formatUserDisplayName(u) === name);
      if (matches.length === 1) return matches[0];
      if (matches.length > 1) {
        throw new BadRequestException(
          'Multiple users share this name; please select owner by CORP User ID',
        );
      }
    }

    throw new BadRequestException('Owner not found');
  }

  private async loadUsersByIds(ids: bigint[]) {
    if (!ids.length) return new Map<string, { corpId: string; name: string }>();
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, corpId: true, ...userDisplayNameSelect },
    });
    return new Map(
      users.map((u) => [
        u.id.toString(),
        { corpId: u.corpId, name: formatUserDisplayName(u) },
      ]),
    );
  }

  private mapPlate(
    row: PlateRow,
    user?: { corpId: string; name: string } | null,
  ) {
    return {
      id: row.id.toString(),
      userId: row.user_id != null ? row.user_id.toString() : null,
      corpId: user?.corpId ?? null,
      owner: user?.name ?? null,
      plateNumber: row.plate_number,
      status: row.status,
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at,
    };
  }

  private ownerDisplay(owner: OwnerUser) {
    return {
      corpId: owner.corpId,
      name: formatUserDisplayName(owner),
    };
  }

  async list() {
    const rows = await this.prisma.license_plates.findMany({
      orderBy: { id: 'asc' },
      select: plateSelect,
    });
    const userIds = [
      ...new Set(
        rows
          .map((r) => r.user_id)
          .filter((id): id is bigint => id != null),
      ),
    ];
    const userMap = await this.loadUsersByIds(userIds);
    return rows.map((row) =>
      this.mapPlate(
        row,
        row.user_id != null
          ? userMap.get(row.user_id.toString()) ?? null
          : null,
      ),
    );
  }

  async getOne(id: string) {
    const bid = BigInt(id);
    const row = await this.prisma.license_plates.findUnique({
      where: { id: bid },
      select: plateSelect,
    });
    if (!row) throw new NotFoundException('License plate not found');
    let user: { corpId: string; name: string } | null = null;
    if (row.user_id != null) {
      const map = await this.loadUsersByIds([row.user_id]);
      user = map.get(row.user_id.toString()) ?? null;
    }
    return this.mapPlate(row, user);
  }

  async create(dto: CreateLicensePlateDto) {
    const plateNumber = this.normalizePlateNumber(dto.plateNumber);
    const owner = await this.resolveOwnerUser(dto.corpId, dto.ownerName);

    const duplicate = await this.prisma.license_plates.findFirst({
      where: { plate_number: plateNumber },
    });
    if (duplicate) {
      throw new ConflictException('License plate already exists');
    }

    const hasDefault = await this.prisma.license_plates.findFirst({
      where: { user_id: owner.id, is_default: true },
      select: { id: true },
    });

    try {
      const created = await this.prisma.license_plates.create({
        data: {
          id: await this.nextLicensePlateId(),
          user_id: owner.id,
          plate_number: plateNumber,
          status: 'active',
          is_default: !hasDefault,
        },
        select: plateSelect,
      });
      this.notifyEvDisplay('license-plate-create');
      return this.mapPlate(created, this.ownerDisplay(owner));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('License plate already exists');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateLicensePlateDto) {
    const bid = BigInt(id);
    const current = await this.prisma.license_plates.findUnique({
      where: { id: bid },
      select: plateSelect,
    });
    if (!current) throw new NotFoundException('License plate not found');

    const data: Prisma.license_platesUpdateInput = {};

    if (dto.plateNumber !== undefined) {
      const plateNumber = this.normalizePlateNumber(dto.plateNumber);
      if (plateNumber !== current.plate_number) {
        const duplicate = await this.prisma.license_plates.findFirst({
          where: { plate_number: plateNumber, NOT: { id: bid } },
        });
        if (duplicate) {
          throw new ConflictException('License plate already exists');
        }
        data.plate_number = plateNumber;
      }
    }

    if (dto.corpId !== undefined || dto.ownerName !== undefined) {
      const owner = await this.resolveOwnerUser(dto.corpId, dto.ownerName);
      data.user_id = owner.id;
    }

    try {
      const updated = await this.prisma.license_plates.update({
        where: { id: bid },
        data,
        select: plateSelect,
      });
      const userId = updated.user_id;
      let user: { corpId: string; name: string } | null = null;
      if (userId != null) {
        const map = await this.loadUsersByIds([userId]);
        user = map.get(userId.toString()) ?? null;
      }
      this.notifyEvDisplay('license-plate-update');
      return this.mapPlate(updated, user);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('License plate already exists');
      }
      throw e;
    }
  }

  async remove(id: string) {
    const bid = BigInt(id);
    const current = await this.prisma.license_plates.findUnique({
      where: { id: bid },
    });
    if (!current) throw new NotFoundException('License plate not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.license_plates.delete({ where: { id: bid } });
      if (!current.is_default || current.user_id == null) return;
      const next = await tx.license_plates.findFirst({
        where: { user_id: current.user_id },
        orderBy: { id: 'asc' },
      });
      if (next) {
        await tx.license_plates.update({
          where: { id: next.id },
          data: { is_default: true },
        });
      }
    });

    this.notifyEvDisplay('license-plate-remove');
    return { ok: true };
  }
}
