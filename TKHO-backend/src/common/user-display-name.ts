/** Prisma / API user name fields used for display. */
export type UserNameParts = {
  firstName?: string | null;
  lastName?: string | null;
  /** Legacy / computed fallback */
  name?: string | null;
};

/** Optional rank / department for affiliated display names. */
export type UserAffiliationParts = UserNameParts & {
  rank?: string | null;
  /** Plain department name, or Prisma `department: { department_name }` relation. */
  department?: string | { department_name?: string | null } | null;
  departmentName?: string | null;
};

function resolveDepartmentName(
  user: UserAffiliationParts | null | undefined,
): string {
  if (!user) return '';
  const raw = user.department;
  if (raw && typeof raw === 'object') {
    return String(raw.department_name ?? '').trim();
  }
  return String(raw ?? user.departmentName ?? '').trim();
}

/** Display as "FirstName LastName" (Western order). */
export function formatUserDisplayName(
  user: UserNameParts | null | undefined,
): string {
  if (!user) return '';
  const first = String(user.firstName ?? '').trim();
  const last = String(user.lastName ?? '').trim();
  const combined = [first, last].filter(Boolean).join(' ');
  if (combined) return combined;
  return String(user.name ?? '').trim();
}

/**
 * "Peter Chan (GA)" or "Peter Chan, EA (GA)" when rank / department are available.
 */
export function formatUserDisplayNameWithAffiliation(
  user: UserAffiliationParts | null | undefined,
): string {
  if (!user) return '';
  const name = formatUserDisplayName(user);
  if (!name) return '';
  const rank = String(user.rank ?? '').trim();
  const department = resolveDepartmentName(user);
  if (rank && department) return `${name}, ${rank} (${department})`;
  if (department) return `${name} (${department})`;
  if (rank) return `${name}, ${rank}`;
  return name;
}

/** Common select fragment when only display name (and optional contact) is needed. */
export const userDisplayNameSelect = {
  firstName: true,
  lastName: true,
} as const;
