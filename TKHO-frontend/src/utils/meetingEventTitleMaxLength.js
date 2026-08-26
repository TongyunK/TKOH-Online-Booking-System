import { getSystemSettings } from '@/api/systemSettings'

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

export function invalidateMeetingEventTitleMaxLengthCache () {
  cachedMaxLength = null
}

/** Cached fetch of Venue Meeting / Event Title max length from system settings. */
export async function fetchMeetingEventTitleMaxLength () {
  if (cachedMaxLength != null) return cachedMaxLength
  if (inflight) return inflight

  inflight = getSystemSettings()
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
  return `Meeting / Event Title must be at most ${maxLength} characters`
}
