import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApproveBookingDto } from './dto/approve-booking.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';
import { MeetingApprovalListQuery } from './dto/list-bookings-query.dto';
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

const filterOptionSelect = {
  venue: { select: { name: true } },
  reservedBy: {
    select: {
      corpId: true,
      ...userDisplayNameSelect,
    },
  },
} satisfies Prisma.VenueBookingsSelect;

type BookingRow = Prisma.VenueBookingsGetPayload<{ include: typeof bookingInclude }>;

const MAX_PAGE_SIZE = 100;
const MAX_EXPORT_SIZE = 5000;
const SORTABLE_FIELDS = new Set([
  'venueName',
  'date',
  'time',
  'submittedAt',
  'reservedBy',
  'approvedAt',
  'approvedBy',
  'rejectedAt',
  'rejectedBy',
]);

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
      // 审批前已取消：只改 status，不改 approvalStatus；Pending/Expired/角标都应排除
      NOT: {
        OR: [
          { status: { equals: 'cancelled', mode: 'insensitive' } },
          { status: { equals: 'canceled', mode: 'insensitive' } },
        ],
      },
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
      myNote: row.notes ?? '',
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

  private parsePositiveInt(value: unknown, fallback: number): number {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.floor(n);
  }

  private isTruthyFlag(value: unknown): boolean {
    if (value === true || value === 1) return true;
    const text = String(value ?? '').trim().toLowerCase();
    return text === '1' || text === 'true' || text === 'yes';
  }

  private parseCsv(value?: string): string[] {
    return String(value ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }

  private parseYmdToUtcDate(ymd?: string): Date | null {
    const match = String(ymd ?? '')
      .trim()
      .match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!year || !month || !day) return null;
    return new Date(Date.UTC(year, month - 1, day));
  }

  private formatReservedByLabel(
    user:
      | {
          corpId?: string | null;
          firstName?: string | null;
          lastName?: string | null;
          name?: string | null;
        }
      | null
      | undefined,
  ): string {
    const name = formatUserDisplayName(user);
    const corpId = String(user?.corpId ?? '').trim();
    if (corpId) return name ? `${name} (${corpId})` : corpId;
    return name || '';
  }

  private buildKeywordWhere(q?: string): Prisma.VenueBookingsWhereInput | undefined {
    const keyword = String(q ?? '').trim();
    if (!keyword) return undefined;

    const bookingIdMatch = keyword.match(/^VB0*(\d+)$/i);
    if (bookingIdMatch) {
      return { id: BigInt(bookingIdMatch[1]) };
    }

    const or: Prisma.VenueBookingsWhereInput[] = [
      { meetingTitle: { contains: keyword, mode: 'insensitive' } },
      { venue: { is: { name: { contains: keyword, mode: 'insensitive' } } } },
      {
        reservedBy: {
          is: {
            OR: [
              { firstName: { contains: keyword, mode: 'insensitive' } },
              { lastName: { contains: keyword, mode: 'insensitive' } },
              { corpId: { contains: keyword, mode: 'insensitive' } },
              {
                department: {
                  is: { department_name: { contains: keyword, mode: 'insensitive' } },
                },
              },
            ],
          },
        },
      },
      {
        handler: {
          is: {
            OR: [
              { firstName: { contains: keyword, mode: 'insensitive' } },
              { lastName: { contains: keyword, mode: 'insensitive' } },
            ],
          },
        },
      },
    ];

    if (/^\d+$/.test(keyword)) {
      try {
        or.push({ id: BigInt(keyword) });
      } catch {
        // ignore invalid bigint
      }
    }

    return { OR: or };
  }

  private buildDateRangeWhere(
    dateFrom?: string,
    dateTo?: string,
  ): Prisma.VenueBookingsWhereInput | undefined {
    const from = this.parseYmdToUtcDate(dateFrom);
    const to = this.parseYmdToUtcDate(dateTo);
    if (!from && !to) return undefined;

    const bookingDate: Prisma.DateTimeNullableFilter = {};
    if (from) bookingDate.gte = from;
    if (to) bookingDate.lte = to;
    return { bookingDate };
  }

  private buildColumnFilterWhere(
    venueNames?: string,
    reservedByLabels?: string,
  ): Prisma.VenueBookingsWhereInput | undefined {
    const venues = this.parseCsv(venueNames);
    const reservedLabels = this.parseCsv(reservedByLabels);
    const parts: Prisma.VenueBookingsWhereInput[] = [];

    if (venues.length) {
      parts.push({
        venue: { is: { name: { in: venues } } },
      });
    }

    if (reservedLabels.length) {
      const corpIds: string[] = [];
      const nameOnly: string[] = [];
      for (const label of reservedLabels) {
        const match = label.match(/^(.*)\(([^)]+)\)\s*$/);
        if (match) {
          corpIds.push(match[2].trim());
        } else {
          nameOnly.push(label);
        }
      }
      const reservedOr: Prisma.VenueBookingsWhereInput[] = [];
      if (corpIds.length) {
        reservedOr.push({
          reservedBy: { is: { corpId: { in: corpIds } } },
        });
      }
      for (const name of nameOnly) {
        reservedOr.push({
          reservedBy: {
            is: {
              OR: [
                { firstName: { contains: name, mode: 'insensitive' } },
                { lastName: { contains: name, mode: 'insensitive' } },
              ],
            },
          },
        });
      }
      if (reservedOr.length) {
        parts.push({ OR: reservedOr });
      }
    }

    if (!parts.length) return undefined;
    return parts.length === 1 ? parts[0] : { AND: parts };
  }

  private buildListWhere(
    baseWhere: Prisma.VenueBookingsWhereInput,
    query: MeetingApprovalListQuery,
    options?: { applyColumnFilters?: boolean },
  ): Prisma.VenueBookingsWhereInput {
    const and: Prisma.VenueBookingsWhereInput[] = [baseWhere];
    const keywordWhere = this.buildKeywordWhere(query.q);
    if (keywordWhere) and.push(keywordWhere);
    const dateWhere = this.buildDateRangeWhere(query.dateFrom, query.dateTo);
    if (dateWhere) and.push(dateWhere);
    if (options?.applyColumnFilters !== false) {
      const columnWhere = this.buildColumnFilterWhere(
        query.venueNames,
        query.reservedBy,
      );
      if (columnWhere) and.push(columnWhere);
    }
    return and.length === 1 ? and[0] : { AND: and };
  }

  private buildOrderBy(
    query: MeetingApprovalListQuery,
    fallback: Prisma.VenueBookingsOrderByWithRelationInput[],
  ): Prisma.VenueBookingsOrderByWithRelationInput[] {
    const sortBy = String(query.sortBy ?? '').trim();
    const sortOrder =
      String(query.sortOrder ?? '').trim().toLowerCase() === 'asc' ? 'asc' : 'desc';
    if (!SORTABLE_FIELDS.has(sortBy)) {
      return fallback;
    }

    const tieBreaker: Prisma.VenueBookingsOrderByWithRelationInput = { id: 'desc' };
    switch (sortBy) {
      case 'venueName':
        return [{ venue: { name: sortOrder } }, tieBreaker];
      case 'date':
        return [{ bookingDate: sortOrder }, tieBreaker];
      case 'time':
        return [{ startTime: sortOrder }, tieBreaker];
      case 'submittedAt':
        return [{ submittedAt: sortOrder }, tieBreaker];
      case 'reservedBy':
        return [
          { reservedBy: { lastName: sortOrder } },
          { reservedBy: { firstName: sortOrder } },
          { reservedBy: { corpId: sortOrder } },
          tieBreaker,
        ];
      case 'approvedAt':
      case 'rejectedAt':
        return [{ handledAt: sortOrder }, tieBreaker];
      case 'approvedBy':
      case 'rejectedBy':
        return [
          { handler: { lastName: sortOrder } },
          { handler: { firstName: sortOrder } },
          tieBreaker,
        ];
      default:
        return fallback;
    }
  }

  private async buildFilterOptions(where: Prisma.VenueBookingsWhereInput) {
    const rows = await this.prisma.venueBookings.findMany({
      where,
      select: filterOptionSelect,
    });
    const venues = new Set<string>();
    const reservedBy = new Set<string>();
    for (const row of rows) {
      const venueName = String(row.venue?.name ?? '').trim();
      if (venueName) venues.add(venueName);
      const label = this.formatReservedByLabel(row.reservedBy);
      if (label) reservedBy.add(label);
    }
    return {
      venues: [...venues].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
      reservedBy: [...reservedBy].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }),
      ),
    };
  }

  private async listPaginated(
    baseWhere: Prisma.VenueBookingsWhereInput,
    approvalStatus: 'pending' | 'approved' | 'rejected',
    query: MeetingApprovalListQuery = {},
    defaultOrderBy: Prisma.VenueBookingsOrderByWithRelationInput[],
  ) {
    const wantAll = this.isTruthyFlag(query.all);
    const includeOptions = this.isTruthyFlag(query.includeOptions);
    const page = this.parsePositiveInt(query.page, 1);
    const pageSize = Math.min(
      this.parsePositiveInt(query.pageSize, 20),
      wantAll ? MAX_EXPORT_SIZE : MAX_PAGE_SIZE,
    );
    const where = this.buildListWhere(baseWhere, query);
    const orderBy = this.buildOrderBy(query, defaultOrderBy);

    const skip = wantAll ? 0 : (page - 1) * pageSize;
    const take: number = wantAll ? MAX_EXPORT_SIZE : pageSize;

    const [total, rows, filterOptions] = await Promise.all([
      this.prisma.venueBookings.count({ where }),
      this.prisma.venueBookings.findMany({
        where,
        orderBy,
        skip,
        take,
        include: bookingInclude,
      }),
      includeOptions
        ? this.buildFilterOptions(
            this.buildListWhere(baseWhere, query, { applyColumnFilters: false }),
          )
        : Promise.resolve(undefined),
    ]);

    return {
      items: rows.map((row) => this.mapBookingRow(row, approvalStatus)),
      total,
      page: wantAll ? 1 : page,
      pageSize: wantAll ? rows.length : pageSize,
      ...(filterOptions ? { filterOptions } : {}),
    };
  }

  async listByApprovalStatus(
    status: 'pending' | 'approved' | 'rejected',
    query: MeetingApprovalListQuery = {},
  ) {
    return this.listPaginated(
      {
        bookingType: 'venue',
        approvalStatus: { equals: status, mode: 'insensitive' },
      },
      status,
      query,
      [{ submittedAt: 'desc' }, { id: 'desc' }],
    );
  }

  /** Pending Approval: booking date not yet expired */
  async listPending(query: MeetingApprovalListQuery = {}) {
    return this.listPaginated(
      this.pendingNotExpiredWhere(),
      'pending',
      query,
      [{ submittedAt: 'desc' }, { id: 'desc' }],
    );
  }

  /** Expired: booking date already passed, still awaiting Handle */
  async listPendingExpired(query: MeetingApprovalListQuery = {}) {
    return this.listPaginated(
      this.pendingExpiredWhere(),
      'pending',
      query,
      [{ bookingDate: 'asc' }, { submittedAt: 'desc' }, { id: 'desc' }],
    );
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
