<template>
  <div class="login-container flex flex-col min-h-screen bg-[#f8ecdd]">
    <header class="login-header w-full">
      <div class="header-content">
        <img src="../assets/TKOH_logo.png" alt="TKOH Logo" class="login-header-logo" />
        <h1 class="login-title">
          <span class="title-main">TKOH</span>
          <span class="title-subtitle">GA Service Center</span>
        </h1>
      </div>
      <FloatingHelpButton :system-override="loginForm.system" />
    </header>

    <!-- 系统选择按钮区：在不同屏幕下自适应宽度和间距 -->
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
            <span class="button-label">{{ item.label }}</span>
          </button>
        </div>
      </el-form-item>
    </div>

    <!-- 登录卡片：自适应宽度，居中显示 -->
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
        <el-form-item>
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
        </div>
      </el-form>
    </div>

    <!-- 底部说明：EV / Venue 切换时显示对应 Points to Note（后台 system_fixed） -->
    <section v-if="showPointsToNoteSection" class="login-notes w-full mt-6 py-3 px-0">
      <div class="w-full">
        <p v-if="pointsToNoteLoading" class="notes-content notes-loading">Loading...</p>
        <div
          v-else-if="currentPointsToNoteContent"
          class="notes-content rich-content"
          v-html="currentPointsToNoteContent"
        ></div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { useStatusDialogStore } from '@/stores/statusDialog'
import { login as loginApi } from '../api/auth'
import { getPublicPointsToNote } from '@/api/promptManagement'
import { getMockPromptList } from '@/mocks/mockData'
import { formatPointsToNoteForDisplay } from '@/utils/pointsToNoteHtml'
import { canAccessSystem, canAccessPath, getDeniedSystemMessage, systemForPath } from '@/utils/systemAccess'
import FloatingHelpButton from '@/components/FloatingHelpButton.vue'
import '@/styles/rich-content.css'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const loginFormRef = ref(null)
const loading = ref(false)
const statusDialogStore = useStatusDialogStore()

const loginForm = reactive({
  corpId: '',
  password: '',
  system: ''
})

