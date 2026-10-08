<template>
  <!-- 铺满任意比例屏幕；字号/间距用 --ui-scale，不锁死 16:9 -->
  <div ref="displayRoot" class="tea-display-root">
    <header class="tea-header">
      <div class="header-title">茶水服務</div>
      <div class="header-datetime">{{ headerDateTime }}</div>
    </header>

    <main class="tea-schedule">
      <template v-for="(dateGroup, dateIdx) in groupedByDate" :key="dateGroup.date">
        <section class="day-section">
          <div class="schedule-header">
            <div class="date-label">
              {{ formatSlashDateFromYmd(dateGroup.date) }}<span v-if="dateGroup.isToday" class="date-today-tag">(今日)</span>
            </div>
            <div class="slot-col period-am">上午</div>
            <div class="period-divider" aria-hidden="true"></div>
            <div class="slot-col period-pm">下午</div>
          </div>

          <div v-if="dateGroup.venues.length" class="schedule-body">
            <div
              v-for="venueGroup in dateGroup.venues"
              :key="`${dateGroup.date}-${venueGroup.venueKey}`"
              class="venue-row"
            >
              <div class="room-col room-name">{{ venueGroup.venueName }}</div>

              <div class="slot-col period-am">
                <div
                  v-for="request in venueGroup.am"
                  :key="request.bookingId || request.id"
                  class="service-entry service-entry-am"
                  :class="{
                    completed: request.completed,
                    'is-read-only': !dateGroup.isToday
                  }"
                  @click="dateGroup.isToday && toggleRequest(request)"
                >
                  <span class="entry-time">{{ formatTimeDisplay(request.time) }}</span>
                  <span
                    class="entry-details"
                    :class="entryDetailsClass(request)"
                  >{{ formatTeaDetails(request) }}</span>
                  <div class="entry-done" @click.stop>
                    <el-checkbox
                      :model-value="request.completed"
                      :disabled="!dateGroup.isToday"
                      @update:model-value="(value) => setRequestCompleted(request, value)"
                    />
                  </div>
                </div>
                <div v-if="!venueGroup.am.length" class="entry-placeholder">-</div>
              </div>

              <div class="period-divider" aria-hidden="true"></div>

              <div class="slot-col period-pm">
                <div
                  v-for="request in venueGroup.pm"
                  :key="request.bookingId || request.id"
                  class="service-entry service-entry-pm"
                  :class="{
                    completed: request.completed,
                    'is-read-only': !dateGroup.isToday
                  }"
                  @click="dateGroup.isToday && toggleRequest(request)"
                >
                  <span class="entry-time">{{ formatTimeDisplay(request.time) }}</span>
                  <span
                    class="entry-details"
                    :class="entryDetailsClass(request)"
                  >{{ formatTeaDetails(request) }}</span>
                  <div class="entry-done" @click.stop>
                    <el-checkbox
                      :model-value="request.completed"
                      :disabled="!dateGroup.isToday"
                      @update:model-value="(value) => setRequestCompleted(request, value)"
                    />
                  </div>
                </div>
                <div v-if="!venueGroup.pm.length" class="entry-placeholder">-</div>
              </div>
            </div>
          </div>

          <div v-else class="empty-day">-</div>

          <div v-if="dateIdx < groupedByDate.length - 1" class="completed-banner">完</div>
        </section>
      </template>
    </main>
  </div>
  <DisplayFullscreenHint />
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  getTeaServicePublicDisplay,
  setTeaServiceRequestCompleted
} from '@/api/venueManagement'
import { useDisplayLiveRefresh, useDisplayDataPollTimer } from '@/composables/useDisplayLiveRefresh'
import DisplayFullscreenHint from '@/components/display/DisplayFullscreenHint.vue'
import { formatTeaServiceDisplay } from '@/utils/venueTeaService'
import {
  getAppDisplayDateTimeParts,
  msUntilNextAppMinute,
  todayYmdInAppTimeZone
} from '@/utils/appTimezone'
import { pickRouteQueryDate } from '@/utils/routeQuery'
import { MIN_DISPLAY_VIEWPORT_PX } from '@/utils/displayFullscreenScale'
import { resetDisplayReady, signalDisplayReady } from '@/utils/displayReadySignal'

