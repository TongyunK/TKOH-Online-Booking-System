<template>
  <!-- 视口铺满；内部固定 1080×1920 竖向设计稿，整体 transform 等比缩放并居中 -->
  <div ref="displayViewport" class="light-display-viewport">
    <div ref="displayRoot" class="light-display-root">
      <header class="light-header">
        <img :src="logoBarSrc" alt="Wise System" class="light-logo-bar" />
        <div class="light-datetime">
          <div class="light-date-line">{{ dateLabel }} {{ weekdayEn }}</div>
          <div class="light-time">{{ currentTime }}</div>
        </div>
      </header>

      <div class="light-accent-bar" aria-hidden="true">
        <span class="light-accent-line" />
        <span class="light-accent-diamond" />
        <span class="light-accent-line" />
      </div>

      <div
        v-if="missingVenueId"
        class="light-error"
      >
        <div class="light-error-en">Missing venueId</div>
        <div class="light-error-zh">網址缺少 venueId 參數</div>
        <div class="light-error-hint">Use ?venueId=7</div>
      </div>

      <template v-else>
        <section class="light-room">
          <h1 ref="roomTitleRef" class="light-room-title">{{ roomTitle }}</h1>
          <div
            class="light-status-pill"
            :class="`is-${currentStatusKind}`"
          >
            {{ roomStatusEn }}
          </div>
        </section>

        <section class="light-schedule" :style="contentLayoutStyle">
          <h2 class="light-schedule-title">Today's Schedule</h2>

          <div
            v-if="scheduleRows.length"
            ref="scheduleListRef"
            class="light-schedule-panel"
          >
            <div
              v-for="row in scheduleRows"
              :key="row.key"
              class="light-schedule-row"
              :class="row.phase"
            >
              <div class="light-row-time">
                <span class="light-row-range">{{ row.startTime }} – {{ row.endTime }}</span>
              </div>
              <div
                class="light-row-topic"
                :title="row.topic"
              >{{ row.topic }}</div>
              <span
                class="light-row-dot"
                aria-hidden="true"
              />
            </div>
          </div>
          <div
            v-else
            class="light-no-schedule"
          >
            <div class="light-no-schedule-en">NO SCHEDULE TODAY</div>
            <div class="light-no-schedule-zh">今日暫無預定</div>
          </div>
        </section>
      </template>

      <footer class="light-footer">
        <img :src="logoIconSrc" alt="Wise System" class="light-logo-icon" />
      </footer>
    </div>
  </div>
  <DisplayFullscreenHint />
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getVenuePublicDisplay } from '@/api/venueManagement'
import { useDisplayLiveRefresh, useDisplayDataPollTimer } from '@/composables/useDisplayLiveRefresh'
import {
  getAppDisplayDateTimeParts,
  msUntilNextAppMinute,
  todayYmdInAppTimeZone
} from '@/utils/appTimezone'
import { pickRouteQuery, pickRouteQueryDate } from '@/utils/routeQuery'
import { measureDisplayViewport } from '@/utils/displayFullscreenScale'
import { replaceVenueDisplayRoute } from '@/utils/venueDisplayRoute'
import { resetDisplayReady, signalDisplayReady } from '@/utils/displayReadySignal'
import DisplayFullscreenHint from '@/components/display/DisplayFullscreenHint.vue'

const route = useRoute()
const router = useRouter()

const BASE_WIDTH = 1080
const BASE_HEIGHT = 1920
const publicBase = import.meta.env.BASE_URL || '/'
const logoBarSrc = `${publicBase}WiseSystem_logo_original.svg`
const logoIconSrc = `${publicBase}WiseSystem_icon.svg`

let adaptRetryCount = 0
let clockTimer = null
let lastClockTime = ''
let lastYmd = ''
let activeEventKeysSig = ''
let fitLayoutTimer = null

const displayViewport = ref(null)
const displayRoot = ref(null)
const scheduleListRef = ref(null)
const roomTitleRef = ref(null)

function readDisplayQuery () {
  return {
    venueId: pickRouteQuery(route.query, 'venueId', 'venueID', 'venue_id'),
    date: pickRouteQueryDate(route.query, 'date', 'Date')
  }
}

const initialQuery = readDisplayQuery()
const venueId = ref(initialQuery.venueId)
const displayDate = ref(initialQuery.date)

const dateLabel = ref('')
const weekdayEn = ref('')
const currentTime = ref('')

const venueName = ref('')
const venueNameZh = ref('')
const allTodayEvents = ref([])
const activeEventKeys = ref(new Set())
const layoutScale = ref(1)

const missingVenueId = computed(() => !String(venueId.value || '').trim())

const roomTitle = computed(() => {
  const en = String(venueName.value || '').trim()
  if (en) return en
  const zh = String(venueNameZh.value || '').trim()
  if (zh) return zh
  return 'Meeting Room'
})

