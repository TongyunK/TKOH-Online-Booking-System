import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { promises as fs } from 'fs';
import { join } from 'path';
import { getAppTodayYmd } from '../common/app-timezone';
import { consumeVenueQuota, releaseVenueQuota } from '../common/user-quota';
import {
  DisplayConfigKey,
  DISPLAY_CONFIG_DEFAULTS,
} from '../display-management/display-config.keys';
import { DisplayManagementService } from '../display-management/display-management.service';
import { PrismaService } from '../prisma/prisma.service';
import { HkPublicHolidaysService } from '../system-settings/hk-public-holidays.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { UpsertVenueDto } from './dto/upsert-venue.dto';
import { PublishVenueWindowDto } from './dto/publish-venue-window.dto';
import { CreateVenueBlockDto } from './dto/create-venue-block.dto';
import { UpdateVenueManageBookingDto } from './dto/update-venue-manage-booking.dto';
import {
  ApproveVenueManageBookingDto,
  RejectVenueManageBookingDto,
} from './dto/review-venue-booking.dto';
import {
  buildVenueTeaServiceJson,
  formatVenueTeaServiceDisplay,
  normalizeVenueTeaService,
} from '../common/venue-tea-service';

/** ???????????????????? */
const DEFAULT_PUBLIC_VENUE_MEETING_TITLE = 'Reserved';

const teaDisplayBookingInclude = {
  venue: { select: { id: true, name: true, nameZh: true } },
  venueTeaService: { select: { teaService: true, completed: true } },
} satisfies Prisma.VenueBookingsInclude;

const manageBookingRowInclude = {
  venue: { select: { id: true, name: true, userDefinedUploadEventTitle: true } },
  reservedBy: {
    select: {
      id: true,
      corpId: true,
      name: true,
      contact: true,
      email: true,
      department: { select: { department_name: true } },
    },
  },
  submitter: {
    select: {
      id: true,
      corpId: true,
      name: true,
    },
  },
  cancelledBy: {
    select: {
      id: true,
      corpId: true,
      name: true,
    },
  },
  venueTeaService: { select: { teaService: true } },
} satisfies Prisma.VenueBookingsInclude;

type ManageBookingRow = Prisma.VenueBookingsGetPayload<{
  include: typeof manageBookingRowInclude;
}>;

const venueDisplayBookingInclude = {
  venue: {
    select: {
      id: true,
      name: true,
      nameZh: true,
      location: true,
      locationZh: true,
      displayType: true,
    },
  },
  reservedBy: { select: { name: true } },
} satisfies Prisma.VenueBookingsInclude;

type TeaDisplayBookingRow = Prisma.VenueBookingsGetPayload<{
  include: typeof teaDisplayBookingInclude;
}>;

type VenueDisplayBookingRow = Prisma.VenueBookingsGetPayload<{
  include: typeof venueDisplayBookingInclude;
}>;

