<template>
  <div class="page h-screen bg-gradient flex flex-col overflow-hidden" style="padding-top: var(--app-header-height, 64px);">
    <AppHeader />

    <main class="account-main flex-1 flex items-start justify-center px-2 md:px-3 lg:px-4 py-1 md:py-2 overflow-y-auto">
      <div
        class="account-container max-w-6xl w-full"
        :class="{ 'account-container--two-cards': !showVehicleSection }"
      >
        <div class="account-grid" :class="{ 'account-grid--two-cards': !showVehicleSection }">
          <!-- Profile Section -->
          <section class="profile-section card-style">
            <div class="section-header">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="section-icon">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <h2 class="section-title">User Profile</h2>
            </div>

            <div class="form-grid">
              <div class="form-row">
                <div class="form-group full-width">
                  <label class="form-label">Name (e.g. Peter CHAN / TM CHAN)<span class="required">*</span></label>
                  <input type="text" v-model="profile.fullName" class="form-input" placeholder="Enter your first name + last name" disabled />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Username (Corp ID)</label>
                  <input type="text" v-model="profile.corpId" class="form-input" disabled />
                </div>
                <div class="form-group">
                  <label class="form-label">Email (e.g. xxx@ha.org.hk)</label>
                  <input type="email" v-model="profile.email" class="form-input" disabled />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Contact No. (Recommended: Office Tel.)<span class="required">*</span></label>
                  <input type="text" v-model="profile.phone" class="form-input" placeholder="12345678" disabled />
                </div>
                <div class="form-group">
                  <label class="form-label">Employee No.<span class="required">*</span></label>
                  <input type="text" v-model="profile.employeeNo" class="form-input" placeholder="123456" disabled />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Department <span class="required">*</span></label>
                  <input type="text" v-model="profile.department" class="form-input" placeholder="Enter your department" disabled />
                </div>
                <div class="form-group">
                  <label class="form-label">Assign Roles / Access Level</label>
                  <input type="text" v-model="profile.accessLevel" class="form-input" disabled />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group full-width">
                  <label class="form-label">Booking rule e.g. booking quotas</label>
                  <input type="text" v-model="profile.bookingRule" class="form-input" disabled />
                </div>
              </div>
            </div>

          </section>

          <!-- Change Password Section -->
          <section class="password-section card-style">
            <div class="section-header">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="section-icon">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <h2 class="section-title">Change Password</h2>
            </div>

            <div class="form-grid">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Current Password <span class="required">*</span></label>
                  <div class="password-input-wrapper">
                    <input :type="showPassword.current ? 'text' : 'password'" v-model="password.current" class="form-input password-input" placeholder="Enter current password" />
                    <button type="button" class="password-toggle-btn" @click="showPassword.current = !showPassword.current">
                      <svg v-if="showPassword.current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3 3l18 18"></path>
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path>
                        <path d="M9.2 5.2A10.9 10.9 0 0 1 12 5c5.5 0 9.5 4.5 10.8 7-.7 1.4-1.8 2.8-3.3 4"></path>
                        <path d="M6.2 6.2C4.5 7.4 3.2 9 2.2 12c.9 1.8 2.4 3.7 4.6 5.1"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                      <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2.2 12C3.5 9.5 6.8 5 12 5s8.5 4.5 9.8 7c-1.3 2.5-4.6 7-9.8 7s-8.5-4.5-9.8-7z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    </button>
                  </div>
                </div>
                <div class="form-group">
                  <p class="password-warning">Please DO NOT use any HA login password as your new password.</p>
                  <label class="form-label">New Password <span class="required">*</span></label>
                  <div class="password-input-wrapper">
                    <input :type="showPassword.new ? 'text' : 'password'" v-model="password.new" class="form-input password-input" placeholder="Enter new password" />
                    <button type="button" class="password-toggle-btn" @click="showPassword.new = !showPassword.new">
                      <svg v-if="showPassword.new" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3 3l18 18"></path>
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path>
                        <path d="M9.2 5.2A10.9 10.9 0 0 1 12 5c5.5 0 9.5 4.5 10.8 7-.7 1.4-1.8 2.8-3.3 4"></path>
                        <path d="M6.2 6.2C4.5 7.4 3.2 9 2.2 12c.9 1.8 2.4 3.7 4.6 5.1"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                      <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2.2 12C3.5 9.5 6.8 5 12 5s8.5 4.5 9.8 7c-1.3 2.5-4.6 7-9.8 7s-8.5-4.5-9.8-7z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Confirm New Password <span class="required">*</span></label>
                  <div class="password-input-wrapper">
                    <input :type="showPassword.confirm ? 'text' : 'password'" v-model="password.confirm" class="form-input password-input" placeholder="Confirm new password" />
                    <button type="button" class="password-toggle-btn" @click="showPassword.confirm = !showPassword.confirm">
                      <svg v-if="showPassword.confirm" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3 3l18 18"></path>
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path>
                        <path d="M9.2 5.2A10.9 10.9 0 0 1 12 5c5.5 0 9.5 4.5 10.8 7-.7 1.4-1.8 2.8-3.3 4"></path>
                        <path d="M6.2 6.2C4.5 7.4 3.2 9 2.2 12c.9 1.8 2.4 3.7 4.6 5.1"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                      <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2.2 12C3.5 9.5 6.8 5 12 5s8.5 4.5 9.8 7c-1.3 2.5-4.6 7-9.8 7s-8.5-4.5-9.8-7z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-actions with-border">
              <button class="btn-update" @click="updatePassword">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
                </svg>
                Update Password
              </button>
            </div>
          </section>

          <!-- Vehicle License Plates Section -->
          <section v-if="showVehicleSection" class="vehicle-section card-style">
            <div class="section-header">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="section-icon">
                <path d="M5 17h14v-5H5v5z"></path>
                <path d="M5 12V9l2-3h10l2 3v3"></path>
                <circle cx="7" cy="17" r="2"></circle>
                <circle cx="17" cy="17" r="2"></circle>
              </svg>
              <h2 class="section-title">Vehicle Information</h2>
            </div>

            <div class="vehicle-list">
              <div
                v-for="(vehicle, index) in sortedVehicles"
                :key="vehicle.id"
                class="vehicle-item"
                :class="{ 'vehicle-default': vehicle.isDefault }"
                @click="setDefaultVehicle(vehicle.id)"
              >
                <div class="vehicle-number">{{ index + 1 }}</div>
                <div class="vehicle-info">
                  <div class="vehicle-main">
                    <div class="vehicle-plate">{{ vehicle.plate }}</div>
                    <div class="vehicle-badge-group">
                      <div v-if="vehicle.isDefault" class="vehicle-default-badge">Default</div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="vehicles.length === 0" class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
                  <path d="M5 17h14v-5H5v5z"></path>
                  <path d="M5 12V9l2-3h10l2 3v3"></path>
                  <circle cx="7" cy="17" r="2"></circle>
                  <circle cx="17" cy="17" r="2"></circle>
                </svg>
                <p class="empty-text">No vehicles added yet</p>
              </div>
            </div>

          </section>
        </div>
      </div>
    </main>

    <div v-if="statusDialog.visible" class="status-modal-overlay" @click.self="statusDialog.visible = false">
      <div class="status-modal-wrapper">
        <div class="status-modal-header">
          <span class="status-modal-title">Reminder</span>
          <button type="button" class="status-modal-close" @click="statusDialog.visible = false">
            <svg viewBox="0 0 24 24" class="status-close-icon">
              <path d="M18 6L6 18M6 6l12 12" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div class="status-modal-body">
          <p :class="['status-dialog-message', statusDialog.type]">{{ statusDialog.message }}</p>
        </div>
        <div class="status-modal-footer">
          <el-button class="status-confirm-btn" type="default" @click="statusDialog.visible = false">OK</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, computed, reactive } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import { useUserStore } from '../stores/user'
