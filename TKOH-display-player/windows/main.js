const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron')
const fs = require('fs')
const path = require('path')
const { buildDisplayUrl, allowedHostFromLink } = require('./displayUrl')

const USER_AGENT_SUFFIX = ' TKOHDisplayPlayer/1.0'
const FAIL_RELOAD_MS = 3000
const FAIL_RELOAD_MAX_MS = 60_000
const SETTINGS_PROTOCOL = 'tkoh-player://settings'
const SECRET_TAPS = 5
const ERR_ABORTED = -3
const WATCHDOG_INTERVAL_MS = 45_000
const WATCHDOG_FAIL_THRESHOLD = 2
const RECOVERY_COOLDOWN_MS = 90_000

let mainWindow = null
let settingsWindow = null
let failTimer = null
let periodicTimer = null
let watchdogTimer = null
let currentTargetUrl = ''
let allowedHost = ''
let watchdogFailCount = 0
let lastRecoveryAt = 0
let failRetryAttempt = 0

function configPath () {
  if (app.isPackaged) {
    return path.join(path.dirname(process.execPath), 'config.json')
  }
  return path.join(__dirname, 'config.json')
}

function readConfig () {
  const raw = fs.readFileSync(configPath(), 'utf8')
  return JSON.parse(raw)
}

function writeConfig (config) {
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2), 'utf8')
}

function clearPeriodicReload () {
  if (periodicTimer) {
    clearInterval(periodicTimer)
    periodicTimer = null
  }
}

function clearWatchdog () {
  if (watchdogTimer) {
    clearInterval(watchdogTimer)
    watchdogTimer = null
  }
}

/**
 * 定时软刷新：回收长时间运行的页面内存，不 clearCache（避免网络抖动黑屏）
 */
function schedulePeriodicReload (reloadHours) {
  clearPeriodicReload()
  if (!reloadHours || reloadHours <= 0) return
  periodicTimer = setInterval(() => {
    softReloadDisplay('periodic')
  }, reloadHours * 60 * 60 * 1000)
}

/**
 * @param {string} url
 * @param {{ bypassCache?: boolean }} [opts]
 */
function loadDisplayUrl (url, opts = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  currentTargetUrl = url
  const bypassCache = Boolean(opts.bypassCache)
  const ses = mainWindow.webContents.session

  const navigate = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (bypassCache) {
      mainWindow.webContents.loadURL(url, {
        extraHeaders: 'Cache-Control: no-cache\nPragma: no-cache\n'
      })
      return
    }
    mainWindow.webContents.loadURL(url)
  }

  if (!bypassCache) {
    navigate()
    return
  }

  Promise.resolve(ses.clearCache())
    .catch(() => {})
    .finally(navigate)
}

function softReloadDisplay (reason) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const now = Date.now()
  if (reason !== 'periodic' && now - lastRecoveryAt < RECOVERY_COOLDOWN_MS) return
  if (reason !== 'periodic') lastRecoveryAt = now

  const config = readConfig()
  allowedHost = allowedHostFromLink(config.link)
  const url = buildDisplayUrl(config)
  currentTargetUrl = url
  // 软加载：不 clearCache
  mainWindow.webContents.loadURL(url)
}

function hardReloadDisplay () {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const config = readConfig()
  allowedHost = allowedHostFromLink(config.link)
  loadDisplayUrl(buildDisplayUrl(config), { bypassCache: true })
  schedulePeriodicReload(Number(config.reloadHours) || 12)
  startWatchdog()
}

/** 设置保存 / 冷启动：绕过缓存 */
function reloadDisplay () {
  hardReloadDisplay()
}

function warmUpOrigin (url) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url)
      const lib = u.protocol === 'https:' ? require('https') : require('http')
      const req = lib.request({
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: '/',
        method: 'HEAD',
        timeout: 8000
      }, (res) => {
        res.resume()
        resolve()
      })
      req.on('error', () => resolve())
      req.on('timeout', () => {
        req.destroy()
        resolve()
      })
      req.end()
    } catch {
      resolve()
    }
  })
}

function injectSettingsGesture () {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.executeJavaScript(`
    (function () {
      if (window.__tkohPlayerGesture) return
      window.__tkohPlayerGesture = true
      var count = 0
      var timer = null
      document.addEventListener('click', function (event) {
        if (event.clientX > window.innerWidth - 120 && event.clientY < 120) {
          count += 1
          clearTimeout(timer)
          timer = setTimeout(function () { count = 0 }, 2000)
          if (count >= ${SECRET_TAPS}) {
            count = 0
            window.location.href = '${SETTINGS_PROTOCOL}'
          }
        }
      }, true)
    })()
  `).catch(() => {})
}

function injectKioskHeartbeat () {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.executeJavaScript(`
    (function () {
      if (window.__tkohKioskHb) return
      window.__tkohKioskHb = true
      window.__tkohAliveAt = Date.now()
      setInterval(function () { window.__tkohAliveAt = Date.now() }, 15000)
    })()
  `).catch(() => {})
}

