<template>
  <div class="calendar-page h-screen bg-[#f5f5f5] flex flex-col overflow-hidden" style="padding-top: var(--app-header-height, 64px);">
    <AppHeader />
    <div v-if="hasVenueRuleNotice && !showTopTip" class="top-tip-toggle-wrapper">
      <button
        type="button"
        class="top-tip-toggle-btn"
        aria-label="Show alert message"
        title="Show alert message"
        @click="showTopTip = true"
      ></button>
    </div>
    <div v-if="hasVenueRuleNotice && showTopTip" class="top-tip-wrapper px-2 md:px-3 lg:px-4">
      <div class="booking-window-tip">
        <span>Alert Message:</span>
        <button type="button" class="read-more-link" @click="noticeDialogVisible = true">Click here to read more</button>
        <button type="button" class="tip-close-btn" aria-label="Hide alert message" @click="showTopTip = false">
          &times;
        </button>
      </div>
    </div>

    <!-- Progress steps (temporarily hidden) -->
    <!-- <BookingSteps
      :steps="['Log in', 'Booking', 'Submission', 'Confirmation']"
      :current="1"
    /> -->

    <!-- Main content -->
    <main
      class="calendar-main flex-1 flex flex-col px-2 md:px-3 lg:px-4 pb-1 md:pb-2 overflow-hidden"
      :class="{
        'tip-collapsed-gap': hasVenueRuleNotice && !showTopTip,
        'calendar-main-header-gap': !hasVenueRuleNotice
      }"
    >
      <!-- Top toolbar -->
      <div class="toolbar toolbar-layout mb-1 flex items-center justify-between gap-3">
        <div class="toolbar-left toolbar-left-group flex items-center gap-2">
          <!-- Previous period -->
          <button class="nav-btn" @click="goToPreviousPeriod">
            <span class="nav-arrow">&larr;</span>
            <span class="label-long">Prev {{ currentView === 'month' ? 'Month' : currentView === 'week' ? 'Week' : 'Day' }}</span>
            <span class="label-short">Prev</span>
          </button>

          <!-- Add booking -->
          <button class="add-booking-btn" @click="showBookingDialog">
            <span class="label-long">Add Booking</span>
            <span class="label-short">Add</span>
          </button>
          <button v-if="isAdmin" class="add-booking-btn" @click="showBlockDialog = true">
            Block Time
          </button>

          <!-- Room filter -->
          <div class="room-filter-wrapper">
            <button
              :class="['room-filter-btn', { active: showRoomFilter }]"
              @click="toggleRoomFilter"
            >
              <span class="label-long">Room Filter</span>
              <span class="label-short">Filter</span>
            </button>

            <!-- Room filter dropdown -->
            <div v-if="showRoomFilter" class="room-filter-dropdown" @click.stop>
              <div class="filter-header">
                <span class="filter-title">Show rooms:</span>
                <div class="filter-actions">
                  <button class="filter-action-btn" @click="selectOtherOnly">Other Venues</button>
                  <button class="filter-action-btn" @click="selectConferenceOnly">Conference / Discussion Rooms</button>
                  <button class="filter-action-btn" @click="selectAllRooms">Select All</button>
                  <button class="filter-action-btn" @click="clearAllRooms">Clear All</button>
                </div>
              </div>

              <div class="filter-body">
                <div class="filter-section">
                  <h4 class="section-title">Conference / Discussion Rooms</h4>
                  <div class="room-list">
                    <label v-for="room in conferenceRooms" :key="room.id" class="room-checkbox">
                      <input type="checkbox" v-model="room.selected" />
                      <span class="room-name-wrapper">
                        <span class="room-color-dot" :style="{ backgroundColor: room.color }"></span>
                        <span>{{ room.name }}</span>
                      </span>
                    </label>
                  </div>
                </div>

                <div class="filter-section">
                  <h4 class="section-title">Other Venues</h4>
                  <div class="room-list">
                    <label v-for="room in otherVenues" :key="room.id" class="room-checkbox">
                      <input type="checkbox" v-model="room.selected" />
                      <span class="room-name-wrapper">
                        <span class="room-color-dot" :style="{ backgroundColor: room.color }"></span>
                        <span>{{ room.name }}</span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Center date display + today -->
        <div class="toolbar-center flex items-center gap-2 relative">
          <div class="date-display-wrapper">
            <h3
              class="text-lg font-semibold text-gray-800 cursor-pointer hover:text-[#00723a] transition-colors"
              @click="toggleDatePicker"
            >
              {{ dateRangeDisplay }}
            </h3>

            <!-- Date picker dropdown -->
            <div v-if="showDatePicker" class="date-picker-dropdown" @click.stop>
              <div class="date-picker-calendar">
                <!-- Calendar header -->
                <div class="calendar-header">
                  <button class="nav-arrow-btn" @click="changeYear(-1)">&laquo;</button>
                  <button class="nav-arrow-btn" @click="changeMonth(-1)">&lsaquo;</button>
                  <span class="calendar-title">{{ calendarTitle }}</span>
                  <button class="nav-arrow-btn" @click="changeMonth(1)">&rsaquo;</button>
                  <button class="nav-arrow-btn" @click="changeYear(1)">&raquo;</button>
                </div>

                <!-- Calendar grid -->
                <div class="calendar-body">
                  <div class="weekday-row">
                    <div v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="day" class="weekday-cell">
                      {{ day }}
                    </div>
                  </div>
                  <div class="dates-grid">
                    <div
                      v-for="(day, index) in calendarDays"
                      :key="index"
                      class="date-cell-picker"
                      :class="{
                        'is-other-month': day.isOtherMonth,
                        'is-today': day.isToday,
                        'is-selected': day.isSelected
                      }"
                      @click="selectDate(day.date)"
                    >
                      {{ day.day }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button class="today-btn" @click="goToToday">
            Today
          </button>
        </div>

        <div class="toolbar-right toolbar-right-group flex items-center gap-2">
          <!-- View switch -->
          <div class="view-switcher flex gap-2">
            <button
              :class="['view-btn', { active: currentView === 'day' }]"
              @click="switchCalendarView('day')"
            >
              Day
            </button>
            <button
              :class="['view-btn', { active: currentView === 'week' }]"
              @click="switchCalendarView('week')"
            >
              Week
            </button>
            <button
              :class="['view-btn', { active: currentView === 'month' }]"
              @click="switchCalendarView('month')"
            >
              Month
            </button>
          </div>

          <!-- Next period -->
          <button class="nav-btn" @click="goToNextPeriod">
            <span class="label-long">Next {{ currentView === 'month' ? 'Month' : currentView === 'week' ? 'Week' : 'Day' }}</span>
            <span class="label-short">Next</span>
            <span class="nav-arrow">&rarr;</span>
          </button>
        </div>
      </div>
      <!-- Calendar content area -->
      <div class="calendar-container flex-1 overflow-hidden relative">
        <div v-if="calendarLoading" class="calendar-loading-mask">
          <span>Loading bookings...</span>
        </div>
        <!-- Month view -->
        <div v-if="currentView === 'month'" class="month-view flex-1 min-h-0 flex flex-col relative">
          <VenueCalendarMonth
            :current-date="currentDate"
            :bookings="calendarBookings"
            :selected-rooms="selectedRoomsList"
            :public-holidays-by-date="holidaysByDate"
            @day-click="selectDay"
          />
          <div v-if="selectedRoomsList.length === 0" class="empty-state-fixed">
            <p class="empty-text">Please select at least one room from Room Filter</p>
          </div>
        </div>

        <!-- Week view -->
        <div v-else-if="currentView === 'week'" class="week-view h-full min-h-0 flex flex-col overflow-x-hidden overflow-y-auto relative">
          <VenueCalendarWeek
            class="week-calendar-host"
            :current-date="currentDate"
            :bookings="calendarBookings"
            :selected-rooms="selectedRoomsList"
            :public-holidays-by-date="holidaysByDate"
            @time-slot-click="openBookingDialog"
            @booking-click="handleBookingClick"
          />
          <div v-if="selectedRoomsList.length === 0" class="empty-state-fixed">
            <p class="empty-text">Please select at least one room from Room Filter</p>
          </div>
        </div>

        <!-- Day view -->
        <div v-else-if="currentView === 'day'" class="day-view h-full min-h-0 flex flex-col overflow-hidden relative">
          <VenueCalendarDay
            class="day-calendar-host"
            :current-date="currentDate"
            :bookings="filteredDayBookings"
            :selected-rooms="selectedRoomsList"
            :public-holidays-by-date="holidaysByDate"
            @time-slot-click="openBookingDialog"
          />

          <!-- Empty state -->
          <div v-if="selectedRoomsList.length === 0" class="empty-state-fixed">
            <p class="empty-text">Please select at least one room from Room Filter</p>
          </div>
          <div v-else-if="selectedRoomsList.length === 1 && filteredDayBookings.filter(b => b.roomName === selectedRoomsList[0].name).length === 0" class="empty-state-fixed">
            <p class="empty-text">No bookings for this day</p>
          </div>
        </div>
      </div>
    </main>

    <!-- Create/Edit booking dialog -->
    <VenueBookingDialog
      :visible="dialogVisible"
      :booking="editingBooking"
      :room-type="roomType"
      :selected-time="selectedTime"
      :venue-list="venueList"
      :public-holiday-dates="holidaysByDate"
      :booking-window-start="venueBookingWindow.currentStartDate"
      :booking-window-end="venueBookingWindow.currentEndDate"
      :is-admin="isAdmin"
      @confirm="handleBookingConfirm"
      @close="closeBookingDialog"
    />

    <!-- Booking detail dialog -->
    <VenueBookingDetailDialog
      :visible="detailDialogVisible"
      :booking="selectedBooking"
      @close="detailDialogVisible = false"
      @delete="handleDeleteBooking"
    />

    <BookingStyleModal v-model="showBlockDialog" title="Block Venue Time" max-width="720px" :max-height="blockDialogMaxHeight">
      <el-form :model="blockForm" label-width="110px">
        <el-form-item label="Venue">
          <el-select
            v-model="blockForm.roomName"
            style="width: 100%"
            :teleported="false"
            placeholder="Select venue"
            popper-class="block-room-select-popper"
          >
            <el-option
              v-for="room in allRooms"
              :key="room.id"
              :label="room.name"
              :value="room.name"
            >
              <div class="room-option" :class="{ 'is-selected': blockForm.roomName === room.name }">
                <span class="room-color-dot" :style="{ backgroundColor: room.color }"></span>
                <span class="room-option-name">{{ room.name }}</span>
                <span class="room-option-cap">{{ formatRoomCapacity(room.roomCapacity) }}</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <div class="block-row">
          <el-form-item label="Start">
            <el-date-picker
              v-model="blockForm.startAt"
              type="datetime"
              value-format="YYYY-MM-DD HH:mm"
              :teleported="false"
              style="width: 220px"
            />
          </el-form-item>
          <el-form-item label="End">
            <el-date-picker
              v-model="blockForm.endAt"
              type="datetime"
              value-format="YYYY-MM-DD HH:mm"
              :teleported="false"
              style="width: 220px"
            />
          </el-form-item>
        </div>
        <el-form-item label="Reason">
          <el-input
            v-model.trim="blockForm.reason"
            type="textarea"
            :rows="14"
            placeholder="e.g. Maintenance / Deep Cleaning"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="showBlockDialog = false">Cancel</el-button>
        <el-button type="default" class="submit-btn" @click="handleCreateBlock">Save Block</el-button>
      </template>
    </BookingStyleModal>
    <BookingStyleModal
      v-if="hasVenueRuleNotice"
      v-model="noticeDialogVisible"
      title="Alert Message"
      max-width="820px"
      custom-class="important-note-modal"
    >
      <div v-if="venueRuleNoticeLoading" class="venue-rule-notice-content">Loading...</div>
      <div
        v-else-if="venueRuleNoticeContent"
        class="venue-rule-notice-content rich-content"
        v-html="venueRuleNoticeContent"
      ></div>
      <div v-else class="venue-rule-notice-content venue-rule-notice-empty">No content available.</div>
    </BookingStyleModal>

    <BookingStyleModal v-model="showNoticeDialog" :title="noticeTitle" max-width="420px">
      <p class="notice-message">{{ noticeMessage }}</p>
      <template #footer>
        <el-button type="default" class="submit-btn" @click="showNoticeDialog = false">OK</el-button>
      </template>
    </BookingStyleModal>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import AppHeader from '../components/AppHeader.vue'
import BookingSteps from '../components/BookingSteps.vue'
import VenueCalendarMonth from '../components/VenueCalendarMonth.vue'
import VenueCalendarWeek from '../components/VenueCalendarWeek.vue'
import VenueCalendarDay from '../components/VenueCalendarDay.vue'
import VenueBookingDialog from '../components/VenueBookingDialog.vue'
import VenueBookingDetailDialog from '../components/VenueBookingDetailDialog.vue'
import BookingStyleModal from '../components/BookingStyleModal.vue'
import { useVenueBookingRuleNotice } from '@/composables/useVenueBookingRuleNotice'
import { useHkPublicHolidays } from '@/composables/useHkPublicHolidays'
import '@/styles/rich-content.css'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import {
  fetchCalendarBookingsByView,
  createVenueBooking,
  updateVenueBooking,
  deleteVenueBooking
} from '@/api/calendar'
import { unwrapCalendarBookings, isSameCalendarDay, isActiveVenue, parseCalendarDateLocal } from '@/utils/venueCalendarApi'
import { getVenueManagementVenues, getVenueBookingWindow, createVenueBlock } from '@/api/venueManagement'
import { notifyAdminPendingUpdated } from '@/utils/adminPendingSync'
import { getRestrictedBookingMessage, isRestrictedBookingDay } from '@/utils/bookingDateRestriction'
import { todayYmdInAppTimeZone } from '@/utils/appTimezone'
import {
  loadVenueCalendarRoomFilterState,
  saveVenueCalendarRoomFilter,
  applyVenueCalendarRoomFilter
} from '@/utils/venueCalendarRoomFilter'
import {
  loadVenueCalendarView,
  saveVenueCalendarView
} from '@/utils/venueCalendarView'
import {
  loadImportantNoteTipExpanded,
  saveImportantNoteTipExpanded
} from '@/utils/importantNoteTip'

const route = useRoute()
const userStore = useUserStore()
const { isAdmin, userInfo } = storeToRefs(userStore)

// Current calendar view mode (restored from sessionStorage after refresh)
const currentView = ref(loadVenueCalendarView())

// Current anchor date
const currentDate = ref(new Date())

// Room type from route query
const roomType = ref(route.query.roomType || 'conference')

// Booking dataset
const bookings = ref([])
const blockRecords = ref([])

// Dialog and UI states
const dialogVisible = ref(false)
const detailDialogVisible = ref(false)
const editingBooking = ref(null)
const selectedBooking = ref(null)
const selectedTime = ref(null)
const showDatePicker = ref(false)
const pickerDate = ref(new Date()) // Month/year shown in the date picker
const showRoomFilter = ref(false)
const tipUserKey = () => userInfo.value?.id ?? null
const showTopTip = ref(loadImportantNoteTipExpanded('venue', tipUserKey()))
watch(showTopTip, (expanded) => {
  saveImportantNoteTipExpanded('venue', tipUserKey(), expanded)
})
const showBlockDialog = ref(false)
const noticeDialogVisible = ref(false)
const showNoticeDialog = ref(false)
const noticeTitle = ref('Notice')
const noticeMessage = ref('')
const showNotice = (message, title = 'Notice') => {
  noticeTitle.value = title
  noticeMessage.value = message
  showNoticeDialog.value = true
}
const {
  venueRuleNoticeContent,
  venueRuleNoticeLoading,
  hasVenueRuleNotice,
  loadVenueRuleNotice
} = useVenueBookingRuleNotice()
const {
  holidaysByDate,
  loadHolidays,
  isPublicHoliday,
  getHolidaySummary
} = useHkPublicHolidays()
const blockForm = ref({
  roomName: '',
  startAt: '',
  endAt: '',
  reason: ''
})

/** 14????1100-1599px???? Block Time ????????MeetingApproval ????*/
const BLOCK_MODAL_MQ = '(min-width: 1100px) and (max-width: 1599px)'
const blockDialogMaxHeight = ref('94vh')

function updateBlockDialogMaxHeight () {
  if (typeof window === 'undefined') return
  blockDialogMaxHeight.value = window.matchMedia(BLOCK_MODAL_MQ).matches ? '120vh' : '94vh'
}

let blockDialogMq = null

const venueList = ref([])
const venueBookingWindow = ref({
  currentStartDate: '',
  currentEndDate: ''
})
const calendarLoading = ref(false)
const venueWindowRange = computed(() => ({
  start: new Date(`${venueBookingWindow.value.currentStartDate}T00:00:00`),
  end: new Date(`${venueBookingWindow.value.currentEndDate}T23:59:59`)
}))

const conferenceRooms = ref([])
const otherVenues = ref([])
/** ?? sessionStorage ????????????????????*/
const roomFilterRestoredFromStorage = ref(false)
const roomFilterPersistenceReady = ref(false)

function getRouteRoomType () {
  const q = route.query.roomType
  if (q === 'conference' || q === 'other') return q
  return roomType.value === 'other' ? 'other' : 'conference'
}

function applyVenueListToRoomFilters () {
  const list = (venueList.value || []).filter(isActiveVenue)
  const rt = getRouteRoomType()
  conferenceRooms.value = list
    .filter(room => room.tab === 'conference_discussion')
    .map((room) => ({
      id: room.id,
      name: room.name,
      selected: rt === 'conference',
      color: room.color,
      roomCapacity: room.roomCapacity ?? room.capacity ?? null
    }))
  otherVenues.value = list
    .filter(room => room.tab === 'other_venues')
    .map(room => ({
      id: room.id,
      name: room.name,
      selected: rt === 'other',
      color: room.color,
      roomCapacity: room.roomCapacity ?? room.capacity ?? null
    }))
}

function formatRoomCapacity(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return ''
  return `cap ${n}`
}

function loadBlockRecordsFromVenues () {
  blockRecords.value = venueList.value.filter(isActiveVenue).flatMap((venue) => {
    const blocks = Array.isArray(venue.blocks) ? venue.blocks : []
    return blocks
      .filter(block => block.startAt && block.endAt)
      .map(block => ({
        id: block.id ?? `${venue.id}-${block.startAt}`,
        roomName: venue.name,
        startAt: block.startAt,
        endAt: block.endAt,
        reason: block.reason || 'Blocked'
      }))
  })
}

/** ??????????????????????????? storage ????URL ??roomType ????????? */
function syncSelectedRoomsWithBookings (bookingList) {
  if (roomFilterRestoredFromStorage.value) {
    return
  }
  if (route.query.roomType === 'conference' || route.query.roomType === 'other') {
    return
  }
  const names = new Set(
    (bookingList || []).map(b => b.roomName).filter(Boolean)
  )
  if (names.size === 0) return
  for (const room of allRooms.value) {
    if (names.has(room.name)) {
      room.selected = true
    }
  }
}

async function fetchBookings () {
  calendarLoading.value = true
  try {
    const res = await fetchCalendarBookingsByView({
      view: currentView.value,
      currentDate: currentDate.value
    })
    const list = unwrapCalendarBookings(res)
    bookings.value = list.map(booking => ({
      ...booking,
      color: booking.color || getRoomColor(booking.roomName)
    }))
    syncSelectedRoomsWithBookings(bookings.value)
  } catch (error) {
    console.error('Failed to fetch calendar bookings:', error)
    showNotice('Failed to load bookings', 'Error')
  } finally {
    calendarLoading.value = false
  }
}

function switchCalendarView (view) {
  if (currentView.value !== view) {
    currentView.value = view
  } else {
    fetchBookings()
  }
}

const allRooms = computed(() => [...conferenceRooms.value, ...otherVenues.value])

// Resolve display color by room name
function getRoomColor(roomName) {
  const room = allRooms.value.find(r => r.name === roomName)
  return room?.color || '#3b82f6'
}

// Date-picker title text
const calendarTitle = computed(() => {
  return pickerDate.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

// Build fixed 6-row calendar grid
const calendarDays = computed(() => {
  const year = pickerDate.value.getFullYear()
  const month = pickerDate.value.getMonth()

  // First and last day of current month
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Weekday index of first day
  const firstDayOfWeek = firstDay.getDay()

  // Last day number of previous month
  const prevMonthLastDay = new Date(year, month, 0).getDate()

  const days = []

  // Fill leading dates from previous month
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i
    const date = new Date(year, month - 1, day)
    days.push({
      day,
      date,
      isOtherMonth: true,
      isToday: isSameDay(date, new Date()),
      isSelected: isSameDay(date, currentDate.value)
    })
  }

  // Fill current month dates
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const date = new Date(year, month, i)
    days.push({
      day: i,
      date,
      isOtherMonth: false,
      isToday: isSameDay(date, new Date()),
      isSelected: isSameDay(date, currentDate.value)
    })
  }

  // Fill trailing dates to keep 42 cells
  const remainingDays = 42 - days.length
  for (let i = 1; i <= remainingDays; i++) {
    const date = new Date(year, month + 1, i)
    days.push({
      day: i,
      date,
      isOtherMonth: true,
      isToday: isSameDay(date, new Date()),
      isSelected: isSameDay(date, currentDate.value)
    })
  }

  return days
})

// Compare two dates by day
function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate()
}