import { changePassword as changePasswordApi } from '../api/auth'
import {
  getAccountVehicles,
  setDefaultAccountVehicle
} from '../api/accountVehicle'
import { isUserVenueRole } from '@/utils/systemAccess'

const userStore = useUserStore()

const showVehicleSection = computed(() => !isUserVenueRole(userStore.userInfo))

const profile = ref({
  fullName: 'Karen SHEN',
  corpId: 'E001',
  email: 'karenshen@ha.org.hk',
  phone: '12345678',
  employeeNo: '123456',
  department: 'Administration',
  accessLevel: 'Staff',
  bookingRule: 'EV: 1 session/week; Venue: 30 bookings/year'
})

const password = ref({
  current: '',
  new: '',
  confirm: ''
})
const showPassword = ref({
  current: false,
  new: false,
  confirm: false
})

const vehicles = ref([])
const statusDialog = reactive({
  visible: false,
  message: '',
  type: 'warning'
})

const sortedVehicles = computed(() => {
  return vehicles.value
    .map((v) => ({ ...v }))
    .sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1
      if (!a.isDefault && b.isDefault) return 1
      return 0
    })
})

const showStatusDialog = (message, type = 'warning') => {
  statusDialog.message = message
  statusDialog.type = type
  statusDialog.visible = true
}

