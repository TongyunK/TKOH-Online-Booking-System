<template>
  <div ref="calendarWeekRef" class="calendar-week">
    <div class="week-frame" :class="{ 'week-frame--scroll-x': needsHorizontalScroll }">
      <!-- 表头与网格同宽、同列定义；纵向滚动时表头 sticky 固定 -->
      <div ref="weekScrollRef" class="week-scroll-y">
        <div class="week-inner" :style="weekInnerStyle">
          <div class="week-header" :style="weekGridColumnsStyle">
            <div class="time-header" />
            <div v-for="(day, index) in weekDays" :key="index" class="day-header" :class="{ 'is-public-holiday': isDayPublicHoliday(day.fullDate) }">
              <div class="day-label">{{ day.name }} / {{ day.date }}</div>
              <div v-if="getDayHolidayLabel(day.fullDate)" class="day-holiday-label">{{ getDayHolidayLabel(day.fullDate) }}</div>
            </div>
          </div>

          <div class="week-grid" :style="weekGridColumnsStyle">
            <div class="time-column">
              <div v-for="hour in timeSlots" :key="hour" class="time-slot">
                {{ hour }}
              </div>
            </div>

            <div
              v-for="(day, dayIndex) in weekDays"
              :key="dayIndex"
              class="day-column"
              :class="{
                'is-today': isToday(day.fullDate),
                'is-public-holiday': isDayPublicHoliday(day.fullDate)
              }"
            >
              <div
                v-for="hour in timeSlots"
                :key="`${dayIndex}-${hour}`"
                class="time-cell"
                @click="selectTimeSlot(day.fullDate, hour)"
              />

              <CalendarBookingPopover
                v-for="booking in getDayBookings(day.fullDate)"
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
                    :style="getBookingStyle(booking, day.fullDate)"
                    @click="selectBooking(day.fullDate)"
                  >
                    <div class="booking-time">{{ booking.startTime }} - {{ booking.endTime }}</div>
                    <div class="booking-reserved">{{ booking.roomName || 'N/A' }}</div>
                  </div>
                </template>
              </CalendarBookingPopover>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import CalendarBookingPopover from './CalendarBookingPopover.vue'
import { formatDateISO, isSameCalendarDay, getCalendarBookingBlockStyle } from '@/utils/venueCalendarApi'

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

const emit = defineEmits(['time-slot-click', 'booking-click'])

/** Outlook 式：按当日最大并排预订数分配列宽 */
const TIME_COL_PX = 80
/** 有并排预订时的列宽下限（表头「Wed / May 27」+ padding） */
const MIN_DAY_COL_PX = 120
/** 无并排（demand≤1）时可收窄，把宽度让给高需求日 */
const COMPACT_DAY_COL_PX = 110
/** 每增加一列并排预订，在保底宽度上追加的目标宽度 */
const BOOKING_COL_MIN_PX = 52
const MAX_DAY_COL_PX = 300

function columnMinForDemand (demand) {
  return demand <= 1 ? COMPACT_DAY_COL_PX : MIN_DAY_COL_PX
}

function idealColumnWidth (demand) {
  const minW = columnMinForDemand(demand)
  if (demand <= 1) return minW
  return Math.min(
    MAX_DAY_COL_PX,
    minW + (demand - 1) * BOOKING_COL_MIN_PX
  )
}

/** 高需求优先；同需求时优先尚未达到 ideal 的列 */
function demandPriorityOrder (demands, widths, ideals) {
  const n = demands.length
  return [...Array(n).keys()].sort((a, b) => {
    if (demands[b] !== demands[a]) return demands[b] - demands[a]
    const gapA = ideals[a] - widths[a]
    const gapB = ideals[b] - widths[b]
    return gapB - gapA
  })
}

/** 缩宽时从低需求、超出保底最多的列开始收 */
function demandShrinkOrder (demands, widths, mins) {
  const n = demands.length
  return [...Array(n).keys()].sort((a, b) => {
    if (demands[a] !== demands[b]) return demands[a] - demands[b]
    const slackA = widths[a] - mins[a]
    const slackB = widths[b] - mins[b]
    return slackB - slackA
  })
}

