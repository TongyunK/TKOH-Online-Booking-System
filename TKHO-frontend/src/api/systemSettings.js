import request from './request'

export function getSystemSettings (config = {}) {
  return request.get('/system-settings', config)
}

export function getLoginDocs (config = {}) {
  return request.get('/system-settings/login-docs', config)
}

export function saveSystemSettings (payload) {
  return request.put('/system-settings', payload)
}

export function sendDataBackupNow () {
  return request.post('/data-backup/send-now', {}, { timeout: 120000 })
}
