<template>
  <!-- 自定义遮罩 + 弹窗 -->
  <div class="ev-booking-dialog-root modal-overlay" @click.self="handleClose" v-if="visible">
    <div
      class="booking-dialog-wrapper"
      :style="dialogWrapperStyle"
    >
      <!-- 头部 -->
      <div class="modal-header" @mousedown="handleMouseDown">
        <span class="modal-title">{{ dialogTitle }}</span>
        <button class="modal-close" @click="handleClose">
          <svg viewBox="0 0 24 24" class="close-icon">
            <path d="M18 6L6 18M6 6l12 12" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <!-- 内容 -->
      <div class="modal-body">
        <div class="booking-form-container">
          <div v-if="isAdmin" class="form-section">
            <label class="form-label">Reserved By</label>
            <ReservedByUserField
              v-model="form.reservedByUserId"
              :default-user="defaultReservedByUser"
              owner-scope="ev"
              variant="bare"
              select-class="form-input form-input-license"
              :teleported="bookingPopperTeleported"
              @update:model-value="handleReservedByUserChange"
            />
          </div>

          <!-- License plate number -->
          <div class="form-section">
            <label class="form-label">License plate number <span class="required">*</span></label>
            <el-select
              :key="`license-plate-${form.reservedByUserId || 'self'}`"
              v-model="form.licensePlateId"
              placeholder="Select license plate"
              class="form-input form-input-license"
              :teleported="bookingPopperTeleported"
              :loading="vehiclesLoading"
              :disabled="vehiclesLoading || !vehicles.length"
            >
              <el-option
                v-for="vehicle in vehicles"
                :key="vehicle.id"
                :label="vehicle.label"
                :value="vehicle.id"
              />
            </el-select>
          </div>

          <!-- Time period -->
          <div class="form-section">
            <label class="form-label">Time period <span class="required">*</span></label>
            <div class="time-period-group">
              <label
                v-for="period in timePeriods"
                :key="period.id"
                class="time-period-option"
                :class="{
                  'is-selected': form.timePeriod === period.id,
                  'is-disabled': !isTimeAvailable(period.id)
                }"
              >
                <input
                  type="radio"
                  :value="period.id"
                  v-model="form.timePeriod"
                  :disabled="!isTimeAvailable(period.id)"
                  class="time-radio"
                />
                <span class="time-label">{{ period.label }}</span>
              </label>
            </div>
          </div>

          <!-- Date -->
          <div class="form-section">
            <label class="form-label">Date <span class="required">*</span></label>
            <el-date-picker
              v-model="form.date"
              type="date"
              placeholder="Select date"
              class="form-input"
              size="large"
              :teleported="bookingPopperTeleported"
              :placement="bookingPopperTeleported ? 'bottom-start' : 'top-start'"
              popper-class="ev-booking-date-picker-popper"
              :disabled-date="disabledDate"
              format="DD/MM/YYYY"
              value-format="YYYY-MM-DD"
            />
          </div>

          <!-- Parking space -->
          <div class="form-section parking-info-section">
            <label class="form-label">
              Parking space
              <span v-if="isEditMode" class="required">*</span>
            </label>
            <div v-if="isEditMode" class="time-period-group parking-slot-group">
              <p v-if="slotOptionsLoading" class="parking-slot-hint">Loading parking spaces...</p>
              <p v-else-if="!slotOptions.length" class="parking-slot-hint">—</p>
              <template v-else>
                <label
                  v-for="slot in slotOptions"
                  :key="`parking-slot-${slot.id}`"
                  class="time-period-option"
                  :class="{
                    'is-selected': selectedSlotId === slot.id,
                    'is-disabled': !slot.available
                  }"
                >
                  <input
                    type="radio"
                    :value="slot.id"
                    v-model="selectedSlotId"
                    :disabled="!slot.available"
                    class="time-radio"
                  />
                  <span class="time-label">{{ slot.evSpace }}</span>
                </label>
              </template>
            </div>
            <div v-else class="parking-info">
              <span class="parking-label">Parking space:</span>
              <span class="parking-value">{{ parkingSpaceDisplay }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="modal-footer">
        <el-button @click="handleClose" class="cancel-btn" :disabled="submitting">Cancel</el-button>
        <el-button
          @click="handleSave"
          class="save-btn"
          :loading="submitting"
          :disabled="submitting || !canSaveBooking"
        >
          Save
        </el-button>
      </div>
    </div>

    <div v-if="statusDialog.visible" class="status-modal-overlay" @click.self="dismissStatusDialog">
      <div class="status-modal-wrapper">
        <div class="status-modal-header">
          <span class="status-modal-title">Reminder</span>
          <button type="button" class="status-modal-close" @click="dismissStatusDialog">
            <svg viewBox="0 0 24 24" class="status-close-icon">
              <path d="M18 6L6 18M6 6l12 12" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div class="status-modal-body">
          <p :class="['status-dialog-message', statusDialog.type]">{{ statusDialog.message }}</p>
        </div>
        <div class="status-modal-footer">
          <el-button class="status-confirm-btn" type="default" @click="dismissStatusDialog">OK</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import ReservedByUserField from '@/components/ReservedByUserField.vue'
import { getAccountVehicles } from '@/api/accountVehicle'
import { getEvAssignmentPreview, getEvSlotOptions } from '@/api/parking'
import { getMockAccountVehicleList, getMockEVParkingList } from '@/mocks/mockData'
import { createDateAtMidnight, isEvSlotPast } from '@/utils/evSlotPast'
import {
  isRestrictedBookingDay,
  isSameDayOrPastBookingRestricted,
  SAME_DAY_BOOKING_NOT_ALLOWED
} from '@/utils/bookingDateRestriction'
import { todayYmdInAppTimeZone } from '@/utils/appTimezone'
import { HTML_ZOOM_BREAKPOINT_MQ } from '@/utils/venueCalendarApi'
import { useUserStore } from '@/stores/user'
import { formatUserDisplayName } from '@/utils/userDisplayName'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  selectedDate: {
    type: String,
    default: ''
  },
  selectedPeriod: {
    type: String,
    default: ''
  },
  availableSlots: {
    type: Object,
    default: () => ({})
  },
  timePeriods: {
    type: Array,
    default: () => []
  },
  submitting: {
    type: Boolean,
    default: false
  },
  bookingWindowStart: {
    type: String,
    default: ''
  },
  bookingWindowEnd: {
    type: String,
    default: ''
  },
  /** 弹窗打开时先拉最新日历余量，再加载 assignment-preview */
  refreshCalendarAvailability: {
    type: Function,
    default: null
  },
  publicHolidayDates: {
    type: Object,
    default: () => ({})
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  mode: {
    type: String,
    default: 'create'
  },
  initialBooking: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'confirm'])

