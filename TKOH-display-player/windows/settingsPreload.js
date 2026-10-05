const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('tkohSettings', {
  getConfig: () => ipcRenderer.invoke('settings-get-config'),
  saveConfig: (config) => ipcRenderer.invoke('settings-save-config', config),
  close: () => ipcRenderer.invoke('settings-close')
})
