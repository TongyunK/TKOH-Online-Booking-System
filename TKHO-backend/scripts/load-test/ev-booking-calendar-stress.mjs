/**
 * 14 天 × 多时段 × N 车位 — 日历级并发抢订压测
 *
 * 环境变量：见 README.md
 */

import {
  addDaysYmd,
  corpIdForUserIndex,
  login as loginCommon,
  mapPool,
  percentile,
  requestJson as requestJsonCommon,
} from './common.mjs';
import { writeLoadTestReport } from './report.mjs';

const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:3210').replace(/\/$/, '');
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY || 100));
const USER_COUNT = Math.max(1, Number(process.env.USER_COUNT || CONCURRENCY));
const USER_START = Math.max(1, Number(process.env.USER_START || 2));
const MAX_SEED_USER = Math.max(USER_START, Number(process.env.MAX_SEED_USER || 25));
const DAYS = Math.max(1, Number(process.env.DAYS || 14));
const PERIOD_IDS = (process.env.PERIOD_IDS || '1,2,3')
  .split(',')
  .map((s) => s.trim())
  .filter((s) => /^\d+$/.test(s));
const TARGET_MODE = (process.env.TARGET_MODE || 'spread').toLowerCase();
const HOT_DATE = process.env.HOT_DATE || '';
const HOT_PERIOD_ID = String(process.env.HOT_PERIOD_ID || '1');
const PASSWORD = process.env.PASSWORD || '123456';
const DRY_RUN = process.env.DRY_RUN === '1';
const START_DATE_ENV = process.env.START_DATE || '';

async function requestJson(method, path, opts = {}) {
  return requestJsonCommon(BASE_URL, method, path, opts);
}

async function login(corpId) {
  return loginCommon(BASE_URL, corpId, { password: PASSWORD, system: 'parking' });
}

async function resolveLicensePlateId(token, userIndex) {
  const { status, data } = await requestJson('GET', '/api/account/vehicles', { token });
  if (status !== 200) throw new Error(`List vehicles failed: HTTP ${status}`);
  const vehicles = Array.isArray(data?.vehicles) ? data.vehicles : [];
  const active = vehicles.filter((v) => String(v.status || 'active').toLowerCase() === 'active');
  if (active.length) {
    const picked = active.find((v) => v.isDefault) || active[0];
    return String(picked.id);
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const plateNumber = `LT${String(userIndex).padStart(3, '0')}${Date.now() % 100000}${attempt}`;
    const created = await requestJson('POST', '/api/account/vehicles', {
      token,
      body: { plateNumber, isDefault: true },
    });
    if (created.status === 200 || created.status === 201) {
      const id = created.data?.vehicle?.id;
      if (id) return String(id);
    }
  }
  throw new Error(`Create vehicle failed for user index ${userIndex}`);
}

async function fetchBookingWindow(token) {
  const { status, data } = await requestJson('GET', '/api/ev-management/booking-window', {
    token,
  });
  if (status !== 200) return null;
  return {
    start: data?.currentStartDate || '',
    end: data?.currentEndDate || '',
  };
}

async function fetchTotalSpaces(token, startDate, endDate) {
  const { status, data } = await requestJson(
    'GET',
    `/api/parking/calendar-availability?startDate=${startDate}&endDate=${endDate}`,
    { token },
  );
  if (status !== 200) return null;
  return Number(data?.totalSpaces) || 0;
}

function classifyResult({ status, data }) {
  const msg = Array.isArray(data?.message)
    ? data.message.join(' ')
    : String(data?.message || '');
  if (status >= 200 && status < 300) return 'success';
  if (status === 409 || /fully booked|unavailable|in progress/i.test(msg)) return 'conflict';
  return 'error';
}

function buildDateRange(startYmd, dayCount, endYmd) {
  const dates = [];
  for (let i = 0; i < dayCount; i++) {
    const ymd = addDaysYmd(startYmd, i);
    if (endYmd && ymd > endYmd) break;
    dates.push(ymd);
  }
  return dates;
}

function buildCells(dates, periodIds) {
  const cells = [];
  for (const date of dates) {
    for (const periodId of periodIds) {
      cells.push({ date, periodId, key: `${date}-${periodId}` });
    }
  }
  return cells;
}

function pickTarget(cells, workerIndex) {
  if (!cells.length) throw new Error('No booking cells (check dates / PERIOD_IDS)');
  if (TARGET_MODE === 'hot') {
    const date = HOT_DATE || cells[0].date;
    return { date, periodId: HOT_PERIOD_ID, key: `${date}-${HOT_PERIOD_ID}` };
  }
  if (TARGET_MODE === 'random') {
    return cells[Math.floor(Math.random() * cells.length)];
  }
  return cells[workerIndex % cells.length];
}

