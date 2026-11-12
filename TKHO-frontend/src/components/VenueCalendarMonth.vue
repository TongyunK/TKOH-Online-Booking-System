<template>
  <div class="calendar-month h-full min-h-0 flex flex-col flex-1">
    <!-- 日期表头 -->
    <div class="weekday-header">
      <div
        v-for="(day, index) in weekdays"
        :key="day"
        class="weekday-cell"
        :class="{ 'first-col': index === 0, 'last-col': index === 6 }"
      >
        {{ day }}
      </div>
    </div>

    <!-- 日期网格 -->
    <div
      ref="monthGridRef"
      class="month-grid flex-1"
      :style="monthGridStyle"
      :key="`grid-${currentDate.getFullYear()}-${currentDate.getMonth()}`"
    >
      <!-- 上个月的日期 -->
      <div
        v-for="(day, index) in prevMonthDays"
        :key="`prev-${index}-${day}`"
        :data-cell-key="dayCellKey(day, 'prev')"
        class="date-cell"
        :class="{
          empty: true,
          'has-bookings': hasBookings(day, 'prev'),
          'has-more-trigger': getHiddenBookingCount(day, 'prev') > 0,
          'is-public-holiday': isPublicHolidayCell(day, 'prev'),
          'has-holiday-label': Boolean(getHolidayLabel(day, 'prev')),
          'first-col': (index % 7) === 0,
          'last-col': (index % 7) === 6,
          'is-popover-open': openPopoverCellKey === dayCellKey(day, 'prev')
        }"
        @click="selectDate(day, 'prev')"
      >
        <div class="date-cell-header">
          <span class="date-number">{{ day }}</span>
          <span
            v-if="getHolidayLabel(day, 'prev')"
            class="holiday-label"
            :title="getHolidayLabel(day, 'prev')"
          >{{ getHolidayLabel(day, 'prev') }}</span>
        </div>
        <div
          v-if="hasBookings(day, 'prev')"
          class="month-booking-list"
        >
          <CalendarBookingPopover
            v-for="(booking, idx) in getVisibleBookings(day, 'prev')"
            :key="booking.id ?? `b-prev-${day}-${idx}`"
            :booking="booking"
            :current-date="currentDate"
            :fallback-day="day"
            :rooms="selectedRooms"
            default-color="#f97316"
            @visible-change="(visible) => onCellPopoverVisible(dayCellKey(day, 'prev'), visible)"
          >
            <template #reference>
              <div
                class="month-event-bar"
                :class="{ 'is-blocked': booking.isBlocked }"
                :style="getMonthEventStyle(booking)"
              >
                <span class="month-event-text">{{ formatMonthEventLabel(booking) }}</span>
              </div>
            </template>
          </CalendarBookingPopover>
        </div>
        <MonthDayMorePopover
          v-if="getHiddenBookingCount(day, 'prev') > 0"
          :cell-date="resolveCellDate(day, 'prev')"
          :current-date="currentDate"
          :bookings="getBookingsForDay(day, 'prev')"
          :hidden-count="getHiddenBookingCount(day, 'prev')"
          :selected-rooms="selectedRooms"
          @visible-change="(visible) => onCellPopoverVisible(dayCellKey(day, 'prev'), visible)"
        />
      </div>

      <!-- 本月的日期 -->
      <div
        v-for="(day, index) in daysInMonth"
        :key="`current-${day}`"
        :data-cell-key="dayCellKey(day, 'current')"
        class="date-cell"
        :class="{
          'today': isToday(day),
          'has-bookings': hasBookings(day, 'current'),
          'has-more-trigger': getHiddenBookingCount(day, 'current') > 0,
          'is-public-holiday': isPublicHolidayCell(day, 'current'),
          'has-holiday-label': Boolean(getHolidayLabel(day, 'current')),
          'first-col': ((prevMonthDays.length + index) % 7) === 0,
          'last-col': ((prevMonthDays.length + index) % 7) === 6,
          'is-popover-open': openPopoverCellKey === dayCellKey(day, 'current')
        }"
        @click="selectDate(day, 'current')"
      >
        <div class="date-cell-header">
          <span class="date-number">{{ day }}</span>
          <span
            v-if="getHolidayLabel(day, 'current')"
            class="holiday-label"
            :title="getHolidayLabel(day, 'current')"
          >{{ getHolidayLabel(day, 'current') }}</span>
        </div>
        <div
          v-if="hasBookings(day, 'current')"
          class="month-booking-list"
        >
          <CalendarBookingPopover
            v-for="(booking, idx) in getVisibleBookings(day, 'current')"
            :key="booking.id ?? `b-cur-${day}-${idx}`"
            :booking="booking"
            :current-date="currentDate"
            :fallback-day="day"
            :rooms="selectedRooms"
            default-color="#f97316"
            @visible-change="(visible) => onCellPopoverVisible(dayCellKey(day, 'current'), visible)"
          >
            <template #reference>
              <div
                class="month-event-bar"
                :class="{ 'is-blocked': booking.isBlocked }"
                :style="getMonthEventStyle(booking)"
              >
                <span class="month-event-text">{{ formatMonthEventLabel(booking) }}</span>
              </div>
            </template>
          </CalendarBookingPopover>
        </div>
        <MonthDayMorePopover
          v-if="getHiddenBookingCount(day, 'current') > 0"
          :cell-date="resolveCellDate(day, 'current')"
          :current-date="currentDate"
          :bookings="getBookingsForDay(day, 'current')"
          :hidden-count="getHiddenBookingCount(day, 'current')"
          :selected-rooms="selectedRooms"
          @visible-change="(visible) => onCellPopoverVisible(dayCellKey(day, 'current'), visible)"
        />
      </div>

      <!-- 下个月的日期 -->
      <div
        v-for="(day, index) in nextMonthDays"
        :key="`next-${index}-${day}`"
        :data-cell-key="dayCellKey(day, 'next')"
        class="date-cell"
        :class="{
          empty: true,
          'has-bookings': hasBookings(day, 'next'),
          'has-more-trigger': getHiddenBookingCount(day, 'next') > 0,
          'is-public-holiday': isPublicHolidayCell(day, 'next'),
          'has-holiday-label': Boolean(getHolidayLabel(day, 'next')),
          'first-col': ((prevMonthDays.length + daysInMonth + index) % 7) === 0,
          'last-col': ((prevMonthDays.length + daysInMonth + index) % 7) === 6,
          'is-popover-open': openPopoverCellKey === dayCellKey(day, 'next')
        }"
        @click="selectDate(day, 'next')"
      >
        <div class="date-cell-header">
          <span class="date-number">{{ day }}</span>
          <span
            v-if="getHolidayLabel(day, 'next')"
            class="holiday-label"
            :title="getHolidayLabel(day, 'next')"
          >{{ getHolidayLabel(day, 'next') }}</span>
        </div>
        <div
          v-if="hasBookings(day, 'next')"
          class="month-booking-list"
        >
          <CalendarBookingPopover
            v-for="(booking, idx) in getVisibleBookings(day, 'next')"
            :key="booking.id ?? `b-next-${day}-${idx}`"
            :booking="booking"
            :current-date="currentDate"
            :fallback-day="day"
            :rooms="selectedRooms"
            default-color="#f97316"
            @visible-change="(visible) => onCellPopoverVisible(dayCellKey(day, 'next'), visible)"
          >
            <template #reference>
              <div
                class="month-event-bar"
                :class="{ 'is-blocked': booking.isBlocked }"
                :style="getMonthEventStyle(booking)"
              >
                <span class="month-event-text">{{ formatMonthEventLabel(booking) }}</span>
              </div>
            </template>
          </CalendarBookingPopover>
        </div>
        <MonthDayMorePopover
          v-if="getHiddenBookingCount(day, 'next') > 0"
          :cell-date="resolveCellDate(day, 'next')"
          :current-date="currentDate"
          :bookings="getBookingsForDay(day, 'next')"
          :hidden-count="getHiddenBookingCount(day, 'next')"
          :selected-rooms="selectedRooms"
          @visible-change="(visible) => onCellPopoverVisible(dayCellKey(day, 'next'), visible)"
        />
      </div>
    </div>

    <!-- 隐藏：测量单条 / +N 底栏真实高度（随 zoom、断点变化） -->
    <div class="month-layout-probes" aria-hidden="true">
      <div ref="measureBarRef" class="month-event-bar">
        <span class="month-event-text">00:00 Measure</span>
      </div>
      <div ref="measureMoreRef" class="month-more-footer">+9</div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import CalendarBookingPopover from './CalendarBookingPopover.vue'
