<template>
  <div class="calendar-page h-screen bg-[#f5f5f5] flex flex-col overflow-hidden" style="padding-top: var(--app-header-height, 64px);">
    <AppHeader />

    <div v-if="hasEvRuleNotice && !showTopTip" class="top-tip-toggle-wrapper">
      <button
        type="button"
        class="top-tip-toggle-btn"
        aria-label="Show alert message"
        title="Show alert message"
        @click="showTopTip = true"
      ></button>
    </div>
    <div v-if="hasEvRuleNotice && showTopTip" class="top-tip-wrapper px-2 md:px-3 lg:px-4">
      <div class="booking-window-tip">
        <span>Alert Message:</span>
        <button type="button" class="read-more-link" @click="noticeDialogVisible = true">Click here to read more</button>
        <button type="button" class="tip-close-btn" aria-label="Hide alert message" @click="showTopTip = false">
          &times;
        </button>
      </div>
    </div>

    <!-- 主体内容 -->
    <main
      class="calendar-main flex-1 flex flex-col px-2 md:px-3 lg:px-4 pb-1 md:pb-2 overflow-hidden"
      :class="{
        'tip-collapsed-gap': hasEvRuleNotice && !showTopTip,
        'calendar-main-header-gap': !hasEvRuleNotice
      }"
    >
      <!-- 日历内容区域 -->
      <div class="calendar-container flex-1 overflow-auto">
        <div class="calendar-wrapper">
          <!-- 周视图 -->
          <div v-for="week in weeks" :key="week.id" class="week-section">
            <div class="week-header">
              {{ week.dateRange }}
            </div>
            <div
              class="week-grid"
              :class="{ 'is-partial-week': week.days.length < 7 }"
            >
              <!-- 表头 -->
              <div class="grid-header">
                <div v-for="day in week.days" :key="day.date" class="day-header" :class="{ 'is-today': day.isToday, 'is-public-holiday': day.isHoliday, 'is-weekend': day.isWeekend && !day.isHoliday }">
                  <div class="day-name">{{ day.dayName }}</div>
                  <div class="day-number">{{ day.dayNumber }}</div>
                </div>
              </div>

              <!-- 时间段行 + 假期列标题（居中仅显示一次） -->
              <div class="week-time-body">
                <div v-for="period in timePeriods" :key="period.id" class="time-row">
                  <div class="time-label">{{ period.period }}</div>
                  <div
                    v-for="day in week.days"
                    :key="`${day.date}-${period.id}`"
                    class="time-cell"
                    :class="[getAvailabilityClass(day.date, period.id), { 'is-public-holiday': day.isHoliday, 'is-weekend': day.isWeekend && !day.isHoliday, 'is-restricted': day.isRestricted }]"
                    @click="selectTimeSlot(day.date, period.id)"
                  >
                    <div v-if="!day.isHoliday" class="availability">{{ getAvailabilityText(day.date, period.id, period.period) }}</div>
                  </div>
                </div>

                <div class="week-holiday-overlays">
                  <div
                    v-for="day in week.days"
                    :key="`holiday-overlay-${day.date}`"
                    class="week-holiday-overlay-cell"
                  >
                    <span v-if="day.holidayLabel" class="week-holiday-label">{{ day.holidayLabel }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- EV预订对话框 -->
    <EVBookingDialog
      :visible="dialogVisible"
      :selected-date="selectedDate"
      :selected-period="selectedPeriod"
      :time-periods="timePeriods"
      :available-slots="bookings"
      :booking-window-start="evBookingWindow.currentStartDate"
      :booking-window-end="evBookingWindow.currentEndDate"
      :public-holiday-dates="holidaysByDate"
      :is-admin="isAdmin"
      :submitting="bookingSubmitting"
      :refresh-calendar-availability="loadCalendarAvailability"
      @close="closeDialog"
      @confirm="handleBookingConfirm"
    />
    <BookingStyleModal
      v-if="hasEvRuleNotice"
      v-model="noticeDialogVisible"
      title="Alert Message"
      max-width="820px"
      custom-class="important-note-modal"
    >
      <div v-if="evRuleNoticeLoading" class="ev-rule-notice-content">Loading...</div>
      <div
        v-else-if="evRuleNoticeContent"
        class="ev-rule-notice-content rich-content"
        v-html="evRuleNoticeContent"
      ></div>
      <div v-else class="ev-rule-notice-content ev-rule-notice-empty">No content available.</div>
    </BookingStyleModal>

    <div v-if="statusDialog.visible" class="status-modal-overlay" @click.self="dismissBookingStatusDialog">
      <div class="status-modal-wrapper">
        <div class="status-modal-header">
          <span class="status-modal-title">Reminder</span>
          <button type="button" class="status-modal-close" @click="dismissBookingStatusDialog">
            <svg viewBox="0 0 24 24" class="status-close-icon">
              <path d="M18 6L6 18M6 6l12 12" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div class="status-modal-body">
          <p :class="['status-dialog-message', statusDialog.type]">{{ statusDialog.message }}</p>
        </div>
        <div class="status-modal-footer">
          <el-button class="status-confirm-btn" type="default" @click="dismissBookingStatusDialog">OK</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  EV_BOOKING_WINDOW_BC_NAME,
  EV_BOOKING_WINDOW_SYNC_LS_KEY,
  parseEvBookingWindowSyncPayload
} from '@/utils/evBookingWindowSync'
import AppHeader from '../components/AppHeader.vue'
import EVBookingDialog from '../components/EVBookingDialog.vue'
import BookingStyleModal from '../components/BookingStyleModal.vue'
import { useEvBookingRuleNotice } from '@/composables/useEvBookingRuleNotice'
import { useHkPublicHolidays } from '@/composables/useHkPublicHolidays'
import { useUserStore } from '@/stores/user'
import { getEvCalendarAvailability, createEvBooking } from '@/api/parking'
import { fetchActiveEvTimePeriods } from '@/utils/evTimePeriods'
import { fetchEvBookingWindow, invalidateEvBookingWindowCache } from '@/utils/evBookingWindow'
import { resolveEvVisibleBookingRange, msUntilNextEvDateUpdateRoll } from '@/utils/evBookingVisibleRange'
import { todayYmdInAppTimeZone } from '@/utils/appTimezone'
import { isEvSlotPast } from '@/utils/evSlotPast'
import { SILENT_ERROR } from '@/utils/requestOptions'
import {
  getRestrictedBookingMessage,
  isRestrictedBookingDay,
  isWeekendDate
} from '@/utils/bookingDateRestriction'
import {
  loadImportantNoteTipExpanded,
  saveImportantNoteTipExpanded
} from '@/utils/importantNoteTip'
import '@/styles/rich-content.css'

