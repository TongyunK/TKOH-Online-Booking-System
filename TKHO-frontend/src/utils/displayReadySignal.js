/**
 * 通知 Android / Electron 播放器：大屏首屏已就绪，可关闭 Loading 遮罩。
 * 跨地域（如内地访问香港）延迟高时，避免 HTML 壳出来后立刻露黑底。
 */
export function signalDisplayReady () {
  try {
    if (typeof window === 'undefined') return
    window.__tkohDisplayReady = true
    window.__tkohAliveAt = Date.now()
  } catch {
    /* ignore */
  }
}

export function resetDisplayReady () {
  try {
    if (typeof window === 'undefined') return
    window.__tkohDisplayReady = false
  } catch {
    /* ignore */
  }
}
