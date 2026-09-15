import { getAppDisplayDateTimeParts } from './appTimezone'

function normalizeHm (hm) {
  const match = String(hm || '').trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return ''
  return `${String(Number.parseInt(match[1], 10)).padStart(2, '0')}:${match[2]}`
}

/**
 * 非管理员：场地预订时段是否已过去（按 APP 时区，开始时间已到/已过即视为过去）。
 * @param {string} dateYmd YYYY-MM-DD
 * @param {string} startHm HH:mm
 * @param {string} [_endHm] HH:mm（预留；整段是否结束可用 end 判断）
 * @param {Date} [now]
 */
export function isVenueBookingRangePast (dateYmd, startHm, _endHm, now = new Date()) {
  const dateKey = String(dateYmd || '').trim()
  const start = normalizeHm(startHm)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !start) return false

  const parts = getAppDisplayDateTimeParts(now)
  const todayYmd = parts.ymd
  const nowHm = normalizeHm(`${parts.hour}:${parts.minute}`)

  if (dateKey < todayYmd) return true
  if (dateKey > todayYmd) return false
  return start <= nowHm
}

export const VENUE_BOOKING_PAST_RANGE_MESSAGE =
  'This time range is already in the past. Are you sure you want to continue?'