const route = useRoute()

function resolveFromDate () {
  return (
    pickRouteQueryDate(route.query, 'fromDate', 'FromDate', 'from_date', 'date', 'Date') ||
    todayYmdInAppTimeZone()
  )
}

/**
 * 仅作缩放参考（不锁画布比例）：布局始终 100% 铺满屏幕。
 * 现场 Pad 比例未知时，多出的宽/高由 flex 网格吃掉，不会黑边。
 */
const REF_WIDTH = 1920
const REF_HEIGHT = 1080
let adaptRetryCount = 0

const displayRoot = ref(null)

const currentDateSlash = ref('')
const currentWeekdayZh = ref('')
const currentTime = ref('')
const teaRequests = ref([])
const teaDisplayVenues = ref([])
const displayDates = ref([])
let lastDisplayFromDate = ''

const headerDateTime = computed(() => {
  if (!currentDateSlash.value) return currentTime.value
  return `${currentDateSlash.value} ( ${currentWeekdayZh.value} ) ${currentTime.value}`
})

function updateDateTime () {
  const parts = getAppDisplayDateTimeParts()
  const nextWeekday = parts.weekdayZh.replace(/^星期/, '')
  const nextDate = `${parts.day}/${parts.month}/${parts.year}`
  const nextTime = `${parts.hour}:${parts.minute}`
  // 仅值变化时写 ref，避免 Android WebView 在整分 tick 时无意义重绘闪一下
  if (currentWeekdayZh.value !== nextWeekday) currentWeekdayZh.value = nextWeekday
  if (currentDateSlash.value !== nextDate) currentDateSlash.value = nextDate
  if (currentTime.value !== nextTime) currentTime.value = nextTime

  const fromDate = resolveFromDate()
  if (lastDisplayFromDate && fromDate !== lastDisplayFromDate) {
    void refreshDisplayData()
  }
}

