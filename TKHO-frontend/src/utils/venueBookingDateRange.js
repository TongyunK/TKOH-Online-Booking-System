/**
 * Venue Booking Date Range（admin 发布的 booking_windows.resource_type=venue）
 */

export const VENUE_BOOKING_DATE_RANGE_MESSAGE =
  'Selected date is outside the venue booking date range'

/**
 * @param {string} ymd YYYY-MM-DD
 * @param {string} [startYmd]
 * @param {string} [endYmd]
 * @returns {{ ok: boolean, message?: string }}
 */
export function validateVenueBookingDateRange (ymd, startYmd, endYmd) {
  const date = String(ymd || '').trim()
  const start = String(startYmd || '').trim()
  const end = String(endYmd || '').trim()
  if (!date) {
    return { ok: false, message: 'Please select a booking date' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, message: 'Invalid booking date' }
  }
  if (!start || !end) {
    return { ok: false, message: VENUE_BOOKING_DATE_RANGE_MESSAGE }
  }
  if (date < start || date > end) {
    return { ok: false, message: VENUE_BOOKING_DATE_RANGE_MESSAGE }
  }
  return { ok: true }
}

/**
 * @param {string} ymd
 * @param {string} [startYmd]
 * @param {string} [endYmd]
 */
export function isYmdOutsideVenueBookingDateRange (ymd, startYmd, endYmd) {
  return !validateVenueBookingDateRange(ymd, startYmd, endYmd).ok
}