// Header date range text
const dateRangeDisplay = computed(() => {
  const date = currentDate.value
  if (currentView.value === 'month') {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  } else if (currentView.value === 'week') {
    const weekStart = getWeekStart(date)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  } else {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }
})

function normalizeDateTime(datetimeStr) {
  return new Date(datetimeStr.replace(' ', 'T'))
}

function isDateInVenueWindow(date) {
  const { start, end } = venueWindowRange.value
  return date >= start && date <= end
}

function toBookingYmd (date) {
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    return formatDateISO(date)
  }
  return String(date || '').trim()
}

/** ?????????????????????????? */
function assertNotPastDateForNonAdmin (date) {
  if (isAdmin.value) return true
  const ymd = toBookingYmd(date)
  if (!ymd || ymd >= todayYmdInAppTimeZone()) return true
  showNotice('Past dates cannot be booked. Please select today or a future date.', 'Warning')
  return false
}

function assertBookableDate (date, baseMessage) {
  if (!isRestrictedBookingDay(date, {
    isAdmin: isAdmin.value,
    publicHolidayDates: holidaysByDate.value,
    isPublicHoliday
  })) {
    return true
  }
  showNotice(
    getRestrictedBookingMessage(date, {
      publicHolidayDates: holidaysByDate.value,
      getHolidaySummary
    }) || baseMessage,
    'Warning'
  )
  return false
}