const userStore = useUserStore()
const { userInfo } = storeToRefs(userStore)

const defaultReservedByUser = computed(() => {
  if (props.mode === 'edit' && props.initialBooking?.reservedByUserId) {
    return {
      id: String(props.initialBooking.reservedByUserId),
      name: props.initialBooking.reservedBy || props.initialBooking.reservedByUserId,
      corpId: props.initialBooking.reservedByCorpId || props.initialBooking.reservedBy || ''
    }
  }
  const u = userInfo.value
  if (!u?.id && !u?.sub) return null
  return {
    id: String(u.id ?? u.sub),
    name: formatUserDisplayName(u) || u.corpId || 'Me',
    firstName: u.firstName,
    lastName: u.lastName,
    corpId: u.corpId || ''
  }
})

const dialogTitle = computed(() =>
  props.mode === 'edit'
    ? 'Edit Booking'
    : 'Add Booking'
)

const isEditMode = computed(() => props.mode === 'edit')

const isSameAsInitialBooking = () => {
  const initial = props.initialBooking
  if (!initial) return false
  return (
    form.value.date === initial.bookingDateYmd &&
    String(form.value.timePeriod) === String(initial.periodId || '')
  )
}

// 拖拽相关
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dialogX = ref(0)
const dialogY = ref(0)

/** 14" 视口（1100–1599，html zoom 0.8）：仅放宽 max-height，布局与其他断点一致 */
const EV_BOOKING_DIALOG_MODAL_MQ = HTML_ZOOM_BREAKPOINT_MQ
const EV_BOOKING_DIALOG_14_MAX_HEIGHT = '100vh'
const evBookingDialogMaxHeight = ref('')
/** 14" html zoom：下拉/日期勿挂 body，避免坐标偏移；其余视口挂 body 以免被弹窗 overflow 裁切 */
const bookingPopperTeleported = ref(true)

function updateEvBookingDialogMaxHeight () {
  if (typeof window === 'undefined') return
  const mq = window.matchMedia(EV_BOOKING_DIALOG_MODAL_MQ)
  evBookingDialogMaxHeight.value = mq.matches
    ? EV_BOOKING_DIALOG_14_MAX_HEIGHT
    : ''
  bookingPopperTeleported.value = !mq.matches
}

let evBookingDialogModalMq = null

const dialogWrapperStyle = computed(() => ({
  transform: `translate(${dialogX.value}px, ${dialogY.value}px)`,
  ...(evBookingDialogMaxHeight.value ? { maxHeight: evBookingDialogMaxHeight.value } : {})
}))

