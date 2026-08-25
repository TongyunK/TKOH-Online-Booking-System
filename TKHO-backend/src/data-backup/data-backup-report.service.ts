import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import {
  addDaysToYmd,
  APP_TIMEZONE,
  getAppTodayYmd,
} from '../common/app-timezone';
import {
  formatVenueTeaServiceDisplay,
  normalizeVenueTeaService,
} from '../common/venue-tea-service';
import {
  formatUserDisplayName,
  userDisplayNameSelect,
} from '../common/user-display-name';
import { PrismaService } from '../prisma/prisma.service';

export type DataBackupDateRange = {
  startYmd: string;
  endYmd: string;
  timeSpanDays: number;
};

export type DataBackupWorkbookResult = {
  buffer: Buffer;
  fileName: string;
  summary: {
    venueBookings: number;
    evBookings: number;
    users: number;
    pendingUsers: number;
    venues: number;
    licensePlates: number;
  };
};

const venueBookingInclude = {
  venue: { select: { name: true } },
  reservedBy: {
    select: {
      corpId: true,
      ...userDisplayNameSelect,
      email: true,
      contact: true,
      department: { select: { department_name: true } },
    },
  },
  submitter: { select: userDisplayNameSelect },
  cancelledBy: { select: userDisplayNameSelect },
  handler: { select: userDisplayNameSelect },
  venueTeaService: { select: { teaService: true } },
} satisfies Prisma.VenueBookingsInclude;

type VenueBookingRow = Prisma.VenueBookingsGetPayload<{
  include: typeof venueBookingInclude;
}>;

@Injectable()
export class DataBackupReportService {
  constructor(private readonly prisma: PrismaService) {}

  resolveDateRange(timeSpanDays: number): DataBackupDateRange {
    const span =
      Number.isFinite(timeSpanDays) && timeSpanDays >= 1
        ? Math.floor(timeSpanDays)
        : 14;
    const startYmd = getAppTodayYmd();
    const endYmd = addDaysToYmd(startYmd, span - 1);
    return { startYmd, endYmd, timeSpanDays: span };
  }

  async buildWorkbook(
    timeSpanDays: number,
  ): Promise<DataBackupWorkbookResult> {
    const range = this.resolveDateRange(timeSpanDays);
    const startDate = this.parseDateOnlyYmd(range.startYmd);
    const endDate = this.parseDateOnlyYmd(range.endYmd);

    const [
      venueBookings,
      evBookings,
      users,
      pendingUsers,
      venues,
      licensePlates,
    ] = await Promise.all([
      this.loadVenueBookings(startDate, endDate),
      this.loadEvBookings(startDate, endDate),
      this.loadUsers(),
      this.loadPendingUsers(),
      this.loadVenues(),
      this.loadLicensePlates(),
    ]);

    const generatedAt = this.formatDateTimeHkt(new Date());
    const summaryRows = [
      { Field: 'Generated at (HKT)', Value: generatedAt },
      { Field: 'Timezone', Value: APP_TIMEZONE },
      { Field: 'Booking date range', Value: `${range.startYmd} to ${range.endYmd}` },
      { Field: 'Time span (days)', Value: String(range.timeSpanDays) },
      { Field: 'Venue bookings', Value: String(venueBookings.length) },
      { Field: 'EV bookings', Value: String(evBookings.length) },
      { Field: 'Users', Value: String(users.length) },
      { Field: 'Pending users', Value: String(pendingUsers.length) },
      { Field: 'Venues', Value: String(venues.length) },
      { Field: 'License plates', Value: String(licensePlates.length) },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(summaryRows),
      'Summary',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(venueBookings),
      'Venue Bookings',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(evBookings),
      'EV Bookings',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(users),
      'Users',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(pendingUsers),
      'Pending Users',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(venues),
      'Venues',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(licensePlates),
      'License Plates',
    );

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const fileName = `TKOH_Data_Backup_${range.startYmd}_to_${range.endYmd}.xlsx`;

    return {
      buffer,
      fileName,
      summary: {
        venueBookings: venueBookings.length,
        evBookings: evBookings.length,
        users: users.length,
        pendingUsers: pendingUsers.length,
        venues: venues.length,
        licensePlates: licensePlates.length,
      },
    };
  }

