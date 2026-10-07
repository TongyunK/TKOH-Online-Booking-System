import { onMounted, onUnmounted, unref, watch } from 'vue'
import { getApiBaseURL, shouldAttachNgrokHeader } from '@/utils/apiConfig'
import { msUntilNextAppMinute } from '@/utils/appTimezone'

const DEBOUNCE_MS = 300
/** 避开整分 ± 此窗口，降低与大屏时钟 tick 同时刷数据导致的闪屏 */
const MINUTE_BOUNDARY_GUARD_MS = 2_500

/** Default HTTP poll fallback when SSE is unavailable (matches system_settings default). */
export const DEFAULT_DISPLAY_DATA_POLL_MS = 60_000

export function normalizeDisplayDataPollMs (raw) {
  const value = Number.parseInt(String(raw ?? ''), 10)
  if (Number.isFinite(value) && value >= 10_000 && value <= 300_000) {
    return value
  }
  return DEFAULT_DISPLAY_DATA_POLL_MS
}

/** 距下一次「不贴整分」轮询的延迟（优先落在分钟中段） */
function msUntilSafePollSlot (intervalMs, from = Date.now()) {
  const toNextMinute = msUntilNextAppMinute(from)
  const half = Math.min(Math.max(Math.floor(intervalMs / 2), 5_000), 30_000)
  return toNextMinute + half
}

/**
 * Keep a poll timer in sync with server-provided dataPollIntervalMs.
 * Uses chained setTimeout (not setInterval) and avoids firing near minute boundaries,
 * which share a tick with the display clock and can flash on Android WebView.
 * @returns {{ applyFromPayload: (raw: unknown) => void, start: () => void, stop: () => void }}
 */
export function useDisplayDataPollTimer (onPoll) {
  let timer = null
  let intervalMs = DEFAULT_DISPLAY_DATA_POLL_MS
  let generation = 0
  /** 轮询进行中 timer 可能为 null，不能用 timer 判断是否已 start */
  let active = false

  function stop () {
    generation += 1
    active = false
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function scheduleNext (delayMs) {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    const gen = generation
    timer = setTimeout(async () => {
      timer = null
      if (gen !== generation) return
      try {
        await Promise.resolve(onPoll())
      } catch {
        /* keep current screen; next tick retries */
      }
      if (gen !== generation) return
      // 若回调耗时跨过整分，再错开一点再进下一轮
      let nextDelay = intervalMs
      const toMinute = msUntilNextAppMinute()
      if (toMinute < MINUTE_BOUNDARY_GUARD_MS || toMinute > 60_000 - MINUTE_BOUNDARY_GUARD_MS) {
        nextDelay += MINUTE_BOUNDARY_GUARD_MS
      }
      scheduleNext(nextDelay)
    }, Math.max(0, delayMs))
  }

  function start () {
    stop()
    active = true
    scheduleNext(msUntilSafePollSlot(intervalMs))
  }

  function applyFromPayload (raw) {
    const next = normalizeDisplayDataPollMs(raw)
    if (next === intervalMs && active) return
    intervalMs = next
    start()
  }

  onUnmounted(() => {
    stop()
  })

  return { applyFromPayload, start, stop }
}

/**
 * Subscribe to display SSE invalidation events and call onRefresh.
 * Keeps existing HTTP polling as fallback; EventSource reconnects automatically.
 *
 * @param {import('vue').MaybeRefOrGetter<string[]|string>} channels
 * @param {() => void | Promise<void>} onRefresh
 */
export function useDisplayLiveRefresh (channels, onRefresh) {
  let source = null
  let debounceTimer = null
  let currentKey = ''

  function resolveChannels () {
    const raw = typeof channels === 'function' ? channels() : unref(channels)
    const list = Array.isArray(raw) ? raw : String(raw || '').split(',')
    return Array.from(
      new Set(
        list
          .map((item) => String(item || '').trim().toLowerCase())
          .filter(Boolean)
      )
    )
  }

  function buildStreamUrl (channelList) {
    const base = getApiBaseURL().replace(/\/+$/, '')
    const params = new URLSearchParams()
    params.set('channels', channelList.join(','))
    if (shouldAttachNgrokHeader(base)) {
      // EventSource cannot set custom headers; query hint for ngrok free tier.
      params.set('ngrok-skip-browser-warning', 'true')
    }
    return `${base}/display-events/stream?${params.toString()}`
  }

  function scheduleRefresh () {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return
    }
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      void Promise.resolve(onRefresh()).catch(() => {
        /* keep current screen; polling / next event will retry */
      })
    }, DEBOUNCE_MS)
  }

  function disconnect () {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (source) {
      source.close()
      source = null
    }
    currentKey = ''
  }

  function connect () {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return
    }
    const channelList = resolveChannels()
    if (!channelList.length) {
      disconnect()
      return
    }
    const key = channelList.join(',')
    if (source && currentKey === key) return

    disconnect()
    currentKey = key
    const url = buildStreamUrl(channelList)
    source = new EventSource(url)

    const onMessage = () => {
      scheduleRefresh()
    }
    source.addEventListener('display-invalidate', onMessage)
    // Some proxies strip named events; also handle default message.
    source.onmessage = onMessage
    source.onerror = () => {
      // Browser auto-reconnects; no manual close here.
    }
  }

  function onVisibilityChange () {
    if (document.visibilityState === 'visible') {
      connect()
      scheduleRefresh()
    }
  }

  onMounted(() => {
    connect()
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    disconnect()
  })

  watch(
    () => resolveChannels().join(','),
    () => {
      connect()
    }
  )
}
