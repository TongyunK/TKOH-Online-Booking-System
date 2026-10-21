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
            v-if="missingVenueId"
            class="display-error"
          >
            <div class="display-error-en">Missing venueId</div>
            <div class="display-error-zh">網址缺少 venueId 參數</div>
            <div class="display-error-hint">Use ?displayType=single&amp;venueId=7</div>
          </div>
          <div
            v-else-if="sortedTodayEvents.length"
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

      <!-- Footer：禁止换行；在 1080 画布可用宽度内用 transform 缩放 -->
      <div class="display-footer">
        <div v-if="footerEnText" class="venue-info-slot">
          <span
            class="venue-info-fit venue-info-fit-en"
            :style="footerEnFitStyle"
          >{{ footerEnText }}</span>
        </div>
        <div v-if="footerZhText" class="venue-info-slot">
          <span
            class="venue-info-fit venue-info-fit-zh"
            :style="footerZhFitStyle"
          >{{ footerZhText }}</span>
        </div>
        <div class="footer-measure" aria-hidden="true">
          <span ref="footerEnMeasureRef" class="venue-info-fit venue-info-fit-en">{{ footerEnText }}</span>
          <span ref="footerZhMeasureRef" class="venue-info-fit venue-info-fit-zh">{{ footerZhText }}</span>
        </div>
      </div>
    </div>
  </div>
  <DisplayFullscreenHint />
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getVenueMergePublicDisplay,
  getVenuePublicDisplay
} from '@/api/venueManagement'
import { useDisplayLiveRefresh, useDisplayDataPollTimer } from '@/composables/useDisplayLiveRefresh'
import { todayYmdInAppTimeZone } from '@/utils/appTimezone'
import { pickRouteQuery, pickRouteQueryDate } from '@/utils/routeQuery'
import { measureDisplayViewport } from '@/utils/displayFullscreenScale'
import { replaceVenueDisplayRoute } from '@/utils/venueDisplayRoute'
import { resetDisplayReady, signalDisplayReady } from '@/utils/displayReadySignal'
import DisplayFullscreenHint from '@/components/display/DisplayFullscreenHint.vue'
import VenueDisplayClock from './VenueDisplayClock.vue'

const route = useRoute()
const router = useRouter()

/** 竖向 9:16（与横屏 16:9 同比例，旋转 90°） */
const BASE_WIDTH = 1080
const BASE_HEIGHT = 1920
let adaptRetryCount = 0

const displayViewport = ref(null)
const displayRoot = ref(null)

function readDisplayQuery () {
  return {
    venueId: pickRouteQuery(route.query, 'venueId', 'venueID', 'venue_id'),
    displayType: (
      pickRouteQuery(route.query, 'displayType', 'DisplayType', 'display_type') ||
      'single'
    ).toLowerCase(),
    date: pickRouteQueryDate(route.query, 'date', 'Date')
  }
}

const initialQuery = readDisplayQuery()
const venueId = ref(initialQuery.venueId)
const displayType = ref(initialQuery.displayType === 'merge' ? 'merge' : 'single')
const displayDate = ref(initialQuery.date)

function resolveDisplayDate () {
  return displayDate.value || todayYmdInAppTimeZone()
}
const missingVenueId = computed(
  () => displayType.value !== 'merge' && !String(venueId.value || '').trim()
)

const venueName = ref('')
const venueNameZh = ref('')
const venueLocation = ref('')
const venueLocationZh = ref('')
const qrCodeImage = ref('')

const allTodayEvents = ref([])
const eventsListRef = ref(null)
const footerEnMeasureRef = ref(null)
const footerZhMeasureRef = ref(null)
/** 当前进行中的会议 key；仅在成员变化时替换，避免每分钟整表重绘 */
const activeEventKeys = ref(new Set())
/** 活动区字号/间距缩放系数，保证列表不滚动完整显示 */
const layoutScale = ref(1)
/** footer 英文行 / 中文行各自缩放，互不影响 */
const footerEnScale = ref(1)
const footerZhScale = ref(1)
/** 日常典型活动数量：少于此数时按此格数均分高度，避免单场活动卡片过高 */
const TYPICAL_DAY_EVENT_COUNT = 4
const FOOTER_PAD_X = 32
let lastClockTime = ''
let activeEventKeysSig = ''
let fitLayoutTimer = null
let fitFooterTimer = null

