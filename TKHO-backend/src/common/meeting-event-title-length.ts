/** 汉字等 CJK 表意文字计 2；其余字符计 1（与前端 meetingEventTitleMaxLength 一致） */
export function isMeetingEventTitleCjkIdeograph (codePoint: number): boolean {
  if (!Number.isFinite(codePoint)) return false;
  return (
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0x20000 && codePoint <= 0x2a6df) ||
    (codePoint >= 0x2a700 && codePoint <= 0x2b73f) ||
    (codePoint >= 0x2b740 && codePoint <= 0x2b81f) ||
    (codePoint >= 0x2b820 && codePoint <= 0x2ceaf)
  );
}

export function getMeetingEventTitleUnitLength (
  text: string | null | undefined,
): number {
  const value = String(text ?? '');
  let units = 0;
  for (const ch of value) {
    const codePoint = ch.codePointAt(0);
    units += isMeetingEventTitleCjkIdeograph(codePoint ?? NaN) ? 2 : 1;
  }
  return units;
}