function formatTime(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatDateISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function buildBlockBookings() {
  const displayStartMinutes = 7 * 60
  const displayEndMinutes = 21 * 60 + 30
  const items = []

  blockRecords.value.forEach((block) => {
    const start = normalizeDateTime(block.startAt)
    const end = normalizeDateTime(block.endAt)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return

    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())

    while (cursor <= endDay) {
      const dayStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 0, 0, 0, 0)
      const dayEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 23, 59, 59, 999)
      const segmentStart = new Date(Math.max(start.getTime(), dayStart.getTime()))
      const segmentEnd = new Date(Math.min(end.getTime(), dayEnd.getTime()))

      const segmentStartMinutes = segmentStart.getHours() * 60 + segmentStart.getMinutes()
      const segmentEndMinutes = segmentEnd.getHours() * 60 + segmentEnd.getMinutes()
      const clippedStartMinutes = Math.max(displayStartMinutes, segmentStartMinutes)
      const clippedEndMinutes = Math.min(displayEndMinutes, segmentEndMinutes)

      if (clippedEndMinutes > clippedStartMinutes) {
        const startDate = new Date(cursor)
        startDate.setHours(Math.floor(clippedStartMinutes / 60), clippedStartMinutes % 60, 0, 0)
        const endDate = new Date(cursor)
        endDate.setHours(Math.floor(clippedEndMinutes / 60), clippedEndMinutes % 60, 0, 0)

        items.push({
          id: `block-${block.id}-${formatDateISO(cursor)}`,
          roomName: block.roomName,
          date: formatDateISO(cursor),
          startTime: formatTime(startDate),
          endTime: formatTime(endDate),
          topic: `BLOCKED: ${block.reason}`,
          notes: block.reason,
          color: getRoomColor(block.roomName),
          isBlocked: true
        })
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  })

  return items
}