async function createBooking(session, target) {
  const { status, data, elapsed } = await requestJson('POST', '/api/parking/bookings', {
    token: session.token,
    body: {
      licensePlateId: session.licensePlateId,
      periodId: target.periodId,
      bookingDate: target.date,
    },
  });
  return { status, data, elapsed, corpId: session.corpId, target };
}

async function main() {
  console.log('=== EV Calendar Stress (抢订 / 多日×多时段) ===\n');
  console.log({
    BASE_URL,
    CONCURRENCY,
    USER_COUNT,
    MAX_SEED_USER,
    DAYS,
    PERIOD_IDS,
    TARGET_MODE,
    DRY_RUN,
  });

  const span = MAX_SEED_USER - USER_START + 1;
  const userIndexes = Array.from({ length: USER_COUNT }, (_, i) => USER_START + (i % span));

  console.log(`\nLogging in unique users (span=${span}, sessions=${userIndexes.length})...`);
  const sessionByUserIndex = new Map();
  const loginFailures = [];

  await mapPool([...new Set(userIndexes)], 8, async (userIndex) => {
    const corpId = corpIdForUserIndex(userIndex);
    try {
      const { token } = await login(corpId);
      const licensePlateId = await resolveLicensePlateId(token, userIndex);
      sessionByUserIndex.set(userIndex, { corpId, userIndex, token, licensePlateId });
    } catch (e) {
      loginFailures.push({ corpId, error: e.message });
    }
  });

  console.log(`Logged in: ${sessionByUserIndex.size}, failed: ${loginFailures.length}`);
  if (loginFailures.length) {
    console.log('Login failures (sample):', loginFailures.slice(0, 3));
  }
  if (!sessionByUserIndex.size) process.exit(1);

  const token = sessionByUserIndex.values().next().value.token;
  const window = await fetchBookingWindow(token);
  const startDate =
    START_DATE_ENV || window?.start || addDaysYmd(new Date().toISOString().slice(0, 10), 1);
  const endDate = window?.end || addDaysYmd(startDate, DAYS - 1);
  const dates = buildDateRange(startDate, DAYS, endDate);
  const cells = buildCells(dates, PERIOD_IDS);

  const totalSpaces = await fetchTotalSpaces(token, dates[0], dates[dates.length - 1]);
  const slotsPerCell = totalSpaces ?? 3;
  const maxTheoreticalSuccess = cells.length * slotsPerCell;

  console.log('\n--- Calendar ---');
  console.log('Booking window:', window || '(API failed, using START_DATE / tomorrow)');
  console.log('Date range:', dates[0], '→', dates[dates.length - 1], `(${dates.length} days)`);
  console.log('Period IDs:', PERIOD_IDS.join(', '));
  console.log('Cells (date × period):', cells.length);
  console.log('Slots per cell (totalSpaces):', slotsPerCell);
  console.log('Max theoretical successes:', maxTheoreticalSuccess);
  console.log(
    'Clear SQL:',
    `DELETE FROM ev_bookings WHERE booking_date >= DATE '${dates[0]}' AND booking_date <= DATE '${dates[dates.length - 1]}' AND period_id IN (${PERIOD_IDS.join(',')});`,
  );

  if (DRY_RUN) {
    console.log('\nDRY_RUN=1, skip bookings.');
    return;
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => {
    const userIndex = userIndexes[i];
    const session = sessionByUserIndex.get(userIndex);
    if (!session) throw new Error(`No session for user index ${userIndex} (login failed)`);
    return { session, target: pickTarget(cells, i) };
  });

  console.log(`\nFiring ${CONCURRENCY} concurrent bookings (mode=${TARGET_MODE})...`);
  const wallStart = Date.now();
  const results = await Promise.all(
    workers.map(({ session, target }) =>
      createBooking(session, target).catch((e) => ({
        status: 0,
        data: { message: e.message },
        elapsed: 0,
        corpId: session.corpId,
        target,
      })),
    ),
  );
  const wallMs = Date.now() - wallStart;

  const buckets = { success: 0, conflict: 0, error: 0 };
  const latencies = [];
  const cellStats = new Map();
  const slotKeys = new Set();
  const duplicateSlot = { count: 0 };
  const errorsSample = [];

  for (const r of results) {
    const kind = classifyResult(r);
    buckets[kind]++;
    if (r.elapsed > 0) latencies.push(r.elapsed);

    const ck = r.target?.key || '?';
    if (!cellStats.has(ck)) cellStats.set(ck, { success: 0, conflict: 0, error: 0 });
    cellStats.get(ck)[kind]++;

    if (kind === 'success') {
      const slotId = r.data?.booking?.slotId;
      const bookingDate = r.data?.booking?.bookingDate;
      const periodId = r.data?.booking?.periodId;
      const sk = `${bookingDate}-${periodId}-${slotId}`;
      if (slotKeys.has(sk)) duplicateSlot.count++;
      slotKeys.add(sk);
    } else if (kind === 'error' && errorsSample.length < 6) {
      errorsSample.push({
        corpId: r.corpId,
        target: r.target,
        status: r.status,
        message: r.data?.message ?? r.data,
      });
    }
  }

  latencies.sort((a, b) => a - b);

  console.log('\n=== Overall ===');
  console.log('Wall time ms:', wallMs);
  console.log('Outcomes:', buckets);
  console.log(
    'Success vs capacity:',
    `${buckets.success} / ${maxTheoreticalSuccess} (if DB was empty)`,
  );
  if (duplicateSlot.count) {
    console.log('WARNING same slot+date+period booked twice in responses:', duplicateSlot.count);
  }
  if (latencies.length) {
    console.log('Latency ms:', {
      min: Math.round(latencies[0]),
      p50: Math.round(percentile(latencies, 50)),
      p95: Math.round(percentile(latencies, 95)),
      max: Math.round(latencies[latencies.length - 1]),
    });
  }

  const hotCells = [...cellStats.entries()]
    .map(([key, stats]) => ({ key, ...stats }))
    .sort((a, b) => b.success + b.conflict - (a.success + a.conflict))
    .slice(0, 12);

  console.log('\n=== Per cell (top activity) ===');
  console.table(hotCells);

  const fullCells = [...cellStats.values()].filter((s) => s.success >= slotsPerCell).length;
  console.log(`\nCells at capacity (success >= ${slotsPerCell}):`, fullCells, '/', cells.length);

  if (errorsSample.length) {
    console.log('\nSample errors:', errorsSample);
  }

  console.log('\nVerify SQL (no duplicate slot per date+period):');
  const verifySql = `SELECT slot_id, period_id, booking_date, COUNT(*) FROM ev_bookings WHERE status IN ('pending','confirmed') AND booking_date >= DATE '${dates[0]}' AND booking_date <= DATE '${dates[dates.length - 1]}' GROUP BY 1,2,3 HAVING COUNT(*)>1;`;
  console.log(verifySql);

  const lat = latencies.length
    ? {
        min: Math.round(latencies[0]),
        p50: Math.round(percentile(latencies, 50)),
        p95: Math.round(percentile(latencies, 95)),
        max: Math.round(latencies[latencies.length - 1]),
      }
    : null;

  const verdict =
    duplicateSlot.count > 0
      ? '未通過（疑似超賣 duplicateSlot>0）'
      : buckets.error > buckets.success + buckets.conflict
        ? '需解讀（error 較多，多為業務拒絕或系統問題，請看錯誤樣本）'
        : '傾向通過（請再跑校驗 SQL，期望 0 行）';

  writeLoadTestReport({
    scenario: 'ev-calendar',
    title: 'EV 搶訂壓測結果（多日×多時段）',
    verdict,
    config: {
      BASE_URL,
      CONCURRENCY,
      USER_COUNT,
      MAX_SEED_USER,
      DAYS,
      PERIOD_IDS: PERIOD_IDS.join(','),
      TARGET_MODE,
      date_range: `${dates[0]} → ${dates[dates.length - 1]}`,
      cells: cells.length,
      slots_per_cell: slotsPerCell,
      max_theoretical_success: maxTheoreticalSuccess,
    },
    summary: {
      wall_ms: wallMs,
      success: buckets.success,
      conflict: buckets.conflict,
      error: buckets.error,
      duplicateSlot: duplicateSlot.count,
      cells_at_capacity: `${fullCells} / ${cells.length}`,
      latency_ms: lat,
    },
    tables: [
      {
        title: '各格子活動（最高 12 格）',
        headers: ['key', 'success', 'conflict', 'error'],
        rows: hotCells.map((c) => [c.key, c.success, c.conflict, c.error]),
      },
    ],
    notes: [
      ...errorsSample.slice(0, 6).map(
        (e) =>
          `錯誤樣本: ${e.corpId} status=${e.status} target=${e.target?.key} msg=${JSON.stringify(e.message)}`,
      ),
      '403 EV booking quota exceeded 常為 User_Venue 無 EV 配額；400 weekend 為週末不可訂。',
    ],
    sql: [verifySql],
    passHint:
      '建議：duplicateSlot=0；校驗 SQL 0 行；success 不超過車位容量；error 以業務拒絕為主而非大量 5xx。',
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
