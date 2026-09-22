/**
 * 日历浏览压测（读多写少）— 模拟 300–500 在线用户刷 EV / Venue 日历
 *
 * 对齐前端行为：
 *   EV：约每 10s 拉 calendar-availability，约每 60s 拉 booking-window
 *   Venue：拉 rooms + week bookings
 *
 * 环境变量：
 *   BASE_URL          默认 http://127.0.0.1:3210（Docker 入口可用 :3200）
 *   VUS               虚拟用户数，默认 300
 *   DURATION_SEC      持续秒数，默认 120
 *   POLL_MS           每轮间隔 ms，默认 10000（对齐 EV 日历轮询）
 *   SYSTEM            parking | room | both，默认 both
 *   USER_COUNT        登录用 seed 账号数，默认 25（会循环分配给 VUS）
 *   USER_START        起始用户序号，默认 2
 *   MAX_SEED_USER     seed 最大序号，默认 25
 *   DAYS              EV 日历窗口天数，默认 14
 *   START_DATE        EV 日历起始日；未设则用 booking-window / 明天
 *   PASSWORD          默认 123456
 *   LOGIN_CONCURRENCY 登录并发，默认 20
 */

import {
  addDaysYmd,
  corpIdForUserIndex,
  login as loginCommon,
  mapPool,
  requestJson as requestJsonCommon,
  summarizeLatencies,
  tomorrowYmd,
  weekStartYmd,
} from './common.mjs';
import { writeLoadTestReport } from './report.mjs';

const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:3210').replace(/\/$/, '');
const VUS = Math.max(1, Number(process.env.VUS || 300));
const DURATION_SEC = Math.max(1, Number(process.env.DURATION_SEC || 120));
const POLL_MS = Math.max(0, Number(process.env.POLL_MS || 10_000));
const SYSTEM = (process.env.SYSTEM || 'both').toLowerCase();
const USER_COUNT = Math.max(1, Number(process.env.USER_COUNT || 25));
const USER_START = Math.max(1, Number(process.env.USER_START || 2));
const MAX_SEED_USER = Math.max(USER_START, Number(process.env.MAX_SEED_USER || 25));
const DAYS = Math.max(1, Number(process.env.DAYS || 14));
const START_DATE_ENV = process.env.START_DATE || '';
const PASSWORD = process.env.PASSWORD || '123456';
const LOGIN_CONCURRENCY = Math.max(1, Number(process.env.LOGIN_CONCURRENCY || 20));

const runParking = SYSTEM === 'parking' || SYSTEM === 'both';
const runRoom = SYSTEM === 'room' || SYSTEM === 'both';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function requestJson(method, path, opts = {}) {
  return requestJsonCommon(BASE_URL, method, path, opts);
}

async function login(corpId, system) {
  return loginCommon(BASE_URL, corpId, { password: PASSWORD, system });
}

function record(stats, name, { status, elapsed }) {
  if (!stats[name]) stats[name] = { ok: 0, fail: 0, latencies: [] };
  const row = stats[name];
  if (status >= 200 && status < 300) row.ok++;
  else row.fail++;
  if (elapsed > 0) row.latencies.push(elapsed);
}

async function resolveEvRange(token) {
  let start = START_DATE_ENV;
  let end = '';
  if (!start) {
    const { status, data } = await requestJson('GET', '/api/ev-management/booking-window', {
      token,
    });
    if (status === 200) {
      start = data?.currentStartDate || '';
      end = data?.currentEndDate || '';
    }
  }
  if (!start) start = tomorrowYmd();
  if (!end) end = addDaysYmd(start, DAYS - 1);
  return { start, end };
}

async function parkingBrowseTick(token, range, stats, tickIndex) {
  const cal = await requestJson(
    'GET',
    `/api/parking/calendar-availability?startDate=${range.start}&endDate=${range.end}`,
    { token },
  );
  record(stats, 'GET /parking/calendar-availability', cal);

  // 对齐前端：窗口约每 6 次日历轮询拉一次（~60s @ 10s poll）
  if (tickIndex % 6 === 0) {
    const win = await requestJson('GET', '/api/ev-management/booking-window', { token });
    record(stats, 'GET /ev-management/booking-window', win);
  }

  const mine = await requestJson('GET', '/api/ev-management/bookings?scope=my', { token });
  record(stats, 'GET /ev-management/bookings?scope=my', mine);
}