const calendarBookings = computed(() => [...bookings.value, ...buildBlockBookings()])

// Bookings for current day
const filteredDayBookings = computed(() => {
  return calendarBookings.value.filter(booking =>
    isSameCalendarDay(booking.date, currentDate.value)
  )
})

// Currently selected rooms
const selectedRoomsList = computed(() => {
  return allRooms.value.filter(room => room.selected)
})

// Get week start (Sunday)
function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  // getDay() uses Sunday=0, Monday=1...
  const diff = d.getDate() - day
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Navigate to previous period
function goToPreviousPeriod() {
  const date = new Date(currentDate.value)
  if (currentView.value === 'month') {
    date.setMonth(date.getMonth() - 1)
  } else if (currentView.value === 'week') {
    date.setDate(date.getDate() - 7)
  } else {
    date.setDate(date.getDate() - 1)
  }
  if (!isDateInVenueWindow(date)) {
    showNotice('Date is outside the venue booking date range', 'Warning')
    return
  }
  currentDate.value = date
}

// Navigate to next period
function goToNextPeriod() {
  const date = new Date(currentDate.value)
  if (currentView.value === 'month') {
    date.setMonth(date.getMonth() + 1)
  } else if (currentView.value === 'week') {
    date.setDate(date.getDate() + 7)
  } else {
    date.setDate(date.getDate() + 1)
  }
  if (!isDateInVenueWindow(date)) {
    showNotice('Date is outside the venue booking date range', 'Warning')
    return
  }
  currentDate.value = date
}

