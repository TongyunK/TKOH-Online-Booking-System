/** 业务日历日与时钟展示时区（TKOH 香港）；可通过 APP_TIMEZONE 覆盖 */
export const APP_TIMEZONE =
  process.env.APP_TIMEZONE?.trim() || 'Asia/Hong_Kong';

/** 指定时区下的 YYYY-MM-DD */
export function formatYmdInTimeZone(
  date: Date = new Date(),
  timeZone: string = APP_TIMEZONE,
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getAppTodayYmd(timeZone: string = APP_TIMEZONE): string {
  return formatYmdInTimeZone(new Date(), timeZone);
}

const WEEKDAY_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function getIsoWeekdayInTimeZone(
  ymd: string,
  timeZone: string = APP_TIMEZONE,
): number {
  const dateKey = String(ymd || '').trim();
  const anchor = new Date(`${dateKey}T12:00:00.000Z`);
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(anchor);
  return WEEKDAY_TO_ISO[label] ?? 1;
}

export function addDaysToYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map((value) => Number.parseInt(value, 10));
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/** Monday–Sunday week bounds in business timezone for the given calendar date. */
export function getAppWeekBoundsYmd(
  ymd: string,
  timeZone: string = APP_TIMEZONE,
): { weekStartYmd: string; weekEndYmd: string } {
  const dateKey = String(ymd || '').trim();
  const isoWeekday = getIsoWeekdayInTimeZone(dateKey, timeZone);
  const weekStartYmd = addDaysToYmd(dateKey, -(isoWeekday - 1));
  const weekEndYmd = addDaysToYmd(weekStartYmd, 6);
  return { weekStartYmd, weekEndYmd };
}

/** 指定时区下的自然年（四位数字） */
export function getAppCalendarYear(
  date: Date = new Date(),
  timeZone: string = APP_TIMEZONE,
): number {
  return Number.parseInt(formatYmdInTimeZone(date, timeZone).slice(0, 4), 10);
}

/**
 * 业务日历日 YYYY-MM-DD 在 APP_TIMEZONE 下的 [dayStart, dayEnd) 绝对时间。
 * 例：Asia/Hong_Kong 的 2026-08-21 → 2026-08-20T16:00:00Z ~ 2026-08-21T16:00:00Z
 */
export function getAppDayBounds(
  ymd: string,
  timeZone: string = APP_TIMEZONE,
): { dayStart: Date; dayEnd: Date } {
  const dateKey = String(ymd || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error(`Invalid YMD: ${ymd}`);
  }
  const nextYmd = addDaysToYmd(dateKey, 1);
  return {
    dayStart: zonedLocalDateTimeToUtc(dateKey, 0, 0, 0, timeZone),
    dayEnd: zonedLocalDateTimeToUtc(nextYmd, 0, 0, 0, timeZone),
  };
}

/** 将「业务时区墙钟」年月日+时分秒转为 UTC Instant */
function zonedLocalDateTimeToUtc(
  ymd: string,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const [year, month, day] = ymd.split('-').map((v) => Number.parseInt(v, 10));
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMs = getTimeZoneOffsetMs(new Date(asUtc), timeZone);
  // 墙钟时刻对应的 UTC = 把该墙钟当成 UTC 后再减去时区偏移
  let utcMs = asUtc - offsetMs;
  // DST 边界再校正一次
  const offset2 = getTimeZoneOffsetMs(new Date(utcMs), timeZone);
  if (offset2 !== offsetMs) {
    utcMs = asUtc - offset2;
  }
  return new Date(utcMs);
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}
