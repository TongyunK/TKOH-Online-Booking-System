<template>
  <!-- 视口铺满；内部固定 1080×1920 竖向设计稿，整体 transform 等比缩放并居中 -->
  <div ref="displayViewport" class="wise-display-viewport">
    <div ref="displayRoot" class="wise-display-root">
      <!-- 顶部横条 Logo -->
      <header class="wise-header">
        <img :src="logoBarSrc" alt="Wise System" class="wise-logo-bar" />
      </header>

      <div class="wise-divider wise-divider-logo" aria-hidden="true">
        <span class="wise-divider-line" />
        <span class="wise-divider-diamond" />
        <span class="wise-divider-line" />
      </div>

      <!-- 日期 / 时钟（参考图二：日期一行 + 大时钟） -->
      <div class="wise-datetime">
        <div class="wise-date-line">{{ dateLabel }} {{ weekdayZh }} {{ weekdayEn }}</div>
        <div class="wise-time">{{ currentTime }}</div>
      </div>

      <!-- 房间标题 -->
      <div class="wise-room">
        <div class="wise-room-zh">{{ roomTitleZh }}</div>
        <div class="wise-room-en">{{ roomTitleEn }}</div>
      </div>

      <div class="wise-divider" aria-hidden="true">
        <span class="wise-divider-line" />
        <span class="wise-divider-diamond" />
        <span class="wise-divider-line" />
      </div>

      <div
        v-if="missingVenueId"
        class="wise-error"
      >
        <div class="wise-error-en">Missing venueId</div>
        <div class="wise-error-zh">網址缺少 venueId 參數</div>
        <div class="wise-error-hint">Use ?venueId=7</div>
      </div>

      <template v-else>
        <!-- 当前会议状态：左状态 / 右会议名 + 剩余时间 -->
        <section class="wise-current" :style="contentLayoutStyle">
          <div
            class="wise-current-card"
            :class="currentMeeting ? 'is-in-use' : 'is-available'"
          >
            <div class="wise-current-card-title">
              <span class="wise-section-zh">當前會議狀態</span>
              <span class="wise-section-en">CURRENT STATUS</span>
            </div>
            <div class="wise-current-card-body">
              <div class="wise-current-left">
                <div
                  class="wise-status-pill"
                  :class="currentMeeting ? 'is-in-use' : 'is-available'"
                >
                  <span class="wise-status-zh">{{ roomStatusZh }}</span>
                  <span class="wise-status-en">{{ roomStatusEn }}</span>
                </div>
              </div>
              <div class="wise-current-vdivider" aria-hidden="true" />
              <div class="wise-current-right">
                <div
                  ref="currentTopicRef"
                  class="wise-current-topic"
                  :title="currentMeeting?.topic || emptyMeetingZh"
                >
                  {{ currentMeeting?.topic || emptyMeetingZh }}
                </div>
                <div
                  v-if="remainingLabel"
                  class="wise-current-remain"
                >{{ remainingLabel }}</div>
                <div
                  v-else
                  class="wise-current-remain is-muted"
                >{{ emptyMeetingEn }}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- 今日预定：进行中红色，其余绿色 -->
        <section class="wise-schedule" :style="contentLayoutStyle">
          <div class="wise-section-label wise-section-label-schedule">
            <span class="wise-section-zh">今日預定</span>
            <span class="wise-section-en">TODAY'S BOOKINGS</span>
          </div>

          <div class="wise-bookings-frame">
            <div
              v-if="sortedTodayEvents.length"
              ref="bookingsListRef"
              class="wise-bookings-panel"
            >
              <div
                v-for="event in sortedTodayEvents"
                :key="getEventKey(event)"
                class="wise-booking-row"
                :class="`is-${bookingPhase(event)}`"
              >
                <div class="wise-booking-time">
                  {{ event.startTime }} – {{ event.endTime }}
                </div>
                <div
                  class="wise-booking-topic"
                  :title="event.topic"
                >{{ event.topic }}</div>
                <span class="wise-booking-dot" aria-hidden="true" />
              </div>
            </div>
            <div v-else class="wise-no-bookings">
              <div class="wise-no-bookings-zh">今日暫無預定</div>
              <div class="wise-no-bookings-en">NO BOOKINGS TODAY</div>
            </div>
          </div>
        </section>
      </template>

      <!-- 底部 Logo Icon -->
      <footer class="wise-footer">
        <img :src="logoIconSrc" alt="Wise System" class="wise-logo-icon" />
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
const emptyMeetingZh = '暫無會議'
const emptyMeetingEn = 'NO MEETING IN PROGRESS'
const publicBase = import.meta.env.BASE_URL || '/'
const logoBarSrc = `${publicBase}WiseSystem_logo_display.svg`
const logoIconSrc = `${publicBase}WiseSystem_icon.svg`

