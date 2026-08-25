import request from '@/api/request'

export function getVenueManagementVenues(config = {}) {
  return request.get('/venue-management/venues', config)
}

export function createVenue(payload) {
  return request.post('/venue-management/venues', payload)
}

export function updateVenue(id, payload) {
  return request.patch(`/venue-management/venues/${id}`, payload)
}

export function deleteVenue(id) {
  return request.delete(`/venue-management/venues/${id}`, { silentError: true })
}

export function getVenueBookingWindow() {
  return request.get('/venue-management/booking-window')
}

export function publishVenueBookingWindow(payload) {
  return request.patch('/venue-management/booking-window', payload)
}

export function createVenueBlock(venueId, payload) {
  return request.post(`/venue-management/venues/${venueId}/blocks`, payload)
}

export function deleteVenueBlock(venueId, blockId) {
  return request.delete(`/venue-management/venues/${venueId}/blocks/${blockId}`)
}

export function uploadVenueImage(venueId, file) {
  const formData = new FormData()
  formData.append('file', file)
  return request.post(`/venue-management/venues/${venueId}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

/** scope: 'my' | 'all'（all 仅管理员） */
export function listVenueManageBookings(scope = 'my') {
  return request.get('/venue-management/bookings', { params: { scope } })
}

export function updateVenueManageBooking(id, payload) {
  return request.patch(`/venue-management/bookings/${id}`, payload)
}

export function toggleVenueManageBookingCancel(id) {
  return request.patch(`/venue-management/bookings/${id}/toggle-cancel`)
}

export function approveVenueManageBooking(id, payload) {
  return request.post(`/venue-management/bookings/${id}/approve`, payload)
}

export function rejectVenueManageBooking(id, payload) {
  return request.post(`/venue-management/bookings/${id}/reject`, payload)
}

/** 公開茶水展示屏數據（無需登入）；fromDate 為香港業務日 YYYY-MM-DD */
export function getTeaServicePublicDisplay(fromDate) {
  const params = fromDate ? { fromDate } : undefined
  return request.get('/venue-management/public/tea-service-display', { params })
}

export function setTeaServiceRequestCompleted(bookingId, completed) {
  return request.patch(`/venue-management/public/tea-service-display/requests/${bookingId}/completed`, {
    completed: Boolean(completed)
  })
}

export function setTeaServiceNoRequestCompleted(date, venueName, completed) {
  return request.patch('/venue-management/public/tea-service-display/no-request-completed', {
    date,
    venueName,
    completed: Boolean(completed)
  })
}

/** 單場地展示屏（無需登入）；venueId 為 venues.id，date 為香港業務日 YYYY-MM-DD */
export function getVenuePublicDisplay(venueId, date) {
  const params = { venueId: String(venueId) }
  if (date) params.date = date
  return request.get('/venue-management/public/venue-display', { params })
}

/** 合併場地展示屏（無需登入）；date 為香港業務日 YYYY-MM-DD */
export function getVenueMergePublicDisplay(date) {
  const params = date ? { date } : undefined
  return request.get('/venue-management/public/venue-merge-display', { params })
}

