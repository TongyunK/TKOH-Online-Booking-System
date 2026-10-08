<template>
  <!-- 视口铺满；内部固定 1920×1080 设计稿，整体 transform 等比缩放并居中 -->
  <div ref="displayViewport" class="ev-display-viewport">
    <div ref="displayRoot" class="ev-display-root">
      <div class="ev-display-stage">
        <div class="top-date-bar">
          <span class="top-date-text">{{ currentDateLabel }}</span>
        </div>

        <div class="main-board">
          <div class="board-content" :style="boardContentStyle">
            <div class="board-header">
              <div class="board-title-line">
                <span class="board-title-en">Today's Reservation</span>
                <span class="board-title-zh">今日預約車牌</span>
              </div>
              <div class="board-subtitle-line">
                <span class="board-subtitle-en">EV Charging Station</span>
                <span class="board-subtitle-zh">電動車叉電位</span>
              </div>
            </div>

            <div class="current-time">{{ currentTimeLabel }}</div>

            <div
              v-for="(period, index) in timePeriods"
              :key="period.period"
              class="period-card"
              :style="{ gridRow: index + 3 }"
            >
              <div class="period-label-line">
                <span class="period-name">{{ period.period }}</span>
                <sup class="period-name-zh">{{ periodZhMap[period.period] }}</sup>
              </div>
              <div class="period-range">{{ period.startTime }}-{{ period.endTime }}</div>
            </div>

            <div class="right-grid-panel">
              <div class="space-header-row">
                <div v-for="space in spaces" :key="space" class="space-header-cell">
                  <span class="space-name">{{ space }}</span>
                  <img class="space-icon" :src="evDisplayIcon" alt="" aria-hidden="true">
                </div>
              </div>

              <div
                v-for="period in timePeriods"
                :key="`row-${period.period}`"
                class="plate-row"
              >
                <div
                  v-for="space in spaces"
                  :key="`${period.period}-${space}`"
                  class="plate-cell"
                >
                  <span class="plate-text">{{ getPlate(period.period, space) }}</span>
                </div>
              </div>
            </div>
          </div>

          <div ref="tickerContainerRef" class="ev-footer-ticker" :class="{ 'ticker-static': !tickerScroll }">
            <div class="ticker-track" :class="{ 'is-scrolling': tickerScroll }">
              <span ref="tickerMeasureRef" class="ticker-text">{{ footerTickerDisplayText }}</span>
              <span v-if="tickerScroll" class="ticker-text" aria-hidden="true">{{ footerTickerDisplayText }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <DisplayFullscreenHint />
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getEvPublicDisplayData } from '@/api/evManagement'
import { useDisplayLiveRefresh, useDisplayDataPollTimer } from '@/composables/useDisplayLiveRefresh'
import DisplayFullscreenHint from '@/components/display/DisplayFullscreenHint.vue'
import evDisplayIcon from '@/assets/EVDisplay_icon.svg'
import {
  getAppDisplayDateTimeParts,
  msUntilNextAppMinute,
  todayYmdInAppTimeZone
} from '@/utils/appTimezone'
import { pickRouteQueryDate } from '@/utils/routeQuery'
import { measureDisplayViewport } from '@/utils/displayFullscreenScale'
import { resetDisplayReady, signalDisplayReady } from '@/utils/displayReadySignal'

const route = useRoute()
let adaptRetryCount = 0

function resolveDisplayDate () {
  return pickRouteQueryDate(route.query, 'date', 'Date') || todayYmdInAppTimeZone()
}

const DEFAULT_FOOTER_TICKER = '請依照已預約之時段及車位泊車，並於離場前移走車輛。'

const periodZhMap = {
  AM: '上午',
  PM: '下午',
  Night: '晚上'
}

const bookings = ref([])
const parkingSpaces = ref([])
const timePeriods = ref([])
const currentDateLabel = ref('')
const currentTimeLabel = ref('')
const footerTickerText = ref('')
const footerTickerDisplayText = computed(() => footerTickerText.value || DEFAULT_FOOTER_TICKER)
const tickerScroll = ref(false)
const tickerContainerRef = ref(null)
const tickerMeasureRef = ref(null)
const displayViewport = ref(null)
const displayRoot = ref(null)

/** 固定设计稿；任意分辨率用同一比例整体缩放，保证观感一致 */
const BASE_WIDTH = 1920
const BASE_HEIGHT = 1080

