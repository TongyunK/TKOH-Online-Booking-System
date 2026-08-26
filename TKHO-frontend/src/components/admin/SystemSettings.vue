<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">System Settings</h2>
      <div class="header-actions">
        <el-button
          type="default"
          class="submit-btn"
          :loading="saving"
          :disabled="loading"
          @click="handleSave"
        >
          <font-awesome-icon :icon="['fas', 'floppy-disk']" class="btn-icon" />
          Save Settings
        </el-button>
      </div>
    </div>

    <div v-loading="loading" class="page-content">
      <div class="settings-panel">
      <div class="settings-grid">
        <section class="setting-card">
          <div class="setting-card-header">
            <div class="setting-card-title-row">
              <div class="setting-icon setting-icon--user">
                <font-awesome-icon :icon="['fas', 'user-clock']" />
              </div>
              <h3 class="setting-title">User Inactivity</h3>
            </div>
            <span class="value-pill value-pill--green">
              <span class="value-pill-label">Current</span>
              <span class="value-pill-text">{{ saved.userInactiveAfterMonths }} month{{ saved.userInactiveAfterMonths === 1 ? '' : 's' }}</span>
            </span>
          </div>

          <div class="setting-card-body">
            <label class="field-label" for="inactive-months">Inactive after (months)</label>
            <el-input-number
              id="inactive-months"
              v-model="form.userInactiveAfterMonths"
              :min="1"
              :max="120"
              :step="1"
              controls-position="right"
              class="field-control"
            />
            <p class="field-hint">Auto-set Inactive after no login. Admin excluded.</p>
          </div>
        </section>

        <section class="setting-card">
          <div class="setting-card-header">
            <div class="setting-card-title-row">
              <div class="setting-icon setting-icon--calendar">
                <font-awesome-icon :icon="['fas', 'calendar-days']" />
              </div>
              <h3 class="setting-title">Hong Kong Public Holidays</h3>
            </div>
          </div>

          <div class="setting-card-body">
            <label class="field-label" for="hk-holidays-url">Public holidays URL</label>
            <el-input
              id="hk-holidays-url"
              v-model.trim="form.hkPublicHolidaysUrl"
              placeholder="https://www.1823.gov.hk/common/ical/en.json"
              clearable
              class="field-control field-control--full"
            />
            <p class="field-hint">Reference link for Hong Kong public holidays.</p>
            <a
              v-if="form.hkPublicHolidaysUrl"
              :href="form.hkPublicHolidaysUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="url-preview"
            >
              <font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" class="url-preview-icon" />
              Open link in new tab
            </a>
          </div>
        </section>

        <section class="setting-card">
          <div class="setting-card-header">
            <div class="setting-card-title-row">
              <div class="setting-icon setting-icon--ev">
                <font-awesome-icon :icon="['fas', 'car']" />
              </div>
              <h3 class="setting-title">EV Booking Calendar</h3>
            </div>
            <span class="value-pill value-pill--green">
              <span class="value-pill-label">Current</span>
              <span class="value-pill-text">{{ saved.evDateUpdateTime }} · {{ saved.evWeeklyBookingLimit }}/wk</span>
            </span>
          </div>

          <div class="setting-card-body">
            <div class="field-group">
              <label class="field-label" for="ev-date-update-time">Date update time (HH:mm)</label>
              <el-input
                id="ev-date-update-time"
                v-model.trim="form.evDateUpdateTime"
                placeholder="13:00"
                maxlength="5"
                class="field-control field-control--time"
              />
              <p class="field-hint">HKT. Daily calendar roll-forward time.</p>
            </div>
            <div class="field-group">
              <label class="field-label" for="ev-weekly-booking-limit">Weekly limit per user</label>
              <el-input-number
                id="ev-weekly-booking-limit"
                v-model="form.evWeeklyBookingLimit"
                :min="1"
                :max="7"
                :step="1"
                controls-position="right"
                class="field-control"
              />
              <p class="field-hint">Max active bookings per user per week.</p>
            </div>
          </div>
        </section>

        <section class="setting-card">
          <div class="setting-card-header">
            <div class="setting-card-title-row">
              <div class="setting-icon setting-icon--venue">
                <font-awesome-icon :icon="['fas', 'door-open']" />
              </div>
              <h3 class="setting-title">Venue Booking Gap</h3>
            </div>
            <span class="value-pill value-pill--green">
              <span class="value-pill-label">Current</span>
              <span class="value-pill-text">{{ saved.venueBookingMinGapMinutes }} min</span>
            </span>
          </div>

          <div class="setting-card-body">
            <label class="field-label" for="venue-booking-min-gap">Minimum gap (minutes)</label>
            <el-input-number
              id="venue-booking-min-gap"
              v-model="form.venueBookingMinGapMinutes"
              :min="0"
              :max="120"
              :step="5"
              controls-position="right"
              class="field-control"
            />
            <p class="field-hint">Buffer between same-venue bookings. 0 = back-to-back.</p>
          </div>
        </section>

        <section class="setting-card">
          <div class="setting-card-header">
            <div class="setting-card-title-row">
              <div class="setting-icon setting-icon--title">
                <font-awesome-icon :icon="['fas', 'heading']" />
              </div>
              <h3 class="setting-title">Meeting / Event Title</h3>
            </div>
            <span class="value-pill value-pill--green">
              <span class="value-pill-label">Current</span>
              <span class="value-pill-text">{{ saved.venueMeetingEventTitleMaxLength }} units</span>
            </span>
          </div>

          <div class="setting-card-body">
            <label class="field-label" for="venue-meeting-event-title-max">Max length (units)</label>
            <el-input-number
              id="venue-meeting-event-title-max"
              v-model="form.venueMeetingEventTitleMaxLength"
              :min="1"
              :max="500"
              :step="1"
              controls-position="right"
              class="field-control"
            />
            <p class="field-hint">
              Maximum units for Meeting / Event Title on venue bookings.
              Each Chinese character counts as <strong>2</strong> units; other characters count as <strong>1</strong>.
            </p>
          </div>
        </section>

        <section class="setting-card">
          <div class="setting-card-header">
            <div class="setting-card-title-row">
              <div class="setting-icon setting-icon--backup">
                <font-awesome-icon :icon="['fas', 'database']" />
              </div>
              <h3 class="setting-title">Data Backup</h3>
            </div>
            <span class="value-pill value-pill--green">
              <span class="value-pill-label">Current</span>
              <span class="value-pill-text">{{ formatBackupIntervalLabel(saved.dataBackupEmailInterval) }} · {{ saved.dataBackupEmailSendTime }}</span>
            </span>
          </div>

          <div class="setting-card-body">
            <label class="field-label" for="data-backup-receiving-email">Receiving email</label>
            <el-input
              id="data-backup-receiving-email"
              v-model.trim="form.dataBackupReceivingEmail"
              type="email"
              placeholder="backup-recipient@example.com"
              clearable
              class="field-control field-control--full"
            />
            <p class="field-hint">Recipient for scheduled backup reports.</p>

            <div class="field-row">
              <div class="field-group">
                <label class="field-label" for="data-backup-time-span">Time span (days)</label>
                <el-input-number
                  id="data-backup-time-span"
                  v-model="form.dataBackupTimeSpan"
                  :min="1"
                  :max="365"
                  :step="1"
                  controls-position="right"
                  class="field-control"
                />
                <p class="field-hint">Future days included.</p>
              </div>
              <div class="field-group">
                <label class="field-label" for="data-backup-email-interval">Send interval</label>
                <el-select
                  id="data-backup-email-interval"
                  v-model="form.dataBackupEmailInterval"
                  class="field-control field-control--select"
                  :teleported="false"
                >
                  <el-option
                    v-for="option in backupEmailIntervalOptions"
                    :key="option.value"
                    :label="option.label"
                    :value="option.value"
                  />
                </el-select>
                <p class="field-hint">Default daily.</p>
              </div>
              <div class="field-group">
                <label class="field-label" for="data-backup-email-send-time">Send time (HH:mm)</label>
                <el-input
                  id="data-backup-email-send-time"
                  v-model.trim="form.dataBackupEmailSendTime"
                  placeholder="09:00"
                  maxlength="5"
                  class="field-control field-control--time"
                />
                <p class="field-hint">HKT.</p>
              </div>
            </div>

            <div class="backup-actions">
              <el-button
                type="default"
                class="submit-btn"
                :loading="sendingBackup"
                :disabled="loading || saving || sendingBackup"
                @click="handleSendBackupNow"
              >
                <font-awesome-icon :icon="['fas', 'paper-plane']" class="btn-icon" />
                Send backup now
              </el-button>
              <p class="field-hint">Saves backup settings above, then emails the Excel report immediately.</p>
            </div>
          </div>
        </section>
      </div>

      <footer v-if="updatedAt" class="settings-footer">
        <span class="footer-meta">
          <font-awesome-icon :icon="['fas', 'clock']" class="footer-meta-icon" />
          Last updated {{ formatUpdatedAt(updatedAt) }}
        </span>
      </footer>
      </div>
    </div>

    <BookingStyleModal v-model="showNoticeDialog" :title="noticeTitle" max-width="560px">
      <p class="notice-message">{{ noticeMessage }}</p>
      <template #footer>
        <el-button type="default" class="submit-btn" @click="showNoticeDialog = false">OK</el-button>
      </template>
    </BookingStyleModal>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import BookingStyleModal from '@/components/BookingStyleModal.vue'