function startWatchdog () {
  clearWatchdog()
  watchdogFailCount = 0
  watchdogTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.executeJavaScript(`
      (function () {
        try {
          var alive = window.__tkohAliveAt || 0
          if (alive && (Date.now() - alive) > 120000) return 'stale'
          var root = document.querySelector(
            '.tea-display-root, .merge-display-root, .ev-display-root, .ev-display-viewport, .venue-display-root'
          )
          if (!root) root = document.querySelector('#app > div')
          if (!root) return 'no-root'
          if (root.offsetWidth < 8 || root.offsetHeight < 8) return 'tiny'
          var t = window.getComputedStyle(root).transform || ''
          var m = t.match(/matrix\\(([^,]+)/)
          if (m) {
            var a = parseFloat(m[1])
            if (a > 0 && a < 0.05) return 'tiny-scale'
          }
          return 'ok'
        } catch (e) {
          return 'err'
        }
      })()
    `).then((status) => {
      if (status === 'ok') {
        watchdogFailCount = 0
        return
      }
      watchdogFailCount += 1
      if (watchdogFailCount >= WATCHDOG_FAIL_THRESHOLD) {
        watchdogFailCount = 0
        softReloadDisplay('watchdog:' + status)
      }
    }).catch(() => {
      watchdogFailCount += 1
      if (watchdogFailCount >= WATCHDOG_FAIL_THRESHOLD) {
        watchdogFailCount = 0
        softReloadDisplay('watchdog:eval-fail')
      }
    })
  }, WATCHDOG_INTERVAL_MS)
}

function openSettingsWindow () {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 760,
    height: 620,
    parent: mainWindow,
    modal: true,
    autoHideMenuBar: true,
    resizable: true,
    maximizable: false,
    minimizable: false,
    backgroundColor: '#0b1220',
    webPreferences: {
      preload: path.join(__dirname, 'settingsPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  settingsWindow.setMenuBarVisibility(false)
  settingsWindow.loadFile(path.join(__dirname, 'settings.html'))
  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

function createWindow () {
  const config = readConfig()
  currentTargetUrl = buildDisplayUrl(config)
  allowedHost = allowedHostFromLink(config.link)
  const iconPath = path.join(__dirname, 'icon.ico')

  mainWindow = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    autoHideMenuBar: true,
    backgroundColor: '#001e5c',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false
    }
  })

  const ses = mainWindow.webContents.session
  ses.setUserAgent(ses.getUserAgent() + USER_AGENT_SUFFIX)
  mainWindow.setMenuBarVisibility(false)

  mainWindow.loadFile(path.join(__dirname, 'loading.html'))
  mainWindow.webContents.once('did-finish-load', () => {
    warmUpOrigin(currentTargetUrl).finally(() => {
      loadDisplayUrl(currentTargetUrl, { bypassCache: true })
    })
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(SETTINGS_PROTOCOL)) {
      event.preventDefault()
      openSettingsWindow()
      return
    }
    try {
      const host = new URL(url).host
      if (allowedHost && host !== allowedHost) {
        event.preventDefault()
      }
    } catch {
      event.preventDefault()
    }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    injectSettingsGesture()
    injectKioskHeartbeat()
    watchdogFailCount = 0
    const url = mainWindow.webContents.getURL() || ''
    if (!url.includes('loading.html')) {
      failRetryAttempt = 0
    }
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, desc, failingUrl, isMainFrame) => {
    if (!isMainFrame || errorCode === ERR_ABORTED) return
    // 忽略对本地 loading 页自身的失败，避免重试环
    if (failingUrl && failingUrl.includes('loading.html')) return
    clearTimeout(failTimer)
    const delay = Math.min(
      FAIL_RELOAD_MAX_MS,
      FAIL_RELOAD_MS * (2 ** Math.min(failRetryAttempt, 4))
    )
    failRetryAttempt += 1
    // 断网/不可达时用本地 loading 页盖住 Chromium 错误页，再退避重试
    const loadingPath = path.join(__dirname, 'loading.html')
    if (fs.existsSync(loadingPath)) {
      const q = new URLSearchParams({
        msg: `Network error · ${desc || errorCode} · Retrying…`
      })
      mainWindow.webContents.loadFile(loadingPath, { search: q.toString() }).catch(() => {})
    }
    failTimer = setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed() || !currentTargetUrl) return
      // 不走 softReload 冷却：失败重试必须持续进行直到恢复
      mainWindow.webContents.loadURL(currentTargetUrl)
    }, delay)
  })

  mainWindow.webContents.on('render-process-gone', () => {
    softReloadDisplay('render-process-gone')
  })

  mainWindow.webContents.on('unresponsive', () => {
    softReloadDisplay('unresponsive')
  })

  schedulePeriodicReload(Number(config.reloadHours) || 12)
  startWatchdog()
}

ipcMain.handle('settings-get-config', () => readConfig())
ipcMain.handle('settings-get-version', () => app.getVersion())

ipcMain.handle('settings-save-config', (_event, config) => {
  writeConfig(config)
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close()
  }
  reloadDisplay()
})

ipcMain.handle('settings-close', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close()
  }
})

ipcMain.handle('settings-quit', () => {
  app.quit()
})

app.whenReady().then(() => {
  createWindow()
  globalShortcut.register('Control+Shift+P', openSettingsWindow)
  globalShortcut.register('Control+Shift+Q', () => {
    app.quit()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  clearTimeout(failTimer)
  clearPeriodicReload()
  clearWatchdog()
})