const userStore = useUserStore()
const { isAdmin, userInfo } = storeToRefs(userStore)

// 对话框状态
const dialogVisible = ref(false)
const noticeDialogVisible = ref(false)
const tipUserKey = () => userInfo.value?.id ?? null
const showTopTip = ref(loadImportantNoteTipExpanded('ev', tipUserKey()))
watch(showTopTip, (expanded) => {
  saveImportantNoteTipExpanded('ev', tipUserKey(), expanded)
})
const {
  evRuleNoticeContent,
  evRuleNoticeLoading,
  hasEvRuleNotice,
  loadEvRuleNotice
} = useEvBookingRuleNotice()
const {
  holidaysByDate,
  loadHolidays,
  isPublicHoliday,
  getHolidaySummary
} = useHkPublicHolidays()
const selectedDate = ref('')
const selectedPeriod = ref('')
const statusDialog = ref({
  visible: false,
  message: '',
  type: ''
})
const DAY_MS = 24 * 60 * 60 * 1000
const formatDateToYmd = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const evBookingWindow = ref({
  currentStartDate: '',
  currentEndDate: '',
  evDateUpdateTime: '13:00'
})
const calendarNow = ref(new Date())

const loadEvBookingWindow = async () => {
  evBookingWindow.value = await fetchEvBookingWindow()
  const { currentStartDate, currentEndDate } = evBookingWindow.value
  if (currentStartDate && currentEndDate) {
    await loadHolidays(currentStartDate, currentEndDate)
  }
  scheduleEvDateUpdateRoll()
}