function snapshotForCompare (value) {
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

function replaceRefIfChanged (targetRef, next) {
  if (snapshotForCompare(targetRef.value) === snapshotForCompare(next)) return false
  targetRef.value = next
  return true
}

function parseStartTime (timeStr) {
  if (!timeStr) return ''
  return timeStr.split('-')[0].trim()
}

function isAmRequest (timeStr) {
  const start = parseStartTime(timeStr)
  if (!start) return true
  const m = start.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return true
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (Number.isNaN(h) || Number.isNaN(min)) return true
  return h * 60 + min < 12 * 60
}

function compareVenueId (a, b) {
  const sa = String(a ?? '')
  const sb = String(b ?? '')
  if (/^\d+$/.test(sa) && /^\d+$/.test(sb)) {
    const diff = BigInt(sa) - BigInt(sb)
    return diff < 0n ? -1 : diff > 0n ? 1 : 0
  }
  return sa.localeCompare(sb)
}

function buildVenueGroupsForDate (requests, venues) {
  const buckets = new Map()

  // 先把所有可提供茶水的 venue 初始化出来，
  // 即使某天没有任何 requests，也要展示 venue 名称与“ - ”占位。
  if (Array.isArray(venues)) {
    for (const venue of venues) {
      const venueId = String(venue?.id ?? '')
      const venueName = venue?.nameZh || venue?.name || '-'
      if (!venueId) continue
      buckets.set(venueId, {
        venueKey: venueId,
        venueId,
        venueName,
        am: [],
        pm: [],
      })
    }
  }

  for (const request of requests) {
    const venueId = String(request.venueId || '')
    const venueKey = venueId || String(request.venueNameZh || request.venueName || '')
    if (!venueKey) continue

    // 若后端返回的 venues 列表里不存在该 venueId，则兜底创建，避免“数据漏显示”
    if (!buckets.has(venueKey)) {
      buckets.set(venueKey, {
        venueKey,
        venueId,
        venueName: request.venueNameZh || request.venueName || '-',
        am: [],
        pm: [],
      })
    }
    const bucket = buckets.get(venueKey)
    if (isAmRequest(request.time)) {
      bucket.am.push(request)
    } else {
      bucket.pm.push(request)
    }
  }

  const sortByTime = (list) =>
    [...list].sort((a, b) => parseStartTime(a.time).localeCompare(parseStartTime(b.time)))

  return [...buckets.values()]
    .map(group => ({
      ...group,
      am: sortByTime(group.am),
      pm: sortByTime(group.pm)
    }))
    .sort((a, b) => compareVenueId(a.venueId || a.venueKey, b.venueId || b.venueKey))
}

const groupedByDate = computed(() => {
  const dates = displayDates.value.length
    ? displayDates.value.slice(0, 2)
    : [todayYmdInAppTimeZone()]
  const today = todayYmdInAppTimeZone()

  return dates.map(date => ({
    date,
    isToday: date === today,
    venues: buildVenueGroupsForDate(
      teaRequests.value.filter(request => request.date === date),
      teaDisplayVenues.value
    )
  }))
})

function formatSlashDateFromYmd (ymd) {
  if (!ymd || !ymd.includes('-')) return ymd
  const [year, month, day] = ymd.split('-')
  return `${day}/${month}/${year}`
}

function formatTimeDisplay (timeStr) {
  if (!timeStr) return ''
  return String(timeStr).replace('-', ' – ')
}

function formatTeaDetails (request) {
  if (!request) return '-'
  if (!request.teaServiceRequired) {
    return formatTeaServiceDisplay(
      { option: 'none', attendees: request.attendees },
      request.attendees
    )
  }
  return formatTeaServiceDisplay(request.teaService, request.attendees)
}

function entryDetailsClass (request) {
  if (request.completed) return 'is-muted'
  return 'is-highlight'
}

const pendingCompletedUpdates = new Map()
const completingBookingIds = new Set()

function patchRequestInList (bookingId, completed) {
  const id = String(bookingId)
  const idx = teaRequests.value.findIndex(item => String(item.bookingId || item.id) === id)
  if (idx < 0) return
  teaRequests.value = [
    ...teaRequests.value.slice(0, idx),
    { ...teaRequests.value[idx], completed: Boolean(completed) },
    ...teaRequests.value.slice(idx + 1)
  ]
}

function mergePendingCompleted (requests) {
  if (!pendingCompletedUpdates.size) return requests
  return requests.map((row) => {
    const id = String(row.bookingId || row.id)
    const pending = pendingCompletedUpdates.get(id)
    return pending !== undefined ? { ...row, completed: pending } : row
  })
}

async function refreshDisplayData () {
  const fromDate = resolveFromDate()
  const data = await getTeaServicePublicDisplay(fromDate)
  dataPoll.applyFromPayload(data?.dataPollIntervalMs)
  const requests = mergePendingCompleted(
    Array.isArray(data?.requests) ? data.requests : []
  )
  const venues = Array.isArray(data?.venues) ? data.venues : []
  const dates = Array.isArray(data?.dates) && data.dates.length
    ? data.dates.slice(0, 2)
    : [fromDate]
  // 轮询结果未变时不替换数组引用，避免整表重挂载闪屏
  replaceRefIfChanged(teaDisplayVenues, venues)
  replaceRefIfChanged(displayDates, dates)
  replaceRefIfChanged(teaRequests, requests)
  lastDisplayFromDate = fromDate
  await nextTick()
  scheduleAdaptFullscreen()
  signalDisplayReady()
}

function canCompleteRequest (request) {
  const today = todayYmdInAppTimeZone()
  return String(request?.date || '') === today
}

async function setRequestCompleted (request, completed) {
  const bookingId = String(request.bookingId || request.id)
  if (!bookingId) return
  if (!canCompleteRequest(request)) return

  const normalized = Boolean(completed)
  const idx = teaRequests.value.findIndex(item => String(item.bookingId || item.id) === bookingId)
  const previous = idx >= 0 ? Boolean(teaRequests.value[idx].completed) : Boolean(request.completed)
  if (previous === normalized || completingBookingIds.has(bookingId)) return

  completingBookingIds.add(bookingId)
  pendingCompletedUpdates.set(bookingId, normalized)
  patchRequestInList(bookingId, normalized)

  try {
    const data = await setTeaServiceRequestCompleted(bookingId, normalized)
    const next = data?.request
    if (next) {
      patchRequestInList(bookingId, next.completed)
    } else {
      await refreshDisplayData()
    }
  } catch {
    patchRequestInList(bookingId, previous)
  } finally {
    completingBookingIds.delete(bookingId)
    pendingCompletedUpdates.delete(bookingId)
  }
}

function toggleRequest (request) {
  setRequestCompleted(request, !request.completed)
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

useDisplayLiveRefresh(['tea'], pollDisplayDataFromServer)

watch(
  () => route.query,
  () => {
    void pollDisplayDataFromServer()
  },
  { deep: true }
)

watch(groupedByDate, async () => {
  await nextTick()
  adaptDaySectionHeights()
})

/** 一天占满主区一屏；内容过多时再自然增高 */
function adaptDaySectionHeights () {
  const root = displayRoot.value
  if (!root) return
  const scheduleEl = root.querySelector('.tea-schedule')
  const pageHeight = scheduleEl?.clientHeight || 0
  if (pageHeight <= 0) return
  root.querySelectorAll('.day-section').forEach((section) => {
    section.style.minHeight = `${pageHeight}px`
    section.style.height = `${pageHeight}px`
    if (section.scrollHeight > pageHeight + 2) {
      section.style.height = 'auto'
    }
  })
}

/** 铺满视口；按较短边算 --ui-scale，字号/间距跟屏幕走，不固定比例画布 */
function adaptFullscreen () {
  const root = displayRoot.value
  if (!root) return

  const viewportScale = window.visualViewport?.scale || 1
  const zoomCompensation = viewportScale > 0 ? viewportScale : 1
  const vw = (window.innerWidth || 0) * zoomCompensation
  const vh = (window.innerHeight || 0) * zoomCompensation
  if (vw < MIN_DISPLAY_VIEWPORT_PX || vh < MIN_DISPLAY_VIEWPORT_PX) {
    if (adaptRetryCount < 90) {
      adaptRetryCount += 1
      requestAnimationFrame(adaptFullscreen)
    }
    return
  }
  adaptRetryCount = 0

  const scale = Math.min(vw / REF_WIDTH, vh / REF_HEIGHT) || 1
  if (root.style.getPropertyValue('--ui-scale') !== String(scale)) {
    root.style.setProperty('--ui-scale', String(scale))
  }

  // 清掉可能残留的 transform 画布定位
  root.style.width = ''
  root.style.height = ''
  root.style.transform = ''
  root.style.left = ''
  root.style.top = ''

  adaptDaySectionHeights()

  document.documentElement.style.width = '100%'
  document.documentElement.style.height = '100%'
  document.documentElement.style.margin = '0'
  document.documentElement.style.padding = '0'
  document.documentElement.style.overflow = 'hidden'

  document.body.style.width = '100%'
  document.body.style.height = '100%'
  document.body.style.margin = '0'
  document.body.style.padding = '0'
  document.body.style.overflow = 'hidden'
}

function scheduleAdaptFullscreen () {
  requestAnimationFrame(adaptFullscreen)
}

onMounted(async () => {
  resetDisplayReady()
  document.documentElement.classList.add('tea-display-fullscreen')
  try {
    await refreshDisplayData()
  } catch {
    teaRequests.value = []
    displayDates.value = [todayYmdInAppTimeZone()]
    lastDisplayFromDate = todayYmdInAppTimeZone()
    signalDisplayReady()
  }
  startClock()
  dataPoll.start()
  document.addEventListener('visibilitychange', onDocumentVisibilityChange)
  await nextTick()
  adaptFullscreen()
  signalDisplayReady()
  window.addEventListener('resize', adaptFullscreen)
  window.visualViewport?.addEventListener('resize', adaptFullscreen)
  const viewport = document.querySelector('meta[name="viewport"]')
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
  }
})

onUnmounted(() => {
  document.documentElement.classList.remove('tea-display-fullscreen')
  stopClock()
  dataPoll.stop()
  document.removeEventListener('visibilitychange', onDocumentVisibilityChange)
  window.removeEventListener('resize', adaptFullscreen)
  window.visualViewport?.removeEventListener('resize', adaptFullscreen)
  document.body.style.overflow = ''
  document.documentElement.style.overflow = ''
  document.body.style.width = ''
  document.body.style.height = ''
  document.documentElement.style.width = ''
  document.documentElement.style.height = ''
})
</script>

<style>
html.tea-display-fullscreen {
  zoom: 1 !important;
}

html.tea-display-fullscreen #app {
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

.tea-display-root {
  --ui-scale: 1;
  position: fixed;
  inset: 0;
  z-index: 1;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  background: #001b44;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: var(--display-font-family);
  /* 基准约合 1080p 横屏观感；任意比例屏幕铺满，只改 --ui-scale */
  font-size: calc(48px * var(--ui-scale, 1));
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  user-select: none;
  touch-action: none;
}

.tea-display-root,
.tea-display-root * {
  font-family: var(--display-font-family);
}

.tea-display-root * {
  touch-action: manipulation;
}

.tea-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: calc(80px * var(--ui-scale, 1));
  padding: 0 calc(36px * var(--ui-scale, 1));
  background: rgb(237, 125, 49);
  color: #ffffff;
  font-weight: 700;
  box-sizing: border-box;
}