const spaces = computed(() =>
  parkingSpaces.value
    .map((slot) => String(slot?.evSpace || '').trim())
    .filter(Boolean)
)

const boardRowCount = computed(() => Math.max(timePeriods.value.length, 1) + 1)

const boardContentStyle = computed(() => ({
  '--space-count': String(Math.max(spaces.value.length, 1)),
  '--board-rows': String(boardRowCount.value),
  /* 首行给右侧标题，其后为时间/车位表头 + 各时段行 */
  gridTemplateRows: `auto repeat(${boardRowCount.value}, minmax(0, 1fr))`
}))

function normalizeParkingSlots (rows) {
  if (!Array.isArray(rows)) return []
  return rows
    .map((row) => {
      if (typeof row === 'string') {
        const evSpace = row.trim()
        return evSpace ? { evSpace } : null
      }
      const evSpace = String(row?.evSpace || '').trim()
      return evSpace ? { evSpace } : null
    })
    .filter(Boolean)
}

let lastDisplayYmd = ''

function mapDisplayBooking (item) {
  return {
    ...item,
    period: item.period || String(item.time || '').split(' ')[0]
  }
}

async function refreshDisplayData () {
  const date = resolveDisplayDate()
  const data = await getEvPublicDisplayData(date)
  dataPoll.applyFromPayload(data?.dataPollIntervalMs)
  footerTickerText.value = data?.evDisplaySettings?.footerTickerText || ''
  timePeriods.value = Array.isArray(data?.timePeriods) ? data.timePeriods : []
  parkingSpaces.value = normalizeParkingSlots(data?.parkingSlots)
  bookings.value = (Array.isArray(data?.bookings) ? data.bookings : []).map(mapDisplayBooking)
  lastDisplayYmd = date
  await nextTick()
  syncTickerScrollMode()
  signalDisplayReady()
}

function updateDateTime () {
  const parts = getAppDisplayDateTimeParts()
  currentDateLabel.value = `${parts.day}/${parts.month}/${parts.year} ${parts.weekdayEn} ${parts.weekdayZh}`
  currentTimeLabel.value = `${parts.hour}:${parts.minute}`

  // Only auto-roll to next business day when URL did not pin a date.
  if (
    !pickRouteQueryDate(route.query, 'date', 'Date') &&
    lastDisplayYmd &&
    parts.ymd !== lastDisplayYmd
  ) {
    void refreshDisplayData()
  }
}

function syncTickerScrollMode () {
  requestAnimationFrame(() => {
    const container = tickerContainerRef.value
    const textEl = tickerMeasureRef.value
    if (!container || !textEl) return
    tickerScroll.value = textEl.scrollWidth > container.clientWidth
  })
}

let tickerResizeObserver = null

function setupTickerResizeObserver () {
  const container = tickerContainerRef.value
  if (!container || typeof ResizeObserver === 'undefined') return
  tickerResizeObserver?.disconnect()
  tickerResizeObserver = new ResizeObserver(() => syncTickerScrollMode())
  tickerResizeObserver.observe(container)
}

let clockTimer = null
let dataPollInFlight = false

function scheduleClockTick () {
  clockTimer = setTimeout(() => {
    updateDateTime()
    scheduleClockTick()
  }, msUntilNextAppMinute())
}

function stopClock () {
  if (clockTimer) {
    clearTimeout(clockTimer)
    clockTimer = null
  }
}

function startClock () {
  stopClock()
  updateDateTime()
  scheduleClockTick()
}

async function pollDisplayDataFromServer () {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return
  }
  if (dataPollInFlight) return
  dataPollInFlight = true
  try {
    await refreshDisplayData()
  } catch {
    /* 保留上一屏数据，下一轮轮询重试 */
  } finally {
    dataPollInFlight = false
  }
}

const dataPoll = useDisplayDataPollTimer(pollDisplayDataFromServer)

function onDocumentVisibilityChange () {
  if (document.visibilityState === 'visible') {
    startClock()
    void pollDisplayDataFromServer()
  }
}

useDisplayLiveRefresh(['ev'], pollDisplayDataFromServer)

watch(
  () => route.query,
  () => {
    void pollDisplayDataFromServer()
  },
  { deep: true }
)

function getPlate (period, space) {
  const matched = bookings.value.find(item =>
    item.status !== 'cancelled' &&
    item.period === period &&
    item.space === space
  )
  return matched?.licensePlate || '-'
}