let adaptRetryCount = 0
let clockTimer = null
let lastClockTime = ''
let lastYmd = ''
let activeEventKeysSig = ''
let fitLayoutTimer = null

const displayViewport = ref(null)
const displayRoot = ref(null)
const bookingsListRef = ref(null)
const currentTopicRef = ref(null)

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
const weekdayZh = ref('')
const weekdayEn = ref('')
const currentTime = ref('')

const venueName = ref('')
const venueNameZh = ref('')
const allTodayEvents = ref([])
const activeEventKeys = ref(new Set())
const layoutScale = ref(1)

const missingVenueId = computed(() => !String(venueId.value || '').trim())

const roomTitleZh = computed(() => {
  const zh = String(venueNameZh.value || '').trim()
  if (zh) return zh
  return '會議室'
})

const roomTitleEn = computed(() => {
  const en = String(venueName.value || '').trim()
  if (en) return en
  return 'MEETING ROOM'
})

const contentLayoutStyle = computed(() => ({
  '--layout-scale': String(layoutScale.value),
  '--booking-slot-count': String(Math.max(sortedTodayEvents.value.length, 1))
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

const currentMeeting = computed(() => {
  for (const event of sortedTodayEvents.value) {
    if (activeEventKeys.value.has(getEventKey(event))) return event
  }
  return null
})

const roomStatusZh = computed(() => (currentMeeting.value ? '使用中' : '空閒'))
const roomStatusEn = computed(() => (currentMeeting.value ? 'IN USE' : 'AVAILABLE'))

const remainingLabel = computed(() => {
  const meeting = currentMeeting.value
  if (!meeting) return ''
  const nowMin = parseHmToMinutes(currentTime.value || lastClockTime)
  const endMin = parseHmToMinutes(meeting.endTime)
  if (nowMin == null || endMin == null) return ''
  const left = Math.max(0, endMin - nowMin)
  const enUnit = left === 1 ? 'MIN LEFT' : 'MINS LEFT'
  return `剩餘 ${left} 分鐘 · ${left} ${enUnit}`
})

function bookingPhase (event) {
  if (activeEventKeys.value.has(getEventKey(event))) return 'current'
  const nowMin = parseHmToMinutes(currentTime.value || lastClockTime)
  const end = parseHmToMinutes(event?.endTime)
  if (nowMin != null && end != null && nowMin >= end) return 'past'
  return 'future'
}

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
  weekdayZh.value = parts.weekdayZh
  weekdayEn.value = String(parts.weekdayEn || '').toUpperCase()
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
    .map((e) => [e?.id, e?.startTime, e?.endTime, e?.topic].join('\u0001'))
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
  if (listEl.scrollHeight > listEl.clientHeight + 1) return true
  const rows = listEl.querySelectorAll('.wise-booking-row')
  for (const row of rows) {
    if (row.scrollHeight > row.clientHeight + 1) return true
  }
  return false
}

function getBookingsListEl () {
  return bookingsListRef.value
}

/**
 * 长文本自适应：
 * 1) 先尝试单行完整显示
 * 2) 放不下则改为最多 maxLines 行换行
 * 3) 仍溢出则缩小字号，最后用省略号兜底
 */
async function fitFlexibleText (el, { maxLines = 2, minScale = 0.55 } = {}) {
  if (!el) return
  el.style.setProperty('--topic-scale', '1')
  el.classList.remove('is-multiline')
  el.classList.remove('is-clamped')
  el.style.whiteSpace = ''
  el.style.display = ''
  el.style.removeProperty('-webkit-line-clamp')
  el.style.removeProperty('-webkit-box-orient')
  el.style.overflow = ''
  el.style.textOverflow = ''
  await nextTick()
  await waitPaint()

  const width = el.clientWidth
  if (width <= 0) return

  // 单行是否放得下
  el.style.whiteSpace = 'nowrap'
  el.style.display = 'block'
  el.style.overflow = 'visible'
  await waitPaint()
  if (el.scrollWidth <= width + 1) {
    el.style.overflow = 'hidden'
    el.style.textOverflow = 'ellipsis'
    return
  }

  // 改为多行（先不 clamp，便于测量真实高度），并按需缩小字号
  el.classList.add('is-multiline')
  el.style.whiteSpace = 'normal'
  el.style.display = 'block'
  el.style.overflow = 'visible'

  let low = minScale
  let high = 1
  for (let i = 0; i < 10; i++) {
    const mid = (low + high) / 2
    el.style.setProperty('--topic-scale', String(Math.floor(mid * 1000) / 1000))
    await waitPaint()
    const styles = getComputedStyle(el)
    const lineHeight = Number.parseFloat(styles.lineHeight)
    const fontSize = Number.parseFloat(styles.fontSize) || 1
    const resolvedLine = Number.isFinite(lineHeight) ? lineHeight : fontSize * 1.4
    const maxHeight = resolvedLine * maxLines + 2
    if (el.scrollHeight > maxHeight + 1) {
      high = mid
    } else {
      low = mid
    }
  }

  const next = Math.max(minScale, Math.floor(low * 1000) / 1000)
  el.style.setProperty('--topic-scale', String(next))
  el.classList.add('is-clamped')
  el.style.display = '-webkit-box'
  el.style.setProperty('-webkit-box-orient', 'vertical')
  el.style.setProperty('-webkit-line-clamp', String(maxLines))
  el.style.overflow = 'hidden'
  el.style.textOverflow = 'ellipsis'
  await waitPaint()
}

async function fitAllFlexibleTexts () {
  await fitFlexibleText(currentTopicRef.value, { maxLines: 3, minScale: 0.68 })
  const listEl = getBookingsListEl()
  if (!listEl) return
  const topics = listEl.querySelectorAll('.wise-booking-topic')
  for (const el of topics) {
    await fitFlexibleText(el, { maxLines: 2, minScale: 0.72 })
  }
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
  return Math.max(0.4, Math.floor(low * 1000) / 1000)
}

async function fitBookingsLayout () {
  const count = sortedTodayEvents.value.length
  if (!count) {
    if (layoutScale.value !== 1) layoutScale.value = 1
    await fitFlexibleText(currentTopicRef.value, { maxLines: 3, minScale: 0.68 })
    return
  }

  await nextTick()
  await waitPaint()

  const listEl = getBookingsListEl()
  if (!listEl || listEl.clientHeight <= 0) {
    await fitAllFlexibleTexts()
    return
  }

  const current = layoutScale.value
  if (listOverflows(listEl)) {
    layoutScale.value = await binarySearchScale(listEl, 0.45, Math.max(current, 0.45))
  } else if (current < 0.999) {
    layoutScale.value = await binarySearchScale(listEl, current, 1)
  } else {
    layoutScale.value = 1
  }

  await fitAllFlexibleTexts()
}

function scheduleFitBookingsLayout () {
  if (fitLayoutTimer) clearTimeout(fitLayoutTimer)
  fitLayoutTimer = setTimeout(() => {
    fitLayoutTimer = null
    void fitBookingsLayout()
  }, 40)
}

watch(sortedTodayEvents, () => {
  syncActiveEventKeys()
  scheduleFitBookingsLayout()
})

watch(currentMeeting, () => {
  scheduleFitBookingsLayout()
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

  scheduleFitBookingsLayout()
}

onMounted(() => {
  resetDisplayReady()
  document.documentElement.classList.add('wise-display-fullscreen')
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
      scheduleFitBookingsLayout()
    }).catch(() => {})
  }

  const viewport = document.querySelector('meta[name="viewport"]')
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
  }
})

