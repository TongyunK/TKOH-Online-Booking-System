/**
 * Display as "FirstName LastName".
 * Falls back to legacy `name` when first/last are absent.
 */
export function formatUserDisplayName (user) {
  if (!user) return ''
  const first = String(user.firstName ?? user.first_name ?? '').trim()
  const last = String(user.lastName ?? user.last_name ?? '').trim()
  const combined = [first, last].filter(Boolean).join(' ')
  if (combined) return combined
  return String(user.name ?? '').trim()
}