async function roomBrowseTick(token, weekStart, stats) {
  const rooms = await requestJson('GET', '/api/venue-calendar/rooms', { token });
  record(stats, 'GET /venue-calendar/rooms', rooms);

  const week = await requestJson(
    'GET',
    `/api/venue-calendar/bookings/week?weekStart=${weekStart}`,
    { token },
  );
  record(stats, 'GET /venue-calendar/bookings/week', week);

  const win = await requestJson('GET', '/api/venue-management/booking-window', { token });
  record(stats, 'GET /venue-management/booking-window', win);
}

async function vuLoop({ vuId, parkingToken, roomToken, range, weekStart, deadline }) {
  const stats = {};
  let ticks = 0;
  let tickIndex = 0;

  while (Date.now() < deadline) {
    try {
      if (runParking && parkingToken) {
        await parkingBrowseTick(parkingToken, range, stats, tickIndex);
      }
      if (runRoom && roomToken) {
        await roomBrowseTick(roomToken, weekStart, stats);
      }
      ticks++;
      tickIndex++;
    } catch (e) {
      if (!stats._vu_errors) stats._vu_errors = { ok: 0, fail: 0, latencies: [], samples: [] };
      stats._vu_errors.fail++;
      if (stats._vu_errors.samples.length < 2) {
        stats._vu_errors.samples.push(String(e.message || e));
      }
    }
    if (POLL_MS > 0 && Date.now() < deadline) {
      const remain = deadline - Date.now();
      await sleep(Math.min(POLL_MS, Math.max(0, remain)));
    }
  }

  return { vuId, ticks, stats };
}

function mergeStats(all) {
  const merged = {};
  const samples = [];
  let totalTicks = 0;

  for (const vu of all) {
    totalTicks += vu.ticks;
    for (const [name, row] of Object.entries(vu.stats)) {
      if (!merged[name]) merged[name] = { ok: 0, fail: 0, latencies: [] };
      merged[name].ok += row.ok || 0;
      merged[name].fail += row.fail || 0;
      if (row.latencies?.length) merged[name].latencies.push(...row.latencies);
      if (row.samples?.length) samples.push(...row.samples);
    }
  }

  return { merged, totalTicks, samples };
}