onUnmounted(() => {
  document.documentElement.classList.remove('wise-display-fullscreen')
  dataPoll.stop()
  if (clockTimer) clearTimeout(clockTimer)
  if (fitLayoutTimer) clearTimeout(fitLayoutTimer)
  document.removeEventListener('visibilitychange', onDocumentVisibilityChange)
  window.removeEventListener('resize', adaptFullscreen)
  window.visualViewport?.removeEventListener('resize', adaptFullscreen)
})
</script>

<style>
html.wise-display-fullscreen {
  zoom: 1 !important;
}

html.wise-display-fullscreen #app {
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

.wise-display-viewport {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #05080f;
  user-select: none;
  touch-action: none;
}

.wise-display-root {
  --wise-bg: #07111f;
  --wise-gold: #c9a45c;
  --wise-gold-soft: rgba(201, 164, 92, 0.55);
  --wise-text: #f3ead6;
  --wise-muted: rgba(243, 234, 214, 0.72);
  --wise-active: #e04545;
  --wise-idle: #3dba6e;
  --wise-serif: 'Noto Serif TC', 'Source Han Serif TC', 'Songti TC', 'STSong', 'Times New Roman', serif;
  --wise-sans: var(--display-font-family);

  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  box-sizing: border-box;
  width: 1080px;
  height: 1920px;
  padding: 36px 52px 28px;
  background:
    radial-gradient(ellipse 120% 70% at 50% -10%, rgba(201, 164, 92, 0.1), transparent 55%),
    linear-gradient(180deg, #0b1830 0%, var(--wise-bg) 42%, #050a14 100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: var(--wise-sans);
  color: var(--wise-text);
  transform-origin: top left;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  -webkit-touch-callout: none;
}

.wise-display-root * {
  touch-action: manipulation;
  box-sizing: border-box;
}

.wise-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  padding: 0 40px;
}

