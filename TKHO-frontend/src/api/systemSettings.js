import request from './request'

export function getSystemSettings () {
  return request.get('/system-settings')
}

export function saveSystemSettings (payload) {
  return request.put('/system-settings', payload)
}

export function sendDataBackupNow () {
  return request.post('/data-backup/send-now', {}, { timeout: 120000 })
}
