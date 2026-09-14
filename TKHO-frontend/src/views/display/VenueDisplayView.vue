<template>
  <!-- 视口铺满；内部固定 1080×1920 竖向设计稿，整体 transform 等比缩放并居中 -->
  <div ref="displayViewport" class="venue-display-viewport">
    <div ref="displayRoot" class="venue-display-root">
      <div class="display-above-footer">
        <!-- Header -->
        <div class="display-header">
          <VenueDisplayClock @tick="onClockTick" />
          <img v-if="displayType === 'merge' && qrCodeImage" :src="qrCodeImage" alt="QR Code" class="header-qr" />
        </div>

        <!-- Main content：当天全部活动列表 -->
        <div class="display-content" :style="contentLayoutStyle">
          <div class="events-section-title">TODAY'S EVENTS 今日活動</div>
          <div
            v-if="sortedTodayEvents.length"
            ref="eventsListRef"
            class="events-list"
          >
            <div
              v-for="event in sortedTodayEvents"
              :key="getEventKey(event)"
              class="event-card"
              :class="{ 'is-current': activeEventKeys.has(getEventKey(event)) }"
            >
              <div class="event-topic">{{ event.topic }}</div>
              <div class="event-time">{{ event.startTime }} - {{ event.endTime }}</div>
            </div>
          </div>
          <div v-else class="no-events">
            <div class="no-events-text-en">NO EVENTS</div>
            <div class="no-events-text-zh">沒有活動</div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="display-footer">
        <div class="venue-info-row">
          <span v-if="venueName" class="venue-name">{{ venueName }}</span>
          <span v-if="venueName && venueLocation" class="separator">|</span>
          <span v-if="venueLocation" class="venue-location">{{ venueLocation }}</span>
        </div>
        <div v-if="venueNameZh || venueLocationZh" class="venue-info-row">
          <span v-if="venueNameZh" class="venue-name-zh">{{ venueNameZh }}</span>
          <span v-if="venueNameZh && venueLocationZh" class="separator">|</span>
          <span v-if="venueLocationZh" class="venue-location-zh">{{ venueLocationZh }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  getVenueMergePublicDisplay,
  getVenuePublicDisplay
} from '@/api/venueManagement'
import { todayYmdInAppTimeZone } from '@/utils/appTimezone'
import VenueDisplayClock from './VenueDisplayClock.vue'

const route = useRoute()
const DATA_POLL_MS = 20_000

/** 竖向 9:16（与横屏 16:9 同比例，旋转 90°） */
const BASE_WIDTH = 1080
const BASE_HEIGHT = 1920

const displayViewport = ref(null)
const displayRoot = ref(null)

const venueId = ref(route.query.venueId)
const displayType = ref(route.query.displayType || 'single')

const venueName = ref('')
const venueNameZh = ref('')
const venueLocation = ref('')
const venueLocationZh = ref('')
const qrCodeImage = ref('')

const allTodayEvents = ref([])
const eventsListRef = ref(null)
/** 当前进行中的会议 key；仅在成员变化时替换，避免每分钟整表重绘 */
const activeEventKeys = ref(new Set())
/** 活动区字号/间距缩放系数，保证列表不滚动完整显示 */
const layoutScale = ref(1)
let lastClockTime = ''
let activeEventKeysSig = ''
let fitLayoutTimer = null

const contentLayoutStyle = computed(() => ({
  '--layout-scale': String(layoutScale.value)
}))

function parseHmToMinutes (hm) {
  const m = String(hm || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number.parseInt(m[1], 10)
  const min = Number.parseInt(m[2], 10)
  if (Number.isNaN(h) || Number.isNaN(min)) return null
  return h * 60 + min
}

function getEventKey (event) {
  return event?.id || `${event?.startTime}-${event?.topic}`
}

/** 按開始時間排序的當天全部活動 */
const sortedTodayEvents = computed(() =>
  [...allTodayEvents.value].sort(
    (a, b) => (parseHmToMinutes(a.startTime) ?? 0) - (parseHmToMinutes(b.startTime) ?? 0)
  )
)

function computeActiveEventKeys (timeHm) {
  const nowMin = parseHmToMinutes(timeHm)
  const keys = new Set()
  if (nowMin == null) return keys
  for (const event of sortedTodayEvents.value) {
    const start = parseHmToMinutes(event.startTime)
    const end = parseHmToMinutes(event.endTime)
    if (start == null || end == null) continue
    if (nowMin >= start && nowMin <= end) {
      keys.add(getEventKey(event))
    }
  }
  return keys
}

function syncActiveEventKeys (timeHm = lastClockTime) {
  const next = computeActiveEventKeys(timeHm)
  const nextSig = [...next].sort().join('\0')
  if (nextSig === activeEventKeysSig) return
  activeEventKeysSig = nextSig
  activeEventKeys.value = next
}

function onClockTick ({ time, dayChanged }) {
  lastClockTime = time || ''
  syncActiveEventKeys(lastClockTime)
  if (dayChanged) {
    void refreshDisplayData()
  }
}

function waitPaint () {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  })
}

