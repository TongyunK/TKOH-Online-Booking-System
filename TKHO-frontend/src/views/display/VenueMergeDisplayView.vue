<template>
  <!-- 视口铺满；内部固定 1920×1080 设计稿，整体 transform 等比缩放并居中 -->
  <div ref="displayViewport" class="merge-display-viewport">
    <div ref="displayRoot" class="merge-display-root">
      <div class="top-date-bar">
        <!-- 与下方 time-line 同列居中，日期左缘对齐大时钟左缘 -->
        <div class="top-date-align">
          <div class="top-date-cluster">
            <span class="top-date-time-ghost" aria-hidden="true">{{ currentTime }}</span>
            <div class="top-date-text">
              <span>{{ currentDate }}</span>
              <span class="weekday-zh">{{ currentWeekdayZh }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="main-panel">
        <img
          class="panel-qr"
          :src="qrCodeImage"
          alt=""
          width="110"
          height="110"
          decoding="async"
        />
        <div class="panel-top-row">
          <div class="time-line">{{ currentTime }}</div>
          <div class="panel-header">
            <div class="panel-title-wrap">
              <div class="panel-title-line" v-html="panelTitleHtml"></div>
            </div>
          </div>
        </div>

        <div class="schedule-header">
          <div class="slot-col room-col"></div>
          <div class="slot-col">AM<sup>上午</sup></div>
          <div class="slot-col pm-col">PM<sup>下午</sup></div>
        </div>

        <div class="schedule-body">
          <div v-for="row in visibleScheduleRows" :key="row.id" class="schedule-row" :data-row-id="row.id">
            <div class="room-col room-name">
              <span class="room-name-text">{{ row.room }}</span>
              <span class="room-indicator" :style="getArrowStyle(row.arrowDirection)" aria-hidden="true">➜</span>
            </div>
            <div class="slot-col">
              <div class="meeting-carousel" :data-key="`${row.id}-am`">
                <div class="meeting-track" :style="getMeetingTrackStyle(row.id, 'am')">
                  <div
                    v-for="item in row.am"
                    :key="item.id"
                    class="meeting-item"
                    :data-item-id="String(item.id)"
                  >
                    <span class="meeting-time">{{ item.time }}</span>
                    <span class="meeting-title-wrap">
                      <span class="meeting-title">{{ item.title }}</span>
                      <span
                        v-if="getMeetingEllipsisStyle(row.id, 'am', item.id)"
                        class="meeting-title-ellipsis"
                        :style="getMeetingEllipsisStyle(row.id, 'am', item.id)"
                        aria-hidden="true"
                      >...</span>
                    </span>
                  </div>
                </div>
                <div v-if="row.am.length === 0" class="meeting-placeholder">-</div>
              </div>
            </div>
            <div class="slot-col pm-col">
              <div class="meeting-carousel" :data-key="`${row.id}-pm`">
                <div class="meeting-track" :style="getMeetingTrackStyle(row.id, 'pm')">
                  <div
                    v-for="item in row.pm"
                    :key="item.id"
                    class="meeting-item"
                    :data-item-id="String(item.id)"
                  >
                    <span class="meeting-time">{{ item.time }}</span>
                    <span class="meeting-title-wrap">
                      <span class="meeting-title">{{ item.title }}</span>
                      <span
                        v-if="getMeetingEllipsisStyle(row.id, 'pm', item.id)"
                        class="meeting-title-ellipsis"
                        :style="getMeetingEllipsisStyle(row.id, 'pm', item.id)"
                        aria-hidden="true"
                      >...</span>
                    </span>
                  </div>
                </div>
                <div v-if="row.pm.length === 0" class="meeting-placeholder">-</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        class="footer-ticker"
        :style="{ '--ticker-duration': `${tickerDurationSeconds}s` }"
      >
        <div class="ticker-track">
          <span class="ticker-text">{{ tickerText }}&nbsp;&nbsp;&nbsp;&nbsp;</span>
          <span class="ticker-text" aria-hidden="true">{{ tickerText }}&nbsp;&nbsp;&nbsp;&nbsp;</span>
        </div>
      </div>
    </div>
  </div>
  <DisplayFullscreenHint />
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getVenueMergePublicDisplay } from '@/api/venueManagement'
import { useDisplayLiveRefresh, useDisplayDataPollTimer } from '@/composables/useDisplayLiveRefresh'
import DisplayFullscreenHint from '@/components/display/DisplayFullscreenHint.vue'
import {
  getAppDisplayDateTimeParts,
  msUntilNextAppMinute,
  todayYmdInAppTimeZone
} from '@/utils/appTimezone'
import { pickRouteQueryDate } from '@/utils/routeQuery'

