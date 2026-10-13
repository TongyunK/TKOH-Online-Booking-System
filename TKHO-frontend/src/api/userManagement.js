import request from './request'

export function listUsers (params) {
  return request.get('/user-management/users', { params })
}

export function listUserOwnerOptions (params) {
  return request.get('/user-management/users/options', { params })
}

export function getRegistrationOptions () {
  return request.get('/user-management/registration/options')
}

export function submitUserRegistration (payload) {
  return request.post('/user-management/registration/submit', payload)
}

export function getUser (id) {
  return request.get(`/user-management/users/${id}`)
}

export function createUser (payload) {
  return request.post('/user-management/users', payload)
}

export function updateUser (id, payload) {
  return request.patch(`/user-management/users/${id}`, payload)
}

export function deleteUser (id) {
  return request.delete(`/user-management/users/${id}`)
}

export function replaceUserPassword (id, password) {
  return request.patch(`/user-management/users/${id}/password`, { password })
}

export function resetUserQuotas (id) {
  return request.patch(`/user-management/users/${id}/quotas/reset`)
}

export function updateUserStatus (id, status) {
  return request.patch(`/user-management/users/${id}/status`, { status })
}

/** @param {string|Record<string, unknown>} statusOrParams */
export function listPendingUsers (statusOrParams) {
  const params =
    typeof statusOrParams === 'string'
      ? { status: statusOrParams }
      : statusOrParams
  return request.get('/user-management/pending-users', { params })
}

export function approvePendingUser (id, payload) {
  return request.post(`/user-management/pending-users/${id}/approve`, payload)
}

export function rejectPendingUser (id, payload) {
  return request.post(`/user-management/pending-users/${id}/reject`, payload ?? {})
}
