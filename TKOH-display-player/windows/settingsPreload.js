const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('tkohSettings', {
  getVersion: () => ipcRenderer.invoke('settings-get-version'),
  getConfig: () => ipcRenderer.invoke('settings-get-config'),
  saveConfig: (config) => ipcRenderer.invoke('settings-save-config', config),
  close: () => ipcRenderer.invoke('settings-close'),
  quitApp: () => ipcRenderer.invoke('settings-quit')
})
