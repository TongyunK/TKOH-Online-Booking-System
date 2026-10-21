const TYPE_QUERY_KEYS = ['displayType', 'DisplayType', 'display_type']
const VENUE_QUERY_KEYS = ['venueId', 'venueID', 'venue_id']

function currentVenueDisplayKind (route) {
  const path = String(route?.path || '')
  if (path.endsWith('/Display/Wise')) return 'wise'
  if (path.endsWith('/Display/Light')) return 'light'
  if (path.endsWith('/Display/Merge')) return 'merge'
  const query = route?.query || {}
  const raw = TYPE_QUERY_KEYS.map((key) => query[key]).find((value) => value != null && value !== '')
  const type = String(Array.isArray(raw) ? raw[0] : raw || 'single').trim().toLowerCase()
  return type === 'merge' ? 'merge' : 'single'
}

function pathForDisplayType (displayType) {
  if (displayType === 'wise') return '/VenueBooking/Display/Wise'
  if (displayType === 'light') return '/VenueBooking/Display/Light'
  if (displayType === 'merge') return '/VenueBooking/Display/Merge'
  return '/VenueBooking/Display'
}

/**
 * 已打开的展示页按当前网址固定样式。场地 displayType 变更后，
 * 用同一 venueId 刷新时应跳到对应展示路由。
 * @returns {boolean} 已发起跳转
 */
export function replaceVenueDisplayRoute (router, route, displayType) {
  const type = String(displayType || '').trim().toLowerCase()
  if (!['single', 'wise', 'light', 'merge'].includes(type)) return false
  if (currentVenueDisplayKind(route) === type) return false

  const query = { ...(route?.query || {}) }
  for (const key of TYPE_QUERY_KEYS) delete query[key]
  if (type === 'merge') {
    for (const key of VENUE_QUERY_KEYS) delete query[key]
  } else if (type === 'single') {
    query.displayType = 'single'
  }

  router.replace({ path: pathForDisplayType(type), query })
  return true
}
