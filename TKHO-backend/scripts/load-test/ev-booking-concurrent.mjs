/**
 * EV 抢订并发压测（Node 18+，无需额外依赖）
 * 单格热点：多用户同时对同一「日期 + 时段」POST /api/parking/bookings
 *
 * 环境变量：见 README.md
 */

import {
  corpIdForUserIndex,
  login as loginCommon,
  mapPool,
  percentile,
  requestJson as requestJsonCommon,
  tomorrowYmd,
} from './common.mjs';
import { writeLoadTestReport } from './report.mjs';

const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:3210').replace(/\/$/, '');
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY || 50));
const USER_COUNT = Math.max(1, Number(process.env.USER_COUNT || CONCURRENCY));
const USER_START = Math.max(1, Number(process.env.USER_START || 2));
const MAX_SEED_USER = Math.max(USER_START, Number(process.env.MAX_SEED_USER || 25));
const PERIOD_ID = String(process.env.PERIOD_ID || '1');
const PASSWORD = process.env.PASSWORD || '123456';
const DRY_RUN = process.env.DRY_RUN === '1';
const BOOKING_DATE = process.env.BOOKING_DATE || tomorrowYmd();

async function requestJson(method, path, opts = {}) {
  return requestJsonCommon(BASE_URL, method, path, opts);
}

async function login(corpId) {
  return loginCommon(BASE_URL, corpId, { password: PASSWORD, system: 'parking' });
}

async function resolveLicensePlateId(token, userIndex) {
  const { status, data } = await requestJson('GET', '/api/account/vehicles', { token });
  if (status !== 200) {
    throw new Error(`List vehicles failed: HTTP ${status}`);
  }
  const vehicles = Array.isArray(data?.vehicles) ? data.vehicles : [];
  const active = vehicles.filter((v) => String(v.status || 'active').toLowerCase() === 'active');
  if (active.length) {
    const picked = active.find((v) => v.isDefault) || active[0];
    return String(picked.id);
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const plateNumber = `LT${String(userIndex).padStart(3, '0')}${String(Date.now() % 100000)}${attempt}`;
    const created = await requestJson('POST', '/api/account/vehicles', {
      token,
      body: { plateNumber, isDefault: true },
    });
    if (created.status === 200 || created.status === 201) {
      const id = created.data?.vehicle?.id;
      if (!id) throw new Error('Create vehicle: missing id');
      return String(id);
    }
    if (created.status === 400 && /already exists/i.test(JSON.stringify(created.data))) {
      const retryList = await requestJson('GET', '/api/account/vehicles', { token });
      const list = Array.isArray(retryList.data?.vehicles) ? retryList.data.vehicles : [];
      const act = list.filter((v) => String(v.status || 'active').toLowerCase() === 'active');
      if (act.length) return String((act.find((v) => v.isDefault) || act[0]).id);
    }
  }
  throw new Error(`Create vehicle failed for user index ${userIndex}`);
}

async function fetchTotalSpaces(token) {
  const { status, data } = await requestJson(
    'GET',
    `/api/parking/calendar-availability?startDate=${BOOKING_DATE}&endDate=${BOOKING_DATE}`,
    { token },
  );
  if (status !== 200) return null;
  return Number(data?.totalSpaces) || 0;
}

async function createBooking(session) {
  const { status, data, elapsed } = await requestJson('POST', '/api/parking/bookings', {
    token: session.token,
    body: {
      licensePlateId: String(session.licensePlateId),
      periodId: PERIOD_ID,
      bookingDate: BOOKING_DATE,
    },
  });
  return { status, data, elapsed, corpId: session.corpId };
}

function classifyResult({ status, data }) {
  const msg = Array.isArray(data?.message)
    ? data.message.join(' ')
    : String(data?.message || '');

  if (status >= 200 && status < 300) return 'success';
  if (status === 409 || /fully booked|unavailable|in progress/i.test(msg)) {
    return 'conflict';
  }
  return 'error';
}