function listOverflows (listEl) {
  return listEl.scrollHeight > listEl.clientHeight + 1
}

function getEventsSignature (events) {
  return (events || [])
    .map((e) => [e?.id, e?.startTime, e?.endTime, e?.topic].join('\u0001'))
    .join('\u0002')
}

async function binarySearchScale (listEl, lo, hi) {
  let low = lo
  let high = hi
  for (let i = 0; i < 12; i++) {
    const mid = (low + high) / 2
    layoutScale.value = mid
    await nextTick()
    await waitPaint()
    if (listOverflows(listEl)) {
      high = mid
    } else {
      low = mid
    }
  }
  return Math.max(0.32, Math.floor(low * 1000) / 1000)
}

/**
 * 依現有 scale 微調，避免每次輪詢都先跳回 1 造成閃爍。
 * - 溢出：從當前值向下降
 * - 有餘量：從當前值向 1 緩慢升高
 */
async function fitEventsLayout () {
  const count = sortedTodayEvents.value.length
  if (!count) {
    if (layoutScale.value !== 1) layoutScale.value = 1
    return
  }

  await nextTick()
  await waitPaint()

  const listEl = eventsListRef.value
  if (!listEl || listEl.clientHeight <= 0) return

  const current = layoutScale.value

  if (listOverflows(listEl)) {
    layoutScale.value = await binarySearchScale(listEl, 0.32, Math.max(current, 0.32))
    return
  }

  if (current >= 0.999) {
    layoutScale.value = 1
    return
  }

  // 尚有空間時再嘗試放大，過程不會先放大到超出版面
  layoutScale.value = await binarySearchScale(listEl, current, 1)
}

function scheduleFitEventsLayout () {
  if (fitLayoutTimer) clearTimeout(fitLayoutTimer)
  fitLayoutTimer = setTimeout(() => {
    fitLayoutTimer = null
    void fitEventsLayout()
  }, 40)
}

watch(sortedTodayEvents, () => {
  syncActiveEventKeys()
  scheduleFitEventsLayout()
})

function applyPanelTitleFooter (panelTitleText) {
  const lines = String(panelTitleText || '').split('\n').map(s => s.trim()).filter(Boolean)
  if (lines[0] && venueName.value !== lines[0]) venueName.value = lines[0]
  if (lines[1] && venueNameZh.value !== lines[1]) venueNameZh.value = lines[1]
}

function applyVenueInfo (venue) {
  if (!venue) return
  const displayName = String(venue.displayName || '').trim()
  const name = displayName || venue.name || ''
  const nameZh = venue.nameZh || ''
  const location = venue.location || ''
  const locationZh = venue.locationZh || ''
  if (venueName.value !== name) venueName.value = name
  if (venueNameZh.value !== nameZh) venueNameZh.value = nameZh
  if (venueLocation.value !== location) venueLocation.value = location
  if (venueLocationZh.value !== locationZh) venueLocationZh.value = locationZh
}

function replaceTodayEvents (nextEvents) {
  const incoming = Array.isArray(nextEvents) ? nextEvents : []
  if (getEventsSignature(incoming) === getEventsSignature(allTodayEvents.value)) {
    return false
  }
  allTodayEvents.value = incoming
  return true
}

async function refreshDisplayData () {
  const date = todayYmdInAppTimeZone()

  if (displayType.value === 'merge') {
    const data = await getVenueMergePublicDisplay(date)
    const settings = data?.mergeDisplaySettings || {}
    applyPanelTitleFooter(settings.panelTitleText)
    const nextQr = settings.qrCodeImage || ''
    if (qrCodeImage.value !== nextQr) qrCodeImage.value = nextQr
    replaceTodayEvents([])
    return
  }

  if (!venueId.value) {
    replaceTodayEvents([])
    return
  }

  const data = await getVenuePublicDisplay(venueId.value, date)
  applyVenueInfo(data?.venue)
  if (qrCodeImage.value) qrCodeImage.value = ''
  replaceTodayEvents(data?.events)
}

let dataPollTimer = null
let dataPollInFlight = false

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