const evWindowRange = computed(() => ({
  start: new Date(`${evBookingWindow.value.currentStartDate}T00:00:00`),
  end: new Date(`${evBookingWindow.value.currentEndDate}T23:59:59`)
}))

/** 用户可见的预订日：在已发布年度窗口内共 14 天；EV_date_update_time 前含今天，之后从明天起 */
const visibleBookingRange = computed(() => {
  const { currentStartDate, currentEndDate, evDateUpdateTime } = evBookingWindow.value
  return resolveEvVisibleBookingRange(currentStartDate, currentEndDate, {
    now: calendarNow.value,
    evDateUpdateTime: evDateUpdateTime || '13:00'
  })
})

const timePeriods = ref([])

const bookings = ref({})
const totalParkingSpaces = ref(0)
/** 首次可用性 API 返回前为 false，避免 total=0 时误判为 Full */
const availabilityLoaded = ref(false)

/** 跨标签即时更新日期（不 await，避免后台标签卡住） */
function applyEvWindowFromSyncDetail (detail) {
  if (!detail?.currentStartDate || !detail?.currentEndDate) return false
  const cur = evBookingWindow.value
  const nextUpdateTime = detail.evDateUpdateTime ?? cur.evDateUpdateTime ?? '13:00'
  if (
    cur.currentStartDate === detail.currentStartDate &&
    cur.currentEndDate === detail.currentEndDate &&
    cur.evDateUpdateTime === nextUpdateTime
  ) {
    return false
  }
  evBookingWindow.value = {
    currentStartDate: detail.currentStartDate,
    currentEndDate: detail.currentEndDate,
    evDateUpdateTime: nextUpdateTime
  }
  invalidateEvBookingWindowCache()
  availabilityLoaded.value = false
  void loadHolidays(detail.currentStartDate, detail.currentEndDate)
  scheduleEvDateUpdateRoll()
  return true
}

/** 后台标签页降频；Admin 发布仍靠 BroadcastChannel / storage 即时同步 */
const WINDOW_POLL_MS = 60_000
/** 日历余量自动刷新（标签可见时），他人抢订后网格可变为 Full */
const CALENDAR_POLL_MS_NORMAL = 10_000
const CALENDAR_POLL_MS_SLOW = 30_000
let windowPollTimer = null
let calendarPollTimer = null
let evDateUpdateRollTimer = null
let calendarPollDelayMs = CALENDAR_POLL_MS_NORMAL
let calendarPollFailures = 0
let windowPollInFlight = false
let calendarPollInFlight = false
let windowSyncChannel = null

async function pollEvBookingWindowFromServer () {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return
  }
  if (windowPollInFlight) return
  windowPollInFlight = true
  try {
    const next = await fetchEvBookingWindow()
    const rangeChanged = applyEvWindowFromSyncDetail({
      currentStartDate: next?.currentStartDate || '',
      currentEndDate: next?.currentEndDate || '',
      evDateUpdateTime: next?.evDateUpdateTime || '13:00'
    })
    if (rangeChanged) {
      await loadCalendarAvailability()
    }
  } catch {
    /* 下一轮轮询重试 */
  } finally {
    windowPollInFlight = false
  }
}

function onRemoteWindowPublish (detail) {
  if (!detail) return
  const changed = applyEvWindowFromSyncDetail(detail)
  if (changed) {
    void loadCalendarAvailability()
  }
}

function onWindowStorageSync (e) {
  if (e.key !== EV_BOOKING_WINDOW_SYNC_LS_KEY || e.newValue == null) return
  onRemoteWindowPublish(parseEvBookingWindowSyncPayload(e.newValue))
}

function onWindowBroadcast (event) {
  onRemoteWindowPublish(parseEvBookingWindowSyncPayload(event?.data))
}