const notifyError = (message) => showStatusDialog(message, 'error')
const notifySuccess = (message) => showStatusDialog(message, 'success')

const formatQuotaRule = (used, annual) => {
  if (Number(annual) === -1) return `${used ?? 0}/Unlimited`
  return `${used ?? 0}/${annual ?? 0}`
}

const updatePassword = async () => {
  if (!password.value.current || !password.value.new || !password.value.confirm) {
    notifyError('Please fill in all password fields')
    return
  }

  if (password.value.new !== password.value.confirm) {
    notifyError('New passwords do not match')
    return
  }

  if (password.value.new.length < 6) {
    notifyError('New password must be at least 6 characters')
    return
  }

  if (/\s/.test(password.value.new)) {
    notifyError('New password must not contain whitespace')
    return
  }

  try {
    const res = await changePasswordApi({
      currentPassword: password.value.current,
      newPassword: password.value.new
    })
    notifySuccess(res?.message || 'Password updated successfully!')
    password.value = { current: '', new: '', confirm: '' }
    showPassword.value = { current: false, new: false, confirm: false }
  } catch (error) {
    const msg = error?.response?.data?.message || error?.message || 'Failed to update password'
    notifyError(msg)
  }
}

const loadVehicles = async () => {
  const res = await getAccountVehicles()
  vehicles.value = (res?.vehicles || []).map((item) => ({
    id: item.id,
    plate: item.plateNumber,
    isDefault: Boolean(item.isDefault)
  }))
}

const setDefaultVehicle = async (id) => {
  const target = vehicles.value.find((v) => v.id === id)
  if (!target || target.isDefault) return
  try {
    await setDefaultAccountVehicle(id)
    await loadVehicles()
    notifySuccess('Default vehicle updated!')
  } catch (error) {
    const msg = error?.response?.data?.message || error?.message || 'Failed to update default vehicle'
    notifyError(msg)
  }
}

let __accountResizeTimer = null
const __accountLogPx = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const pick = (selector) => document.querySelector(selector)
  const px = (el, prop) => {
    if (!el) return null
    const v = window.getComputedStyle(el).getPropertyValue(prop)
    const n = Number.parseFloat(v)
    return Number.isFinite(n) ? `${n}px` : v
  }

  const title = pick('.section-title')
  const label = pick('.form-label')
  const input = pick('.form-input')
  const card = pick('.profile-section')

  console.log('[Account] viewport(px):', { w: window.innerWidth, h: window.innerHeight })
  console.log('[Account] computed(px):', {
    sectionTitleFontSize: px(title, 'font-size'),
    formLabelFontSize: px(label, 'font-size'),
    formInputFontSize: px(input, 'font-size'),
    formInputPaddingTop: px(input, 'padding-top'),
    formInputPaddingRight: px(input, 'padding-right'),
    cardPaddingTop: px(card, 'padding-top'),
    cardPaddingRight: px(card, 'padding-right')
  })
}

const __accountOnResize = () => {
  if (__accountResizeTimer) window.clearTimeout(__accountResizeTimer)
  __accountResizeTimer = window.setTimeout(__accountLogPx, 80)
}

