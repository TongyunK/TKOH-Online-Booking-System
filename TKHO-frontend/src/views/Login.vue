<template>
  <div class="login-container flex flex-col bg-[#f8ecdd]" :class="{ 'login-compact': loginCompact }">
    <header class="login-header w-full">
      <div class="header-content">
        <img src="../assets/TKOH_logo.png" alt="TKOH Logo" class="login-header-logo" />
        <h1 class="login-title">TKOH GA Venue and EV Charging Booking System</h1>
      </div>
    </header>

    <div ref="loginMainRef" class="login-main">
      <div class="system-buttons-container w-full max-w-md md:max-w-lg mx-auto mt-6 mb-3 px-4">
        <p class="system-caption">Please select</p>
        <el-form-item prop="system" class="system-buttons-item">
          <div class="system-buttons">
            <button
              v-for="item in systemOptions"
              :key="item.value"
              type="button"
              :class="['system-button', { active: loginForm.system === item.value }]"
              @click="loginForm.system = item.value"
            >
              <span class="button-icon">
                <font-awesome-icon :icon="['fas', item.icon]" />
              </span>
              <span class="button-label" :aria-label="item.label">
                <span
                  v-for="(line, lineIdx) in item.labelLines"
                  :key="`${item.value}-line-${lineIdx}`"
                  class="button-label-line"
                >{{ line }}</span>
              </span>
            </button>
          </div>
        </el-form-item>
      </div>

      <div class="login-card w-full max-w-md md:max-w-lg mx-auto px-4">
        <el-form
          ref="loginFormRef"
          :model="loginForm"
          :rules="loginRules"
          class="login-form"
        >
          <el-form-item prop="corpId">
            <el-input
              v-model="loginForm.corpId"
              size="large"
              class="login-input input-with-prefix"
              @input="onCorpIdInput"
            >
              <template #prefix>
                <span class="input-prefix-text">CORP ID</span>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item prop="password">
            <el-input
              v-model="loginForm.password"
              type="password"
              size="large"
              class="login-input input-with-prefix"
              show-password
              @keyup.enter="handleLogin"
            >
              <template #prefix>
                <span class="input-prefix-text">Password</span>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item class="login-submit-item">
            <el-button
              type="primary"
              :loading="loading"
              @click="handleLogin"
              class="login-button"
              size="large"
            >
              Login
            </el-button>
          </el-form-item>
          <div class="signup-row">
            <RouterLink to="/register" class="signup-link">Sign Up</RouterLink>
            <p class="login-docs-tip">
              Please read
              <a
                v-if="userGuideUrl"
                class="login-docs-link"
                :href="userGuideUrl"
                target="_blank"
                rel="noopener noreferrer"
              >User Guide</a>
              <span v-else class="login-docs-link is-disabled">User Guide</span>
              and
              <a
                v-if="operationsManualUrl"
                class="login-docs-link"
                :href="operationsManualUrl"
                target="_blank"
                rel="noopener noreferrer"
              >Operations Manual</a>
              <span v-else class="login-docs-link is-disabled">Operations Manual</span>
            </p>
          </div>
        </el-form>
      </div>

      <section
        v-if="showPointsToNoteSection"
        class="login-notes"
        :style="loginNotesStyle"
      >
        <div class="login-notes-inner">
          <p v-if="pointsToNoteLoading" class="notes-content notes-loading">Loading...</p>
          <div
            v-else-if="currentPointsToNoteContent"
            class="notes-content rich-content"
            v-html="currentPointsToNoteContent"
          ></div>
        </div>
      </section>
    </div>

    <footer class="login-copyright" aria-label="Copyright">
      Copyright © {{ copyrightYear }} TKOH GA. All rights reserved.
    </footer>
  </div>
</template>