async function pollCalendarAvailabilityFromServer () {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return
  }
  if (calendarPollInFlight) return
  calendarPollInFlight = true
  try {
    const ok = await loadCalendarAvailability()
    if (ok) {
      calendarPollFailures = 0
      calendarPollDelayMs = CALENDAR_POLL_MS_NORMAL
    } else {
      calendarPollFailures += 1
      if (calendarPollFailures >= 2) {
        calendarPollDelayMs = CALENDAR_POLL_MS_SLOW
      }
    }
  } finally {
    calendarPollInFlight = false
  }
}

function scheduleCalendarPoll () {
  if (calendarPollTimer) {
    clearTimeout(calendarPollTimer)
    calendarPollTimer = null
  }
  calendarPollTimer = setTimeout(async () => {
    await pollCalendarAvailabilityFromServer()
    scheduleCalendarPoll()
  }, calendarPollDelayMs)
}

function onDocumentVisibilityChange () {
  if (document.visibilityState === 'visible') {
    calendarPollFailures = 0
    calendarPollDelayMs = CALENDAR_POLL_MS_NORMAL
    void pollEvBookingWindowFromServer()
    void pollCalendarAvailabilityFromServer()
  }
}

function scheduleEvDateUpdateRoll () {
  if (evDateUpdateRollTimer) {
    clearTimeout(evDateUpdateRollTimer)
    evDateUpdateRollTimer = null
  }
  const updateTime = evBookingWindow.value.evDateUpdateTime || '13:00'
  const delayMs = msUntilNextEvDateUpdateRoll(updateTime)
  evDateUpdateRollTimer = setTimeout(() => {
    calendarNow.value = new Date()
    void loadCalendarAvailability()
    scheduleEvDateUpdateRoll()
  }, delayMs)
}

function startEvBookingWindowWatchers () {
  windowPollTimer = setInterval(pollEvBookingWindowFromServer, WINDOW_POLL_MS)
  scheduleCalendarPoll()
  window.addEventListener('storage', onWindowStorageSync)
  document.addEventListener('visibilitychange', onDocumentVisibilityChange)
  try {
    windowSyncChannel = new BroadcastChannel(EV_BOOKING_WINDOW_BC_NAME)
    windowSyncChannel.onmessage = onWindowBroadcast
  } catch {
    windowSyncChannel = null
  }
}

function stopEvBookingWindowWatchers () {
  if (evDateUpdateRollTimer) {
    clearTimeout(evDateUpdateRollTimer)
    evDateUpdateRollTimer = null
  }
  if (windowPollTimer) {
    clearInterval(windowPollTimer)
    windowPollTimer = null
  }
  if (calendarPollTimer) {
    clearTimeout(calendarPollTimer)
    calendarPollTimer = null
  }
  calendarPollDelayMs = CALENDAR_POLL_MS_NORMAL
  calendarPollFailures = 0
  window.removeEventListener('storage', onWindowStorageSync)
  document.removeEventListener('visibilitychange', onDocumentVisibilityChange)
  if (windowSyncChannel) {
    try {
      windowSyncChannel.close()
    } catch {
      /* noop */
    }
    windowSyncChannel = null
  }
}

function isDateInEvWindow(dateLike) {
  const date = new Date(dateLike)
  if (Number.isNaN(date.getTime())) return false
  const { start, end } = evWindowRange.value
  return date >= start && date <= end
}

/** 预订日或时段 endTime 已过（与 EV 管理列表 past 判定一致：按时段结束时刻） */
function isSlotPast (dateYmd, periodId) {
  return isEvSlotPast(dateYmd, periodId, timePeriods.value)
}

