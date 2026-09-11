import { getSystemSettings } from '@/api/systemSettings'
import { SILENT_ERROR } from '@/utils/requestOptions'

export const DEFAULT_MEETING_EVENT_TITLE_MAX_LENGTH = 80
export const MEETING_EVENT_TITLE_MAX_LENGTH_CEILING = 500

let cachedMaxLength = null
let inflight = null

function normalizeMaxLength (raw) {
  const value = Number(raw)
  if (
    Number.isFinite(value) &&
    value >= 1 &&
    value <= MEETING_EVENT_TITLE_MAX_LENGTH_CEILING
  ) {
    return Math.floor(value)
  }
  return DEFAULT_MEETING_EVENT_TITLE_MAX_LENGTH
}

/** 汉字等 CJK 表意文字计 2；其余字符计 1 */
export function isMeetingEventTitleCjkIdeograph (codePoint) {
  if (!Number.isFinite(codePoint)) return false
  return (
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0x20000 && codePoint <= 0x2a6df) ||
    (codePoint >= 0x2a700 && codePoint <= 0x2b73f) ||
    (codePoint >= 0x2b740 && codePoint <= 0x2b81f) ||
    (codePoint >= 0x2b820 && codePoint <= 0x2ceaf)
  )
}

/** 按「中文汉字=2、其它=1」计算占用数量 */
export function getMeetingEventTitleUnitLength (text) {
  const value = String(text ?? '')
  let units = 0
  for (const ch of value) {
    const codePoint = ch.codePointAt(0)
    units += isMeetingEventTitleCjkIdeograph(codePoint) ? 2 : 1
  }
  return units
}

export function isMeetingEventTitleTooLong (text, maxLength) {
  const max = normalizeMaxLength(maxLength)
  return getMeetingEventTitleUnitLength(text) > max
}

/** 按单位上限截断（输入中文时自动按 2 计，超出则不再追加） */
export function clipMeetingEventTitleToMaxUnits (text, maxLength) {
  const max = normalizeMaxLength(maxLength)
  let units = 0
  let result = ''
  for (const ch of String(text ?? '')) {
    const codePoint = ch.codePointAt(0)
    const add = isMeetingEventTitleCjkIdeograph(codePoint) ? 2 : 1
    if (units + add > max) break
    units += add
    result += ch
  }
  return result
}

export function invalidateMeetingEventTitleMaxLengthCache () {
  cachedMaxLength = null
}

/**
 * Cached fetch of Venue Meeting / Event Title max length from system settings.
 * Uses silentError: non-admin users get 403 on /system-settings; fall back to default
 * without showing the global "Admin portal access required" Reminder.
 */
export async function fetchMeetingEventTitleMaxLength () {
  if (cachedMaxLength != null) return cachedMaxLength
  if (inflight) return inflight

  inflight = getSystemSettings(SILENT_ERROR)
    .then((data) => {
      cachedMaxLength = normalizeMaxLength(data?.venueMeetingEventTitleMaxLength)
      return cachedMaxLength
    })
    .catch(() => {
      cachedMaxLength = DEFAULT_MEETING_EVENT_TITLE_MAX_LENGTH
      return cachedMaxLength
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}

export function meetingEventTitleTooLongMessage (maxLength) {
  const max = normalizeMaxLength(maxLength)
  return `Meeting / Event Title must be at most ${max} units (each Chinese character counts as 2)`
}

/** Element Plus 自定义校验：按加权单位比较上限 */
export function createMeetingEventTitleMaxRule (maxLength) {
  const max = typeof maxLength === 'function' ? maxLength : () => maxLength
  return {
    validator (_rule, value, callback) {
      const limit = normalizeMaxLength(max())
      if (value != null && String(value).length > 0 && isMeetingEventTitleTooLong(value, limit)) {
        callback(new Error(meetingEventTitleTooLongMessage(limit)))
        return
      }
      callback()
    },
    trigger: 'blur'
  }
}
