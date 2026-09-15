import { watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { useStatusDialogStore } from '@/stores/statusDialog'
import { getSessionPolicy } from '@/api/auth'
import { isPublicRoute } from '@/utils/publicRoutes'
import {
  IDLE_LAST_ACTIVITY_KEY,
  clearIdleLastActivity,
  readIdleLastActivity,
  writeIdleLastActivity
} from '@/utils/idleAutoLogout'

const DEFAULT_IDLE_MINUTES = 30
const ACTIVITY_THROTTLE_MS = 1000
const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'click',
  'wheel'
]

function normalizeIdleMinutes (raw) {
  const minutes = Number(raw)
  if (Number.isFinite(minutes) && minutes >= 1 && minutes <= 1440) {
    return Math.floor(minutes)
  }
  return DEFAULT_IDLE_MINUTES
}

/**
 * 已登录且非公开页时，按 system_settings.user_auto_logout_minutes
 * 无操作自动登出（默认 30 分钟）。对任意角色生效（含非 Admin）。
 */
export function useIdleAutoLogout () {
  const userStore = useUserStore()
  const { token } = storeToRefs(userStore)
  const route = useRoute()
  const statusDialog = useStatusDialogStore()

  let idleMinutes = DEFAULT_IDLE_MINUTES
  let logoutTimer = null
  let lastThrottleAt = 0
  let listenersAttached = false
  let loggingOut = false
  let watchGeneration = 0

  function clearLogoutTimer () {
    if (logoutTimer != null) {
      clearTimeout(logoutTimer)
      logoutTimer = null
    }
  }

  function timeoutMs () {
    return Math.max(1, idleMinutes) * 60 * 1000
  }

  /** 仅采用仍在超时窗口内的跨标签活动时间；过期时间戳一律丢弃，避免一登录就立刻登出 */
  function resolveActivityBase (now = Date.now()) {
    const shared = readIdleLastActivity()
    if (shared > 0 && now - shared < timeoutMs()) {
      return shared
    }
    return now
  }

  async function handleIdleTimeout () {
    if (loggingOut || !token.value) return
    if (isPublicRoute(route.path)) return
    loggingOut = true
    clearLogoutTimer()
    detachListeners()
    clearIdleLastActivity()
    statusDialog.show(
      'You have been logged out due to inactivity.',
      'warning'
    )
    try {
      await userStore.performLogout()
    } finally {
      loggingOut = false
    }
  }

  function scheduleLogoutFrom (lastActivityAt) {
    clearLogoutTimer()
    if (!token.value || isPublicRoute(route.path)) return

    const limit = timeoutMs()
    const elapsed = Date.now() - lastActivityAt
    // 过期时间戳不应触发「立刻登出」，改为从现在重新计时
    if (elapsed >= limit) {
      const now = Date.now()
      writeIdleLastActivity(now)
      logoutTimer = setTimeout(() => {
        void handleIdleTimeout()
      }, limit)
      return
    }
    logoutTimer = setTimeout(() => {
      void handleIdleTimeout()
    }, limit - elapsed)
  }

  function markActivity ({ persist = true } = {}) {
    if (!token.value || isPublicRoute(route.path) || loggingOut) return
    const now = Date.now()
    if (persist) writeIdleLastActivity(now)
    scheduleLogoutFrom(now)
  }

  function onUserActivity () {
    const now = Date.now()
    if (now - lastThrottleAt < ACTIVITY_THROTTLE_MS) return
    lastThrottleAt = now
    markActivity({ persist: true })
  }

  function onVisibilityChange () {
    if (document.visibilityState !== 'visible') return
    const base = resolveActivityBase()
    writeIdleLastActivity(base)
    scheduleLogoutFrom(base)
  }

  function onStorage (event) {
    if (event.key === 'token' && !event.newValue) {
      clearLogoutTimer()
      detachListeners()
      return
    }
    if (event.key !== IDLE_LAST_ACTIVITY_KEY || !event.newValue) return
    const ts = Number.parseInt(event.newValue, 10)
    if (!Number.isFinite(ts) || ts <= 0) return
    const now = Date.now()
    if (now - ts >= timeoutMs()) return
    scheduleLogoutFrom(ts)
  }

  function attachListeners () {
    if (listenersAttached || typeof window === 'undefined') return
    for (const type of ACTIVITY_EVENTS) {
      window.addEventListener(type, onUserActivity, { passive: true, capture: true })
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('storage', onStorage)
    listenersAttached = true
  }

  function detachListeners () {
    if (!listenersAttached || typeof window === 'undefined') return
    for (const type of ACTIVITY_EVENTS) {
      window.removeEventListener(type, onUserActivity, { capture: true })
    }
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('storage', onStorage)
    listenersAttached = false
  }

  async function refreshPolicy () {
    if (!token.value) return
    try {
      const data = await getSessionPolicy()
      idleMinutes = normalizeIdleMinutes(data?.userAutoLogoutMinutes)
    } catch {
      idleMinutes = DEFAULT_IDLE_MINUTES
    }
  }

  async function startWatching () {
    const generation = ++watchGeneration
    if (!token.value || isPublicRoute(route.path)) {
      stopWatching()
      return
    }
    await refreshPolicy()
    if (generation !== watchGeneration) return
    if (!token.value || isPublicRoute(route.path)) {
      stopWatching()
      return
    }
    attachListeners()
    const base = resolveActivityBase()
    writeIdleLastActivity(base)
    scheduleLogoutFrom(base)
  }

  function stopWatching () {
    clearLogoutTimer()
    detachListeners()
  }

  watch(
    [token, () => route.path],
    () => {
      void startWatching()
    },
    { immediate: true }
  )

  onUnmounted(() => {
    watchGeneration += 1
    stopWatching()
  })
}