  private parseDateOnlyYmd(ymd: string): Date {
    return new Date(`${ymd}T00:00:00.000Z`);
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

  private formatDateTimeHkt(value: Date | null | undefined): string {
    if (!value) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .format(value)
      .replace(',', '');
  }

  private formatStatus(value: string | null | undefined): string {
    const text = String(value ?? '').trim();
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }

  private formatTeaServiceStatus(row: VenueBookingRow): string {
    if (!row.teaServiceRequired) return 'No';
    const tea = normalizeVenueTeaService(row.venueTeaService?.teaService);
    return formatVenueTeaServiceDisplay(tea, row.attendees);
  }

  private formatTeaSpecialRequest(row: VenueBookingRow): string {
    const tea = normalizeVenueTeaService(row.venueTeaService?.teaService);
    return String(tea?.specialRequest ?? tea?.notes ?? '').trim();
  }

  private async loadVenueBookings(startDate: Date, endDate: Date) {
    const rows = await this.prisma.venueBookings.findMany({
      where: {
        bookingType: 'venue',
        bookingDate: { gte: startDate, lte: endDate },
      },
      include: venueBookingInclude,
      orderBy: [{ bookingDate: 'asc' }, { startTime: 'asc' }, { id: 'asc' }],
    });

    return rows.map((row, index) => ({
      '#': index + 1,
      'Booking ID': row.id.toString(),
      Date: this.formatBookingDate(row.bookingDate),
      Time: this.formatTimeRange(row.startTime, row.endTime),
      Venue: row.venue?.name ?? '',
      'Meeting / Event': row.meetingTitle ?? '',
      'Reserved By': formatUserDisplayName(row.reservedBy),
      'Department / Unit': row.reservedBy?.department?.department_name ?? '',
      'No. of participants': row.attendees ?? '',
      'Contact No.': row.reservedBy?.contact ?? '',
      Email: row.reservedBy?.email ?? '',
      Status: this.formatStatus(row.status),
      Approval: this.formatStatus(row.approvalStatus || 'pending'),
      'Tea Service': this.formatTeaServiceStatus(row),
      'Tea Special Requests': this.formatTeaSpecialRequest(row),
      'Display on Homepage': row.displayOnHomepage === false ? 'No' : 'Yes',
      'Submitted By': formatUserDisplayName(row.submitter),
      'Application Date': this.formatDateTimeHkt(row.submittedAt ?? row.createdAt),
      'Cancelled by': formatUserDisplayName(row.cancelledBy),
      'Cancelled At': this.formatDateTimeHkt(row.cancelledAt),
      'Reject Reason': row.rejectReason ?? '',
      'Handled By': formatUserDisplayName(row.handler),
      'Handled At': this.formatDateTimeHkt(row.handledAt),
    }));
  }

  private async loadEvBookings(startDate: Date, endDate: Date) {
    const rows = await this.prisma.evBookings.findMany({
      where: { bookingDate: { gte: startDate, lte: endDate } },
      include: {
        licensePlate: { select: { plate_number: true, user_id: true } },
        slot: { select: { evSpace: true } },
        period: { select: { period: true, startTime: true, endTime: true } },
      },
      orderBy: [{ bookingDate: 'asc' }, { id: 'asc' }],
    });

    const owners = await this.resolveEvBookingOwners(rows);

    return rows.map((row, index) => {
      const plateUserId = row.licensePlate?.user_id ?? null;
      const owner =
        (plateUserId != null ? owners.byId.get(plateUserId) : undefined) ??
        (row.userCorpId ? owners.byCorp.get(row.userCorpId) : undefined);
      const submitter =
        row.submitterUserId != null
          ? owners.byId.get(row.submitterUserId)
          : undefined;

      return {
        '#': index + 1,
        'Booking ID': row.id.toString(),
        'Booking Date': this.formatBookingDate(row.bookingDate),
        'Booking Time': this.formatPeriodTime(row.period),
        'License Plate': row.licensePlate?.plate_number ?? '',
        'EV Space': row.slot.evSpace,
        'Reserved By': owner ? formatUserDisplayName(owner) : '',
        Status: this.formatStatus(row.status),
        'Submitted By': submitter ? formatUserDisplayName(submitter) : '',
        'Application Date': this.formatDateTimeHkt(
          row.bookedOn ?? row.createdAt,
        ),
      };
    });
  }

  private formatPeriodTime(
    period: {
      period: string;
      startTime: Date;
      endTime: Date;
    } | null,
  ): string {
    if (!period) return '';
    const label = String(period.period ?? '').trim();
    if (label) return label;
    const start = this.formatTimeValue(period.startTime);
    const end = this.formatTimeValue(period.endTime);
    if (start && end) return `${start}-${end}`;
    return start || end;
  }

  private async resolveEvBookingOwners(
    rows: Array<{
      submitterUserId: bigint | null;
      userCorpId: string | null;
      licensePlate: { user_id: bigint | null } | null;
    }>,
  ) {
    const userIds = new Set<bigint>();
    const corpIds = new Set<string>();
    for (const row of rows) {
      if (row.submitterUserId != null) userIds.add(row.submitterUserId);
      if (row.licensePlate?.user_id != null) {
        userIds.add(row.licensePlate.user_id);
      }
      if (row.userCorpId) corpIds.add(row.userCorpId);
    }

    if (!userIds.size && !corpIds.size) {
      return {
        byId: new Map<
          bigint,
          {
            id: bigint;
            corpId: string;
            firstName: string;
            lastName: string;
          }
        >(),
        byCorp: new Map<
          string,
          {
            id: bigint;
            corpId: string;
            firstName: string;
            lastName: string;
          }
        >(),
      };
    }

    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          userIds.size ? { id: { in: [...userIds] } } : undefined,
          corpIds.size ? { corpId: { in: [...corpIds] } } : undefined,
        ].filter(Boolean) as Prisma.UserWhereInput[],
      },
      select: { id: true, corpId: true, ...userDisplayNameSelect },
    });

    const byId = new Map(users.map((user) => [user.id, user]));
    const byCorp = new Map(users.map((user) => [user.corpId, user]));
    return { byId, byCorp };
  }

  private async loadUsers() {
    const rows = await this.prisma.user.findMany({
      where: { isSystemHidden: false },
      include: {
        access_roles: { select: { role_name: true } },
        department: { select: { department_name: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
    });

    return rows.map((row) => ({
      'CORP User ID': row.corpId,
      'Employee No.': row.employeeNo ?? '',
      'First Name': row.firstName ?? '',
      'Last Name': row.lastName ?? '',
      'Department / Unit': row.department?.department_name ?? '',
      Rank: row.rank ?? '',
      Email: row.email ?? '',
      'Contact No.': row.contact ?? '',
      Role: row.access_roles?.role_name ?? '',
      'EV Quota':
        row.annualQuotaEv === -1 ? 'Unlimited' : String(row.annualQuotaEv ?? 0),
      'Used Quota (EV)': String(row.usedQuotaEv ?? 0),
      'Venue Quota':
        row.annualQuotaVenue === -1
          ? 'Unlimited'
          : String(row.annualQuotaVenue ?? 0),
      'Used Quota (Venue)': String(row.usedQuotaVenue ?? 0),
      Status: this.formatStatus(row.status),
      'Last login time': this.formatDateTimeHkt(row.lastLoginTime),
      'Inactive Time': this.formatDateTimeHkt(row.inactiveTime),
      'Inactived By': row.inactivedBy ?? '',
    }));
  }

  private async loadPendingUsers() {
    const rows = await this.prisma.pending_users.findMany({
      include: {
        departments: { select: { department_name: true } },
        access_roles: { select: { role_name: true } },
        approver: { select: userDisplayNameSelect },
      },
      orderBy: [{ submitted_at: 'desc' }, { id: 'desc' }],
    });

    return rows.map((row) => ({
      'CORP User ID': row.corp_id,
      'Employee No.': row.employee_no ?? '',
      'First Name': row.first_name ?? '',
      'Last Name': row.last_name ?? '',
      'Department / Unit': row.departments?.department_name ?? '',
      Rank: row.rank ?? '',
      Email: row.email ?? '',
      'Contact No.': row.contact_no ?? '',
      Role: row.access_roles?.role_name ?? '',
      'Car Plate No.': row.car_plate_no ?? '',
      Reason: row.reason ?? '',
      'Approval Status': this.formatStatus(row.approval_status),
      'Submitted At': this.formatDateTimeHkt(row.submitted_at),
      'Handled At': this.formatDateTimeHkt(row.handled_at),
      Approver: formatUserDisplayName(row.approver) || row.approver_name || '',
      'Reject Reason': row.reject_reason ?? '',
    }));
  }

  private async loadVenues() {
    const rows = await this.prisma.venues.findMany({
      orderBy: [{ name: 'asc' }],
    });

    return rows.map((row) => ({
      ID: row.id.toString(),
      Name: row.name,
      'Name (ZH)': row.nameZh ?? '',
      Tab: row.tab ?? '',
      'Venue Type': row.venueType ?? '',
      Location: row.location ?? '',
      'Location (ZH)': row.locationZh ?? '',
      Status: this.formatStatus(row.status),
      'Room Capacity': row.roomCapacity ?? '',
      'Tea Service Available': row.teaServiceAvailable ? 'Yes' : 'No',
      'Daily Booking Start': row.dailyBookingStartTime ?? '',
      'Daily Booking End': row.dailyBookingEndTime ?? '',
    }));
  }

  private async loadLicensePlates() {
    const rows = await this.prisma.license_plates.findMany({
      orderBy: [{ plate_number: 'asc' }],
    });

    const userIds = rows
      .map((row) => row.user_id)
      .filter((id): id is bigint => id != null);
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, corpId: true, ...userDisplayNameSelect },
          })
        : [];
    const userById = new Map(users.map((user) => [user.id, user]));

    return rows.map((row) => {
      const owner = row.user_id != null ? userById.get(row.user_id) : undefined;
      return {
        ID: row.id.toString(),
        'Plate Number': row.plate_number,
        Owner: owner ? formatUserDisplayName(owner) : '',
        'CORP User ID': owner?.corpId ?? '',
        'Is Default': row.is_default ? 'Yes' : 'No',
        Status: this.formatStatus(row.status),
        'Created At': this.formatDateTimeHkt(row.created_at),
      };
    });
  }
}