import MonthDayMorePopover from './MonthDayMorePopover.vue'
import {
  isSameCalendarDay,
  getCalendarBookingBlockStyle,
  formatDateISO,
  getHtmlZoomScale,
  sortVenueCalendarBookings
} from '@/utils/venueCalendarApi'

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

const emit = defineEmits(['day-click'])

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const monthGridRef = ref(null)
const measureBarRef = ref(null)
const measureMoreRef = ref(null)
/** 每格可见条数（DOM 实测后写入，key = dayCellKey） */
const dayLayoutMap = ref(new Map())
const layoutEpoch = ref(0)
/** 月历网格单行高度（由容器均分，保证各行等高） */
const monthGridRowHeightPx = ref(0)
/** 14" zoom + teleported=false：当前打开气泡的格子，用于抬高 z-index */
const openPopoverCellKey = ref(null)
let gridResizeObserver = null
let layoutRafId = null

function onCellPopoverVisible (cellKey, visible) {
  if (visible) {
    openPopoverCellKey.value = cellKey
    return
  }
  if (openPopoverCellKey.value === cellKey) {
    openPopoverCellKey.value = null
  }
}

const GRID_ROW_GAP_PX = 1
const LAYOUT_SLACK_PX = 2
const MIN_CELL_ROW_HEIGHT_REM = 5.5
const EMPTY_DAY_LAYOUT = { visibleCount: 0, hiddenCount: 0 }