// 在已发布年度范围内，按 EV_date_update_time：更新前从今天起 14 天，更新后从明天起 14 天
const weeks = computed(() => {
  const { startYmd, endYmd } = visibleBookingRange.value
  if (!startYmd || !endYmd) return []

  const result = []
  const todayYmd = todayYmdInAppTimeZone()
  const allDays = []
  const start = new Date(`${startYmd}T00:00:00`)
  const end = new Date(`${endYmd}T00:00:00`)

  for (let dateMs = start.getTime(); dateMs <= end.getTime(); dateMs += DAY_MS) {
    const date = new Date(dateMs)
    const ymd = formatDateToYmd(date)
    allDays.push({
      date: ymd,
      dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: String(date.getDate()).padStart(2, '0'),
      isToday: ymd === todayYmd,
      isHoliday: Boolean(holidaysByDate.value[ymd]),
      holidayLabel: holidaysByDate.value[ymd] || '',
      isWeekend: isWeekendDate(date),
      isRestricted: isRestrictedBookingDay(ymd, {
        isAdmin: isAdmin.value,
        publicHolidayDates: holidaysByDate.value
      })
    })
  }

  for (let weekIndex = 0; weekIndex < allDays.length; weekIndex += 7) {
    const weekDays = allDays.slice(weekIndex, weekIndex + 7)
    const weekStart = new Date(`${weekDays[0].date}T00:00:00`)
    const weekEnd = new Date(`${weekDays[weekDays.length - 1].date}T00:00:00`)
    result.push({
      id: weekIndex / 7,
      dateRange: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      days: weekDays
    })
  }

  return result
})

function resolveSlotAvailability (date, period) {
  const key = `${date}-${period}`
  const slot = bookings.value[key]
  if (slot) return { ...slot }
  if (!availabilityLoaded.value) {
    return { available: null, total: 0, loading: true }
  }
  const total = totalParkingSpaces.value
  return { available: total, total, booked: 0 }
}

function getAvailabilityData(date, period) {
  if (!isDateInEvWindow(`${date}T12:00:00`)) {
    return { available: 0, total: 0, outOfWindow: true }
  }
  if (isRestrictedBookingDay(date, {
    isAdmin: isAdmin.value,
    publicHolidayDates: holidaysByDate.value,
    isPublicHoliday
  })) {
    return { available: 0, total: 0, isRestricted: true }
  }
  const data = resolveSlotAvailability(date, period)
  if (isSlotPast(date, period)) {
    return { ...data, isPast: true }
  }
  return data
}

// 获取可用性文本
function getAvailabilityText(date, period, periodLabel) {
  if (isPublicHoliday(date)) return ''
  const data = getAvailabilityData(date, period)
  if (data.loading) return ''
  if (data.isRestricted) {
    if (!isAdmin.value && isWeekendDate(date)) return periodLabel
    return ''
  }
  if (data.outOfWindow) return 'Closed'
  if (data.available === 0) {
    return 'Full'
  }
  if (data.isPast) return periodLabel
  return periodLabel
}

// 获取可用性样式类
function getAvailabilityClass(date, period) {
  if (isPublicHoliday(date)) return ''
  const data = getAvailabilityData(date, period)
  if (data.loading) return 'is-loading'
  if (data.isRestricted) return 'is-restricted'
  if (data.outOfWindow) {
    return 'is-closed'
  }
  if (data.available === 0) {
    return 'is-full'
  }
  if (data.isPast) {
    return 'is-past'
  }
  return ''
}

// 选择时间段：先拉最新余量再判断，避免他人刚抢最后一个车位仍误判可订
async function selectTimeSlot (date, period) {
  if (!isDateInEvWindow(`${date}T12:00:00`)) {
    statusDialog.value = {
      visible: true,
      type: '',
      message: 'This date is outside the EV booking date range'
    }
    return
  }
  if (isRestrictedBookingDay(date, {
    isAdmin: isAdmin.value,
    publicHolidayDates: holidaysByDate.value,
    isPublicHoliday
  })) {
    statusDialog.value = {
      visible: true,
      type: '',
      message: getRestrictedBookingMessage(date, {
        publicHolidayDates: holidaysByDate.value,
        getHolidaySummary
      })
    }
    return
  }
  if (isSlotPast(date, period)) {
    return
  }
  await loadCalendarAvailability()
  const data = getAvailabilityData(date, period)
  if (data.loading) return
  if (data.isPast) return
  if (data.outOfWindow) {
    statusDialog.value = {
      visible: true,
      type: '',
      message: 'This date is outside the EV booking date range'
    }
    return
  }
  if (data.available === 0) {
    statusDialog.value = {
      visible: true,
      message: 'This time slot is fully booked.',
      type: 'error'
    }
    return
  }
  selectedDate.value = date
  selectedPeriod.value = period
  dialogVisible.value = true
}

