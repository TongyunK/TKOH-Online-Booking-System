/**
 * Venue 抢订并发压测（Node 18+，无需额外依赖）
 * 单格热点：多用户同时对同一「房间 + 日期 + 时段」POST /api/venue-calendar/bookings
 *
 * 环境变量：见 README.md
 */

import {
  corpIdForUserIndex,
  ensureWeekdayYmd,
  login as loginCommon,
  mapPool,
  percentile,
  requestJson as requestJsonCommon,
  seedUserCanBookVenue,
  tomorrowYmd,
} from './common.mjs';
import { writeLoadTestReport } from './report.mjs';

const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:3210').replace(/\/$/, '');
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY || 50));
const USER_COUNT = Math.max(1, Number(process.env.USER_COUNT || CONCURRENCY));
const USER_START = Math.max(1, Number(process.env.USER_START || 2));
const MAX_SEED_USER = Math.max(USER_START, Number(process.env.MAX_SEED_USER || 25));
const ROOM_NAME = process.env.ROOM_NAME || 'Conference Room 1';
const START_TIME = process.env.START_TIME || '10:00';
const END_TIME = process.env.END_TIME || '11:00';
const PASSWORD = process.env.PASSWORD || '123456';
const DRY_RUN = process.env.DRY_RUN === '1';
const BOOKING_DATE_RAW = process.env.BOOKING_DATE || tomorrowYmd();
const BOOKING_DATE = ensureWeekdayYmd(BOOKING_DATE_RAW);

async function requestJson(method, path, opts = {}) {
  return requestJsonCommon(BASE_URL, method, path, opts);
}

async function login(corpId) {
  return loginCommon(BASE_URL, corpId, { password: PASSWORD, system: 'room' });
}

async function createBooking(session) {
  const { status, data, elapsed } = await requestJson('POST', '/api/venue-calendar/bookings', {
    token: session.token,
    body: {
      roomName: ROOM_NAME,
      date: BOOKING_DATE,
      startTime: START_TIME,
      endTime: END_TIME,
      topic: `LoadTest Venue Hot ${session.corpId}`,
      attendeeCount: 1,
      teaServiceRequired: false,
    },
  });
  return { status, data, elapsed, corpId: session.corpId };
}

function classifyResult({ status, data }) {
  const msg = Array.isArray(data?.message)
    ? data.message.join(' ')
    : String(data?.message || '');

  if (status >= 200 && status < 300) return 'success';
  // Venue 冲突多为 400「Selected time slot is not available」，少见 409
  if (
    status === 409 ||
    /not available|conflicts with a blocked|slot is not available|overlap/i.test(msg)
  ) {
    return 'conflict';
  }
  return 'error';
}

function eligibleUserIndexes() {
  const list = [];
  for (let i = USER_START; i <= MAX_SEED_USER; i++) {
    if (seedUserCanBookVenue(i)) list.push(i);
  }
  return list;
}