function getMinCellRowHeightPx () {
  return Math.ceil(remPx(MIN_CELL_ROW_HEIGHT_REM))
}

function remPx (multiplier = 1) {
  if (typeof document === 'undefined') return 16 * multiplier
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize)
  return (Number.isFinite(root) ? root : 16) * multiplier
}

/**
 * 统一用「布局像素」量高：html zoom:0.8 下 getBoundingClientRect 是视口像素，
 * 而 offsetHeight / CSS px / padding 是布局像素；混用会导致 14" 断点折叠条数算错。
 */
function layoutHeightPx (el) {
  if (!el) return 0
  const offsetH = el.offsetHeight
  if (offsetH > 0) return offsetH
  const zoom = getHtmlZoomScale()
  const visualH = el.getBoundingClientRect().height
  if (visualH > 0) return visualH / (zoom > 0 ? zoom : 1)
  return 0
}

function formatMonthEventTime(startTime) {
  if (!startTime) return ''
  const parts = String(startTime).split(':')
  const h = parseInt(parts[0], 10)
  const m = parts[1] ?? '00'
  if (Number.isNaN(h)) return startTime
  return `${h}:${m}`
}

function formatMonthEventLabel(booking) {
  const time = formatMonthEventTime(booking.startTime)
  const room = String(booking.roomName || '').trim()
  return room ? `${time}：${room}` : time
}

function getMonthEventStyle (booking) {
  return getCalendarBookingBlockStyle(booking, {}, props.selectedRooms)
}

function dayCellKey (day, segment = 'current') {
  return `${segment}-${day}`
}

function stackBarsHeight (n, barPx, gapPx) {
  if (n <= 0) return 0
  return n * barPx + (n - 1) * gapPx
}

function measureEventBarPx () {
  const probe = measureBarRef.value
  if (probe) {
    const h = layoutHeightPx(probe)
    if (h > 0) return Math.ceil(h)
  }
  const live = monthGridRef.value?.querySelector('.month-event-bar')
  if (live) {
    const h = layoutHeightPx(live)
    if (h > 0) return Math.ceil(h)
  }
  return Math.ceil(remPx(1.35))
}

/** 列表 flex 子项高度（含 el-popover 包裹），比单纯 bar 更接近真实占位 */
function measureEventItemPx () {
  const listEl = monthGridRef.value?.querySelector('.month-booking-list')
  const item = listEl?.querySelector(':scope > *')
  if (item) {
    const h = item.offsetHeight || layoutHeightPx(item)
    if (h > 0) return Math.ceil(h)
  }
  return measureEventBarPx()
}

function measureMoreFooterPx () {
  const probe = measureMoreRef.value
  if (probe) {
    const h = layoutHeightPx(probe)
    if (h > 0) return Math.ceil(h)
  }
  return Math.ceil(remPx(1.375))
}

function measureListGapPx () {
  const listEl = monthGridRef.value?.querySelector('.month-booking-list')
  if (listEl) {
    const gap = parseFloat(getComputedStyle(listEl).gap)
    if (Number.isFinite(gap) && gap >= 0) return gap
  }
  return 4
}