// 关闭对话框后刷新日历，他人订走车位时网格尽快变 Full（无 WebSocket 时的折中）
function closeDialog () {
  dialogVisible.value = false
  selectedDate.value = ''
  selectedPeriod.value = ''
  void loadCalendarAvailability()
}

const bookingSubmitting = ref(false)

const loadCalendarAvailability = async () => {
  const { startYmd, endYmd } = visibleBookingRange.value
  if (!startYmd || !endYmd) {
    bookings.value = {}
    availabilityLoaded.value = false
    return false
  }
  try {
    const data = await getEvCalendarAvailability({
      startDate: startYmd,
      endDate: endYmd
    }, SILENT_ERROR)
    totalParkingSpaces.value = Number(data?.totalSpaces) || 0
    bookings.value = data?.availability && typeof data.availability === 'object'
      ? { ...data.availability }
      : {}
    availabilityLoaded.value = true
    return true
  } catch {
    totalParkingSpaces.value = 0
    bookings.value = {}
    availabilityLoaded.value = true
    return false
  }
}

const getErrorMessage = (error, fallback = 'Operation failed') => {
  const message = error?.response?.data?.message
  if (Array.isArray(message)) return message[0] || fallback
  if (typeof message === 'string' && message.trim()) return message
  if (typeof error?.message === 'string' && error.message.trim()) return error.message
  return fallback
}

function isFullyBookedMessage (message) {
  return /fully booked/i.test(String(message || ''))
}

/** 他人抢订最后一个车位时，先乐观标 Full，避免日历缓存尚未失效时网格仍显示可订 */
function markSlotFullyBooked (date, periodId) {
  if (!date || periodId == null || periodId === '') return
  const key = `${date}-${periodId}`
  const prev = bookings.value[key]
  const total = Math.max(
    Number(prev?.total) || 0,
    Number(totalParkingSpaces.value) || 0,
    Number(prev?.booked) || 0,
    1
  )
  bookings.value = {
    ...bookings.value,
    [key]: { available: 0, total, booked: total }
  }
}

async function syncCalendarAfterFullyBooked (date, periodId) {
  if (date && periodId != null && periodId !== '') {
    markSlotFullyBooked(date, periodId)
  }
  await loadCalendarAvailability()
}

async function dismissBookingStatusDialog () {
  const message = statusDialog.value.message
  const wasFullyBooked = isFullyBookedMessage(message)
  statusDialog.value = { ...statusDialog.value, visible: false }
  if (wasFullyBooked) {
    await syncCalendarAfterFullyBooked(selectedDate.value, selectedPeriod.value)
  }
}

async function handleBookingConfirm(bookingData) {
  if (bookingSubmitting.value) return
  bookingSubmitting.value = true
  try {
    const res = await createEvBooking({
      licensePlateId: String(bookingData.licensePlateId),
      periodId: String(bookingData.timePeriod),
      bookingDate: bookingData.date,
      slotId: bookingData.slotId ? String(bookingData.slotId) : undefined,
      reservedByUserId: bookingData.reservedByUserId
        ? String(bookingData.reservedByUserId)
        : undefined
    })
    await Promise.all([
      loadCalendarAvailability(),
      userStore.refreshSessionUser()
    ])
    closeDialog()
    const space = res?.booking?.evSpace || ''
    statusDialog.value = {
      visible: true,
      type: 'success',
      message: space
        ? `Booking created successfully!\nParking space: ${space}`
        : 'Booking created successfully!'
    }
  } catch (error) {
    const message = getErrorMessage(error, 'Failed to create booking')
    if (isFullyBookedMessage(message)) {
      await syncCalendarAfterFullyBooked(bookingData.date, bookingData.timePeriod)
    }
    statusDialog.value = {
      visible: true,
      type: 'error',
      message
    }
  } finally {
    bookingSubmitting.value = false
  }
}

