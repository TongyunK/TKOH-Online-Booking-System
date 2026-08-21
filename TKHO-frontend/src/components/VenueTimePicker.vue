<template>
  <div ref="rootRef" class="venue-step-time-picker">
    <el-input
      class="venue-step-time-picker__input"
      :model-value="displayValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :clearable="clearable && !!modelValue"
      readonly
      @clear="emitChange('')"
      @click="openPanel"
    >
      <template #prefix>
        <el-icon class="venue-step-time-picker__clock"><Clock /></el-icon>
      </template>
    </el-input>

    <Teleport to="body" :disabled="!teleported">
      <div
        v-show="panelVisible"
        ref="panelRef"
        class="venue-step-time-picker__panel"
        :class="{ 'is-teleported': teleported }"
        :style="panelStyle"
      >
        <div class="venue-step-time-picker__spinners">
          <div ref="hourListRef" class="venue-step-time-picker__list" @scroll="onHourScroll">
            <div class="venue-step-time-picker__spacer" aria-hidden="true" />
            <button
              v-for="h in hourOptions"
              :key="`h-${h}`"
              type="button"
              class="venue-step-time-picker__item"
              :class="{ 'is-active': h === draftHour }"
              @click="selectHour(h)"
            >
              {{ pad2(h) }}
            </button>
            <div class="venue-step-time-picker__spacer" aria-hidden="true" />
          </div>
          <div ref="minuteListRef" class="venue-step-time-picker__list" @scroll="onMinuteScroll">
            <div class="venue-step-time-picker__spacer" aria-hidden="true" />
            <button
              v-for="m in minuteOptions"
              :key="`m-${m}`"
              type="button"
              class="venue-step-time-picker__item"
              :class="{ 'is-active': m === draftMinute }"
              @click="selectMinute(m)"
            >
              {{ pad2(m) }}
            </button>
            <div class="venue-step-time-picker__spacer" aria-hidden="true" />
          </div>
        </div>
        <div class="venue-step-time-picker__footer">
          <button type="button" class="venue-step-time-picker__btn" @click="cancelPanel">Cancel</button>
          <button type="button" class="venue-step-time-picker__btn is-confirm" @click="confirmPanel">OK</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Clock } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Select time' },
  disabled: { type: Boolean, default: false },
  clearable: { type: Boolean, default: true },
  /** true：挂到 body + fixed；false：相对输入框 absolute（html zoom） */
  teleported: { type: Boolean, default: true },
  startHour: { type: Number, default: 7 },
  endHour: { type: Number, default: 21 },
  minuteStep: { type: Number, default: 15 },
  /** 可选最小时间（含），用于 End Time：滚轮定位并限制不早于该时刻之后 */
  minTime: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue', 'change'])

const rootRef = ref(null)
const panelRef = ref(null)
const hourListRef = ref(null)
const minuteListRef = ref(null)
const panelVisible = ref(false)
const panelStyle = ref({})
const draftHour = ref(props.startHour)
const draftMinute = ref(0)
/** 打开面板前的值；Cancel 时还原 */
const valueBeforeOpen = ref('')

/** 对齐 Element Plus el-time-panel：宽 180、滚轮 192、行高 32、spacer 80 */
const ITEM_HEIGHT = 32
const PANEL_WIDTH = 180
const PANEL_HEIGHT = 192 + 36 + 8

function pad2 (n) {
  return String(n).padStart(2, '0')
}

function parseHm (value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim())
  if (!m) return null
  return { hour: Number(m[1]), minute: Number(m[2]) }
}

function formatHm (hour, minute) {
  return `${pad2(hour)}:${pad2(minute)}`
}

/** Start 之后最近的合法刻度（15 分钟），超出营业结束则返回 '' */
function nextTimeAfter (hm) {
  const parsed = parseHm(hm)
  if (!parsed) return ''
  const step = props.minuteStep
  let total = parsed.hour * 60 + parsed.minute + step
  total = Math.ceil(total / step) * step
  const hour = Math.floor(total / 60)
  const minute = total % 60
  if (hour > props.endHour) return ''
  if (hour === props.endHour && minute > 0) return ''
  return formatHm(hour, minute)
}