// Jump to today
function goToToday() {
  const today = new Date()
  if (!isDateInVenueWindow(today)) {
    currentDate.value = new Date(venueWindowRange.value.start)
    showNotice('Today is outside the venue booking date range', 'Warning')
    return
  }
  currentDate.value = today
}

// Toggle date picker popup
function toggleDatePicker(event) {
  event.stopPropagation()
  showDatePicker.value = !showDatePicker.value

  // Keep picker month in sync with current date
  if (showDatePicker.value) {
    pickerDate.value = new Date(currentDate.value)
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside, { once: false })
    }, 0)
  } else {
    document.removeEventListener('click', handleClickOutside)
  }
}

// Change picker year
function changeYear(offset) {
  const newDate = new Date(pickerDate.value)
  newDate.setFullYear(newDate.getFullYear() + offset)
  pickerDate.value = newDate
}

// Change picker month
function changeMonth(offset) {
  const newDate = new Date(pickerDate.value)
  newDate.setMonth(newDate.getMonth() + offset)
  pickerDate.value = newDate
}

// Select date from picker
function selectDate(date) {
  const selected = new Date(date)
  if (!isDateInVenueWindow(selected)) {
    showNotice('Selected date is outside the venue booking date range', 'Warning')
    return
  }
  if (!assertBookableDate(selected)) return
  currentDate.value = selected
}

// Close date picker when clicking outside
function handleClickOutside(event) {
  const dropdown = document.querySelector('.date-picker-dropdown')
  const dateTitle = event.target.closest('.date-display-wrapper')

  if (!dropdown?.contains(event.target) && !dateTitle) {
    showDatePicker.value = false
    document.removeEventListener('click', handleClickOutside)
  }
}

// Toggle room filter popup
function toggleRoomFilter(event) {
  event.stopPropagation()
  showRoomFilter.value = !showRoomFilter.value

  if (showRoomFilter.value) {
    setTimeout(() => {
      document.addEventListener('click', handleRoomFilterClickOutside, { once: false })
    }, 0)
  } else {
    document.removeEventListener('click', handleRoomFilterClickOutside)
  }
}

// Close room filter when clicking outside
function handleRoomFilterClickOutside(event) {
  const dropdown = document.querySelector('.room-filter-dropdown')
  const filterBtn = event.target.closest('.room-filter-wrapper')

  if (!dropdown?.contains(event.target) && !filterBtn) {
    showRoomFilter.value = false
    document.removeEventListener('click', handleRoomFilterClickOutside)
  }
}

// Quick action: Conference / Discussion Rooms
function selectConferenceOnly() {
  conferenceRooms.value.forEach(room => {
    room.selected = room.name.includes('Conference Room') || room.name.includes('Discussion Room')
  })
  otherVenues.value.forEach(room => {
    room.selected = false
  })
}

// Quick action: select other venues only
function selectOtherOnly() {
  conferenceRooms.value.forEach(room => {
    room.selected = false
  })
  otherVenues.value.forEach(room => {
    room.selected = true
  })
}

// Quick action: select all rooms
function selectAllRooms() {
  conferenceRooms.value.forEach(room => room.selected = true)
  otherVenues.value.forEach(room => room.selected = true)
}

// Quick action: clear all rooms
function clearAllRooms() {
  conferenceRooms.value.forEach(room => room.selected = false)
  otherVenues.value.forEach(room => room.selected = false)
}

// Switch to day view from month cell
function selectDay(date) {
  if (!isDateInVenueWindow(date)) {
    showNotice('Selected date is outside the venue booking date range', 'Warning')
    return
  }
  if (!assertBookableDate(date)) return
  currentDate.value = date
  currentView.value = 'day'
}

// Open create booking dialog
function showBookingDialog() {
  if (!isDateInVenueWindow(currentDate.value)) {
    showNotice('Current date is outside the venue booking date range', 'Warning')
    return
  }
  if (!assertNotPastDateForNonAdmin(currentDate.value)) return
  if (!assertBookableDate(currentDate.value)) return
  editingBooking.value = null
  selectedTime.value = null
  dialogVisible.value = true
}