@Injectable()
export class VenueManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly displayManagementService: DisplayManagementService,
    private readonly hkPublicHolidaysService: HkPublicHolidaysService,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}
  private readonly uploadsBasePath = '/api/uploads/venues/';
  private readonly displayMonths = [
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

  /** ? imageUrl ?????????????????????????? */
  private async unlinkVenueUploadFile(imageUrl: string | null | undefined) {
    const path = imageUrl || '';
    if (!path.startsWith(this.uploadsBasePath)) return;
    const filename = path.replace(this.uploadsBasePath, '');
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) return;
    const abs = join(process.cwd(), 'uploads', 'venues', filename);
    await fs.unlink(abs).catch(() => null);
  }

  private toDateOnly(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private toVenueTab(venueType?: string | null, tab?: string | null) {
    if (tab === 'conference_discussion' || tab === 'other_venues') return tab;
    return venueType === 'conference' || venueType === 'discussion'
      ? 'conference_discussion'
      : 'other_venues';
  }

  private toVenueType(type?: string | null) {
    if (type === 'conference' || type === 'discussion') return type;
    return 'other';
  }

  private normalizeDailyBookingTime(value?: string | null) {
    const raw = String(value ?? '').trim();
    return raw || null;
  }

  private resolveDailyBookingWindow(dto: UpsertVenueDto) {
    const start = this.normalizeDailyBookingTime(dto.dailyBookingStartTime);
    const end = this.normalizeDailyBookingTime(dto.dailyBookingEndTime);
    if ((start && !end) || (!start && end)) {
      throw new BadRequestException(
        'Daily open booking hours require both start and end time',
      );
    }
    if (start && end && start >= end) {
      throw new BadRequestException(
        'Daily open booking end time must be later than start time',
      );
    }
    return { start, end };
  }

  private mapVenue(venue: any, blocks: any[] = []) {
    const type = this.toVenueType(venue.venueType);
    return {
      id: venue.id.toString(),
      name: venue.name,
      nameZh: venue.nameZh || '',
      tab: this.toVenueTab(type, venue.tab),
      type,
      color: venue.color || '',
      location: venue.location || '',
      locationZh: venue.locationZh || '',
      roomCapacity: venue.roomCapacity ?? null,
      teaServiceAvailable: venue.teaServiceAvailable !== false,
      userDefinedUploadEventTitle: venue.userDefinedUploadEventTitle !== false,
      dailyBookingStartTime: venue.dailyBookingStartTime || null,
      dailyBookingEndTime: venue.dailyBookingEndTime || null,
      displayType: venue.displayType || 'single',
      image: venue.imageUrl || '',
      status: String(venue.status || 'active').toLowerCase(),
      blocks: blocks.map((block) => ({
        id: block.id.toString(),
        startAt: block.startAt,
        endAt: block.endAt,
        reason: block.reason || '',
        createdAt: block.createdAt || null,
      })),
    };
  }

  async listVenues() {
    const venues = await this.prisma.venues.findMany({
      orderBy: { id: 'asc' },
      include: {
        venue_blocks: {
          orderBy: { created_at: 'desc' },
        },
      },
    });

    return venues.map((venue) =>
      this.mapVenue(
        venue,
        venue.venue_blocks.map((b) => ({
          id: b.id,
          startAt: b.start_at.toISOString(),
          endAt: b.end_at.toISOString(),
          reason: b.reason,
          createdAt: b.created_at.toISOString(),
        })),
      ),
    );
  }

  async createVenue(dto: UpsertVenueDto) {
    const max = await this.prisma.venues.aggregate({ _max: { id: true } });
    const nextId = (max._max.id ?? BigInt(0)) + BigInt(1);
    const dailyWindow = this.resolveDailyBookingWindow(dto);

    const created = await this.prisma.venues.create({
      data: {
        id: nextId,
        name: dto.name,
        nameZh: dto.nameZh || null,
        tab: dto.tab || this.toVenueTab(dto.type),
        venueType: dto.type || 'other',
        color: dto.color || null,
        location: dto.location || null,
        locationZh: dto.locationZh || null,
        roomCapacity: dto.roomCapacity ?? null,
        teaServiceAvailable: dto.teaServiceAvailable ?? true,
        userDefinedUploadEventTitle: dto.userDefinedUploadEventTitle ?? true,
        dailyBookingStartTime: dailyWindow.start,
        dailyBookingEndTime: dailyWindow.end,
        displayType: dto.displayType || 'single',
        imageUrl: dto.image || null,
        status: dto.status || 'active',
      },
    });

    return this.mapVenue(created, []);
  }

  async updateVenue(id: string, dto: UpsertVenueDto) {
    const venueId = BigInt(id);
    const exists = await this.prisma.venues.findUnique({ where: { id: venueId } });
    if (!exists) throw new NotFoundException('Venue not found');

    const prevImage = exists.imageUrl ?? '';
    let nextImageUrl: string | null = exists.imageUrl;
    if (dto.image !== undefined) {
      const trimmed = String(dto.image).trim();
      nextImageUrl = trimmed === '' ? null : trimmed;
    }
    if (prevImage !== (nextImageUrl ?? '')) {
      await this.unlinkVenueUploadFile(prevImage);
    }

    const dailyWindow =
      dto.dailyBookingStartTime !== undefined || dto.dailyBookingEndTime !== undefined
        ? this.resolveDailyBookingWindow({
            ...dto,
            dailyBookingStartTime:
              dto.dailyBookingStartTime !== undefined
                ? dto.dailyBookingStartTime
                : exists.dailyBookingStartTime,
            dailyBookingEndTime:
              dto.dailyBookingEndTime !== undefined
                ? dto.dailyBookingEndTime
                : exists.dailyBookingEndTime,
          })
        : {
            start: exists.dailyBookingStartTime,
            end: exists.dailyBookingEndTime,
          };

    const updated = await this.prisma.venues.update({
      where: { id: venueId },
      data: {
        name: dto.name ?? exists.name,
        nameZh: dto.nameZh ?? exists.nameZh,
        tab: dto.tab ?? exists.tab,
        venueType: dto.type ?? exists.venueType,
        color: dto.color ?? exists.color,
        location: dto.location ?? exists.location,
        locationZh: dto.locationZh ?? exists.locationZh,
        roomCapacity: dto.roomCapacity ?? exists.roomCapacity,
        teaServiceAvailable:
          dto.teaServiceAvailable !== undefined
            ? dto.teaServiceAvailable
            : exists.teaServiceAvailable,
        userDefinedUploadEventTitle:
          dto.userDefinedUploadEventTitle !== undefined
            ? dto.userDefinedUploadEventTitle
            : exists.userDefinedUploadEventTitle,
        dailyBookingStartTime: dailyWindow.start,
        dailyBookingEndTime: dailyWindow.end,
        displayType: dto.displayType ?? exists.displayType,
        imageUrl: nextImageUrl,
        status: dto.status ?? exists.status,
      },
    });

    const blocks = await this.prisma.venue_blocks.findMany({
      where: { venue_id: venueId },
      orderBy: { created_at: 'desc' },
    });

    return this.mapVenue(
      updated,
      blocks.map((b) => ({
        id: b.id,
        startAt: b.start_at.toISOString(),
        endAt: b.end_at.toISOString(),
        reason: b.reason,
        createdAt: b.created_at.toISOString(),
      })),
    );
  }

  async deleteVenue(id: string) {
    const venueId = BigInt(id);
    const existing = await this.prisma.venues.findUnique({
      where: { id: venueId },
      select: { imageUrl: true },
    });
    if (!existing) throw new NotFoundException('Venue not found');
    await this.unlinkVenueUploadFile(existing.imageUrl);
    await this.prisma.venues.delete({ where: { id: venueId } });
    return { ok: true };
  }

  async getVenueWindow() {
    const current = await this.prisma.booking_windows.findUnique({
      where: { resource_type: 'venue' },
    });

    if (!current) {
      const today = new Date();
      const start = new Date(today);
      start.setDate(start.getDate() + 1);
      const end = new Date(today);
      end.setDate(end.getDate() + 14);
      return {
        resourceType: 'venue',
        currentStartDate: this.toDateOnly(start),
        currentEndDate: this.toDateOnly(end),
        updatedBy: 'System',
        updatedAt: null,
      };
    }

    return {
      resourceType: 'venue',
      currentStartDate: this.toDateOnly(current.current_start_date),
      currentEndDate: this.toDateOnly(current.current_end_date),
      updatedBy: current.updated_by || 'System',
      updatedAt: current.updated_at,
    };
  }

  async publishVenueWindow(dto: PublishVenueWindowDto) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) {
      throw new BadRequestException('End date must be later than start date');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.booking_windows.upsert({
        where: { resource_type: 'venue' },
        update: {
          current_start_date: start,
          current_end_date: end,
          updated_by: 'Venue Admin',
          updated_at: new Date(),
        },
        create: {
          resource_type: 'venue',
          current_start_date: start,
          current_end_date: end,
          updated_by: 'Venue Admin',
          updated_at: new Date(),
        },
      });

      const max = await tx.booking_window_history.aggregate({ _max: { id: true } });
      await tx.booking_window_history.create({
        data: {
          id: (max._max.id ?? BigInt(0)) + BigInt(1),
          resource_type: 'venue',
          start_date: start,
          end_date: end,
          published_at: new Date(),
          published_by: 'Venue Admin',
        },
      });

      return row;
    });

    return {
      resourceType: 'venue',
      currentStartDate: this.toDateOnly(updated.current_start_date),
      currentEndDate: this.toDateOnly(updated.current_end_date),
      updatedBy: updated.updated_by || 'Venue Admin',
      updatedAt: updated.updated_at,
    };
  }

  async addBlock(venueId: string, dto: CreateVenueBlockDto) {
    const id = BigInt(venueId);
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (endAt <= startAt) {
      throw new BadRequestException('End datetime must be later than start datetime');
    }

    const max = await this.prisma.venue_blocks.aggregate({ _max: { id: true } });
    const created = await this.prisma.venue_blocks.create({
      data: {
        id: (max._max.id ?? BigInt(0)) + BigInt(1),
        venue_id: id,
        start_at: startAt,
        end_at: endAt,
        reason: dto.reason || null,
      },
    });

    return {
      id: created.id.toString(),
      startAt: created.start_at.toISOString(),
      endAt: created.end_at.toISOString(),
      reason: created.reason || '',
      createdAt: created.created_at.toISOString(),
    };
  }

  async removeBlock(venueId: string, blockId: string) {
    const id = BigInt(blockId);
    const venue = BigInt(venueId);
    const exists = await this.prisma.venue_blocks.findFirst({
      where: { id, venue_id: venue },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Blocked period not found');
    await this.prisma.venue_blocks.delete({ where: { id } });
    return { ok: true };
  }

  private parseAuthSub(auth: { sub?: string }): bigint {
    const sub = String(auth?.sub ?? '').trim();
    if (!/^\d+$/.test(sub)) {
      throw new UnauthorizedException('Invalid session');
    }
    return BigInt(sub);
  }

  private isAdminRole(auth: { role?: string; system?: string }): boolean {
    if (auth.system === 'admin') return true;
    return String(auth.role || '').toLowerCase().includes('admin');
  }

  private isCanceledStatus(status?: string | null) {
    const s = String(status || '').toLowerCase();
    return s === 'cancelled' || s === 'canceled';
  }

  private bookingSlotEnd(
    bookingDate: Date | null | undefined,
    endTime: Date | null | undefined,
  ): Date {
    const date = bookingDate ? new Date(bookingDate) : new Date();
    if (endTime) {
      date.setUTCHours(
        endTime.getUTCHours(),
        endTime.getUTCMinutes(),
        0,
        0,
      );
    } else {
      date.setUTCHours(23, 59, 59, 999);
    }
    return date;
  }

  private assertManageBookingNotPast(row: {
    bookingDate: Date | null | undefined;
    endTime: Date | null | undefined;
    status?: string | null;
  }) {
    const uiStatus = this.deriveUiStatus(row.bookingDate, row.endTime, row.status);
    if (uiStatus === 'past') {
      throw new BadRequestException('Past bookings cannot be cancelled or restored.');
    }
  }

  private deriveUiStatus(
    bookingDate: Date | null | undefined,
    endTime: Date | null | undefined,
    dbStatus?: string | null,
  ): 'upcoming' | 'past' | 'cancelled' {
    if (this.isCanceledStatus(dbStatus)) {
      return 'cancelled';
    }
    const now = new Date();
    if (now > this.bookingSlotEnd(bookingDate, endTime)) {
      return 'past';
    }
    return 'upcoming';
  }

  private formatDisplayDate(date: Date): string {
    const d = new Date(date);
    return `${d.getUTCDate()} ${this.displayMonths[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  private formatDisplayDateTime(date: Date): string {
    const d = new Date(date);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${this.formatDisplayDate(d)} ${hh}:${mm}`;
  }

  private parseDateOnlyYmd(value: string): Date {
    const text = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new BadRequestException('Invalid date format, expected YYYY-MM-DD');
    }
    return new Date(`${text}T00:00:00.000Z`);
  }

  private parseTimeValue(value: string): Date {
    const text = String(value || '').trim();
    const m = /^(\d{1,2}):(\d{2})$/.exec(text);
    if (!m) throw new BadRequestException('Invalid time format, expected HH:mm');
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
      throw new BadRequestException('Invalid time');
    }
    return new Date(Date.UTC(1970, 0, 1, hh, mm, 0));
  }

  private formatTimeValue(date: Date | null | undefined): string {
    if (!date) return '';
    return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
  }

  private timeToMinutes(date: Date | null | undefined): number {
    if (!date) return 0;
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  }

  private timeOverlap(
    a0: Date,
    a1: Date,
    b0: Date,
    b1: Date,
    gapMinutes = 0,
  ): boolean {
    const s1 = this.timeToMinutes(a0);
    const e1 = this.timeToMinutes(a1);
    const s2 = this.timeToMinutes(b0);
    const e2 = this.timeToMinutes(b1);
    const gap = Math.max(0, Number(gapMinutes) || 0);
    return s1 < e2 + gap && e1 + gap > s2;
  }

  private normalizeTeaService(raw: unknown) {
    return normalizeVenueTeaService(raw);
  }

  private async resolveManageReservedByUserId(
    admin: boolean,
    reservedByUserIdRaw: string | undefined,
    currentReservedByUserId: bigint,
  ): Promise<bigint | undefined> {
    if (!admin || reservedByUserIdRaw === undefined) return undefined;
    const raw = String(reservedByUserIdRaw ?? '').trim();
    if (!raw) return undefined;
    if (!/^\d+$/.test(raw)) {
      throw new BadRequestException('Invalid reservedByUserId');
    }
    const nextId = BigInt(raw);
    if (nextId === currentReservedByUserId) return undefined;
    const user = await this.prisma.user.findUnique({
      where: { id: nextId },
      select: { id: true, status: true },
    });
    if (!user) {
      throw new BadRequestException('Reserved-by user not found');
    }
    if (String(user.status || '').toLowerCase() !== 'active') {
      throw new BadRequestException('Reserved-by user is not active');
    }
    return nextId;
  }

  private mapManageBookingRow(row: ManageBookingRow) {
    const tea = this.normalizeTeaService(row.venueTeaService?.teaService);
    const uiStatus = this.deriveUiStatus(row.bookingDate, row.endTime, row.status);
    return {
      id: row.id.toString(),
      room: row.venue?.name || '',
      topic: row.meetingTitle || '',
      date: row.bookingDate ? this.formatDisplayDate(row.bookingDate) : '',
      time: `${this.formatTimeValue(row.startTime)} - ${this.formatTimeValue(row.endTime)}`,
      reservedBy: row.reservedBy?.name || '',
      submitter: row.submitter?.name ?? '',
      cancelledBy: row.cancelledBy?.name || '',
      department: row.reservedBy?.department?.department_name ?? '',
      contact: row.reservedBy?.contact || '',
      email: row.reservedBy?.email || '',
      attendees: row.attendees ?? null,
      attendeeCount: row.attendees ?? null,
      participants: row.attendees ?? null,
      status: uiStatus,
      dbStatus: String(row.status || '').toLowerCase() || 'confirmed',
      approvalStatus: String(row.approvalStatus || '').toLowerCase() || 'pending',
      bookedOn: row.submittedAt
        ? this.formatDisplayDateTime(row.submittedAt)
        : this.formatDisplayDateTime(row.createdAt),
      myNote: row.notes || '',
      employeeId: row.reservedBy?.id?.toString(),
      corpId: row.reservedBy?.corpId || '',
      reason: row.rejectReason || '',
      teaServiceRequired: row.teaServiceRequired,
      displayOnHomepage: row.displayOnHomepage !== false,
      userDefinedUploadEventTitle: row.venue?.userDefinedUploadEventTitle !== false,
      teaServiceParticipants: Number(tea?.attendees || row.attendees || 1),
      teaServiceSummary: formatVenueTeaServiceDisplay(tea, row.attendees ?? null),
      teaServiceSpecialRequest: String(tea?.specialRequest || tea?.notes || '').trim(),
      teaService: tea,
      teaServiceOption: tea?.option ?? (row.teaServiceRequired ? '1' : 'none'),
      teaServiceRatioFrom: tea?.ratioFrom ?? null,
      teaServiceRatioTo: tea?.ratioTo ?? null,
      teaServiceTeaPots: tea?.teaPots ?? null,
      teaServiceWaterPots: tea?.waterPots ?? null,
    };
  }

  async listManageBookings(
    auth: { sub?: string; corpId?: string; role?: string; system?: string },
    scope: 'my' | 'all' = 'my',
  ) {
    const userId = this.parseAuthSub(auth);
    const corpId = String(auth.corpId || '').trim();
    if (scope === 'all' && !this.isAdminRole(auth)) {
      throw new ForbiddenException('Only administrators can view all bookings.');
    }

    const where: Prisma.VenueBookingsWhereInput = {
      bookingType: 'venue',
      ...(scope === 'all'
        ? {}
        : {
            OR: [
              { reservedByUserId: userId },
              ...(corpId ? [{ reservedBy: { corpId } }] : []),
            ],
          }),
    };

    const rows = await this.prisma.venueBookings.findMany({
      where,
      include: manageBookingRowInclude,
      orderBy: [{ bookingDate: 'desc' }, { startTime: 'desc' }, { id: 'desc' }],
    });

    return { bookings: rows.map((row) => this.mapManageBookingRow(row)) };
  }

  private async assertVenueSlotAvailable(
    venueId: bigint,
    bookingDate: Date,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: bigint,
  ) {
    if (this.timeToMinutes(startTime) >= this.timeToMinutes(endTime)) {
      throw new BadRequestException('End time must be later than Start time');
    }

    const conflictRows = await this.prisma.venueBookings.findMany({
      where: {
        venueId,
        bookingDate,
        bookingType: 'venue',
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        OR: [{ status: null }, { status: { not: 'cancelled', mode: 'insensitive' } }],
        AND: [
          {
            OR: [{ approvalStatus: null }, { approvalStatus: { in: ['pending', 'approved'], mode: 'insensitive' } }],
          },
        ],
      },
      select: { id: true, startTime: true, endTime: true },
    });

    const gapMinutes =
      await this.systemSettingsService.getVenueBookingMinGapMinutes();

    for (const row of conflictRows) {
      if (
        row.startTime &&
        row.endTime &&
        this.timeOverlap(startTime, endTime, row.startTime, row.endTime, gapMinutes)
      ) {
        throw new BadRequestException(
          gapMinutes > 0
            ? `Selected time slot is not available. A minimum ${gapMinutes}-minute gap is required between bookings of the same venue.`
            : 'Selected time slot is not available',
        );
      }
    }
  }

  async toggleCancelManageBooking(
    auth: { sub?: string; corpId?: string; role?: string; system?: string },
    idRaw: string,
  ) {
    const id = BigInt(idRaw);
    const me = this.parseAuthSub(auth);
    const corpId = String(auth.corpId || '').trim();
    const admin = this.isAdminRole(auth);
    const row = await this.prisma.venueBookings.findUnique({
      where: { id },
      include: { reservedBy: { select: { id: true, corpId: true } } },
    });
    if (!row) throw new NotFoundException('Booking not found');
    this.assertManageBookingNotPast(row);
    const isOwner = row.reservedByUserId === me || (!!corpId && row.reservedBy?.corpId === corpId);
    if (!isOwner && !admin) throw new ForbiddenException('You can only manage your own bookings.');

    if (admin && this.isCanceledStatus(row.status)) {
      throw new BadRequestException('Administrators cannot restore cancelled bookings.');
    }

    const uiStatus = this.deriveUiStatus(row.bookingDate, row.endTime, row.status);
    const next = this.isCanceledStatus(row.status) ? 'confirmed' : 'cancelled';
    if (next === 'cancelled' && uiStatus !== 'upcoming') {
      throw new BadRequestException('Booking cannot be cancelled.');
    }
    const ownerUserId = row.reservedByUserId;
    const updated = await this.prisma.$transaction(async (tx) => {
      if (ownerUserId != null) {
        if (next === 'cancelled') {
          await releaseVenueQuota(tx, ownerUserId);
        } else {
          await consumeVenueQuota(tx, ownerUserId);
        }
      }

      return tx.venueBookings.update({
        where: { id },
        data: {
          status: next,
          cancelledByUserId: next === 'cancelled' ? me : null,
        },
        include: manageBookingRowInclude,
      });
    });
    return { booking: this.mapManageBookingRow(updated) };
  }

  async updateManageBooking(
    auth: { sub?: string; corpId?: string; role?: string; system?: string },
    idRaw: string,
    dto: UpdateVenueManageBookingDto,
  ) {
    const id = BigInt(idRaw);
    const me = this.parseAuthSub(auth);
    const corpId = String(auth.corpId || '').trim();
    const row = await this.prisma.venueBookings.findUnique({
      where: { id },
      include: { venue: { select: { name: true } }, reservedBy: { select: { corpId: true } } },
    });
    if (!row) throw new NotFoundException('Booking not found');
    const admin = this.isAdminRole(auth);
    const isOwner = row.reservedByUserId === me || (!!corpId && row.reservedBy?.corpId === corpId);
    if (!isOwner && !admin) {
      throw new ForbiddenException('You can only edit your own bookings.');
    }
    if (admin) {
      const uiStatus = this.deriveUiStatus(row.bookingDate, row.endTime, row.status);
      if (uiStatus !== 'upcoming') {
        throw new BadRequestException('Only upcoming bookings can be edited.');
      }
    }

    const approval = String(row.approvalStatus || '').toLowerCase();
    // Approved?????????? My Note?????All Bookings ????????
    if (approval === 'approved' && !admin) {
      const updated = await this.prisma.venueBookings.update({
        where: { id },
        data: {
          notes: dto.myNote !== undefined ? dto.myNote.trim() : row.notes,
        },
        include: manageBookingRowInclude,
      });
      return { booking: this.mapManageBookingRow(updated) };
    }

    /** ????? pending???/??????????/??/?? */
    const canEditSchedule =
      admin || approval === 'pending' || approval === '';

    const roomName = (
      canEditSchedule ? (dto.room ?? row.venue?.name ?? '') : (row.venue?.name ?? '')
    ).trim();
    if (!roomName) throw new BadRequestException('Room is required');
    const venue = await this.prisma.venues.findFirst({ where: { name: roomName, status: 'active' } });
    if (!venue) throw new NotFoundException('Venue not found');

    const bookingDate = canEditSchedule && dto.date
      ? this.parseDateOnlyYmd(dto.date)
      : row.bookingDate!;
    const startTime = canEditSchedule && dto.startTime
      ? this.parseTimeValue(dto.startTime)
      : row.startTime!;
    const endTime = canEditSchedule && dto.endTime
      ? this.parseTimeValue(dto.endTime)
      : row.endTime!;
    await this.hkPublicHolidaysService.assertBookableForUser(bookingDate, auth);
    await this.assertVenueSlotAvailable(venue.id, bookingDate, startTime, endTime, row.id);

    const teaRequired = dto.teaServiceRequired ?? row.teaServiceRequired;
    const attendees = dto.teaServiceParticipants ?? row.attendees ?? 1;
    const displayOnHomepage =
      canEditSchedule && dto.displayOnHomepage !== undefined
        ? Boolean(dto.displayOnHomepage)
        : row.displayOnHomepage;
    const nextReservedByUserId = await this.resolveManageReservedByUserId(
      admin,
      dto.reservedByUserId,
      row.reservedByUserId,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.venueBookings.update({
        where: { id },
        data: {
          venueId: venue.id,
          meetingTitle: dto.topic?.trim() ?? row.meetingTitle,
          notes: dto.myNote !== undefined ? dto.myNote.trim() : row.notes,
          bookingDate,
          startTime,
          endTime,
          teaServiceRequired: teaRequired,
          attendees,
          displayOnHomepage,
          ...(nextReservedByUserId != null
            ? { reservedByUserId: nextReservedByUserId }
            : {}),
        },
        include: manageBookingRowInclude,
      });

      if (teaRequired) {
        const existingTea = await tx.venueTeaService.findUnique({
          where: { venueBookingId: id },
          select: { teaService: true },
        });
        const existingTeaObj = this.normalizeTeaService(existingTea?.teaService);
        const teaService = buildVenueTeaServiceJson({
          teaServiceRequired: true,
          attendees,
          option: dto.teaServiceOption ?? existingTeaObj?.option,
          ratioFrom: dto.teaServiceRatioFrom ?? existingTeaObj?.ratioFrom,
          ratioTo: dto.teaServiceRatioTo ?? existingTeaObj?.ratioTo,
          teaPots: dto.teaServiceTeaPots ?? existingTeaObj?.teaPots,
          waterPots: dto.teaServiceWaterPots ?? existingTeaObj?.waterPots,
          specialRequest: dto.teaServiceSpecialRequest ?? existingTeaObj?.specialRequest ?? existingTeaObj?.notes,
          teaOrWater: dto.teaOrWater,
          serviceType: dto.serviceType,
          teaServiceSpecialRequest: dto.teaServiceSpecialRequest,
        });
        await tx.venueTeaService.upsert({
          where: { venueBookingId: id },
          create: { venueBookingId: id, teaService },
          update: { teaService },
        });
      } else {
        const teaService = buildVenueTeaServiceJson({
          teaServiceRequired: false,
          attendees,
        });
        await tx.venueTeaService.upsert({
          where: { venueBookingId: id },
          create: { venueBookingId: id, teaService },
          update: { teaService },
        });
      }
      return booking;
    });
    return { booking: this.mapManageBookingRow(updated) };
  }

  async approveManageBooking(
    auth: { sub?: string; role?: string; system?: string },
    idRaw: string,
    dto: ApproveVenueManageBookingDto,
  ) {
    if (!this.isAdminRole(auth)) {
      throw new ForbiddenException('Admin portal access required');
    }
    const handlerId = this.parseAuthSub(auth);
    const id = BigInt(idRaw);
    const updated = await this.prisma.venueBookings.update({
      where: { id },
      data: {
        approvalStatus: 'approved',
        handleByUserId: handlerId,
        handledAt: new Date(),
        ...(dto.topic?.trim() ? { meetingTitle: dto.topic.trim() } : {}),
        ...(dto.displayOnHomepage !== undefined
          ? { displayOnHomepage: Boolean(dto.displayOnHomepage) }
          : {}),
      },
      include: manageBookingRowInclude,
    });
    return { booking: this.mapManageBookingRow(updated) };
  }

  async rejectManageBooking(
    auth: { sub?: string; role?: string; system?: string },
    idRaw: string,
    dto: RejectVenueManageBookingDto,
  ) {
    if (!this.isAdminRole(auth)) {
      throw new ForbiddenException('Admin portal access required');
    }
    const reason = String(dto.reason || '').trim();
    if (!reason) throw new BadRequestException('Reject reason is required');
    const handlerId = this.parseAuthSub(auth);
    const id = BigInt(idRaw);
    const updated = await this.prisma.venueBookings.update({
      where: { id },
      data: {
        approvalStatus: 'rejected',
        rejectReason: reason,
        handleByUserId: handlerId,
        handledAt: new Date(),
        ...(dto.topic?.trim() ? { meetingTitle: dto.topic.trim() } : {}),
        ...(dto.displayOnHomepage !== undefined
          ? { displayOnHomepage: Boolean(dto.displayOnHomepage) }
          : {}),
      },
      include: manageBookingRowInclude,
    });
    return { booking: this.mapManageBookingRow(updated) };
  }

  private parseBookingDateYmd(ymd: string): Date {
    const dateKey = String(ymd || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      throw new BadRequestException('date must be YYYY-MM-DD');
    }
    return new Date(`${dateKey}T00:00:00.000Z`);
  }

  private resolveTeaDisplayFromDate(optional?: string) {
    const raw = String(optional ?? '').trim();
    return raw || getAppTodayYmd();
  }

  private async resolveTeaDisplayDates(fromDateYmd?: string) {
    const fromDate = this.resolveTeaDisplayFromDate(fromDateYmd);
    const today = this.parseBookingDateYmd(fromDate);
    const nextWorkingDayYmd =
      await this.hkPublicHolidaysService.getNextWorkingDayYmd(fromDate);
    const nextWorkingDay = this.parseBookingDateYmd(nextWorkingDayYmd);

    return {
      fromDate,
      dates: [fromDate, nextWorkingDayYmd],
      bookingDates: [today, nextWorkingDay],
    };
  }

  private formatTeaDisplayDate(value: Date | null | undefined): string {
    if (!value) return '';
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private formatTeaDisplayTimeRange(
    start: Date | null | undefined,
    end: Date | null | undefined,
  ): string {
    const startText = this.formatTimeValue(start);
    const endText = this.formatTimeValue(end);
    if (!startText && !endText) return '';
    if (!endText) return startText;
    return `${startText}-${endText}`;
  }

  private mapTeaDisplayRequestRow(row: TeaDisplayBookingRow) {
    const teaRaw = this.normalizeTeaService(row.venueTeaService?.teaService);
    const attendees = row.attendees ?? teaRaw?.attendees ?? 1;
    const teaService = teaRaw ?? buildVenueTeaServiceJson({
      teaServiceRequired: Boolean(row.teaServiceRequired),
      attendees,
    });
    if (teaService.attendees == null) {
      teaService.attendees = attendees;
    }
    return {
      id: row.id.toString(),
      bookingId: row.id.toString(),
      venueId: row.venueId != null ? row.venueId.toString() : '',
      venueName: row.venue?.name ?? '',
      venueNameZh: row.venue?.nameZh || row.venue?.name || '',
      meetingTitle: row.meetingTitle ?? '',
      date: this.formatTeaDisplayDate(row.bookingDate),
      time: this.formatTeaDisplayTimeRange(row.startTime, row.endTime),
      attendees,
      teaServiceRequired: Boolean(row.teaServiceRequired),
      teaService: { ...teaService },
      completed: Boolean(row.venueTeaService?.completed),
      approvalStatus: String(row.approvalStatus || '').toLowerCase() || 'pending',
    };
  }

  private async loadTeaNoRequestCompletedMap(): Promise<Record<string, boolean>> {
    const row = await this.prisma.display_config_settings.findUnique({
      where: { config_key: DisplayConfigKey.teaNoRequestCompleted },
    });
    const raw = row?.config_value ?? DISPLAY_CONFIG_DEFAULTS[DisplayConfigKey.teaNoRequestCompleted];
    try {
      const parsed = JSON.parse(raw || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }
      const result: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (value) result[key] = true;
      }
      return result;
    } catch {
      return {};
    }
  }

  private async saveTeaNoRequestCompletedMap(map: Record<string, boolean>) {
    const now = new Date();
    await this.prisma.display_config_settings.upsert({
      where: { config_key: DisplayConfigKey.teaNoRequestCompleted },
      create: {
        config_key: DisplayConfigKey.teaNoRequestCompleted,
        config_value: JSON.stringify(map),
        updated_at: now,
      },
      update: {
        config_value: JSON.stringify(map),
        updated_at: now,
      },
    });
  }

  private buildTeaNoRequestKey(date: string, venueName: string) {
    return `${date}-${venueName}`;
  }

  private buildTeaDisplayVenuesFromRows(rows: TeaDisplayBookingRow[]) {
    const map = new Map<string, { id: string; name: string; nameZh: string }>();
    for (const row of rows) {
      const id = row.venueId != null ? row.venueId.toString() : '';
      const nameZh = row.venue?.nameZh || row.venue?.name || '';
      if (!id && !nameZh) continue;
      const key = id || nameZh;
      if (map.has(key)) continue;
      map.set(key, {
        id,
        name: row.venue?.name ?? '',
        nameZh,
      });
    }
    return [...map.values()].sort((a, b) => {
      const idA = a.id;
      const idB = b.id;
      if (/^\d+$/.test(idA) && /^\d+$/.test(idB)) {
        const diff = BigInt(idA) - BigInt(idB);
        if (diff < 0n) return -1;
        if (diff > 0n) return 1;
        return 0;
      }
      return (a.nameZh || a.name).localeCompare(b.nameZh || b.name, 'zh-Hant');
    });
  }

  async getPublicTeaServiceDisplay(fromDateYmd?: string) {
    const { fromDate, dates, bookingDates } =
      await this.resolveTeaDisplayDates(fromDateYmd);

    // ??????????/?????????????
    // ???????? Tea Service ? venue ????
    const displayVenues = await this.prisma.venues.findMany({
      where: {
        teaServiceAvailable: true,
        status: { equals: 'active', mode: 'insensitive' },
      },
      orderBy: { id: 'asc' },
      select: { id: true, name: true, nameZh: true },
    });

    const rows = await this.prisma.venueBookings.findMany({
      where: {
        bookingType: 'venue',
        venue: { teaServiceAvailable: true },
        OR: [
          { approvalStatus: { equals: 'pending', mode: 'insensitive' } },
          { approvalStatus: { equals: 'approved', mode: 'insensitive' } },
        ],
        status: { notIn: ['canceled', 'cancelled'] },
        bookingDate: { in: bookingDates },
      },
      include: teaDisplayBookingInclude,
      orderBy: [
        { bookingDate: 'asc' },
        { startTime: 'asc' },
        { id: 'asc' },
      ],
    });

    const requests = rows.map((row) => this.mapTeaDisplayRequestRow(row));

    return {
      fromDate,
      dates,
      venues: displayVenues.map((v) => ({
        id: v.id.toString(),
        name: v.name ?? '',
        nameZh: v.nameZh || v.name || '',
      })),
      requests,
    };
  }

  async setPublicTeaServiceCompleted(bookingIdRaw: string, completed: boolean) {
    const bookingId = BigInt(bookingIdRaw);
    const row = await this.prisma.venueBookings.findUnique({
      where: { id: bookingId },
      include: teaDisplayBookingInclude,
    });
    if (!row) {
      throw new NotFoundException('Tea service request not found');
    }
    const todayYmd = getAppTodayYmd();
    const bookingDateYmd = this.formatTeaDisplayDate(row.bookingDate);
    if (bookingDateYmd !== todayYmd) {
      throw new BadRequestException(
        'Only today\'s tea service tasks can be marked complete',
      );
    }
    if (String(row.approvalStatus || '').toLowerCase() === 'rejected') {
      throw new BadRequestException('Rejected bookings cannot be updated on the tea display');
    }
    if (!row.venueTeaService) {
      const attendees = row.attendees ?? 1;
      const teaService = buildVenueTeaServiceJson({
        teaServiceRequired: Boolean(row.teaServiceRequired),
        attendees,
      });
      await this.prisma.venueTeaService.create({
        data: {
          venueBookingId: bookingId,
          teaService,
          completed,
        },
      });
    } else {
      await this.prisma.venueTeaService.update({
        where: { venueBookingId: bookingId },
        data: { completed },
      });
    }

    const refreshed = await this.prisma.venueBookings.findUnique({
      where: { id: bookingId },
      include: teaDisplayBookingInclude,
    });
    if (!refreshed?.venueTeaService) {
      throw new NotFoundException('Tea service request not found');
    }

    return {
      request: this.mapTeaDisplayRequestRow(refreshed),
    };
  }

  async setPublicTeaNoRequestCompleted(
    date: string,
    venueName: string,
    completed: boolean,
  ) {
    const dateKey = this.resolveTeaDisplayFromDate(date);
    const venueNameZh = String(venueName || '').trim();
    if (!venueNameZh) {
      throw new BadRequestException('venueName is required');
    }

    const map = await this.loadTeaNoRequestCompletedMap();
    const key = this.buildTeaNoRequestKey(dateKey, venueNameZh);
    if (completed) {
      map[key] = true;
    } else {
      delete map[key];
    }
    await this.saveTeaNoRequestCompletedMap(map);

    return {
      date: dateKey,
      venueName: venueNameZh,
      completed,
      noRequestCompleted: map,
    };
  }

  private resolveVenueDisplayDate(optional?: string) {
    const raw = String(optional ?? '').trim();
    return raw || getAppTodayYmd();
  }

  private normalizeVenueDisplayType(value: string | null | undefined): string {
    const x = String(value ?? '').trim().toLowerCase();
    return x === 'merge' ? 'merge' : 'single';
  }

  private venueDisplayBookingWhere(
    bookingDate: Date,
    venueId?: bigint,
  ): Prisma.VenueBookingsWhereInput {
    return {
      bookingType: 'venue',
      bookingDate,
      status: { notIn: ['canceled', 'cancelled'] },
      OR: [
        { approvalStatus: { equals: 'pending', mode: 'insensitive' } },
        { approvalStatus: { equals: 'approved', mode: 'insensitive' } },
        { approvalStatus: { equals: 'rejected', mode: 'insensitive' } },
      ],
      ...(venueId != null ? { venueId } : {}),
    };
  }

  private resolvePublicVenueDisplayTopic(row: VenueDisplayBookingRow): string {
    const approval = String(row.approvalStatus ?? '')
      .trim()
      .toLowerCase();
    // Pending / rejected: show Reserved on venue display; approved: show meeting title.
    // displayOnHomepage only controls TKOH homepage Upcoming Events upload, not venue display.
    if (approval !== 'approved') {
      return DEFAULT_PUBLIC_VENUE_MEETING_TITLE;
    }
    const title = String(row.meetingTitle ?? '').trim();
    return title || DEFAULT_PUBLIC_VENUE_MEETING_TITLE;
  }

  private mapVenueDisplayEventRow(row: VenueDisplayBookingRow) {
    return {
      id: row.id.toString(),
      bookingId: row.id.toString(),
      venueId: row.venueId != null ? row.venueId.toString() : '',
      startTime: this.formatTimeValue(row.startTime),
      endTime: this.formatTimeValue(row.endTime),
      topic: this.resolvePublicVenueDisplayTopic(row),
      reservedBy: row.reservedBy?.name || '',
      attendees: row.attendees ?? null,
      time: this.formatTeaDisplayTimeRange(row.startTime, row.endTime),
    };
  }

  private mapVenueInfoRow(
    venue: {
      id: bigint;
      name: string;
      nameZh: string | null;
      location: string | null;
      locationZh: string | null;
      displayType: string | null;
    },
    displayNameRaw?: string | null,
  ) {
    return {
      id: venue.id.toString(),
      name: venue.name,
      nameZh: venue.nameZh || '',
      location: venue.location || '',
      locationZh: venue.locationZh || '',
      displayType: this.normalizeVenueDisplayType(venue.displayType),
      /** display_venue_rules.display_name??/??????? venues.name */
      displayName: String(displayNameRaw || '').trim(),
    };
  }

  async getPublicVenueDisplay(venueIdRaw: string, dateYmd?: string) {
    const venueIdText = String(venueIdRaw || '').trim();
    if (!/^\d+$/.test(venueIdText)) {
      throw new BadRequestException('venueId is required');
    }
    const venueId = BigInt(venueIdText);
    const displayDate = this.resolveVenueDisplayDate(dateYmd);
    const bookingDate = this.parseBookingDateYmd(displayDate);

    const venue = await this.prisma.venues.findUnique({
      where: { id: venueId },
      select: {
        id: true,
        name: true,
        nameZh: true,
        location: true,
        locationZh: true,
        displayType: true,
        status: true,
        display_venue_rules: {
          select: { display_name: true },
        },
      },
    });
    if (!venue || String(venue.status || '').toLowerCase() === 'inactive') {
      throw new NotFoundException('Venue not found');
    }

    const rows = await this.prisma.venueBookings.findMany({
      where: this.venueDisplayBookingWhere(bookingDate, venueId),
      include: venueDisplayBookingInclude,
      orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
    });

    return {
      displayDate,
      venue: this.mapVenueInfoRow(
        venue,
        venue.display_venue_rules?.display_name,
      ),
      events: rows.map((row) => this.mapVenueDisplayEventRow(row)),
    };
  }

  async getPublicVenueMergeDisplay(dateYmd?: string) {
    const displayDate = this.resolveVenueDisplayDate(dateYmd);
    const bookingDate = this.parseBookingDateYmd(displayDate);

    const [mergeDisplaySettings, venues, rules, bookingRows] = await Promise.all([
      this.displayManagementService.getMergeDisplayPublicSettings(),
      this.prisma.venues.findMany({
        where: {
          status: { equals: 'active', mode: 'insensitive' },
          displayType: { equals: 'merge', mode: 'insensitive' },
        },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          name: true,
          nameZh: true,
          location: true,
          locationZh: true,
          displayType: true,
        },
      }),
      this.prisma.display_venue_rules.findMany({
        select: {
          venue_id: true,
          display_name: true,
          arrow_direction: true,
        },
      }),
      this.prisma.venueBookings.findMany({
        where: this.venueDisplayBookingWhere(bookingDate),
        include: venueDisplayBookingInclude,
        orderBy: [{ venueId: 'asc' }, { startTime: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const ruleByVenueId = new Map(
      rules.map((rule) => [rule.venue_id.toString(), rule]),
    );
    const bookingsByVenueId = new Map<string, VenueDisplayBookingRow[]>();
    for (const row of bookingRows) {
      const key = row.venueId != null ? row.venueId.toString() : '';
      if (!key) continue;
      if (!bookingsByVenueId.has(key)) bookingsByVenueId.set(key, []);
      bookingsByVenueId.get(key)!.push(row);
    }

    const pmCutoffMinutes = 13 * 60;
    const scheduleRows = venues.map((venue, idx) => {
      const id = venue.id.toString();
      const rule = ruleByVenueId.get(id);
      const displayName =
        (rule?.display_name && String(rule.display_name).trim()) || `CR${idx + 1}`;
      const arrowDirection = rule?.arrow_direction || 'right';
      const venueMeetings = (bookingsByVenueId.get(id) || []).map((row) => {
        const event = this.mapVenueDisplayEventRow(row);
        const startMinutes = this.timeToMinutes(row.startTime);
        return {
          id: event.id,
          startMinutes,
          time: event.time,
          title: event.topic,
        };
      });

      return {
        id,
        room: displayName,
        arrowDirection,
        am: venueMeetings.filter(
          (item) => (item.startMinutes ?? 9999) < pmCutoffMinutes,
        ),
        pm: venueMeetings.filter(
          (item) => (item.startMinutes ?? 0) >= pmCutoffMinutes,
        ),
      };
    });

    return {
      displayDate,
      mergeDisplaySettings,
      scheduleRows,
    };
  }

  async saveVenueImage(id: string, filename: string) {
    const venueId = BigInt(id);
    const venue = await this.prisma.venues.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException('Venue not found');

    const newPath = `${this.uploadsBasePath}${filename}`;
    const updated = await this.prisma.venues.update({
      where: { id: venueId },
      data: { imageUrl: newPath },
    });

    await this.unlinkVenueUploadFile(venue.imageUrl);

    return {
      id: updated.id.toString(),
      image: updated.imageUrl || '',
    };
  }
}