async function main() {
  console.log('=== Venue Booking Load Test (抢订 / 单格) ===');
  console.log({
    BASE_URL,
    CONCURRENCY,
    USER_COUNT,
    USER_START,
    MAX_SEED_USER,
    BOOKING_DATE_RAW,
    BOOKING_DATE,
    ROOM_NAME,
    START_TIME,
    END_TIME,
    DRY_RUN,
  });
  if (BOOKING_DATE !== BOOKING_DATE_RAW) {
    console.log(`Note: BOOKING_DATE 周末已顺延 → ${BOOKING_DATE}`);
  }
  console.log('');

  const eligible = eligibleUserIndexes();
  if (!eligible.length) {
    console.error('No seed users eligible for venue booking (skipped User_EV).');
    process.exit(1);
  }
  console.log(
    `Eligible venue users in seed span: ${eligible.length} (skipped User_EV with venue quota=0)`,
  );

  const userIndexes = Array.from(
    { length: USER_COUNT },
    (_, i) => eligible[i % eligible.length],
  );

  console.log(`Logging in ${userIndexes.length} sessions (unique=${new Set(userIndexes).size})...`);
  const sessionByUserIndex = new Map();
  const loginFailures = [];

  await mapPool([...new Set(userIndexes)], 8, async (userIndex) => {
    const corpId = corpIdForUserIndex(userIndex);
    try {
      const { token } = await login(corpId);
      sessionByUserIndex.set(userIndex, { corpId, userIndex, token });
    } catch (e) {
      loginFailures.push({ corpId, error: e.message });
    }
  });

  console.log(`Logged in: ${sessionByUserIndex.size}, failed: ${loginFailures.length}`);
  if (loginFailures.length) {
    console.log('Login failures (first 5):', loginFailures.slice(0, 5));
  }
  if (!sessionByUserIndex.size) process.exit(1);

  console.log(
    `Hot cell: ${ROOM_NAME} @ ${BOOKING_DATE} ${START_TIME}-${END_TIME} → 理论最多 success=1`,
  );
  console.log(
    `Clear SQL: DELETE FROM venue_bookings WHERE booking_date = DATE '${BOOKING_DATE}' AND venue_id = (SELECT id FROM venues WHERE name = '${ROOM_NAME.replace(/'/g, "''")}' LIMIT 1) AND start_time = TIME '${START_TIME}' AND end_time = TIME '${END_TIME}' AND (status IS NULL OR LOWER(status) <> 'cancelled');`,
  );
  console.log('');

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

  console.log(`\nFiring ${CONCURRENCY} concurrent venue booking requests...`);
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

  const buckets = { success: 0, conflict: 0, error: 0, duplicateRoom: 0 };
  const latencies = [];
  const successIds = [];
  const errorsSample = [];
  const errorByStatus = {};

  for (const r of results) {
    const kind = classifyResult(r);
    buckets[kind]++;
    if (r.elapsed > 0) latencies.push(r.elapsed);
    if (kind === 'success') {
      const id = r.data?.id != null ? String(r.data.id) : null;
      if (id) successIds.push(id);
    } else if (kind === 'error') {
      const code = String(r.status || 0);
      errorByStatus[code] = (errorByStatus[code] || 0) + 1;
      if (errorsSample.length < 8) {
        errorsSample.push({
          corpId: r.corpId,
          status: r.status,
          message: r.data?.message ?? r.data,
        });
      }
    }
  }

  // 单格理论容量=1；响应层 success>1 即疑似超卖
  if (buckets.success > 1) {
    buckets.duplicateRoom = buckets.success - 1;
  }

  latencies.sort((a, b) => a - b);

  console.log('\n=== Results ===');
  console.log('Duration (wall):', `${totalMs} ms`);
  console.log('Outcomes:', {
    success: buckets.success,
    conflict: buckets.conflict,
    error: buckets.error,
    duplicateRoom: buckets.duplicateRoom,
  });
  console.log('Success booking ids:', successIds);
  if (buckets.duplicateRoom) {
    console.log('WARNING duplicateRoom (success>1 on same cell):', buckets.duplicateRoom);
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

  console.log('\nNext: run SQL in report to verify no overlapping active bookings for the hot cell.');

  const lat = latencies.length
    ? {
        min: Math.round(latencies[0]),
        p50: Math.round(percentile(latencies, 50)),
        p95: Math.round(percentile(latencies, 95)),
        max: Math.round(latencies[latencies.length - 1]),
      }
    : null;

  const verifySql = `SELECT a.id AS id_a, b.id AS id_b, a.venue_id, a.booking_date::date, a.start_time, a.end_time
FROM venue_bookings a
JOIN venue_bookings b ON a.venue_id = b.venue_id AND a.booking_date = b.booking_date AND a.id < b.id
WHERE a.booking_date = DATE '${BOOKING_DATE}'
  AND a.venue_id = (SELECT id FROM venues WHERE name = '${ROOM_NAME.replace(/'/g, "''")}' LIMIT 1)
  AND (a.status IS NULL OR LOWER(a.status) <> 'cancelled')
  AND (b.status IS NULL OR LOWER(b.status) <> 'cancelled')
  AND COALESCE(LOWER(a.approval_status),'pending') IN ('pending','approved')
  AND COALESCE(LOWER(b.approval_status),'pending') IN ('pending','approved')
  AND a.start_time < b.end_time AND a.end_time > b.start_time;`;

  writeLoadTestReport({
    scenario: 'venue-hot',
    title: 'Venue 搶訂壓測結果（單格熱點）',
    verdict:
      buckets.duplicateRoom > 0
        ? '未通過（duplicateRoom>0 / success>1）'
        : '傾向通過（請再跑校驗 SQL）',
    config: {
      BASE_URL,
      CONCURRENCY,
      USER_COUNT,
      USER_START,
      MAX_SEED_USER,
      BOOKING_DATE,
      ROOM_NAME,
      START_TIME,
      END_TIME,
      slots_per_cell: 1,
      max_theoretical_success: 1,
    },
    summary: {
      wall_ms: totalMs,
      success: buckets.success,
      conflict: buckets.conflict,
      error: buckets.error,
      duplicateRoom: buckets.duplicateRoom,
      unique_bookings: successIds.length,
      latency_ms: lat,
    },
    notes: errorsSample.slice(0, 8).map(
      (e) => `錯誤樣本: ${e.corpId} status=${e.status} msg=${JSON.stringify(e.message)}`,
    ),
    sql: [verifySql],
    passHint: '建議：success≤1；duplicateRoom=0；校驗 SQL 0 行。衝突多為 400 not available。',
    extras: {
      errorByStatus,
      businessErrorHint: true,
      sqlVerifiedZeroRows:
        process.env.SQL_VERIFIED === '1'
          ? true
          : process.env.SQL_VERIFIED === '0'
            ? false
            : null,
    },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
