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

/**
 * Browser Fullscreen API for public display screens (Android Chrome / desktop).
 * Shows a tap-to-enter hint when not in fullscreen. Does NOT auto-enter on mount:
 * SPA navigations often still carry a user gesture, which can silently enter
 * fullscreen while the UI barely changes on Android TV / tablets.
 */
export function useDisplayBrowserFullscreen () {
  const isFullscreen = ref(false)
  const supported = ref(true)
  const showHint = ref(false)
  const syncTimers = []

  function syncState () {
    const fs = Boolean(getFullscreenElement())
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
    // Catch late fullscreenchange from a previous display page unmount.
    scheduleResync()

    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('webkitfullscreenchange', onFullscreenChange)
  })

  onUnmounted(() => {
    syncTimers.forEach((id) => clearTimeout(id))
    document.removeEventListener('fullscreenchange', onFullscreenChange)
    document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
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
