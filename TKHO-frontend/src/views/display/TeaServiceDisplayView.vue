<template>
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
        </section>

        <div v-if="dateIdx < groupedByDate.length - 1" class="completed-banner">完</div>
      </template>
    </main>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import {
  getTeaServicePublicDisplay,
  setTeaServiceRequestCompleted
} from '@/api/venueManagement'
import { useDisplayLiveRefresh, useDisplayDataPollTimer } from '@/composables/useDisplayLiveRefresh'
import { formatTeaServiceDisplay } from '@/utils/venueTeaService'
import {
  getAppDisplayDateTimeParts,
  msUntilNextAppMinute,
  todayYmdInAppTimeZone
} from '@/utils/appTimezone'

/** 设计基准尺寸：按视口等比缩放填满全屏
 * - BASE_WIDTH 与 iPad 横屏宽度一致（避免 iPad 进一步放大）
 * - BASE_HEIGHT 采用更贴近电脑的比例（让桌面字体更大）
 */
const BASE_WIDTH = 1024
const BASE_HEIGHT = 640

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
  currentWeekdayZh.value = parts.weekdayZh.replace(/^星期/, '')
  currentDateSlash.value = `${parts.day}/${parts.month}/${parts.year}`
  currentTime.value = `${parts.hour}:${parts.minute}`

  const fromDate = todayYmdInAppTimeZone()
  if (lastDisplayFromDate && fromDate !== lastDisplayFromDate) {
    void refreshDisplayData()
  }
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
  const fromDate = todayYmdInAppTimeZone()
  const data = await getTeaServicePublicDisplay(fromDate)
  dataPoll.applyFromPayload(data?.dataPollIntervalMs)
  const requests = Array.isArray(data?.requests) ? data.requests : []
  teaDisplayVenues.value = Array.isArray(data?.venues) ? data.venues : []
  displayDates.value = Array.isArray(data?.dates) && data.dates.length
    ? data.dates.slice(0, 2)
    : [fromDate]
  teaRequests.value = mergePendingCompleted(requests)
  lastDisplayFromDate = fromDate
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