const calendarWeekRef = ref(null)
const weekScrollRef = ref(null)
const containerWidth = ref(0)
let resizeObserver = null

const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// 时间槽（30分钟间隔，从7:00到21:00）
const timeSlots = computed(() => {
  const slots = []
  for (let hour = 7; hour <= 21; hour++) {
    slots.push(`${String(hour).padStart(2, '0')}:00`)
    if (hour < 21) {
      slots.push(`${String(hour).padStart(2, '0')}:30`)
    }
  }
  return slots
})

// 周的日期
const weekDays = computed(() => {
  const date = new Date(props.currentDate)
  const day = date.getDay()
  // 从周日开始（周日是0）
  const diff = date.getDate() - day
  const weekStart = new Date(date.setDate(diff))

  const days = []
  for (let i = 0; i < 7; i++) {
    const currentDay = new Date(weekStart)
    currentDay.setDate(currentDay.getDate() + i)
    days.push({
      name: weekdayNames[currentDay.getDay()],
      date: currentDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullDate: new Date(currentDay)
    })
  }
  return days
})

function dayDateKey (dayDate) {
  return formatDateISO(dayDate)
}

function getDayHolidayLabel (dayDate) {
  return props.publicHolidaysByDate[dayDateKey(dayDate)] || ''
}

function isDayPublicHoliday (dayDate) {
  return Boolean(getDayHolidayLabel(dayDate))
}

// 获取某一天的所有预订（根据选中的房间过滤）
function getDayBookings (dayDate) {
  const dayBookings = props.bookings.filter(booking =>
    isSameCalendarDay(booking.date, dayDate)
  )

  // 与 Day/Month 一致：未选中任何房间（如 Clear All）时不显示预订
  if (!props.selectedRooms || props.selectedRooms.length === 0) {
    return []
  }

  const selectedRoomNames = props.selectedRooms.map(room => room.name)
  return dayBookings.filter(booking => selectedRoomNames.includes(booking.roomName))
}

function parseTimeToMinutes (timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 7 * 60
  const [h, m] = timeStr.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return 7 * 60
  return h * 60 + m
}

/** 与房间筛选列表顺序一致（CR1 → CR2 → CR3 …），未知房间靠后 */
function roomOrderIndex (roomName) {
  const rooms = props.selectedRooms || []
  const idx = rooms.findIndex((r) => r.name === roomName)
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx
}

/**
 * 按房间顺序固定列位（不按开始时间排左右）：
 * 当日出现的房间按筛选列表顺序（CR1 → CR2 → CR3…）占列，同房间全天同一列。
 * 同房间若有时间重叠，在该房间列组内再拆子列。
 */
function buildDayOverlapLayout (dayBookings) {
  const layout = new Map()
  if (!dayBookings.length) return layout

  const roomNames = [...new Set(
    dayBookings.map((b) => b.roomName || '').filter(Boolean)
  )].sort((a, b) => {
    const d = roomOrderIndex(a) - roomOrderIndex(b)
    return d !== 0 ? d : a.localeCompare(b)
  })

  // 无房间名的预订排在最后一「房间组」
  const hasUnnamed = dayBookings.some((b) => !b.roomName)
  const roomGroups = hasUnnamed ? [...roomNames, ''] : roomNames

  /** 每个房间组内：按时间贪心拆子列（同房重叠时） */
  const groupLayouts = new Map()
  let totalCols = 0

  for (const roomName of roomGroups) {
    const groupItems = dayBookings
      .filter((b) => (b.roomName || '') === roomName)
      .map((booking) => {
        const startMin = parseTimeToMinutes(booking.startTime)
        let endMin = parseTimeToMinutes(booking.endTime)
        if (endMin <= startMin) endMin = startMin + 30
        return { booking, startMin, endMin }
      })
      .sort((a, b) => {
        if (a.startMin !== b.startMin) return a.startMin - b.startMin
        if (b.endMin !== a.endMin) return b.endMin - a.endMin
        return String(a.booking.id).localeCompare(String(b.booking.id))
      })

    const colMaxEnd = []
    for (const item of groupItems) {
      let c = 0
      while (c < colMaxEnd.length && item.startMin < colMaxEnd[c]) {
        c++
      }
      if (c === colMaxEnd.length) colMaxEnd.push(item.endMin)
      else colMaxEnd[c] = Math.max(colMaxEnd[c], item.endMin)
      item.subCol = c
    }

    const subCols = Math.max(colMaxEnd.length, 1)
    groupLayouts.set(roomName, { items: groupItems, baseCol: totalCols, subCols })
    totalCols += subCols
  }

  totalCols = Math.max(totalCols, 1)
  for (const { items, baseCol } of groupLayouts.values()) {
    for (const item of items) {
      layout.set(item.booking.id, { col: baseCol + item.subCol, totalCols })
    }
  }

  return layout
}

