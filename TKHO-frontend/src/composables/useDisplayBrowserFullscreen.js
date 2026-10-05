import { onMounted, onUnmounted, ref } from 'vue'

function getFullscreenElement () {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement ||
    null
  )
}

function requestElFullscreen (el) {
  if (!el) return Promise.reject(new Error('no element'))
  if (typeof el.requestFullscreen === 'function') {
    return el.requestFullscreen({ navigationUI: 'hide' }).catch(() =>
      el.requestFullscreen(),
    )
  }
  if (typeof el.webkitRequestFullscreen === 'function') {
    return Promise.resolve(el.webkitRequestFullscreen())
  }
  if (typeof el.msRequestFullscreen === 'function') {
    return Promise.resolve(el.msRequestFullscreen())
  }
  return Promise.reject(new Error('Fullscreen API unsupported'))
}

function exitElFullscreen () {
  if (!getFullscreenElement()) return Promise.resolve()
  if (typeof document.exitFullscreen === 'function') {
    return document.exitFullscreen()
  }
  if (typeof document.webkitExitFullscreen === 'function') {
    return Promise.resolve(document.webkitExitFullscreen())
  }
  if (typeof document.msExitFullscreen === 'function') {
    return Promise.resolve(document.msExitFullscreen())
  }
  return Promise.resolve()
}

function isFullscreenApiSupported () {
  const el = document.documentElement
  return (
    typeof el.requestFullscreen === 'function' ||
    typeof el.webkitRequestFullscreen === 'function' ||
    typeof el.msRequestFullscreen === 'function'
  )
}

function matchesDisplayMode (mode) {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia(`(display-mode: ${mode})`).matches
}

/**
 * Chrome --kiosk / --start-fullscreen fills the monitor without using the
 * Fullscreen API, so document.fullscreenElement stays null. Detect that case
 * so the tap-to-enter overlay does not cover an already-kiosk window.
 */
function isKioskLikeWindow () {
  if (matchesDisplayMode('fullscreen') || matchesDisplayMode('standalone')) {
    return true
  }
  const uiChrome = Math.max(0, window.outerHeight - window.innerHeight)
  const fillsWidth = window.outerWidth >= screen.width - 16
  const fillsHeight = window.outerHeight >= screen.height - 16
  const viewportFillsScreen =
    window.innerWidth >= screen.width - 16 &&
    window.innerHeight >= screen.height - 16
  return (fillsWidth && fillsHeight && uiChrome <= 32) || viewportFillsScreen
}

/**
 * Browser Fullscreen API for public display screens (Android Chrome / desktop).
 * Shows a tap-to-enter hint when not in fullscreen and not already in kiosk.
 * Auto-enter from a timer is not possible: requestFullscreen requires a real
 * user gesture. Synthetic clicks / dispatchEvent are ignored by the browser.
 */
export function useDisplayBrowserFullscreen () {
  const isFullscreen = ref(false)
  const supported = ref(true)
  const showHint = ref(false)
  const syncTimers = []
  let displayModeMql = null

  function syncState () {
    const fs = Boolean(getFullscreenElement()) || isKioskLikeWindow()
    isFullscreen.value = fs
    if (!supported.value) {
      showHint.value = false
      return
    }
    showHint.value = !fs
  }

  async function enterFullscreen () {
    if (!supported.value) return false
    if (getFullscreenElement()) {
      syncState()
      return true
    }
    try {
      await requestElFullscreen(document.documentElement)
      syncState()
      return Boolean(getFullscreenElement())
    } catch {
      syncState()
      return false
    }
  }

  async function exitFullscreen () {
    try {
      await exitElFullscreen()
    } catch {
      /* ignore */
    }
    syncState()
  }

  function onFullscreenChange () {
    syncState()
  }

  function scheduleResync () {
    ;[0, 100, 400].forEach((ms) => {
      syncTimers.push(window.setTimeout(syncState, ms))
    })
  }

  onMounted(() => {
    supported.value = isFullscreenApiSupported()
    syncState()
    scheduleResync()

    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('webkitfullscreenchange', onFullscreenChange)
    window.addEventListener('resize', syncState)
    if (typeof window.matchMedia === 'function') {
      displayModeMql = window.matchMedia('(display-mode: fullscreen)')
      if (displayModeMql.addEventListener) {
        displayModeMql.addEventListener('change', syncState)
      } else if (displayModeMql.addListener) {
        displayModeMql.addListener(syncState)
      }
    }
  })

  onUnmounted(() => {
    syncTimers.forEach((id) => clearTimeout(id))
    document.removeEventListener('fullscreenchange', onFullscreenChange)
    document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
    window.removeEventListener('resize', syncState)
    if (displayModeMql) {
      if (displayModeMql.removeEventListener) {
        displayModeMql.removeEventListener('change', syncState)
      } else if (displayModeMql.removeListener) {
        displayModeMql.removeListener(syncState)
      }
    }
    // Keep fullscreen when switching between display routes; only the user
    // (Esc / system UI) or a fresh non-display page should leave it.
  })

  return {
    isFullscreen,
    supported,
    showHint,
    enterFullscreen,
    exitFullscreen
  }
}