import { getSystemSettings, saveSystemSettings, sendDataBackupNow } from '@/api/systemSettings'
import { APP_TIMEZONE } from '@/utils/appTimezone'
import { invalidateMeetingEventTitleMaxLengthCache } from '@/utils/meetingEventTitleMaxLength'

const loading = ref(false)
const saving = ref(false)
const sendingBackup = ref(false)
const updatedAt = ref(null)
const showNoticeDialog = ref(false)
const noticeTitle = ref('Notice')
const noticeMessage = ref('')

function showNotice (message, title = 'Notice') {
  noticeTitle.value = title
  noticeMessage.value = message
  showNoticeDialog.value = true
}

const form = reactive({
  userInactiveAfterMonths: 6,
  hkPublicHolidaysUrl: '',
  evDateUpdateTime: '13:00',
  evWeeklyBookingLimit: 1,
  venueBookingMinGapMinutes: 15,
  venueMeetingEventTitleMaxLength: 80,
  dataBackupReceivingEmail: '',
  dataBackupTimeSpan: 14,
  dataBackupEmailInterval: 'daily',
  dataBackupEmailSendTime: '09:00'
})

/** Last saved values shown in Current pills (only refresh after load / Save). */
const saved = reactive({
  userInactiveAfterMonths: 6,
  evDateUpdateTime: '13:00',
  evWeeklyBookingLimit: 1,
  venueBookingMinGapMinutes: 15,
  venueMeetingEventTitleMaxLength: 80,
  dataBackupEmailInterval: 'daily',
  dataBackupEmailSendTime: '09:00'
})

const backupEmailIntervalOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' }
]

function formatBackupIntervalLabel (value) {
  const option = backupEmailIntervalOptions.find((item) => item.value === value)
  return option?.label || 'Daily'
}

function formatUpdatedAt (value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-GB', {
    timeZone: APP_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

function applySavedFromForm () {
  saved.userInactiveAfterMonths = form.userInactiveAfterMonths
  saved.evDateUpdateTime = form.evDateUpdateTime
  saved.evWeeklyBookingLimit = form.evWeeklyBookingLimit
  saved.venueBookingMinGapMinutes = form.venueBookingMinGapMinutes
  saved.venueMeetingEventTitleMaxLength = form.venueMeetingEventTitleMaxLength
  saved.dataBackupEmailInterval = form.dataBackupEmailInterval
  saved.dataBackupEmailSendTime = form.dataBackupEmailSendTime
}

function applySettings (data) {
  form.userInactiveAfterMonths = Number(data?.userInactiveAfterMonths) || 6
  form.hkPublicHolidaysUrl = String(data?.hkPublicHolidaysUrl ?? '')
  form.evDateUpdateTime = String(data?.evDateUpdateTime ?? '13:00')
  form.evWeeklyBookingLimit = Number(data?.evWeeklyBookingLimit) || 1
  form.venueBookingMinGapMinutes =
    data?.venueBookingMinGapMinutes == null
      ? 15
      : Number(data.venueBookingMinGapMinutes)
  form.venueMeetingEventTitleMaxLength =
    data?.venueMeetingEventTitleMaxLength == null
      ? 80
      : Number(data.venueMeetingEventTitleMaxLength)
  form.dataBackupReceivingEmail = String(data?.dataBackupReceivingEmail ?? '')
  form.dataBackupTimeSpan = Number(data?.dataBackupTimeSpan) || 14
  form.dataBackupEmailInterval = String(data?.dataBackupEmailInterval ?? 'daily')
  form.dataBackupEmailSendTime = String(data?.dataBackupEmailSendTime ?? '09:00')
  updatedAt.value = data?.updatedAt ?? null
  applySavedFromForm()
}

async function loadSettings () {
  loading.value = true
  try {
    const data = await getSystemSettings()
    applySettings(data)
  } catch (err) {
    showNotice(
      err?.response?.data?.message || err?.message || 'Failed to load system settings',
      'Error'
    )
  } finally {
    loading.value = false
  }
}

async function handleSave () {
  if (!form.hkPublicHolidaysUrl) {
    showNotice('Hong Kong public holidays URL is required', 'Warning')
    return
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.evDateUpdateTime)) {
    showNotice('EV date update time must be HH:mm in 24-hour format', 'Warning')
    return
  }

  if (!Number.isInteger(form.evWeeklyBookingLimit) || form.evWeeklyBookingLimit < 1 || form.evWeeklyBookingLimit > 7) {
    showNotice('Weekly EV booking limit must be between 1 and 7', 'Warning')
    return
  }
  if (
    !Number.isInteger(form.venueBookingMinGapMinutes) ||
    form.venueBookingMinGapMinutes < 0 ||
    form.venueBookingMinGapMinutes > 120
  ) {
    showNotice('Venue booking minimum gap must be an integer between 0 and 120', 'Warning')
    return
  }

  if (
    !Number.isInteger(form.venueMeetingEventTitleMaxLength) ||
    form.venueMeetingEventTitleMaxLength < 1 ||
    form.venueMeetingEventTitleMaxLength > 500
  ) {
    showNotice('Meeting / Event Title max length must be an integer between 1 and 500', 'Warning')
    return
  }

  const receivingEmail = String(form.dataBackupReceivingEmail || '').trim()
  if (receivingEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receivingEmail)) {
    showNotice('Data backup receiving email must be a valid email address', 'Warning')
    return
  }

  if (
    !Number.isInteger(form.dataBackupTimeSpan) ||
    form.dataBackupTimeSpan < 1 ||
    form.dataBackupTimeSpan > 365
  ) {
    showNotice('Data backup time span must be an integer between 1 and 365', 'Warning')
    return
  }

  if (!['daily', 'weekly', 'monthly'].includes(form.dataBackupEmailInterval)) {
    showNotice('Email send interval must be Daily, Weekly, or Monthly', 'Warning')
    return
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.dataBackupEmailSendTime)) {
    showNotice('Email send time must be HH:mm in 24-hour format', 'Warning')
    return
  }

  saving.value = true
  try {
    const data = await saveSystemSettings({
      userInactiveAfterMonths: form.userInactiveAfterMonths,
      hkPublicHolidaysUrl: form.hkPublicHolidaysUrl,
      evDateUpdateTime: form.evDateUpdateTime,
      evWeeklyBookingLimit: form.evWeeklyBookingLimit,
      venueBookingMinGapMinutes: form.venueBookingMinGapMinutes,
      venueMeetingEventTitleMaxLength: form.venueMeetingEventTitleMaxLength,
      dataBackupReceivingEmail: receivingEmail,
      dataBackupTimeSpan: form.dataBackupTimeSpan,
      dataBackupEmailInterval: form.dataBackupEmailInterval,
      dataBackupEmailSendTime: form.dataBackupEmailSendTime
    })
    applySettings(data)
    invalidateMeetingEventTitleMaxLengthCache()
    showNotice('System settings saved', 'Success')
  } catch (err) {
    const msg = err?.response?.data?.message
    const errorText = Array.isArray(msg)
      ? msg.join('; ')
      : (msg || err?.message || 'Failed to save system settings')
    showNotice(errorText, 'Error')
  } finally {
    saving.value = false
  }
}