// Open booking dialog from selected slot
function openBookingDialog(timeInfo) {
  const slotDay = timeInfo?.date ? parseCalendarDateLocal(timeInfo.date) : null
  if (slotDay && !isDateInVenueWindow(slotDay)) {
    showNotice('Selected slot is outside the venue booking date range', 'Warning')
    return
  }
  if (slotDay && !assertNotPastDateForNonAdmin(slotDay)) return
  if (slotDay && !assertBookableDate(slotDay)) return
  if (timeInfo?.room && timeInfo?.date && timeInfo?.time) {
    const slotDate = parseCalendarDateLocal(timeInfo.date)
    const [h, m] = timeInfo.time.split(':').map(Number)
    slotDate.setHours(h, m, 0, 0)
    const slotEnd = new Date(slotDate)
    slotEnd.setMinutes(slotEnd.getMinutes() + 30)
    const hasBlock = blockRecords.value.some((block) => {
      if (block.roomName !== timeInfo.room) return false
      const blockStart = normalizeDateTime(block.startAt)
      const blockEnd = normalizeDateTime(block.endAt)
      return slotDate < blockEnd && slotEnd > blockStart
    })
    if (hasBlock) {
      showNotice('This slot is blocked and cannot be booked', 'Warning')
      return
    }
  }
  editingBooking.value = null
  selectedTime.value = timeInfo
  dialogVisible.value = true
}

// Close booking dialog
function closeBookingDialog() {
  dialogVisible.value = false
  editingBooking.value = null
  selectedTime.value = null
}

function resetBlockForm() {
  blockForm.value = {
    roomName: '',
    startAt: '',
    endAt: '',
    reason: ''
  }
}

async function handleCreateBlock () {
  if (!blockForm.value.roomName || !blockForm.value.startAt || !blockForm.value.endAt || !blockForm.value.reason) {
    showNotice('Please fill in Room, Start, End and Reason', 'Warning')
    return
  }

  const start = normalizeDateTime(blockForm.value.startAt)
  const end = normalizeDateTime(blockForm.value.endAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    showNotice('Invalid datetime format', 'Warning')
    return
  }
  if (end <= start) {
    showNotice('End datetime must be later than start datetime', 'Warning')
    return
  }

  const room = allRooms.value.find(r => r.name === blockForm.value.roomName)
  if (!room?.id) {
    showNotice('Room not found', 'Warning')
    return
  }

  try {
    await createVenueBlock(room.id, {
      startAt: new Date(blockForm.value.startAt.replace(' ', 'T')).toISOString(),
      endAt: new Date(blockForm.value.endAt.replace(' ', 'T')).toISOString(),
      reason: blockForm.value.reason
    })
    const venues = await getVenueManagementVenues()
    venueList.value = Array.isArray(venues) ? venues.filter(isActiveVenue) : []
    loadBlockRecordsFromVenues()
    showBlockDialog.value = false
    resetBlockForm()
    showNotice('Blocked period created', 'Success')
  } catch (error) {
    console.error('Failed to create block:', error)
  }
}

function buildBookingPayload (bookingData) {
  const roomName = bookingData.room || bookingData.roomName
  return {
    roomName,
    date: bookingData.date,
    startTime: bookingData.startTime,
    endTime: bookingData.endTime,
    topic: bookingData.topic,
    remark: bookingData.remark,
    attendeeCount: bookingData.attendeeCount,
    displayOnHomepage: bookingData.displayOnHomepage !== false,
    teaServiceRequired: bookingData.teaServiceRequired,
    teaServiceOption: bookingData.teaServiceOption,
    teaServiceRatioFrom: bookingData.teaServiceRatioFrom,
    teaServiceRatioTo: bookingData.teaServiceRatioTo,
    teaServiceTeaPots: bookingData.teaServiceTeaPots,
    teaServiceWaterPots: bookingData.teaServiceWaterPots,
    teaServiceSpecialRequest: bookingData.teaServiceSpecialRequest,
    roomType: roomType.value,
    reservedByUserId: bookingData.reservedByUserId || undefined
  }
}

// Handle booking create/update
async function handleBookingConfirm (bookingData) {
  const existingId = bookingData.id != null ? String(bookingData.id) : ''
  const approvedOnly =
    !isAdmin.value &&
    String(bookingData?.approvalStatus || editingBooking.value?.approvalStatus || '')
      .toLowerCase() === 'approved'

  if (approvedOnly && existingId && /^\d+$/.test(existingId)) {
    try {
      await updateVenueBooking(existingId, { remark: bookingData.remark ?? '' })
      showNotice('Booking updated successfully!', 'Success')
      await fetchBookings()
      closeBookingDialog()
    } catch (error) {
      console.error('Failed to save booking:', error)
    }
    return
  }

  const roomName = bookingData.room || bookingData.roomName
  const bookingStart = normalizeDateTime(`${bookingData.date} ${bookingData.startTime}`)
  const bookingEnd = normalizeDateTime(`${bookingData.date} ${bookingData.endTime}`)
  const conflictBlock = blockRecords.value.find((block) => {
    if (block.roomName !== roomName) return false
    const blockStart = normalizeDateTime(block.startAt)
    const blockEnd = normalizeDateTime(block.endAt)
    return bookingStart < blockEnd && bookingEnd > blockStart
  })

  if (conflictBlock) {
    showNotice(`Blocked period conflict: ${conflictBlock.startAt} - ${conflictBlock.endAt}`, 'Warning')
    return
  }

  const payload = buildBookingPayload(bookingData)

  try {
    if (existingId && /^\d+$/.test(existingId)) {
      await updateVenueBooking(existingId, payload)
      showNotice('Booking updated successfully!', 'Success')
    } else {
      await createVenueBooking(payload)
      notifyAdminPendingUpdated({ source: 'bookings' })
      showNotice('Booking submitted and pending approval', 'Success')
      await userStore.refreshSessionUser()
    }
    await fetchBookings()
    closeBookingDialog()
  } catch (error) {
    console.error('Failed to save booking:', error)
  }
}

// Handle booking delete
function handleDeleteBooking (bookingId) {
  ElMessageBox.confirm(
    'Are you sure to delete this booking?',
    'Warning',
    {
      confirmButtonText: 'OK',
      cancelButtonText: 'Cancel',
      type: 'warning'
    }
  )
    .then(async () => {
      try {
        await deleteVenueBooking(String(bookingId))
        await Promise.all([
          fetchBookings(),
          userStore.refreshSessionUser()
        ])
        detailDialogVisible.value = false
        showNotice('Booking deleted successfully!', 'Success')
      } catch (error) {
        console.error('Failed to delete booking:', error)
      }
    })
    .catch(() => {})
}