const contentLayoutStyle = computed(() => {
  const count = sortedTodayEvents.value.length
  return {
    '--layout-scale': String(layoutScale.value),
    '--event-slot-count': String(Math.max(count, TYPICAL_DAY_EVENT_COUNT) || TYPICAL_DAY_EVENT_COUNT)
  }
})

const footerEnText = computed(() =>
  [venueName.value, venueLocation.value].map((s) => String(s || '').trim()).filter(Boolean).join(' | ')
)
const footerZhText = computed(() =>
  [venueNameZh.value, venueLocationZh.value].map((s) => String(s || '').trim()).filter(Boolean).join(' | ')
)
const footerEnFitStyle = computed(() => ({
  transform: `scale(${footerEnScale.value})`
}))
const footerZhFitStyle = computed(() => ({
  transform: `scale(${footerZhScale.value})`
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
  if (listEl.scrollHeight > listEl.clientHeight + 1) return true
  // 卡片均分高度后，也可能在卡内裁切内容，需一并检测
  const cards = listEl.querySelectorAll('.event-card')
  for (const card of cards) {
    if (card.scrollHeight > card.clientHeight + 1) return true
  }
  return false
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

function fitOneFooterRow (measureEl, scaleRef) {
  const available = Math.max(0, BASE_WIDTH - FOOTER_PAD_X * 2)
  const needed = measureEl?.offsetWidth || 0
  if (available <= 0 || needed <= 0) {
    if (scaleRef.value !== 1) scaleRef.value = 1
    return
  }
  const next = needed <= available + 1
    ? 1
    : Math.max(0.35, Math.floor((available / needed) * 0.995 * 1000) / 1000)
  if (scaleRef.value !== next) scaleRef.value = next
}

async function fitFooterLayout () {
  await nextTick()
  await waitPaint()
  fitOneFooterRow(footerEnMeasureRef.value, footerEnScale)
  fitOneFooterRow(footerZhMeasureRef.value, footerZhScale)
}

function scheduleFitFooterLayout () {
  if (fitFooterTimer) clearTimeout(fitFooterTimer)
  fitFooterTimer = setTimeout(() => {
    fitFooterTimer = null
    void fitFooterLayout()
  }, 40)
}

watch(sortedTodayEvents, () => {
  syncActiveEventKeys()
  scheduleFitEventsLayout()
})

watch(
  [footerEnText, footerZhText],
  () => {
    scheduleFitFooterLayout()
  }
)

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
  const date = resolveDisplayDate()

  if (displayType.value === 'merge') {
    const data = await getVenueMergePublicDisplay(date)
    dataPoll.applyFromPayload(data?.dataPollIntervalMs)
    const settings = data?.mergeDisplaySettings || {}
    applyPanelTitleFooter(settings.panelTitleText)
    const nextQr = settings.qrCodeImage || ''
    if (qrCodeImage.value !== nextQr) qrCodeImage.value = nextQr
    replaceTodayEvents([])
    signalDisplayReady()
    return
  }

  if (!venueId.value) {
    replaceTodayEvents([])
    venueName.value = ''
    venueNameZh.value = ''
    venueLocation.value = ''
    venueLocationZh.value = ''
    signalDisplayReady()
    return
  }

  const data = await getVenuePublicDisplay(venueId.value, date)
  if (replaceVenueDisplayRoute(router, route, data?.venue?.displayType)) return
  dataPoll.applyFromPayload(data?.dataPollIntervalMs)
  applyVenueInfo(data?.venue)
  if (qrCodeImage.value) qrCodeImage.value = ''
  replaceTodayEvents(data?.events)
  signalDisplayReady()
}

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

const dataPoll = useDisplayDataPollTimer(pollDisplayDataFromServer)

function onDocumentVisibilityChange () {
  if (document.visibilityState === 'visible') {
    void pollDisplayDataFromServer()
  }
}

useDisplayLiveRefresh(['venue', 'venue-merge'], pollDisplayDataFromServer)

watch(
  () => route.query,
  () => {
    const next = readDisplayQuery()
    const nextType = next.displayType === 'merge' ? 'merge' : 'single'
    const changed =
      next.venueId !== String(venueId.value || '') ||
      nextType !== displayType.value ||
      next.date !== String(displayDate.value || '')
    venueId.value = next.venueId
    displayType.value = nextType
    displayDate.value = next.date
    if (changed) {
      void pollDisplayDataFromServer()
    }
  },
  { deep: true }
)

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

  scheduleFitFooterLayout()
  scheduleFitEventsLayout()
}

onMounted(() => {
  resetDisplayReady()
  document.documentElement.classList.add('venue-display-fullscreen')
  adaptFullscreen()
  window.addEventListener('resize', adaptFullscreen)
  window.visualViewport?.addEventListener('resize', adaptFullscreen)

  void refreshDisplayData()
    .catch(() => { /* 首次失敗仍顯示框架 */ })
    .finally(() => {
      nextTick(() => {
        adaptFullscreen()
        signalDisplayReady()
      })
    })

  dataPoll.start()
  document.addEventListener('visibilitychange', onDocumentVisibilityChange)

  nextTick(() => {
    adaptFullscreen()
  })

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      scheduleFitFooterLayout()
      scheduleFitEventsLayout()
    }).catch(() => {})
  }

  const viewport = document.querySelector('meta[name="viewport"]')
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
  }
})

