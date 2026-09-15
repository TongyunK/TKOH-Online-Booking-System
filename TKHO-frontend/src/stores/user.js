import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getUserInfo, logout as logoutApi } from '../api/auth'
import { clearImportantNoteTipPrefs } from '../utils/importantNoteTip'
import { clearIdleLastActivity, writeIdleLastActivity } from '../utils/idleAutoLogout'

export const useUserStore = defineStore('user', () => {
  const userInfo = ref(null)
  const token = ref(localStorage.getItem('token') || '')

  /** 管理员：后端 role 含 admin，或当前会话 system 为 admin */
  const isAdmin = computed(() => {
    const u = userInfo.value
    if (!u) return false
    if (u.system === 'admin') return true
    const r = String(u.role || '').toLowerCase()
    if (r.includes('admin')) return true
    return u.role === 'admin'
  })

  const login = (userData, authToken) => {
    // 新登录从当前时刻重新计空闲时间，避免沿用上次超时留下的旧时间戳
    clearIdleLastActivity()
    writeIdleLastActivity(Date.now())
    userInfo.value = userData
    token.value = authToken
    localStorage.setItem('token', authToken)
    localStorage.setItem('userInfo', JSON.stringify(userData))
  }

  const logout = () => {
    userInfo.value = null
    token.value = ''
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
    clearImportantNoteTipPrefs()
    clearIdleLastActivity()
  }

  const initUserInfo = () => {
    const storedUserInfo = localStorage.getItem('userInfo')
    if (storedUserInfo) {
      try {
        const parsed = JSON.parse(storedUserInfo)
        if (parsed && !parsed.role && parsed.system) {
          parsed.role = parsed.system === 'admin' ? 'admin' : 'user'
          localStorage.setItem('userInfo', JSON.stringify(parsed))
        }
        userInfo.value = parsed
      } catch {
        userInfo.value = null
      }
    }
  }

  /** 用 Bearer 调后端刷新本地 userInfo（避免仅信 localStorage） */
  async function refreshSessionUser () {
    if (!token.value) return false
    try {
      const data = await getUserInfo()
      if (data?.user) {
        userInfo.value = data.user
        localStorage.setItem('userInfo', JSON.stringify(data.user))
        return true
      }
      return false
    } catch {
      logout()
      return false
    }
  }

  async function performLogout () {
    try {
      if (token.value) {
        await logoutApi()
      }
    } catch {
      /* ignore */
    }
    logout()
    const { default: router } = await import('../router')
    router.push('/login')
  }

  return {
    userInfo,
    token,
    isAdmin,
    login,
    logout,
    initUserInfo,
    refreshSessionUser,
    performLogout
  }
})