function validateBackupFields () {
  const receivingEmail = String(form.dataBackupReceivingEmail || '').trim()
  if (!receivingEmail) {
    showNotice('Please enter a receiving email before sending backup.', 'Warning')
    return null
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receivingEmail)) {
    showNotice('Data backup receiving email must be a valid email address', 'Warning')
    return null
  }
  if (
    !Number.isInteger(form.dataBackupTimeSpan) ||
    form.dataBackupTimeSpan < 1 ||
    form.dataBackupTimeSpan > 365
  ) {
    showNotice('Data backup time span must be an integer between 1 and 365', 'Warning')
    return null
  }
  if (!['daily', 'weekly', 'monthly'].includes(form.dataBackupEmailInterval)) {
    showNotice('Email send interval must be Daily, Weekly, or Monthly', 'Warning')
    return null
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.dataBackupEmailSendTime)) {
    showNotice('Email send time must be HH:mm in 24-hour format', 'Warning')
    return null
  }
  return receivingEmail
}

function formatBackupSuccessMessage (result) {
  const summary = result?.summary || {}
  const range = result?.dateRange || {}
  const parts = [
    `Backup email sent to ${result?.receivingEmail || 'recipient'}.`,
    `File: ${result?.fileName || 'TKOH_Data_Backup.xlsx'}.`,
    `Date range: ${range.startYmd || ''} to ${range.endYmd || ''}.`,
    `Venue ${summary.venueBookings ?? 0}, EV ${summary.evBookings ?? 0}, Users ${summary.users ?? 0}.`
  ]
  return parts.join(' ')
}