function handleMouseDown(e) {
  if (e.target.closest('.modal-close')) return
  isDragging.value = true
  dragStartX.value = e.clientX - dialogX.value
  dragStartY.value = e.clientY - dialogY.value
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

function handleMouseMove(e) {
  if (!isDragging.value) return
  dialogX.value = e.clientX - dragStartX.value
  dialogY.value = e.clientY - dragStartY.value
}

function handleMouseUp() {
  isDragging.value = false
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  evBookingDialogModalMq?.removeEventListener('change', updateEvBookingDialogMaxHeight)
  evBookingDialogModalMq = null
})

onMounted(() => {
  updateEvBookingDialogMaxHeight()
  if (typeof window === 'undefined') return
  evBookingDialogModalMq = window.matchMedia(EV_BOOKING_DIALOG_MODAL_MQ)
  evBookingDialogModalMq.addEventListener('change', updateEvBookingDialogMaxHeight)
})

const vehicles = ref([])
const vehiclesLoading = ref(false)

const mapVehicleRows = (rows) =>
  rows.map((item) => ({
    id: String(item.id),
    plateNumber: item.plateNumber || item.plate || '',
    isDefault: Boolean(item.isDefault),
    label: item.plateNumber || item.plate || ''
  }))

function resolveVehicleOwnerUserId (explicitUserId) {
  if (!props.isAdmin) return undefined
  const id = String(explicitUserId ?? form.value.reservedByUserId ?? '').trim()
  return id || undefined
}

const loadVehicles = async (userId) => {
  vehiclesLoading.value = true
  try {
    const res = await getAccountVehicles(userId)
    const active = (res?.vehicles || []).filter(
      (item) => String(item.status || 'active').toLowerCase() === 'active'
    )
    vehicles.value = mapVehicleRows(active)
  } catch {
    if (userId) {
      vehicles.value = []
    } else {
      const mockList = getMockAccountVehicleList()
      vehicles.value = mapVehicleRows(
        mockList.map((item, index) => ({
          id: String(index + 1),
          plateNumber: item.plate,
          isDefault: item.isDefault,
          status: 'active'
        }))
      )
    }
  } finally {
    vehiclesLoading.value = false
  }
}

async function reloadVehiclesForReservedBy (explicitUserId) {
  const ownerUserId = resolveVehicleOwnerUserId(explicitUserId)
  form.value.licensePlateId = ''
  vehicles.value = []
  await loadVehicles(ownerUserId)
  applyDefaultLicensePlate()
}

async function handleReservedByUserChange (userId) {
  if (!props.isAdmin || !props.visible) return
  await reloadVehiclesForReservedBy(userId)
  if (isEditMode.value) return
  await loadSlotPreview()
}

const applyDefaultLicensePlate = () => {
  const current = form.value.licensePlateId
  const stillValid = vehicles.value.some((v) => v.id === current)
  if (stillValid) return
  const defaultVehicle =
    vehicles.value.find((v) => v.isDefault) || vehicles.value[0]
  form.value.licensePlateId = defaultVehicle?.id || ''
}

// 表单数据
const form = ref({
  reservedByUserId: '',
  licensePlateId: '',
  timePeriod: '',
  date: ''
})

const emptySlotPreview = () => ({
  total: 0,
  booked: 0,
  remaining: 0,
  isFull: false,
  suggestedSlot: null
})

const slotPreview = ref(emptySlotPreview())
const slotPreviewLoading = ref(false)
const slotOptions = ref([])
const selectedSlotId = ref('')
const slotOptionsLoading = ref(false)
let slotPreviewRequestId = 0
let slotOptionsRequestId = 0

const statusDialog = ref({
  visible: false,
  message: '',
  type: ''
})

const canSaveBooking = computed(() => {
  if (!form.value.licensePlateId || !form.value.date || !form.value.timePeriod) return false
  if (isEvSlotPast(form.value.date, form.value.timePeriod, props.timePeriods)) return false
  if (!isTimeAvailable(form.value.timePeriod)) return false
  if (isEditMode.value) {
    if (slotOptionsLoading.value) return false
    const selected = slotOptions.value.find((slot) => slot.id === selectedSlotId.value)
    return Boolean(selected?.available)
  }
  if (slotPreviewLoading.value) return false
  return !slotPreview.value.isFull && !!slotPreview.value.suggestedSlot
})

const parkingSpaceDisplay = computed(() => {
  if (!form.value.date || !form.value.timePeriod) return '—'
  if (slotPreviewLoading.value) return '—'
  if (slotPreview.value.isFull || !slotPreview.value.suggestedSlot) return '—'
  return slotPreview.value.suggestedSlot.evSpace || '—'
})