// Open day view from week/month booking click
function handleBookingClick(dayDate) {
  currentDate.value = new Date(dayDate)
  currentView.value = 'day'
}

// Logout handler
function applyRoomTypeRouteFilter () {
  const roomTypeParam = getRouteRoomType()
  roomType.value = roomTypeParam
  if (roomTypeParam === 'conference') {
    conferenceRooms.value.forEach(room => { room.selected = true })
    otherVenues.value.forEach(room => { room.selected = false })
  } else if (roomTypeParam === 'other') {
    conferenceRooms.value.forEach(room => { room.selected = false })
    otherVenues.value.forEach(room => { room.selected = true })
  }
}

async function loadCalendarData () {
  try {
    const [venues, window] = await Promise.all([
      getVenueManagementVenues(),
      getVenueBookingWindow()
    ])
    venueList.value = Array.isArray(venues) ? venues.filter(isActiveVenue) : []
    if (window?.currentStartDate) {
      venueBookingWindow.value = window
    }
    if (window?.currentStartDate && window?.currentEndDate) {
      await loadHolidays(window.currentStartDate, window.currentEndDate)
    }
    applyVenueListToRoomFilters()
    loadBlockRecordsFromVenues()
    roomFilterRestoredFromStorage.value = false
    const filterState = loadVenueCalendarRoomFilterState()
    if (filterState?.bookNowRoomType) {
      // ?? Book Now ???? Book Now ????????????? selectedIds
      roomType.value = filterState.bookNowRoomType
      applyRoomTypeRouteFilter()
      saveVenueCalendarRoomFilter(allRooms.value)
      roomFilterRestoredFromStorage.value = true
    } else if (filterState?.selectedIds) {
      // ?? / ?????????????????      applyVenueCalendarRoomFilter(allRooms.value, filterState.selectedIds)
      roomFilterRestoredFromStorage.value = true
    } else if (route.query.roomType === 'conference' || route.query.roomType === 'other') {
      applyRoomTypeRouteFilter()
      saveVenueCalendarRoomFilter(allRooms.value)
      roomFilterRestoredFromStorage.value = true
    }
    if (!isDateInVenueWindow(currentDate.value)) {
      currentDate.value = new Date(`${venueBookingWindow.value.currentStartDate}T00:00:00`)
    }
    await fetchBookings()
  } catch (error) {
    console.error('Failed to load calendar data:', error)
    showNotice('Failed to load calendar data', 'Error')
  } finally {
    roomFilterPersistenceReady.value = true
  }
}

watch(currentView, (view) => {
  saveVenueCalendarView(view)
})

watch([currentDate, currentView], () => {
  fetchBookings()
})

watch(
  () => route.query.roomType,
  (val) => {
    // ????roomType ?????? Book Now ?? / sessionStorage ??loadCalendarData ??
    //  ???? query ???????????????
    if (val === 'conference' || val === 'other') {
      roomType.value = val
    }
  }
)

watch(
  () => allRooms.value.map((room) => `${room.id}:${room.selected}`).join(','),
  () => {
    if (!roomFilterPersistenceReady.value) return
    saveVenueCalendarRoomFilter(allRooms.value)
  }
)

onMounted(() => {
  loadVenueRuleNotice()
  updateBlockDialogMaxHeight()
  blockDialogMq = window.matchMedia(BLOCK_MODAL_MQ)
  blockDialogMq.addEventListener('change', updateBlockDialogMaxHeight)
  loadCalendarData()
})

// Cleanup listeners on unmount
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('click', handleRoomFilterClickOutside)
  if (blockDialogMq) {
    blockDialogMq.removeEventListener('change', updateBlockDialogMaxHeight)
  }
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

.calendar-main.calendar-main-header-gap {
  padding-top: 0.5rem;
}

.top-tip-wrapper {
  /* ?????tip-collapsed-gap ???????????header ??????*/
  padding-top: 6px;
  padding-bottom: 0;
}

.toolbar {
  background: #ffffff;
  padding: 1rem;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05);
  flex-shrink: 0;
  border: 1px solid rgba(0, 114, 58, 0.08);
  transition: box-shadow 0.3s ease;
}

.toolbar:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
}

.toolbar-layout {
  flex-wrap: wrap;
}

.toolbar-left-group,
.toolbar-center,
.toolbar-right-group {
  min-width: 0;
}

.label-short {
  display: none;
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
  align-items: center;
  gap: 6px;
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

.notice-message {
  margin: 0;
  font-size: 15px;
  color: #374151;
  line-height: 1.6;
}

.calendar-container {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid rgba(0, 114, 58, 0.08);
  transition: box-shadow 0.3s ease;
}

.calendar-loading-mask {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.72);
  font-size: 0.875rem;
  color: #374151;
  border-radius: 12px;
}

.calendar-container:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
}

.month-view {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
}

.week-calendar-host {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.day-calendar-host {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.week-view::-webkit-scrollbar {
  width: 8px;
}

.week-view::-webkit-scrollbar-track {
  background: #f3f4f6;
  border-radius: 4px;
}

.week-view::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 4px;
}

.week-view::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

.day-view::-webkit-scrollbar {
  width: 8px;
}

.day-view::-webkit-scrollbar-track {
  background: #f3f4f6;
  border-radius: 4px;
}

.day-view::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 4px;
}

.day-view::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

.empty-state-fixed {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 10;
}

.empty-state-fixed .empty-text {
  font-size: 1.5rem;
  font-weight: 500;
  color: #9ca3af;
  margin: 0;
}

.view-switcher {
  display: flex;
  gap: 0.5rem;
}