function snapMinute (minute, hour) {
  if (hour === props.endHour) return 0
  const step = props.minuteStep
  const snapped = Math.round(minute / step) * step
  if (snapped >= 60) return 60 - step
  return Math.max(0, snapped)
}

function resolveMinBound () {
  return parseHm(props.minTime)
}

const hourOptions = computed(() => {
  const list = []
  const min = resolveMinBound()
  if (!min) {
    for (let h = props.startHour; h <= props.endHour; h++) list.push(h)
    return list
  }
  const earliest = parseHm(nextTimeAfter(props.minTime))
  if (!earliest) return []
  for (let h = Math.max(props.startHour, earliest.hour); h <= props.endHour; h++) list.push(h)
  return list
})

const minuteOptions = computed(() => {
  if (!hourOptions.value.length) return []
  if (draftHour.value === props.endHour) return [0]
  const list = []
  const earliest = resolveMinBound() ? parseHm(nextTimeAfter(props.minTime)) : null
  for (let m = 0; m < 60; m += props.minuteStep) {
    if (earliest && draftHour.value === earliest.hour && m < earliest.minute) continue
    list.push(m)
  }
  return list.length ? list : [0]
})

const displayValue = computed(() => String(props.modelValue || ''))

function emitChange (value) {
  emit('update:modelValue', value)
  emit('change', value)
}

/** 将当前滚轮选中即时写回输入框 */
function commitDraftLive () {
  if (!hourOptions.value.length) return
  if (draftHour.value === props.endHour) draftMinute.value = 0
  if (!minuteOptions.value.includes(draftMinute.value)) {
    draftMinute.value = minuteOptions.value[0] ?? 0
  }
  let value = formatHm(draftHour.value, draftMinute.value)
  if (props.minTime && value <= props.minTime) {
    value = nextTimeAfter(props.minTime)
    if (!value) return
  }
  if (value !== props.modelValue) emitChange(value)
}

function syncDraftFromValue () {
  const minBound = props.minTime ? nextTimeAfter(props.minTime) : ''
  let candidate = String(props.modelValue || '').trim()
  // 无值或早于/等于 Start：定位到 Start 之后
  if (minBound && (!candidate || candidate <= props.minTime)) {
    candidate = minBound
  }

  const parsed = parseHm(candidate)
  let hour = parsed?.hour ?? props.startHour
  let minute = parsed?.minute ?? 0
  if (hour < props.startHour) hour = props.startHour
  if (hour > props.endHour) hour = props.endHour
  minute = snapMinute(minute, hour)

  if (minBound) {
    const minParsed = parseHm(minBound)
    if (minParsed && formatHm(hour, minute) < minBound) {
      hour = minParsed.hour
      minute = minParsed.minute
    }
  }

  draftHour.value = hour
  draftMinute.value = minute
  if (!minuteOptions.value.includes(draftMinute.value)) {
    draftMinute.value = minuteOptions.value[0] ?? 0
  }
}

function scrollToActive (el, index) {
  if (!el) return
  el.scrollTop = Math.max(0, index * ITEM_HEIGHT)
}

function syncScrollPositions () {
  const hourIdx = hourOptions.value.indexOf(draftHour.value)
  const minuteIdx = minuteOptions.value.indexOf(draftMinute.value)
  scrollToActive(hourListRef.value, hourIdx < 0 ? 0 : hourIdx)
  scrollToActive(minuteListRef.value, minuteIdx < 0 ? 0 : minuteIdx)
}

