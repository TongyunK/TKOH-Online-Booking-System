/** WebView 重载/休眠唤醒时 innerWidth/Height 可能短暂为 0～几 px，勿据此写入 scale≈0（表现为黑屏） */
export const MIN_DISPLAY_VIEWPORT_PX = 160
export const MIN_DISPLAY_SCALE = 0.08

/**
 * @param {number} baseWidth
 * @param {number} baseHeight
 * @returns {{ ok: boolean, vw: number, vh: number, scale: number, offsetX: number, offsetY: number }}
 */
export function measureDisplayViewport (baseWidth, baseHeight) {
  const viewportScale = window.visualViewport?.scale || 1
  const zoomCompensation = viewportScale > 0 ? viewportScale : 1
  const vw = (window.innerWidth || 0) * zoomCompensation
  const vh = (window.innerHeight || 0) * zoomCompensation

  if (vw < MIN_DISPLAY_VIEWPORT_PX || vh < MIN_DISPLAY_VIEWPORT_PX) {
    return { ok: false, vw, vh, scale: 1, offsetX: 0, offsetY: 0 }
  }

  const rawScale = Math.min(vw / baseWidth, vh / baseHeight)
  if (!Number.isFinite(rawScale) || rawScale < MIN_DISPLAY_SCALE) {
    return { ok: false, vw, vh, scale: 1, offsetX: 0, offsetY: 0 }
  }

  return {
    ok: true,
    vw,
    vh,
    scale: rawScale,
    offsetX: (vw - baseWidth * rawScale) / 2,
    offsetY: (vh - baseHeight * rawScale) / 2
  }
}
