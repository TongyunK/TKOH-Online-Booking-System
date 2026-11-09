<template>
  <div ref="calendarDayRef" class="calendar-day" :class="{ 'is-public-holiday-day': isCurrentDayHoliday }">
    <div class="day-frame" :class="{ 'day-frame--scroll-x': needsHorizontalScroll }">
      <div ref="dayScrollRef" class="day-scroll-y">
        <div class="day-inner" :style="dayInnerStyle">
          <div ref="dayHeaderRef" class="day-header" :style="dayGridColumnsStyle">
            <div class="time-header" />
            <div v-for="room in selectedRooms" :key="room.id" class="room-header">
              <div class="room-label">{{ room.name }}</div>
            </div>
          </div>

          <div
            class="day-grid"
            :class="{ 'is-public-holiday-grid': isCurrentDayHoliday }"
            :style="dayGridColumnsStyle"
          >
            <div class="time-column">
              <div v-for="hour in timeSlots" :key="hour" class="time-slot">
                {{ hour }}
              </div>
            </div>

            <div v-for="room in selectedRooms" :key="room.id" class="room-column">
              <div
                v-for="hour in timeSlots"
                :key="`${room.id}-${hour}`"
                class="time-cell"
                @click="selectTimeSlot(room, hour)"
              />

              <CalendarBookingPopover
                v-for="booking in getRoomBookings(room.name)"
                :key="booking.id"
                :booking="booking"
                :current-date="currentDate"
                :rooms="selectedRooms"
                default-color="#f97316"
                :teleported="false"
              >
                <template #reference>
                  <div
                    class="booking-block"
                    :style="getBookingStyle(booking)"
                    @click="selectBooking(booking)"
                  >
                    <div class="booking-time">{{ booking.startTime }} - {{ booking.endTime }}</div>
                    <div class="booking-reserved">{{ booking.topic || booking.notes || 'Booking' }}</div>
                  </div>
                </template>
              </CalendarBookingPopover>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="currentHolidayLabel"
        class="day-holiday-overlay"
        :style="holidayOverlayStyle"
        aria-hidden="true"
      >
        <span class="day-holiday-label">{{ currentHolidayLabel }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import CalendarBookingPopover from './CalendarBookingPopover.vue'
import { getCalendarBookingBlockStyle, formatDateISO } from '@/utils/venueCalendarApi'

const props = defineProps({
  currentDate: {
    type: Date,
    required: true
  },
  bookings: {
    type: Array,
    default: () => []
  },
  selectedRooms: {
    type: Array,
    default: () => []
  },
  publicHolidaysByDate: {
    type: Object,
    default: () => ({})
  }
})

const TIME_COL_PX = 80
const MIN_ROOM_COL_PX = 170

const calendarDayRef = ref(null)
const dayScrollRef = ref(null)
const dayHeaderRef = ref(null)
const containerWidth = ref(0)
const headerHeightPx = ref(0)
let resizeObserver = null

const isCurrentDayHoliday = computed(() => {
  const ymd = formatDateISO(props.currentDate)
  return Boolean(props.publicHolidaysByDate[ymd])
})

const currentHolidayLabel = computed(() => {
  const ymd = formatDateISO(props.currentDate)
  return props.publicHolidaysByDate[ymd] || ''
})

const emit = defineEmits(['time-slot-click'])

const timeSlots = computed(() => {
  const slots = []
  for (let hour = 8; hour <= 22; hour++) {
    slots.push(`${String(hour).padStart(2, '0')}:00`)
    if (hour < 22) {
      slots.push(`${String(hour).padStart(2, '0')}:30`)
    }
  }
  return slots
})

const roomColumnWidthsPx = computed(() => {
  const roomCount = Math.max(props.selectedRooms.length, 1)
  const available = Math.max(0, containerWidth.value - TIME_COL_PX)
  const minTotal = roomCount * MIN_ROOM_COL_PX

  if (available <= 0 || available < minTotal) {
    return Array(roomCount).fill(MIN_ROOM_COL_PX)
  }

  const layoutBudget = Math.max(0, available - 1)
  const width = Math.floor(layoutBudget / roomCount)
  return Array(roomCount).fill(Math.max(MIN_ROOM_COL_PX, width))
})

const dayContentWidthPx = computed(() => {
  return TIME_COL_PX + roomColumnWidthsPx.value.reduce((a, b) => a + b, 0)
})

const needsHorizontalScroll = computed(() => {
  const cw = containerWidth.value
  if (cw <= 0) return false
  return dayContentWidthPx.value > cw
})

const dayGridColumnsStyle = computed(() => {
  const roomCols = roomColumnWidthsPx.value
  if (!roomCols.length) {
    return {
      gridTemplateColumns: `${TIME_COL_PX}px repeat(1, minmax(${MIN_ROOM_COL_PX}px, 1fr))`
    }
  }
  return {
    gridTemplateColumns: `${TIME_COL_PX}px ${roomCols.map((w) => `${w}px`).join(' ')}`
  }
})

const dayInnerStyle = computed(() => {
  const total = dayContentWidthPx.value

  if (needsHorizontalScroll.value) {
    return {
      width: `${total}px`,
      minWidth: `${total}px`
    }
  }
  return {
    width: '100%',
    maxWidth: '100%'
  }
})

const holidayOverlayStyle = computed(() => ({
  top: `${headerHeightPx.value}px`,
  left: `${TIME_COL_PX}px`
}))

function updateContainerWidth () {
  const el = dayScrollRef.value || calendarDayRef.value
  containerWidth.value = el ? Math.floor(el.clientWidth) : 0
}

function updateHeaderHeight () {
  headerHeightPx.value = dayHeaderRef.value
    ? Math.ceil(dayHeaderRef.value.getBoundingClientRect().height)
    : 0
}

function updateLayoutMetrics () {
  updateContainerWidth()
  updateHeaderHeight()
}

function getRoomBookings (roomName) {
  return props.bookings.filter(booking => booking.roomName === roomName)
}

function getBookingStyle (booking) {
  const [startHour, startMinute] = (booking.startTime?.split(':') || ['8', '0']).map(Number)
  const [endHour, endMinute] = (booking.endTime?.split(':') || ['8', '30']).map(Number)

  const startTimeInMinutes = startHour * 60 + startMinute
  const endTimeInMinutes = endHour * 60 + endMinute
  const dayStartInMinutes = 8 * 60

  const offsetSlots = (startTimeInMinutes - dayStartInMinutes) / 30
  const durationSlots = (endTimeInMinutes - startTimeInMinutes) / 30

  const slotHeight = 40
  const top = offsetSlots * slotHeight
  const height = durationSlots * slotHeight

  return getCalendarBookingBlockStyle(
    booking,
    {
      top: `${top}px`,
      height: `${height}px`
    },
    props.selectedRooms
  )
}

function selectTimeSlot (room, hour) {
  const year = props.currentDate.getFullYear()
  const month = String(props.currentDate.getMonth() + 1).padStart(2, '0')
  const day = String(props.currentDate.getDate()).padStart(2, '0')
  emit('time-slot-click', {
    date: `${year}-${month}-${day}`,
    time: hour,
    room: room.name
  })
}

function selectBooking (booking) {
  console.log('Selected booking:', booking)
}

onMounted(() => {
  updateLayoutMetrics()
  const targets = [dayScrollRef.value, calendarDayRef.value, dayHeaderRef.value].filter(Boolean)
  if (typeof ResizeObserver !== 'undefined' && targets.length) {
    resizeObserver = new ResizeObserver(() => updateLayoutMetrics())
    for (const el of targets) {
      resizeObserver.observe(el)
    }
  } else {
    window.addEventListener('resize', updateLayoutMetrics)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('resize', updateLayoutMetrics)
})
</script>

<style scoped>
.calendar-day {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}

.calendar-day.is-public-holiday-day .room-column .time-cell {
  background-color: #fef2f2;
}

.calendar-day.is-public-holiday-day .room-column .time-cell:hover {
  background-color: #fee2e2;
  cursor: not-allowed;
}

.day-frame {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  position: relative;
}

.day-frame--scroll-x {
  overflow-x: auto;
}

.day-scroll-y {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: visible;
}

.day-scroll-y::-webkit-scrollbar {
  width: 8px;
}

.day-scroll-y::-webkit-scrollbar-track {
  background: #f3f4f6;
  border-radius: 4px;
}

.day-scroll-y::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 4px;
}

.day-scroll-y::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

.day-inner {
  box-sizing: border-box;
}

.day-header {
  display: grid;
  box-sizing: border-box;
  background-color: #e5e7eb;
  border-radius: 0.5rem 0.5rem 0 0;
  overflow: visible;
  border: 1px solid #e5e7eb;
  border-bottom: none;
  position: sticky;
  top: 0;
  z-index: 10;
}

.time-header {
  background-color: #f3f4f6;
  padding: 0.5rem;
  border-right: 1px solid #e5e7eb;
  position: sticky;
  left: 0;
  z-index: 12;
  box-shadow: 1px 0 0 #e5e7eb;
}

.room-header {
  background-color: #f3f4f6;
  padding: 0.5rem;
  text-align: center;
  border-right: 1px solid #e5e7eb;
}

.room-header:last-child {
  border-right: none;
}

.room-label {
  font-weight: 600;
  color: #374151;
  font-size: 0.875rem;
  white-space: nowrap;
}

.day-grid {
  display: grid;
  box-sizing: border-box;
  position: relative;
  background-color: #e5e7eb;
  border-radius: 0 0 0.5rem 0.5rem;
  overflow: visible;
  border: 1px solid #e5e7eb;
  border-top: none;
}

.day-holiday-overlay {
  position: absolute;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 6;
  padding: 1rem 0.5rem;
  box-sizing: border-box;
}

.day-holiday-label {
  max-width: min(1100px, 96%);
  font-size: clamp(1rem, 2.2vw, 1.35rem);
  font-weight: 700;
  line-height: 1.35;
  text-align: center;
  color: #b91c1c;
  word-break: break-word;
}

.time-column {
  background-color: #f9fafb;
  display: flex;
  flex-direction: column;
  position: sticky;
  left: 0;
  z-index: 8;
  box-shadow: 1px 0 0 #e5e7eb;
}

.time-slot {
  padding: 0.25rem;
  text-align: center;
  font-size: 0.75rem;
  color: #6b7280;
  border-bottom: 1px solid #e5e7eb;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  box-sizing: border-box;
}

.room-column {
  display: flex;
  flex-direction: column;
  position: relative;
}

.time-cell {
  background-color: white;
  border-bottom: 1px solid #e5e7eb;
  border-right: 1px solid #e5e7eb;
  height: 40px;
  padding: 0;
  cursor: pointer;
  transition: background-color 0.2s ease;
  box-sizing: border-box;
}

.room-column:last-child .time-cell {
  border-right: none;
}

.time-cell:hover {
  background-color: #f0fdf4;
}

.booking-block {
  position: absolute;
  left: 2px;
  right: 2px;
  box-sizing: border-box;
  padding: 3px 6px 3px 7px;
  border-radius: 3px;
  border-left-width: 4px;
  border-left-style: solid;
  color: #111827;
  font-size: 0.7rem;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  z-index: 1;
}

.booking-block:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.booking-time {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8125rem;
  margin-bottom: 0.125rem;
  color: #111827;
}

.booking-reserved {
  font-size: 0.75rem;
  font-weight: 500;
  color: #4b5563;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 389px) {
  .time-slot {
    height: 50px;
    font-size: 0.75rem;
  }

  .time-cell {
    height: 50px;
  }

  .booking-time {
    font-size: 0.7rem;
  }

  .booking-reserved {
    font-size: 0.6rem;
  }
}

@media (min-width: 390px) and (max-width: 767px) {
  .time-slot {
    height: 50px;
    font-size: 0.75rem;
  }

  .time-cell {
    height: 50px;
  }

  .booking-time {
    font-size: 0.7rem;
  }

  .booking-reserved {
    font-size: 0.6rem;
  }
}

@media (min-width: 768px) and (max-width: 1099px) {}

@media (min-width: 1100px) and (max-width: 1599px) {}

@media (min-width: 1600px) and (max-width: 2239px) {}

@media (min-width: 2240px) {}
</style>
