import { onMounted, onUnmounted, unref, watch } from 'vue'
import { getApiBaseURL, shouldAttachNgrokHeader } from '@/utils/apiConfig'

const DEBOUNCE_MS = 300

/** Default HTTP poll fallback when SSE is unavailable (matches system_settings default). */
export const DEFAULT_DISPLAY_DATA_POLL_MS = 60_000

export function normalizeDisplayDataPollMs (raw) {
  const value = Number.parseInt(String(raw ?? ''), 10)
  if (Number.isFinite(value) && value >= 10_000 && value <= 300_000) {
    return value
  }
  return DEFAULT_DISPLAY_DATA_POLL_MS
}

/**
 * Keep a setInterval in sync with server-provided dataPollIntervalMs.
 * @returns {{ applyFromPayload: (raw: unknown) => void, start: () => void, stop: () => void }}
 */
export function useDisplayDataPollTimer (onPoll) {
  let timer = null
  let intervalMs = DEFAULT_DISPLAY_DATA_POLL_MS

  function stop () {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function start () {
    stop()
    timer = setInterval(() => {
      void Promise.resolve(onPoll()).catch(() => {})
    }, intervalMs)
  }

  function applyFromPayload (raw) {
    const next = normalizeDisplayDataPollMs(raw)
    if (next === intervalMs && timer) return
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
