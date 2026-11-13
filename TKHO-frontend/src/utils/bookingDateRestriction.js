export const RESTRICTED_BOOKING_CONTACT_ADMIN =
  'Booking is not available on weekends and public holidays. Please contact an administrator.'

export const SAME_DAY_BOOKING_NOT_ALLOWED =
  'Same-day bookings are not allowed. Please select a future date.'

export const PAST_BOOKING_NOT_ALLOWED =
  'Past dates cannot be booked. Please select today or a future date.'

export const SAME_DAY_CANCEL_NOT_ALLOWED =
  'Same-day bookings cannot be cancelled. Please contact an administrator.'

export function toBookingDateYmd (dateLike) {
  if (typeof dateLike === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateLike.trim())) {
    return dateLike.trim()
  }
  const date = parseBookingDateLocal(dateLike)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function parseBookingDateLocal (dateLike) {
  if (dateLike instanceof Date) {
    const d = new Date(dateLike)
    d.setHours(0, 0, 0, 0)
    return d
  }
  const text = String(dateLike || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [y, m, d] = text.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const d = new Date(text)
  d.setHours(0, 0, 0, 0)
  return d
}

export function isWeekendDate (dateLike) {
  const date = parseBookingDateLocal(dateLike)
  if (Number.isNaN(date.getTime())) return false
  const day = date.getDay()
  return day === 0 || day === 6
}

/** 非管理员：过去日期不可预订（今日可订；用于 Venue）。 */
export function isPastBookingRestricted (
  dateLike,
  { isAdmin = false, todayYmd } = {}
) {
  if (isAdmin) return false
  const ymd = toBookingDateYmd(dateLike)
  if (!ymd) return false
  const today = String(todayYmd || '').trim()
  if (!today) return false
  return ymd < today
}

/** 非管理员：今日及过去日期不可预订（用于 EV）。 */
export function isSameDayOrPastBookingRestricted (
  dateLike,
  { isAdmin = false, todayYmd } = {}
) {
  if (isAdmin) return false
  const ymd = toBookingDateYmd(dateLike)
  if (!ymd) return false
  const today = String(todayYmd || '').trim()
  if (!today) return false
  return ymd <= today
}

export function isRestrictedBookingDay (
  dateLike,
  { isAdmin = false, publicHolidayDates = {}, isPublicHoliday } = {}
) {
  if (isAdmin) return false
  if (isWeekendDate(dateLike)) return true
  if (typeof isPublicHoliday === 'function') {
    return isPublicHoliday(dateLike)
  }
  const ymd = toBookingDateYmd(dateLike)
  return Boolean(ymd && publicHolidayDates[ymd])
}

export function getRestrictedBookingMessage (
  dateLike,
  { publicHolidayDates = {}, getHolidaySummary } = {}
) {
  const ymd = toBookingDateYmd(dateLike)
  const holidayLabel = typeof getHolidaySummary === 'function'
    ? getHolidaySummary(dateLike)
    : (publicHolidayDates[ymd] || '')
  if (holidayLabel) {
    return `Booking is not allowed on public holidays (${holidayLabel}). Please contact an administrator.`
  }
  if (isWeekendDate(dateLike)) {
    return 'Booking is not allowed on weekends. Please contact an administrator.'
  }
  return RESTRICTED_BOOKING_CONTACT_ADMIN
}
