const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('tkohSettings', {
  getConfig: () => ipcRenderer.invoke('settings-get-config'),
  getVersion: () => ipcRenderer.invoke('settings-get-version'),
  saveConfig: (config) => ipcRenderer.invoke('settings-save-config', config),
  close: () => ipcRenderer.invoke('settings-close'),
  quitApp: () => ipcRenderer.invoke('settings-quit')
})
