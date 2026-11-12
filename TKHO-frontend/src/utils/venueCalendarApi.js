/** 解包日历列表接口：兼容数组或 { view, range, bookings } */
export function unwrapCalendarBookings (payload) {
  if (Array.isArray(payload)) return payload
  if (payload && Array.isArray(payload.bookings)) return payload.bookings
  return []
}

/** 与 VenueCalendarMonth 网格一致（周日开头、5/6 行） */
export function getMonthGridRange (anchorDate) {
  const date = anchorDate instanceof Date ? anchorDate : new Date(anchorDate)
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const firstDow = firstOfMonth.getDay()
  const start = new Date(year, month, 1 - firstDow)

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cellsBefore = firstDow
  const totalCells = cellsBefore + daysInMonth
  const targetCells = totalCells <= 35 ? 35 : 42

  const end = new Date(start)
  end.setDate(end.getDate() + targetCells - 1)

  const fmt = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  return { start: fmt(start), end: fmt(end) }
}

/** 周日为一周起始（与周视图一致） */
export function getWeekStartSunday (anchorDate) {
  const d = anchorDate instanceof Date ? new Date(anchorDate) : new Date(anchorDate)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

export function isActiveVenue (venue) {
  return String(venue?.status || 'active').toLowerCase() === 'active'
}

export function formatDateISO (date) {
  const d = date instanceof Date ? date : new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 预订 date 字段：优先取 YYYY-MM-DD，避免 new Date('YYYY-MM-DD') 按 UTC 解析导致日视图错位 */
export function parseBookingCalendarDate (raw) {
  if (raw == null || raw === '') return ''
  const text = String(raw).trim()
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text)
  if (match) return match[1]
  const d = new Date(text)
  if (Number.isNaN(d.getTime())) return ''
  return formatDateISO(d)
}

export function isSameCalendarDay (a, b) {
  const left = a instanceof Date ? formatDateISO(a) : parseBookingCalendarDate(a)
  const right = b instanceof Date ? formatDateISO(b) : parseBookingCalendarDate(b)
  return Boolean(left && right && left === right)
}

/** 解析为本地日历日 0 点（供场地预订窗口校验、时段点击） */
export function parseCalendarDateLocal (raw) {
  const iso = parseBookingCalendarDate(raw)
  if (iso) {
    const [y, m, day] = iso.split('-').map(Number)
    return new Date(y, m - 1, day)
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return new Date(raw.getFullYear(), raw.getMonth(), raw.getDate())
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** 日历块左侧色条 / 背景：优先 booking.color，否则按 roomName 从场地列表取色 */
/** 与 src/style.css 中 html zoom 媒体查询一致（当前 zoom 约 0.86） */
export const HTML_ZOOM_BREAKPOINT_MQ = '(min-width: 1100px) and (max-width: 1599px)'

export function getHtmlZoomScale () {
  if (typeof window === 'undefined') return 1
  const raw = Number.parseFloat(window.getComputedStyle(document.documentElement).zoom || '1')
  return Number.isFinite(raw) && raw > 0 ? raw : 1
}

export function isHtmlZoomBreakpoint () {
  if (typeof window === 'undefined') return false
  return window.matchMedia(HTML_ZOOM_BREAKPOINT_MQ).matches
}

/**
 * getBoundingClientRect 为视口像素；挂 body 的 fixed 浮层在 html zoom 下需除以 zoom 才与触发元素对齐。
 */
export function viewportRectToZoomLayout (rect, zoom = getHtmlZoomScale()) {
  const z = zoom > 0 ? zoom : 1
  return {
    left: rect.left / z,
    top: rect.top / z,
    bottom: rect.bottom / z,
    right: rect.right / z,
    width: rect.width / z,
    height: rect.height / z
  }
}

/**
 * 历史兼容：若仍有调用可保留 absolute + 禁用 flip。
 * 提示层请优先 :teleported="false"（14" zoom），勿 append-to 未挂载选择器（Teleport 目标 null 会崩）。
 */
export function createHtmlZoomAwarePopperOptions (extra = {}) {
  const extraModifiers = Array.isArray(extra.modifiers) ? extra.modifiers : []
  return {
    ...extra,
    strategy: 'absolute',
    modifiers: [
      { name: 'flip', enabled: false },
      ...extraModifiers.filter((m) => m?.name !== 'flip')
    ]
  }
}

/**
 * 按「浏览器可视窗口」翻转/收拢气泡（不要用 #app 作边界）。
 * 中宽屏 html zoom 时 #app 比视口更宽，若按 #app 判断会误以为右侧还有空间而伸出窗外。
 * 不做 ÷zoom 坐标改写，避免 teleported=false 时箭头错位。
 */
export function createBrowserViewportPopperOptions (extra = {}) {
  const extraModifiers = Array.isArray(extra.modifiers) ? extra.modifiers : []
  const named = new Set(extraModifiers.map((m) => m?.name).filter(Boolean))
  const base = [
    {
      name: 'flip',
      options: {
        padding: 8,
        boundary: 'viewport',
        rootBoundary: 'viewport',
        fallbackPlacements: [
          'left-start',
          'right-end',
          'left-end',
          'top-start',
          'bottom-start',
          'right',
          'left'
        ]
      }
    },
    {
      name: 'preventOverflow',
      options: {
        padding: 8,
        altAxis: true,
        tether: true,
        boundary: 'viewport',
        rootBoundary: 'viewport'
      }
    }
  ].filter((m) => !named.has(m.name))

  return {
    strategy: 'absolute',
    ...extra,
    modifiers: [...base, ...extraModifiers]
  }
}

export function resolveBookingAccentColor (booking, rooms = []) {
  const direct = String(booking?.color || '').trim()
  if (direct) return direct
  const roomName = String(booking?.roomName || '').trim()
  if (roomName) {
    const match = rooms.find((r) => r.name === roomName)
    const roomColor = String(match?.color || '').trim()
    if (roomColor) return roomColor
  }
  return '#f97316'
}

/** 气泡标题：左侧细条场地色；Block 灰底，正常预订场地浅色底 */
export function getCalendarBookingPopoverTitleStyle (booking, rooms = []) {
  const accent = resolveBookingAccentColor(booking, rooms)
  const background = booking?.isBlocked
    ? '#dfe3e8'
    : `color-mix(in srgb, ${accent} 28%, white)`
  return {
    '--accent': accent,
    borderLeft: `5px solid ${accent}`,
    backgroundColor: background,
    ...(booking?.isBlocked ? { color: '#dc2626' } : {})
  }
}

/** 日/周/月视图：左侧细条为场地色；Block 为灰底，正常预订为场地浅色底 */
export function getCalendarBookingBlockStyle (booking, layoutStyle = {}, rooms = []) {
  const accent = resolveBookingAccentColor(booking, rooms)
  const background = booking?.isBlocked
    ? '#dfe3e8'
    : `color-mix(in srgb, ${accent} 28%, white)`
  return {
    ...layoutStyle,
    '--booking-accent': accent,
    borderLeft: `4px solid ${accent}`,
    backgroundColor: background
  }
}

export function parseBookingTimeToMinutes (timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 8 * 60
  const [h, m] = timeStr.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return 8 * 60
  return h * 60 + m
}

/** 解析 venue 排序 id：优先 booking.venueId，否则按房间名匹配列表 id */
export function resolveVenueSortId (booking, rooms = []) {
  const raw = booking?.venueId ?? booking?.roomId
  const n = Number(raw)
  if (Number.isFinite(n) && n > 0) return n
  const name = String(booking?.roomName || '').trim()
  if (!name) return Number.MAX_SAFE_INTEGER
  const room = (rooms || []).find((r) => r.name === name)
  const id = Number(room?.id)
  return Number.isFinite(id) && id > 0 ? id : Number.MAX_SAFE_INTEGER
}

/** 日/周/月统一：先开始时间，再 venue id（1→7） */
export function compareVenueCalendarBookings (a, b, rooms = []) {
  const ta = parseBookingTimeToMinutes(a?.startTime)
  const tb = parseBookingTimeToMinutes(b?.startTime)
  if (ta !== tb) return ta - tb
  const va = resolveVenueSortId(a, rooms)
  const vb = resolveVenueSortId(b, rooms)
  if (va !== vb) return va - vb
  return String(a?.id ?? '').localeCompare(String(b?.id ?? ''))
}

export function sortVenueCalendarBookings (bookings, rooms = []) {
  return [...(bookings || [])].sort((a, b) => compareVenueCalendarBookings(a, b, rooms))
}

/** 日视图房间列：按 venue id 升序 */
export function sortVenueRoomsById (rooms = []) {
  return [...(rooms || [])].sort((a, b) => {
    const ia = Number(a?.id)
    const ib = Number(b?.id)
    const aOk = Number.isFinite(ia)
    const bOk = Number.isFinite(ib)
    if (aOk && bOk && ia !== ib) return ia - ib
    if (aOk !== bOk) return aOk ? -1 : 1
    return String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' })
  })
}