/** 设计稿等比缩放并居中；比例不同时留同色边条，不拉伸变形 */
function adaptFullscreen () {
  const root = displayRoot.value
  if (!root) return

  const measured = measureDisplayViewport(BASE_WIDTH, BASE_HEIGHT)
  if (!measured.ok) {
    if (adaptRetryCount < 90) {
      adaptRetryCount += 1
      requestAnimationFrame(adaptFullscreen)
    }
    return
  }
  adaptRetryCount = 0

  root.style.width = `${BASE_WIDTH}px`
  root.style.height = `${BASE_HEIGHT}px`
  root.style.transform = `scale(${measured.scale})`
  root.style.transformOrigin = 'top left'
  root.style.left = `${measured.offsetX}px`
  root.style.top = `${measured.offsetY}px`

  syncTickerScrollMode()
}

watch(footerTickerDisplayText, () => {
  nextTick(() => syncTickerScrollMode())
})

onMounted(() => {
  resetDisplayReady()
  document.documentElement.classList.add('ev-display-fullscreen')
  // 与 Merge 一致：先立刻等比缩放，再异步拉数（避免云端接口慢时一直停在旧的铺满布局）
  adaptFullscreen()
  window.addEventListener('resize', adaptFullscreen)
  window.visualViewport?.addEventListener('resize', adaptFullscreen)
  void refreshDisplayData()
    .catch(() => {
      footerTickerText.value = ''
      timePeriods.value = []
      parkingSpaces.value = []
      bookings.value = []
      lastDisplayYmd = todayYmdInAppTimeZone()
    })
    .finally(() => {
      nextTick(() => {
        adaptFullscreen()
        syncTickerScrollMode()
        signalDisplayReady()
      })
    })
  startClock()
  dataPoll.start()
  document.addEventListener('visibilitychange', onDocumentVisibilityChange)
  nextTick(() => {
    adaptFullscreen()
    syncTickerScrollMode()
    setupTickerResizeObserver()
  })
  const viewport = document.querySelector('meta[name="viewport"]')
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
  }
})

onUnmounted(() => {
  document.documentElement.classList.remove('ev-display-fullscreen')
  stopClock()
  tickerResizeObserver?.disconnect()
  dataPoll.stop()
  document.removeEventListener('visibilitychange', onDocumentVisibilityChange)
  window.removeEventListener('resize', adaptFullscreen)
  window.visualViewport?.removeEventListener('resize', adaptFullscreen)
})
</script>

<style>
html.ev-display-fullscreen {
  zoom: 1 !important;
}

html.ev-display-fullscreen #app {
  width: 100% !important;
  height: 100% !important;
  min-height: 100vh !important;
  max-width: none !important;
  margin: 0 !important;
  background-color: transparent !important;
  overflow: hidden !important;
}
</style>

