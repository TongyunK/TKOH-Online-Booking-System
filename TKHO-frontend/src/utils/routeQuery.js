/**
 * Read a query value with case-insensitive key fallback.
 * Useful for display URLs typed on tablets (venueID / DisplayType / FromDate, etc.).
 */
export function pickRouteQuery (query, ...keys) {
  const q = query && typeof query === 'object' ? query : {}

  for (const key of keys) {
    const value = q[key]
    if (value == null) continue
    const text = Array.isArray(value) ? String(value[0] ?? '') : String(value)
    if (text.trim()) return text.trim()
  }

  const lowerMap = new Map()
  for (const [rawKey, rawValue] of Object.entries(q)) {
    lowerMap.set(String(rawKey).toLowerCase(), rawValue)
  }

  for (const key of keys) {
    const value = lowerMap.get(String(key).toLowerCase())
    if (value == null) continue
    const text = Array.isArray(value) ? String(value[0] ?? '') : String(value)
    if (text.trim()) return text.trim()
  }

  return ''
}

/** YYYY-MM-DD from route query, or empty when absent / invalid. */
export function pickRouteQueryDate (query, ...keys) {
  const raw = pickRouteQuery(query, ...keys)
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : ''
}
