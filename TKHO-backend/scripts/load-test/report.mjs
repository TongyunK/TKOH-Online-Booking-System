/**
 * 壓測結束後寫出 Markdown 結果文件（繁體中文）
 *
 * 環境變數：
 *   WRITE_REPORT=0     關閉寫文件（預設開啟）
 *   REPORT_DIR         輸出目錄，預設本目錄下 results/
 *   REPORT_FILE        指定完整路徑（可選）
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** 設定／摘要欄位：繁體說明 */
const FIELD_NOTES = {
  BASE_URL: 'API 入口（經 Nginx 常用 :3200）',
  VUS: '虛擬使用者數（同時在線模擬人數）',
  DURATION_SEC: '壓測持續秒數',
  POLL_MS: '每位使用者每輪請求間隔（毫秒）',
  SYSTEM: '測哪些系統：parking / room / both',
  USER_COUNT: '使用多少個 seed 帳號（會循環）',
  MAX_SEED_USER: 'seed 使用者編號上限（預設 25）',
  USER_START: '起始使用者編號（2 = E002）',
  DAYS: 'EV 日曆／搶訂覆蓋天數',
  CONCURRENCY: '同時發出的預訂請求數',
  PERIOD_IDS: '時段 ID 列表',
  PERIOD_ID: '單一時段 ID',
  TARGET_MODE: '搶訂分佈：spread / hot / random',
  BOOKING_DATE: '單格搶訂日期 YYYY-MM-DD',
  START_DATE: '搶訂起始日',
  DRY_RUN: '1=只登入不訂位',
  EV_range: 'EV 日曆可用性查詢日期區間',
  venue_weekStart: '場地週視圖起始日（週日）',
  date_range: '本次搶訂實際日期區間',
  cells: '日×時段格子數',
  slots_per_cell: '每格可用車位數（active）',
  max_theoretical_success: '理論最大成功筆數（空表時）',

  wall_ms: '牆鐘耗時（毫秒）：整輪從開始到結束的實際時間',
  total_ticks: '所有 VU 完成的輪詢次數加總',
  approx_rps: '約略每秒請求數（全部接口合計）',
  ok: 'HTTP 成功次數（2xx）',
  fail: 'HTTP 失敗次數（非 2xx）',
  login_parking_tokens: '成功登入 parking 的帳號數',
  login_room_tokens: '成功登入 room 的帳號數',
  login_failed: '登入失敗次數',
  success: '預訂成功筆數',
  conflict: '衝突／已滿等預期業務拒絕（多為 409）',
  error: '其他失敗（含配額不足、週末不可訂、5xx 等）',
  duplicateSlot: '回應中同一車位被重複訂走的次數（應為 0）',
  unique_slots: '成功回應中不重複的車位 ID 數',
  cells_at_capacity: '已達車位上限的格子數 / 總格子數',
  latency_ms: '延遲統計（min / p50 / p95 / max，毫秒）',
  p50_ms: '延遲中位數（50% 請求不快於此值）',
  p95_ms: '延遲 95 分位（95% 請求不快於此值）',
  max_ms: '最大延遲（毫秒）',
};

function stampLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function isoNow() {
  return new Date().toISOString();
}

function esc(value) {
  if (value == null) return '';
  return String(value).replace(/\|/g, '\\|');
}

function formatValue(v) {
  if (v == null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function mdTable(headers, rows) {
  const head = `| ${headers.map(esc).join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.map(esc).join(' | ')} |`).join('\n');
  return `${head}\n${sep}\n${body}`;
}

function codeBlock(lang, text) {
  return `\`\`\`${lang}\n${text}\n\`\`\``;
}

function annotatedEntries(obj) {
  return Object.entries(obj).map(([k, v]) => [
    k,
    FIELD_NOTES[k] || '（見腳本／README）',
    formatValue(v),
  ]);
}

/**
 * @param {{
 *   scenario: string,
 *   title: string,
 *   config: Record<string, unknown>,
 *   summary: Record<string, unknown>,
 *   tables?: Array<{ title: string, headers: string[], rows: unknown[][] }>,
 *   notes?: string[],
 *   sql?: string[],
 *   passHint?: string,
 *   verdict?: string,
 * }} opts
 * @returns {string | null}
 */
export function writeLoadTestReport(opts) {
  if (process.env.WRITE_REPORT === '0') return null;

  const {
    scenario,
    title,
    config = {},
    summary = {},
    tables = [],
    notes = [],
    sql = [],
    passHint = '',
    verdict = '',
  } = opts;

  const reportDir = process.env.REPORT_DIR || join(__dirname, 'results');
  mkdirSync(reportDir, { recursive: true });

  const stamp = stampLocal();
  const filePath =
    process.env.REPORT_FILE || join(reportDir, `LOAD-TEST-${scenario}-${stamp}.md`);

  const lines = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push('| 項目 | 內容 |');
  lines.push('|----|------|');
  lines.push(`| 產生時間 | ${isoNow()} |`);
  lines.push(`| 場景代碼 | ${esc(scenario)} |`);
  if (verdict) lines.push(`| 判定 | ${esc(verdict)} |`);
  lines.push('');

  lines.push('## 執行設定');
  lines.push('');
  lines.push(mdTable(['參數', '說明', '值'], annotatedEntries(config)));
  lines.push('');

  lines.push('## 結果摘要');
  lines.push('');
  lines.push(mdTable(['指標', '說明', '值'], annotatedEntries(summary)));
  lines.push('');

  lines.push('## 常用指標說明');
  lines.push('');
  lines.push('| 指標 | 說明 |');
  lines.push('|------|------|');
  lines.push('| wall_ms | 牆鐘耗時（毫秒）：整輪從開始到結束的實際時間 |');
  lines.push('| p50_ms | 延遲中位數：一半請求的耗時低於此值 |');
  lines.push('| p95_ms | 延遲 95 分位：95% 請求的耗時低於此值（常用 SLA 參考） |');
  lines.push('| success | 預訂成功 |');
  lines.push('| conflict | 車位已滿等預期衝突（多為 409） |');
  lines.push('| error | 其他失敗（配額、週末不可訂、或系統錯誤） |');
  lines.push('| duplicateSlot | 同一車位被重複訂走的次數，應為 **0** |');
  lines.push('| ok / fail | 讀壓測中 HTTP 成功／失敗次數 |');
  lines.push('| approx_rps | 約略每秒請求數 |');
  lines.push('');

  for (const t of tables) {
    lines.push(`## ${t.title}`);
    lines.push('');
    lines.push(mdTable(t.headers, t.rows));
    lines.push('');
  }

  if (notes.length) {
    lines.push('## 備註');
    lines.push('');
    for (const n of notes) lines.push(`- ${n}`);
    lines.push('');
  }

  if (sql.length) {
    lines.push('## 建議校驗 SQL');
    lines.push('');
    for (const q of sql) {
      lines.push(codeBlock('sql', q));
      lines.push('');
    }
  }

  if (passHint) {
    lines.push('## 通過提示');
    lines.push('');
    lines.push(passHint);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('由壓測腳本自動產生。關閉寫文件：`WRITE_REPORT=0`。');
  lines.push('');

  writeFileSync(filePath, lines.join('\n'), 'utf8');
  console.log(`\n結果文件已寫入: ${filePath}`);
  return filePath;
}