const applyMockSlotPreview = () => {
  const key = `${form.value.date}-${form.value.timePeriod}`
  const slot = props.availableSlots[key]
  const total = slot?.total ?? getMockEVParkingList().filter((s) => s.status === 'active').length
  const remaining = slot?.available ?? total
  const booked = slot?.booked ?? Math.max(0, total - remaining)
  const mockSlots = getMockEVParkingList().filter((s) => s.status === 'active')
  const suggested = remaining > 0 && mockSlots.length
    ? mockSlots[Math.floor(Math.random() * mockSlots.length)]
    : null
  slotPreview.value = {
    total,
    booked,
    remaining,
    isFull: remaining === 0,
    suggestedSlot: suggested
      ? { id: String(suggested.id), evSpace: suggested.evSpace, location: suggested.location }
      : null
  }
}

const applyMockSlotOptions = () => {
  const mockSlots = getMockEVParkingList().filter((slot) => slot.status === 'active')
  const currentSlotId = String(props.initialBooking?.slotId || '')
  const key = `${form.value.date}-${form.value.timePeriod}`
  const grid = props.availableSlots[key]
  const remaining = grid?.available ?? mockSlots.length
  let unavailableBudget = Math.max(0, mockSlots.length - remaining)

  slotOptions.value = mockSlots.map((slot) => {
    const id = String(slot.id)
    let available = true
    if (id === currentSlotId) {
      available = true
    } else if (unavailableBudget > 0) {
      available = false
      unavailableBudget -= 1
    }
    return {
      id,
      evSpace: slot.evSpace,
      location: slot.location || '',
      available
    }
  })
}

const applySelectedSlotAfterOptionsLoad = (preferredSlotId) => {
  const preferred = String(
    preferredSlotId ||
      selectedSlotId.value ||
      props.initialBooking?.slotId ||
      ''
  ).trim()
  const preferredSlot = slotOptions.value.find(
    (slot) => slot.id === preferred && slot.available
  )
  if (preferredSlot) {
    selectedSlotId.value = preferredSlot.id
    return
  }
  const firstAvailable = slotOptions.value.find((slot) => slot.available)
  selectedSlotId.value = firstAvailable?.id || ''
}

const loadSlotOptions = async (options = {}) => {
  const { preferredSlotId } = options
  if (!form.value.date || !form.value.timePeriod) {
    slotOptions.value = []
    selectedSlotId.value = ''
    return
  }

  const requestId = ++slotOptionsRequestId
  slotOptionsLoading.value = true
  try {
    const params = {
      bookingDate: form.value.date,
      periodId: String(form.value.timePeriod)
    }
    if (props.initialBooking?.id) {
      params.excludeBookingId = String(props.initialBooking.id)
    }
    const data = await getEvSlotOptions(params)
    if (requestId !== slotOptionsRequestId) return
    slotOptions.value = Array.isArray(data?.slots)
      ? data.slots.map((slot) => ({
          id: String(slot.id),
          evSpace: slot.evSpace || '',
          location: slot.location || '',
          available: Boolean(slot.available)
        }))
      : []
    applySelectedSlotAfterOptionsLoad(preferredSlotId)
  } catch {
    if (requestId !== slotOptionsRequestId) return
    applyMockSlotOptions()
    applySelectedSlotAfterOptionsLoad(preferredSlotId)
  } finally {
    if (requestId === slotOptionsRequestId) {
      slotOptionsLoading.value = false
    }
  }
}

const loadSlotPreview = async (options = {}) => {
  const { shuffle = false, preferredSlotId } = options
  if (!form.value.date || !form.value.timePeriod) {
    slotPreview.value = emptySlotPreview()
    return
  }

  const requestId = ++slotPreviewRequestId
  slotPreviewLoading.value = true
  try {
    const params = {
      bookingDate: form.value.date,
      periodId: String(form.value.timePeriod)
    }
    const slotIdHint =
      preferredSlotId ||
      (!shuffle ? slotPreview.value.suggestedSlot?.id : undefined)
    if (slotIdHint) {
      params.slotId = String(slotIdHint)
    }
    const data = await getEvAssignmentPreview(params)
    if (requestId !== slotPreviewRequestId) return
    slotPreview.value = {
      total: Number(data?.total) || 0,
      booked: Number(data?.booked) || 0,
      remaining: Number(data?.remaining) || 0,
      isFull: Boolean(data?.isFull),
      suggestedSlot: data?.suggestedSlot || null
    }
  } catch {
    if (requestId !== slotPreviewRequestId) return
    applyMockSlotPreview()
  } finally {
    if (requestId === slotPreviewRequestId) {
      slotPreviewLoading.value = false
    }
  }
}