/** 固定设计稿；任意分辨率用同一比例整体缩放 */
const BASE_WIDTH = 1920
const BASE_HEIGHT = 1080

const route = useRoute()

function resolveDisplayDate () {
  return pickRouteQueryDate(route.query, 'date', 'Date') || todayYmdInAppTimeZone()
}

const displayViewport = ref(null)
const displayRoot = ref(null)

const currentDate = ref('')
const currentWeekdayZh = ref('')
const currentTime = ref('')

/** public 目录静态资源，随 base 路径解析 */
const DEFAULT_QR_SRC = `${import.meta.env.BASE_URL}displayQRCode.png`
const qrCodeImage = ref(DEFAULT_QR_SRC)
const defaultPanelTitleText = 'Conference Room | 8/F Ambulatory Care Block\n會議室 | 日間醫療大樓8樓'
const panelTitleText = ref(defaultPanelTitleText)

const defaultTicker = '請在會議期間佩戴外科口罩並保持安靜。For enquiries regarding Conference Rooms, please contact General Office.'
const tickerText = ref(defaultTicker)

function escapeHtml (value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 与参考大屏一致：英文行 Conference / Room 首字母高亮 */
const panelTitleHtml = computed(() => {
  return escapeHtml(panelTitleText.value || '')
    .replace(/\n/g, '<br>')
    .replace(/\bConference\b/g, '<span class="title-accent">C</span>onference')
    .replace(/\bRoom\b/g, '<span class="title-accent">R</span>oom')
})

const scheduleRows = ref([])
let lastDisplayYmd = ''
const VENUE_PAGE_SIZE = 3
const DEFAULT_AUTO_ROTATE_MS = 8000
const DEFAULT_TICKER_DURATION_SECONDS = 40
const autoRotateMs = ref(DEFAULT_AUTO_ROTATE_MS)
const tickerDurationSeconds = ref(DEFAULT_TICKER_DURATION_SECONDS)
const currentVenuePage = ref(0)
const meetingViewportMeta = ref({})
const currentMeetingPage = ref({})
const hasMeetingFlippedOnCurrentVenuePage = ref(false)

const totalVenuePages = computed(() => Math.max(1, Math.ceil(scheduleRows.value.length / VENUE_PAGE_SIZE)))
const visibleScheduleRows = computed(() => {
  const start = currentVenuePage.value * VENUE_PAGE_SIZE
  return scheduleRows.value.slice(start, start + VENUE_PAGE_SIZE)
})

const ARROW_ROTATION_MAP = {
  up: -90,
  'up-right': -45,
  right: 0,
  'down-right': 45,
  down: 90,
  'down-left': 135,
  left: 180,
  'up-left': -135
}

function updateDateTime () {
  const parts = getAppDisplayDateTimeParts()
  currentWeekdayZh.value = parts.weekdayZh
  currentDate.value = `${parts.day}/${parts.month}/${parts.year} ${parts.weekdayEn}`
  currentTime.value = `${parts.hour}:${parts.minute}`

  const ymd = resolveDisplayDate()
  if (lastDisplayYmd && ymd !== lastDisplayYmd) {
    void refreshDisplayData()
  }
}

function applyMergeDisplaySettings (settings) {
  const m = settings || {}
  qrCodeImage.value = (m.qrCodeImage && String(m.qrCodeImage).trim()) ? m.qrCodeImage : DEFAULT_QR_SRC
  tickerText.value = m.footerTickerText || defaultTicker
  const raw = String(m.panelTitleText || '').trim()
  panelTitleText.value = raw || defaultPanelTitleText

  const rotate = Number.parseInt(String(m.rotateIntervalMs ?? ''), 10)
  const nextRotate =
    Number.isFinite(rotate) && rotate >= 1000 && rotate <= 120_000
      ? rotate
      : DEFAULT_AUTO_ROTATE_MS
  if (nextRotate !== autoRotateMs.value) {
    autoRotateMs.value = nextRotate
    startRotationLoop()
  }

  const tickerSec = Number.parseInt(String(m.tickerDurationSeconds ?? ''), 10)
  tickerDurationSeconds.value =
    Number.isFinite(tickerSec) && tickerSec >= 5 && tickerSec <= 300
      ? tickerSec
      : DEFAULT_TICKER_DURATION_SECONDS
}

async function refreshDisplayData () {
  const date = resolveDisplayDate()
  const data = await getVenueMergePublicDisplay(date)
  dataPoll.applyFromPayload(data?.dataPollIntervalMs)
  applyMergeDisplaySettings(data?.mergeDisplaySettings)
  scheduleRows.value = Array.isArray(data?.scheduleRows) ? data.scheduleRows : []
  lastDisplayYmd = date
  await measureMeetingViewports()
}

function getArrowStyle (direction) {
  const deg = ARROW_ROTATION_MAP[direction] ?? 0
  return {
    transform: `rotate(${deg}deg)`
  }
}

function getMeetingKey (rowId, period) {
  return `${rowId}-${period}`
}

function getMeetingTrackStyle (rowId, period) {
  const key = getMeetingKey(rowId, period)
  const meta = meetingViewportMeta.value[key]
  const page = currentMeetingPage.value[key] || 0
  const offset = meta?.pageOffsets?.[page] ?? ((meta?.viewportHeight || 0) * page)
  return {
    transform: `translateY(-${offset}px)`
  }
}

/**
 * 被分页裁切的那条预订：在「当前页最后一行可见文字」末尾显示 ...
 * 返回绝对定位 style；非裁切条目返回 null
 */
function getMeetingEllipsisStyle (rowId, period, itemId) {
  const key = getMeetingKey(rowId, period)
  const meta = meetingViewportMeta.value[key]
  const page = currentMeetingPage.value[key] || 0
  const info = meta?.ellipsisByPage?.[page]
  if (!info || info.itemId !== String(itemId)) return null
  return { top: `${info.topPx}px` }
}

function readLineHeightPx (el, fallback = 48) {
  if (!el) return fallback
  const raw = window.getComputedStyle(el).lineHeight
  const parsed = Number.parseFloat(raw)
  if (Number.isFinite(parsed) && parsed > 0) return parsed
  const fontSize = Number.parseFloat(window.getComputedStyle(el).fontSize)
  if (Number.isFinite(fontSize) && fontSize > 0) return fontSize * 1.2
  return fallback
}

async function measureMeetingViewports () {
  await nextTick()
  const root = displayRoot.value
  if (!root) return
  const containers = Array.from(root.querySelectorAll('.meeting-carousel'))
  const nextMeta = {}
  containers.forEach((el) => {
    const key = el.getAttribute('data-key')
    if (!key) return
    const viewportHeight = el.clientHeight
    const track = el.querySelector('.meeting-track')
    const items = track ? Array.from(track.querySelectorAll('.meeting-item')) : []
    const contentHeight = track ? track.scrollHeight : 0

    if (viewportHeight <= 0 || items.length === 0 || contentHeight <= viewportHeight + 1) {
      nextMeta[key] = {
        viewportHeight,
        pageCount: 1,
        pageOffsets: [0],
        ellipsisByPage: []
      }
      return
    }

    /**
     * 分页规则：
     * - 当前页底部若裁切某条预订 → 该条显示「...」
     * - 下一页从该条预订的开头重新完整展示（而不是只续后半段）
     * - 若单条高度超过一屏 → 仍按视口硬翻页
     */
    const pageOffsets = [0]
    const ellipsisByPage = []
    let start = 0
    let guard = 0

    while (start < contentHeight - 2 && guard < 50) {
      guard += 1
      const pageIndex = pageOffsets.length - 1
      const maxEnd = start + viewportHeight

      if (maxEnd >= contentHeight - 1) {
        ellipsisByPage[pageIndex] = null
        break
      }

      const cutItem = items.find((item) => {
        const top = item.offsetTop
        const bottom = top + item.offsetHeight
        return top < maxEnd - 1 && bottom > maxEnd + 1
      })

      if (!cutItem) {
        ellipsisByPage[pageIndex] = null
        const nextItem = items.find((item) => item.offsetTop >= maxEnd - 1)
        const nextStart = nextItem ? nextItem.offsetTop : contentHeight
        if (nextStart >= contentHeight - 1 || nextStart <= start) break
        pageOffsets.push(nextStart)
        start = nextStart
        continue
      }

      const cutTop = cutItem.offsetTop
      const titleEl = cutItem.querySelector('.meeting-title')
      const lineHeight = readLineHeightPx(titleEl || cutItem)
      const visibleInItem = maxEnd - cutTop
      const visibleLines = Math.max(1, Math.floor((visibleInItem + 0.5) / lineHeight))
      const topPx = Math.max(0, (visibleLines - 1) * lineHeight)

      ellipsisByPage[pageIndex] = {
        itemId: cutItem.getAttribute('data-item-id') || '',
        topPx
      }

      // 下页从该条开头完整重显；若本页已从该条开头起仍裁切（单条超高），则硬翻一屏
      let nextStart = cutTop
      if (nextStart <= start + 1) {
        nextStart = Math.min(maxEnd, contentHeight)
      }
      if (nextStart >= contentHeight - 1 || nextStart <= start) break
      pageOffsets.push(nextStart)
      start = nextStart
    }

    nextMeta[key] = {
      viewportHeight,
      pageCount: Math.max(1, pageOffsets.length),
      pageOffsets,
      ellipsisByPage
    }
  })
  meetingViewportMeta.value = nextMeta

  const nextPages = {}
  for (const [key, meta] of Object.entries(nextMeta)) {
    const old = currentMeetingPage.value[key] || 0
    nextPages[key] = old % Math.max(1, meta.pageCount)
  }
  currentMeetingPage.value = nextPages
}

let rotationTimer = null

function rotateMeetingOnceForCurrentVenuePage () {
  const visibleRowIds = new Set(visibleScheduleRows.value.map(row => String(row.id)))
  const next = { ...currentMeetingPage.value }
  let changed = false
  Object.entries(meetingViewportMeta.value).forEach(([key, meta]) => {
    const [rowIdStr] = key.split('-')
    if (!visibleRowIds.has(rowIdStr)) return
    if ((meta?.pageCount || 1) > 1) {
      next[key] = ((next[key] || 0) + 1) % meta.pageCount
      changed = true
    }
  })
  if (changed) {
    currentMeetingPage.value = next
  }
  return changed
}

function startRotationLoop () {
  if (rotationTimer) clearInterval(rotationTimer)
  rotationTimer = setInterval(() => {
    if (totalVenuePages.value <= 1) {
      rotateMeetingOnceForCurrentVenuePage()
      return
    }

    if (!hasMeetingFlippedOnCurrentVenuePage.value) {
      const didFlip = rotateMeetingOnceForCurrentVenuePage()
      if (didFlip) {
        hasMeetingFlippedOnCurrentVenuePage.value = true
        return
      }
    }

    currentVenuePage.value = (currentVenuePage.value + 1) % totalVenuePages.value
    hasMeetingFlippedOnCurrentVenuePage.value = false
  }, autoRotateMs.value)
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
    /* 保留當前展示，下一輪輪詢重試 */
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

useDisplayLiveRefresh(['venue-merge'], pollDisplayDataFromServer)

watch(
  () => route.query,
  () => {
    void pollDisplayDataFromServer()
  },
  { deep: true }
)

/** 设计稿等比缩放并居中；比例不同时留同色边条，不拉伸变形 */
function adaptFullscreen () {
  const root = displayRoot.value
  if (!root) return

  const viewportScale = window.visualViewport?.scale || 1
  const zoomCompensation = viewportScale > 0 ? viewportScale : 1
  const vw = (window.innerWidth || BASE_WIDTH) * zoomCompensation
  const vh = (window.innerHeight || BASE_HEIGHT) * zoomCompensation
  const scale = Math.min(vw / BASE_WIDTH, vh / BASE_HEIGHT) || 1
  const offsetX = (vw - BASE_WIDTH * scale) / 2
  const offsetY = (vh - BASE_HEIGHT * scale) / 2

  root.style.width = `${BASE_WIDTH}px`
  root.style.height = `${BASE_HEIGHT}px`
  root.style.transform = `scale(${scale})`
  root.style.transformOrigin = 'top left'
  root.style.left = `${offsetX}px`
  root.style.top = `${offsetY}px`

  void measureMeetingViewports()
}

onMounted(() => {
  document.documentElement.classList.add('merge-display-fullscreen')
  void refreshDisplayData().catch(() => { /* 首次失敗仍顯示框架 */ })
  currentVenuePage.value = 0
  startClock()
  dataPoll.start()
  document.addEventListener('visibilitychange', onDocumentVisibilityChange)
  adaptFullscreen()
  startRotationLoop()
  window.addEventListener('resize', adaptFullscreen)
  window.visualViewport?.addEventListener('resize', adaptFullscreen)
  window.addEventListener('resize', measureMeetingViewports)
  const viewport = document.querySelector('meta[name="viewport"]')
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
  }
})

onUnmounted(() => {
  document.documentElement.classList.remove('merge-display-fullscreen')
  stopClock()
  dataPoll.stop()
  document.removeEventListener('visibilitychange', onDocumentVisibilityChange)
  if (rotationTimer) clearInterval(rotationTimer)
  window.removeEventListener('resize', adaptFullscreen)
  window.visualViewport?.removeEventListener('resize', adaptFullscreen)
  window.removeEventListener('resize', measureMeetingViewports)
  document.body.style.overflow = ''
  document.documentElement.style.overflow = ''
  document.body.style.width = ''
  document.documentElement.style.width = ''
  document.body.style.height = ''
  document.documentElement.style.height = ''
})

watch(totalVenuePages, () => {
  if (currentVenuePage.value >= totalVenuePages.value) {
    currentVenuePage.value = 0
  }
  hasMeetingFlippedOnCurrentVenuePage.value = false
  startRotationLoop()
})

watch(visibleScheduleRows, async () => {
  hasMeetingFlippedOnCurrentVenuePage.value = false
  await measureMeetingViewports()
}, { deep: true })
</script>

<style>
html.merge-display-fullscreen {
  zoom: 1 !important;
}

html.merge-display-fullscreen #app {
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
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.merge-display-viewport {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #111111;
  user-select: none;
  touch-action: none;
}

.merge-display-root {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  box-sizing: border-box;
  width: 1920px;
  height: 1080px;
  /* 与主区同色，避免底栏间距露出更浅的蓝条 */
  background: rgb(0, 32, 96);
  color: #ffffff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: var(--display-font-family);
  transform-origin: top left;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.merge-display-root,
.merge-display-root * {
  font-family: var(--display-font-family);
}

.merge-display-root * {
  touch-action: manipulation;
}

/* 顶栏 / 底栏保持原高度占比；字号按图2层级 */
.top-date-bar {
  height: 72px;
  min-height: 72px;
  background: rgb(237, 125, 49);
  color: #ffffff;
  font-weight: 700;
  /* 与 .main-panel 水平 padding 一致，便于与左侧时钟列对齐 */
  padding: 0 24px;
  font-size: 48px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  box-sizing: border-box;
  line-height: 1;
}

/* 宽度 = 左侧时钟列；内容居中，与 .time-line 同一水平起点 */
.top-date-align {
  width: 310px;
  display: flex;
  justify-content: center;
  box-sizing: border-box;
}

/* 簇宽度由隐形时钟决定，日期绝对贴左 → 与 17:20 左缘对齐 */
.top-date-cluster {
  position: relative;
  width: fit-content;
}

.top-date-time-ghost {
  display: block;
  visibility: hidden;
  height: 0;
  overflow: hidden;
  font-size: 102px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1;
  white-space: nowrap;
  pointer-events: none;
}

.top-date-text {
  position: absolute;
  /* 相对时钟左缘再略右移一点 */
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 14px;
  white-space: nowrap;
}

.weekday-zh {
  font-weight: 600;
}

.main-panel {
  position: relative;
  flex: 1;
  min-height: 0;
  background: rgb(0, 32, 96);
  /* 底部留白用同色 padding，避免与底栏之间出现异色缝 */
  padding: 16px 24px 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

.panel-qr {
  position: absolute;
  top: 16px;
  right: 24px;
  z-index: 2;
  width: 110px;
  height: 110px;
  box-sizing: border-box;
  object-fit: contain;
  background: #fff;
  border-radius: 2px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}

.panel-top-row {
  /* 与日程表同一套三列，保证右侧标题与 AM 左对齐 */
  display: grid;
  grid-template-columns: minmax(0, 310px) minmax(0, 1fr) minmax(0, 1fr);
  gap: 0;
  align-items: stretch;
  margin-bottom: 0;
  min-width: 0;
}

.panel-header {
  grid-column: 2 / -1;
  min-width: 0;
  display: flex;
  align-items: center;
  align-self: stretch;
  /* 为右上角二维码留空，避免标题压到码上 */
  padding-right: 140px;
  box-sizing: border-box;
}

.panel-title-wrap {
  flex: 1;
  min-width: 0;
  text-align: left;
}

.panel-title-line {
  font-size: 50px;
  font-weight: 700;
  line-height: 1.22;
  white-space: normal;
  color: #ffffff;
}

.panel-title-line :deep(.title-accent) {
  color: rgb(237, 125, 49);
}

.time-line {
  min-width: 0;
  font-size: 102px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.02em;
  color: rgb(255, 212, 91);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  width: 100%;
  height: 100%;
  text-align: center;
  box-sizing: border-box;
}

.schedule-header,
.schedule-row {
  display: grid;
  grid-template-columns: minmax(0, 310px) minmax(0, 1fr) minmax(0, 1fr);
  gap: 0;
  align-items: stretch;
}

.pm-col {
  padding-left: 48px;
}

.schedule-header .slot-col,
.schedule-row .slot-col {
  min-width: 0;
  overflow-wrap: break-word;
  word-break: break-word;
}

.schedule-header {
  flex-shrink: 0;
  font-size: 54px;
  font-weight: 700;
  margin-top: 80px;
  margin-bottom: 20px;
}

.schedule-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: hidden;
}

.schedule-row {
  position: relative;
  flex: 1 1 0;
  min-height: 96px;
  font-size: 38px;
  /* 勿用 overflow:hidden：会裁掉 bottom/top 贴边的分隔线；
     Android + transform:scale 时亚像素取整后整条线常直接消失。
     会议内容裁切交给 .slot-col / .meeting-carousel。 */
  overflow: visible;
}

.room-name {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  font-size: 84px;
  font-weight: 700;
  /* 与右侧会议第一行顶对齐（对应 .meeting-track padding-top） */
  padding-top: 10px;
  align-self: flex-start;
  width: 100%;
  height: auto;
  box-sizing: border-box;
}

.room-name-text {
  line-height: 1;
}

.room-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 68px;
  height: 68px;
  border-radius: 999px;
  background: rgb(237, 125, 49);
  color: #ffffff;
  font-size: 58px;
  font-weight: 900;
  line-height: 1;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
}

.schedule-row .slot-col {
  display: flex;
  align-items: flex-start;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: rgb(255, 212, 91);
}

.schedule-row::after {
  content: '';
  position: absolute;
  left: calc(310px + 20px);
  right: 0;
  /* 略抬离底边，避免 scale 后仍被邻行/容器边界吃掉 */
  bottom: 1px;
  height: 4px;
  background: rgba(255, 255, 255, 0.9);
  pointer-events: none;
  z-index: 1;
}

.schedule-row:first-child::before {
  content: '';
  position: absolute;
  left: calc(310px + 20px);
  right: 0;
  top: 1px;
  height: 4px;
  background: rgba(255, 255, 255, 0.9);
  pointer-events: none;
  z-index: 1;
}

.schedule-row:last-child::after {
  display: none;
}

.meeting-carousel {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.meeting-track {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding-top: 10px;
  transition: transform 450ms ease;
}

.meeting-item {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 18px;
  row-gap: 4px;
  width: 100%;
  line-height: 1.25;
  font-size: 38px;
}

.meeting-time {
  flex: 0 0 auto;
  white-space: nowrap;
  color: rgb(255, 212, 91);
  font-weight: 700;
}

.meeting-title-wrap {
  position: relative;
  flex: 1 1 160px;
  min-width: 0;
}

.meeting-title {
  min-width: 0;
  overflow-wrap: break-word;
  word-break: break-word;
  color: rgb(255, 212, 91);
  font-weight: 600;
}

/* 落在被裁切预订「当前页最后一行」行末，不另起一行、不遮挡其它记录 */
.meeting-title-ellipsis {
  position: absolute;
  right: 0;
  z-index: 1;
  padding-left: 6px;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1.25;
  color: rgb(255, 212, 91);
  background: rgb(0, 32, 96);
  pointer-events: none;
}

.meeting-placeholder {
  opacity: 0.9;
  padding-top: 10px;
  color: rgb(255, 212, 91);
  font-size: 38px;
}

.footer-ticker {
  height: 72px;
  min-height: 72px;
  margin-top: 0;
  background: rgb(237, 125, 49);
  color: rgb(0, 32, 96);
  overflow: hidden;
  font-size: 48px;
  font-weight: 700;
  padding: 0 24px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  box-sizing: border-box;
  line-height: 1;
}

.ticker-track {
  display: inline-flex;
  width: max-content;
  white-space: nowrap;
  will-change: transform;
  animation: ticker var(--ticker-duration, 40s) linear infinite;
}

.ticker-text {
  display: inline-block;
  flex-shrink: 0;
}

@keyframes ticker {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
</style>