onMounted(async () => {
  loadEvRuleNotice()
  timePeriods.value = await fetchActiveEvTimePeriods()
  await loadEvBookingWindow()
  await loadCalendarAvailability()
  startEvBookingWindowWatchers()
})

onUnmounted(() => {
  stopEvBookingWindowWatchers()
})
</script>

<style scoped>
.calendar-page {
  height: var(--zoom-vh);
  background: linear-gradient(135deg, #f8ecdd 0%, #f5e6d3 50%, #f8ecdd 100%);
  position: relative;
}

.calendar-page::before {
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

.calendar-main {
  position: relative;
  z-index: 1;
}

.calendar-main.tip-collapsed-gap {
  margin-top: 6px;
}

/* 无 Alert Message 时，与有横幅时 top-tip-wrapper 顶距保持相近 */
.calendar-main.calendar-main-header-gap {
  padding-top: 0.5rem;
}

.top-tip-wrapper {
  /* 与折叠态 tip-collapsed-gap 顶距一致，避免展开后 header 下空白变大 */
  padding-top: 6px;
  padding-bottom: 0;
}

.calendar-container {
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid rgba(0, 114, 58, 0.08);
  transition: box-shadow 0.3s ease;
}

.calendar-container:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
}

.booking-window-tip {
  margin-bottom: 0.25rem;
  background: #f4b898;
  border: 1px solid #f5c4a0;
  color: #fe0302;
  border-radius: 8px;
  padding: 0.45rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 700;
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.read-more-link {
  border: none;
  background: transparent;
  color: #fe0302;
  font-size: inherit;
  font-weight: 700;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
}

.read-more-link:hover {
  color: #d10201;
}

.tip-close-btn {
  margin-left: auto;
  width: 22px;
  height: 22px;
  border: 1px solid #f5c4a0;
  border-radius: 9999px;
  background: #fcd9c0;
  color: #fe0302;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.tip-close-btn:hover {
  background: #f5c4a0;
  border-color: #ef9a6a;
}

.top-tip-toggle-wrapper {
  position: relative;
  height: 0;
  z-index: 30;
}

.top-tip-toggle-btn {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translateX(-50%);
  width: 34px;
  height: 18px;
  border: 1px solid #ea580c;
  border-top: none;
  border-radius: 0 0 16px 16px;
  background: linear-gradient(180deg, #fb923c 0%, #f97316 100%);
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 2px 8px rgba(234, 88, 12, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
}

.top-tip-toggle-btn::before {
  content: '';
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 7px solid #ffffff;
  opacity: 0.95;
}

.top-tip-toggle-btn:hover {
  background: linear-gradient(180deg, #f97316 0%, #ea580c 100%);
  transform: translateX(-50%) translateY(1px);
  box-shadow: 0 3px 10px rgba(234, 88, 12, 0.35);
}

.top-tip-toggle-btn:focus-visible {
  outline: 2px solid #fdba74;
  outline-offset: 2px;
}

.calendar-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.week-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.week-header {
  font-size: clamp(0.875rem, 2vw, 1.125rem);
  font-weight: 600;
  color: #111827;
  text-align: center;
  padding: 0.25rem;
}

.week-grid {
  border: 2px solid #00723a;
  border-radius: 6px;
  overflow: hidden;
  position: relative;
}

.week-time-body {
  position: relative;
}

.week-holiday-overlays {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  pointer-events: none;
  z-index: 2;
}

.week-holiday-overlay-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem;
  min-width: 0;
}

.week-holiday-label {
  color: #b91c1c;
  font-weight: 700;
  text-align: center;
  line-height: 1.35;
  font-size: clamp(0.75rem, 1.8vw, 1rem);
  max-width: min(1100px, 96%);
  word-break: break-word;
}

.grid-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: #00723a;
}

.day-header {
  padding: clamp(0.375rem, 1.5vw, 0.75rem);
  text-align: center;
  color: white;
  border-right: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.day-header:last-child {
  border-right: none;
}

.week-grid.is-partial-week .day-header:last-child {
  border-right: 1px solid rgba(255, 255, 255, 0.2);
}

.day-header.is-today {
  background: rgba(255, 255, 255, 0.15);
}

.day-name {
  font-size: clamp(0.625rem, 1.5vw, 0.875rem);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.day-number {
  font-size: clamp(1rem, 3vw, 1.5rem);
  font-weight: 700;
}

.time-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border-bottom: 1px solid #e5e7eb;
}

.time-row:last-child {
  border-bottom: none;
}

.time-label {
  display: none;
}

.time-cell {
  padding: clamp(0.75rem, 2vw, 1.5rem) clamp(0.25rem, 1vw, 0.5rem);
  text-align: center;
  border-right: 1px solid #e5e7eb;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  min-height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.time-cell:last-child {
  border-right: none;
}

.week-grid.is-partial-week .time-cell:last-child {
  border-right: 1px solid #e5e7eb;
}

.time-cell:hover:not(.is-full):not(.is-closed):not(.is-past) {
  background-color: #f3f4f6;
}

.time-cell.is-full {
  background-color: #fecaca;
  cursor: not-allowed;
}

.time-cell.is-loading {
  background-color: #f9fafb;
  cursor: default;
  pointer-events: none;
}

.time-cell.is-closed {
  background-color: #e5e7eb;
  cursor: not-allowed;
}

.time-cell.is-closed .availability {
  color: #6b7280;
  font-weight: 700;
}

.time-cell.is-holiday,
.time-cell.is-public-holiday,
.time-cell.is-restricted {
  background-color: #fef2f2;
  cursor: not-allowed;
}

.time-cell.is-holiday:hover,
.time-cell.is-public-holiday:hover,
.time-cell.is-restricted:hover {
  background-color: #fee2e2;
}

.time-cell.is-weekend:not(.is-public-holiday) {
  background-color: #f3f4f6;
}

.day-header.is-weekend:not(.is-public-holiday) {
  background-color: #e5e7eb;
  color: #374151;
}

.day-header.is-public-holiday {
  background-color: #b91c1c;
  color: #ffffff;
}

.day-header.is-public-holiday.is-today {
  background-color: #991b1b;
}

.time-cell.is-past {
  background-color: #f9fafb;
  cursor: not-allowed;
}

.time-cell.is-past:hover {
  background-color: #f3f4f6;
  cursor: not-allowed;
}

.time-cell.is-past .availability {
  color: #d1d5db;
  font-weight: 600;
}

.time-cell.is-full:hover {
  background-color: #fca5a5;
}

.availability {
  font-size: clamp(1rem, 2.5vw, 1.25rem);
  font-weight: 700;
  color: #374151;
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
  font-size: 1.1875rem;
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

.status-dialog-message {
  margin: 0;
  font-size: 1.125rem;
  text-align: center;
  line-height: 1.55;
  color: #333333;
  white-space: pre-line;
}

.status-dialog-message.error {
  color: #f56c6c;
}

.status-dialog-message.success {
  color: #00723a;
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

.time-cell.is-full .availability {
  color: #dc2626;
  font-weight: 700;
  font-style: italic;
}

/* Responsive adjustments */
@media (max-width: 389px), (min-width: 390px) and (max-width: 767px) {
  .calendar-container {
    padding: 0.5rem;
    border-radius: 6px;
  }

  .calendar-wrapper {
    gap: 0.75rem;
  }

  .week-grid {
    border-width: 1px;
  }

  .time-cell {
    min-height: 2.5rem;
  }

}

@media (max-width: 389px) {
  .calendar-container {
    padding: 0.375rem;
  }

  .week-section {
    gap: 0.125rem;
  }

  .day-header {
    gap: 0;
  }

  .time-cell {
    min-height: 2rem;
  }
}

/* Responsive adjustments */
@media (min-width: 2240px) {
  .calendar-container {
    padding: 1.5rem;
  }

  .calendar-wrapper {
    gap: 1.5rem;
  }

  .week-section {
    gap: 0.5rem;
  }
}
</style>