.wise-logo-bar {
  width: min(860px, 100%);
  height: auto;
  max-height: 140px;
  object-fit: contain;
  /* logo 图形偏左，略向右偏移以视觉居中 */
  transform: translateX(28px);
  filter: drop-shadow(0 2px 14px rgba(201, 164, 92, 0.35));
}

.wise-datetime {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-bottom: 22px;
}

.wise-date-line {
  font-size: 34px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--wise-text);
  line-height: 1.2;
  text-align: center;
  white-space: nowrap;
}

.wise-time {
  font-family: var(--wise-serif);
  font-size: 128px;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 0.92;
  color: var(--wise-gold);
  font-variant-numeric: tabular-nums;
}

.wise-room {
  flex-shrink: 0;
  text-align: center;
  padding: 4px 8px 10px;
}

.wise-room-zh {
  font-family: var(--wise-serif);
  font-size: 114px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--wise-gold);
  line-height: 1.12;
  margin-bottom: 6px;
}

.wise-room-en {
  font-family: var(--wise-serif);
  font-size: 48px;
  font-weight: 600;
  letter-spacing: 0.28em;
  color: var(--wise-gold);
  line-height: 1.2;
  text-transform: uppercase;
}

.wise-divider {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 4px 0 18px;
  padding: 0 8px;
}

.wise-divider-logo {
  margin: 0 0 18px;
}

.wise-divider-sm {
  margin: 6px 0 14px;
}

.wise-divider-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--wise-gold-soft), transparent);
}

.wise-divider-diamond {
  width: 8px;
  height: 8px;
  background: var(--wise-gold);
  transform: rotate(45deg);
  flex-shrink: 0;
  opacity: 0.9;
}

.wise-section-label {
  flex-shrink: 0;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 12px;
  margin-bottom: calc(14px * var(--layout-scale, 1));
}

.wise-section-label-schedule {
  flex-direction: column;
  align-items: center;
  gap: calc(3px * var(--layout-scale, 1));
  margin-bottom: calc(20px * var(--layout-scale, 1));
}

.wise-section-label-schedule .wise-section-zh {
  font-size: calc(46px * var(--layout-scale, 1));
  letter-spacing: 0.16em;
  line-height: 1.15;
}

.wise-section-label-schedule .wise-section-en {
  font-size: calc(28px * var(--layout-scale, 1));
  letter-spacing: 0.18em;
  line-height: 1.15;
}