const contentLayoutStyle = computed(() => ({
  '--layout-scale': String(layoutScale.value),
  '--schedule-slot-count': String(Math.max(scheduleRows.value.length, 1))
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

const sortedTodayEvents = computed(() =>
  [...allTodayEvents.value].sort(
    (a, b) => (parseHmToMinutes(a.startTime) ?? 0) - (parseHmToMinutes(b.startTime) ?? 0)
  )
)

const currentEvent = computed(() => {
  for (const event of sortedTodayEvents.value) {
    if (activeEventKeys.value.has(getEventKey(event))) return event
  }
  return null
})

const currentStatusKind = computed(() =>
  currentEvent.value ? 'in-use' : 'available'
)

const roomStatusEn = computed(() =>
  currentStatusKind.value === 'in-use' ? 'IN USE' : 'AVAILABLE'
)

/** 过去灰、当前时间黑/名称红、将来时间黑/名称绿 */
const scheduleRows = computed(() => {
  const nowMin = parseHmToMinutes(currentTime.value || lastClockTime)
  return sortedTodayEvents.value.map((event) => {
    const start = parseHmToMinutes(event.startTime)
    const end = parseHmToMinutes(event.endTime)
    let phase = 'is-future'
    if (nowMin != null && start != null && end != null) {
      if (nowMin >= end) phase = 'is-past'
      else if (nowMin >= start) phase = 'is-now'
    }
    return {
      key: getEventKey(event),
      startTime: event.startTime,
      endTime: event.endTime,
      topic: String(event.topic || '').trim(),
      phase
    }
  })
})

function computeActiveEventKeys (timeHm) {
  const nowMin = parseHmToMinutes(timeHm)
  const keys = new Set()
  if (nowMin == null) return keys
  for (const event of sortedTodayEvents.value) {
    const start = parseHmToMinutes(event.startTime)
    const end = parseHmToMinutes(event.endTime)
    if (start == null || end == null) continue
    if (nowMin >= start && nowMin < end) {
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

function publishClockTick () {
  const parts = getAppDisplayDateTimeParts()
  dateLabel.value = `${parts.day}/${parts.month}/${parts.year}`
  weekdayEn.value = String(parts.weekdayEn || '')
  currentTime.value = `${parts.hour}:${parts.minute}`

  const ymd = todayYmdInAppTimeZone()
  const dayChanged = Boolean(lastYmd && ymd !== lastYmd)
  lastYmd = ymd
  lastClockTime = currentTime.value
  syncActiveEventKeys(lastClockTime)

  if (dayChanged) {
    void refreshDisplayData()
  }
}

function scheduleClockTick () {
  clockTimer = setTimeout(() => {
    publishClockTick()
    scheduleClockTick()
  }, msUntilNextAppMinute())
}

function startClock () {
  if (clockTimer) {
    clearTimeout(clockTimer)
    clockTimer = null
  }
  publishClockTick()
  scheduleClockTick()
}

function resolveDisplayDate () {
  return displayDate.value || todayYmdInAppTimeZone()
}

function getEventsSignature (events) {
  return (events || [])
    .map((e) => [e?.id, e?.startTime, e?.endTime, e?.topic, e?.isBlocked ? '1' : '0'].join('\u0001'))
    .join('\u0002')
}

function applyVenueInfo (venue) {
  if (!venue) return
  const displayName = String(venue.displayName || '').trim()
  const name = displayName || venue.name || ''
  const nameZh = venue.nameZh || ''
  if (venueName.value !== name) venueName.value = name
  if (venueNameZh.value !== nameZh) venueNameZh.value = nameZh
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
  if (!venueId.value) {
    replaceTodayEvents([])
    venueName.value = ''
    venueNameZh.value = ''
    signalDisplayReady()
    return
  }

  const data = await getVenuePublicDisplay(venueId.value, resolveDisplayDate())
  if (replaceVenueDisplayRoute(router, route, data?.venue?.displayType)) return
  dataPoll.applyFromPayload(data?.dataPollIntervalMs)
  applyVenueInfo(data?.venue)
  replaceTodayEvents(data?.events)
  syncActiveEventKeys(lastClockTime)
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
    startClock()
    void pollDisplayDataFromServer()
  }
}

useDisplayLiveRefresh(['venue'], pollDisplayDataFromServer)

function waitPaint () {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  })
}

function listOverflows (listEl) {
  if (!listEl) return false
  return listEl.scrollHeight > listEl.clientHeight + 1
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
  return Math.max(0.45, Math.floor(low * 1000) / 1000)
}

async function fitScheduleLayout () {
  const count = scheduleRows.value.length
  if (!count) {
    if (layoutScale.value !== 1) layoutScale.value = 1
    return
  }

  await nextTick()
  await waitPaint()

  const listEl = scheduleListRef.value
  if (!listEl || listEl.clientHeight <= 0) return

  const current = layoutScale.value
  if (listOverflows(listEl)) {
    layoutScale.value = await binarySearchScale(listEl, 0.45, Math.max(current, 0.45))
  } else if (current < 0.999) {
    layoutScale.value = await binarySearchScale(listEl, current, 1)
  } else {
    layoutScale.value = 1
  }
}

async function fitRoomTitle () {
  const el = roomTitleRef.value
  if (!el) return
  el.style.setProperty('--title-scale', '1')
  await nextTick()
  await waitPaint()
  const width = el.clientWidth
  if (width <= 0) return
  if (el.scrollWidth <= width + 1) return

  let low = 0.45
  let high = 1
  for (let i = 0; i < 10; i++) {
    const mid = (low + high) / 2
    el.style.setProperty('--title-scale', String(mid))
    await waitPaint()
    if (el.scrollWidth > width + 1) high = mid
    else low = mid
  }
  el.style.setProperty('--title-scale', String(Math.max(0.45, low)))
}

function scheduleFitLayout () {
  if (fitLayoutTimer) clearTimeout(fitLayoutTimer)
  fitLayoutTimer = setTimeout(() => {
    fitLayoutTimer = null
    void fitRoomTitle()
    void fitScheduleLayout()
  }, 40)
}

watch(roomTitle, () => {
  scheduleFitLayout()
})

watch(scheduleRows, () => {
  scheduleFitLayout()
})

watch(
  () => route.query,
  () => {
    const next = readDisplayQuery()
    const changed =
      next.venueId !== String(venueId.value || '') ||
      next.date !== String(displayDate.value || '')
    venueId.value = next.venueId
    displayDate.value = next.date
    if (changed) {
      void pollDisplayDataFromServer()
    }
  },
  { deep: true }
)

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

  scheduleFitLayout()
}

onMounted(() => {
  resetDisplayReady()
  document.documentElement.classList.add('light-display-fullscreen')
  adaptFullscreen()
  window.addEventListener('resize', adaptFullscreen)
  window.visualViewport?.addEventListener('resize', adaptFullscreen)

  startClock()

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
      scheduleFitLayout()
    }).catch(() => {})
  }

  const viewport = document.querySelector('meta[name="viewport"]')
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
  }
})