function onDocumentVisibilityChange () {
  if (document.visibilityState === 'visible') {
    void pollDisplayDataFromServer()
  }
}

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

  scheduleFitEventsLayout()
}

onMounted(() => {
  document.documentElement.classList.add('venue-display-fullscreen')
  adaptFullscreen()
  window.addEventListener('resize', adaptFullscreen)
  window.visualViewport?.addEventListener('resize', adaptFullscreen)

  void refreshDisplayData()
    .catch(() => { /* 首次失敗仍顯示框架 */ })
    .finally(() => {
      nextTick(() => {
        adaptFullscreen()
      })
    })

  dataPollTimer = setInterval(pollDisplayDataFromServer, DATA_POLL_MS)
  document.addEventListener('visibilitychange', onDocumentVisibilityChange)

  nextTick(() => {
    adaptFullscreen()
  })

  const viewport = document.querySelector('meta[name="viewport"]')
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
  }
})

onUnmounted(() => {
  document.documentElement.classList.remove('venue-display-fullscreen')
  if (dataPollTimer) clearInterval(dataPollTimer)
  if (fitLayoutTimer) clearTimeout(fitLayoutTimer)
  document.removeEventListener('visibilitychange', onDocumentVisibilityChange)
  window.removeEventListener('resize', adaptFullscreen)
  window.visualViewport?.removeEventListener('resize', adaptFullscreen)
})
</script>

<style>
html.venue-display-fullscreen {
  zoom: 1 !important;
}

html.venue-display-fullscreen #app {
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

.venue-display-viewport {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #111111;
  user-select: none;
  touch-action: none;
}

.venue-display-root {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  box-sizing: border-box;
  width: 1080px;
  height: 1920px;
  background: rgb(255, 153, 0);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: var(--display-font-family);
  transform-origin: top left;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  -webkit-touch-callout: none;
}

.venue-display-root,
.venue-display-root * {
  font-family: var(--display-font-family);
}

.venue-display-root * {
  touch-action: manipulation;
}

.display-above-footer {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.display-header {
  flex-shrink: 0;
  z-index: 1;
  padding: 24px 28px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.header-qr {
  width: 120px;
  height: 120px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid rgba(0, 0, 0, 0.18);
  object-fit: cover;
  flex-shrink: 0;
}

.display-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  padding: 8px 28px 36px;
  overflow: hidden;
}

.events-section-title {
  flex-shrink: 0;
  text-align: center;
  font-size: calc(48px * var(--layout-scale, 1));
  font-weight: 700;
  color: #111111;
  letter-spacing: 0.04em;
  margin: calc(36px * var(--layout-scale, 1)) 0 calc(28px * var(--layout-scale, 1));
}

.events-list {
  width: 100%;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: calc(24px * var(--layout-scale, 1));
  padding: 0 6px;
}

.event-card {
  width: 100%;
  box-sizing: border-box;
  padding: calc(28px * var(--layout-scale, 1)) calc(32px * var(--layout-scale, 1));
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  border-radius: 10px;
  /* 比页面底色更深一档的橙色块 */
  background: rgb(230, 126, 0);
}

.event-card.is-current {
  box-shadow: inset 0 0 0 3px rgba(0, 0, 0, 0.28);
}

.event-topic {
  width: 100%;
  font-size: calc(52px * var(--layout-scale, 1));
  font-weight: 700;
  color: #111111;
  line-height: 1.25;
  margin-bottom: calc(14px * var(--layout-scale, 1));
  word-break: break-word;
}

.event-time {
  width: 100%;
  font-size: calc(48px * var(--layout-scale, 1));
  font-weight: 500;
  color: #111111;
  letter-spacing: 0.02em;
}

.no-events {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #111111;
}

.no-events-text-en {
  font-size: 56px;
  font-weight: 700;
  line-height: 0.9;
  letter-spacing: 2px;
  margin-bottom: 28px;
}

.no-events-text-zh {
  font-size: 56px;
  font-weight: 600;
  line-height: 0.9;
  letter-spacing: 4px;
}

.display-footer {
  padding: 16px 32px;
  background: rgb(240, 240, 240);
  text-align: left;
  flex-shrink: 0;
}

.venue-info-row {
  display: flex;
  align-items: center;
  color: #111111;
  margin-bottom: 8px;
  line-height: 1.15;
}

.venue-info-row:last-child {
  margin-bottom: 0;
}

.venue-name,
.venue-location {
  font-size: 44px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.venue-name-zh,
.venue-location-zh {
  font-size: 44px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.separator {
  margin: 0 16px;
  font-size: 40px;
  font-weight: 700;
}

.venue-info-row:last-child .separator {
  font-size: 36px;
}
</style>
