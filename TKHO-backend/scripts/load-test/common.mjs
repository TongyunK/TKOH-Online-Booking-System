/**
 * 压测共用：登录（corpId）、HTTP、并发池、分位数
 */

export function corpIdForUserIndex(i) {
  return i === 1 ? 'Admin-test' : `E${String(i).padStart(3, '0')}`;
}

export function addDaysYmd(startYmd, offset) {
  const d = new Date(`${startYmd}T12:00:00`);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function tomorrowYmd() {
  return addDaysYmd(new Date().toISOString().slice(0, 10), 1);
}

export function weekStartYmd(ymd = tomorrowYmd()) {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

export async function requestJson(baseUrl, method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const started = performance.now();
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const elapsed = performance.now() - started;

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  return { status: res.status, data, elapsed };
}

/**
 * @param {string} baseUrl
 * @param {string} corpId
 * @param {{ password?: string, system?: 'parking'|'room'|'admin' }} [opts]
 */
export async function login(baseUrl, corpId, opts = {}) {
  const password = opts.password || '123456';
  const system = opts.system || 'parking';
  const { status, data } = await requestJson(baseUrl, 'POST', '/api/auth/login', {
    body: { corpId, password, system },
  });
  if (status !== 201 && status !== 200) {
    throw new Error(`Login ${corpId} failed: HTTP ${status} ${JSON.stringify(data)}`);
  }
  if (!data?.token) throw new Error(`Login ${corpId}: no token`);
  return { token: data.token };
}

export function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

export async function mapPool(items, limit, worker) {
  let next = 0;
  async function runner() {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runner()));
}

export function summarizeLatencies(latencies) {
  if (!latencies.length) return null;
  const sorted = [...latencies].sort((a, b) => a - b);
  return {
    count: sorted.length,
    min: Math.round(sorted[0]),
    p50: Math.round(percentile(sorted, 50)),
    p95: Math.round(percentile(sorted, 95)),
    max: Math.round(sorted[sorted.length - 1]),
  };
}

/**
 * Seed 中 User_EV：annualVenueQuota=0，无法订 Venue。
 * Admin-test(i=1)、E016(i=16) 为 Admin；其余 i%3===2 为 User_EV（E002,E005,...）。
 */
export function seedUserCanBookVenue(userIndex) {
  const i = Number(userIndex);
  if (i === 1 || i === 16) return true;
  return i % 3 !== 2;
}

/** 若为周六日则顺延到下一个周一（非 Admin 周末/假日规则仍可能拒绝） */
export function ensureWeekdayYmd(ymd) {
  const d = new Date(`${ymd}T12:00:00`);
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() + 1);
  else if (day === 6) d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
}

export const SEED_VENUE_NAMES = [
  'Conference Room 1',
  'Conference Room 2',
  'Conference Room 3',
  'Discussion Room',
  'Function Room',
  'Lecture Theatre',
  'Auditorium',
];