const weekOverlapLayouts = computed(() => {
  const byDay = new Map()
  for (const day of weekDays.value) {
    const key = dayDateKey(day.fullDate)
    byDay.set(key, buildDayOverlapLayout(getDayBookings(day.fullDate)))
  }
  return byDay
})

/** 每日最大并排列数（至少 1，空日占最小权重） */
const dayColumnDemands = computed(() => {
  return weekDays.value.map((day) => {
    const layout = weekOverlapLayouts.value.get(dayDateKey(day.fullDate))
    if (!layout || layout.size === 0) return 1
    let maxCols = 1
    for (const meta of layout.values()) {
      maxCols = Math.max(maxCols, meta.totalCols ?? 1)
    }
    return maxCols
  })
})

/**
 * 低需求列维持紧凑保底，富余宽度按需求优先灌入高需求列（先至 ideal，再至 max）。
 */
function distributeDayColumnWidths (demands, totalDayWidth) {
  const n = demands.length
  if (n === 0) return []

  const mins = demands.map(columnMinForDemand)
  const ideals = demands.map(idealColumnWidth)
  const widths = [...mins]
  let spare = totalDayWidth - widths.reduce((a, b) => a + b, 0)

  const growToward = (capFn) => {
    let progressed = true
    while (spare > 0 && progressed) {
      progressed = false
      const order = demandPriorityOrder(demands, widths, ideals)
      for (const i of order) {
        const cap = capFn(i)
        if (widths[i] < cap) {
          widths[i] += 1
          spare -= 1
          progressed = true
          if (spare <= 0) break
        }
      }
    }
  }

  if (spare > 0) {
    growToward((i) => ideals[i])
    growToward((i) => MAX_DAY_COL_PX)
  } else if (spare < 0) {
    let progressed = true
    while (spare < 0 && progressed) {
      progressed = false
      const order = demandShrinkOrder(demands, widths, mins)
      for (const i of order) {
        if (widths[i] > mins[i]) {
          widths[i] -= 1
          spare += 1
          progressed = true
          if (spare >= 0) break
        }
      }
    }
  }

  widths.forEach((w, i) => {
    widths[i] = Math.floor(Math.min(MAX_DAY_COL_PX, Math.max(mins[i], w)))
  })

  let sum = widths.reduce((a, b) => a + b, 0)
  spare = totalDayWidth - sum

  if (spare > 0) {
    const order = demandPriorityOrder(demands, widths, ideals)
    for (const i of order) {
      if (spare <= 0) break
      if (widths[i] >= MAX_DAY_COL_PX) continue
      widths[i] += 1
      spare -= 1
    }
  } else if (spare < 0) {
    const order = demandShrinkOrder(demands, widths, mins)
    for (const i of order) {
      if (spare >= 0) break
      if (widths[i] <= mins[i]) continue
      widths[i] -= 1
      spare += 1
    }
  }

  return widths
}