watch(() => [props.selectedDate, props.selectedPeriod], ([date, period]) => {
  if (date) form.value.date = date
  if (period) form.value.timePeriod = period
}, { immediate: true })

watch(
  () => props.visible,
  async (visible) => {
    if (!visible) {
      slotPreview.value = emptySlotPreview()
      slotOptions.value = []
      selectedSlotId.value = ''
      return
    }
    if (props.mode === 'edit' && props.initialBooking) {
      const initial = props.initialBooking
      form.value.reservedByUserId = String(initial.reservedByUserId || defaultReservedByUser.value?.id || '')
      form.value.date = initial.bookingDateYmd || ''
      form.value.timePeriod = String(initial.periodId || '')
      selectedSlotId.value = String(initial.slotId || '')
      await reloadVehiclesForReservedBy(form.value.reservedByUserId)
      form.value.licensePlateId = String(initial.licensePlateId || '')
      if (typeof props.refreshCalendarAvailability === 'function') {
        try {
          await props.refreshCalendarAvailability()
        } catch {
          /* 父级已 catch，忽略 */
        }
      }
      if (form.value.date && form.value.timePeriod && !isTimeAvailable(form.value.timePeriod)) {
        pickFirstAvailablePeriod()
      }
      await loadSlotOptions({ preferredSlotId: initial.slotId })
      return
    }
    if (props.isAdmin && defaultReservedByUser.value?.id) {
      form.value.reservedByUserId = defaultReservedByUser.value.id
    }
    if (typeof props.refreshCalendarAvailability === 'function') {
      try {
        await props.refreshCalendarAvailability()
      } catch {
        /* 父级已 catch，忽略 */
      }
    }
    await reloadVehiclesForReservedBy()
    if (form.value.date && form.value.timePeriod && !isTimeAvailable(form.value.timePeriod)) {
      pickFirstAvailablePeriod()
    }
    await loadSlotPreview()
  }
)

function pickFirstAvailablePeriod () {
  const next = props.timePeriods.find((row) => isTimeAvailable(row.id))
  form.value.timePeriod = next?.id ?? ''
}

watch(
  () => [form.value.date, form.value.timePeriod],
  () => {
    if (!props.visible) return
    if (form.value.date && form.value.timePeriod && !isTimeAvailable(form.value.timePeriod)) {
      pickFirstAvailablePeriod()
    }
    if (isEditMode.value) {
      void loadSlotOptions()
      return
    }
    loadSlotPreview({ shuffle: true })
  }
)

watch(
  () => form.value.date,
  () => {
    if (!props.visible || !form.value.date) return
    if (form.value.timePeriod && !isTimeAvailable(form.value.timePeriod)) {
      pickFirstAvailablePeriod()
    }
  }
)

watch(
  () => {
    if (!props.visible || !form.value.date || !form.value.timePeriod) return null
    return props.availableSlots[`${form.value.date}-${form.value.timePeriod}`]
  },
  (slot) => {
    if (!props.visible || !slot) return
    if (slot.available === 0) {
      if (isEditMode.value) {
        void loadSlotOptions()
      } else {
        void loadSlotPreview()
      }
    }
  },
  { deep: true }
)

function isFullyBookedReminder () {
  return /fully booked/i.test(String(statusDialog.value.message || ''))
}

async function dismissStatusDialog () {
  const refreshGrid = isFullyBookedReminder()
  statusDialog.value = { ...statusDialog.value, visible: false }
  if (!refreshGrid) return
  if (typeof props.refreshCalendarAvailability === 'function') {
    try {
      await props.refreshCalendarAvailability()
    } catch {
      /* 父级已 catch */
    }
  }
  if (isEditMode.value) {
    await loadSlotOptions()
  } else {
    await loadSlotPreview()
  }
}

// 检查时段是否可用（含已满、已过期）
function isTimeAvailable (period) {
  if (!form.value.date) return true
  if (isEvSlotPast(form.value.date, period, props.timePeriods)) return false
  if (
    props.mode === 'edit' &&
    props.initialBooking &&
    form.value.date === props.initialBooking.bookingDateYmd &&
    String(period) === String(props.initialBooking.periodId || '')
  ) {
    return true
  }
  const key = `${form.value.date}-${period}`
  const slot = props.availableSlots[key]
  return !slot || slot.available > 0
}

