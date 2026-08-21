import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApproveBookingDto } from './dto/approve-booking.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';

const bookingInclude = {
  venue: { select: { id: true, name: true, color: true, userDefinedUploadEventTitle: true } },
  reservedBy: {
    select: {
      id: true,
      corpId: true,
      name: true,
      email: true,
      contact: true,
      department: { select: { department_name: true } },
    },
  },
  handler: { select: { id: true, name: true } },
  venueTeaService: { select: { teaService: true } },
} satisfies Prisma.VenueBookingsInclude;

type BookingRow = Prisma.VenueBookingsGetPayload<{ include: typeof bookingInclude }>;

@Injectable()
export class MeetingApprovalService {
  constructor(private readonly prisma: PrismaService) {}

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

  /** �?booking_date（UTC 日期）比较：早于今日视为审批超时未处�?*/
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

  /** 待审批且未超过预约日（含当日�?*/
  private pendingNotExpiredWhere(): Prisma.VenueBookingsWhereInput {
    const today = this.getUtcTodayDate();
    return {
      ...this.pendingBaseWhere(),
      OR: [{ bookingDate: null }, { bookingDate: { gte: today } }],
    };
  }

  /** 待审批且预约日已过（仍未 Handle�?*/
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
    const handlerName = row.handler?.name ?? null;
    const handledAtText = this.formatDateTime(row.handledAt);
    const teaService = this.mapTeaService(row);

    const base = {
      id: row.id.toString(),
      bookingId: this.buildBookingId(row.id),
      venueId: row.venueId != null ? Number(row.venueId) : null,
      venueName: row.venue?.name ?? '',
      bookerCorpId: row.reservedBy?.corpId ?? '',
      userName: row.reservedBy?.name ?? '',
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

  /** Pending Approval：未超过 booking date 的待审批 */
  async listPending() {
    const rows = await this.prisma.venueBookings.findMany({
      where: this.pendingNotExpiredWhere(),
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      include: bookingInclude,
    });
    return rows.map((row) => this.mapBookingRow(row, 'pending'));
  }

  /** Expired：已超过 booking date 仍未 Handle 的待审批 */
  async listPendingExpired() {
    const rows = await this.prisma.venueBookings.findMany({
      where: this.pendingExpiredWhere(),
      orderBy: [{ bookingDate: 'asc' }, { submittedAt: 'desc' }, { id: 'desc' }],
      include: bookingInclude,
    });
    return rows.map((row) => this.mapBookingRow(row, 'pending'));
  }

  /** Admin 角标：仅统计未过期的待审批会�?*/
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

    return this.mapBookingRow(updated, 'approved');
  }

  async rejectBooking(id: string, dto: RejectBookingDto, handlerSub: unknown) {
    const row = await this.findBookingOrThrow(id);
    const current = this.normalizeApprovalStatus(row.approvalStatus);
    if (current !== 'pending') {
      throw new BadRequestException('Only pending bookings can be rejected');
    }

    const reason = (dto.reason ?? dto.rejectReason ?? '').trim();
    if (!reason) {
      throw new BadRequestException('Reject reason is required');
    }

    const handlerId = this.parseHandlerId(handlerSub);
    const meetingTitle = dto.meetingTitle?.trim();
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

    return this.mapBookingRow(updated, 'rejected');
  }
}
