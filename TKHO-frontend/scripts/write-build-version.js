/**
 * 构建后写入 version.json / build-id，供大屏与 nginx 检测前端是否已更新。
 * 不依赖重装 Electron EXE：index.html 内联脚本会对比并强制换页。
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
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
console.log(`[build-version] write version.json buildId=${buildId}`)
