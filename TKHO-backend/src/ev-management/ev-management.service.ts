import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getAppTodayYmd } from '../common/app-timezone';
import { releaseEvQuota } from '../common/user-quota';
import { assertEvWeeklyBookingLimit } from '../common/ev-weekly-booking-limit';
import { DisplayManagementService } from '../display-management/display-management.service';
import { PrismaService } from '../prisma/prisma.service';
import { EvRedisCacheService } from '../redis/ev-redis-cache.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { CreateEvParkingDto } from './dto/create-ev-parking.dto';
import { UpdateEvParkingDto } from './dto/update-ev-parking.dto';
import { CreateEvTimePeriodDto } from './dto/create-ev-time-period.dto';
import { UpdateEvTimePeriodDto } from './dto/update-ev-time-period.dto';
import { PublishEvWindowDto } from './dto/publish-ev-window.dto';
import { UpdateEvManageBookingDto } from './dto/update-ev-manage-booking.dto';
import { HkPublicHolidaysService } from '../system-settings/hk-public-holidays.service';
import { formatUserDisplayName, userDisplayNameSelect } from '../common/user-display-name';

const EV_RESOURCE = 'ev';
const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed'] as const;
const DISPLAY_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

type AuthUser = { sub?: string; corpId?: string; role?: string; system?: string };