const dayColumnWidthsPx = computed(() => {
  const demands = dayColumnDemands.value
  const dayCount = demands.length
  if (!dayCount) return []

  const minTotal = demands.reduce((sum, d) => sum + columnMinForDemand(d), 0)
  const available = Math.max(0, containerWidth.value - TIME_COL_PX)

  if (available <= 0) {
    return demands.map(columnMinForDemand)
  }
  if (available < minTotal) {
    return demands.map(columnMinForDemand)
  }
  const layoutBudget = Math.max(0, available - 1)
  return distributeDayColumnWidths(demands, layoutBudget)
})

const weekContentWidthPx = computed(() => {
  return TIME_COL_PX + dayColumnWidthsPx.value.reduce((a, b) => a + b, 0)
})

/** 内容总宽超过容器时才启用横向滚动 */
const needsHorizontalScroll = computed(() => {
  const cw = containerWidth.value
  if (cw <= 0) return false
  return weekContentWidthPx.value > cw
})

/** 表头 / 网格共用同一套像素列宽，保证竖线对齐 */
const weekGridColumnsStyle = computed(() => {
  const dayCols = dayColumnWidthsPx.value
  if (!dayCols.length) {
    return {
      gridTemplateColumns: `${TIME_COL_PX}px repeat(7, minmax(${MIN_DAY_COL_PX}px, 1fr))`
    }
  }
  return {
    gridTemplateColumns: `${TIME_COL_PX}px ${dayCols.map((w) => `${w}px`).join(' ')}`
  }
})

