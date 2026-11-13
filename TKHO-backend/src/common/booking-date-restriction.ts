import { BadRequestException } from '@nestjs/common';
import { isAdminRole } from '../auth/admin-role.util';
import { getAppTodayYmd } from './app-timezone';

/** 预订日期以 UTC 午夜存储，用 getUTCDay 判断周末。 */
export function isWeekendDate(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** venue_bookings / ev_bookings.booking_date 的业务日（UTC 日期部分）。 */
export function formatBookingDateYmdUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 非管理员日期下限校验；管理员不受限。
 * - allowSameDay=false（默认，EV）：不可订今日及过去
 * - allowSameDay=true（Venue）：可订今日，不可订过去
 */
export function assertFutureBookingDateForUser(
  date: Date,
  auth: { role?: string; system?: string } | null | undefined,
  options?: { allowSameDay?: boolean },
): void {
  if (isAdminRole(auth)) return;
  const bookingYmd = formatBookingDateYmdUtc(date);
  const todayYmd = getAppTodayYmd();
  const allowSameDay = Boolean(options?.allowSameDay);
  if (allowSameDay) {
    if (bookingYmd < todayYmd) {
      throw new BadRequestException(
        'Past dates cannot be booked. Please select today or a future date.',
      );
    }
    return;
  }
  if (bookingYmd <= todayYmd) {
    throw new BadRequestException(
      'Same-day bookings are not allowed. Please select a future date.',
    );
  }
}

export function assertWeekendBookableForUser(
  date: Date,
  auth: { role?: string; system?: string } | null | undefined,
): void {
  if (isAdminRole(auth)) return;
  if (!isWeekendDate(date)) return;
  throw new BadRequestException(
    'Booking is not allowed on weekends. Please contact an administrator.',
  );
}

export function assertPublicHolidayBookableForUser(
  date: Date,
  holidaySummary: string | null | undefined,
  auth: { role?: string; system?: string } | null | undefined,
): void {
  if (isAdminRole(auth)) return;
  if (!holidaySummary) return;
  const label = String(holidaySummary).trim() || 'Public Holiday';
  throw new BadRequestException(
    `Booking is not allowed on public holidays (${label}). Please contact an administrator.`,
  );
}