async function main() {
  console.log('=== EV Booking Load Test (抢订 / 单格) ===');
  console.log({
    BASE_URL,
    CONCURRENCY,
    USER_COUNT,
    USER_START,
    MAX_SEED_USER,
    BOOKING_DATE,
    PERIOD_ID,
    DRY_RUN,
  });
  console.log('');

  const span = MAX_SEED_USER - USER_START + 1;
  const userIndexes = Array.from({ length: USER_COUNT }, (_, i) => USER_START + (i % span));

  console.log(`Logging in ${userIndexes.length} sessions (unique seed span=${span})...`);
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
    console.log('Login failures (first 5):', loginFailures.slice(0, 5));
  }
  if (!sessionByUserIndex.size) process.exit(1);

  const totalSpaces = await fetchTotalSpaces(sessionByUserIndex.values().next().value.token);
  if (totalSpaces != null) {
    console.log(`Active EV slots (totalSpaces): ${totalSpaces}`);
    if (CONCURRENCY > totalSpaces) {
      console.log(
        `Hint: CONCURRENCY (${CONCURRENCY}) > slots (${totalSpaces}) → at most ${totalSpaces} success; rest should be conflict.`,
      );
    }
    console.log(
      `If success=0, clear bookings: DELETE FROM ev_bookings WHERE booking_date = DATE '${BOOKING_DATE}' AND period_id = ${PERIOD_ID};`,
    );
    console.log('');
  }

  if (DRY_RUN) {
    console.log('DRY_RUN=1, skip bookings.');
    return;
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => {
    const userIndex = userIndexes[i];
    const session = sessionByUserIndex.get(userIndex);
    if (!session) throw new Error(`No session for user index ${userIndex} (login failed)`);
    return session;
  });

  console.log(`\nFiring ${CONCURRENCY} concurrent booking requests...`);
  const startedAt = Date.now();
  const results = await Promise.all(
    workers.map((session) =>
      createBooking(session).catch((e) => ({
        status: 0,
        data: { message: e.message },
        elapsed: 0,
        corpId: session.corpId,
      })),
    ),
  );
  const totalMs = Date.now() - startedAt;

  const buckets = { success: 0, conflict: 0, error: 0 };
  const latencies = [];
  const successSlots = new Set();
  const errorsSample = [];

  for (const r of results) {
    const kind = classifyResult(r);
    buckets[kind]++;
    if (r.elapsed > 0) latencies.push(r.elapsed);
    if (kind === 'success') {
      const slotId = r.data?.booking?.slotId;
      if (slotId != null) {
        if (successSlots.has(String(slotId))) {
          buckets.duplicateSlot = (buckets.duplicateSlot || 0) + 1;
        }
        successSlots.add(String(slotId));
      }
    } else if (kind === 'error' && errorsSample.length < 8) {
      errorsSample.push({
        corpId: r.corpId,
        status: r.status,
        message: r.data?.message ?? r.data,
      });
    }
  }

  latencies.sort((a, b) => a - b);

  console.log('\n=== Results ===');
  console.log('Duration (wall):', `${totalMs} ms`);
  console.log('Outcomes:', buckets);
  console.log('Unique slots booked (from response):', successSlots.size);
  if (buckets.duplicateSlot) {
    console.log('WARNING duplicate slotId in responses:', buckets.duplicateSlot);
  }
  if (latencies.length) {
    console.log('Latency ms:', {
      min: Math.round(latencies[0]),
      p50: Math.round(percentile(latencies, 50)),
      p95: Math.round(percentile(latencies, 95)),
      max: Math.round(latencies[latencies.length - 1]),
    });
  }
  if (errorsSample.length) {
    console.log('\nSample errors:', errorsSample);
  }

  console.log('\nNext: run SQL in README to verify no duplicate active bookings per slot.');

  const lat = latencies.length
    ? {
        min: Math.round(latencies[0]),
        p50: Math.round(percentile(latencies, 50)),
        p95: Math.round(percentile(latencies, 95)),
        max: Math.round(latencies[latencies.length - 1]),
      }
    : null;

  const verifySql = `SELECT slot_id, period_id, booking_date, COUNT(*) FROM ev_bookings WHERE status IN ('pending','confirmed') AND booking_date = DATE '${BOOKING_DATE}' AND period_id = ${PERIOD_ID} GROUP BY 1,2,3 HAVING COUNT(*)>1;`;

  writeLoadTestReport({
    scenario: 'ev-hot',
    title: 'EV 搶訂壓測結果（單格熱點）',
    verdict:
      (buckets.duplicateSlot || 0) > 0
        ? '未通過（duplicateSlot>0）'
        : '傾向通過（請再跑校驗 SQL）',
    config: {
      BASE_URL,
      CONCURRENCY,
      USER_COUNT,
      USER_START,
      MAX_SEED_USER,
      BOOKING_DATE,
      PERIOD_ID,
    },
    summary: {
      wall_ms: totalMs,
      success: buckets.success,
      conflict: buckets.conflict,
      error: buckets.error,
      duplicateSlot: buckets.duplicateSlot || 0,
      unique_slots: successSlots.size,
      latency_ms: lat,
    },
    notes: errorsSample.slice(0, 8).map(
      (e) => `錯誤樣本: ${e.corpId} status=${e.status} msg=${JSON.stringify(e.message)}`,
    ),
    sql: [verifySql],
    passHint: '建議：success ≤ active 車位數；duplicateSlot=0；校驗 SQL 0 行。',
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