function getMoreFooterReservePx () {
  return 2 + measureMoreFooterPx() + 2
}

function measureCellRowHeightPx (grid) {
  const cell = grid?.querySelector('.date-cell')
  if (!cell) return 0
  const h = cell.clientHeight || layoutHeightPx(cell)
  return h > 0 ? Math.floor(h) : 0
}

function getMetricsCellEl (grid) {
  if (!grid) return null
  return (
    grid.querySelector('.date-cell.has-bookings:not(.has-more-trigger)') ||
    grid.querySelector('.date-cell.has-bookings') ||
    grid.querySelector('.date-cell')
  )
}

function getCellPaddingAndGap (cellEl, metricsCellEl) {
  const source = metricsCellEl || cellEl
  const cs = source ? getComputedStyle(source) : null
  return {
    pad: cs
      ? (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)
      : remPx(0.5) * 2,
    rowGap: cs
      ? (parseFloat(cs.rowGap) || parseFloat(cs.gap) || 0)
      : 4
  }
}

/** 公式：用格子真实 clientHeight 减 header / padding，避免 list 被内容撑高后高估 */
function measureListAreaPx (cellEl, reserveMoreFooter, rowHeightPx, metricsCellEl = null) {
  const cellH = (cellEl?.clientHeight || layoutHeightPx(cellEl) || rowHeightPx || 0)
  if (cellH < 12) return 0

  const headerEl = cellEl?.querySelector('.date-cell-header')
  const dateEl = cellEl?.querySelector('.date-number')
  const headerH = headerEl
    ? headerEl.offsetHeight
    : (dateEl ? dateEl.offsetHeight : Math.ceil(remPx(1)))

  const { pad, rowGap } = getCellPaddingAndGap(cellEl, metricsCellEl)
  const moreBlock = reserveMoreFooter ? getMoreFooterReservePx() : 0

  return Math.max(0, cellH - pad - headerH - rowGap - moreBlock)
}

/**
 * 列表可用高度：公式与 DOM clientHeight 取更小值。
 * 14" html zoom 下若只信 list offset/scroll，容易把「被内容撑开的高度」当成可用高度，导致不折叠。
 */
function getListAreasForCell (cellEl, rowHeightPx, metricsCellEl) {
  const footerReserve = getMoreFooterReservePx()
  const formulaNoMore = measureListAreaPx(cellEl, false, rowHeightPx, metricsCellEl)
  const listEl = cellEl?.querySelector('.month-booking-list')
  const listClient = listEl ? (listEl.clientHeight || 0) : 0
  const listOverflows = listEl
    ? listEl.scrollHeight > listEl.clientHeight + LAYOUT_SLACK_PX
    : false

  let listNoMore = formulaNoMore

  if (listClient > 0) {
    if (cellEl?.classList.contains('has-more-trigger')) {
      // 当前已给 +N 留位：clientHeight 是「有底栏」时的列表高度
      const restored = listClient + footerReserve
      listNoMore = formulaNoMore > 0 ? Math.min(formulaNoMore, restored) : restored
    } else if (listOverflows) {
      // 已溢出：clientHeight 可信，是约束后的真实列表区
      listNoMore = formulaNoMore > 0 ? Math.min(formulaNoMore, listClient) : listClient
    } else if (formulaNoMore > 0) {
      // 未溢出时 listClient 可能≈内容高度（被撑开），绝不能单独采信
      listNoMore = Math.min(formulaNoMore, listClient)
      // 若 listClient 明显大于公式（被撑开），完全改用公式
      if (listClient > formulaNoMore + LAYOUT_SLACK_PX) {
        listNoMore = formulaNoMore
      }
    }
  }

  if (listNoMore <= 0) {
    listNoMore = formulaNoMore
  }

  return {
    listNoMore: Math.max(0, listNoMore),
    listWithMore: Math.max(0, listNoMore - footerReserve)
  }
}

function updateUniformRowHeight () {
  const grid = monthGridRef.value
  if (!grid) return false

  const minRowHeight = getMinCellRowHeightPx()
  const rowCount = gridRows.value
  const gapTotal = Math.max(0, rowCount - 1) * GRID_ROW_GAP_PX

  // 优先用容器布局高度均分（布局像素，不受 html zoom 视口缩放干扰）
  const gridH = layoutHeightPx(grid)
  const available = gridH - gapTotal
  let next = 0
  if (available >= rowCount * minRowHeight) {
    next = Math.floor(available / rowCount)
  } else {
    // 总高度不够：以实际格子布局高度为准，否则回退到最小格高
    const fromCell = measureCellRowHeightPx(grid)
    next = fromCell >= 12 ? fromCell : minRowHeight
  }

  next = Math.max(minRowHeight, next)
  if (next < 1) return false

  const changed = next !== monthGridRowHeightPx.value
  monthGridRowHeightPx.value = next
  return changed || layoutEpoch.value === 0
}

