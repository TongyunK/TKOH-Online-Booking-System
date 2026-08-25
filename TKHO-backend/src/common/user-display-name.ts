/** Prisma / API user name fields used for display. */
export type UserNameParts = {
  firstName?: string | null;
  lastName?: string | null;
  /** Legacy / computed fallback */
  name?: string | null;
};

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

/** Common select fragment when only display name (and optional contact) is needed. */
export const userDisplayNameSelect = {
  firstName: true,
  lastName: true,
} as const;
