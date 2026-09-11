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
  return String(user.name ?? user.reservedBy ?? '').trim()
}

/**
 * "Peter Chan (GA)" or "Peter Chan, EA (GA)" when rank / department are available.
 */
export function formatUserDisplayNameWithAffiliation (userOrBooking) {
  if (!userOrBooking) return ''
  const name = String(userOrBooking.name ?? '').trim() || formatUserDisplayName(userOrBooking)
  if (!name) return ''
  const rank = String(userOrBooking.rank ?? '').trim()
  const department = String(
    userOrBooking.department
      ?? userOrBooking.departmentName
      ?? userOrBooking.departmentUnit
      ?? ''
  ).trim()
  if (rank && department) return `${name}, ${rank} (${department})`
  if (department) return `${name} (${department})`
  if (rank) return `${name}, ${rank}`
  return name
}

/**
 * ManageBooking display helper. Prefer plain name + dept/rank to avoid double-formatting
 * when API already returns an affiliated reservedBy string.
 */
export function formatBookingReservedByDisplay (booking) {
  if (!booking) return ''
  const plainName = String(booking.reservedByName ?? '').trim()
  const reservedBy = String(booking.reservedBy ?? '').trim()
  const name = plainName || reservedBy
  if (!name) return ''
  // Backend already formatted and no separate plain name — keep as-is
  if (!plainName && /\([^)]+\)\s*$/.test(reservedBy)) return reservedBy
  return formatUserDisplayNameWithAffiliation({
    name,
    rank: booking.rank,
    department: booking.department
  })
}

/** Same affiliation format for Submitted By. */
export function formatBookingSubmitterDisplay (booking) {
  if (!booking) return ''
  const plainName = String(booking.submitterName ?? '').trim()
  const submitter = String(booking.submitter ?? '').trim()
  const name = plainName || submitter
  if (!name) return ''
  if (!plainName && /\([^)]+\)\s*$/.test(submitter)) return submitter
  return formatUserDisplayNameWithAffiliation({
    name,
    rank: booking.submitterRank,
    department: booking.submitterDepartment
  })
}
