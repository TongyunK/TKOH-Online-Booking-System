/**
 * Venue 多房间 × 多日 × 多时段 — 日历级并发抢订压测
 *
 * 环境变量：见 README.md
 */

import {
  addDaysYmd,
  corpIdForUserIndex,
  ensureWeekdayYmd,
  login as loginCommon,
  mapPool,
  percentile,
  requestJson as requestJsonCommon,
  SEED_VENUE_NAMES,
  seedUserCanBookVenue,
  tomorrowYmd,
} from './common.mjs';
import { writeLoadTestReport } from './report.mjs';

const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:3210').replace(/\/$/, '');
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY || 100));
const USER_COUNT = Math.max(1, Number(process.env.USER_COUNT || CONCURRENCY));
const USER_START = Math.max(1, Number(process.env.USER_START || 2));
const MAX_SEED_USER = Math.max(USER_START, Number(process.env.MAX_SEED_USER || 25));
const DAYS = Math.max(1, Number(process.env.DAYS || 7));
const TARGET_MODE = (process.env.TARGET_MODE || 'spread').toLowerCase();
const HOT_ROOM = process.env.HOT_ROOM || process.env.ROOM_NAME || 'Conference Room 1';
const HOT_DATE = process.env.HOT_DATE || '';
const HOT_START = process.env.HOT_START || process.env.START_TIME || '10:00';
const HOT_END = process.env.HOT_END || process.env.END_TIME || '11:00';
const PASSWORD = process.env.PASSWORD || '123456';
const DRY_RUN = process.env.DRY_RUN === '1';
const START_DATE_ENV = process.env.START_DATE || '';

const ROOM_NAMES = (process.env.ROOM_NAMES || SEED_VENUE_NAMES.join(','))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** 默认 10 段／房间／天（互不重叠，并预留约 15 分钟 gap） */
const TIME_SLOTS = (process.env.TIME_SLOTS ||
  '09:00-09:45,10:00-10:45,11:00-11:45,12:00-12:45,13:00-13:45,14:00-14:45,15:00-15:45,16:00-16:45,17:00-17:45,18:00-18:45')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((pair) => {
    const [startTime, endTime] = pair.split('-').map((x) => x.trim());
    if (!startTime || !endTime) throw new Error(`Invalid TIME_SLOTS entry: ${pair}`);
    return { startTime, endTime };
  });

async function requestJson(method, path, opts = {}) {
  return requestJsonCommon(BASE_URL, method, path, opts);
}

async function login(corpId) {
  return loginCommon(BASE_URL, corpId, { password: PASSWORD, system: 'room' });
}

