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
    return el.requestFullscreen({ navigationUI: 'hide' }).catch(() => el.requestFullscreen())
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

/**
 * Browser Fullscreen API for public display screens (Android Chrome / desktop).
 * Auto-try on mount; show tap-to-enter hint until fullscreen (or unsupported).
 */
export function useDisplayBrowserFullscreen () {
  const isFullscreen = ref(false)
  const supported = ref(true)
  const showHint = ref(false)

  function syncState () {
    isFullscreen.value = Boolean(getFullscreenElement())
    if (isFullscreen.value) {
      showHint.value = false
    } else if (supported.value) {
      showHint.value = true
    }
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

  onMounted(() => {
    const canRequest =
      typeof document.documentElement.requestFullscreen === 'function' ||
      typeof document.documentElement.webkitRequestFullscreen === 'function' ||
      typeof document.documentElement.msRequestFullscreen === 'function'
    supported.value = canRequest
    syncState()
    if (supported.value && !isFullscreen.value) {
      showHint.value = true
      // May fail without gesture; hint covers Android/desktop then.
      void enterFullscreen()
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('webkitfullscreenchange', onFullscreenChange)
  })

  onUnmounted(() => {
    document.removeEventListener('fullscreenchange', onFullscreenChange)
    document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
    if (getFullscreenElement()) {
      void exitFullscreen()
    }
  })

  return {
    isFullscreen,
    supported,
    showHint,
    enterFullscreen,
    exitFullscreen
  }
}
