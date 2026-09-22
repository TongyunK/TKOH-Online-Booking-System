/**
 * 壓測結束後寫出 Markdown 結果文件（繁體中文，含自動解讀）
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

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
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

function latencyP95(summary) {
  const lat = summary.latency_ms;
  if (lat && typeof lat === 'object' && lat.p95 != null) return num(lat.p95);
  return null;
}

/**
 * 依場景與數字自動產生解讀段落與通過對照表
 */
function buildInterpretation({ scenario, config, summary, extras = {} }) {
  const lines = [];
  const checklist = [];
  const {
    errorByStatus = {},
    businessErrorHint = true,
    sqlVerifiedZeroRows = null,
  } = extras;

  const success = num(summary.success);
  const conflict = num(summary.conflict);
  const error = num(summary.error);
  const duplicateSlot = num(summary.duplicateSlot);
  const ok = num(summary.ok);
  const fail = num(summary.fail);
  const wallMs = num(summary.wall_ms);
  const concurrency = num(config.CONCURRENCY || config.VUS);
  const slotsPerCell = num(config.slots_per_cell, 3);
  const maxTheo = num(config.max_theoretical_success);
  const p95 = latencyP95(summary);

  const status403 = num(errorByStatus['403']);
  const status400 = num(errorByStatus['400']);
  const status429 = num(errorByStatus['429']);
  const status5xx = Object.entries(errorByStatus).reduce((s, [k, v]) => {
    const code = Number(k);
    return code >= 500 && code < 600 ? s + num(v) : s;
  }, 0);

  lines.push('## 結果解讀（自動產生）');
  lines.push('');

  if (scenario === 'browse' || scenario.startsWith('browse')) {
    lines.push('### 這次測的是什麼？');
    lines.push('');
    lines.push(
      '模擬大量使用者同時打開 **EV／場地日曆** 並週期性刷新（讀多寫少），檢驗接口是否穩定、延遲是否可接受。',
    );
    lines.push('');
    lines.push('### 數字怎麼看？');
    lines.push('');
    lines.push(
      `- **ok=${ok}、fail=${fail}**：讀請求成功／失敗次數。理想情況 fail≈0。`,
    );
    lines.push(
      `- **wall_ms=${wallMs}**：整輪實際跑了多久（約等於你設的 DURATION_SEC）。`,
    );
    if (p95 != null) {
      lines.push(
        `- **p95≈${p95}ms**：95% 請求不快於此值；一般建議看是否落在 2–3 秒內（視機器而定）。`,
      );
    }
    lines.push('');

    checklist.push([
      '讀請求失敗率低',
      fail === 0 ? '✅ 通過' : fail / Math.max(1, ok + fail) <= 0.05 ? '⚠️ 有少量失敗' : '❌ 失敗偏多',
      `ok=${ok}, fail=${fail}`,
    ]);
    if (p95 != null) {
      checklist.push([
        '讀接口 p95 可接受',
        p95 < 3000 ? '✅ 通過' : '⚠️ 偏高',
        `p95=${p95}ms`,
      ]);
    }
  } else {
    // 搶訂類
    lines.push('### 這次測的是什麼？');
    lines.push('');
    lines.push(
      '模擬多人同時呼叫 **EV 搶訂** API。重點不是「全部都要訂成功」，而是：系統不被壓垮、**不超賣同一車位**、延遲仍可接受。',
    );
    lines.push('');
    lines.push('### success / conflict / error 分別代表什麼？');
    lines.push('');
    lines.push('| 分類 | 含義 | 是否算系統故障？ |');
    lines.push('|------|------|------------------|');
    lines.push(
      '| **success** | 預訂成功寫入資料庫 | 否；且每格成功數不應超過車位數 |',
    );
    lines.push(
      '| **conflict** | 車位已滿／搶輸等（多為 HTTP 409） | **否**，這是搶訂的預期結果 |',
    );
    lines.push(
      '| **error** | 配額不足、週末不可訂、限流、或 5xx 等 | **要看原因**：業務規則 ≠ 系統故障；5xx／超賣才嚴重 |',
    );
    lines.push('');
    lines.push('### 本次數字解讀');
    lines.push('');
    lines.push(
      `- **success=${success}**：成功訂位筆數。理論上限約 **${maxTheo || '（見設定）'}**（格子數 × 每格車位）；實際常低於上限，因為帳號配額、週末、週限額、請求分佈不均。`,
    );
    lines.push(
      `- **conflict=${conflict}**：車位已滿導致的衝突，代表「搶訂競爭」有發生，通常是健康訊號。`,
    );
    lines.push(
      `- **error=${error}**：其餘拒絕。Seed 只有約 25 個帳號且部分為 **User_Venue（EV 配額=0）**，再循環打到 ${concurrency} 併發時，403 配額不足會很多；區間若含週末也會出現 400。`,
    );
    lines.push(
      `- **duplicateSlot=${duplicateSlot}**：回應層面是否出現「同一車位被訂兩次」。必須為 **0**。`,
    );
    if (p95 != null) {
      lines.push(
        `- **延遲 p95≈${p95}ms、牆鐘 wall_ms=${wallMs}**：${concurrency} 併發下 p95 約 2–3 秒通常仍可接受。`,
      );
    }
    lines.push('');

    if (Object.keys(errorByStatus).length) {
      lines.push('### error 依 HTTP 狀態分佈');
      lines.push('');
      lines.push('| HTTP | 次數 | 常見含義 |');
      lines.push('|------|------|----------|');
      for (const [code, count] of Object.entries(errorByStatus).sort(
        (a, b) => Number(b[0]) - Number(a[0]),
      )) {
        let meaning = '其他／需對照錯誤樣本';
        if (code === '403') meaning = '常為 EV 配額不足（如 User_Venue）→ 業務拒絕';
        else if (code === '400') meaning = '常為週末不可訂或其他參數／規則 → 業務拒絕';
        else if (code === '409') meaning = '衝突（若出現在 error 桶，亦屬業務）';
        else if (code === '429') meaning = '限流過嚴 → 可提高 EV_BOOKING_RATE_LIMIT_PER_MIN';
        else if (Number(code) >= 500) meaning = '伺服器錯誤 → 需查後端日誌';
        lines.push(`| ${code} | ${count} | ${meaning} |`);
      }
      lines.push('');
      if (businessErrorHint && status5xx === 0 && (status403 > 0 || status400 > 0)) {
        lines.push(
          '> **說明**：本次 error 樣本以業務規則（403／400）為主，且未見 5xx 時，**不宜把高 error 數直接判成壓測失敗**；應結合 duplicateSlot 與校驗 SQL。',
        );
        lines.push('');
      }
    }

    checklist.push([
      '無超賣（duplicateSlot=0）',
      duplicateSlot === 0 ? '✅ 通過' : '❌ 未通過',
      `duplicateSlot=${duplicateSlot}`,
    ]);
    checklist.push([
      '成功數不超過理論容量',
      !maxTheo || success <= maxTheo ? '✅ 通過' : '❌ 異常偏高',
      `success=${success}, 理論上限=${maxTheo || 'n/a'}`,
    ]);
    checklist.push([
      '有競爭／滿位行為（可有 conflict）',
      conflict > 0 || success > 0 ? '✅ 正常' : '⚠️ 幾乎無成功也無衝突',
      `conflict=${conflict}`,
    ]);
    checklist.push([
      '無大量 5xx',
      status5xx === 0 ? '✅ 通過' : '❌ 有 5xx',
      `5xx≈${status5xx}`,
    ]);
    if (status429 > 0) {
      checklist.push(['限流 429', '⚠️ 需調高限流', `429=${status429}`]);
    }
    if (p95 != null) {
      checklist.push([
        '寫接口 p95 可接受',
        p95 < 5000 ? '✅ 通過' : '⚠️ 偏高',
        `p95=${p95}ms`,
      ]);
    }
    checklist.push([
      '每格成功 ≤ 車位數（見格子表）',
      '請人工核對上方格子表',
      `每格上限=${slotsPerCell}`,
    ]);
    if (sqlVerifiedZeroRows === true) {
      checklist.push(['資料庫校驗 SQL 0 行', '✅ 通過', '已確認無重複佔位']);
    } else if (sqlVerifiedZeroRows === false) {
      checklist.push(['資料庫校驗 SQL 0 行', '❌ 未通過', '出現重複佔位']);
    } else {
      checklist.push([
        '資料庫校驗 SQL 0 行',
        '⏳ 請手動執行下方 SQL',
        '期望結果：0 行',
      ]);
    }
  }

  lines.push('### 通過標準對照');
  lines.push('');
  lines.push(mdTable(['檢查項', '狀態', '依據'], checklist.length ? checklist : [['（無）', '-', '-']]));
  lines.push('');

  // 總結句
  lines.push('### 一句話總結');
  lines.push('');
  if (scenario === 'browse' || scenario.startsWith('browse')) {
    if (fail === 0) {
      lines.push('讀壓測整體健康：請求全部成功，可依 p95 評估效能是否達標。');
    } else {
      lines.push('讀壓測有失敗請求，請對照各接口表與後端日誌再判定。');
    }
  } else if (duplicateSlot > 0) {
    lines.push('**未通過**：出現疑似超賣（duplicateSlot>0），需立刻排查唯一約束與併發邏輯。');
  } else if (status5xx > 0) {
    lines.push('**需關注**：無超賣跡象，但存在 5xx，請查後端／資料庫日誌。');
  } else if (error > success + conflict && (status403 > 0 || status400 > 0)) {
    lines.push(
      '**系統穩定性可判通過（在校驗 SQL=0 行前提下）**：高 error 主要來自業務拒絕（配額／週末），不是服務被打掛；搶訂競爭與滿位行為正常。',
    );
  } else {
    lines.push(
      '**傾向通過（請確認校驗 SQL=0 行）**：無超賣、有成功與衝突，延遲需對照 p95。',
    );
  }
  lines.push('');

  return lines;
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
 *   extras?: {
 *     errorByStatus?: Record<string, number>,
 *     sqlVerifiedZeroRows?: boolean | null,
 *     businessErrorHint?: boolean,
 *   },
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
    extras = {},
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
  if (verdict) lines.push(`| 腳本初判 | ${esc(verdict)} |`);
  lines.push('');
  lines.push(
    '> **如何閱讀本報告**：先看「結果解讀」與「通過標準對照」，再看摘要數字與錯誤樣本。`error` 偏高不一定代表系統故障——請看 HTTP 狀態是否為 403／400 等業務規則。',
  );
  lines.push('');

  lines.push(...buildInterpretation({ scenario, config, summary, extras }));

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
    if (t.title.includes('格子')) {
      lines.push(
        '表格中的 `key` 格式為 `日期-時段ID`。理想情況下活躍格子的 **success ≤ 每格車位數**（本環境多為 3），其餘為 conflict 或業務 error。',
      );
      lines.push('');
    }
    lines.push(mdTable(t.headers, t.rows));
    lines.push('');
  }

  if (notes.length) {
    lines.push('## 錯誤樣本與備註');
    lines.push('');
    for (const n of notes) lines.push(`- ${n}`);
    lines.push('');
  }

  if (sql.length) {
    lines.push('## 建議校驗 SQL（務必執行）');
    lines.push('');
    lines.push(
      '下列 SQL 用於確認資料庫層沒有「同一車位 + 同一時段 + 同一天」出現多筆有效預訂。**期望結果：0 行**。若為 0 行，可與 `duplicateSlot=0` 一併作為「無超賣」的硬證據。',
    );
    lines.push('');
    for (const q of sql) {
      lines.push(codeBlock('sql', q));
      lines.push('');
    }
    lines.push('Docker 範例：');
    lines.push('');
    lines.push(
      codeBlock(
        'bash',
        `docker exec -i tkho-booking-postgres psql -U tkho -d tkho_booking -c "\n${sql[0].replace(/"/g, '\\"')}\n"`,
      ),
    );
    lines.push('');
  }

  if (passHint) {
    lines.push('## 通過提示（腳本建議）');
    lines.push('');
    lines.push(passHint);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('由壓測腳本自動產生（含解讀段落）。關閉寫文件：`WRITE_REPORT=0`。');
  lines.push('');

  writeFileSync(filePath, lines.join('\n'), 'utf8');
  console.log(`\n結果文件已寫入: ${filePath}`);
  return filePath;
}