function updatePanelPosition () {
  if (!rootRef.value || !props.teleported) {
    panelStyle.value = {}
    return
  }
  const rect = rootRef.value.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  let top = rect.bottom + 8
  let left = rect.left

  if (top + PANEL_HEIGHT > vh - 8 && rect.top - 8 - PANEL_HEIGHT > 8) {
    top = rect.top - 8 - PANEL_HEIGHT
  }
  if (left + PANEL_WIDTH > vw - 8) {
    left = Math.max(8, vw - PANEL_WIDTH - 8)
  }
  if (left < 8) left = 8

  panelStyle.value = {
    position: 'fixed',
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    zIndex: 100001
  }
}

async function openPanel () {
  if (props.disabled) return
  valueBeforeOpen.value = String(props.modelValue || '')
  syncDraftFromValue()
  panelVisible.value = true
  // 打开时若输入为空，先写入当前滚轮默认值
  commitDraftLive()
  await nextTick()
  updatePanelPosition()
  await nextTick()
  syncScrollPositions()
  requestAnimationFrame(() => syncScrollPositions())
}

function closePanel () {
  panelVisible.value = false
}

function cancelPanel () {
  emitChange(valueBeforeOpen.value)
  closePanel()
}

function confirmPanel () {
  commitDraftLive()
  closePanel()
}

function selectHour (hour) {
  draftHour.value = hour
  if (hour === props.endHour) draftMinute.value = 0
  else draftMinute.value = snapMinute(draftMinute.value, hour)
  if (!minuteOptions.value.includes(draftMinute.value)) {
    draftMinute.value = minuteOptions.value[0] ?? 0
  }
  commitDraftLive()
  nextTick(() => syncScrollPositions())
}

function selectMinute (minute) {
  draftMinute.value = minute
  commitDraftLive()
  nextTick(() => syncScrollPositions())
}

function nearestIndexFromScroll (el, count) {
  if (!el || count <= 0) return 0
  const idx = Math.round(el.scrollTop / ITEM_HEIGHT)
  return Math.min(count - 1, Math.max(0, idx))
}

let hourScrollTimer = null
let minuteScrollTimer = null

function onHourScroll () {
  clearTimeout(hourScrollTimer)
  hourScrollTimer = setTimeout(() => {
    const idx = nearestIndexFromScroll(hourListRef.value, hourOptions.value.length)
    const hour = hourOptions.value[idx]
    if (hour == null) return
    draftHour.value = hour
    if (hour === props.endHour) draftMinute.value = 0
    else draftMinute.value = snapMinute(draftMinute.value, hour)
    if (!minuteOptions.value.includes(draftMinute.value)) {
      draftMinute.value = minuteOptions.value[0] ?? 0
    }
    syncScrollPositions()
    commitDraftLive()
  }, 80)
}

function onMinuteScroll () {
  clearTimeout(minuteScrollTimer)
  minuteScrollTimer = setTimeout(() => {
    const idx = nearestIndexFromScroll(minuteListRef.value, minuteOptions.value.length)
    const minute = minuteOptions.value[idx]
    if (minute == null) return
    draftMinute.value = minute
    syncScrollPositions()
    commitDraftLive()
  }, 80)
}

function onDocPointerDown (event) {
  if (!panelVisible.value) return
  const root = rootRef.value
  const panel = panelRef.value
  if (root?.contains(event.target) || panel?.contains?.(event.target)) return
  // 点外侧：保留滚动过程中已写入的值
  commitDraftLive()
  closePanel()
}

function onWindowChange () {
  if (!panelVisible.value) return
  updatePanelPosition()
}

watch(
  () => props.modelValue,
  () => {
    if (!panelVisible.value) syncDraftFromValue()
  }
)

watch(
  () => minuteOptions.value.join(','),
  async () => {
    if (!panelVisible.value) return
    if (!minuteOptions.value.includes(draftMinute.value)) {
      draftMinute.value = minuteOptions.value[0] ?? 0
      commitDraftLive()
    }
    await nextTick()
    syncScrollPositions()
  }
)