// 禁用日期：须在预订窗口内；非管理员不可选今日及过去；管理员不可选过去
function disabledDate (date) {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  const today = createDateAtMidnight()
  const ymd = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
  if (day < today) return true
  if (isSameDayOrPastBookingRestricted(ymd, {
    isAdmin: props.isAdmin,
    todayYmd: todayYmdInAppTimeZone()
  })) {
    return true
  }

  const startRaw = String(props.bookingWindowStart || '').trim()
  const endRaw = String(props.bookingWindowEnd || '').trim()
  if (!startRaw || !endRaw) return true
  const start = createDateAtMidnight(new Date(`${startRaw}T00:00:00`))
  const end = createDateAtMidnight(new Date(`${endRaw}T00:00:00`))
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return true
  if (day < start || day > end) return true
  if (isRestrictedBookingDay(ymd, {
    isAdmin: props.isAdmin,
    publicHolidayDates: props.publicHolidayDates
  })) {
    return true
  }
  return false
}

// 关闭对话框
function handleClose() {
  // 重置拖拽位置
  dialogX.value = 0
  dialogY.value = 0
  emit('close')
}

// 保存预订
function handleSave() {
  if (props.submitting) return
  if (!vehicles.value.length) {
    statusDialog.value = {
      visible: true,
      message: 'No active license plate found for your account'
    }
    return
  }
  if (!form.value.licensePlateId) {
    statusDialog.value = {
      visible: true,
      message: 'Please select a license plate'
    }
    return
  }
  if (!props.timePeriods.length) {
    statusDialog.value = {
      visible: true,
      message: 'No active time periods configured'
    }
    return
  }
  if (!form.value.timePeriod) {
    statusDialog.value = {
      visible: true,
      message: 'Please select a time period'
    }
    return
  }
  if (!form.value.date) {
    statusDialog.value = {
      visible: true,
      message: 'Please select a date'
    }
    return
  }
  if (isSameDayOrPastBookingRestricted(form.value.date, {
    isAdmin: props.isAdmin,
    todayYmd: todayYmdInAppTimeZone()
  })) {
    statusDialog.value = {
      visible: true,
      message: SAME_DAY_BOOKING_NOT_ALLOWED,
      type: 'error'
    }
    return
  }
  if (isEvSlotPast(form.value.date, form.value.timePeriod, props.timePeriods)) {
    statusDialog.value = {
      visible: true,
      message: 'This time period has already ended. Please select another slot.',
      type: 'error'
    }
    pickFirstAvailablePeriod()
    return
  }
  if (!isTimeAvailable(form.value.timePeriod)) {
    statusDialog.value = {
      visible: true,
      message: 'This time period is not available. Please select another slot.',
      type: 'error'
    }
    return
  }
  if (isEditMode.value) {
    const selected = slotOptions.value.find((slot) => slot.id === selectedSlotId.value)
    if (!selected?.available) {
      statusDialog.value = {
        visible: true,
        message: 'Please select an available parking space.',
        type: 'error'
      }
      return
    }
    emit('confirm', {
      reservedByUserId: form.value.reservedByUserId || defaultReservedByUser.value?.id || '',
      licensePlateId: form.value.licensePlateId,
      timePeriod: form.value.timePeriod,
      date: form.value.date,
      slotId: selectedSlotId.value
    })
    return
  }
  if (slotPreview.value.isFull || !slotPreview.value.suggestedSlot) {
    statusDialog.value = {
      visible: true,
      message: 'This time slot is fully booked.',
      type: 'error'
    }
    if (typeof props.refreshCalendarAvailability === 'function') {
      void props.refreshCalendarAvailability()
    }
    return
  }

  emit('confirm', {
    reservedByUserId: form.value.reservedByUserId || defaultReservedByUser.value?.id || '',
    licensePlateId: form.value.licensePlateId,
    timePeriod: form.value.timePeriod,
    date: form.value.date,
    slotId: slotPreview.value.suggestedSlot.id
  })
}
</script>

<style scoped>
/* 遮罩层 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1rem;
  overflow-y: auto;
}

/* 弹窗容器 */
.booking-dialog-wrapper {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: min(500px, 95vw);
  max-height: min(90vh, 760px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  /* teleported=false（14" zoom）时允许日期/下拉越界；纵向滚动仍由 modal-body 负责 */
  overflow: visible;
  position: relative;
  flex-shrink: 0;
}

/* 头部 */
.modal-header {
  background: #00723a;
  color: #fff;
  padding: clamp(0.625rem, 2vh, 1rem) clamp(0.875rem, 3vw, 1.5rem);
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: move;
  user-select: none;
  flex-shrink: 0;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}

.modal-title {
  font-size: 1.0625rem;
  font-weight: 600;
  line-height: 1.5;
}

.modal-close {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s;
}

.modal-close:hover {
  opacity: 0.8;
}

.close-icon {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  fill: none;
}

/* 内容区域 */
.modal-body {
  flex: 1;
  overflow-x: clip;
  overflow-y: auto;
  padding: clamp(0.75rem, 2.5vh, 1.5rem) clamp(0.875rem, 3vw, 1.5rem);
  padding-bottom: 1.25rem;
  background: #fafafa;
  min-height: 0;
}

.modal-body::-webkit-scrollbar {
  width: 8px;
}

.modal-body::-webkit-scrollbar-track {
  background: #f3f4f6;
  border-radius: 4px;
}

.modal-body::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 4px;
}

