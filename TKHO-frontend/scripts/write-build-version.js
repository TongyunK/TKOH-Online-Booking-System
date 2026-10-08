/**
 * 构建后写入 version.json / build-id，并注入 dist/index.html 的 tkoh-build-id。
 * 播放器仅在「内嵌 buildId ≠ 服务器 version.json」时才 reload，避免每次整页加载两次。
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '..', 'dist')
const buildId =
  process.env.BUILD_TIMESTAMP ||
  process.env.VITE_APP_BUILD_ID ||
  new Date().toISOString().replace(/\W/g, '').slice(0, 14)

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true })
}

const payload = {
  buildId,
  builtAt: new Date().toISOString()
}

writeFileSync(join(distDir, 'version.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
writeFileSync(join(distDir, 'build-id.txt'), `${buildId}\n`, 'utf8')

const indexPath = join(distDir, 'index.html')
if (existsSync(indexPath)) {
  let html = readFileSync(indexPath, 'utf8')
  const nextMeta = `<meta name="tkoh-build-id" content="${buildId}" />`
  if (/<meta\s+name="tkoh-build-id"[^>]*>/i.test(html)) {
    html = html.replace(/<meta\s+name="tkoh-build-id"[^>]*>/i, nextMeta)
  } else {
    html = html.replace(/<\/head>/i, `    ${nextMeta}\n  </head>`)
  }
  writeFileSync(indexPath, html, 'utf8')
  console.log(`[build-version] inject index.html tkoh-build-id=${buildId}`)
} else {
  console.warn('[build-version] dist/index.html missing, skip meta inject')
}

console.log(`[build-version] write version.json buildId=${buildId}`)
