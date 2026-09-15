/** localStorage key shared by idle auto-logout (same-browser tabs only) */
export const IDLE_LAST_ACTIVITY_KEY = 'idleAutoLogoutLastActivityAt'

export function clearIdleLastActivity () {
  try {
    localStorage.removeItem(IDLE_LAST_ACTIVITY_KEY)
  } catch {
    /* ignore */
  }
}

export function readIdleLastActivity () {
  const raw = Number.parseInt(localStorage.getItem(IDLE_LAST_ACTIVITY_KEY) || '', 10)
  return Number.isFinite(raw) && raw > 0 ? raw : 0
}

export function writeIdleLastActivity (ts = Date.now()) {
  try {
    localStorage.setItem(IDLE_LAST_ACTIVITY_KEY, String(ts))
  } catch {
    /* ignore */
  }
}
