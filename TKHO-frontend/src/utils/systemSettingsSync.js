/** 系统设置变更同步：同页 CustomEvent + 跨标签 localStorage */

export const SYSTEM_SETTINGS_REVISION_KEY = 'tkho:systemSettingsRevision'
export const SYSTEM_SETTINGS_UPDATED_EVENT = 'tkho:system-settings-updated'

/**
 * Admin 保存 System Settings 后调用，通知同页与其它标签页刷新本地策略缓存。
 * @param {Record<string, unknown>} [detail]
 */
export function notifySystemSettingsUpdated (detail = {}) {
  const revision = String(Date.now())
  try {
    localStorage.setItem(SYSTEM_SETTINGS_REVISION_KEY, revision)
  } catch {
    /* ignore quota / private mode */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(SYSTEM_SETTINGS_UPDATED_EVENT, {
        detail: { revision, ...detail }
      })
    )
  }
}

/**
 * @param {(detail: Record<string, unknown>) => void} handler
 * @returns {() => void} unsubscribe
 */
export function onSystemSettingsUpdated (handler) {
  if (typeof window === 'undefined') return () => {}

  const onCustom = (event) => {
    handler(event?.detail && typeof event.detail === 'object' ? event.detail : {})
  }
  const onStorage = (event) => {
    if (event.key !== SYSTEM_SETTINGS_REVISION_KEY || !event.newValue) return
    handler({ revision: event.newValue })
  }

  window.addEventListener(SYSTEM_SETTINGS_UPDATED_EVENT, onCustom)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(SYSTEM_SETTINGS_UPDATED_EVENT, onCustom)
    window.removeEventListener('storage', onStorage)
  }
}
