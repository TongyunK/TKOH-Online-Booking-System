<template>
  <el-popover
    placement="right-start"
    :width="380"
    trigger="hover"
    :show-after="180"
    :hide-after="80"
    :teleported="teleported"
    popper-class="calendar-booking-popover"
  >
    <template #default>
      <div class="booking-popover-body">
        <div class="booking-popover-title" :style="popoverTitleStyle">
          {{ booking.topic || booking.notes || 'Booking' }}
        </div>
        <div class="booking-popover-row">
          <el-icon class="booking-popover-icon"><Clock /></el-icon>
          <span>{{ formatPopoverDateTime() }}</span>
        </div>
        <div class="booking-popover-row">
          <el-icon class="booking-popover-icon"><Location /></el-icon>
          <span>{{ formatPopoverRoomLine() }}</span>
        </div>
        <div class="booking-popover-row">
          <el-icon class="booking-popover-icon"><User /></el-icon>
          <span>{{ booking.reservedBy || 'N/A' }}</span>
        </div>
        <div class="booking-popover-row">
          <el-icon class="booking-popover-icon"><Phone /></el-icon>
          <span>{{ getBookingContact() }}</span>
        </div>
        <div class="booking-popover-row">
          <el-icon class="booking-popover-icon"><Message /></el-icon>
          <span>{{ getBookingEmail() }}</span>
        </div>
      </div>
    </template>
    <template #reference>
      <slot name="reference" />
    </template>
  </el-popover>
</template>

<script setup>
import { computed } from 'vue'
import { getCalendarBookingPopoverTitleStyle } from '@/utils/venueCalendarApi'

const props = defineProps({
  booking: {
    type: Object,
    required: true
  },
  currentDate: {
    type: Date,
    required: true
  },
  fallbackDay: {
    type: Number,
    default: null
  },
  defaultColor: {
    type: String,
    default: '#f97316'
  },
  teleported: {
    type: Boolean,
    default: true
  },
  /** 场地列表，用于 Block 等无 color 时按 roomName 取 venue 色 */
  rooms: {
    type: Array,
    default: () => []
  }
})

const popoverTitleStyle = computed(() =>
  getCalendarBookingPopoverTitleStyle(props.booking, props.rooms)
)

function getBookingContact() {
  return props.booking.contact ?? props.booking.contactNumber ?? props.booking.phone ?? props.booking.tel ?? 'N/A'
}

function getBookingEmail() {
  const email = props.booking.email ?? props.booking.contactEmail ?? props.booking.reservedByEmail
  const text = email == null ? '' : String(email).trim()
  return text || 'N/A'
}

function resolveBookingDate() {
  if (props.booking.date) {
    const raw = String(props.booking.date).trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T12:00:00`)
    return new Date(props.booking.date)
  }
  if (typeof props.fallbackDay === 'number') {
    return new Date(
      props.currentDate.getFullYear(),
      props.currentDate.getMonth(),
      props.fallbackDay
    )
  }
  return new Date(props.currentDate)
}

function formatPopoverDateTime() {
  const date = resolveBookingDate()
  const dateStr = date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  return `${dateStr} ${props.booking.startTime || ''}-${props.booking.endTime || ''}`.trim()
}

function formatPopoverRoomLine() {
  const name = props.booking.roomName?.trim()
  if (!name) return '—'
  if (props.booking.roomCode) return `${name} (${props.booking.roomCode})`
  return name
}
</script>

<style>
.calendar-booking-popover.el-popover.el-popper {
  padding: 0 !important;
  border: 1px solid #1f2937 !important;
  border-radius: 8px !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12) !important;
}

.calendar-booking-popover .booking-popover-body {
  padding: 12px 14px 14px;
  min-width: 340px;
  max-width: 420px;
}

.calendar-booking-popover .booking-popover-title {
  font-weight: 700;
  font-size: 0.9375rem;
  color: #111827;
  line-height: 1.35;
  padding: 10px 12px 10px 14px;
  border-radius: 6px;
  /* 色条与背景由 getCalendarBookingPopoverTitleStyle 内联设置 */
  margin-bottom: 12px;
}

.calendar-booking-popover .booking-popover-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 0.875rem;
  color: #374151;
  line-height: 1.4;
  margin-bottom: 8px;
}

.calendar-booking-popover .booking-popover-row:last-child {
  margin-bottom: 0;
}

.calendar-booking-popover .booking-popover-icon {
  flex-shrink: 0;
  margin-top: 2px;
  font-size: 16px;
  color: #6b7280;
}

</style>