onUnmounted(() => {
  document.documentElement.classList.remove('light-display-fullscreen')
  dataPoll.stop()
  if (clockTimer) clearTimeout(clockTimer)
  if (fitLayoutTimer) clearTimeout(fitLayoutTimer)
  document.removeEventListener('visibilitychange', onDocumentVisibilityChange)
  window.removeEventListener('resize', adaptFullscreen)
  window.visualViewport?.removeEventListener('resize', adaptFullscreen)
})
</script>

<style>
html.light-display-fullscreen {
  zoom: 1 !important;
}

html.light-display-fullscreen #app {
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

.light-display-viewport {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #e8eef5;
  user-select: none;
  touch-action: none;
}

.light-display-root {
  --light-navy: #1a2b4a;
  --light-navy-soft: #2c3e5c;
  --light-muted: #8a94a6;
  --light-line: #e2e8f0;
  /* 与 Wise 黑色 UI 一致：仅红 / 绿 */
  --light-active: #e04545;
  --light-active-soft: rgba(224, 69, 69, 0.12);
  --light-idle: #3dba6e;
  --light-idle-soft: rgba(61, 186, 110, 0.12);
  --light-grey: #94a3b8;
  --light-sans: var(--display-font-family);

  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  box-sizing: border-box;
  width: 1080px;
  height: 1920px;
  padding: 40px 52px 0;
  background:
    radial-gradient(ellipse 90% 50% at 100% 0%, rgba(61, 186, 110, 0.06), transparent 50%),
    radial-gradient(ellipse 70% 40% at 0% 100%, rgba(224, 69, 69, 0.05), transparent 45%),
    linear-gradient(180deg, #ffffff 0%, #f7f9fc 55%, #eef2f7 100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: var(--light-sans);
  color: var(--light-navy);
  transform-origin: top left;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  -webkit-touch-callout: none;
}

.light-display-root * {
  touch-action: manipulation;
  box-sizing: border-box;
}

.light-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-width: 0;
  margin-bottom: 22px;
}

.light-logo-bar {
  flex: 1 1 auto;
  width: auto;
  min-width: 0;
  max-width: 48%;
  height: auto;
  max-height: 132px;
  object-fit: contain;
  object-position: left center;
}

.light-datetime {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 50%;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.light-date-line {
  max-width: 100%;
  font-size: 28px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--light-muted);
  line-height: 1.2;
  white-space: nowrap;
}