async function handleSendBackupNow () {
  const receivingEmail = validateBackupFields()
  if (!receivingEmail) return

  sendingBackup.value = true
  try {
    const data = await saveSystemSettings({
      dataBackupReceivingEmail: receivingEmail,
      dataBackupTimeSpan: form.dataBackupTimeSpan,
      dataBackupEmailInterval: form.dataBackupEmailInterval,
      dataBackupEmailSendTime: form.dataBackupEmailSendTime
    })
    applySettings(data)

    const result = await sendDataBackupNow()
    showNotice(formatBackupSuccessMessage(result), 'Success')
  } catch (err) {
    const msg = err?.response?.data?.message
    const errorText = Array.isArray(msg)
      ? msg.join('; ')
      : (msg || err?.message || 'Failed to send data backup email')
    showNotice(errorText, 'Error')
  } finally {
    sendingBackup.value = false
  }
}

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.page-container {
  height: 100%;
  min-height: 100%;
  min-width: 0;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  animation: fadeInUp 0.4s ease;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.page-header {
  position: relative;
  overflow: hidden;
  background: #ffffff;
  color: #111827;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  padding: 0.75rem;
  margin: 0.45rem 0.6rem 0.25rem;
  min-height: 3.625rem;
  box-sizing: border-box;
}

.page-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.btn-icon {
  margin-right: 0.375rem;
}

.page-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0.25rem 0.6rem 0.6rem;
  display: flex;
  flex-direction: column;
}

