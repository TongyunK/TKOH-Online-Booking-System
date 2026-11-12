<template>
  <div class="month-more-root" :class="{ 'is-popover-open': popoverVisible }">
  <el-popover
    v-model:visible="popoverVisible"
    placement="top-start"
    :fallback-placements="['bottom-start', 'left-start', 'right-start', 'top', 'bottom']"
    :width="320"
    trigger="click"
    :teleported="popoverTeleported"
    :popper-options="morePopperOptions"
    popper-class="month-day-more-popover"
    :show-arrow="true"
  >
    <template #default>
      <div class="month-more-panel">
        <div class="month-more-panel-header">{{ dayHeaderLabel }}</div>
        <div class="month-more-panel-list" role="list">
          <CalendarBookingPopover
            v-for="(booking, idx) in bookings"
            :key="booking.id ?? `more-${idx}`"
            :booking="booking"
            :current-date="currentDate"
            :fallback-day="cellDate.getDate()"
            :rooms="selectedRooms"
            default-color="#f97316"
            :teleported="popoverTeleported"
          >
            <template #reference>
              <button
                type="button"
                class="month-more-panel-item"
                :class="{ 'is-blocked': booking.isBlocked }"
                @click.stop
              >
                <span
                  class="month-more-item-bar"
                  :style="getBarStyle(booking)"
                  aria-hidden="true"
                />
                <span class="month-more-item-time">{{ formatTimeRange(booking) }}</span>
                <span class="month-more-item-title">{{ getItemTitle(booking) }}</span>
              </button>
            </template>
          </CalendarBookingPopover>
        </div>
      </div>
    </template>
    <template #reference>
      <div class="month-more-trigger" @click.stop>
        <div
          class="month-more-footer"
          role="button"
          tabindex="0"
          :aria-label="`Show all ${bookings.length} bookings for this day`"
        >
          +{{ hiddenCount }}
        </div>
      </div>
    </template>
  </el-popover>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import CalendarBookingPopover from './CalendarBookingPopover.vue'
import {
  resolveBookingAccentColor,
  HTML_ZOOM_BREAKPOINT_MQ,
  createBrowserViewportPopperOptions
} from '@/utils/venueCalendarApi'

const props = defineProps({
  cellDate: {
    type: Date,
    required: true
  },
  currentDate: {
    type: Date,
    required: true
  },
  bookings: {
    type: Array,
    default: () => []
  },
  hiddenCount: {
    type: Number,
    default: 0
  },
  selectedRooms: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['visible-change'])

const popoverVisible = ref(false)
/** 按浏览器视口翻转，避免 zoom 下 #app 更宽导致仍往窗外排 */
const morePopperOptions = createBrowserViewportPopperOptions()
/** 14" html zoom 断点内挂 body 会偏移，与 style.css 说明一致：留在缩放 DOM 内 */
const popoverTeleported = ref(true)
let zoomBreakpointMq = null

function syncPopoverTeleported () {
  if (typeof window === 'undefined') return
  popoverTeleported.value = !window.matchMedia(HTML_ZOOM_BREAKPOINT_MQ).matches
}

watch(popoverVisible, (visible) => {
  emit('visible-change', visible)
})

onMounted(() => {
  syncPopoverTeleported()
  zoomBreakpointMq = window.matchMedia(HTML_ZOOM_BREAKPOINT_MQ)
  zoomBreakpointMq.addEventListener('change', syncPopoverTeleported)
})

onUnmounted(() => {
  zoomBreakpointMq?.removeEventListener('change', syncPopoverTeleported)
  zoomBreakpointMq = null
  if (popoverVisible.value) emit('visible-change', false)
})

const dayHeaderLabel = computed(() => {
  return props.cellDate.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })
})

function formatItemTime (time) {
  if (!time) return ''
  const parts = String(time).split(':')
  const h = parseInt(parts[0], 10)
  const m = parts[1] ?? '00'
  if (Number.isNaN(h)) return String(time)
  return `${h}:${m}`
}

function formatTimeRange (booking) {
  const start = formatItemTime(booking.startTime)
  const end = formatItemTime(booking.endTime)
  if (!start && !end) return '—'
  if (!end) return start
  if (!start) return end
  return `${start} - ${end}`
}

function getItemTitle (booking) {
  return (booking.topic || booking.notes || 'Booking').trim()
}

function getBarStyle (booking) {
  const accent = resolveBookingAccentColor(booking, props.selectedRooms)
  return {
    backgroundColor: booking?.isBlocked ? '#9ca3af' : accent
  }
}
</script>

<style scoped>
.month-more-root {
  position: relative;
  z-index: 3;
  width: 100%;
  flex-shrink: 0;
}

.month-more-root.is-popover-open {
  z-index: 50;
  overflow: visible;
}

.month-more-trigger {
  flex-shrink: 0;
  width: 100%;
}

.month-more-footer {
  flex-shrink: 0;
  width: 100%;
  margin: 0;
  padding: 2px 6px;
  border-radius: 3px;
  background-color: #e5e7eb;
  color: #4b5563;
  font-size: 0.65rem;
  font-weight: 600;
  text-align: center;
  line-height: 1.2;
  cursor: pointer;
  user-select: none;
}

.month-more-footer:hover {
  background-color: #d1d5db;
  color: #374151;
}
</style>

<style>
.month-day-more-popover.el-popover.el-popper {
  padding: 0 !important;
  border: 1px solid #d1d5db !important;
  border-radius: 8px !important;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.14) !important;
  z-index: 60;
}

/* teleported=false：Popper 相对触发器定位，勿用 fixed 挂 body */
.month-more-root.is-popover-open .month-day-more-popover.el-popover.el-popper {
  z-index: 100;
}

@media screen and (min-width: 1100px) and (max-width: 1599px) {
  /* teleported=false：气泡留在格子内，需逐级放开 overflow，避免被父级裁切 */
  .calendar-container:has(.date-cell.is-popover-open),
  .month-view:has(.date-cell.is-popover-open),
  .calendar-month:has(.date-cell.is-popover-open),
  .month-grid:has(.date-cell.is-popover-open) {
    overflow: visible;
  }
}

.month-day-more-popover .month-more-panel {
  display: flex;
  flex-direction: column;
  max-height: min(420px, 70vh);
  min-width: 280px;
}

.month-day-more-popover .month-more-panel-header {
  flex-shrink: 0;
  padding: 12px 14px 10px;
  font-weight: 700;
  font-size: 0.9375rem;
  color: #111827;
  border-bottom: 1px solid #e5e7eb;
}

.month-day-more-popover .month-more-panel-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.month-day-more-popover .month-more-panel-item {
  display: grid;
  grid-template-columns: 3px minmax(0, 4.75rem) minmax(0, 1fr);
  column-gap: 6px;
  align-items: start;
  width: 100%;
  margin: 0;
  padding: 5px 6px 5px 4px;
  border: none;
  border-radius: 4px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
  transition: background-color 0.15s ease;
}

.month-day-more-popover .month-more-panel-item:hover {
  background-color: #f3f4f6;
}

.month-day-more-popover .month-more-item-bar {
  width: 3px;
  min-height: 1.35rem;
  align-self: stretch;
  border-radius: 1px;
  flex-shrink: 0;
}

.month-day-more-popover .month-more-item-time {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #374151;
  line-height: 1.35;
  white-space: nowrap;
}

.month-day-more-popover .month-more-item-title {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #111827;
  line-height: 1.35;
  word-break: break-word;
}

.month-day-more-popover .month-more-panel-item.is-blocked .month-more-item-title {
  color: #dc2626;
}
</style>