<style scoped>
:global(html),
:global(body) {
  margin: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.ev-display-viewport {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #111111;
  user-select: none;
  touch-action: none;
}

.ev-display-root {
  position: absolute;
  top: 0;
  left: 0;
  width: 1920px;
  height: 1080px;
  overflow: hidden;
  background: #8fce4c;
  color: #ffffff;
  font-family: var(--display-font-family);
  transform-origin: top left;
}

.ev-display-root,
.ev-display-root * {
  font-family: var(--display-font-family);
}

.ev-display-stage {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.top-date-bar {
  /* 与底部提示条等高 */
  height: 88px;
  min-height: 88px;
  background: #8fce4c;
  padding: 0 24px;
  font-size: 52px;
  line-height: 1;
  font-weight: 700;
  color: #f3ffe2;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  box-sizing: border-box;
}

.top-date-text {
  display: inline-block;
  letter-spacing: 0.6px;
}

.main-board {
  margin: 0;
  width: 100%;
  flex: 1;
  min-height: 0;
  display: grid;
  /* 主表（含右侧居中标题） / 底栏 */
  grid-template-rows: minmax(0, 1fr) auto;
  background: #08b145;
  padding: 0 24px;
  box-sizing: border-box;
}

.board-header {
  grid-column: 2;
  grid-row: 1;
  min-height: 0;
  height: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 10px;
  padding: 10px 0 20px;
  box-sizing: border-box;
  text-align: center;
}

.board-title-line,
.board-subtitle-line {
  display: flex;
  align-items: baseline;
  justify-content: center;
  flex-wrap: wrap;
  gap: 18px;
  text-align: center;
  width: 100%;
}

.board-title-en {
  font-size: 68px;
  line-height: 1.05;
  font-weight: 700;
  letter-spacing: 0.6px;
}

.board-title-zh {
  font-size: 66px;
  line-height: 1.05;
  font-weight: 800;
}

.board-subtitle-en,
.board-subtitle-zh {
  font-size: 46px;
  line-height: 1.05;
  font-weight: 400;
}

.board-content {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  column-gap: 4px;
  min-height: 0;
  align-items: stretch;
  margin-top: 12px;
  margin-bottom: 12px;
}

.current-time {
  grid-column: 1;
  grid-row: 2;
  font-size: 112px;
  color: #ffd84f;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  padding-left: 4px;
  padding-right: 8px;
  box-sizing: border-box;
}

.period-card {
  grid-column: 1;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  padding-left: 4px;
  padding-right: 8px;
  box-sizing: border-box;
  min-height: 0;
}

.period-label-line {
  display: flex;
  align-items: baseline;
  gap: 10px;
  white-space: nowrap;
}

.period-name {
  font-size: 52px;
  line-height: 1;
  font-weight: 600;
}

.period-name-zh {
  font-size: 50px;
  line-height: 0;
  font-weight: 600;
  flex-shrink: 0;
  vertical-align: super;
}

.period-range {
  font-size: 52px;
  line-height: 1.1;
  font-weight: 600;
  white-space: nowrap;
}

.right-grid-panel {
  grid-column: 2;
  grid-row: 2 / -1;
  display: grid;
  grid-template-rows: subgrid;
  border: 6px solid #9ccf62;
  border-radius: 120px;
  padding: 8px 20px;
  min-height: 0;
  box-sizing: border-box;
  container-type: inline-size;
  container-name: ev-plate-grid;
}

@supports not (grid-template-rows: subgrid) {
  .right-grid-panel {
    grid-template-rows: repeat(var(--board-rows, 4), minmax(0, 1fr));
  }
}

.space-header-row,
.plate-row {
  display: grid;
  grid-template-columns: repeat(var(--space-count, 3), minmax(0, 1fr));
  column-gap: 16px;
  min-height: 0;
  min-width: 0;
  align-items: center;
  justify-items: center;
}

.plate-row {
  container-type: size;
}

.space-header-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  color: #ffffff;
  font-weight: 800;
  white-space: nowrap;
  min-width: 0;
  width: 100%;
}

.space-name {
  font-size: 112px;
  line-height: 1;
  font-weight: 700;
}

.space-icon {
  width: 108px;
  height: 108px;
  object-fit: contain;
  flex: 0 0 auto;
}

.plate-cell {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-inline: 4px;
  box-sizing: border-box;
  color: #ffff00;
  /*
   * 先给固定回退字号：部分大屏 WebView 不支持 cqw/cqh 时，
   * 原先 min(80px, 100cqw…) 整段失效，会落到极小的继承字号。
   */
  font-size: 100px;
  font-weight: 800;
  line-height: 1;
}

@supports (width: 1cqw) {
  .plate-cell {
    /* 列宽/行高自适应；上限抬高，避免相对 B1/B2 标题过小 */
    font-size: min(
      140px,
      calc(
        (
          100cqw
          - 16px * (var(--space-count, 3) - 1)
          - 24px
        )
        / var(--space-count, 3)
        / 4.8
      ),
      72cqh
    );
  }
}

.plate-text {
  display: block;
  max-width: 100%;
  overflow: visible;
  white-space: nowrap;
  text-align: center;
  letter-spacing: 0.02em;
  text-shadow:
    0 2px 0 rgba(106, 120, 22, 0.65),
    0 0 2px rgba(106, 120, 22, 0.4);
}

.ev-footer-ticker {
  /* 与顶部日期栏等高；上边距略收，配合上方把间距让给标题与方框 */
  height: 88px;
  min-height: 88px;
  margin: 16px -24px 0;
  background: #8fce4c;
  color: #111111;
  font-size: 52px;
  line-height: 1.2;
  font-weight: 700;
  overflow: hidden;
  white-space: nowrap;
  padding: 0 24px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
}

.ev-footer-ticker.ticker-static {
  justify-content: center;
}

.ticker-track {
  display: inline-flex;
  width: max-content;
}

.ticker-track.is-scrolling {
  animation: evTickerScroll 24s linear infinite;
}

.ticker-text {
  display: inline-block;
}

.ticker-track.is-scrolling .ticker-text:first-child {
  padding-right: 48px;
}

@keyframes evTickerScroll {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}
</style>