.settings-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  padding: 0.55rem 0.65rem 0.65rem;
  overflow: auto;
}

.settings-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: stretch;
}

.setting-card {
  flex: 0 0 calc((100% - 1rem) / 3);
  max-width: calc((100% - 1rem) / 3);
  box-sizing: border-box;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.setting-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.5rem 0.65rem;
  background: linear-gradient(180deg, #f9fafb 0%, #ffffff 100%);
  border-bottom: 1px solid #e5e7eb;
}

.setting-card-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.setting-icon {
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 0.375rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 0.85rem;
}

.setting-icon--user {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  color: #166534;
  border: 1px solid #86efac;
}

.setting-icon--calendar {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  color: #1d4ed8;
  border: 1px solid #93c5fd;
}

.setting-icon--ev {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #b45309;
  border: 1px solid #fcd34d;
}

.setting-icon--venue {
  background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
  color: #4338ca;
  border: 1px solid #a5b4fc;
}

.setting-icon--title {
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  color: #047857;
  border: 1px solid #6ee7b7;
}

.setting-icon--backup {
  background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%);
  color: #be185d;
  border: 1px solid #f9a8d4;
}

.setting-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
  color: #111827;
  line-height: 1.25;
}

.value-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  flex-shrink: 0;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.value-pill--green {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  border: 1px solid #86efac;
}

.value-pill-label {
  background: #166534;
  color: #ffffff;
  border-radius: 999px;
  padding: 1px 7px;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.value-pill-text {
  color: #14532d;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.value-pill-text--truncate {
  max-width: 5rem;
  overflow: hidden;
  text-overflow: ellipsis;
}

.setting-card-body {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.55rem 0.65rem 0.65rem;
}

.field-row {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
}

.field-group {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.field-label {
  display: block;
  margin-bottom: 0.3rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #374151;
}

.field-control {
  width: 140px;
}

.field-control--full {
  width: 100%;
}

.field-control--time {
  width: 120px;
}

.field-control--select {
  width: 150px;
}

.field-hint {
  margin: 0.25rem 0 0;
  font-size: 0.6875rem;
  line-height: 1.4;
  color: #9ca3af;
}

.backup-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  padding-top: 0.15rem;
}

.url-preview {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.15rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #2563eb;
  text-decoration: none;
  transition: color 0.2s ease;
}

.url-preview:hover {
  color: #1d4ed8;
  text-decoration: underline;
}

.url-preview-icon {
  font-size: 0.75rem;
}

.settings-footer {
  margin-top: auto;
  flex-shrink: 0;
  padding: 0.55rem 0.85rem;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.notice-message {
  margin: 0;
  font-size: 15px;
  color: #374151;
  line-height: 1.6;
}

.footer-meta {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8125rem;
  color: #6b7280;
}

.footer-meta-icon {
  color: #9ca3af;
  font-size: 0.75rem;
}

.setting-card-body :deep(.el-input-number) {
  width: 140px;
}

.setting-card-body :deep(.el-input-number .el-input__wrapper) {
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}

.setting-card-body :deep(.el-input__wrapper) {
  border-radius: 0.375rem;
  box-shadow: 0 0 0 1px #d1d5db inset;
}

.setting-card-body :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #9ca3af inset;
}

.setting-card-body :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #00723a inset;
}

@media (max-width: 1280px) {
  .setting-card {
    flex: 0 0 calc((100% - 0.5rem) / 2);
    max-width: calc((100% - 0.5rem) / 2);
  }
}

@media (max-width: 767px) {
  .setting-card {
    flex: 0 0 100%;
    max-width: 100%;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions :deep(.el-button) {
    width: 100%;
  }

  .setting-card-header {
    min-height: 0;
  }

  .field-row {
    flex-direction: column;
    gap: 0.65rem;
  }

  .field-control,
  .setting-card-body :deep(.el-input-number) {
    width: 100%;
    max-width: none;
  }

  .field-control--time {
    max-width: 120px;
  }

  .field-control--select {
    width: 100%;
  }
}
</style>