.header-title {
  font-size: 1.37em;
  line-height: 1.1;
  white-space: nowrap;
}

.header-datetime {
  font-size: 1.05em;
  line-height: 1.1;
  white-space: nowrap;
}

.tea-schedule {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
  background: #001b44;
  padding: 0 calc(36px * var(--ui-scale, 1));
  scroll-snap-type: y proximity;
  scroll-behavior: smooth;
}

.day-section {
  box-sizing: border-box;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  overflow: visible;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  padding-bottom: calc(8px * var(--ui-scale, 1));
}

.schedule-header,
.venue-row {
  display: grid;
  grid-template-columns:
    minmax(0, calc(240px * var(--ui-scale, 1)))
    minmax(0, 1fr)
    calc(36px * var(--ui-scale, 1))
    minmax(0, 1fr);
  column-gap: 0;
  align-items: stretch;
}

.schedule-header {
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 6;
  align-items: center;
  font-weight: 700;
  min-height: calc(92px * var(--ui-scale, 1));
  padding: calc(22px * var(--ui-scale, 1)) 0;
  background: #001b44;
  box-shadow: 0 calc(2px * var(--ui-scale, 1)) 0 rgba(255, 255, 255, 0.22);
  box-sizing: border-box;
}

.date-label {
  display: flex;
  align-items: center;
  font-size: 1em;
  font-weight: 700;
  line-height: 1.1;
  color: #ffffff;
  white-space: nowrap;
}