function classifyResult({ status, data }) {
  const msg = Array.isArray(data?.message)
    ? data.message.join(' ')
    : String(data?.message || '');
  if (status >= 200 && status < 300) return 'success';
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

function buildWeekdays(startYmd, dayCount) {
  const dates = [];
  let cursor = ensureWeekdayYmd(startYmd);
  while (dates.length < dayCount) {
    const d = new Date(`${cursor}T12:00:00`);
    const day = d.getDay();
    if (day !== 0 && day !== 6) dates.push(cursor);
    cursor = addDaysYmd(cursor, 1);
  }
  return dates;
}

function buildCells(dates, rooms, slots) {
  const cells = [];
  for (const date of dates) {
    for (const roomName of rooms) {
      for (const slot of slots) {
        cells.push({
          date,
          roomName,
          startTime: slot.startTime,
          endTime: slot.endTime,
          key: `${roomName}|${date}|${slot.startTime}-${slot.endTime}`,
        });
      }
    }
  }
  return cells;
}

function pickTarget(cells, workerIndex) {
  if (!cells.length) throw new Error('No booking cells');
  if (TARGET_MODE === 'hot') {
    const date = HOT_DATE || cells[0].date;
    return {
      date,
      roomName: HOT_ROOM,
      startTime: HOT_START,
      endTime: HOT_END,
      key: `${HOT_ROOM}|${date}|${HOT_START}-${HOT_END}`,
    };
  }
  if (TARGET_MODE === 'random') {
    return cells[Math.floor(Math.random() * cells.length)];
  }
  return cells[workerIndex % cells.length];
}

async function createBooking(session, target) {
  const { status, data, elapsed } = await requestJson('POST', '/api/venue-calendar/bookings', {
    token: session.token,
    body: {
      roomName: target.roomName,
      date: target.date,
      startTime: target.startTime,
      endTime: target.endTime,
      topic: `LoadTest Venue ${session.corpId} ${target.key}`,
      attendeeCount: 1,
      teaServiceRequired: false,
    },
  });
  return { status, data, elapsed, corpId: session.corpId, target };
}

async function main() {
  console.log('=== Venue Calendar Stress (抢订 / 多日×多房间×多时段) ===\n');
  console.log({
    BASE_URL,
    CONCURRENCY,
    USER_COUNT,
    MAX_SEED_USER,
    DAYS,
    TARGET_MODE,
    ROOM_NAMES: ROOM_NAMES.length,
    TIME_SLOTS: TIME_SLOTS.map((s) => `${s.startTime}-${s.endTime}`),
    DRY_RUN,
  });

  const eligible = eligibleUserIndexes();
  if (!eligible.length) {
    console.error('No seed users eligible for venue booking.');
    process.exit(1);
  }
  console.log(`Eligible venue users: ${eligible.length}`);

  const userIndexes = Array.from(
    { length: USER_COUNT },
    (_, i) => eligible[i % eligible.length],
  );

  console.log(`\nLogging in unique users (sessions=${userIndexes.length})...`);
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
    console.log('Login failures (sample):', loginFailures.slice(0, 3));
  }
  if (!sessionByUserIndex.size) process.exit(1);

  const startDate = ensureWeekdayYmd(START_DATE_ENV || tomorrowYmd());
  const dates = buildWeekdays(startDate, DAYS);
  const cells = buildCells(dates, ROOM_NAMES, TIME_SLOTS);
  const maxTheoreticalSuccess = cells.length; // 每格 1 间房时段

  console.log('\n--- Calendar ---');
  console.log('Date range (weekdays):', dates[0], '→', dates[dates.length - 1], `(${dates.length} days)`);
  console.log('Rooms:', ROOM_NAMES.length);
  console.log('Time slots:', TIME_SLOTS.map((s) => `${s.startTime}-${s.endTime}`).join(', '));
  console.log('Cells (room × date × slot):', cells.length);
  console.log('Max theoretical successes:', maxTheoreticalSuccess);
  console.log(
    'Clear SQL:',
    `DELETE FROM venue_bookings WHERE booking_date >= DATE '${dates[0]}' AND booking_date <= DATE '${dates[dates.length - 1]}' AND (status IS NULL OR LOWER(status) <> 'cancelled');`,
  );

  if (DRY_RUN) {
    console.log('\nDRY_RUN=1, skip bookings.');
    return;
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => {
    const userIndex = userIndexes[i];
    const session = sessionByUserIndex.get(userIndex);
    if (!session) throw new Error(`No session for user index ${userIndex}`);
    return { session, target: pickTarget(cells, i) };
  });

  console.log(`\nFiring ${CONCURRENCY} concurrent venue booking requests (mode=${TARGET_MODE})...`);
  const startedAt = Date.now();
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
  const totalMs = Date.now() - startedAt;

  const buckets = { success: 0, conflict: 0, error: 0, duplicateRoom: 0 };
  const latencies = [];
  const successByCell = new Map();
  const errorsSample = [];
  const errorByStatus = {};

  for (const r of results) {
    const kind = classifyResult(r);
    buckets[kind]++;
    if (r.elapsed > 0) latencies.push(r.elapsed);
    if (kind === 'success') {
      const key = r.target?.key || 'unknown';
      const list = successByCell.get(key) || [];
      list.push(r.data?.id != null ? String(r.data.id) : '?');
      successByCell.set(key, list);
    } else if (kind === 'error') {
      const code = String(r.status || 0);
      errorByStatus[code] = (errorByStatus[code] || 0) + 1;
      if (errorsSample.length < 8) {
        errorsSample.push({
          corpId: r.corpId,
          status: r.status,
          cell: r.target?.key,
          message: r.data?.message ?? r.data,
        });
      }
    }
  }

  for (const [, ids] of successByCell) {
    if (ids.length > 1) buckets.duplicateRoom += ids.length - 1;
  }

  latencies.sort((a, b) => a - b);
  const cellsAtCapacity = [...successByCell.values()].filter((ids) => ids.length >= 1).length;

  console.log('\n=== Results ===');
  console.log('Duration (wall):', `${totalMs} ms`);
  console.log('Outcomes:', {
    success: buckets.success,
    conflict: buckets.conflict,
    error: buckets.error,
    duplicateRoom: buckets.duplicateRoom,
  });
  console.log('Cells with ≥1 success:', `${cellsAtCapacity} / ${cells.length}`);
  if (buckets.duplicateRoom) {
    console.log('WARNING duplicateRoom (same cell success>1):', buckets.duplicateRoom);
    const oversold = [...successByCell.entries()].filter(([, ids]) => ids.length > 1).slice(0, 5);
    console.log('Oversold sample:', oversold);
  }
  if (latencies.length) {
    console.log('Latency ms:', {
      min: Math.round(latencies[0]),
      p50: Math.round(percentile(latencies, 50)),
      p95: Math.round(percentile(latencies, 95)),
      max: Math.round(latencies[latencies.length - 1]),
    });
  }
  if (errorsSample.length) console.log('\nSample errors:', errorsSample);

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
WHERE a.booking_date >= DATE '${dates[0]}'
  AND a.booking_date <= DATE '${dates[dates.length - 1]}'
  AND (a.status IS NULL OR LOWER(a.status) <> 'cancelled')
  AND (b.status IS NULL OR LOWER(b.status) <> 'cancelled')
  AND COALESCE(LOWER(a.approval_status),'pending') IN ('pending','approved')
  AND COALESCE(LOWER(b.approval_status),'pending') IN ('pending','approved')
  AND a.start_time < b.end_time AND a.end_time > b.start_time;`;

  const oversoldRows = [...successByCell.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => [key, String(ids.length), ids.join(',')]);

  writeLoadTestReport({
    scenario: 'venue-calendar',
    title: 'Venue 搶訂壓測結果（多日×多房間×多時段）',
    verdict:
      buckets.duplicateRoom > 0
        ? '未通過（duplicateRoom>0）'
        : '傾向通過（請再跑校驗 SQL）',
    config: {
      BASE_URL,
      CONCURRENCY,
      USER_COUNT,
      USER_START,
      MAX_SEED_USER,
      DAYS,
      TARGET_MODE,
      START_DATE: dates[0],
      date_range: `${dates[0]} → ${dates[dates.length - 1]}`,
      rooms: ROOM_NAMES.length,
      cells: cells.length,
      slots_per_cell: 1,
      max_theoretical_success: maxTheoreticalSuccess,
    },
    summary: {
      wall_ms: totalMs,
      success: buckets.success,
      conflict: buckets.conflict,
      error: buckets.error,
      duplicateRoom: buckets.duplicateRoom,
      cells_at_capacity: `${cellsAtCapacity}/${cells.length}`,
      latency_ms: lat,
    },
    tables: oversoldRows.length
      ? [
          {
            title: '疑似超賣格子（同格 success>1）',
            headers: ['cell', 'success_count', 'booking_ids'],
            rows: oversoldRows,
          },
        ]
      : [],
    notes: errorsSample.slice(0, 8).map(
      (e) =>
        `錯誤樣本: ${e.corpId} cell=${e.cell} status=${e.status} msg=${JSON.stringify(e.message)}`,
    ),
    sql: [verifySql],
    passHint: '建議：每格 success≤1；duplicateRoom=0；校驗 SQL 0 行。',
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