.wise-section-zh {
  font-family: var(--wise-serif);
  font-size: calc(34px * var(--layout-scale, 1));
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--wise-gold);
  white-space: nowrap;
}

.wise-section-en {
  font-size: calc(20px * var(--layout-scale, 1));
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--wise-muted);
  text-transform: uppercase;
  white-space: nowrap;
}

.wise-current {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 0 4px;
}

.wise-current-card {
  border: 1.5px solid var(--wise-gold-soft);
  border-radius: 18px;
  padding: calc(22px * var(--layout-scale, 1)) calc(28px * var(--layout-scale, 1)) calc(26px * var(--layout-scale, 1));
  background: rgba(201, 164, 92, 0.05);
  display: flex;
  flex-direction: column;
  gap: calc(18px * var(--layout-scale, 1));
  min-height: calc(200px * var(--layout-scale, 1));
}

.wise-current-card.is-in-use {
  border-color: rgba(224, 69, 69, 0.4);
  background: rgba(224, 69, 69, 0.06);
}

.wise-current-card.is-available {
  border-color: rgba(61, 186, 110, 0.35);
  background: rgba(61, 186, 110, 0.05);
}

.wise-current-card-title {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 12px;
  padding-bottom: calc(14px * var(--layout-scale, 1));
  border-bottom: 1px solid var(--wise-gold-soft);
}

.wise-current-card-title .wise-section-en {
  font-size: calc(26px * var(--layout-scale, 1));
  letter-spacing: 0.12em;
}

.wise-current-card-body {
  flex: 1;
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: calc(24px * var(--layout-scale, 1));
  min-height: calc(120px * var(--layout-scale, 1));
}

.wise-current-left {
  display: flex;
  align-items: center;
  justify-content: center;
  width: max-content;
  max-width: calc(220px * var(--layout-scale, 1));
}

.wise-status-pill {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  padding: calc(14px * var(--layout-scale, 1)) calc(18px * var(--layout-scale, 1));
  border-radius: 999px;
  line-height: 1.15;
}

.wise-status-pill.is-in-use {
  background: var(--wise-active);
  box-shadow: 0 0 18px rgba(224, 69, 69, 0.4);
}

.wise-status-pill.is-available {
  background: var(--wise-idle);
  box-shadow: 0 0 18px rgba(61, 186, 110, 0.35);
}

.wise-status-zh {
  font-family: var(--wise-serif);
  font-size: calc(34px * var(--layout-scale, 1));
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #fff;
}

.wise-status-en {
  font-size: calc(18px * var(--layout-scale, 1));
  font-weight: 700;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.92);
  text-transform: uppercase;
}

.wise-current-vdivider {
  width: 1px;
  align-self: stretch;
  background: linear-gradient(
    180deg,
    transparent,
    var(--wise-gold-soft) 18%,
    var(--wise-gold-soft) 82%,
    transparent
  );
}

.wise-current-right {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(12px * var(--layout-scale, 1));
  min-width: 0;
  text-align: center;
  padding: 0 calc(8px * var(--layout-scale, 1));
}

.wise-current-topic {
  --topic-scale: 1;
  font-family: var(--wise-serif);
  font-size: calc(56px * var(--layout-scale, 1) * var(--topic-scale, 1));
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--wise-text);
  line-height: 1.35;
  max-width: 100%;
  width: 100%;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.wise-current-topic.is-multiline {
  text-align: center;
}

.wise-current-remain {
  font-size: calc(32px * var(--layout-scale, 1));
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--wise-gold);
  line-height: 1.2;
}

.wise-current-remain.is-muted {
  font-size: calc(20px * var(--layout-scale, 1));
  letter-spacing: 0.12em;
  color: var(--wise-muted);
  text-transform: uppercase;
}

.wise-schedule {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-top: calc(20px * var(--layout-scale, 1));
  padding: 0 4px;
  overflow: visible;
}

.wise-bookings-frame {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-top: 6px;
  border: 2px solid rgba(201, 164, 92, 0.4);
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.18);
  box-sizing: border-box;
  /* 边框与 overflow 分离，避免圆角裁切描边 */
  overflow: visible;
  padding: 2px;
}