.schedule-header .period-am,
.schedule-header .period-pm {
  font-size: 1em;
}

.date-today-tag {
  margin-left: 0.35em;
  color: rgb(255, 212, 91);
}

.period-am,
.period-pm {
  text-align: center;
}

.period-divider {
  width: 100%;
}

.period-pm {
  padding-left: calc(12px * var(--ui-scale, 1));
}

.schedule-header .slot-col {
  padding-top: 0;
  padding-bottom: 0;
  justify-content: center;
  line-height: 1.1;
}

.schedule-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.venue-row {
  position: relative;
  flex: 1 1 auto;
  min-height: calc(120px * var(--ui-scale, 1));
  overflow: hidden;
}

.venue-row::after {
  content: '';
  position: absolute;
  left: calc(252px * var(--ui-scale, 1));
  right: 0;
  bottom: 0;
  height: calc(2px * var(--ui-scale, 1));
  background: rgba(255, 255, 255, 0.28);
}

.venue-row:last-child::after {
  display: none;
}

.room-name {
  display: flex;
  align-items: flex-start;
  padding-top: calc(18px * var(--ui-scale, 1));
  font-size: 1.1em;
  font-weight: 700;
  line-height: 1.2;
  color: #ffffff;
  white-space: nowrap;
}

.slot-col {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: calc(14px * var(--ui-scale, 1));
  padding-top: calc(16px * var(--ui-scale, 1));
  padding-bottom: calc(16px * var(--ui-scale, 1));
  overflow: visible;
}