<script setup>
import { computed, ref, reactive, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { useStatusDialogStore } from '@/stores/statusDialog'
import { login as loginApi } from '../api/auth'
import { getPublicPointsToNote } from '@/api/promptManagement'
import { getLoginDocs } from '@/api/systemSettings'
import { getMockPromptList } from '@/mocks/mockData'
import { formatPointsToNoteForDisplay } from '@/utils/pointsToNoteHtml'
import { canAccessSystem, canAccessPath, getDeniedSystemMessage, systemForPath } from '@/utils/systemAccess'
import { todayYmdInAppTimeZone } from '@/utils/appTimezone'
import '@/styles/rich-content.css'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const loginFormRef = ref(null)
const loading = ref(false)
const statusDialogStore = useStatusDialogStore()
const copyrightYear = computed(() => {
  const y = Number.parseInt(String(todayYmdInAppTimeZone()).slice(0, 4), 10)
  return Number.isFinite(y) ? y : new Date().getFullYear()
})

const loginForm = reactive({
  corpId: '',
  password: '',
  system: ''
})

function sanitizeCorpId (raw) {
  return String(raw ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

function onCorpIdInput (val) {
  loginForm.corpId = sanitizeCorpId(val)
}

const systemOptions = [
  {
    label: 'EV Charging Booking',
    labelLines: ['EV Charging', 'Booking'],
    value: 'parking',
    icon: 'car'
  },
  {
    label: 'Venue Booking',
    labelLines: ['Venue', 'Booking'],
    value: 'room',
    icon: 'building'
  },
  {
    label: 'Admin Management',
    labelLines: ['Admin', 'Management'],
    value: 'admin',
    icon: 'user-gear'
  }
]

const POINTS_TO_NOTE_KEYS = {
  parking: 'ev_booking_points_to_note',
  room: 'venue_booking_points_to_note'
}

const pointsToNoteByKey = ref({
  [POINTS_TO_NOTE_KEYS.parking]: '',
  [POINTS_TO_NOTE_KEYS.room]: ''
})
const pointsToNoteLoading = ref(false)
const userGuideUrl = ref('')
const operationsManualUrl = ref('')
/** 后台配置为「参考宽」下的基准百分比；窗口变窄时按视口宽度缩小（幅度加大） */
const loginPointsToNoteWidthPercent = ref(85)
const NOTES_WIDTH_REF_PX = 1920
/** >1 时变窄缩得更狠（线性为 1） */
const NOTES_WIDTH_SHRINK_POWER = 1.45
const NOTES_WIDTH_PCT_FLOOR = 42
const viewportWidthPx = ref(
  typeof window !== 'undefined' ? window.innerWidth : NOTES_WIDTH_REF_PX
)

function syncViewportWidthPx () {
  if (typeof window === 'undefined') return
  viewportWidthPx.value = window.innerWidth || NOTES_WIDTH_REF_PX
}

const loginNotesStyle = computed(() => {
  const base = Number.isFinite(loginPointsToNoteWidthPercent.value)
    ? Math.min(100, Math.max(40, loginPointsToNoteWidthPercent.value))
    : 85
  // ≥ 参考宽：用配置百分比；变窄：percent × (当前宽/参考宽)^power
  const linear = Math.min(1, viewportWidthPx.value / NOTES_WIDTH_REF_PX)
  const scale = Math.pow(linear, NOTES_WIDTH_SHRINK_POWER)
  const pct = Math.max(NOTES_WIDTH_PCT_FLOOR, Math.round(base * scale * 10) / 10)
  return {
    width: `${pct}%`,
    maxWidth: '100%'
  }
})

async function loadLoginDocs () {
  try {
    const data = await getLoginDocs({ silentError: true })
    userGuideUrl.value = String(data?.userGuideUrl || '').trim()
    operationsManualUrl.value = String(data?.operationsManualUrl || '').trim()
    const widthPct = Number(data?.loginPointsToNoteWidthPercent)
    loginPointsToNoteWidthPercent.value =
      Number.isFinite(widthPct) && widthPct >= 40 && widthPct <= 100
        ? Math.round(widthPct)
        : 85
  } catch {
    userGuideUrl.value = ''
    operationsManualUrl.value = ''
    loginPointsToNoteWidthPercent.value = 85
  }
}

function applyPointsToNoteList (list) {
  const findContent = (key) =>
    list.find((item) => item.key === key)?.content || ''
  pointsToNoteByKey.value = {
    [POINTS_TO_NOTE_KEYS.parking]: findContent(POINTS_TO_NOTE_KEYS.parking),
    [POINTS_TO_NOTE_KEYS.room]: findContent(POINTS_TO_NOTE_KEYS.room)
  }
}

const loadPointsToNote = async () => {
  pointsToNoteLoading.value = true
  try {
    const data = await getPublicPointsToNote()
    const list = Array.isArray(data) ? data : []
    applyPointsToNoteList(list)
  } catch {
    applyPointsToNoteList(getMockPromptList())
  } finally {
    pointsToNoteLoading.value = false
  }
}

function hasMeaningfulPointsToNote (html) {
  const text = String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 0
}

const showPointsToNoteSection = computed(() => {
  if (loginForm.system !== 'parking' && loginForm.system !== 'room') return false
  if (pointsToNoteLoading.value) return false
  const targetKey = POINTS_TO_NOTE_KEYS[loginForm.system]
  if (!targetKey) return false
  return hasMeaningfulPointsToNote(pointsToNoteByKey.value[targetKey])
})

const currentPointsToNoteContent = computed(() => {
  const targetKey = POINTS_TO_NOTE_KEYS[loginForm.system]
  if (!targetKey) return ''
  const raw = pointsToNoteByKey.value[targetKey] || ''
  return formatPointsToNoteForDisplay(raw, { includeHeading: true })
})

const loginMainRef = ref(null)
/** 内容略紧时收紧 Notes↔版权间距 */
const loginCompact = ref(false)
let loginFitRo = null
let loginFitTimer = 0

async function syncLoginFit () {
  await nextTick()
  const el = loginMainRef.value
  if (!el) return
  loginCompact.value = false
  await nextTick()
  loginCompact.value = el.scrollHeight > el.clientHeight + 1
}

function scheduleLoginFit () {
  window.clearTimeout(loginFitTimer)
  loginFitTimer = window.setTimeout(() => { void syncLoginFit() }, 50)
}

onMounted(() => {
  syncViewportWidthPx()
  window.addEventListener('resize', syncViewportWidthPx, { passive: true })
  window.addEventListener('resize', scheduleLoginFit, { passive: true })
  void nextTick(() => {
    if (typeof ResizeObserver !== 'undefined' && loginMainRef.value) {
      loginFitRo = new ResizeObserver(() => scheduleLoginFit())
      loginFitRo.observe(loginMainRef.value)
    }
    scheduleLoginFit()
  })
  void loadPointsToNote().finally(() => scheduleLoginFit())
  void loadLoginDocs()
})

onUnmounted(() => {
  window.removeEventListener('resize', syncViewportWidthPx)
  window.removeEventListener('resize', scheduleLoginFit)
  window.clearTimeout(loginFitTimer)
  loginFitRo?.disconnect()
  loginFitRo = null
})

watch(
  [showPointsToNoteSection, currentPointsToNoteContent, () => loginForm.system],
  () => scheduleLoginFit()
)

const loginRules = {
  corpId: [
    { required: true, message: 'Please enter CORP User ID', trigger: 'blur' }
  ],
  password: [
    { required: true, message: 'Please enter password', trigger: 'blur' }
  ],
  system: [
    { required: true, message: 'Please select a system', trigger: 'blur' }
  ]
}

const showStatusDialog = (message, type = 'warning') => {
  statusDialogStore.show(message, type)
}

const resolveLoginErrorMessage = (error) => {
  const payload = error?.response?.data
  const raw = payload?.message
  const message = Array.isArray(raw) ? raw[0] : raw
  if (typeof message === 'string' && message.trim()) {
    return message.trim()
  }
  if (error?.response?.status === 403) {
    return 'Account is not active. Please contact the administrator.'
  }
  return error?.message || 'Login failed'
}

const handleLogin = async () => {
  const corpId = sanitizeCorpId(loginForm.corpId)
  loginForm.corpId = corpId
  const password = loginForm.password?.trim()

  if (!loginForm.system) {
    showStatusDialog('Select a system before click to login', 'warning')
    return
  }

  if (!corpId || !password) {
    showStatusDialog('Missing CORP User ID / password', 'error')
    return
  }

  loading.value = true
  try {
    const res = await loginApi({
      corpId,
      password,
      system: loginForm.system
    })

    if (!canAccessSystem(res.user, loginForm.system)) {
      showStatusDialog(getDeniedSystemMessage(loginForm.system), 'error')
      return
    }

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    if (redirect && !canAccessPath(res.user, redirect)) {
      showStatusDialog(getDeniedSystemMessage(systemForPath(redirect) || loginForm.system), 'error')
      return
    }

    userStore.login(res.user, res.token)
    statusDialogStore.hide()

    if (redirect) {
      router.push(redirect)
      return
    }
    if (loginForm.system === 'parking') {
      router.push('/evBooking/Calendar')
    } else if (loginForm.system === 'room') {
      router.push('/VenueBooking')
    } else if (loginForm.system === 'admin') {
      router.push('/admin')
    } else {
      router.push('/login')
    }
  } catch (error) {
    showStatusDialog(resolveLoginErrorMessage(error), 'error')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  height: var(--zoom-vh, 100vh);
  max-height: var(--zoom-vh, 100vh);
  background: linear-gradient(135deg, #f8ecdd 0%, #f5e6d3 50%, #f8ecdd 100%);
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  position: relative;
  box-sizing: border-box;
  overflow: hidden;
}

.login-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    radial-gradient(circle at 20% 30%, rgba(0, 114, 58, 0.03) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(0, 114, 58, 0.02) 0%, transparent 50%);
  pointer-events: none;
}

.login-header {
  flex: 0 0 auto;
  width: 100%;
  min-height: var(--app-header-height, 60px);
  padding: 0.65rem 1.6rem; /* 与内页 AppHeader 一致 */
  box-sizing: border-box;
  background: #0A3D1F;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  position: relative;
  z-index: 20;
}

.login-main {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  /* 事先留出滚动条槽，避免出现时先挤左再回弹闪一下；槽透出页面底色，不显白边 */
  scrollbar-gutter: stable;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding-bottom: 0;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
  background: transparent;
  scrollbar-width: thin;
  scrollbar-color: rgba(10, 61, 31, 0.4) transparent;
}

/* 不支持 scrollbar-gutter 时始终占位，同样避免闪动 */
@supports not (scrollbar-gutter: stable) {
  .login-main {
    overflow-y: scroll;
  }
}

.login-main::-webkit-scrollbar {
  width: 8px;
  height: 8px;
  background: transparent;
}

.login-main::-webkit-scrollbar-track {
  background: transparent;
}

.login-main::-webkit-scrollbar-thumb {
  background-color: rgba(10, 61, 31, 0.35);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.login-main::-webkit-scrollbar-thumb:hover {
  background-color: rgba(10, 61, 31, 0.5);
}

.login-copyright {
  flex: 0 0 auto;
  position: relative;
  z-index: 1;
  margin: 0;
  padding: 10px 16px 10px;
  box-sizing: border-box;
  text-align: center;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.15;
  color: #4b5563;
  /* 不单独铺底：承接整页暖橙渐变，内容也不会滚到字下面 */
  background: none;
  border-top: none;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.login-header-logo {
  height: 32px;
  width: auto;
  object-fit: contain;
}

.login-title {
  margin: 0;
  font-size: 1.125rem; /* 与内页 header text-lg 一致 */
  line-height: 1.75rem;
  color: #ffffff;
  font-weight: 700;
}

.system-buttons-container {
  /* 用 100% 而非 100vw，避免视口滚动条宽度变化时左右位移 */
  width: min(calc(100% - 2rem), 480px);
  margin: 2rem auto 1rem;
  position: relative;
  z-index: 1;
}

.system-caption {
  margin: 4px 0 14px;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #0A3D1F;
  line-height: 1.3;
}

.login-card {
  width: min(calc(100% - 2rem), 480px);
  margin: 0 auto;
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid rgba(0, 114, 58, 0.08);
  padding: 28px 36px 32px;
  box-sizing: border-box;
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.06),
    0 1px 4px rgba(0, 0, 0, 0.04);
  position: relative;
  z-index: 1;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.login-card:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 30px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.06);
}

.login-form {
  width: 100%;
}

.login-form :deep(.el-form-item) {
  margin-bottom: 20px;
}

.login-form :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.login-form :deep(.login-submit-item) {
  margin-bottom: 8px;
}

.login-input :deep(.el-input__wrapper) {
  border-radius: 8px;
  border: 2px solid #e0e0e0;
  box-shadow: none !important;
  transition: border-color 0.3s ease, background-color 0.3s ease;
  background-color: #fafafa;
}

.login-input :deep(.el-input__inner) {
  font-size: 15px;
  font-weight: 500;
  line-height: 1.4;
  color: #1f2937;
}

.login-input :deep(.el-input__wrapper:hover) {
  border-color: #b8b8b8;
  background-color: #ffffff;
}

.login-input :deep(.el-input__wrapper.is-focus) {
  border-color: #0A3D1F;
  background-color: #ffffff;
}

.login-form :deep(.el-form-item.is-error .el-input__wrapper) {
  border-color: #f56c6c;
  animation: shake 0.4s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.input-with-prefix :deep(.el-input__wrapper) {
  padding-left: 0;
  /* 圆角裁切前缀背景，外框用真实 border，避免左侧描边被挡住 */
  overflow: hidden;
}

.input-with-prefix :deep(.el-input__prefix) {
  padding-left: 0;
  padding-right: 0;
  height: 100%;
  width: 106px; /* 96px 标签等宽 + 10px 与输入间距 */
}

.input-with-prefix :deep(.el-input__prefix-inner) {
  height: 100%;
  width: 100%;
}

.input-prefix-text {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  box-sizing: border-box;
  height: 100%;
  width: 96px;
  min-width: 96px;
  padding: 0 10px;
  margin-right: 10px;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #555555;
  background: linear-gradient(180deg, #f3f3f3 0%, #ebebeb 100%);
  border-right: 1px solid #d4d4d4;
  border-radius: 7px 0 0 7px;
  transition: background 0.25s ease, color 0.25s ease, border-color 0.25s ease;
}

.login-input :deep(.el-input__wrapper.is-focus) .input-prefix-text {
  background: linear-gradient(180deg, #eeeeee 0%, #e4e4e4 100%);
  color: #333333;
  border-right-color: #c8c8c8;
}

.login-form :deep(.el-form-item.is-error .input-prefix-text) {
  background: linear-gradient(180deg, #f3f3f3 0%, #ebebeb 100%);
  color: #555555;
  border-right-color: #d4d4d4;
}

.login-form :deep(.el-form-item__error) {
  font-size: 14px;
  font-weight: 500;
  padding-top: 4px;
}

.system-buttons-item {
  margin-bottom: 0;
}

.system-buttons-item :deep(.el-form-item__error) {
  text-align: center;
  margin-top: 18px;
  font-weight: 500;
  font-size: 14px;
}

.system-buttons {
  display: flex;
  justify-content: center;
  gap: 2rem;
  width: 100%;
  flex-wrap: nowrap;
}

.system-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 7rem;
  height: 7rem;
  border-radius: 50%;
  border: 2px solid #d8d8d8;
  background: linear-gradient(135deg, #ffffff 0%, #f8f8f8 100%);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 0;
  outline: none;
  position: relative;
  overflow: hidden;
}

.system-button::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(0, 114, 58, 0.1);
  transform: translate(-50%, -50%);
  transition: width 0.4s ease, height 0.4s ease;
}

.system-button:hover::before {
  width: 100%;
  height: 100%;
}

.system-button:hover {
  border-color: #0A3D1F;
  background: linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%);
  box-shadow: 0 4px 16px rgba(0, 114, 58, 0.15);
  transform: translateY(-3px) scale(1.05);
}

.system-button.active {
  border-color: #0A3D1F;
  background: linear-gradient(135deg, #0A3D1F 0%, #005a2f 100%);
  color: #ffffff;
  box-shadow: 0 0 0 4px rgba(0, 114, 58, 0.2), 0 4px 16px rgba(0, 114, 58, 0.3);
  transform: scale(1.08);
}

.system-button.active::before {
  display: none;
}

.button-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 5px;
  font-size: 22px;
  position: relative;
  z-index: 1;
  transition: transform 0.3s ease;
}

.system-button:hover .button-icon {
  transform: scale(1.1);
}

.button-icon :deep(svg) {
  width: 24px;
  height: 24px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.system-button.active .button-icon :deep(svg) {
  color: #ffffff;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.button-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  line-height: 1.15;
  color: #4a4a4a;
  padding: 0 4px;
  position: relative;
  z-index: 1;
  transition: color 0.3s ease;
}

.button-label-line {
  display: block;
  white-space: nowrap;
}

.system-button:hover .button-label {
  color: #0A3D1F;
}

.system-button.active .button-label {
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.login-button {
  width: 100%;
  background: linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%);
  border: none;
  color: #ffffff;
  font-size: 17px;
  font-weight: 600;
  border-radius: 8px;
  height: 48px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  position: relative;
  overflow: hidden;
}

.login-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s ease;
}

.login-button:hover::before {
  left: 100%;
}

.login-button:hover {
  background: linear-gradient(135deg, #3a3a3a 0%, #2c2c2c 100%);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  transform: translateY(-2px);
}

.login-button:active {
  background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.login-button.is-loading {
  background: linear-gradient(135deg, #4a4a4a 0%, #3a3a3a 100%);
  cursor: not-allowed;
}

.signup-row {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  margin-top: 0;
}

.login-docs-tip {
  margin: 0;
  width: 100%;
  font-size: 14px;
  line-height: 1.4;
  color: #4b5563;
  text-align: left;
  white-space: nowrap;
}

.login-docs-link {
  color: #0A3D1F;
  font-weight: 700;
  text-decoration: underline;
  white-space: nowrap;
}

.login-docs-link:hover {
  color: #005a2f;
}

.login-docs-link.is-disabled {
  color: #0A3D1F;
  cursor: default;
  pointer-events: none;
}

.signup-link {
  color: #0A3D1F;
  font-size: 14px;
  font-weight: 700;
  text-decoration: underline;
  line-height: 1.4;
  align-self: flex-end;
  white-space: nowrap;
}

.signup-link:hover {
  text-decoration: underline;
}

.login-notes {
  /* 与登录卡同列滚动；多余空白在卡与 Points 之间 */
  flex: 0 0 auto;
  margin-top: auto;
  margin-left: auto;
  margin-right: auto;
  margin-bottom: 0;
  padding: 0.35rem 0 0;
  background: transparent;
  border-top: none;
  box-sizing: border-box;
  font-size: 15px;
  line-height: 1.3;
  color: #2d4a32;
  text-align: left;
  box-shadow: none;
}

/* compact 只再收紧 Points↔版权 */
.login-compact .login-notes {
  padding-top: 0.2rem;
}

.login-compact .login-copyright {
  padding-top: 10px;
  padding-bottom: 10px;
}

.login-notes-inner {
  width: 100%;
}

.notes-loading {
  margin: 0;
  color: #6b7280;
  font-style: italic;
}

.notes-content {
  font-synthesis: style;
}

.notes-content :deep(em),
.notes-content :deep(i),
.notes-content :deep([style*='font-style: italic']),
.notes-content :deep([style*='font-style:italic']) {
  font-style: italic !important;
}

.notes-content :deep(strong),
.notes-content :deep(b) {
  font-weight: 700;
  color: inherit;
}

.notes-content :deep(u) {
  text-decoration: underline;
}

.notes-content :deep(p) {
  margin: 0 0 8px;
}

.notes-content :deep(p:first-child strong) {
  display: inline-block;
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 700;
  color: #0A3D1F;
  letter-spacing: 0.3px;
}

.notes-content :deep(ol) {
  margin: 0;
  padding-left: 1.25rem;
}

.notes-content :deep(li + li) {
  margin-top: 6px;
}

.notes-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0 0;
  text-align: left;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.notes-content :deep(th),
.notes-content :deep(td) {
  padding: 6px 10px;
  font-size: 15px;
  text-align: left;
  border: 1px solid #d1d5db;
}

/* 表头：覆盖编辑器内联底色，避免与暖橙页背景融为一体 */
.notes-content :deep(thead th),
.notes-content :deep(th) {
  font-weight: 700;
  background: linear-gradient(135deg, #c5e3cf 0%, #b4d9c0 100%) !important;
  color: #0a3d1f !important;
}

/* 无 thead 时，首行作表头 */
.notes-content :deep(table:not(:has(thead)) tbody > tr:first-child > td) {
  font-weight: 700;
  background: linear-gradient(135deg, #c5e3cf 0%, #b4d9c0 100%) !important;
  color: #0a3d1f !important;
}

.notes-content :deep(tbody tr:nth-child(odd)) td {
  background-color: #ffffff;
}

.notes-content :deep(tbody tr:nth-child(even)) td {
  background-color: #f3f4f6;
}

/* 响应式设置 */
@media (max-width: 1180px) {
  .login-header {
    padding-inline: 0.9rem;
  }
}

@media (max-width: 389px), (min-width: 390px) and (max-width: 767px) {
  .login-header-logo {
    height: 24px;
  }

  .login-title {
    font-size: 1rem;
    line-height: 1.5rem;
  }

  .system-buttons-container {
    margin: 2.5rem auto 1.25rem;
  }

  .login-card {
    padding: 28px 28px 32px;
    border-radius: 12px;
  }

  .button-label {
    font-size: 13px;
  }

  .system-buttons {
    gap: 1.25rem;
  }

  .system-button {
    width: 6.25rem;
    height: 6.25rem;
  }
}

@media (max-width: 389px) {
  .system-button {
    width: 5.5rem;
    height: 5.5rem;
  }

  .button-icon {
    font-size: 18px;
    margin-bottom: 4px;
  }

  .button-icon :deep(svg) {
    width: 20px;
    height: 20px;
  }

  .button-label {
    font-size: 12px;
  }

  .system-buttons {
    gap: 1rem;
  }

  .login-card {
    padding: 24px 20px 28px;
  }

  .notes-content :deep(table) {
    width: 100%;
  }
}
</style>