.modal-body::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* 表单容器 */
.booking-form-container {
  display: flex;
  flex-direction: column;
  gap: clamp(0.625rem, 2vh, 1rem);
}

/* 表单区块 */
.form-section {
  display: flex;
  flex-direction: column;
  gap: clamp(0.375rem, 1vh, 0.5rem);
}

.form-label {
  font-size: clamp(0.75rem, 1.8vw, 0.875rem);
  font-weight: 600;
  color: #111827;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  line-height: 1.2;
}

.required {
  color: #dc2626;
  font-weight: 700;
}

/* 输入框样式 */
.form-input {
  width: 100%;
}

:deep(.el-select) {
  width: 100%;
}

/* License plate 下拉高度（全局生效） */
:deep(.form-input-license.el-select) {
  --el-component-size: 2.5rem;
}

:deep(.form-input-license.el-select .el-input__wrapper),
:deep(.form-input-license.el-select .el-select__wrapper) {
  min-height: 2.5rem;
  padding: 0 0.75rem;
  border-radius: 8px;
  align-items: center;
}

:deep(.form-input-license.el-select .el-input__inner) {
  font-size: 0.9375rem;
  line-height: 1.25;
  height: auto;
}

:deep(.form-input-license.el-select .el-select__selection) {
  font-size: 0.9375rem;
  line-height: 1.25;
}

:deep(.form-input-license.el-select .el-input__suffix) {
  align-items: center;
}

:deep(.form-input-license.el-select .el-select__caret) {
  font-size: 0.875rem;
}

:deep(.el-input__wrapper) {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 3px rgba(0, 114, 58, 0.1);
  border-color: #00723a;
}

:deep(.ev-booking-date-picker-popper) {
  z-index: 100001 !important;
}

/* 时间段选择组 */
.time-period-group {
  display: flex;
  flex-direction: column;
  gap: clamp(0.375rem, 1.5vh, 0.625rem);
  background: white;
  padding: clamp(0.5rem, 1.5vh, 0.875rem);
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.time-period-option {
  display: flex;
  align-items: center;
  gap: clamp(0.5rem, 1.5vw, 0.75rem);
  padding: clamp(0.5rem, 1.5vh, 0.75rem) clamp(0.625rem, 2vw, 0.875rem);
  background: #f9fafb;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
  min-height: 2.5rem;
}

.time-period-option:hover:not(.is-disabled) {
  background: #f3f4f6;
  border-color: #00723a;
  transform: translateX(4px);
}

.time-period-option.is-selected {
  background: #d6f3c5;
  border-color: #00723a;
  box-shadow: 0 2px 6px rgba(0, 114, 58, 0.2);
}

.time-period-option.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f9fafb;
}

.time-radio {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #00723a;
}

.time-period-option.is-disabled .time-radio {
  cursor: not-allowed;
}

.time-label {
  font-size: clamp(0.75rem, 1.8vw, 0.875rem);
  font-weight: 500;
  color: #374151;
  flex: 1;
  line-height: 1.2;
}

.time-period-option.is-selected .time-label {
  color: #00723a;
  font-weight: 600;
}

/* 停车位信息 */
.parking-info-section {
  margin-top: 0;
}

.parking-slot-group {
  margin-top: 0;
}

.parking-slot-hint {
  margin: 0;
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  color: #6b7280;
}

.parking-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: clamp(0.5rem, 1.5vh, 0.75rem) clamp(0.625rem, 2vw, 0.875rem);
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
}

.parking-label {
  font-size: clamp(0.75rem, 1.8vw, 0.875rem);
  font-weight: 600;
  color: #166534;
  line-height: 1.2;
}

.parking-value {
  font-size: clamp(0.75rem, 1.8vw, 0.875rem);
  font-weight: 500;
  color: #15803d;
  line-height: 1.2;
}