.service-entry {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  column-gap: calc(16px * var(--ui-scale, 1));
  align-items: center;
  width: 100%;
  min-height: calc(48px * var(--ui-scale, 1));
  cursor: pointer;
  line-height: 1.2;
}

.service-entry.completed {
  opacity: 0.55;
}

.service-entry.is-read-only {
  cursor: default;
}

.service-entry.completed .entry-time,
.service-entry.completed .entry-details {
  color: rgba(168, 196, 224, 0.85);
}

.entry-time {
  white-space: nowrap;
  font-size: 1em;
  font-weight: 600;
  color: rgb(255, 212, 91);
  line-height: 1.2;
}

.entry-details {
  min-width: 0;
  justify-self: stretch;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 1em;
  font-weight: 600;
  line-height: 1.2;
  color: rgb(255, 212, 91);
}

.entry-done {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-self: end;
  z-index: 1;
}

.entry-details.is-highlight,
.entry-details.is-normal {
  color: rgb(255, 212, 91);
}

.entry-details.is-muted {
  color: rgba(168, 196, 224, 0.85);
}

.entry-placeholder {
  opacity: 0.75;
  min-height: calc(48px * var(--ui-scale, 1));
  font-size: 1em;
  line-height: 1.2;
}

.entry-done :deep(.el-checkbox) {
  height: auto;
  width: calc(40px * var(--ui-scale, 1));
  margin: 0;
  padding: 0;
}

.entry-done :deep(.el-checkbox__label) {
  display: none;
}

.entry-done :deep(.el-checkbox__inner) {
  width: calc(40px * var(--ui-scale, 1));
  height: calc(40px * var(--ui-scale, 1));
  border: calc(2px * var(--ui-scale, 1)) solid #ffffff;
  border-radius: 3px;
  background: #ffffff;
}

.entry-done :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background: #ffffff;
  border-color: #ffffff;
}

.entry-done :deep(.el-checkbox.is-disabled .el-checkbox__inner) {
  background: rgba(255, 255, 255, 0.28);
  border-color: rgba(255, 255, 255, 0.42);
  cursor: not-allowed;
}

.entry-done :deep(.el-checkbox.is-disabled.is-checked .el-checkbox__inner) {
  background: rgba(255, 255, 255, 0.28);
  border-color: rgba(255, 255, 255, 0.42);
}

.entry-done :deep(.el-checkbox.is-disabled .el-checkbox__inner::after) {
  border-color: rgba(0, 0, 0, 0.35);
}

.entry-done :deep(.el-checkbox__inner::after) {
  border-color: #000000;
  border-width: 0 calc(5px * var(--ui-scale, 1)) calc(5px * var(--ui-scale, 1)) 0;
  left: 50%;
  top: 50%;
  width: calc(12px * var(--ui-scale, 1));
  height: calc(22px * var(--ui-scale, 1));
  transform: translate(-50%, -58%) rotate(45deg) scaleY(0);
  transform-origin: center;
}

.entry-done :deep(.el-checkbox__input.is-checked .el-checkbox__inner::after) {
  transform: translate(-50%, -58%) rotate(45deg) scaleY(1);
}

.completed-banner {
  flex-shrink: 0;
  margin-top: auto;
  margin-bottom: calc(6px * var(--ui-scale, 1));
  padding: calc(8px * var(--ui-scale, 1)) calc(36px * var(--ui-scale, 1));
  text-align: center;
  font-size: 1.05em;
  font-weight: 700;
  color: #ffffff;
  background: #4ea72e;
  line-height: 1.1;
}

.empty-day {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  font-size: 1.05em;
}
</style>
