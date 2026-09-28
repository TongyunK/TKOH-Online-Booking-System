/**
 * Read a query/body field with case-insensitive key fallback.
 * Useful for public display URLs typed on tablets (venueID / FromDate, etc.).
 */
export function pickQueryValue(
  source: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string | undefined {
  const obj = source && typeof source === 'object' ? source : {};

  for (const key of keys) {
    const value = obj[key];
    if (value == null) continue;
    const text = Array.isArray(value)
      ? String(value[0] ?? '')
      : String(value);
    if (text.trim()) return text.trim();
  }

  const lowerMap = new Map<string, unknown>();
  for (const [rawKey, rawValue] of Object.entries(obj)) {
    lowerMap.set(String(rawKey).toLowerCase(), rawValue);
  }

  for (const key of keys) {
    const value = lowerMap.get(String(key).toLowerCase());
    if (value == null) continue;
    const text = Array.isArray(value)
      ? String(value[0] ?? '')
      : String(value);
    if (text.trim()) return text.trim();
  }

  return undefined;
}
