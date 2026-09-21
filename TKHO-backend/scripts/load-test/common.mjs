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