/* 底部按钮 */
.modal-footer {
  padding: clamp(0.625rem, 1.5vh, 0.875rem) clamp(0.875rem, 3vw, 1.5rem);
  background: #ffffff;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: clamp(0.5rem, 1.5vw, 0.75rem);
  flex-shrink: 0;
}

.cancel-btn,
.save-btn {
  padding: clamp(0.5rem, 1.2vh, 0.625rem) clamp(1rem, 3vw, 1.5rem);
  font-weight: 600;
  font-size: clamp(0.75rem, 1.8vw, 0.875rem);
  border-radius: 6px;
  transition: all 0.2s;
  border: none;
  cursor: pointer;
  white-space: nowrap;
}

.cancel-btn {
  background: #6b7280;
  color: white;
}

.cancel-btn:hover {
  background: #4b5563;
}

.save-btn {
  background: #f97316;
  color: white;
}

.save-btn:hover {
  background: #ea580c;
}

.status-modal-overlay {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.status-modal-wrapper {
  width: min(92vw, 420px);
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.status-modal-header {
  background: #00723a;
  color: #ffffff;
  padding: 0.75rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-modal-title {
  font-size: 1.1875rem;
  font-weight: 600;
  line-height: 1.5;
}

.status-modal-close {
  background: none;
  border: none;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.status-close-icon {
  width: 20px;
  height: 20px;
  stroke: #ffffff;
  fill: none;
}

.status-modal-close:hover .status-close-icon {
  stroke: #d1fae5;
}

.status-modal-body {
  padding: 1.25rem 1.5rem 1rem;
}

.status-dialog-message {
  margin: 0;
  font-size: 18px;
  text-align: center;
  line-height: 1.6;
  color: #374151;
  white-space: pre-line;
}

.status-dialog-message.error {
  color: #f56c6c;
}

.status-dialog-message.success {
  color: #00723a;
}

.status-modal-footer {
  padding: 0.9rem 1.25rem 1.1rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
}

.status-confirm-btn {
  background-color: #00723a;
  border-color: #00723a;
  color: #ffffff;
  font-weight: 600;
  min-width: 88px;
}

.status-confirm-btn:hover {
  background-color: #005a2e;
  border-color: #005a2e;
  color: #ffffff;
}

@media (max-width: 389px) {
  .booking-dialog-wrapper {
    max-width: 98vw;
    max-height: 95vh;
  }

  .modal-body {
    padding: 0.75rem;
  }

  .booking-form-container {
    gap: 0.625rem;
  }

  .time-period-group {
    padding: 0.5rem;
    gap: 0.375rem;
  }

  .time-period-option {
    padding: 0.5rem;
    min-height: 2.25rem;
  }

  .modal-header {
    padding: 0.625rem 0.875rem;
  }

  .close-icon {
    width: 16px;
    height: 16px;
  }

  .modal-footer {
    padding: 0.625rem 0.875rem;
  }
}

@media (min-width: 390px) and (max-width: 767px) {}

@media (min-width: 768px) and (max-width: 1099px) {}


@media (min-width: 1100px) and (max-width: 1599px) {
  /* html zoom 0.8：仅略放宽弹窗宽度与 max-height（脚本 124vh），表单项尺寸沿用默认紧凑样式 */
  .booking-dialog-wrapper {
    max-width: 520px;
  }
}

@media (min-width: 1600px) and (max-width: 2239px) {}

@media (min-width: 2240px) {}

@media (max-height: 700px) and (max-width: 1099px) {
  .booking-dialog-wrapper {
    max-height: 95vh;
  }

  .modal-body {
    padding: 0.75rem 1rem;
  }

  .booking-form-container {
    gap: 0.5rem;
  }

  .form-section {
    gap: 0.375rem;
  }

  .time-period-group {
    padding: 0.625rem;
    gap: 0.375rem;
  }

  .time-period-option {
    padding: 0.5rem 0.625rem;
    min-height: 2.25rem;
  }

  .parking-info {
    padding: 0.5rem 0.625rem;
  }

  .modal-header {
    padding: 0.625rem 1rem;
  }

  .modal-footer {
    padding: 0.625rem 1rem;
  }
}

@media (max-height: 600px) and (max-width: 1099px) {
  .booking-dialog-wrapper {
    max-height: 98vh;
  }

  .modal-body {
    padding: 0.5rem 0.875rem;
  }

  .booking-form-container {
    gap: 0.375rem;
  }

  .time-period-group {
    padding: 0.5rem;
    gap: 0.25rem;
  }

  .time-period-option {
    padding: 0.375rem 0.5rem;
    min-height: 2rem;
  }

  .modal-header {
    padding: 0.5rem 0.875rem;
  }

  .modal-footer {
    padding: 0.5rem 0.875rem;
  }
}
</style>