async function main() {
  console.log('=== Calendar Browse Stress (日历浏览) ===\n');
  console.log({
    BASE_URL,
    VUS,
    DURATION_SEC,
    POLL_MS,
    SYSTEM,
    USER_COUNT,
    MAX_SEED_USER,
    DAYS,
  });

  if (!runParking && !runRoom) {
    console.error('SYSTEM must be parking | room | both');
    process.exit(1);
  }

  const span = Math.min(USER_COUNT, MAX_SEED_USER - USER_START + 1);
  const seedIndexes = Array.from({ length: span }, (_, i) => USER_START + i);

  console.log(`\nLogging in ${seedIndexes.length} seed users (VUS=${VUS} will reuse tokens)...`);

  const parkingByUser = new Map();
  const roomByUser = new Map();
  const loginFailures = [];

  await mapPool(seedIndexes, LOGIN_CONCURRENCY, async (userIndex) => {
    const corpId = corpIdForUserIndex(userIndex);
    try {
      if (runParking) {
        const { token } = await login(corpId, 'parking');
        parkingByUser.set(userIndex, token);
      }
      if (runRoom) {
        const { token } = await login(corpId, 'room');
        roomByUser.set(userIndex, token);
      }
    } catch (e) {
      loginFailures.push({ corpId, error: e.message });
    }
  });

  console.log(
    `Parking tokens: ${parkingByUser.size}, Room tokens: ${roomByUser.size}, login failed: ${loginFailures.length}`,
  );
  if (loginFailures.length) {
    console.log('Login failures (sample):', loginFailures.slice(0, 3));
  }
  if (runParking && !parkingByUser.size) process.exit(1);
  if (runRoom && !roomByUser.size) process.exit(1);

  const anyToken =
    parkingByUser.values().next().value || roomByUser.values().next().value;
  const range = runParking
    ? await resolveEvRange(anyToken)
    : { start: tomorrowYmd(), end: addDaysYmd(tomorrowYmd(), DAYS - 1) };
  const weekStart = weekStartYmd(range.start);

  console.log('EV calendar range:', range.start, '→', range.end);
  console.log('Venue weekStart:', weekStart);
  console.log(
    `\nStarting ${VUS} VUs for ${DURATION_SEC}s (poll every ${POLL_MS}ms)...`,
  );

  const deadline = Date.now() + DURATION_SEC * 1000;
  const wallStart = Date.now();

  const vuJobs = Array.from({ length: VUS }, (_, i) => {
    const userIndex = seedIndexes[i % seedIndexes.length];
    return {
      vuId: i + 1,
      parkingToken: parkingByUser.get(userIndex),
      roomToken: roomByUser.get(userIndex),
      range,
      weekStart,
      deadline,
    };
  });

  const results = await Promise.all(vuJobs.map((job) => vuLoop(job)));
  const wallMs = Date.now() - wallStart;
  const { merged, totalTicks, samples } = mergeStats(results);

  console.log('\n=== Results ===');
  console.log('Wall time ms:', wallMs);
  console.log('VU completed loops (sum of ticks):', totalTicks);
  console.log(
    'Approx RPS (all endpoints):',
    (
      Object.values(merged).reduce((s, r) => s + r.ok + r.fail, 0) /
      (wallMs / 1000)
    ).toFixed(1),
  );

  const table = Object.entries(merged)
    .filter(([name]) => !name.startsWith('_'))
    .map(([name, row]) => {
      const lat = summarizeLatencies(row.latencies);
      return {
        endpoint: name,
        ok: row.ok,
        fail: row.fail,
        p50_ms: lat?.p50 ?? '-',
        p95_ms: lat?.p95 ?? '-',
        max_ms: lat?.max ?? '-',
      };
    });

  console.table(table);

  if (samples.length) {
    console.log('\nSample VU errors:', samples.slice(0, 5));
  }

  const totalFail = table.reduce((s, r) => s + r.fail, 0);
  const totalOk = table.reduce((s, r) => s + r.ok, 0);
  const failRate = totalFail / Math.max(1, totalOk + totalFail);
  console.log('\nPass hint: fail≈0, p95 可接受（建议 < 2000–3000ms，视环境而定）');
  console.log(`Totals: ok=${totalOk}, fail=${totalFail}`);
  if (totalFail > 0 && failRate > 0.05) {
    console.log('WARNING: fail rate > 5%');
  }

  const verdict =
    totalFail === 0
      ? '通过（fail=0）'
      : failRate > 0.05
        ? '需关注（失败率 > 5%）'
        : '基本通过（有少量失败）';

  writeLoadTestReport({
    scenario: 'browse',
    title: '日历浏览压测结果',
    verdict,
    config: {
      BASE_URL,
      VUS,
      DURATION_SEC,
      POLL_MS,
      SYSTEM,
      USER_COUNT,
      MAX_SEED_USER,
      DAYS,
      EV_range: `${range.start} → ${range.end}`,
      venue_weekStart: weekStart,
    },
    summary: {
      wall_ms: wallMs,
      total_ticks: totalTicks,
      approx_rps: (
        Object.values(merged).reduce((s, r) => s + r.ok + r.fail, 0) /
        (wallMs / 1000)
      ).toFixed(1),
      ok: totalOk,
      fail: totalFail,
      login_parking_tokens: parkingByUser.size,
      login_room_tokens: roomByUser.size,
      login_failed: loginFailures.length,
    },
    tables: [
      {
        title: '各接口延迟',
        headers: ['endpoint', 'ok', 'fail', 'p50_ms', 'p95_ms', 'max_ms'],
        rows: table.map((r) => [r.endpoint, r.ok, r.fail, r.p50_ms, r.p95_ms, r.max_ms]),
      },
    ],
    notes: samples.length
      ? samples.slice(0, 5).map((s) => `VU error sample: ${s}`)
      : ['无 VU 异常样本'],
    passHint: '建议：fail≈0；主要读接口 p95 < 2000–3000ms（视机器而定）。',
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