.wise-bookings-frame > .wise-bookings-panel,
.wise-bookings-frame > .wise-no-bookings {
  border-radius: 12px;
  overflow: hidden;
}

.wise-bookings-panel {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: calc(10px * var(--layout-scale, 1));
  border: none;
  border-radius: 0;
  padding: calc(20px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
  background: transparent;
  box-sizing: border-box;
}

.wise-booking-row {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr) auto;
  align-items: center;
  gap: calc(20px * var(--layout-scale, 1));
  min-height: calc(110px * var(--layout-scale, 1));
  overflow: visible;
  padding: calc(22px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
  border-radius: 12px;
  border: 1.5px solid transparent;
  background: transparent;
  box-sizing: border-box;
  flex-shrink: 0;
}

/* 分隔线只加在非当前项之间，避免盖住当前项金色上边框 */
.wise-booking-row + .wise-booking-row:not(.is-current) {
  border-top: 1px solid rgba(201, 164, 92, 0.18);
}

.wise-booking-row.is-current + .wise-booking-row:not(.is-current) {
  border-top: 1px solid rgba(201, 164, 92, 0.18);
}

.wise-booking-row.is-current {
  border: 2px solid var(--wise-gold);
  background: transparent;
  border-radius: 12px;
  margin: calc(4px * var(--layout-scale, 1)) 0;
  box-shadow:
    inset 0 0 0 0.5px rgba(243, 230, 192, 0.45),
    0 0 12px rgba(201, 164, 92, 0.22);
}

.wise-booking-row.is-past .wise-booking-time,
.wise-booking-row.is-future .wise-booking-time,
.wise-booking-row.is-past .wise-booking-topic {
  color: rgba(243, 234, 214, 0.62);
}

.wise-booking-row.is-current .wise-booking-time {
  color: var(--wise-gold);
}

.wise-booking-row.is-current .wise-booking-topic {
  color: var(--wise-active);
}

.wise-booking-row.is-future .wise-booking-topic {
  color: var(--wise-idle);
}

.wise-booking-dot {
  width: calc(26px * var(--layout-scale, 1));
  height: calc(26px * var(--layout-scale, 1));
  border-radius: 50%;
  flex-shrink: 0;
  justify-self: end;
}

.wise-booking-row.is-past .wise-booking-dot {
  background: rgba(243, 234, 214, 0.45);
  box-shadow: none;
}

.wise-booking-row.is-current .wise-booking-dot {
  background: var(--wise-active);
  box-shadow: 0 0 8px rgba(224, 69, 69, 0.5);
}

.wise-booking-row.is-future .wise-booking-dot {
  background: var(--wise-idle);
  box-shadow: 0 0 6px rgba(61, 186, 110, 0.35);
}

.wise-booking-time {
  font-family: var(--wise-serif);
  font-size: calc(44px * var(--layout-scale, 1));
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.45;
  width: max-content;
  max-width: none;
  padding-block: 2px;
  white-space: nowrap;
}

.wise-booking-topic {
  --topic-scale: 1;
  font-family: var(--wise-serif);
  font-size: calc(52px * var(--layout-scale, 1) * var(--topic-scale, 1));
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.4;
  text-align: left;
  min-width: 0;
  width: 100%;
  padding-block: 2px;
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wise-booking-topic.is-multiline {
  white-space: normal;
}

.wise-no-bookings {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--wise-muted);
  border: none;
  background: transparent;
}

.wise-no-bookings-zh {
  font-family: var(--wise-serif);
  font-size: 38px;
  font-weight: 600;
  letter-spacing: 0.12em;
}

.wise-no-bookings-en {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0.16em;
}

.wise-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 18px;
}

.wise-logo-icon {
  width: 88px;
  height: 88px;
  object-fit: contain;
  opacity: 0.95;
}

.wise-error {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 16px;
  color: var(--wise-text);
  padding: 0 40px;
}

.wise-error-en {
  font-size: 48px;
  font-weight: 700;
}

.wise-error-zh {
  font-size: 40px;
  font-weight: 600;
  color: var(--wise-muted);
}

.wise-error-hint {
  margin-top: 8px;
  font-size: 28px;
  opacity: 0.8;
  word-break: break-all;
}
</style>