onMounted(async () => {
  await userStore.refreshSessionUser()
  const u = userStore.userInfo || JSON.parse(localStorage.getItem('userInfo') || 'null')
  if (u) {
    profile.value.fullName = u.name || ''
    profile.value.corpId = u.corpId || ''
    profile.value.email = u.email || ''
    profile.value.phone = u.contact || ''
    profile.value.employeeNo = u.account || ''
    profile.value.department = u.department || ''
    profile.value.accessLevel = u.role || ''
    profile.value.bookingRule = `EV: ${formatQuotaRule(u.usedQuotaEv, u.annualQuotaEv)}; Venue: ${formatQuotaRule(u.usedQuotaVenue, u.annualQuotaVenue)}`
  }
  if (!isUserVenueRole(u)) {
    loadVehicles().catch((error) => {
      const msg = error?.response?.data?.message || error?.message || 'Failed to load vehicles'
      notifyError(msg)
    })
  }
  __accountLogPx()
  window.addEventListener('resize', __accountOnResize, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('resize', __accountOnResize)
  if (__accountResizeTimer) window.clearTimeout(__accountResizeTimer)
  __accountResizeTimer = null
})
</script>

<style scoped>
.bg-gradient {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
}

.account-main {
  min-height: 0;
  overflow-y: auto;
}

.account-container {
  width: 100%;
}

.account-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.card-style {
  background: white;
  border-radius: 0.5rem;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #00723a;
  flex-shrink: 0;
}

.section-icon {
  color: #00723a;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: #00723a;
  margin: 0;
}

.required {
  color: #dc2626;
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.375rem;
}

.form-input {
  padding: 0.4375rem 0.625rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  color: #111827;
  transition: all 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #00723a;
  box-shadow: 0 0 0 3px rgba(0, 114, 58, 0.1);
}

.form-input:disabled {
  background-color: #f9fafb;
  color: #6b7280;
  cursor: not-allowed;
}

.password-input-wrapper {
  position: relative;
  width: 100%;
}

.password-warning {
  margin: 0 0 0.375rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #dc2626;
  line-height: 1.4;
}

.password-input {
  width: 100%;
  padding-right: 2rem;
}

.password-toggle-btn {
  position: absolute;
  top: 50%;
  right: 0.5rem;
  transform: translateY(-50%);
  width: 1.25rem;
  height: 1.25rem;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 0.875rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.password-toggle-btn:hover {
  color: #374151;
}

.password-toggle-btn svg {
  width: 1rem;
  height: 1rem;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.form-hint {
  font-size: 0.7rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.form-actions {
  display: flex;
  justify-content: stretch;
  margin-top: 0.75rem;
  flex-shrink: 0;
}

.form-actions.with-border {
  padding-top: 0.75rem;
  border-top: 1px solid #e5e7eb;
}

.btn-save,
.btn-update,
.btn-add {
  width: 100%;
  background-color: #00723a;
  color: white;
  padding: 0.4375rem 1.25rem;
  border-radius: 0.375rem;
  border: none;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  text-align: center;
}

.btn-save:hover,
.btn-update:hover,
.btn-add:hover {
  background-color: #005a2e;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0, 114, 58, 0.2);
}

.vehicle-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.vehicle-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  background: #f9fafb;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  transition: all 0.2s;
  cursor: pointer;
  flex-shrink: 0;
}

.vehicle-item:hover {
  background: #f0fdf4;
  border-color: #00723a;
}

.vehicle-item.vehicle-default {
  background: #f0fdf4;
  border-color: #00723a;
  box-shadow: 0 0 0 2px rgba(0, 114, 58, 0.1);
}

.vehicle-item.vehicle-editing {
  background: #fffbeb;
  border-color: #f59e0b;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.1);
}

.vehicle-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  background: #00723a;
  color: white;
  border-radius: 50%;
  font-size: 0.8125rem;
  font-weight: 700;
  flex-shrink: 0;
}

.vehicle-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.vehicle-actions {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
}


.vehicle-main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.vehicle-plate {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #00723a;
  letter-spacing: 0.05em;
}

.vehicle-plate-input {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #00723a;
  letter-spacing: 0.05em;
  background: transparent;
  border: none;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  transition: all 0.2s;
  min-width: 0;
  flex: 0 1 auto;
}

.vehicle-plate-input.editing {
  background: white;
  border: 1px solid #f59e0b;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.1);
}

.vehicle-plate-input:focus {
  outline: none;
  background: white;
  border: 1px solid #f59e0b;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.1);
}

.vehicle-badge-group {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.vehicle-type {
  font-size: 0.7rem;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid;
  font-weight: 600;
}

.vehicle-type-personal {
  color: #1d4ed8;
  background: #dbeafe;
  border-color: #93c5fd;
}

.vehicle-type-company {
  color: #b45309;
  background: #fef3c7;
  border-color: #fcd34d;
}

.vehicle-default-badge {
  font-size: 0.7rem;
  color: white;
  background: #00723a;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 600;
}

.vehicle-brand {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
}

.vehicle-brand-input {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
  background: white;
  border: 1px solid #d1d5db;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  transition: all 0.2s;
}

.vehicle-brand-input:focus {
  outline: none;
  border-color: #f59e0b;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.1);
}

.vehicle-type-select {
  font-size: 0.7rem;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid;
  font-weight: 600;
  cursor: pointer;
  background: white;
}

.vehicle-type-select.vehicle-type-personal {
  color: #1d4ed8;
  background: #dbeafe;
  border-color: #93c5fd;
}

.vehicle-type-select.vehicle-type-company {
  color: #b45309;
  background: #fef3c7;
  border-color: #fcd34d;
}

.vehicle-type-select:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.1);
}

.btn-remove {
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 0.375rem;
  padding: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-remove:hover {
  background: #b91c1c;
  transform: scale(1.1);
}

.btn-edit {
  background: #f59e0b;
  color: white;
  border: none;
  border-radius: 0.375rem;
  padding: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-edit:hover {
  background: #d97706;
  transform: scale(1.1);
}

.btn-save-vehicle {
  background: #00723a;
  color: white;
  border: none;
  border-radius: 0.375rem;
  padding: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-save-vehicle:hover {
  background: #005a2e;
  transform: scale(1.1);
}

.btn-cancel-edit {
  background: #6b7280;
  color: white;
  border: none;
  border-radius: 0.375rem;
  padding: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-cancel-edit:hover {
  background: #4b5563;
  transform: scale(1.1);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  color: #9ca3af;
}

.empty-icon {
  margin-bottom: 0.5rem;
  opacity: 0.5;
}

.empty-text {
  font-size: 0.8125rem;
  margin: 0;
}

.add-vehicle-section {
  padding-top: 0.75rem;
  border-top: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.btn-add-vehicle {
  width: 100%;
  background-color: #00723a;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  border: none;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-add-vehicle:hover {
  background-color: #005a2e;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0, 114, 58, 0.2);
}

.add-vehicle-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.vehicle-default-option {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.vehicle-default-radio {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: #374151;
  cursor: pointer;
}

.form-actions-row {
  display: flex;
  gap: 0.5rem;
}

.btn-confirm,
.btn-cancel {
  flex: 1;
  padding: 0.4375rem 1rem;
  border-radius: 0.375rem;
  border: none;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-confirm {
  background-color: #00723a;
  color: white;
}

.btn-confirm:hover {
  background-color: #005a2e;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0, 114, 58, 0.2);
}

.btn-cancel {
  background-color: #6b7280;
  color: white;
}

.btn-cancel:hover {
  background-color: #4b5563;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(107, 114, 128, 0.2);
}

.form-row-compact {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
  align-items: center;
}

.btn-add-compact {
  background-color: #00723a;
  color: white;
  padding: 0.4375rem;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-add-compact:hover {
  background-color: #005a2e;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0, 114, 58, 0.2);
}

.status-modal-overlay {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.status-modal-wrapper {
  width: min(92vw, 420px);
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.status-modal-header {
  background: #00723a;
  color: #ffffff;
  padding: 0.75rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-modal-title {
  font-size: 1.0625rem;
  font-weight: 600;
  line-height: 1.5;
}

.status-modal-close {
  background: none;
  border: none;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.status-close-icon {
  width: 20px;
  height: 20px;
  stroke: #ffffff;
  fill: none;
}

.status-modal-close:hover .status-close-icon {
  stroke: #d1fae5;
}

.status-modal-body {
  padding: 1.25rem 1.5rem 1rem;
}

.status-modal-footer {
  padding: 0.9rem 1.25rem 1.1rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
}

.status-confirm-btn {
  background-color: #00723a;
  border-color: #00723a;
  color: #ffffff;
  font-weight: 600;
  min-width: 88px;
}

.status-confirm-btn:hover {
  background-color: #005a2e;
  border-color: #005a2e;
  color: #ffffff;
}

.status-dialog-message {
  margin: 0;
  font-size: 15px;
  text-align: center;
  line-height: 1.5;
  color: #333333;
}

.status-dialog-message.error {
  color: #f56c6c;
}

.status-dialog-message.success {
  color: #00723a;
}

/* Landscape: 3-column layout with fixed height */
@media (orientation: landscape) and (min-width: 769px) {
  .account-main {
    align-items: stretch;
    padding: 0.75rem;
    overflow-y: hidden;
  }

  .account-container {
    height: 100%;
    width: 100%;
    display: flex;
    flex: 1;
    align-self: stretch;
    min-height: 0;
  }

  .account-container--two-cards {
    justify-content: center;
  }

  .account-grid {
    grid-template-columns: repeat(3, 1fr);
    height: 100%;
    width: 100%;
    flex: 1;
    min-height: 0;
    gap: 0.75rem;
  }

  .account-grid--two-cards {
    grid-template-columns: repeat(2, 1fr);
    width: 66.666667%;
    flex: none;
    margin-inline: auto;
  }

  .profile-section,
  .vehicle-section,
  .password-section {
    height: 100%;
    min-height: 0;
  }

  .card-style {
    padding: 0.875rem;
  }

  .section-header {
    margin-bottom: 0.625rem;
    padding-bottom: 0.5rem;
  }

  .section-title {
    font-size: 0.9375rem;
  }

  .form-grid {
    gap: 0.625rem;
  }

  .form-row {
    grid-template-columns: 1fr;
    gap: 0.625rem;
  }

  .form-label {
    font-size: 0.75rem;
    margin-bottom: 0.3125rem;
  }

  .form-input {
    font-size: 0.75rem;
    padding: 0.375rem 0.5rem;
  }

  .form-hint {
    font-size: 0.6875rem;
  }

  .btn-save,
  .btn-update,
  .btn-add {
    font-size: 0.75rem;
    padding: 0.375rem 1rem;
  }

  .vehicle-item {
    padding: 0.5rem 0.625rem;
  }

  .vehicle-number {
    width: 1.5rem;
    height: 1.5rem;
    font-size: 0.75rem;
  }

  .vehicle-plate-input {
    font-size: 0.8125rem;
  }

  .vehicle-brand {
    font-size: 0.6875rem;
  }

  .vehicle-type,
  .vehicle-default-badge {
    font-size: 0.6875rem;
    padding: 0.125rem 0.375rem;
  }

  .password-section .form-row {
    grid-template-columns: 1fr;
  }

  .form-row-compact {
    grid-template-columns: 1fr;
  }

  .btn-add-vehicle {
    font-size: 0.75rem;
    padding: 0.4375rem 0.875rem;
  }

  .btn-confirm,
  .btn-cancel {
    font-size: 0.75rem;
    padding: 0.375rem 0.875rem;
  }
}

/* Landscape: smaller screens adjustments */
@media (orientation: landscape) and (min-width: 769px) and (max-width: 1024px) {
  .account-main {
    padding: 0.625rem;
  }

  .account-grid {
    gap: 0.625rem;
  }

  .card-style {
    padding: 0.75rem;
  }

  .section-title {
    font-size: 0.875rem;
  }

  .section-icon {
    width: 18px;
    height: 18px;
  }

  .form-label {
    font-size: 0.7rem;
  }

  .form-input {
    font-size: 0.7rem;
    padding: 0.34375rem 0.46875rem;
  }

  .vehicle-number {
    width: 1.375rem;
    height: 1.375rem;
    font-size: 0.7rem;
  }

  .vehicle-plate-input {
    font-size: 0.75rem;
  }

  .vehicle-brand {
    font-size: 0.625rem;
  }

  .vehicle-type,
  .vehicle-default-badge {
    font-size: 0.625rem;
  }
}

/* Portrait: vertical stacked layout */
@media (orientation: portrait) and (min-width: 769px) {
  .account-main {
    padding: 1rem;
    overflow-y: auto;
  }

  .account-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
    max-width: 800px;
    margin: 0 auto;
  }

  .card-style {
    padding: 1rem;
  }

  .section-header {
    margin-bottom: 0.75rem;
  }

  .section-title {
    font-size: 1rem;
  }

  .form-grid {
    gap: 0.75rem;
  }

  .form-row {
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .form-label {
    font-size: 0.8125rem;
  }

  .form-input {
    font-size: 0.8125rem;
    padding: 0.4375rem 0.625rem;
  }

  .form-hint {
    font-size: 0.7rem;
  }

  .btn-save,
  .btn-update,
  .btn-add {
    font-size: 0.8125rem;
    padding: 0.4375rem 1.25rem;
  }

  .vehicle-item {
    padding: 0.625rem 0.75rem;
  }

  .vehicle-number {
    width: 1.625rem;
    height: 1.625rem;
    font-size: 0.8125rem;
  }

  .vehicle-plate-input {
    font-size: 0.9375rem;
  }

  .vehicle-brand {
    font-size: 0.75rem;
  }

  .vehicle-type,
  .vehicle-default-badge {
    font-size: 0.7rem;
  }

  .form-row-compact {
    grid-template-columns: 1.5fr 1.5fr 1fr;
    gap: 0.5rem;
  }

  .btn-add-vehicle {
    font-size: 0.8125rem;
    padding: 0.4375rem 1rem;
  }

  .btn-confirm,
  .btn-cancel {
    font-size: 0.8125rem;
    padding: 0.4375rem 1rem;
  }
}

/* Mobile adjustments */
@media (max-width: 389px), (min-width: 390px) and (max-width: 767px) {
  .account-main {
    padding: 0.5rem;
  }

  .account-grid {
    gap: 0.75rem;
  }

  .card-style {
    padding: 0.75rem;
  }

  .form-row {
    grid-template-columns: 1fr;
    gap: 0.625rem;
  }

  .section-title {
    font-size: 0.875rem;
  }

  .section-header {
    margin-bottom: 0.625rem;
  }

  .form-label {
    font-size: 0.7rem;
  }

  .form-input {
    font-size: 0.7rem;
    padding: 0.375rem 0.5rem;
  }

  .form-hint {
    font-size: 0.65rem;
  }

  .btn-save,
  .btn-update,
  .btn-add {
    width: 100%;
    font-size: 0.75rem;
    padding: 0.4375rem 0.875rem;
  }

  .vehicle-item {
    padding: 0.5rem 0.625rem;
  }

  .vehicle-number {
    width: 1.5rem;
    height: 1.5rem;
    font-size: 0.75rem;
  }

  .vehicle-plate-input {
    font-size: 0.8125rem;
  }

  .vehicle-brand {
    font-size: 0.6875rem;
  }

  .vehicle-type,
  .vehicle-default-badge {
    font-size: 0.65rem;
  }

  .form-row-compact {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .btn-add-vehicle {
    width: 100%;
    font-size: 0.75rem;
    padding: 0.4375rem 0.875rem;
  }

  .btn-confirm,
  .btn-cancel {
    font-size: 0.75rem;
    padding: 0.4375rem 0.875rem;
  }
}

/* Small mobile adjustments */
@media (min-width: 390px) and (max-width: 767px) {
  .section-title {
    font-size: 0.8125rem;
  }

  .form-grid {
    gap: 0.5rem;
  }

  .form-label {
    font-size: 0.6875rem;
  }

  .form-input {
    font-size: 0.6875rem;
    padding: 0.34375rem 0.46875rem;
  }

  .form-hint {
    font-size: 0.625rem;
  }

  .btn-save,
  .btn-update,
  .btn-add {
    font-size: 0.7rem;
    padding: 0.40625rem 0.75rem;
  }

  .vehicle-plate {
    font-size: 0.75rem;
  }

  .vehicle-brand {
    font-size: 0.65rem;
  }
}

/* Extra small mobile adjustments */
@media (max-width: 389px) {
  .card-style {
    padding: 0.625rem;
  }

  .section-title {
    font-size: 0.75rem;
  }

  .section-icon {
    width: 16px;
    height: 16px;
  }

  .form-label {
    font-size: 0.65rem;
  }

  .form-input {
    font-size: 0.65rem;
    padding: 0.3125rem 0.4375rem;
  }

  .form-hint {
    font-size: 0.6rem;
  }

  .vehicle-plate {
    font-size: 0.7rem;
  }

  .vehicle-brand {
    font-size: 0.625rem;
  }

  .vehicle-type,
  .vehicle-default-badge {
    font-size: 0.625rem;
  }
}
</style>
