import axios from 'axios'
import { useUserStore } from '../stores/user'
import { useStatusDialogStore } from '../stores/statusDialog'
import router from '../router'

import { getApiBaseURL, shouldAttachNgrokHeader } from '@/utils/apiConfig'
import { isPublicRoute } from '@/utils/publicRoutes'

const apiBaseURL = getApiBaseURL()

const showStatusDialog = (message, type = 'error') => {
  useStatusDialogStore().show(message, type)
}

const NETWORK_ERROR_MESSAGE = 'Network error, please check your connection'
const NETWORK_ERROR_DEBOUNCE_MS = 8000
let lastNetworkErrorAt = 0

const showNetworkErrorDebounced = () => {
  const now = Date.now()
  if (now - lastNetworkErrorAt < NETWORK_ERROR_DEBOUNCE_MS) return
  lastNetworkErrorAt = now
  showStatusDialog(NETWORK_ERROR_MESSAGE, 'error')
}

// 创建 axios 实例
const request = axios.create({
  baseURL: apiBaseURL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    const userStore = useUserStore()
    if (shouldAttachNgrokHeader(config.baseURL)) {
      config.headers['ngrok-skip-browser-warning'] = 'true'
    }
    if (userStore.token) {
      config.headers.Authorization = `Bearer ${userStore.token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 登录页 catch 会再弹一次；拦截器里跳过登录请求的提示，避免重复
const isLoginRequest = (config) => (config?.url || '').includes('/auth/login')
const isPublicPointsToNoteRequest = (config) =>
  (config?.url || '').includes('/prompt-management/public/points-to-note')

const isPublicBookingNoticesRequest = (config) =>
  (config?.url || '').includes('/prompt-management/public/booking-notices')

const isPublicTeaServiceDisplayRequest = (config) =>
  (config?.url || '').includes('/venue-management/public/tea-service-display')

const isPublicVenueDisplayRequest = (config) =>
  (config?.url || '').includes('/venue-management/public/venue-display') ||
  (config?.url || '').includes('/venue-management/public/venue-merge-display')

const isPublicEvDisplayRequest = (config) =>
  (config?.url || '').includes('/ev-management/public/display')

const isOnPublicRoute = () => {
  const path = router.currentRoute.value?.path || ''
  return isPublicRoute(path)
}
/** 公开注册页自行用 ElMessageBox 提示，避免与全局 status 弹窗重复 */
const isRegistrationSubmitRequest = (config) =>
  (config?.url || '').includes('/user-management/registration/submit')
const isRegistrationOptionsRequest = (config) =>
  (config?.url || '').includes('/user-management/registration/options')
/** EV 订课页在 catch 里用本页 Reminder 弹窗，避免与 GlobalStatusDialog 重复 */
const isEvBookingCreateRequest = (config) => {
  const method = String(config?.method || 'get').toLowerCase()
  const url = config?.url || ''
  return method === 'post' && url.includes('/parking/bookings')
}
/** EV 管理预订页自行弹 Reminder，避免与全局弹窗重复 */
const isEvManageBookingRequest = (config) => {
  const url = config?.url || ''
  return url.includes('/ev-management/bookings')
}
/** Admin 角标轮询：失败时 store 静默处理，勿弹「网络错误」 */
const isAdminPendingCountsRequest = (config) =>
  (config?.url || '').includes('/admin/pending-counts')

const isSilentRequest = (config) => config?.silentError === true

const skipsGlobalErrorDialog = (config) =>
  isSilentRequest(config) ||
  isLoginRequest(config) ||
  isPublicPointsToNoteRequest(config) ||
  isPublicBookingNoticesRequest(config) ||
  isPublicTeaServiceDisplayRequest(config) ||
  isPublicVenueDisplayRequest(config) ||
  isPublicEvDisplayRequest(config) ||
  isRegistrationSubmitRequest(config) ||
  isRegistrationOptionsRequest(config) ||
  isEvBookingCreateRequest(config) ||
  isEvManageBookingRequest(config) ||
  isAdminPendingCountsRequest(config)

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    const res = response.data
    // 仅当后端显式返回 { code } 信封时按 code 判错（如 200 业务码）
    if (res && typeof res === 'object' && 'code' in res && res.code !== 200) {
      if (!skipsGlobalErrorDialog(response.config)) {
        showStatusDialog(res.message || 'Request failed', 'error')
      }
      return Promise.reject(new Error(res.message || 'Request failed'))
    }
    return res
  },
  (error) => {
    const normalizeMessage = (payload, fallback = 'Request failed') => {
      const raw = payload?.message
      if (Array.isArray(raw)) return raw[0] || fallback
      if (typeof raw === 'string') return raw
      return fallback
    }
    const { response, config } = error
    const skipGlobalDialog = skipsGlobalErrorDialog(config)
    if (response) {
      switch (response.status) {
        case 401: {
          const url = response.config?.url || ''
          const isLoginAttempt = url.includes('/auth/login')
          const userStore = useUserStore()
          if (
            !isLoginAttempt &&
            !isPublicPointsToNoteRequest(config) &&
            !isPublicBookingNoticesRequest(config) &&
            !isPublicTeaServiceDisplayRequest(config) &&
            !isPublicVenueDisplayRequest(config) &&
            !isPublicEvDisplayRequest(config)
          ) {
            userStore.logout()
            if (!isOnPublicRoute()) {
              showStatusDialog('Unauthorized, please log in again', 'error')
              router.push('/login')
            }
          }
          break
        }
        case 403:
          if (!skipGlobalDialog) {
            showStatusDialog(normalizeMessage(response.data, 'Access denied'), 'error')
          }
          break
        case 404:
          if (!skipGlobalDialog) {
            showStatusDialog('Requested resource not found', 'error')
          }
          break
        case 500:
          if (!skipGlobalDialog) {
            showStatusDialog(normalizeMessage(response.data, 'Server error'), 'error')
          }
          break
        default:
          if (!skipGlobalDialog) {
            showStatusDialog(normalizeMessage(response.data), 'error')
          }
      }
    } else if (!skipGlobalDialog) {
      showNetworkErrorDebounced()
    }
    return Promise.reject(error)
  }
)

export default request