const systemOptions = [
  { label: 'EV Booking', value: 'parking', icon: 'car' },
  { label: 'Venue Booking', value: 'room', icon: 'building' },
  { label: 'Admin Management', value: 'admin', icon: 'user-gear' }
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

const showPointsToNoteSection = computed(
  () => loginForm.system === 'parking' || loginForm.system === 'room'
)

const currentPointsToNoteContent = computed(() => {
  const targetKey = POINTS_TO_NOTE_KEYS[loginForm.system]
  if (!targetKey) return ''
  const raw = pointsToNoteByKey.value[targetKey] || ''
  return formatPointsToNoteForDisplay(raw, { includeHeading: true })
})

onMounted(() => {
  void loadPointsToNote()
})

const loginRules = {
  corpId: [
    { required: true, message: 'Please enter CORP ID', trigger: 'blur' }
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
  const corpId = loginForm.corpId?.trim()
  const password = loginForm.password?.trim()

  if (!loginForm.system) {
    showStatusDialog('Select a system before click to login', 'warning')
    return
  }

  if (!corpId || !password) {
    showStatusDialog('Missing corp id / password', 'error')
    return
  }

  loading.value = true
  try {
    const res = await loginApi({
      account: corpId,
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
  /* 与 Booking 页面统一：最小高度一屏，自适应内容 */
  min-height: var(--zoom-vh);
  background: linear-gradient(135deg, #f8ecdd 0%, #f5e6d3 50%, #f8ecdd 100%);
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  position: relative;
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
  width: 100%;
  padding: 12px 32px;
  box-sizing: border-box;
  background: linear-gradient(135deg, #0A3D1F 0%, #005a2f 100%);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  box-shadow: 0 2px 12px rgba(0, 114, 58, 0.15);
  position: relative;
  z-index: 10;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.login-header-logo {
  height: 36px;
  width: auto;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.login-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.title-main {
  font-weight: 700;
}

.title-subtitle {
  margin-left: 6px;
  font-weight: 400;
  opacity: 0.95;
}

.system-buttons-container {
  width: min(100vw - 2rem, 480px);
  margin: 2rem auto 1rem;
  position: relative;
  z-index: 1;
}

.system-caption {
  margin: 12px 0 0;
  font-size: 13px;
  color: #666666;
  text-align: center;
  font-weight: 500;
  letter-spacing: 0.3px;
}

.login-card {
  width: min(100vw - 2rem, 480px);
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

.login-input :deep(.el-input__wrapper) {
  border-radius: 8px;
  box-shadow: 0 0 0 1px #e0e0e0 inset;
  transition: all 0.3s ease;
  background-color: #fafafa;
}

.login-input :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #b8b8b8 inset;
  background-color: #ffffff;
}

.login-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px #0A3D1F inset;
  background-color: #ffffff;
}

.login-form :deep(.el-form-item.is-error .el-input__wrapper) {
  box-shadow: 0 0 0 2px #f56c6c inset;
  animation: shake 0.4s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.input-with-prefix :deep(.el-input__wrapper) {
  padding-left: 1px;
}

.input-with-prefix :deep(.el-input__prefix) {
  padding-left: 0;
  padding-right: 0;
}

.input-prefix-text {
  font-size: 13px;
  color: #666666;
  width: 80px;
  padding: 0 10px;
  background: linear-gradient(135deg, #f0f0f0 0%, #e8e8e8 100%);
  border-right: 1px solid #d0d0d0;
  margin-right: 8px;
  white-space: nowrap;
  text-align: left;
  border-radius: 7px 0 0 7px;
  font-weight: 500;
  letter-spacing: 0.3px;
  transition: all 0.3s ease;
}

.login-input :deep(.el-input__wrapper.is-focus) .input-prefix-text {
  background: linear-gradient(135deg, #0A3D1F 0%, #005a2f 100%);
  color: #ffffff;
  border-right-color: #0A3D1F;
}

.login-form :deep(.el-form-item.is-error .input-prefix-text) {
  background: linear-gradient(135deg, #fef0f0 0%, #fde8e8 100%);
  color: #f56c6c;
  border-right-color: #f56c6c;
}

.system-buttons-item {
  margin-bottom: 0;
}

.system-buttons-item :deep(.el-form-item__error) {
  text-align: center;
  margin-top: 18px;
  font-weight: 500;
  font-size: 13px;
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
  margin-bottom: 8px;
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
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  line-height: 1.3;
  color: #4a4a4a;
  padding: 0 10px;
  position: relative;
  z-index: 1;
  transition: color 0.3s ease;
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
  font-size: 16px;
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
  justify-content: flex-end;
  margin-top: -4px;
}

.signup-link {
  color: #0A3D1F;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
  line-height: 1;
}

.signup-link:hover {
  text-decoration: underline;
}

.login-notes {
  width: 100%;
  margin-top: auto;
  padding: 1.5rem 1.5rem 2rem;
  background: linear-gradient(135deg, #e8f7ec 0%, #dff3e3 100%);
  border-top: 2px solid #c8e6d0;
  box-sizing: border-box;
  font-size: 13px;
  line-height: 1.6;
  color: #2d4a32;
  text-align: left;
  box-shadow: 0 -2px 12px rgba(0, 114, 58, 0.08);
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
  font-size: 15px;
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
  width: min(100vw - 2rem, 900px);
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
  font-size: 12px;
  text-align: left;
  border: 1px solid #d1d5db;
}

.notes-content :deep(thead tr) {
  font-weight: 700;
  background: linear-gradient(135deg, #d0e8d6 0%, #c8e6d0 100%);
  color: #0A3D1F;
}

.notes-content :deep(tbody tr:nth-child(odd)) td {
  background-color: #f8fcf9;
}

.notes-content :deep(tbody tr:nth-child(even)) td {
  background-color: #ffffff;
}

/* 响应式设置 */
@media (max-width: 389px), (min-width: 390px) and (max-width: 767px) {
  .login-header {
    padding: 18px 24px;
  }

  .login-header-logo {
    height: 28px;
  }

  .login-title {
    font-size: 18px;
  }

  .title-subtitle {
    font-size: 0.9rem;
  }

  .system-buttons-container {
    margin: 2.5rem auto 1.25rem;
  }

  .login-card {
    padding: 28px 28px 32px;
    border-radius: 12px;
  }

  .button-label {
    font-size: 11px;
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
    margin-bottom: 6px;
  }

  .button-icon :deep(svg) {
    width: 20px;
    height: 20px;
  }

  .button-label {
    font-size: 10px;
  }

  .system-buttons {
    gap: 1rem;
  }

  .login-card {
    padding: 24px 20px 28px;
  }

  .notes-content :deep(table) {
    width: min(100vw - 1.5rem, 900px);
  }
}
</style>






