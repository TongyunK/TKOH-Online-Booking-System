import request from '@/api/request'

export function getEvParkingSlots() {
  return request.get('/ev-management/parking')
}

export function createEvParkingSlot(payload) {
  return request.post('/ev-management/parking', payload)
}

export function updateEvParkingSlot(id, payload) {
  return request.patch(`/ev-management/parking/${id}`, payload)
}

export function deleteEvParkingSlot(id, { cascadeRelated = false } = {}) {
  return request.delete(`/ev-management/parking/${id}`, {
    silentError: true,
    params: cascadeRelated ? { cascadeRelated: true } : undefined
  })
}

export function getEvTimePeriods(config = {}) {
  return request.get('/ev-management/time-periods', config)
}

export function createEvTimePeriod(payload) {
  return request.post('/ev-management/time-periods', payload)
}

export function updateEvTimePeriod(id, payload) {
  return request.patch(`/ev-management/time-periods/${id}`, payload)
}

export function deleteEvTimePeriod(id, { cascadeRelated = false } = {}) {
  return request.delete(`/ev-management/time-periods/${id}`, {
    silentError: true,
    params: cascadeRelated ? { cascadeRelated: true } : undefined
  })
}

export function getEvBookingWindow(config = {}) {
  return request.get('/ev-management/booking-window', config)
}

export function publishEvBookingWindow(payload) {
  return request.patch('/ev-management/booking-window', payload)
}

/** scope: 'my' | 'all'（all 仅管理员） */
export function listEvManageBookings(scope = 'my', config = {}) {
  return request.get('/ev-management/bookings', { params: { scope }, ...config })
}

export function cancelEvManageBooking(id) {
  return request.patch(`/ev-management/bookings/${id}/cancel`)
}

export function updateEvManageBooking(id, payload) {
  return request.patch(`/ev-management/bookings/${id}`, payload)
}

/** 公開 EV 展示屏數據（無需登入）；date 為香港業務日 YYYY-MM-DD */
export function getEvPublicDisplayData(date) {
  const params = date ? { date } : undefined
  return request.get('/ev-management/public/display', { params })
}