onUnmounted(() => {
  document.documentElement.classList.remove('venue-display-fullscreen')
  dataPoll.stop()
  if (fitLayoutTimer) clearTimeout(fitLayoutTimer)
  if (fitFooterTimer) clearTimeout(fitFooterTimer)
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
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
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
  padding: 28px 36px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-width: 0;
  box-sizing: border-box;
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
  font-size: calc(64px * var(--layout-scale, 1));
  font-weight: 700;
  color: #111111;
  letter-spacing: 0.04em;
  /* 下边距：标题与活动列表之间的行间距 */
  margin: calc(36px * var(--layout-scale, 1)) 0 calc(72px * var(--layout-scale, 1));
}

.events-list {
  width: 100%;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: grid;
  /* 按典型 4 场（或实际更多场次）均分高度，少于此数时底部留白 */
  grid-template-rows: repeat(var(--event-slot-count, 4), minmax(0, 1fr));
  gap: calc(24px * var(--layout-scale, 1));
  padding: 0 6px;
  box-sizing: border-box;
}

.event-card {
  width: 100%;
  box-sizing: border-box;
  padding: calc(28px * var(--layout-scale, 1)) calc(32px * var(--layout-scale, 1));
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
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
  font-size: calc(72px * var(--layout-scale, 1));
  font-weight: 700;
  color: #111111;
  line-height: 1.25;
  margin-bottom: calc(18px * var(--layout-scale, 1));
  word-break: break-word;
}

.event-time {
  width: 100%;
  font-size: calc(66px * var(--layout-scale, 1));
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
  font-size: 64px;
  font-weight: 700;
  line-height: 0.9;
  letter-spacing: 2px;
  margin-bottom: 28px;
}

.no-events-text-zh {
  font-size: 64px;
  font-weight: 600;
  line-height: 0.9;
  letter-spacing: 4px;
}

.display-error {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #111111;
  gap: 18px;
  padding: 0 40px;
}

.display-error-en {
  font-size: 48px;
  font-weight: 700;
  letter-spacing: 1px;
}

.display-error-zh {
  font-size: 44px;
  font-weight: 600;
}

.display-error-hint {
  margin-top: 12px;
  font-size: 28px;
  font-weight: 500;
  word-break: break-all;
  opacity: 0.85;
}

.display-footer {
  position: relative;
  padding: 16px 32px;
  background: rgb(240, 240, 240);
  text-align: left;
  flex-shrink: 0;
  overflow: hidden;
  box-sizing: border-box;
}

.venue-info-slot {
  width: 100%;
  overflow: hidden;
  white-space: nowrap;
  line-height: 1.15;
}

.venue-info-slot + .venue-info-slot {
  margin-top: 8px;
}

.venue-info-fit {
  display: inline-block;
  white-space: nowrap;
  word-break: keep-all;
  overflow-wrap: normal;
  transform-origin: left center;
  color: #111111;
}

.venue-info-fit-en {
  font-size: 52px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.venue-info-fit-zh {
  font-size: 48px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.footer-measure {
  position: absolute;
  left: 0;
  top: 0;
  visibility: hidden;
  pointer-events: none;
  white-space: nowrap;
  width: max-content;
  height: 0;
  overflow: hidden;
}

.footer-measure .venue-info-fit {
  transform: none;
}
</style>