/* Add Booking Button - Green background with white text */
.add-booking-btn {
  background: linear-gradient(135deg, #00723a 0%, #005a2f 100%);
  color: #ffffff;
  /* Keep toolbar button sizing consistent with Room Filter button */
  padding: 0.25rem 0.75rem;
  border-radius: 8px;
  border: none;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 6px rgba(0, 114, 58, 0.2);
  letter-spacing: 0.3px;
}

.add-booking-btn:hover {
  background: linear-gradient(135deg, #005a2f 0%, #004a25 100%);
  box-shadow: 0 4px 12px rgba(0, 114, 58, 0.3);
  transform: translateY(-1px);
}

.block-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* View Switcher Buttons - Equal width, green when active, gray when inactive */
.view-btn {
  background: linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%);
  color: #4b5563;
  /* Keep toolbar button sizing consistent with Room Filter button */
  padding: 0.25rem 0.75rem;
  border-radius: 8px;
  border: none;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 70px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  letter-spacing: 0.3px;
}

.view-btn:hover {
  background: linear-gradient(135deg, #d1d5db 0%, #b8bcc2 100%);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.view-btn.active {
  background: linear-gradient(135deg, #00723a 0%, #005a2f 100%);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 114, 58, 0.3);
}

.view-btn.active:hover {
  background: linear-gradient(135deg, #005a2f 0%, #004a25 100%);
  box-shadow: 0 4px 12px rgba(0, 114, 58, 0.4);
}

/* Navigation Buttons - Orange background with white text */
.nav-btn {
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
  color: #ffffff;
  /* Keep toolbar button sizing consistent with Room Filter button */
  padding: 0.25rem 0.75rem;
  border-radius: 8px;
  border: none;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 2px 6px rgba(249, 115, 22, 0.25);
  letter-spacing: 0.3px;
}

.nav-btn:hover {
  background: linear-gradient(135deg, #ea580c 0%, #dc2626 100%);
  box-shadow: 0 4px 12px rgba(249, 115, 22, 0.35);
  transform: translateY(-1px);
}

.nav-arrow {
  font-weight: 900;
  font-size: 1rem;
  line-height: 1;
  display: inline-block;
  transform: translateY(1px);
}

/* Today Button - Blue background with white text */
.today-btn {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #ffffff;
  /* Keep toolbar button sizing consistent with Room Filter button */
  padding: 0.25rem 0.75rem;
  border-radius: 8px;
  border: none;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.25);
  letter-spacing: 0.3px;
}

.today-btn:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);
  transform: translateY(-1px);
}

.date-display-wrapper {
  position: relative;
}

.date-picker-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 114, 58, 0.1);
  animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.date-picker-dropdown :deep(.el-date-picker) {
  border: none;
  box-shadow: none;
}

.date-picker-dropdown :deep(.el-picker-panel) {
  border: none;
  box-shadow: none;
}

.date-picker-calendar {
  padding: 0;
  min-width: 320px;
  background: white;
  border-radius: 0.5rem;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.calendar-title {
  font-size: 1rem;
  font-weight: 700;
  color: #111827;
  flex: 1;
  text-align: center;
}

.nav-arrow-btn {
  background: white;
  border: 1px solid #e5e7eb;
  color: #374151;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.2s;
}

.nav-arrow-btn:hover {
  background-color: #f3f4f6;
  border-color: #d1d5db;
}

.calendar-body {
  padding: 12px;
}

.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}

.weekday-cell {
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  padding: 8px 4px;
}

.dates-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.date-cell-picker {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  color: #374151;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.date-cell-picker:hover {
  background-color: #d6f3c5;
}

.date-cell-picker.is-other-month {
  color: #d1d5db;
}

.date-cell-picker.is-today {
  background-color: #00723a;
  color: white;
  font-weight: 700;
}

.date-cell-picker.is-selected {
  background-color: #00723a;
  color: white;
  font-weight: 700;
}

.date-cell-picker.is-selected:hover {
  background-color: #005a2e;
}

.date-cell-picker.is-today:hover {
  background-color: #005a2e;
}

/* Room Filter Button */
.room-filter-wrapper {
  position: relative;
  display: inline-block;
}

.room-filter-btn {
  /* Match interaction style of other toolbar buttons (hover/active/transition) */
  background: linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%);
  color: #4b5563;
  padding: 0.25rem 0.75rem;
  border-radius: 8px;
  border: none;
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  letter-spacing: 0.3px;
  display: inline-flex;
  align-items: center;
}

.room-filter-btn:hover {
  background: linear-gradient(135deg, #d1d5db 0%, #b8bcc2 100%);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.room-filter-btn.active {
  background: linear-gradient(135deg, #00723a 0%, #005a2f 100%);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 114, 58, 0.3);
}

.room-filter-btn.active:hover {
  background: linear-gradient(135deg, #005a2f 0%, #004a25 100%);
  box-shadow: 0 4px 12px rgba(0, 114, 58, 0.4);
  transform: translateY(-1px);
}

.room-filter-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  z-index: 1000;
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  border: 1px solid #e5e7eb;
  min-width: 700px;
  animation: slideDownSimple 0.2s ease-out;
}

@keyframes slideDownSimple {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.filter-header {
  padding: 12px 20px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.filter-title {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  white-space: nowrap;
}

.filter-actions {
  display: flex;
  gap: 10px;
}

.filter-action-btn {
  background-color: #f3f4f6;
  border: 1px solid #e5e7eb;
  color: #374151;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.filter-action-btn:hover {
  background-color: #e5e7eb;
  border-color: #d1d5db;
}

.filter-body {
  padding: 20px;
  display: flex;
  gap: 32px;
}

.filter-section {
  flex: 1;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: #00723a;
  margin: 0 0 14px 0;
}

.room-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.room-checkbox {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 0.9375rem;
  color: #374151;
}

.room-name-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.room-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.room-option-name {
  color: #111827;
}

.room-option-cap {
  margin-left: auto;
  font-size: 0.75rem;
  color: #6b7280;
}

.room-option.is-selected .room-option-name,
.room-option.is-selected .room-option-cap {
  font-weight: 700;
}

.room-color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.room-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #00723a;
}

.room-checkbox:hover {
  color: #00723a;
}

@media (max-width: 1099px) {
  .toolbar-left-group,
  .toolbar-right-group {
    flex-wrap: wrap;
    row-gap: 0.375rem;
  }

  .toolbar-center {
    order: 3;
    width: 100%;
    justify-content: center;
    margin-top: 0.25rem;
  }

  .toolbar-right-group {
    justify-content: flex-end;
  }

  .label-long {
    display: none;
  }

  .label-short {
    display: inline;
  }
}

</style>