const weekInnerStyle = computed(() => {
  const total = weekContentWidthPx.value

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

function updateContainerWidth () {
  const el = weekScrollRef.value || calendarWeekRef.value
  containerWidth.value = el ? Math.floor(el.clientWidth) : 0
}

onMounted(() => {
  updateContainerWidth()
  const targets = [weekScrollRef.value, calendarWeekRef.value].filter(Boolean)
  if (typeof ResizeObserver !== 'undefined' && targets.length) {
    resizeObserver = new ResizeObserver(() => updateContainerWidth())
    for (const el of targets) {
      resizeObserver.observe(el)
    }
  } else {
    window.addEventListener('resize', updateContainerWidth)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('resize', updateContainerWidth)
})

// 判断是否是今天
function isToday(date) {
  return isSameCalendarDay(date, new Date())
}

// 计算预订卡片的样式（位置和高度；横向按重叠列均分宽度）
function getBookingStyle (booking, dayDate) {
  const startTimeInMinutes = parseTimeToMinutes(booking.startTime)
  let endTimeInMinutes = parseTimeToMinutes(booking.endTime)
  if (endTimeInMinutes <= startTimeInMinutes) endTimeInMinutes = startTimeInMinutes + 30

  // 7:00 是起始时间（7 * 60 = 420分钟）
  const dayStartInMinutes = 7 * 60

  // 计算相对于7:00的偏移量（以30分钟为单位）
  const offsetSlots = (startTimeInMinutes - dayStartInMinutes) / 30
  const durationSlots = (endTimeInMinutes - startTimeInMinutes) / 30

  // 每个时间槽高度为40px
  const slotHeight = 40
  const top = offsetSlots * slotHeight
  const height = durationSlots * slotHeight

  const layout = weekOverlapLayouts.value.get(dayDateKey(dayDate))
  const lay = layout?.get(booking.id)
  const totalCols = lay?.totalCols ?? 1
  const col = lay?.col ?? 0
  const colFrac = 100 / totalCols
  const gutterPx = 2

  return getCalendarBookingBlockStyle(
    booking,
    {
      top: `${top}px`,
      height: `${height}px`,
      left: `calc(${col * colFrac}% + ${gutterPx}px)`,
      width: `calc(${colFrac}% - ${gutterPx * 2}px)`,
      right: 'auto',
      zIndex: 1 + col
    },
    props.selectedRooms
  )
}

// 选择时间槽（date 使用 YYYY-MM-DD，与日视图 / 预订弹窗一致）
function selectTimeSlot(dayDate, hour) {
  emit('time-slot-click', {
    date: formatDateISO(dayDate),
    time: hour
  })
}

// 选择预订
function selectBooking(dayDate) {
  emit('booking-click', dayDate)
}
</script>

<style scoped>
.calendar-week {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}

.week-frame {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
}

.week-frame--scroll-x {
  overflow-x: auto;
}

.week-scroll-y {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: visible;
}

.week-scroll-y::-webkit-scrollbar {
  width: 8px;
}

.week-scroll-y::-webkit-scrollbar-track {
  background: #f3f4f6;
  border-radius: 4px;
}

.week-scroll-y::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 4px;
}

.week-scroll-y::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

.week-inner {
  box-sizing: border-box;
}

.week-header {
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

.day-header {
  background-color: #f3f4f6;
  padding: 0.5rem;
  text-align: center;
  border-right: 1px solid #e5e7eb;
}

.day-header:last-child {
  border-right: none;
}

.day-label {
  font-weight: 600;
  color: #374151;
  font-size: 0.875rem;
  white-space: nowrap;
}

.week-grid {
  display: grid;
  box-sizing: border-box;
  background-color: #e5e7eb;
  border-radius: 0 0 0.5rem 0.5rem;
  overflow: visible;
  border: 1px solid #e5e7eb;
  border-top: none;
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

.day-column {
  display: flex;
  flex-direction: column;
  position: relative;
}

.day-column.is-today .time-cell {
  background-color: #fffbeb;
}

.day-column.is-today .time-cell:hover {
  background-color: #fef3c7;
}

.day-header.is-public-holiday {
  background-color: #fef2f2;
  border-bottom: 1px solid #e5e7eb;
}

.day-column.is-public-holiday .time-cell {
  background-color: #fef2f2;
}

.day-column.is-public-holiday .time-cell:hover {
  background-color: #fee2e2;
  cursor: not-allowed;
}

.day-holiday-label {
  margin-top: 2px;
  font-size: 0.625rem;
  line-height: 1.2;
  font-weight: 600;
  color: #b91c1c;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.day-column:last-child .time-cell {
  border-right: none;
}

.time-cell:hover {
  background-color: #f0fdf4;
}

.booking-block {
  position: absolute;
  box-sizing: border-box;
  padding: 3px 6px 3px 7px;
  border-radius: 3px;
  border-left-width: 4px;
  border-left-style: solid;
  /* 色条颜色与背景由 getCalendarBookingBlockStyle 内联设置 */
  color: #111827;
  font-size: 0.7rem;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.booking-time {
  font-weight: 600;
  font-size: 0.8125rem;
  margin-bottom: 0.125rem;
  overflow-wrap: break-word;
  word-break: break-word;
  line-height: 1.15;
  color: #111827;
}

.booking-reserved {
  font-size: 0.75rem;
  font-weight: 500;
  color: #4b5563;
  overflow-wrap: break-word;
  word-break: break-word;
  line-height: 1.15;
}

@media (max-width: 389px) {
  .time-slot {
    min-height: 50px;
    padding: 0.5rem;
    font-size: 0.7rem;
  }

  .time-cell {
    min-height: 50px;
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
    min-height: 50px;
    padding: 0.5rem;
    font-size: 0.7rem;
  }

  .time-cell {
    min-height: 50px;
  }

  .booking-time {
    font-size: 0.7rem;
  }

  .booking-reserved {
    font-size: 0.6rem;
  }
}

@media (min-width: 768px) and (max-width: 1099px) {
  .time-slot {
    min-height: 50px;
    padding: 0.5rem;
    font-size: 0.7rem;
  }

  .time-cell {
    min-height: 50px;
  }
}

@media (min-width: 1100px) and (max-width: 1599px) {}

@media (min-width: 1600px) and (max-width: 2239px) {}

@media (min-width: 2240px) {}
</style>
