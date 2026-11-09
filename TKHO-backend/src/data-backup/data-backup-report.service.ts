import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import {
  addDaysToYmd,
  APP_TIMEZONE,
  getAppCalendarYear,
  getAppTodayYmd,
} from '../common/app-timezone';
import {
  formatVenueTeaServiceDisplay,
  normalizeVenueTeaService,
  VenueTeaServicePayload,
} from '../common/venue-tea-service';
import {
  formatUserDisplayName,
  userDisplayNameSelect,
} from '../common/user-display-name';
import {
  batchCountUsedForYear,
  batchLoadYearlyOverrides,
} from '../common/user-quota';
import { isSuperAdminRole } from '../auth/super-admin.util';
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
    venueBlocks: number;
    licensePlates: number;
    evParkingSlots: number;
    evTimePeriods: number;
    departments: number;
    accessRoles: number;
    bookingWindows: number;
    prompts: number;
    systemSettings: number;
    displayConfigSettings: number;
  };
};

const venueBookingInclude = {
  venue: {
    select: {
      name: true,
    },
  },
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
  submitter: {
    select: {
      id: true,
      corpId: true,
      ...userDisplayNameSelect,
    },
  },
  cancelledBy: {
    select: {
      id: true,
      corpId: true,
      ...userDisplayNameSelect,
    },
  },
  handler: {
    select: {
      id: true,
      corpId: true,
      ...userDisplayNameSelect,
    },
  },
  venueTeaService: {
    select: { teaService: true, completed: true },
  },
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
      venueBlocks,
      licensePlates,
      evParkingSlots,
      evTimePeriods,
      departments,
      accessRoles,
      bookingWindows,
      prompts,
      systemSettings,
      displayConfigSettings,
    ] = await Promise.all([
      this.loadVenueBookings(startDate, endDate),
      this.loadEvBookings(startDate, endDate),
      this.loadUsers(),
      this.loadPendingUsers(),
      this.loadVenues(),
      this.loadVenueBlocks(),
      this.loadLicensePlates(),
      this.loadEvParkingSlots(),
      this.loadEvTimePeriods(),
      this.loadDepartments(),
      this.loadAccessRoles(),
      this.loadBookingWindows(),
      this.loadPrompts(),
      this.loadSystemSettings(),
      this.loadDisplayConfigSettings(),
    ]);

    const generatedAt = this.formatDateTimeHkt(new Date());
    const summaryRows = [
      { Field: 'Generated at (HKT)', Value: generatedAt },
      { Field: 'Timezone', Value: APP_TIMEZONE },
      {
        Field: 'Booking date range',
        Value: `${range.startYmd} to ${range.endYmd}`,
      },
      { Field: 'Time span (days)', Value: String(range.timeSpanDays) },
      { Field: 'Venue bookings', Value: String(venueBookings.length) },
      { Field: 'EV bookings', Value: String(evBookings.length) },
      { Field: 'Users', Value: String(users.length) },
      { Field: 'Pending users', Value: String(pendingUsers.length) },
      { Field: 'Venues', Value: String(venues.length) },
      { Field: 'Venue blocks', Value: String(venueBlocks.length) },
      { Field: 'License plates', Value: String(licensePlates.length) },
      { Field: 'EV parking slots', Value: String(evParkingSlots.length) },
      { Field: 'EV time periods', Value: String(evTimePeriods.length) },
      { Field: 'Departments', Value: String(departments.length) },
      { Field: 'Access roles', Value: String(accessRoles.length) },
      { Field: 'Booking windows', Value: String(bookingWindows.length) },
      { Field: 'Prompts', Value: String(prompts.length) },
      { Field: 'System settings', Value: String(systemSettings.length) },
      {
        Field: 'Display config settings',
        Value: String(displayConfigSettings.length),
      },
    ];

    const sheets: Array<{ name: string; rows: Record<string, unknown>[] }> = [
      { name: 'Summary', rows: summaryRows },
      { name: 'Venue Bookings', rows: venueBookings },
      { name: 'EV Bookings', rows: evBookings },
      { name: 'Users', rows: users },
      { name: 'Pending Users', rows: pendingUsers },
      { name: 'Venues', rows: venues },
      { name: 'Venue Blocks', rows: venueBlocks },
      { name: 'License Plates', rows: licensePlates },
      { name: 'EV Parking Slots', rows: evParkingSlots },
      { name: 'EV Time Periods', rows: evTimePeriods },
      { name: 'Departments', rows: departments },
      { name: 'Access Roles', rows: accessRoles },
      { name: 'Booking Windows', rows: bookingWindows },
      { name: 'Prompts', rows: prompts },
      { name: 'System Settings', rows: systemSettings },
      { name: 'Display Config Settings', rows: displayConfigSettings },
    ];

    const wb = XLSX.utils.book_new();
    for (const sheet of sheets) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          sheet.rows.length
            ? sheet.rows
            : [{ Note: 'No data in this sheet' }],
        ),
        sheet.name,
      );
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const fileName = `TKOH_GA_Service_Center_System_Data_Backup_${range.startYmd}_to_${range.endYmd}.xlsx`;

    return {
      buffer,
      fileName,
      summary: {
        venueBookings: venueBookings.length,
        evBookings: evBookings.length,
        users: users.length,
        pendingUsers: pendingUsers.length,
        venues: venues.length,
        venueBlocks: venueBlocks.length,
        licensePlates: licensePlates.length,
        evParkingSlots: evParkingSlots.length,
        evTimePeriods: evTimePeriods.length,
        departments: departments.length,
        accessRoles: accessRoles.length,
        bookingWindows: bookingWindows.length,
        prompts: prompts.length,
        systemSettings: systemSettings.length,
        displayConfigSettings: displayConfigSettings.length,
      },
    };
  }

  private isPasswordSettingKey(key: string): boolean {
    return key.toLowerCase().includes('password');
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

  private formatDateTimeHkt(value: Date | null | undefined): string {
    if (!value) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
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

  private yesNo(value: boolean | null | undefined): string {
    return value ? 'Yes' : 'No';
  }

  private bigintText(value: bigint | number | null | undefined): string {
    if (value == null) return '';
    return value.toString();
  }

  /** Display as "Name（CORP ID）" to keep Excel columns compact. */
  private formatPersonWithCorpId(
    name: string | null | undefined,
    corpId: string | null | undefined,
  ): string {
    const displayName = String(name ?? '').trim();
    const id = String(corpId ?? '').trim();
    if (displayName && id) return `${displayName}（${id}）`;
    if (displayName) return displayName;
    if (id) return `（${id}）`;
    return '';
  }

  private teaPayload(row: VenueBookingRow): VenueTeaServicePayload | null {
    return normalizeVenueTeaService(row.venueTeaService?.teaService);
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

    return rows.map((row, index) => {
      const tea = this.teaPayload(row);
      return {
        '#': index + 1,
        ID: this.bigintText(row.id),
        Venue: row.venue?.name ?? '',
        'Booking Type': row.bookingType ?? '',
        Date: this.formatBookingDate(row.bookingDate),
        'Start Time': this.formatTimeValue(row.startTime),
        'End Time': this.formatTimeValue(row.endTime),
        'Meeting / Event': row.meetingTitle ?? '',
        Notes: row.notes ?? '',
        Attendees: row.attendees ?? '',
        Status: this.formatStatus(row.status),
        'Approval Status': this.formatStatus(row.approvalStatus || 'pending'),
        'Tea Service Required': this.yesNo(row.teaServiceRequired),
        'Tea Option': tea?.option ?? '',
        'Tea Service Display': row.teaServiceRequired
          ? formatVenueTeaServiceDisplay(tea, row.attendees)
          : 'No',
        'Tea Completed':
          row.venueTeaService == null
            ? ''
            : this.yesNo(row.venueTeaService.completed),
        'Display on Homepage': this.yesNo(row.displayOnHomepage !== false),
        'Reserved By': this.formatPersonWithCorpId(
          formatUserDisplayName(row.reservedBy),
          row.reservedBy?.corpId,
        ),
        'Department / Unit':
          row.reservedBy?.department?.department_name ?? '',
        'Contact No.': row.reservedBy?.contact ?? '',
        Email: row.reservedBy?.email ?? '',
        'Submitted By': this.formatPersonWithCorpId(
          formatUserDisplayName(row.submitter),
          row.submitter?.corpId,
        ),
        'Submitted At': this.formatDateTimeHkt(row.submittedAt),
        'Handled By': this.formatPersonWithCorpId(
          formatUserDisplayName(row.handler),
          row.handler?.corpId,
        ),
        'Handled At': this.formatDateTimeHkt(row.handledAt),
        'Cancelled By': this.formatPersonWithCorpId(
          formatUserDisplayName(row.cancelledBy),
          row.cancelledBy?.corpId,
        ),
        'Cancelled At': this.formatDateTimeHkt(row.cancelledAt),
        'Created At': this.formatDateTimeHkt(row.createdAt),
        'Updated At': this.formatDateTimeHkt(row.updatedAt),
      };
    });
  }

  private async loadEvBookings(startDate: Date, endDate: Date) {
    const rows = await this.prisma.evBookings.findMany({
      where: { bookingDate: { gte: startDate, lte: endDate } },
      include: {
        licensePlate: {
          select: {
            plate_number: true,
            user_id: true,
          },
        },
        slot: {
          select: { evSpace: true },
        },
        period: {
          select: {
            period: true,
            startTime: true,
            endTime: true,
          },
        },
        submitter: {
          select: { id: true, corpId: true, ...userDisplayNameSelect },
        },
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
        row.submitter ??
        (row.submitterUserId != null
          ? owners.byId.get(row.submitterUserId)
          : undefined);

      return {
        '#': index + 1,
        ID: this.bigintText(row.id),
        'Booking Date': this.formatBookingDate(row.bookingDate),
        'Booking Time': this.formatPeriodTime(row.period),
        'EV Space': row.slot.evSpace,
        'License Plate': row.licensePlate?.plate_number ?? '',
        'Reserved By': this.formatPersonWithCorpId(
          owner ? formatUserDisplayName(owner) : '',
          owner?.corpId,
        ),
        'Submitted By': this.formatPersonWithCorpId(
          submitter ? formatUserDisplayName(submitter) : '',
          submitter?.corpId,
        ),
        Status: this.formatStatus(row.status),
        'Booked On': this.formatDateTimeHkt(row.bookedOn),
        'Created At': this.formatDateTimeHkt(row.createdAt),
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

    type OwnerUser = {
      id: bigint;
      corpId: string;
      firstName: string;
      lastName: string;
      email: string | null;
      contact: string | null;
    };

    if (!userIds.size && !corpIds.size) {
      return {
        byId: new Map<bigint, OwnerUser>(),
        byCorp: new Map<string, OwnerUser>(),
      };
    }

    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          userIds.size ? { id: { in: [...userIds] } } : undefined,
          corpIds.size ? { corpId: { in: [...corpIds] } } : undefined,
        ].filter(Boolean) as Prisma.UserWhereInput[],
      },
      select: {
        id: true,
        corpId: true,
        ...userDisplayNameSelect,
        email: true,
        contact: true,
      },
    });

    const byId = new Map(users.map((user) => [user.id, user]));
    const byCorp = new Map(users.map((user) => [user.corpId, user]));
    return { byId, byCorp };
  }

  private formatQuotaLimit(value: number | null | undefined): string {
    return Number(value) === -1 ? 'Unlimited' : String(value ?? 0);
  }

  private async loadUsers() {
    const rows = await this.prisma.user.findMany({
      where: { isSystemHidden: false },
      include: {
        access_roles: {
          select: {
            role_name: true,
          },
        },
        department: {
          select: { department_name: true },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
    });

    const quotaYear = getAppCalendarYear();
    const userIds = rows.map((row) => row.id);
    const [{ evUsedByUserId, venueUsedByUserId }, overrides] = await Promise.all([
      batchCountUsedForYear(this.prisma, userIds, quotaYear),
      batchLoadYearlyOverrides(this.prisma, userIds, quotaYear),
    ]);

    const corpIdByDisplayName = new Map<string, string>();
    for (const row of rows) {
      const displayName = formatUserDisplayName(row);
      if (displayName && !corpIdByDisplayName.has(displayName)) {
        corpIdByDisplayName.set(displayName, row.corpId);
      }
    }

    return rows.map((row, index) => {
      const inactivedByRaw = String(row.inactivedBy ?? '').trim();
      let inactivedBy = inactivedByRaw;
      if (
        inactivedByRaw &&
        inactivedByRaw.toLowerCase() !== 'by system'
      ) {
        const actorCorpId = corpIdByDisplayName.get(inactivedByRaw);
        inactivedBy = this.formatPersonWithCorpId(
          inactivedByRaw,
          actorCorpId ?? '',
        );
      }

      const id = row.id.toString();
      const override = overrides.get(id);
      const annualEv =
        override?.annualQuotaEv !== undefined && override?.annualQuotaEv !== null
          ? override.annualQuotaEv
          : row.annualQuotaEv;
      const annualVenue =
        override?.annualQuotaVenue !== undefined &&
        override?.annualQuotaVenue !== null
          ? override.annualQuotaVenue
          : row.annualQuotaVenue;

      return {
        '#': index + 1,
        ID: this.bigintText(row.id),
        'CORP User ID': row.corpId,
        'Employee No.': row.employeeNo ?? '',
        'First Name': row.firstName ?? '',
        'Last Name': row.lastName ?? '',
        'Department / Unit': row.department?.department_name ?? '',
        Rank: row.rank ?? '',
        Email: row.email ?? '',
        'Contact No.': row.contact ?? '',
        Role: row.access_roles?.role_name ?? '',
        'Quota Year': String(quotaYear),
        'EV Quota': this.formatQuotaLimit(annualEv),
        'Used Quota (EV)': String(evUsedByUserId.get(id) ?? 0),
        'Venue Quota': this.formatQuotaLimit(annualVenue),
        'Used Quota (Venue)': String(venueUsedByUserId.get(id) ?? 0),
        Status: this.formatStatus(row.status),
        'Last Login Time': this.formatDateTimeHkt(row.lastLoginTime),
        'Inactive Time': this.formatDateTimeHkt(row.inactiveTime),
        'Inactived By': inactivedBy,
        'Created At': this.formatDateTimeHkt(row.createdAt),
      };
    });
  }

  private async loadPendingUsers() {
    const rows = await this.prisma.pending_users.findMany({
      include: {
        departments: { select: { department_name: true } },
        approver: {
          select: { id: true, corpId: true, ...userDisplayNameSelect },
        },
      },
      orderBy: [{ submitted_at: 'desc' }, { id: 'desc' }],
    });

    return rows.map((row, index) => ({
      '#': index + 1,
      ID: this.bigintText(row.id),
      'CORP User ID': row.corp_id,
      'Employee No.': row.employee_no ?? '',
      'First Name': row.first_name ?? '',
      'Last Name': row.last_name ?? '',
      'Department / Unit': row.departments?.department_name ?? '',
      Rank: row.rank ?? '',
      Email: row.email ?? '',
      'Contact No.': row.contact_no ?? '',
      Reason: row.reason ?? '',
      'Car Plate No.': row.car_plate_no ?? '',
      'Approval Status': this.formatStatus(row.approval_status),
      Approver: this.formatPersonWithCorpId(
        formatUserDisplayName(row.approver) || row.approver_name || '',
        row.approver?.corpId,
      ),
      'Reject Reason': row.reject_reason ?? '',
      'Submitted At': this.formatDateTimeHkt(row.submitted_at),
      'Handled At': this.formatDateTimeHkt(row.handled_at),
      'Created At': this.formatDateTimeHkt(row.created_at),
    }));
  }

  private async loadVenues() {
    const rows = await this.prisma.venues.findMany({
      include: {
        display_venue_rules: {
          select: {
            display_name: true,
            arrow_direction: true,
          },
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    return rows.map((row, index) => ({
      '#': index + 1,
      ID: this.bigintText(row.id),
      Name: row.name,
      'Name (ZH)': row.nameZh ?? '',
      'Venue Type': row.venueType ?? '',
      Color: row.color ?? '',
      Location: row.location ?? '',
      'Location (ZH)': row.locationZh ?? '',
      'Display Type': row.displayType ?? '',
      'Image URL': row.imageUrl ?? '',
      Status: this.formatStatus(row.status),
      'Room Capacity': row.roomCapacity ?? '',
      'Tea Service Available': this.yesNo(row.teaServiceAvailable),
      'User Defined Upload Event Title': this.yesNo(
        row.userDefinedUploadEventTitle,
      ),
      'Daily Booking Start': row.dailyBookingStartTime ?? '',
      'Daily Booking End': row.dailyBookingEndTime ?? '',
      'Display Rule Name': row.display_venue_rules?.display_name ?? '',
      'Display Rule Arrow': row.display_venue_rules?.arrow_direction ?? '',
      'Created At': this.formatDateTimeHkt(row.createdAt),
    }));
  }

  private async loadVenueBlocks() {
    const rows = await this.prisma.venue_blocks.findMany({
      include: {
        venues: { select: { id: true, name: true } },
      },
      orderBy: [{ start_at: 'asc' }, { id: 'asc' }],
    });

    return rows.map((row, index) => ({
      '#': index + 1,
      ID: this.bigintText(row.id),
      'Venue ID': this.bigintText(row.venue_id),
      Venue: row.venues?.name ?? '',
      'Start At': this.formatDateTimeHkt(row.start_at),
      'End At': this.formatDateTimeHkt(row.end_at),
      Reason: row.reason ?? '',
      'Created At': this.formatDateTimeHkt(row.created_at),
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
            select: {
              id: true,
              corpId: true,
              ...userDisplayNameSelect,
            },
          })
        : [];
    const userById = new Map(users.map((user) => [user.id, user]));

    return rows.map((row, index) => {
      const owner = row.user_id != null ? userById.get(row.user_id) : undefined;
      return {
        '#': index + 1,
        ID: this.bigintText(row.id),
        'Plate Number': row.plate_number,
        Owner: this.formatPersonWithCorpId(
          owner ? formatUserDisplayName(owner) : '',
          owner?.corpId,
        ),
        'Is Default': this.yesNo(row.is_default),
        Status: this.formatStatus(row.status),
        'Created At': this.formatDateTimeHkt(row.created_at),
      };
    });
  }

  private async loadEvParkingSlots() {
    const rows = await this.prisma.evParkingSlots.findMany({
      orderBy: [{ id: 'asc' }],
    });

    return rows.map((row, index) => ({
      '#': index + 1,
      ID: this.bigintText(row.id),
      'EV Space': row.evSpace,
      Location: row.location ?? '',
      Status: this.formatStatus(row.status),
      'Created At': this.formatDateTimeHkt(row.createdAt),
    }));
  }

  private async loadEvTimePeriods() {
    const rows = await this.prisma.evTimePeriods.findMany({
      orderBy: [{ id: 'asc' }],
    });

    return rows.map((row, index) => ({
      '#': index + 1,
      ID: this.bigintText(row.id),
      Period: row.period,
      'Start Time': this.formatTimeValue(row.startTime),
      'End Time': this.formatTimeValue(row.endTime),
      Status: this.formatStatus(row.status),
      'Created At': this.formatDateTimeHkt(row.createdAt),
    }));
  }

  private async loadDepartments() {
    const rows = await this.prisma.departments.findMany({
      orderBy: [{ department_name: 'asc' }],
    });

    return rows.map((row, index) => ({
      '#': index + 1,
      ID: this.bigintText(row.id),
      'Department Name': row.department_name,
      Description: row.description ?? '',
      'Created At': this.formatDateTimeHkt(row.created_at),
    }));
  }

  private async loadAccessRoles() {
    const rows = await this.prisma.access_roles.findMany({
      orderBy: [{ role_name: 'asc' }],
    });

    return rows
      .filter((row) => !isSuperAdminRole(row.role_name))
      .map((row, index) => ({
        '#': index + 1,
        ID: this.bigintText(row.id),
        'Role Name': row.role_name,
        Description: row.description ?? '',
        'Annual Venue Quota': row.annual_venue_quota ?? '',
        'Annual EV Quota': row.annual_ev_quota ?? '',
        'Employee Count': row.employee_count ?? '',
        'Created At': this.formatDateTimeHkt(row.created_at),
      }));
  }

  private async loadBookingWindows() {
    const rows = await this.prisma.booking_windows.findMany({
      orderBy: [{ resource_type: 'asc' }],
    });

    return rows.map((row, index) => ({
      '#': index + 1,
      ID: row.resource_type,
      'Resource Type': row.resource_type,
      'Current Start Date': this.formatBookingDate(row.current_start_date),
      'Current End Date': this.formatBookingDate(row.current_end_date),
      'Updated By': row.updated_by ?? '',
      'Updated At': this.formatDateTimeHkt(row.updated_at),
      'Created At': this.formatDateTimeHkt(row.created_at),
    }));
  }

  private async loadPrompts() {
    const rows = await this.prisma.prompts.findMany({
      orderBy: [{ category: 'asc' }, { prompt_key: 'asc' }, { id: 'asc' }],
    });

    return rows.map((row, index) => ({
      '#': index + 1,
      ID: this.bigintText(row.id),
      'Prompt Key': row.prompt_key,
      Name: row.name,
      Content: row.content,
      Category: row.category,
      'Can Add': this.yesNo(row.can_add),
      'Template Type': row.template_type ?? '',
      'Created At': this.formatDateTimeHkt(row.created_at),
    }));
  }

  private async loadSystemSettings() {
    const rows = await this.prisma.system_settings.findMany({
      orderBy: [{ setting_key: 'asc' }],
    });

    return rows
      .filter((row) => !this.isPasswordSettingKey(row.setting_key))
      .map((row, index) => ({
        '#': index + 1,
        ID: row.setting_key,
        'Setting Key': row.setting_key,
        'Setting Value': row.setting_value ?? '',
        Description: row.description ?? '',
        'Updated At': this.formatDateTimeHkt(row.updated_at),
      }));
  }

  private async loadDisplayConfigSettings() {
    const rows = await this.prisma.display_config_settings.findMany({
      orderBy: [{ config_key: 'asc' }],
    });

    return rows.map((row, index) => ({
      '#': index + 1,
      ID: row.config_key,
      'Config Key': row.config_key,
      'Config Value': row.config_value ?? '',
      'Updated At': this.formatDateTimeHkt(row.updated_at),
    }));
  }
}
