import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApproveBookingDto } from './dto/approve-booking.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';
import {
  formatUserDisplayName,
  userDisplayNameSelect,
} from '../common/user-display-name';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { DisplayEventsService } from '../display-events/display-events.service';

const bookingInclude = {
  venue: { select: { id: true, name: true, color: true, userDefinedUploadEventTitle: true } },
  reservedBy: {
    select: {
      id: true,
      corpId: true,
      ...userDisplayNameSelect,
      email: true,
      contact: true,
      department: { select: { department_name: true } },
    },
  },
  handler: { select: { id: true, ...userDisplayNameSelect } },
  venueTeaService: { select: { teaService: true } },
} satisfies Prisma.VenueBookingsInclude;

type BookingRow = Prisma.VenueBookingsGetPayload<{ include: typeof bookingInclude }>;

@Injectable()
export class MeetingApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly displayEvents: DisplayEventsService,
  ) {}

  private parseHandlerId(authSub: unknown): bigint {
    const raw = String(authSub ?? '').trim();
    if (!/^\d+$/.test(raw)) {
      throw new BadRequestException('Invalid handler user id');
    }
    return BigInt(raw);
  }

  private normalizeApprovalStatus(status?: string | null): string {
    return String(status ?? '')
      .trim()
      .toLowerCase();
  }

  /** ä¸?booking_dateï¼UTC æ¥æï¼æ¯è¾ï¼æ©äºä»æ¥è§ä¸ºå®¡æ¹è¶
æ¶æªå¤ç?*/
  private getUtcTodayDate(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  private pendingBaseWhere(): Prisma.VenueBookingsWhereInput {
    return {
      bookingType: 'venue',
      approvalStatus: { equals: 'pending', mode: 'insensitive' },
    };
  }

  /** å¾
å®¡æ¹ä¸æªè¶
è¿é¢çº¦æ¥ï¼å«å½æ¥ï¼?*/
  private pendingNotExpiredWhere(): Prisma.VenueBookingsWhereInput {
    const today = this.getUtcTodayDate();
    return {
      ...this.pendingBaseWhere(),
      OR: [{ bookingDate: null }, { bookingDate: { gte: today } }],
    };
  }

  /** å¾
å®¡æ¹ä¸é¢çº¦æ¥å·²è¿ï¼ä»æª Handleï¼?*/
  private pendingExpiredWhere(): Prisma.VenueBookingsWhereInput {
    return {
      ...this.pendingBaseWhere(),
      bookingDate: { lt: this.getUtcTodayDate() },
    };
  }

  private formatBookingDate(value: Date | null | undefined): string {
    if (!value) return '';
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private formatTimeValue(value: Date | null | undefined): string {
    if (!value) return '';
    const h = String(value.getUTCHours()).padStart(2, '0');
    const m = String(value.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  private formatTimeRange(
    start: Date | null | undefined,
    end: Date | null | undefined,
  ): string {
    const startText = this.formatTimeValue(start);
    const endText = this.formatTimeValue(end);
    if (!startText && !endText) return '';
    if (!endText) return startText;
    return `${startText}-${endText}`;
  }

  private formatDateTime(value: Date | null | undefined): string {
    if (!value) return '';
    const y = value.getFullYear();
    const mo = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    const h = String(value.getHours()).padStart(2, '0');
    const mi = String(value.getMinutes()).padStart(2, '0');
    return `${y}-${mo}-${d} ${h}:${mi}`;
  }

  private buildBookingId(id: bigint): string {
    return `VB${id.toString().padStart(9, '0')}`;
  }

  private mapTeaService(row: BookingRow) {
    if (!row.venueTeaService?.teaService) return undefined;
    const raw = row.venueTeaService.teaService;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
    return undefined;
  }

  private mapBookingRow(row: BookingRow, approvalStatus: string) {
    const status = this.normalizeApprovalStatus(approvalStatus);
    const handlerName = formatUserDisplayName(row.handler) || null;
    const handledAtText = this.formatDateTime(row.handledAt);
    const teaService = this.mapTeaService(row);

    const base = {
      id: row.id.toString(),
      bookingId: this.buildBookingId(row.id),
      venueId: row.venueId != null ? Number(row.venueId) : null,
      venueName: row.venue?.name ?? '',
      bookerCorpId: row.reservedBy?.corpId ?? '',
      userName: formatUserDisplayName(row.reservedBy),
      department: row.reservedBy?.department?.department_name ?? '',
      contactPhone: row.reservedBy?.contact ?? '',
      contactEmail: row.reservedBy?.email ?? '',
      meetingTitle: row.meetingTitle ?? '',
      date: this.formatBookingDate(row.bookingDate),
      time: this.formatTimeRange(row.startTime, row.endTime),
      attendees: row.attendees ?? null,
      attendeeCount: row.attendees ?? null,
      participants: row.attendees ?? null,
      teaServiceRequired: row.teaServiceRequired,
      displayOnHomepage: row.displayOnHomepage !== false,
      userDefinedUploadEventTitle: row.venue?.userDefinedUploadEventTitle !== false,
      teaService,
      submittedAt: this.formatDateTime(row.submittedAt ?? row.createdAt),
      approvalStatus: status,
    };

    if (status === 'approved') {
      return {
        ...base,
        approvedAt: handledAtText,
        approvedBy: handlerName ?? 'Admin',
      };
    }

    if (status === 'rejected') {
      return {
        ...base,
        rejectedAt: handledAtText,
        rejectedBy: handlerName ?? 'Admin',
        reason: row.rejectReason ?? '',
      };
    }

    return base;
  }

  private async findBookingOrThrow(id: string): Promise<BookingRow> {
    if (!/^\d+$/.test(String(id).trim())) {
      throw new BadRequestException('Invalid booking id');
    }
    const row = await this.prisma.venueBookings.findUnique({
      where: { id: BigInt(id) },
      include: bookingInclude,
    });
    if (!row) {
      throw new NotFoundException('Booking not found');
    }
    return row;
  }

  async listByApprovalStatus(status: 'pending' | 'approved' | 'rejected') {
    const rows = await this.prisma.venueBookings.findMany({
      where: {
        bookingType: 'venue',
        approvalStatus: { equals: status, mode: 'insensitive' },
      },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      include: bookingInclude,
    });
    return rows.map((row) => this.mapBookingRow(row, status));
  }

  /** Pending Approvalï¼æªè¶
è¿ booking date çå¾
å®¡æ¹ */
  async listPending() {
    const rows = await this.prisma.venueBookings.findMany({
      where: this.pendingNotExpiredWhere(),
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      include: bookingInclude,
    });
    return rows.map((row) => this.mapBookingRow(row, 'pending'));
  }

  /** Expiredï¼å·²è¶
è¿ booking date ä»æª Handle çå¾
å®¡æ¹ */
  async listPendingExpired() {
    const rows = await this.prisma.venueBookings.findMany({
      where: this.pendingExpiredWhere(),
      orderBy: [{ bookingDate: 'asc' }, { submittedAt: 'desc' }, { id: 'desc' }],
      include: bookingInclude,
    });
    return rows.map((row) => this.mapBookingRow(row, 'pending'));
  }

  /** Admin è§æ ï¼ä»
ç»è®¡æªè¿æçå¾
å®¡æ¹ä¼è®?*/
  async countPendingNotExpired(): Promise<number> {
    return this.prisma.venueBookings.count({
      where: this.pendingNotExpiredWhere(),
    });
  }

  async approveBooking(id: string, dto: ApproveBookingDto, handlerSub: unknown) {
    const row = await this.findBookingOrThrow(id);
    const current = this.normalizeApprovalStatus(row.approvalStatus);
    if (current !== 'pending') {
      throw new BadRequestException('Only pending bookings can be approved');
    }

    const handlerId = this.parseHandlerId(handlerSub);
    const meetingTitle = dto.meetingTitle?.trim();
    await this.systemSettingsService.assertMeetingEventTitleLength(meetingTitle);
    const updated = await this.prisma.venueBookings.update({
      where: { id: row.id },
      data: {
        approvalStatus: 'approved',
        status: row.status ?? 'upcoming',
        handleByUserId: handlerId,
        handledAt: new Date(),
        ...(meetingTitle ? { meetingTitle } : {}),
        ...(dto.displayOnHomepage !== undefined
          ? { displayOnHomepage: Boolean(dto.displayOnHomepage) }
          : {}),
      },
      include: bookingInclude,
    });

    this.displayEvents.notify(
      ['venue', 'venue-merge', 'tea'],
      'meeting-approval-approve',
    );
    return this.mapBookingRow(updated, 'approved');
  }

  async rejectBooking(id: string, dto: RejectBookingDto, handlerSub: unknown) {
    const row = await this.findBookingOrThrow(id);
    const current = this.normalizeApprovalStatus(row.approvalStatus);
    if (current !== 'pending') {
      throw new BadRequestException('Only pending bookings can be rejected');
    }

    const reason = (dto.reason ?? dto.rejectReason ?? '').trim();
    const meetingTitle = dto.meetingTitle?.trim();
    await this.systemSettingsService.assertMeetingEventTitleLength(meetingTitle);
    if (!reason) {
      throw new BadRequestException('Reject reason is required');
    }

    const handlerId = this.parseHandlerId(handlerSub);
    const updated = await this.prisma.venueBookings.update({
      where: { id: row.id },
      data: {
        approvalStatus: 'rejected',
        rejectReason: reason,
        handleByUserId: handlerId,
        handledAt: new Date(),
        ...(meetingTitle ? { meetingTitle } : {}),
        ...(dto.displayOnHomepage !== undefined
          ? { displayOnHomepage: Boolean(dto.displayOnHomepage) }
          : {}),
      },
      include: bookingInclude,
    });

    this.displayEvents.notify(
      ['venue', 'venue-merge', 'tea'],
      'meeting-approval-reject',
    );
    return this.mapBookingRow(updated, 'rejected');
  }
}
