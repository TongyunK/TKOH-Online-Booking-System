const { app, BrowserWindow, globalShortcut, ipcMain, session } = require('electron')
const fs = require('fs')
const path = require('path')
const { buildDisplayUrl, allowedHostFromLink } = require('./displayUrl')

const USER_AGENT = 'TKOHDisplayPlayer/1.0 Electron'
const FAIL_RELOAD_MS = 15000
const SETTINGS_PROTOCOL = 'tkoh-player://settings'
const SECRET_TAPS = 5

let mainWindow = null
let settingsWindow = null
let failTimer = null
let periodicTimer = null
let currentTargetUrl = ''

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

function schedulePeriodicReload (reloadHours) {
  clearPeriodicReload()
  if (!reloadHours || reloadHours <= 0) return
  periodicTimer = setInterval(() => {
    reloadDisplay()
  }, reloadHours * 60 * 60 * 1000)
}

function reloadDisplay () {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const config = readConfig()
  currentTargetUrl = buildDisplayUrl(config)
  mainWindow.loadURL(currentTargetUrl)
  schedulePeriodicReload(Number(config.reloadHours) || 0)
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

function openSettingsWindow () {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 560,
    height: 360,
    parent: mainWindow,
    modal: true,
    autoHideMenuBar: true,
    resizable: false,
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
  const allowedHost = allowedHostFromLink(config.link)
  const iconPath = path.join(__dirname, 'icon.ico')

  mainWindow = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  session.defaultSession.setUserAgent(USER_AGENT)
  mainWindow.setMenuBarVisibility(false)
  mainWindow.loadURL(currentTargetUrl)

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

  mainWindow.webContents.on('did-finish-load', injectSettingsGesture)

  mainWindow.webContents.on('did-fail-load', () => {
    clearTimeout(failTimer)
    failTimer = setTimeout(() => {
      reloadDisplay()
    }, FAIL_RELOAD_MS)
  })

  schedulePeriodicReload(Number(config.reloadHours) || 0)
}

ipcMain.handle('settings-get-config', () => readConfig())

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
})