onMounted(() => {
  document.addEventListener('mousedown', onDocPointerDown, true)
  window.addEventListener('resize', onWindowChange)
  window.addEventListener('scroll', onWindowChange, true)
  syncDraftFromValue()
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocPointerDown, true)
  window.removeEventListener('resize', onWindowChange)
  window.removeEventListener('scroll', onWindowChange, true)
  clearTimeout(hourScrollTimer)
  clearTimeout(minuteScrollTimer)
})
</script>

<style scoped>
.venue-step-time-picker {
  position: relative;
  width: 100%;
}

.venue-step-time-picker__input {
  width: 100%;
  cursor: pointer;
}

.venue-step-time-picker__input :deep(.el-input__wrapper) {
  cursor: pointer;
}

.venue-step-time-picker__input :deep(.el-input__inner) {
  cursor: pointer;
}

.venue-step-time-picker__clock {
  color: #a8abb2;
}
</style>

<!-- 对齐原生 el-time-panel；非 scoped 以便 Teleport 到 body 后样式生效 -->
<style>
.venue-step-time-picker__panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 180px;
  background: #fff;
  border: 2px solid #0A3D1F;
  border-radius: 2px;
  box-shadow: var(--el-box-shadow-light, 0 0 12px rgba(0, 0, 0, 0.12));
  z-index: 30;
  overflow: visible;
  box-sizing: content-box;
  user-select: none;
}

/* 与 el-popper 箭头一致 */
.venue-step-time-picker__panel::before,
.venue-step-time-picker__panel::after {
  content: '';
  position: absolute;
  left: 28px;
  width: 0;
  height: 0;
  border-style: solid;
}

.venue-step-time-picker__panel::before {
  top: -8px;
  border-width: 0 6px 6px;
  border-color: transparent transparent #0A3D1F transparent;
}

.venue-step-time-picker__panel::after {
  top: -5px;
  border-width: 0 5px 5px;
  border-color: transparent transparent #fff transparent;
}

.venue-step-time-picker__spinners {
  display: flex;
  position: relative;
  width: 100%;
  height: 192px;
  overflow: hidden;
  font-size: 0;
}

/* 中间选中线，对齐 el-time-panel__content:before */
.venue-step-time-picker__spinners::before {
  content: '';
  position: absolute;
  left: 12%;
  right: 12%;
  top: 50%;
  height: 32px;
  margin-top: -16px;
  border-top: 1px solid var(--el-border-color-light, #e4e7ed);
  border-bottom: 1px solid var(--el-border-color-light, #e4e7ed);
  z-index: 1;
  pointer-events: none;
  box-sizing: border-box;
}

.venue-step-time-picker__list {
  flex: 1;
  width: 50%;
  height: 100%;
  max-height: 192px;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
  text-align: center;
}

.venue-step-time-picker__list::-webkit-scrollbar {
  display: none;
}

.venue-step-time-picker__spacer {
  height: 80px;
  width: 100%;
  flex-shrink: 0;
}

.venue-step-time-picker__item {
  display: block;
  width: 100%;
  height: 32px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--el-text-color-regular, #606266);
  font-size: 12px;
  line-height: 32px;
  text-align: center;
  cursor: pointer;
  scroll-snap-align: center;
  flex-shrink: 0;
}

.venue-step-time-picker__item:hover:not(.is-active) {
  background: var(--el-fill-color-light, #f5f7fa);
}

.venue-step-time-picker__item.is-active {
  color: #0A3D1F;
  font-weight: 700;
}

.venue-step-time-picker__footer {
  box-sizing: border-box;
  height: 36px;
  padding: 4px;
  border-top: 1px solid var(--el-border-color-light, #e4e7ed);
  text-align: right;
  line-height: 25px;
  background: #fff;
  border-radius: 0 0 2px 2px;
}

.venue-step-time-picker__btn {
  cursor: pointer;
  color: var(--el-text-color-primary, #303133);
  background: transparent;
  border: none;
  outline: none;
  margin: 0 5px;
  padding: 0 5px;
  font-size: 12px;
  line-height: 28px;
}

.venue-step-time-picker__btn.is-confirm {
  color: #0A3D1F;
  font-weight: 800;
}
</style>