function maxBarsInArea (areaPx, barPx, gapPx) {
  if (areaPx < barPx) return 0
  return Math.floor((areaPx + gapPx) / (barPx + gapPx))
}

function computeLayoutFromListAreas (total, listNoMore, listWithMore, barPx, gapPx) {
  if (total <= 0) return EMPTY_DAY_LAYOUT

  const stack = (n) => stackBarsHeight(n, barPx, gapPx)
  if (stack(total) <= listNoMore + LAYOUT_SLACK_PX) {
    return { visibleCount: total, hiddenCount: 0 }
  }

  let visibleCount = maxBarsInArea(listWithMore, barPx, gapPx)
  visibleCount = Math.min(Math.max(visibleCount, 1), total - 1)

  return {
    visibleCount,
    hiddenCount: Math.max(0, total - visibleCount)
  }
}

function normalizeDayLayout (layout, total) {
  if (total <= 0) return EMPTY_DAY_LAYOUT
  let visibleCount = Math.min(Math.max(layout?.visibleCount ?? 0, 0), total)
  if (visibleCount <= 0) visibleCount = Math.min(total, 1)
  return {
    visibleCount,
    hiddenCount: Math.max(0, total - visibleCount)
  }
}

function layoutMapSignature (map) {
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v.visibleCount}/${v.hiddenCount}`)
    .join('|')
}

/** 读取网格中任意一格的 DOM（仅用于量 padding / 日期行，不用其撑开后的高度） */
function getReferenceCellEl () {
  const grid = monthGridRef.value
  if (!grid) return null
  return (
    grid.querySelector('.date-cell.is-public-holiday') ||
    grid.querySelector('.date-cell.has-bookings') ||
    grid.querySelector('.date-cell')
  )
}

function recalculateDayLayoutsOnce () {
  const grid = monthGridRef.value
  if (!grid) return false

  const rowHeight = monthGridRowHeightPx.value
  if (rowHeight < 12) return false

  const gridH = layoutHeightPx(grid)
  if (gridH < gridRows.value * 12) return false

  const barPx = measureEventItemPx()
  const gapPx = measureListGapPx()
  const refCell = getReferenceCellEl()
  const metricsCell = getMetricsCellEl(grid)
  const newMap = new Map()

  for (const cell of monthCellsInGridOrder.value) {
    const key = dayCellKey(cell.day, cell.segment)
    const total = getBookingsForDay(cell.day, cell.segment).length
    if (total <= 0) {
      newMap.set(key, EMPTY_DAY_LAYOUT)
      continue
    }

    const el = grid.querySelector(`[data-cell-key="${key}"]`) || refCell
    const { listNoMore, listWithMore } = getListAreasForCell(el, rowHeight, metricsCell)
    let layout = normalizeDayLayout(
      computeLayoutFromListAreas(total, listNoMore, listWithMore, barPx, gapPx),
      total
    )

    // 二次校验：公式说全放下，但列表仍溢出 → 强制折叠
    const listEl = el?.querySelector?.('.month-booking-list')
    if (
      layout.hiddenCount === 0 &&
      total > 1 &&
      listEl &&
      listEl.scrollHeight > listEl.clientHeight + LAYOUT_SLACK_PX
    ) {
      layout = normalizeDayLayout(
        computeLayoutFromListAreas(
          total,
          listEl.clientHeight,
          Math.max(0, listEl.clientHeight - getMoreFooterReservePx()),
          barPx,
          gapPx
        ),
        total
      )
    }

    newMap.set(key, layout)
  }

  dayLayoutMap.value = newMap
  layoutEpoch.value += 1
  return true
}

async function runLayoutRecalcStable () {
  let lastSig = ''

  for (let pass = 0; pass < 6; pass++) {
    await nextTick()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    updateUniformRowHeight()
    if (monthGridRowHeightPx.value < 12) continue
    if (!recalculateDayLayoutsOnce()) continue

    const sig = layoutMapSignature(dayLayoutMap.value)
    if (sig && sig === lastSig) break
    lastSig = sig
  }
}

function scheduleLayoutRecalc () {
  if (layoutRafId != null) cancelAnimationFrame(layoutRafId)
  layoutRafId = requestAnimationFrame(() => {
    layoutRafId = null
    void runLayoutRecalcStable()
  })
}

// 当前月份的天数
const daysInMonth = computed(() => {
  const date = new Date(props.currentDate)
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
})

// 当前月份开始日期的星期几
const firstDayOfMonth = computed(() => {
  const date = new Date(props.currentDate)
  return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
})

// 上个月需要显示的天数
const prevMonthDays = computed(() => {
  const days = []
  const date = new Date(props.currentDate)
  const prevMonthLastDay = new Date(date.getFullYear(), date.getMonth(), 0).getDate()
  for (let i = firstDayOfMonth.value - 1; i >= 0; i--) {
    days.push(prevMonthLastDay - i)
  }
  return days
})

// 下个月需要显示的天数
const nextMonthDays = computed(() => {
  const days = []
  const totalCells = prevMonthDays.value.length + daysInMonth.value

  // 如果前面的天数加上当月天数已经占满5行（35格），则只补齐到35格
  // 否则补齐到42格（6行）
  const targetCells = totalCells <= 35 ? 35 : 42
  const remainingCells = targetCells - totalCells

  for (let i = 1; i <= remainingCells; i++) {
    days.push(i)
  }
  return days
})

// 计算需要显示的行数
const gridRows = computed(() => {
  const totalCells = prevMonthDays.value.length + daysInMonth.value + nextMonthDays.value
  return totalCells / 7 // 35格=5行，42格=6行
})

function resolveCellDate (day, segment = 'current') {
  const y = props.currentDate.getFullYear()
  const m = props.currentDate.getMonth()
  if (segment === 'prev') return new Date(y, m - 1, day)
  if (segment === 'next') return new Date(y, m + 1, day)
  return new Date(y, m, day)
}

function getHolidayLabel (day, segment = 'current') {
  const ymd = formatDateISO(resolveCellDate(day, segment))
  return props.publicHolidaysByDate[ymd] || ''
}

function isPublicHolidayCell (day, segment = 'current') {
  return Boolean(getHolidayLabel(day, segment))
}

function getBookingsForDay (day, segment = 'current') {
  const targetDate = resolveCellDate(day, segment)
  const dayBookings = props.bookings.filter(booking =>
    isSameCalendarDay(booking.date, targetDate)
  )

  if (!props.selectedRooms || props.selectedRooms.length === 0) {
    return []
  }

  const selectedRoomNames = props.selectedRooms.map(room => room.name)
  return sortVenueCalendarBookings(
    dayBookings.filter(booking => selectedRoomNames.includes(booking.roomName)),
    props.selectedRooms
  )
}

/** 与模板一致的 35/42 格顺序 */
const monthCellsInGridOrder = computed(() => {
  const cells = []
  for (const day of prevMonthDays.value) {
    cells.push({ day, segment: 'prev' })
  }
  for (let day = 1; day <= daysInMonth.value; day++) {
    cells.push({ day, segment: 'current' })
  }
  for (const day of nextMonthDays.value) {
    cells.push({ day, segment: 'next' })
  }
  return cells
})

/** 各行均分撑满；行高数值只用于 JS 折叠计算，避免把测量值写回 CSS 在 zoom 下反馈循环 */
const monthGridStyle = computed(() => ({
  gridTemplateRows: `repeat(${gridRows.value}, minmax(0, 1fr))`
}))

function getDayLayout (day, segment = 'current') {
  void layoutEpoch.value
  const key = dayCellKey(day, segment)
  const total = getBookingsForDay(day, segment).length
  if (total <= 0) return EMPTY_DAY_LAYOUT

  const cached = dayLayoutMap.value.get(key)
  if (cached) return normalizeDayLayout(cached, total)

  // 首帧保守：先最多显示 2 条并露出 +N，避免「先全量渲染 → 高度被撑开 → 误判不需折叠」
  const initialVisible = Math.min(total, 2)
  return normalizeDayLayout(
    { visibleCount: initialVisible, hiddenCount: Math.max(0, total - initialVisible) },
    total
  )
}

// 判断是否是今天
function isToday (day) {
  const target = resolveCellDate(day, 'current')
  return isSameCalendarDay(target, new Date())
}

function getVisibleBookings (day, segment = 'current') {
  const all = getBookingsForDay(day, segment)
  const { visibleCount } = getDayLayout(day, segment)
  return all.slice(0, visibleCount)
}

function getHiddenBookingCount (day, segment = 'current') {
  const total = getBookingsForDay(day, segment).length
  const { visibleCount } = getDayLayout(day, segment)
  return Math.max(0, total - Math.min(visibleCount, total))
}

function hasBookings (day, segment = 'current') {
  return getBookingsForDay(day, segment).length > 0
}

function selectDate (day, segment = 'current') {
  emit('day-click', resolveCellDate(day, segment))
}

function observeLayoutTargets () {
  if (!monthGridRef.value || typeof ResizeObserver === 'undefined') return
  gridResizeObserver?.disconnect()
  gridResizeObserver = new ResizeObserver(() => {
    scheduleLayoutRecalc()
  })
  const targets = new Set()
  const add = (el) => {
    if (el && !targets.has(el)) {
      targets.add(el)
      gridResizeObserver.observe(el)
    }
  }
  const root = monthGridRef.value.closest('.calendar-month')
  add(root)
  add(monthGridRef.value)
  add(monthGridRef.value.closest('.month-view'))
  add(monthGridRef.value.closest('.calendar-container'))
  add(monthGridRef.value.closest('.calendar-main'))
  add(monthGridRef.value.closest('.calendar-page'))
}

onMounted(() => {
  nextTick(() => {
    observeLayoutTargets()
    scheduleLayoutRecalc()
  })
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', scheduleLayoutRecalc)
  }
})

onUnmounted(() => {
  if (layoutRafId != null) cancelAnimationFrame(layoutRafId)
  layoutRafId = null
  gridResizeObserver?.disconnect()
  gridResizeObserver = null
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', scheduleLayoutRecalc)
  }
})

watch(
  () => [
    props.currentDate.getFullYear(),
    props.currentDate.getMonth(),
    gridRows.value,
    props.bookings,
    props.selectedRooms
  ],
  () => {
    monthGridRowHeightPx.value = 0
    dayLayoutMap.value = new Map()
    layoutEpoch.value = 0
    nextTick(() => {
      observeLayoutTargets()
      scheduleLayoutRecalc()
    })
  },
  { deep: true }
)
</script>

<style scoped>
.calendar-month {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;
}

.month-layout-probes {
  position: absolute;
  left: -9999px;
  top: 0;
  width: 140px;
  visibility: hidden;
  pointer-events: none;
  overflow: hidden;
}

.weekday-header {
  display: grid;
  /* minmax(0,1fr)：与月格对齐，避免内容/气泡撑破列宽 */
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 1px;
  margin-bottom: 0;
  background-color: #e5e7eb;
  border-radius: 0.5rem 0.5rem 0 0;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid #e5e7eb;
  border-bottom: none;
}

.weekday-cell {
  background-color: #f3f4f6;
  padding: 0.75rem;
  text-align: center;
  font-weight: 600;
  color: #374151;
  font-size: 0.875rem;
}

.weekday-cell.first-col {
  border-left: 1px solid #e5e7eb;
}

.weekday-cell.last-col {
  border-right: 1px solid #e5e7eb;
}

.month-grid {
  display: grid;
  /* 勿用纯 1fr（=minmax(auto,1fr)）：teleported=false 放开 overflow 后气泡会撑宽整列 */
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 1px;
  background-color: #e5e7eb;
  border-radius: 0 0 0.5rem 0.5rem;
  overflow: hidden;
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 1px solid #e5e7eb;
  border-top: none;
  align-content: stretch;
}

.date-cell {
  --cell-pad: 0.5rem;
  --month-more-slot: 1.375rem;
  background-color: white;
  padding: var(--cell-pad);
  cursor: pointer;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow: hidden;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  height: 100%;
  min-height: 0;
  max-height: 100%;
  position: relative;
  z-index: 0; /* 形成独立层叠上下文，避免他格 +N 的 z-index 穿透当前气泡 */
  box-sizing: border-box;
  align-self: stretch;
}

.date-cell.has-bookings {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.25rem;
  align-content: stretch;
}

.date-cell.has-bookings.has-more-trigger {
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 2px 0;
  padding-bottom: 0.25rem;
}

.date-cell-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex-shrink: 0;
}

.date-cell.has-bookings .date-cell-header {
  grid-row: 1;
  min-height: 0;
}

.date-cell:not(.has-bookings) .date-cell-header {
  flex: 1;
  min-height: 0;
}

.date-cell:hover {
  background-color: #f9fafb;
  box-shadow: inset 0 0 0 1px #3b82f6;
}

.date-cell.empty {
  background-color: #f9fafb;
  color: #d1d5db;
  cursor: default;
}

.date-cell.empty:hover {
  background-color: #f9fafb;
  box-shadow: none;
}

.date-cell.today {
  background-color: #fffbeb;
}

.date-cell.is-public-holiday {
  background-color: #fef2f2;
}

.date-cell.is-public-holiday:hover {
  background-color: #fee2e2;
  box-shadow: inset 0 0 0 1px #fca5a5;
}

.date-cell.is-public-holiday.today {
  background-color: #fef2f2;
}

.holiday-label {
  font-size: 0.625rem;
  line-height: 1.2;
  font-weight: 600;
  color: #b91c1c;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
  min-width: 0;
}

.date-cell.has-bookings.has-holiday-label .holiday-label {
  -webkit-line-clamp: 1;
  line-clamp: 1;
  font-size: 0.5625rem;
  line-height: 1.15;
}

.date-cell:not(.has-bookings) .holiday-label {
  margin-top: 1.15rem;
}

.date-cell.first-col {
  border-left: 1px solid #e5e7eb;
}

.date-cell.last-col {
  border-right: 1px solid #e5e7eb;
}

/*
 * 14" html zoom:0.8 时 popover teleported=false，气泡留在日期格 DOM 内；
 * 同排/下一排格子默认按文档序叠在上面，需抬高当前格并放开网格 overflow。
 */
@media screen and (min-width: 1100px) and (max-width: 1599px) {
  .month-grid:has(.date-cell.is-popover-open) {
    overflow: visible;
  }

  .date-cell.is-popover-open {
    overflow: visible;
    z-index: 80;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    /* 锁住格子行内尺寸，避免 teleported=false 的 +N 气泡把格子/条带/+N 撑宽 */
    contain: inline-size;
  }

  .date-cell.is-popover-open .month-booking-list {
    overflow: visible;
    max-width: 100%;
    min-width: 0;
  }

  .date-cell.is-popover-open .month-more-root {
    max-width: 100%;
    min-width: 0;
  }

  .date-cell.is-popover-open :deep(.el-popper) {
    position: absolute !important;
    z-index: 100 !important;
  }
}

.date-number {
  font-weight: 600;
  color: #111827;
  font-size: 1rem;
  line-height: 1.1;
  flex-shrink: 0;
}

.date-cell.empty .date-number {
  color: #d1d5db;
}

.month-booking-list {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
  flex: 1 1 0;
  width: 100%;
  overflow: hidden;
  padding-right: 2px;
  grid-row: 2;
}

.date-cell.has-more-trigger .month-more-root {
  grid-row: 3;
  flex-shrink: 0;
}

.month-event-bar {
  flex-shrink: 0;
  width: 100%;
  border-radius: 3px;
  border-left-width: 4px;
  border-left-style: solid;
  /* 色条颜色与背景由 getMonthEventStyle 内联设置 */
  padding: 3px 6px 3px 7px;
  box-sizing: border-box;
  min-height: 1.35rem;
  display: flex;
  align-items: center;
  cursor: default;
}

.month-event-text {
  font-size: 0.6875rem;
  font-weight: 500;
  color: #111827;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.month-event-bar.is-blocked .month-event-text {
  color: #dc2626;
}

@media (max-width: 389px) {
  .date-cell {
    --cell-pad: 0.5rem;
    padding: var(--cell-pad);
  }

  .date-number {
    font-size: 0.875rem;
  }

  .month-event-text {
    font-size: 0.625rem;
  }

}

@media (min-width: 390px) and (max-width: 767px) {
  .date-cell {
    --cell-pad: 0.5rem;
    padding: var(--cell-pad);
  }

  .date-number {
    font-size: 0.875rem;
  }

  .month-event-text {
    font-size: 0.625rem;
  }

}

@media (min-width: 768px) and (max-width: 1099px) {}

@media (min-width: 1100px) and (max-width: 1599px) {}

@media (min-width: 1600px) and (max-width: 2239px) {}

@media (min-width: 2240px) {}
</style>