@Injectable()
export class EvManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evCache: EvRedisCacheService,
    private readonly displayManagementService: DisplayManagementService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly hkPublicHolidaysService: HkPublicHolidaysService,
  ) {}

  private toDateOnly(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private resolveDisplayDateYmd(optional?: string) {
    const raw = String(optional ?? '').trim();
    return raw || getAppTodayYmd();
  }

  private parseHHmm(s: string): Date {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim());
    if (!m) throw new BadRequestException('Invalid time format, use HH:mm');
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (h < 0 || h > 23 || min < 0 || min > 59) {
      throw new BadRequestException('Invalid time');
    }
    return new Date(Date.UTC(1970, 0, 1, h, min, 0, 0));
  }

  private formatHHmm(d: Date): string {
    const h = d.getUTCHours();
    const min = d.getUTCMinutes();
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  private mapParking(row: { id: bigint; evSpace: string; location: string | null; status: string }) {
    return {
      id: row.id.toString(),
      evSpace: row.evSpace,
      location: row.location ?? '',
      status: String(row.status || 'active').toLowerCase(),
    };
  }

  private mapTimePeriod(row: {
    id: bigint;
    period: string;
    startTime: Date;
    endTime: Date;
    status: string;
  }) {
    return {
      id: row.id.toString(),
      period: row.period,
      startTime: this.formatHHmm(row.startTime),
      endTime: this.formatHHmm(row.endTime),
      status: String(row.status || 'active').toLowerCase(),
    };
  }

  async listParkingSlots() {
    const rows = await this.prisma.evParkingSlots.findMany({ orderBy: { id: 'asc' } });
    return rows.map((r) => this.mapParking(r));
  }

  async listActiveParkingSlots() {
    const rows = await this.prisma.evParkingSlots.findMany({ orderBy: { id: 'asc' } });
    return rows
      .filter((r) => String(r.status || 'active').toLowerCase() === 'active')
      .map((r) => this.mapParking(r));
  }

  async createParkingSlot(dto: CreateEvParkingDto) {
    const evSpace = dto.evSpace.trim();
    const dup = await this.prisma.evParkingSlots.findFirst({
      where: { evSpace },
    });
    if (dup) throw new ConflictException('EV space code already exists');

    const max = await this.prisma.evParkingSlots.aggregate({ _max: { id: true } });
    const nextId = (max._max.id ?? BigInt(0)) + BigInt(1);
    const created = await this.prisma.evParkingSlots.create({
      data: {
        id: nextId,
        evSpace,
        location: dto.location?.trim() || null,
        status: dto.status || 'active',
      },
    });
    return this.mapParking(created);
  }

  async updateParkingSlot(id: string, dto: UpdateEvParkingDto) {
    const slotId = BigInt(id);
    const exists = await this.prisma.evParkingSlots.findUnique({ where: { id: slotId } });
    if (!exists) throw new NotFoundException('EV space not found');

    const nextSpace = dto.evSpace !== undefined ? dto.evSpace.trim() : exists.evSpace;
    if (nextSpace !== exists.evSpace) {
      const dup = await this.prisma.evParkingSlots.findFirst({
        where: { evSpace: nextSpace, NOT: { id: slotId } },
      });
      if (dup) throw new ConflictException('EV space code already exists');
    }

    const data: Prisma.EvParkingSlotsUpdateInput = {};
    if (dto.evSpace !== undefined) data.evSpace = nextSpace;
    if (dto.location !== undefined) data.location = dto.location.trim() || null;
    if (dto.status !== undefined) data.status = dto.status;

    if (Object.keys(data).length === 0) {
      return this.mapParking(exists);
    }

    const updated = await this.prisma.evParkingSlots.update({
      where: { id: slotId },
      data,
    });
    return this.mapParking(updated);
  }

  async deleteParkingSlot(id: string) {
    const slotId = BigInt(id);
    const exists = await this.prisma.evParkingSlots.findUnique({ where: { id: slotId } });
    if (!exists) throw new NotFoundException('EV space not found');
    const upcomingCnt = await this.prisma.evBookings.count({
      where: {
        slotId,
        status: { notIn: ['cancelled', 'canceled', 'past'] },
      },
    });
    if (upcomingCnt > 0) {
      throw new BadRequestException(
        'Cannot delete this EV space because it has upcoming bookings. Please cancel those bookings first.',
      );
    }
    const historyCnt = await this.prisma.evBookings.count({ where: { slotId } });
    if (historyCnt > 0) {
      throw new BadRequestException(
        'Cannot delete this EV space because it has booking history. Historical booking records cannot be removed.',
      );
    }
    await this.prisma.evParkingSlots.delete({ where: { id: slotId } });
    return { ok: true };
  }

  async listTimePeriods() {
    const rows = await this.prisma.evTimePeriods.findMany({ orderBy: { id: 'asc' } });
    return rows.map((r) => this.mapTimePeriod(r));
  }

  private assertTimeOrder(start: Date, end: Date) {
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException('End time must be later than start time');
    }
  }

  async createTimePeriod(dto: CreateEvTimePeriodDto) {
    const start = this.parseHHmm(dto.startTime);
    const end = this.parseHHmm(dto.endTime);
    this.assertTimeOrder(start, end);

    const max = await this.prisma.evTimePeriods.aggregate({ _max: { id: true } });
    const nextId = (max._max.id ?? BigInt(0)) + BigInt(1);
    try {
      const created = await this.prisma.evTimePeriods.create({
        data: {
          id: nextId,
          period: dto.period.trim(),
          startTime: start,
          endTime: end,
          status: dto.status || 'active',
        },
      });
      return this.mapTimePeriod(created);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Time period label already exists');
      }
      throw e;
    }
  }

  async updateTimePeriod(id: string, dto: UpdateEvTimePeriodDto) {
    const periodId = BigInt(id);
    const exists = await this.prisma.evTimePeriods.findUnique({ where: { id: periodId } });
    if (!exists) throw new NotFoundException('Time period not found');

    const start =
      dto.startTime !== undefined ? this.parseHHmm(dto.startTime) : exists.startTime;
    const end = dto.endTime !== undefined ? this.parseHHmm(dto.endTime) : exists.endTime;
    if (dto.startTime !== undefined || dto.endTime !== undefined) {
      this.assertTimeOrder(start, end);
    }

    const data: Prisma.EvTimePeriodsUpdateInput = {};
    if (dto.period !== undefined) data.period = dto.period.trim();
    if (dto.startTime !== undefined) data.startTime = start;
    if (dto.endTime !== undefined) data.endTime = end;
    if (dto.status !== undefined) data.status = dto.status;

    if (Object.keys(data).length === 0) {
      return this.mapTimePeriod(exists);
    }

    try {
      const updated = await this.prisma.evTimePeriods.update({
        where: { id: periodId },
        data,
      });
      return this.mapTimePeriod(updated);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Time period label already exists');
      }
      throw e;
    }
  }

  async deleteTimePeriod(id: string) {
    const periodId = BigInt(id);
    const exists = await this.prisma.evTimePeriods.findUnique({ where: { id: periodId } });
    if (!exists) throw new NotFoundException('Time period not found');
    const upcomingCnt = await this.prisma.evBookings.count({
      where: {
        periodId,
        status: { notIn: ['cancelled', 'canceled', 'past'] },
      },
    });
    if (upcomingCnt > 0) {
      throw new BadRequestException(
        'Cannot delete this time period because it has upcoming bookings. Please cancel those bookings first.',
      );
    }
    const historyCnt = await this.prisma.evBookings.count({ where: { periodId } });
    if (historyCnt > 0) {
      throw new BadRequestException(
        'Cannot delete this time period because it has booking history. Historical booking records cannot be removed.',
      );
    }
    await this.prisma.evTimePeriods.delete({ where: { id: periodId } });
    return { ok: true };
  }

  async getEvBookingWindow() {
    const evDateUpdateTime = await this.systemSettingsService.getEvDateUpdateTime();
    const cached = await this.evCache.getBookingWindow();
    if (cached) {
      return { ...cached, evDateUpdateTime };
    }

    const payload = await this.loadEvBookingWindowFromDb();
    await this.evCache.setBookingWindow(payload);
    return { ...payload, evDateUpdateTime };
  }

  private async loadEvBookingWindowFromDb() {
    const current = await this.prisma.booking_windows.findUnique({
      where: { resource_type: EV_RESOURCE },
    });

    if (!current) {
      const today = new Date();
      const start = new Date(today);
      const end = new Date(today);
      end.setDate(end.getDate() + 13);
      return {
        resourceType: EV_RESOURCE,
        currentStartDate: this.toDateOnly(start),
        currentEndDate: this.toDateOnly(end),
        updatedBy: 'System',
        updatedAt: null,
      };
    }

    return {
      resourceType: EV_RESOURCE,
      currentStartDate: this.toDateOnly(current.current_start_date),
      currentEndDate: this.toDateOnly(current.current_end_date),
      updatedBy: current.updated_by || 'System',
      updatedAt: current.updated_at,
    };
  }

  async publishEvBookingWindow(dto: PublishEvWindowDto) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) {
      throw new BadRequestException('End date must be later than start date');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.booking_windows.upsert({
        where: { resource_type: EV_RESOURCE },
        update: {
          current_start_date: start,
          current_end_date: end,
          updated_by: 'EV Admin',
          updated_at: new Date(),
        },
        create: {
          resource_type: EV_RESOURCE,
          current_start_date: start,
          current_end_date: end,
          updated_by: 'EV Admin',
          updated_at: new Date(),
        },
      });

      const max = await tx.booking_window_history.aggregate({ _max: { id: true } });
      await tx.booking_window_history.create({
        data: {
          id: (max._max.id ?? BigInt(0)) + BigInt(1),
          resource_type: EV_RESOURCE,
          start_date: start,
          end_date: end,
          published_at: new Date(),
          published_by: 'EV Admin',
        },
      });

      return row;
    });

    const payload = {
      resourceType: EV_RESOURCE,
      currentStartDate: this.toDateOnly(updated.current_start_date),
      currentEndDate: this.toDateOnly(updated.current_end_date),
      updatedBy: updated.updated_by || 'EV Admin',
      updatedAt: updated.updated_at,
    };

    await this.evCache.invalidateBookingWindow();

    return payload;
  }

  private parseAuthSub(auth: AuthUser): bigint {
    const sub = String(auth?.sub ?? '').trim();
    if (!/^\d+$/.test(sub)) {
      throw new UnauthorizedException('Invalid session');
    }
    return BigInt(sub);
  }

  private isAdminRole(auth: AuthUser): boolean {
    if (auth.system === 'admin') return true;
    return String(auth.role || '')
      .toLowerCase()
      .includes('admin');
  }

  private parseBookingDateYmd(ymd: string): { dateKey: string; date: Date } {
    const dateKey = ymd.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      throw new BadRequestException('bookingDate must be YYYY-MM-DD');
    }
    return { dateKey, date: new Date(`${dateKey}T00:00:00.000Z`) };
  }

  private async resolveReservedByUserId(
    reservedByUserIdRaw: string | undefined,
    fallbackUserId: bigint,
  ): Promise<bigint> {
    const raw = String(reservedByUserIdRaw ?? '').trim();
    if (!raw) return fallbackUserId;
    if (!/^\d+$/.test(raw)) {
      throw new BadRequestException('reservedByUserId must be a numeric id');
    }
    return BigInt(raw);
  }

  private async assertLicensePlateForUser(
    userId: bigint,
    licensePlateId: bigint,
    db: Pick<PrismaService, 'license_plates'>,
  ) {
    const plate = await db.license_plates.findUnique({ where: { id: licensePlateId } });
    if (!plate || plate.status !== 'active') {
      throw new BadRequestException('License plate unavailable.');
    }
    if (plate.user_id !== userId) {
      throw new BadRequestException('License plate does not belong to the reserved-by user.');
    }
    return plate;
  }

  private async pickFreeSlotForUpdate(
    tx: Prisma.TransactionClient,
    periodId: bigint,
    dateKey: string,
    excludeBookingId: bigint,
    preferredSlotId?: bigint,
  ) {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtext(concat(cast(${periodId} AS text), ':', ${dateKey}))
      )
    `;

    const pickFromRows = async (rows: { id: bigint; ev_space: string }[]) =>
      rows[0] ? { id: rows[0].id, evSpace: rows[0].ev_space } : null;

    if (preferredSlotId != null) {
      const preferred = await tx.$queryRaw<{ id: bigint; ev_space: string }[]>`
        SELECT s.id, s.ev_space
        FROM ev_parking_slots s
        WHERE s.id = ${preferredSlotId}
          AND s.status = 'active'
          AND NOT EXISTS (
            SELECT 1
            FROM ev_bookings b
            WHERE b.slot_id = s.id
              AND b.period_id = ${periodId}
              AND b.booking_date = ${dateKey}::date
              AND b.status IN ('pending', 'confirmed')
              AND b.id <> ${excludeBookingId}
          )
        LIMIT 1
      `;
      const picked = await pickFromRows(preferred);
      if (picked) return picked;
    }

    const rows = await tx.$queryRaw<{ id: bigint; ev_space: string }[]>`
      SELECT s.id, s.ev_space
      FROM ev_parking_slots s
      WHERE s.status = 'active'
        AND NOT EXISTS (
          SELECT 1
          FROM ev_bookings b
          WHERE b.slot_id = s.id
            AND b.period_id = ${periodId}
            AND b.booking_date = ${dateKey}::date
            AND b.status IN ('pending', 'confirmed')
            AND b.id <> ${excludeBookingId}
        )
      ORDER BY s.id
      LIMIT 1
    `;
    return pickFromRows(rows);
  }

  private formatDisplayDate(date: Date): string {
    const d = new Date(date);
    const day = d.getUTCDate();
    const month = DISPLAY_MONTHS[d.getUTCMonth()] ?? 'Jan';
    const year = d.getUTCFullYear();
    return `${day} ${month} ${year}`;
  }

  private formatDisplayDateTime(date: Date): string {
    const d = new Date(date);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${this.formatDisplayDate(d)} ${hh}:${mm}`;
  }

  private formatPeriodTime(period: { period: string; startTime: Date; endTime: Date } | null) {
    if (!period) return '';
    const start = this.formatHHmm(period.startTime);
    const end = this.formatHHmm(period.endTime);
    return `${period.period} (${start} - ${end})`;
  }

  private bookingSlotEnd(bookingDate: Date, period: { endTime: Date } | null): Date {
    const end = new Date(bookingDate);
    if (period) {
      end.setUTCHours(
        period.endTime.getUTCHours(),
        period.endTime.getUTCMinutes(),
        0,
        0,
      );
    } else {
      end.setUTCHours(23, 59, 59, 999);
    }
    return end;
  }

  private deriveUiStatus(
    bookingDate: Date,
    period: { endTime: Date } | null,
    dbStatus: string,
  ): 'upcoming' | 'past' | 'cancelled' {
    const normalized = String(dbStatus || '').toLowerCase();
    if (normalized === 'cancelled' || normalized === 'canceled') {
      return 'cancelled';
    }
    const now = new Date();
    if (now > this.bookingSlotEnd(bookingDate, period)) {
      return 'past';
    }
    return 'upcoming';
  }

  private async resolveBookingOwners(
    rows: Array<{
      userCorpId: string | null;
      submitterUserId: bigint | null;
      licensePlate: { user_id: bigint | null } | null;
    }>,
  ) {
    const userIds = new Set<bigint>();
    const corpIds = new Set<string>();
    for (const row of rows) {
      if (row.submitterUserId != null) {
        userIds.add(row.submitterUserId);
      }
      if (row.licensePlate?.user_id != null) {
        userIds.add(row.licensePlate.user_id);
      }
      if (row.userCorpId) {
        corpIds.add(row.userCorpId);
      }
    }
    if (!userIds.size && !corpIds.size) {
      return {
        byId: new Map<
          bigint,
          { id: bigint; corpId: string; firstName: string; lastName: string; email: string | null }
        >(),
        byCorp: new Map(),
      };
    }

    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          userIds.size ? { id: { in: [...userIds] } } : undefined,
          corpIds.size ? { corpId: { in: [...corpIds] } } : undefined,
        ].filter(Boolean) as Prisma.UserWhereInput[],
      },
      select: { id: true, corpId: true, ...userDisplayNameSelect, email: true },
    });

    const byId = new Map<bigint, (typeof users)[0]>();
    const byCorp = new Map<string, (typeof users)[0]>();
    for (const u of users) {
      byId.set(u.id, u);
      byCorp.set(u.corpId, u);
    }
    return { byId, byCorp };
  }

  private mapManageBookingRow(
    row: {
      id: bigint;
      userCorpId: string | null;
      submitterUserId: bigint | null;
      licensePlateId: bigint;
      slotId: bigint;
      periodId: bigint | null;
      bookingDate: Date;
      bookedOn: Date | null;
      createdAt: Date;
      status: string;
      licensePlate: { plate_number: string; user_id: bigint | null } | null;
      slot: { evSpace: string };
      period: { period: string; startTime: Date; endTime: Date } | null;
    },
    owners: {
      byId: Map<
        bigint,
        { id: bigint; corpId: string; firstName: string; lastName: string; email: string | null }
      >;
      byCorp: Map<
        string,
        { id: bigint; corpId: string; firstName: string; lastName: string; email: string | null }
      >;
    },
  ) {
    const plateUserId = row.licensePlate?.user_id ?? null;
    const owner =
      (plateUserId != null ? owners.byId.get(plateUserId) : undefined) ??
      (row.userCorpId ? owners.byCorp.get(row.userCorpId) : undefined);
    const submitter =
      row.submitterUserId != null ? owners.byId.get(row.submitterUserId) : undefined;

    const uiStatus = this.deriveUiStatus(row.bookingDate, row.period, row.status);

    return {
      id: row.id.toString(),
      licensePlate: row.licensePlate?.plate_number ?? '',
      space: row.slot.evSpace,
      date: this.formatDisplayDate(row.bookingDate),
      dateSortKey: this.toDateOnly(row.bookingDate),
      time: this.formatPeriodTime(row.period),
      bookedOn: row.bookedOn
        ? this.formatDisplayDate(row.bookedOn)
        : this.formatDisplayDate(row.bookingDate),
      submittedAt: row.bookedOn
        ? this.formatDisplayDateTime(row.bookedOn)
        : this.formatDisplayDateTime(row.createdAt),
      status: uiStatus,
      dbStatus: row.status,
      employeeId: owner ? owner.id.toString() : undefined,
      corpId: row.userCorpId ?? owner?.corpId,
      submitter: submitter ? formatUserDisplayName(submitter) : undefined,
      submitterUserId: submitter ? submitter.id.toString() : undefined,
      reservedBy: owner ? formatUserDisplayName(owner) : undefined,
      reservedByUserId: owner ? owner.id.toString() : undefined,
      licensePlateId: row.licensePlateId.toString(),
      slotId: row.slotId.toString(),
      periodId: row.periodId != null ? row.periodId.toString() : '',
      bookingDateYmd: this.toDateOnly(row.bookingDate),
      email: owner?.email ?? undefined,
    };
  }

  private mapDisplayBookingRow(row: {
    bookingDate: Date;
    status: string;
    licensePlate: { plate_number: string } | null;
    slot: { evSpace: string };
    period: { period: string; startTime: Date; endTime: Date } | null;
  }) {
    const uiStatus = this.deriveUiStatus(row.bookingDate, row.period, row.status);
    return {
      licensePlate: row.licensePlate?.plate_number ?? '',
      space: row.slot.evSpace,
      date: this.formatDisplayDate(row.bookingDate),
      dateSortKey: this.toDateOnly(row.bookingDate),
      period: row.period?.period ?? '',
      time: this.formatPeriodTime(row.period),
      status: uiStatus,
    };
  }

  async listDisplayBookings(dateYmd?: string) {
    const dateKey = this.resolveDisplayDateYmd(dateYmd);
    const { date: bookingDate } = this.parseBookingDateYmd(dateKey);

    const rows = await this.prisma.evBookings.findMany({
      where: { bookingDate },
      include: {
        licensePlate: { select: { plate_number: true } },
        slot: { select: { evSpace: true } },
        period: { select: { period: true, startTime: true, endTime: true } },
      },
      orderBy: [{ period: { id: 'asc' } }, { slot: { id: 'asc' } }, { id: 'asc' }],
    });

    return {
      displayDate: dateKey,
      bookings: rows.map((row) => this.mapDisplayBookingRow(row)),
    };
  }

  async getPublicDisplayData(dateYmd?: string) {
    const dateKey = this.resolveDisplayDateYmd(dateYmd);
    const [bookingResult, timePeriods, evDisplaySettings, parkingSlots] = await Promise.all([
      this.listDisplayBookings(dateKey),
      this.listTimePeriods(),
      this.displayManagementService.getEvDisplayPublicSettings(),
      this.listActiveParkingSlots(),
    ]);

    return {
      displayDate: dateKey,
      bookings: bookingResult.bookings,
      parkingSlots: parkingSlots.map((slot) => ({
        evSpace: slot.evSpace,
      })),
      timePeriods: timePeriods.filter(
        (item) => String(item.status || 'active').toLowerCase() === 'active',
      ),
      evDisplaySettings,
    };
  }

  async listManageBookings(auth: AuthUser, scope: 'my' | 'all' = 'my') {
    const userId = this.parseAuthSub(auth);
    const corpId = String(auth.corpId ?? '').trim();

    if (scope === 'all' && !this.isAdminRole(auth)) {
      throw new ForbiddenException('Only administrators can view all bookings.');
    }

    const where: Prisma.EvBookingsWhereInput =
      scope === 'all'
        ? {}
        : {
            OR: [
              ...(corpId ? [{ userCorpId: corpId }] : []),
              { licensePlate: { user_id: userId } },
            ],
          };

    const rows = await this.prisma.evBookings.findMany({
      where,
      include: {
        licensePlate: { select: { plate_number: true, user_id: true } },
        slot: { select: { evSpace: true } },
        period: { select: { period: true, startTime: true, endTime: true } },
      },
      orderBy: [{ bookingDate: 'desc' }, { id: 'desc' }],
    });

    const owners = await this.resolveBookingOwners(rows);

    return {
      bookings: rows.map((row) => this.mapManageBookingRow(row, owners)),
    };
  }

  async cancelManageBooking(auth: AuthUser, idRaw: string) {
    const userId = this.parseAuthSub(auth);
    const corpId = String(auth.corpId ?? '').trim();
    const id = BigInt(idRaw);

    const row = await this.prisma.evBookings.findUnique({
      where: { id },
      include: {
        licensePlate: { select: { plate_number: true, user_id: true } },
        slot: { select: { evSpace: true } },
        period: { select: { period: true, startTime: true, endTime: true } },
      },
    });

    if (!row) {
      throw new NotFoundException('Booking not found.');
    }

    const ownsBooking =
      (corpId && row.userCorpId === corpId) ||
      (row.licensePlate?.user_id != null && row.licensePlate.user_id === userId);

    if (!ownsBooking && !this.isAdminRole(auth)) {
      throw new ForbiddenException('You can only cancel your own bookings.');
    }

    const uiStatus = this.deriveUiStatus(row.bookingDate, row.period, row.status);
    if (uiStatus === 'cancelled') {
      throw new BadRequestException('Booking is already cancelled.');
    }
    if (uiStatus === 'past') {
      throw new BadRequestException('Past bookings cannot be cancelled.');
    }
    if (!['pending', 'confirmed'].includes(row.status)) {
      throw new BadRequestException('Booking cannot be cancelled.');
    }

    if (!this.isAdminRole(auth) && this.toDateOnly(row.bookingDate) === getAppTodayYmd()) {
      throw new BadRequestException(
        'Same-day EV bookings cannot be cancelled.',
      );
    }

    const ownerUserId = row.licensePlate?.user_id ?? null;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (ownerUserId != null) {
        await releaseEvQuota(tx, ownerUserId);
      }

      return tx.evBookings.update({
        where: { id },
        data: { status: 'cancelled' },
        include: {
          licensePlate: { select: { plate_number: true, user_id: true } },
          slot: { select: { evSpace: true } },
          period: { select: { period: true, startTime: true, endTime: true } },
        },
      });
    });

    await this.evCache.bumpCalendarVersion();

    const owners = await this.resolveBookingOwners([updated]);

    return {
      message: 'Booking cancelled',
      booking: this.mapManageBookingRow(updated, owners),
    };
  }

  async updateManageBooking(auth: AuthUser, idRaw: string, dto: UpdateEvManageBookingDto) {
    if (!this.isAdminRole(auth)) {
      throw new ForbiddenException('Only administrators can edit bookings.');
    }

    const id = BigInt(idRaw);
    const row = await this.prisma.evBookings.findUnique({
      where: { id },
      include: {
        licensePlate: { select: { plate_number: true, user_id: true } },
        slot: { select: { evSpace: true } },
        period: { select: { period: true, startTime: true, endTime: true } },
      },
    });

    if (!row) {
      throw new NotFoundException('Booking not found.');
    }

    const uiStatus = this.deriveUiStatus(row.bookingDate, row.period, row.status);
    if (uiStatus !== 'upcoming') {
      throw new BadRequestException('Only upcoming bookings can be edited.');
    }
    if (!ACTIVE_BOOKING_STATUSES.includes(row.status as (typeof ACTIVE_BOOKING_STATUSES)[number])) {
      throw new BadRequestException('Booking cannot be edited.');
    }

    const fallbackUserId = row.licensePlate?.user_id ?? this.parseAuthSub(auth);
    const reservedByUserId = await this.resolveReservedByUserId(
      dto.reservedByUserId,
      fallbackUserId,
    );
    const reservedUser = await this.prisma.user.findUnique({
      where: { id: reservedByUserId },
      select: { corpId: true, status: true },
    });
    if (!reservedUser) {
      throw new BadRequestException('Reserved-by user not found');
    }
    if (String(reservedUser.status || '').toLowerCase() !== 'active') {
      throw new BadRequestException('Reserved-by user is not active');
    }
    const userCorpId = String(reservedUser.corpId ?? '').trim();
    if (!userCorpId) {
      throw new BadRequestException('Reserved-by user is missing CORP User ID');
    }

    const licensePlateId = BigInt(dto.licensePlateId);
    const periodId = BigInt(dto.periodId);
    const { dateKey, date: bookingDate } = this.parseBookingDateYmd(dto.bookingDate);
    await this.hkPublicHolidaysService.assertBookableForUser(bookingDate, auth);
    const preferredSlotId =
      dto.slotId != null && /^\d+$/.test(String(dto.slotId).trim())
        ? BigInt(String(dto.slotId).trim())
        : undefined;

    const weeklyLimit = await this.systemSettingsService.getEvWeeklyBookingLimit();

    const updated = await this.prisma.$transaction(async (tx) => {
      const period = await tx.evTimePeriods.findUnique({ where: { id: periodId } });
      if (!period || period.status !== 'active') {
        throw new ConflictException('Time period unavailable.');
      }

      await this.assertLicensePlateForUser(reservedByUserId, licensePlateId, tx);

      await assertEvWeeklyBookingLimit(
        tx,
        reservedByUserId,
        dateKey,
        weeklyLimit,
        {
          excludeBookingId: id,
          bypassWeeklyLimit: true,
        },
      );

      const slot = await this.pickFreeSlotForUpdate(
        tx,
        periodId,
        dateKey,
        id,
        preferredSlotId,
      );
      if (!slot) {
        throw new ConflictException('This time slot is fully booked.');
      }

      return tx.evBookings.update({
        where: { id },
        data: {
          userCorpId,
          licensePlateId,
          slotId: slot.id,
          periodId,
          bookingDate,
        },
        include: {
          licensePlate: { select: { plate_number: true, user_id: true } },
          slot: { select: { evSpace: true } },
          period: { select: { period: true, startTime: true, endTime: true } },
        },
      });
    });

    await this.evCache.bumpCalendarVersion();

    const owners = await this.resolveBookingOwners([updated]);
    return {
      message: 'Booking updated',
      booking: this.mapManageBookingRow(updated, owners),
    };
  }
}
