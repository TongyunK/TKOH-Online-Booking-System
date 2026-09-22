/**
 * 压测结束后写出 Markdown 结果文档
 *
 * 环境变量：
 *   WRITE_REPORT=0     关闭写文档（默认开启）
 *   REPORT_DIR         输出目录，默认本目录下 results/
 *   REPORT_FILE        指定完整路径（可选）
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

function mdTable(headers, rows) {
  const head = `| ${headers.map(esc).join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.map(esc).join(' | ')} |`).join('\n');
  return `${head}\n${sep}\n${body}`;
}

function codeBlock(lang, text) {
  return `\`\`\`${lang}\n${text}\n\`\`\``;
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
 * @returns {string | null} 写入的文件路径；关闭写文档时返回 null
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

  const reportDir =
    process.env.REPORT_DIR || join(__dirname, 'results');
  mkdirSync(reportDir, { recursive: true });

  const stamp = stampLocal();
  const filePath =
    process.env.REPORT_FILE ||
    join(reportDir, `LOAD-TEST-${scenario}-${stamp}.md`);

  const lines = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push('| 项 | 内容 |');
  lines.push('|----|------|');
  lines.push(`| 生成时间 | ${isoNow()} |`);
  lines.push(`| 场景 | ${esc(scenario)} |`);
  if (verdict) lines.push(`| 判定 | ${esc(verdict)} |`);
  lines.push('');

  lines.push('## 运行配置');
  lines.push('');
  lines.push(
    mdTable(
      ['变量', '值'],
      Object.entries(config).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : v]),
    ),
  );
  lines.push('');

  lines.push('## 结果摘要');
  lines.push('');
  lines.push(
    mdTable(
      ['指标', '值'],
      Object.entries(summary).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : v]),
    ),
  );
  lines.push('');

  for (const t of tables) {
    lines.push(`## ${t.title}`);
    lines.push('');
    lines.push(mdTable(t.headers, t.rows));
    lines.push('');
  }

  if (notes.length) {
    lines.push('## 备注');
    lines.push('');
    for (const n of notes) lines.push(`- ${n}`);
    lines.push('');
  }

  if (sql.length) {
    lines.push('## 建议校验 SQL');
    lines.push('');
    for (const q of sql) {
      lines.push(codeBlock('sql', q));
      lines.push('');
    }
  }

  if (passHint) {
    lines.push('## 通过提示');
    lines.push('');
    lines.push(passHint);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(`自动生成自压测脚本；关闭写文档：\`WRITE_REPORT=0\`。`);
  lines.push('');

  writeFileSync(filePath, lines.join('\n'), 'utf8');
  console.log(`\nReport written: ${filePath}`);
  return filePath;
}