.light-time {
  font-size: 88px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 0.95;
  color: var(--light-navy);
  font-variant-numeric: tabular-nums;
}

.light-accent-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  height: 16px;
  margin-bottom: 36px;
}

.light-accent-line {
  flex: 1;
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, #c5ced9 12%, #1a2f4d 50%, #c5ced9 88%, transparent);
}

.light-accent-diamond {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  background: #1a2f4d;
  transform: rotate(45deg);
}

.light-room {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 48px;
  margin-bottom: 40px;
}

.light-room-title {
  --title-scale: 1;
  margin: 0;
  flex: 1;
  min-width: 0;
  /* 参考图2 Lecture Theatre：几何无衬线、字距更紧，单行不换行 */
  font-family: Arial, Helvetica, 'Helvetica Neue', 'Microsoft YaHei', '微软雅黑', sans-serif;
  font-size: calc(88px * var(--title-scale, 1));
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #1a2f4d;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
}

.light-status-pill {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 10px 18px;
  border-radius: 999px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #fff;
  white-space: nowrap;
}

.light-status-pill.is-in-use {
  background: var(--light-active);
  box-shadow: 0 0 18px rgba(224, 69, 69, 0.28);
}

.light-status-pill.is-available {
  background: var(--light-idle);
  box-shadow: 0 0 18px rgba(61, 186, 110, 0.28);
}

.light-schedule {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin-bottom: 16px;
}

.light-schedule-title {
  flex-shrink: 0;
  margin: 0 0 calc(8px * var(--layout-scale, 1));
  padding-block: 0;
  font-size: calc(46px * var(--layout-scale, 1));
  font-weight: 700;
  color: var(--light-navy);
  letter-spacing: 0.04em;
  line-height: 1.35;
}

.light-schedule-panel {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: calc(12px * var(--layout-scale, 1));
  padding: calc(12px * var(--layout-scale, 1));
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(226, 232, 240, 0.9);
}

.light-schedule-row {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr) auto;
  align-items: start;
  gap: calc(24px * var(--layout-scale, 1));
  min-height: 0;
  padding: calc(20px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
  border-radius: 14px;
  background: transparent;
  border: 1.5px solid transparent;
}

.light-schedule-row.is-now {
  background: var(--light-active-soft);
  border-color: rgba(224, 69, 69, 0.45);
}

.light-schedule-row.is-past .light-row-range,
.light-schedule-row.is-past .light-row-topic {
  color: var(--light-muted);
}

.light-schedule-row.is-now .light-row-range,
.light-schedule-row.is-future .light-row-range {
  color: #111111;
}

.light-schedule-row.is-now .light-row-topic {
  color: var(--light-active);
}

.light-schedule-row.is-future .light-row-topic {
  color: var(--light-idle);
}

.light-row-time {
  min-width: 0;
}

.light-row-range {
  display: block;
  padding-block: calc(4px * var(--layout-scale, 1));
  font-size: calc(44px * var(--layout-scale, 1));
  font-weight: 700;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  line-height: 1.4;
}

.light-row-topic {
  font-size: calc(48px * var(--layout-scale, 1));
  font-weight: 600;
  line-height: 1.4;
  min-width: 0;
  width: 100%;
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: normal;
}

.light-row-dot {
  width: calc(22px * var(--layout-scale, 1));
  height: calc(22px * var(--layout-scale, 1));
  margin-top: calc(14px * var(--layout-scale, 1));
  border-radius: 50%;
  flex-shrink: 0;
  justify-self: end;
}

.light-schedule-row.is-past .light-row-dot {
  background: var(--light-muted);
}

.light-schedule-row.is-now .light-row-dot {
  background: var(--light-active);
}

.light-schedule-row.is-future .light-row-dot {
  background: var(--light-idle);
}

.light-no-schedule {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--light-line);
  color: var(--light-muted);
}

.light-no-schedule-en {
  font-size: 38px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.light-no-schedule-zh {
  font-size: 28px;
  font-weight: 500;
}

.light-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 -52px;
  padding: 8px 52px;
  background: rgba(241, 245, 249, 0.95);
  border-top: 1px solid var(--light-line);
}

.light-logo-icon {
  width: 96px;
  height: 96px;
  object-fit: contain;
  flex-shrink: 0;
}

.light-error {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 16px;
  color: var(--light-navy);
  padding: 0 40px;
}

.light-error-en {
  font-size: 48px;
  font-weight: 700;
}

.light-error-zh {
  font-size: 36px;
  font-weight: 500;
  color: var(--light-muted);
}

.light-error-hint {
  margin-top: 8px;
  font-size: 26px;
  opacity: 0.75;
  word-break: break-all;
}
</style>
