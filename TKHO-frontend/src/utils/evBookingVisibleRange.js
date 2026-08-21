import { getAppDisplayDateTimeParts, todayYmdInAppTimeZone } from './appTimezone'

/** 用户端日历可见天数 */
export const EV_BOOKING_VISIBLE_DAY_COUNT = 14

const DEFAULT_EV_DATE_UPDATE_TIME = '13:00'

export function addDaysToYmd (ymd, days) {
  const date = new Date(`${ymd}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ymd
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseEvDateUpdateTime (value) {
  const raw = String(value ?? '').trim()
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw)
  if (!match) {
    return { hour: 13, minute: 0, label: DEFAULT_EV_DATE_UPDATE_TIME }
  }
  const hour = Number.parseInt(match[1], 10)
  const minute = Number.parseInt(match[2], 10)
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) {
    return { hour: 13, minute: 0, label: DEFAULT_EV_DATE_UPDATE_TIME }
  }
  return {
    hour,
    minute,
    label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  }
}

/** 当日是否已到达 EV 日历滚动更新时间（香港时区） */
export function isEvDateUpdateTimeReached (
  evDateUpdateTime = DEFAULT_EV_DATE_UPDATE_TIME,
  now = new Date()
) {
  const { hour: updateHour, minute: updateMinute } = parseEvDateUpdateTime(evDateUpdateTime)
  const parts = getAppDisplayDateTimeParts(now)
  const currentHour = Number.parseInt(parts.hour, 10)
  const currentMinute = Number.parseInt(parts.minute, 10)
  if (currentHour > updateHour) return true
  if (currentHour === updateHour && currentMinute >= updateMinute) return true
  return false
}

/**
 * 在管理员发布的年度范围内，取用户可见的 14 天：
 * - 更新时间前：从今天起 14 天（例：07.08 13:00 前 → 07.08~07.21）
 * - 更新时间后：从明天起 14 天（例：07.08 13:00 后 → 07.09~07.22）
 */
export function resolveEvVisibleBookingRange (
  windowStartYmd,
  windowEndYmd,
  options = {}
) {
  if (!windowStartYmd || !windowEndYmd) {
    return { startYmd: '', endYmd: '' }
  }

  const {
    todayYmd = todayYmdInAppTimeZone(),
    evDateUpdateTime = DEFAULT_EV_DATE_UPDATE_TIME,
    now = new Date()
  } = options

  const rolled = isEvDateUpdateTimeReached(evDateUpdateTime, now)
  const startOffsetDays = rolled ? 1 : 0
  const endOffsetDays = startOffsetDays + EV_BOOKING_VISIBLE_DAY_COUNT - 1

  const displayStartYmd = addDaysToYmd(todayYmd, startOffsetDays)
  const displayEndYmd = addDaysToYmd(todayYmd, endOffsetDays)

  const clampedStartYmd = displayStartYmd > windowStartYmd ? displayStartYmd : windowStartYmd
  const clampedEndYmd = displayEndYmd < windowEndYmd ? displayEndYmd : windowEndYmd

  if (clampedStartYmd > clampedEndYmd) {
    return { startYmd: '', endYmd: '' }
  }

  return { startYmd: clampedStartYmd, endYmd: clampedEndYmd }
}

/** 距下一次 EV 日历日期滚动（到达 EV_date_update_time）的毫秒数 */
export function msUntilNextEvDateUpdateRoll (
  evDateUpdateTime = DEFAULT_EV_DATE_UPDATE_TIME,
  from = Date.now()
) {
  const currentlyRolled = isEvDateUpdateTimeReached(evDateUpdateTime, from)

  for (let offset = 60_000; offset <= 48 * 60 * 60 * 1000; offset += 60_000) {
    const at = from + offset
    if (isEvDateUpdateTimeReached(evDateUpdateTime, at) !== currentlyRolled) {
      for (let fine = Math.max(1_000, offset - 60_000); fine <= offset; fine += 1_000) {
        if (isEvDateUpdateTimeReached(evDateUpdateTime, from + fine) !== currentlyRolled) {
          return fine
        }
      }
      return offset
    }
  }

  return 24 * 60 * 60 * 1000
}