function adaptFullscreen () {
  const root = displayRoot.value
  if (!root) return

  const viewportScale = window.visualViewport?.scale || 1
  const zoomCompensation = viewportScale > 0 ? viewportScale : 1
  const vw = (window.innerWidth || BASE_WIDTH) * zoomCompensation
  const vh = (window.innerHeight || BASE_HEIGHT) * zoomCompensation
  const scale = Math.min(vw / BASE_WIDTH, vh / BASE_HEIGHT) || 1
  root.style.setProperty('--ui-scale', String(scale))

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

onMounted(async () => {
  document.documentElement.classList.add('tea-display-fullscreen')
  try {
    await refreshDisplayData()
  } catch {
    teaRequests.value = []
    displayDates.value = [todayYmdInAppTimeZone()]
    lastDisplayFromDate = todayYmdInAppTimeZone()
  }
  startClock()
  dataPoll.start()
  document.addEventListener('visibilitychange', onDocumentVisibilityChange)
  await nextTick()
  adaptFullscreen()
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
  min-width: 100vw;
  min-height: 100vh;
  background: #001b44;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: var(--display-font-family);
  font-size: calc(23px * var(--ui-scale, 1));
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  -webkit-touch-callout: none;
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
  padding: calc(6px * var(--ui-scale, 1)) calc(24px * var(--ui-scale, 1));
  background: rgb(237, 125, 49);
  color: #ffffff;
  font-weight: 700;
}

.header-title {
  font-size: 1.48rem;
  line-height: 1.1;
}

.header-datetime {
  font-size: 1.24rem;
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
  padding: 0 calc(24px * var(--ui-scale, 1)) calc(5px * var(--ui-scale, 1));
}

.day-section {
  flex: 0 0 auto;
  min-height: fit-content;
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.day-section + .day-section {
  margin-top: calc(8px * var(--ui-scale, 1));
}

.schedule-header,
.venue-row {
  display: grid;
  grid-template-columns:
    minmax(0, calc(120px * var(--ui-scale, 1)))
    minmax(0, 1fr)
    calc(52px * var(--ui-scale, 1))
    minmax(0, 1fr);
  column-gap: 0;
  row-gap: 1px;
  align-items: stretch;
}

.schedule-header {
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 6;
  align-items: center;
  font-size: 1.24rem;
  font-weight: 700;
  margin-bottom: 0;
  min-height: calc(52px * var(--ui-scale, 1));
  padding-top: calc(14px * var(--ui-scale, 1));
  padding-bottom: calc(14px * var(--ui-scale, 1));
  background: #001b44;
  box-shadow: 0 calc(1px * var(--ui-scale, 1)) 0 rgba(255, 255, 255, 0.22);
}

.date-label {
  display: flex;
  align-items: center;
  padding: 0 4px;
  font-size: 1.36rem;
  font-weight: 700;
  line-height: 1.1;
  color: #ffffff;
  white-space: nowrap;
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
  padding-left: calc(8px * var(--ui-scale, 1));
}

/* 表头上午/下午不要沿用内容区 slot-col 上下 padding，否则会和日期错位 */
.schedule-header .slot-col {
  padding-top: 0;
  padding-bottom: 0;
  justify-content: center;
  line-height: 1.1;
}

.schedule-body {
  flex: 0 0 auto;
  min-height: fit-content;
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.venue-row {
  position: relative;
  flex: 0 0 auto;
  min-height: calc(58px * var(--ui-scale, 1));
  font-size: 1.2rem;
  overflow: visible;
}

.venue-row::after {
  content: '';
  position: absolute;
  left: calc(120px * var(--ui-scale, 1) + 8px * var(--ui-scale, 1));
  right: 0;
  bottom: 0;
  height: 1px;
  background: rgba(255, 255, 255, 0.28);
}

.venue-row:last-child::after {
  display: none;
}

.room-name {
  display: flex;
  align-items: flex-start;
  padding-top: calc(8px * var(--ui-scale, 1));
  font-size: 1.42rem;
  font-weight: 700;
  line-height: 1.1;
  color: #ffffff;
}

.slot-col {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: calc(12px * var(--ui-scale, 1));
  padding-top: calc(8px * var(--ui-scale, 1));
  padding-bottom: calc(8px * var(--ui-scale, 1));
  overflow: visible;
}

.service-entry {
  display: grid;
  grid-template-columns: auto 1fr auto;
  column-gap: calc(12px * var(--ui-scale, 1));
  align-items: start;
  width: 100%;
  min-height: calc(36px * var(--ui-scale, 1));
  padding-block: calc(4px * var(--ui-scale, 1));
  cursor: pointer;
  line-height: 1.2;
}

.service-entry-am {
  column-gap: calc(16px * var(--ui-scale, 1));
}

.service-entry-pm {
  column-gap: calc(16px * var(--ui-scale, 1));
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
  font-weight: 600;
  color: rgb(255, 212, 91);
  line-height: 1.2;
}

.entry-details {
  min-width: 0;
  justify-self: start;
  text-align: left;
  overflow-wrap: anywhere;
  font-weight: 600;
  line-height: 1.2;
}

.entry-done {
  display: flex;
  align-items: flex-start;
  padding-top: 0.1em;
}

.entry-details.is-highlight {
  color: rgb(255, 212, 91);
}

.entry-details.is-normal {
  color: rgb(255, 212, 91);
}

.entry-details.is-muted {
  color: rgba(168, 196, 224, 0.85);
}

.entry-placeholder {
  opacity: 0.75;
  min-height: calc(36px * var(--ui-scale, 1));
  padding-top: calc(8px * var(--ui-scale, 1));
}

.entry-done :deep(.el-checkbox) {
  height: auto;
}

.entry-done :deep(.el-checkbox__inner) {
  width: calc(20px * var(--ui-scale, 1));
  height: calc(20px * var(--ui-scale, 1));
  border: 1.5px solid #ffffff;
  border-radius: 2px;
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
  border-width: 0 3.5px 3.5px 0;
  left: 50%;
  top: 50%;
  width: 8px;
  height: 13px;
  transform: translate(-50%, -58%) rotate(45deg) scaleY(0);
  transform-origin: center;
}

.entry-done :deep(.el-checkbox__input.is-checked .el-checkbox__inner::after) {
  transform: translate(-50%, -58%) rotate(45deg) scaleY(1);
}

.completed-banner {
  flex-shrink: 0;
  margin-block: calc(4px * var(--ui-scale, 1));
  padding: calc(3px * var(--ui-scale, 1)) calc(24px * var(--ui-scale, 1));
  text-align: center;
  font-size: 1.38rem;
  font-weight: 700;
  color: #ffffff;
  background: #4ea72e;
  line-height: 1.1;
}

.empty-day {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  font-size: 1.28rem;
}
</style>
