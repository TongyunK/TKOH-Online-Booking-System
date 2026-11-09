<template>
  <!-- 自定义遮罩 + 弹窗 -->
  <div class="modal-overlay" @click.self="handleClose" v-if="visible">
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
        <el-form
          ref="formRef"
          :model="form"
          label-width="150px"
          label-position="right"
          class="booking-form"
        >
          <!-- Room, Date, Time Section -->
          <div class="form-section">
            <el-form-item label="Room / Venue" prop="room" :rules="[{ required: true, message: 'Please select a room' }]">
              <el-select
                v-model="form.room"
                placeholder="Select a room"
                style="width: 100%;"
                :disabled="isApprovedOnlyNote"
                :teleported="bookingPopperTeleported"
                popper-class="room-select-popper"
              >
                <el-option
                  v-for="room in availableRooms"
                  :key="room.name"
                  :label="room.name"
                  :value="room.name"
                >
                  <div class="room-option" :class="{ 'is-selected': form.room === room.name }">
                    <span class="room-color-dot" :style="{ backgroundColor: room.color }"></span>
                    <span class="room-option-name">{{ room.name }}</span>
                    <span class="room-option-cap">{{ formatRoomCapacity(room.roomCapacity) }}</span>
                  </div>
                </el-option>
              </el-select>
            </el-form-item>

            <!-- 修复后的日期选择框 -->
            <el-form-item label="Date" prop="date" :rules="[{ required: true, message: 'Please select a date' }]">
              <div class="field-with-availability">
                <el-date-picker
                  v-model="form.date"
                  class="field-with-availability__control"
                  type="date"
                  placeholder="Select date"
                  format="DD/MM/YYYY"
                  value-format="YYYY-MM-DD"
                  :disabled="isApprovedOnlyNote"
                  :disabled-date="disabledDate"
                  :picker-options="{
                    firstDayOfWeek: 1
                  }"
                  clearable
                  :teleported="bookingPopperTeleported"
                  popper-class="date-picker-popper"
                />
                <span
                  v-if="!isApprovedOnlyNote && availabilityFieldOk.date"
                  class="availability-ok"
                  aria-hidden="true"
                >✓</span>
                <span
                  v-else-if="!isApprovedOnlyNote && availabilityFieldFail.date"
                  class="availability-fail"
                  aria-hidden="true"
                >✕</span>
              </div>
            </el-form-item>

            <div class="form-row">
              <el-form-item label="Start Time" prop="startTime" :rules="[{ required: true, message: 'Please select start time' }]" class="form-item-half">
                <div class="field-with-availability">
                  <VenueTimePicker
                    v-model="form.startTime"
                    class="field-with-availability__control venue-time-picker"
                    placeholder="Select start time"
                    :clearable="true"
                    :disabled="isApprovedOnlyNote"
                    :teleported="bookingPopperTeleported"
                  />
                  <span
                    v-if="!isApprovedOnlyNote && availabilityFieldOk.startTime"
                    class="availability-ok"
                  aria-hidden="true"
                >✓</span>
                  <span
                    v-else-if="!isApprovedOnlyNote && availabilityFieldFail.startTime"
                    class="availability-fail"
                  aria-hidden="true"
                >✕</span>
                </div>
              </el-form-item>

              <el-form-item label="End Time" prop="endTime" :rules="[{ required: true, message: 'Please select end time' }]" class="form-item-half">
                <div class="field-with-availability">
                  <VenueTimePicker
                    v-model="form.endTime"
                    class="field-with-availability__control venue-time-picker"
                    placeholder="Select end time"
                    :clearable="true"
                    :disabled="isApprovedOnlyNote"
                    :teleported="bookingPopperTeleported"
                    :min-time="form.startTime"
                  />
                  <span
                    v-if="!isApprovedOnlyNote && availabilityFieldOk.endTime"
                    class="availability-ok"
                  aria-hidden="true"
                >✓</span>
                  <span
                    v-else-if="!isApprovedOnlyNote && availabilityFieldFail.endTime"
                    class="availability-fail"
                  aria-hidden="true"
                >✕</span>
                </div>
              </el-form-item>
            </div>

            <el-form-item v-if="!isApprovedOnlyNote" label=" " class="check-availability-item">
              <el-button type="default" @click="checkAvailability" class="check-btn">
                CHECK AVAILABILITY
              </el-button>
            </el-form-item>
          </div>

          <el-divider class="section-divider" />

          <!-- Event + Additional Services -->
          <div class="form-section paired-layout">
            <div class="paired-left">
              <el-form-item
                label="Meeting / Event Title"
                prop="topic"
                :rules="topicRules"
                class="topic-item no-wrap-label"
              >
                <MeetingEventTitleInput
                  v-model="form.topic"
                  :max-units="meetingEventTitleMaxLength"
                  placeholder="e.g. Meeting of Hospital XXXX Committee"
                  :disabled="isApprovedOnlyNote"
                />
              </el-form-item>

              <el-form-item v-if="showMyNoteField" label="My Note" prop="remark" class="no-wrap-label">
                <el-input
                  v-model="form.remark"
                  type="textarea"
                  :autosize="{ minRows: 1, maxRows: 2 }"
                  resize="none"
                  class="two-line-input"
                  placeholder="Enter any notes"
                ></el-input>
              </el-form-item>

              <el-form-item
                label="No. of participants"
                prop="attendeeCount"
                class="no-wrap-label participants-item"
                :rules="[{ required: true, message: 'Please enter no. of participants', trigger: 'change' }]"
              >
                <p v-if="selectedVenueCapacity != null" class="participants-hint">
                  min: 1, max: {{ selectedVenueCapacity }} (venue capacity)
                </p>
                <p v-else-if="form.room" class="participants-hint">min: 1</p>
                <p v-else class="participants-hint">Select a room to see capacity limit</p>
                <el-input-number
                  v-model="form.attendeeCount"
                  :min="1"
                  :disabled="isApprovedOnlyNote || !form.room"
                  controls-position="right"
                  style="width: 100%"
                />
              </el-form-item>

              <el-form-item
                v-if="showTeaServiceRequiredOption"
                prop="teaServiceRequired"
                class="no-wrap-label tea-service-required-item"
              >
                <template #label>
                  <span class="service-label-with-icon">
                    Tea Service Required?
                    <el-tooltip
                      :content="promptContentByKey.venue_add_booking_tea_service"
                      placement="top-start"
                      :teleported="bookingPopperTeleported"
                      popper-class="venue-booking-prompt-tooltip"
                    >
                      <span class="service-info-trigger">
                        <el-icon class="service-info-icon"><InfoFilled /></el-icon>
                      </span>
                    </el-tooltip>
                  </span>
                </template>
                <el-radio-group v-model="form.teaServiceRequired" :disabled="isApprovedOnlyNote">
                  <el-radio :label="true">Yes</el-radio>
                  <el-radio :label="false">No</el-radio>
                </el-radio-group>
              </el-form-item>
            </div>

            <div class="paired-right">
              <el-form-item class="service-item service-label-left no-wrap-label service-hint-item">
                <template #label>
                  <span class="service-label-with-icon">
                    Venue Setup
                    <el-tooltip
                      :content="promptContentByKey.venue_add_booking_setup"
                      placement="top"
                      :teleported="bookingPopperTeleported"
                      popper-class="venue-booking-prompt-tooltip venue-booking-prompt-tooltip--service"
                    >
                      <span class="service-info-trigger">
                        <el-icon class="service-info-icon"><InfoFilled /></el-icon>
                      </span>
                    </el-tooltip>
                  </span>
                </template>
              </el-form-item>

              <el-form-item class="service-item service-label-left no-wrap-label service-hint-item">
                <template #label>
                  <span class="service-label-with-icon">
                    Equipment
                    <el-tooltip
                      :content="promptContentByKey.venue_add_booking_equipment"
                      placement="top"
                      :teleported="bookingPopperTeleported"
                      popper-class="venue-booking-prompt-tooltip venue-booking-prompt-tooltip--service"
                    >
                      <span class="service-info-trigger">
                        <el-icon class="service-info-icon"><InfoFilled /></el-icon>
                      </span>
                    </el-tooltip>
                  </span>
                </template>
              </el-form-item>

              <el-form-item class="service-item service-label-left no-wrap-label service-hint-item">
                <template #label>
                  <span class="service-label-with-icon">
                    Tools and Materials
                    <el-tooltip
                      :content="promptContentByKey.venue_add_booking_tools_materials"
                      placement="top"
                      :teleported="bookingPopperTeleported"
                      popper-class="venue-booking-prompt-tooltip venue-booking-prompt-tooltip--service"
                    >
                      <span class="service-info-trigger">
                        <el-icon class="service-info-icon"><InfoFilled /></el-icon>
                      </span>
                    </el-tooltip>
                  </span>
                </template>
              </el-form-item>

              <el-form-item class="service-item service-label-left no-wrap-label service-hint-item">
                <template #label>
                  <span class="service-label-with-icon">
                    Others / Special Requests
                    <el-tooltip
                      :content="promptContentByKey.venue_add_booking_others_special_requests"
                      placement="top"
                      :teleported="bookingPopperTeleported"
                      popper-class="venue-booking-prompt-tooltip venue-booking-prompt-tooltip--service"
                    >
                      <span class="service-info-trigger">
                        <el-icon class="service-info-icon"><InfoFilled /></el-icon>
                      </span>
                    </el-tooltip>
                  </span>
                </template>
              </el-form-item>
            </div>

            <div
              v-if="showTeaServiceRequiredOption && form.teaServiceRequired"
              class="paired-tea-full-width"
            >
              <div class="tea-service-options">
                <p class="tea-service-prompt">Please tick as appropriate</p>

                <el-radio-group
                  v-model="form.teaServiceOption"
                  class="tea-service-option-group"
                  :disabled="isApprovedOnlyNote"
                >
                  <div class="tea-service-option-row">
                    <el-radio label="1">
                      <span class="tea-option-label">
                        Option 1: Tea / Attendee <span class="tea-option-zh">（每位茶）</span>
                      </span>
                    </el-radio>
                  </div>

                  <div class="tea-service-option-row tea-service-option-row--inline">
                    <el-radio label="2">
                      <span class="tea-option-label">
                        Option 2: Tea / Attendee <span class="tea-option-zh">（每位茶）</span>,
                      </span>
                    </el-radio>
                    <el-input-number
                      v-model="form.teaServiceRatioFrom"
                      :min="1"
                      :disabled="isApprovedOnlyNote || form.teaServiceOption !== '2'"
                      controls-position="right"
                      class="tea-inline-number"
                    />
                    <span class="tea-inline-text">to</span>
                    <el-input-number
                      v-model="form.teaServiceRatioTo"
                      :min="1"
                      :disabled="isApprovedOnlyNote || form.teaServiceOption !== '2'"
                      controls-position="right"
                      class="tea-inline-number"
                    />
                    <span class="tea-inline-text tea-option-zh">(X對X)</span>
                  </div>

                  <div class="tea-service-option-row tea-service-option-row--inline">
                    <el-radio label="3">
                      <span class="tea-option-label">Option 3: Tea</span>
                    </el-radio>
                    <el-input-number
                      v-model="form.teaServiceTeaPots"
                      :min="0"
                      :disabled="isApprovedOnlyNote || form.teaServiceOption !== '3'"
                      controls-position="right"
                      class="tea-inline-number"
                    />
                    <span class="tea-inline-text">Pot(s) <span class="tea-option-zh">(壺茶)</span> + Water</span>
                    <el-input-number
                      v-model="form.teaServiceWaterPots"
                      :min="0"
                      :disabled="isApprovedOnlyNote || form.teaServiceOption !== '3'"
                      controls-position="right"
                      class="tea-inline-number"
                    />
                    <span class="tea-inline-text">Pot(s) <span class="tea-option-zh">(壺水)</span> + cups</span>
                  </div>
                </el-radio-group>

                <div
                  v-if="isAdmin"
                  class="tea-service-option-row tea-service-option-row--stacked tea-service-option4"
                >
                  <el-checkbox
                    v-model="form.teaServiceOption4"
                    :disabled="isApprovedOnlyNote || !['1', '2', '3'].includes(String(form.teaServiceOption || ''))"
                  >
                    <span class="tea-option-label">
                      Option 4: Special requests other than Option 1 / 2 / 3
                      <span class="tea-option-zh tea-option-zh--required">(請用中文輸入)</span>
                    </span>
                  </el-checkbox>
                  <el-input
                    v-model="form.teaServiceSpecialRequest"
                    type="textarea"
                    :autosize="{ minRows: 2, maxRows: 4 }"
                    resize="none"
                    class="tea-service-special-textarea"
                    :disabled="isApprovedOnlyNote || !form.teaServiceOption4"
                    placeholder="請用中文輸入特殊要求"
                  />
                </div>
              </div>
            </div>

            <!-- 长文案整行放在 Tea Service 下方，避免与右侧 Venue Setup 等重叠 -->
            <el-form-item
              v-if="showUploadEventTitleOption"
              class="display-title-public-item paired-tea-full-width"
              label-width="0"
            >
              <div class="display-title-public-row">
                <span class="display-title-public-label">
                  Upload event title to "Upcoming Events" on TKOH homepage?
                </span>
                <el-radio-group
                  v-model="form.displayOnHomepage"
                  class="display-title-public-radios"
                  :disabled="isApprovedOnlyNote"
                >
                  <el-radio :label="true">Yes</el-radio>
                  <el-radio :label="false">No</el-radio>
                </el-radio-group>
              </div>
            </el-form-item>
          </div>

          <el-divider class="section-divider" />

          <!-- User Info -->
          <div class="form-section user-info-section">
            <ReservedByUserField
              v-if="isAdmin && (!booking || allowAdminReservedBy) && !isApprovedOnlyNote"
              v-model="form.reservedByUserId"
              :default-user="defaultReservedByUser"
              owner-scope="venue"
              form-item-class="no-wrap-label"
              @update:model-value="handleReservedByUserChange"
            />

            <div class="form-row">
              <el-form-item label="Full Name" prop="fullName" class="form-item-half">
                <el-input v-model="form.fullName" disabled />
              </el-form-item>

              <el-form-item label="Department / Unit" prop="department" class="form-item-half no-label">
                <el-input v-model="form.department" disabled />
              </el-form-item>
            </div>

            <div class="form-row">
              <el-form-item label="Contact No." prop="contactPhone" class="form-item-half">
                <el-input v-model="form.contactPhone" disabled />
              </el-form-item>

              <el-form-item label="Email" prop="contactEmail" class="form-item-half no-label">
                <el-input v-model="form.contactEmail" disabled />
              </el-form-item>
            </div>
          </div>
        </el-form>
      </div>

      <!-- 底部按钮 -->
      <div class="modal-footer">
        <el-button @click="handleClose" class="cancel-btn">Cancel</el-button>
        <el-button type="default" @click="handleConfirm" class="submit-btn">
          {{ submitButtonLabel }}
        </el-button>
      </div>
    </div>
  </div>

  <BookingStyleModal v-model="showNoticeDialog" :title="noticeTitle" max-width="420px">
    <p class="notice-message">{{ noticeMessage }}</p>
    <template #footer>
      <el-button type="default" class="submit-btn" @click="showNoticeDialog = false">OK</el-button>
    </template>
  </BookingStyleModal>

  <BookingStyleModal v-model="showPastConfirmDialog" title="Warning" max-width="420px">
    <p class="notice-message">{{ VENUE_BOOKING_PAST_RANGE_MESSAGE }}</p>
    <template #footer>
      <el-button type="default" class="cancel-btn" @click="cancelPastConfirm">Cancel</el-button>
      <el-button type="default" class="submit-btn" @click="confirmPastAndSubmit">Confirm</el-button>
    </template>
  </BookingStyleModal>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import BookingStyleModal from '@/components/BookingStyleModal.vue'
import ReservedByUserField from '@/components/ReservedByUserField.vue'
import VenueTimePicker from '@/components/VenueTimePicker.vue'
import MeetingEventTitleInput from '@/components/MeetingEventTitleInput.vue'
import { InfoFilled } from '@element-plus/icons-vue'
import { getPrompts } from '@/api/promptManagement'
import { checkRoomAvailability } from '@/api/calendar'
import { getUser } from '@/api/userManagement'
import { HTML_ZOOM_BREAKPOINT_MQ } from '@/utils/venueCalendarApi'
import {
  isRestrictedBookingDay,
  isSameDayOrPastBookingRestricted,
  SAME_DAY_BOOKING_NOT_ALLOWED
} from '@/utils/bookingDateRestriction'
import { todayYmdInAppTimeZone } from '@/utils/appTimezone'
import { useUserStore } from '@/stores/user'
import { buildTeaServiceApiPayload, validateTeaServiceForm, parseTeaServiceToForm, venueOffersTeaService } from '@/utils/venueTeaService'
import { validateVenueDailyBookingWindow } from '@/utils/venueDailyBookingWindow'
import { formatUserDisplayName } from '@/utils/userDisplayName'
import {
  validateVenueBookingDateRange,
  isYmdOutsideVenueBookingDateRange
} from '@/utils/venueBookingDateRange'
import {
  isVenueBookingRangePast,
  VENUE_BOOKING_PAST_RANGE_MESSAGE
} from '@/utils/venueBookingPast'
import { pickPromptTooltipText } from '@/utils/promptTooltip'
import {
  DEFAULT_MEETING_EVENT_TITLE_MAX_LENGTH,
  fetchMeetingEventTitleMaxLength,
  createMeetingEventTitleMaxRule
} from '@/utils/meetingEventTitleMaxLength'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  booking: {
    type: Object,
    default: null
  },
  roomType: {
    type: String,
    default: 'conference'
  },
  selectedTime: {
    type: Object,
    default: null
  },
  venueList: {
    type: Array,
    default: () => []
  },
  publicHolidayDates: {
    type: Object,
    default: () => ({})
  },
  /** Venue Booking Date Range（YYYY-MM-DD） */
  bookingWindowStart: {
    type: String,
    default: ''
  },
  bookingWindowEnd: {
    type: String,
    default: ''
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  mode: {
    type: String,
    default: 'create'
  },
  /** 管理员在管理页编辑他人预订时，仍显示 Reserved By */
  allowAdminReservedBy: {
    type: Boolean,
    default: false
  }
})

const dialogTitle = computed(() =>
  props.mode === 'edit' ? 'Edit Booking' : 'Add Booking'
)

const submitButtonLabel = computed(() =>
  props.mode === 'edit' ? 'SAVE BOOKING' : 'SUBMIT BOOKING'
)

/** 已 Approved：普通用户仅可改 My Note；管理员可改任意字段 */
const isApprovedOnlyNote = computed(() =>
  props.mode === 'edit' &&
  !props.isAdmin &&
  String(props.booking?.approvalStatus || '').toLowerCase() === 'approved'
)

/**
 * 编辑时始终展示 My Note（含 ManageBooking All Bookings）。
 * 新建且管理员代订他人时不展示，避免写入管理员自己的备注。
 */
const showMyNoteField = computed(() => {
  if (props.mode === 'edit') return true
  return !(props.isAdmin && props.allowAdminReservedBy)
})

const emit = defineEmits(['confirm', 'close'])

const userStore = useUserStore()
const { userInfo } = storeToRefs(userStore)

const defaultReservedByUser = computed(() => {
  if (props.booking?.reservedByUserId) {
    return {
      id: String(props.booking.reservedByUserId),
      name: props.booking.reservedBy || props.booking.fullName || props.booking.reservedByUserId,
      corpId: props.booking.corpId || ''
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

function buildReservedByProfile (user) {
  if (!user) {
    return {
      fullName: '',
      department: '',
      contactPhone: '',
      contactEmail: ''
    }
  }
  return {
    fullName: formatUserDisplayName(user) || '',
    department: user.department || '',
    contactPhone: user.contact || '',
    contactEmail: user.email || ''
  }
}

function getCurrentUserProfile () {
  return buildReservedByProfile(userInfo.value)
}

function resolveSubmitReservedByUserId () {
  const selfId = defaultReservedByUser.value?.id || ''
  if (!props.isAdmin) return selfId
  return String(form.value.reservedByUserId || selfId).trim()
}

function applyReservedByProfile (profile) {
  form.value.fullName = profile.fullName
  form.value.department = profile.department
  form.value.contactPhone = profile.contactPhone
  form.value.contactEmail = profile.contactEmail
}

async function syncReservedByProfile (userId) {
  if (!props.isAdmin) {
    applyReservedByProfile(getCurrentUserProfile())
    return
  }
  const id = String(userId || '').trim()
  if (!id || id === defaultReservedByUser.value?.id) {
    applyReservedByProfile(getCurrentUserProfile())
    return
  }
  try {
    const user = await getUser(id)
    applyReservedByProfile(buildReservedByProfile(user))
  } catch (error) {
    console.error('Failed to load reserved-by user profile:', error)
    applyReservedByProfile({
      fullName: '',
      department: '',
      contactPhone: '',
      contactEmail: ''
    })
  }
}

async function handleReservedByUserChange (userId) {
  if (!props.isAdmin || !props.visible) return
  if (props.booking && !props.allowAdminReservedBy) return
  await syncReservedByProfile(userId)
}

const formRef = ref(null)
const showNoticeDialog = ref(false)
const noticeTitle = ref('Notice')
const noticeMessage = ref('')
const showPastConfirmDialog = ref(false)

const showNotice = (message, title = 'Notice') => {
  noticeTitle.value = title
  noticeMessage.value = message
  showNoticeDialog.value = true
}

function cancelPastConfirm () {
  showPastConfirmDialog.value = false
}

function confirmPastAndSubmit () {
  showPastConfirmDialog.value = false
  // 不在此关闭：由父组件 API 成功后再关，失败时保留表单便于修改
  emit('confirm', buildBookingConfirmPayload())
}

function submitBookingAfterValidation () {
  if (
    !props.isAdmin &&
    isVenueBookingRangePast(form.value.date, form.value.startTime, form.value.endTime)
  ) {
    showPastConfirmDialog.value = true
    return
  }
  // 不在此关闭：由父组件 API 成功后再关，失败时保留表单便于修改
  emit('confirm', buildBookingConfirmPayload())
}

const promptList = ref([])

/** Check Availability 结果：Date / Start / End 右侧绿色 ✓ 或红色 ✕ */
const availabilityFieldOk = ref({
  date: false,
  startTime: false,
  endTime: false
})

const availabilityFieldFail = ref({
  date: false,
  startTime: false,
  endTime: false
})

function clearAvailabilityIndicators () {
  availabilityFieldOk.value = {
    date: false,
    startTime: false,
    endTime: false
  }
  availabilityFieldFail.value = {
    date: false,
    startTime: false,
    endTime: false
  }
}

function setAvailabilityPass () {
  availabilityFieldFail.value = {
    date: false,
    startTime: false,
    endTime: false
  }
  availabilityFieldOk.value = {
    date: true,
    startTime: true,
    endTime: true
  }
}

/** fieldErrors 中 true = 该字段不合规 */
function setAvailabilityFromFieldErrors (fieldErrors) {
  const dateFail = Boolean(fieldErrors?.date)
  const startFail = Boolean(fieldErrors?.startTime)
  const endFail = Boolean(fieldErrors?.endTime)
  const any =
    fieldErrors &&
    (dateFail || startFail || endFail)
  if (!any) {
    setAvailabilityFail()
    return
  }
  availabilityFieldFail.value = {
    date: dateFail,
    startTime: startFail,
    endTime: endFail
  }
  availabilityFieldOk.value = {
    date: !dateFail,
    startTime: !startFail,
    endTime: !endFail
  }
}

function setAvailabilityFail () {
  availabilityFieldOk.value = {
    date: false,
    startTime: false,
    endTime: false
  }
  availabilityFieldFail.value = {
    date: true,
    startTime: true,
    endTime: true
  }
}

const promptContentByKey = computed(() => {
  const list = promptList.value
  return {
    venue_add_booking_setup: pickPromptTooltipText(list, 'venue_add_booking_setup'),
    venue_add_booking_equipment: pickPromptTooltipText(list, 'venue_add_booking_equipment'),
    venue_add_booking_tools_materials: pickPromptTooltipText(list, 'venue_add_booking_tools_materials'),
    venue_add_booking_others_special_requests: pickPromptTooltipText(list, 'venue_add_booking_others_special_requests'),
    venue_add_booking_tea_service: pickPromptTooltipText(list, 'venue_add_booking_tea_service')
  }
})

// 拖拽相关
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dialogX = ref(0)
const dialogY = ref(0)

/** 14" 视口（1100–1599）：弹窗略增高，与 MeetingApproval / UserManagement 一致 */
const VENUE_BOOKING_DIALOG_MODAL_MQ = HTML_ZOOM_BREAKPOINT_MQ
const venueBookingDialogMaxHeight = ref('')
/** 14" html zoom：Room / Date / Time / Prompt Tooltip 勿挂 body，避免坐标偏移与 Teleport 目标为 null */
const bookingPopperTeleported = ref(true)

function updateVenueBookingDialogMaxHeight () {
  if (typeof window === 'undefined') return
  const mq = window.matchMedia(VENUE_BOOKING_DIALOG_MODAL_MQ)
  venueBookingDialogMaxHeight.value = mq.matches ? '124vh' : ''
  bookingPopperTeleported.value = !mq.matches
}

let venueBookingDialogModalMq = null

const dialogWrapperStyle = computed(() => ({
  transform: `translate(${dialogX.value}px, ${dialogY.value}px)`,
  ...(venueBookingDialogMaxHeight.value ? { maxHeight: venueBookingDialogMaxHeight.value } : {})
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

onMounted(async () => {
  updateVenueBookingDialogMaxHeight()
  venueBookingDialogModalMq = window.matchMedia(VENUE_BOOKING_DIALOG_MODAL_MQ)
  venueBookingDialogModalMq.addEventListener('change', updateVenueBookingDialogMaxHeight)
  meetingEventTitleMaxLength.value = await fetchMeetingEventTitleMaxLength()
  try {
    const prompts = await getPrompts()
    promptList.value = Array.isArray(prompts) ? prompts : []
  } catch (error) {
    console.error('Failed to load venue booking prompts:', error)
  }
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  if (venueBookingDialogModalMq) {
    venueBookingDialogModalMq.removeEventListener('change', updateVenueBookingDialogMaxHeight)
  }
})

const meetingEventTitleMaxLength = ref(DEFAULT_MEETING_EVENT_TITLE_MAX_LENGTH)
const topicRules = computed(() => [
  { required: true, message: 'Please enter topic' },
  createMeetingEventTitleMaxRule(() => meetingEventTitleMaxLength.value)
])

const form = ref({
  reservedByUserId: '',
  room: '',
  date: null, // 日期初始化为null
  startTime: '',
  endTime: '',
  topic: '',
  remark: '',
  teaServiceRequired: false,
  attendeeCount: null,
  displayOnHomepage: false,
  teaServiceOption: '1',
  teaServiceOption4: false,
  teaServiceRatioFrom: null,
  teaServiceRatioTo: null,
  teaServiceTeaPots: null,
  teaServiceWaterPots: null,
  teaServiceSpecialRequest: '',
  fullName: '',
  department: '',
  contactPhone: '',
  contactEmail: ''
})

const availableRooms = computed(() => {
  if (Array.isArray(props.venueList) && props.venueList.length > 0) {
    return props.venueList
      .filter((room) => String(room?.status || 'active').toLowerCase() === 'active')
      .map(room => ({
      name: room.name,
      color: room.color,
      roomCapacity: room.roomCapacity ?? room.capacity ?? null,
      teaServiceAvailable: room.teaServiceAvailable,
      userDefinedUploadEventTitle: room.userDefinedUploadEventTitle !== false
    }))
  }
  return []
})

const selectedVenue = computed(() =>
  availableRooms.value.find((room) => room.name === form.value.room) ?? null
)

const selectedVenueRecord = computed(() =>
  (props.venueList || []).find((venue) => venue.name === form.value.room) ?? null
)

function validateSelectedVenueDailyBookingWindow () {
  if (props.isAdmin) return { ok: true }
  const venue = selectedVenueRecord.value
  if (!venue) return { ok: true }
  return validateVenueDailyBookingWindow(
    venue,
    form.value.startTime,
    form.value.endTime
  )
}

function validateSelectedVenueBookingDateRange () {
  return validateVenueBookingDateRange(
    form.value.date,
    props.bookingWindowStart,
    props.bookingWindowEnd
  )
}

/** 所选场地容量；无有效值时为 null */
const selectedVenueCapacity = computed(() => {
  const cap = Number(selectedVenue.value?.roomCapacity)
  return Number.isFinite(cap) && cap >= 1 ? cap : null
})

function formatRoomCapacity (value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return ''
  return `cap ${n}`
}

function validateParticipantCount () {
  if (!form.value.room) {
    return { ok: false, message: 'Please select a room / venue' }
  }
  const raw = form.value.attendeeCount
  if (raw === null || raw === undefined || raw === '') {
    return { ok: false, message: 'Please enter no. of participants' }
  }
  const count = Number(raw)
  if (!Number.isFinite(count) || count < 1) {
    return { ok: false, message: 'No. of participants must be at least 1' }
  }
  const cap = selectedVenueCapacity.value
  if (cap != null && count > cap) {
    return {
      ok: false,
      message: `No. of participants (${count}) exceeds the capacity of "${form.value.room}" (maximum: ${cap}).`
    }
  }
  return { ok: true }
}

function isVenueBookingDateTodayOrEarlier(ymd) {
  const date = String(ymd || '').trim()
  if (!date) return false
  return date <= todayYmdInAppTimeZone()
}

/** Start 之后最近 15 分钟刻度，供 End Time 自动回填 */
function nextVenueEndTimeAfter (startHm, endHour = 22, step = 15) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(startHm || '').trim())
  if (!m) return ''
  let total = Number(m[1]) * 60 + Number(m[2]) + step
  total = Math.ceil(total / step) * step
  const hour = Math.floor(total / 60)
  const minute = total % 60
  if (hour > endHour || (hour === endHour && minute > 0)) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(hour)}:${pad(minute)}`
}

function applyTeaServiceVisibilityRules() {
  if (venueOffersTeaService(selectedVenue.value)) {
    // 管理员：今日/过去日期也可选茶歇；普通用户仅未来日期可见
    if (props.isAdmin || !isVenueBookingDateTodayOrEarlier(form.value.date)) {
      return
    }
  }
  form.value.teaServiceRequired = false
  form.value.teaServiceOption4 = false
  form.value.teaServiceSpecialRequest = ''
}

const showTeaServiceRequiredOption = computed(() => {
  if (!venueOffersTeaService(selectedVenue.value)) return false
  // 管理员不受「今日及以前不可选茶歇」约束
  if (props.isAdmin) return true
  return !isVenueBookingDateTodayOrEarlier(form.value.date)
})

/** 仅当场地开启 Upload event title 开关时显示该选项 */
const showUploadEventTitleOption = computed(() => {
  const venue = selectedVenue.value ?? selectedVenueRecord.value
  if (venue == null) return false
  return venue.userDefinedUploadEventTitle !== false
})

function applyUploadEventTitleVisibilityRules() {
  if (showUploadEventTitleOption.value) return
  form.value.displayOnHomepage = false
}

// 非管理员禁用今日及过去；所有人禁用 Venue Booking Date Range 之外；管理员可选周末/假日
function disabledDate(date) {
  const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  if (isSameDayOrPastBookingRestricted(ymd, {
    isAdmin: props.isAdmin,
    todayYmd: todayYmdInAppTimeZone()
  })) {
    return true
  }
  if (isYmdOutsideVenueBookingDateRange(ymd, props.bookingWindowStart, props.bookingWindowEnd)) {
    return true
  }
  return isRestrictedBookingDay(ymd, {
    isAdmin: props.isAdmin,
    publicHolidayDates: props.publicHolidayDates
  })
}

async function checkAvailability () {
  clearAvailabilityIndicators()

  if (!form.value.room || !form.value.date || !form.value.startTime || !form.value.endTime) {
    showNotice('Please fill in Room, Date, Start Time and End Time first', 'Warning')
    return
  }

  if (form.value.startTime >= form.value.endTime) {
    setAvailabilityFromFieldErrors({ date: false, startTime: true, endTime: true })
    showNotice('End time must be after start time', 'Warning')
    return
  }

  const dateRangeCheck = validateSelectedVenueBookingDateRange()
  if (!dateRangeCheck.ok) {
    setAvailabilityFromFieldErrors({ date: true, startTime: false, endTime: false })
    showNotice(dateRangeCheck.message, 'Warning')
    return
  }

  const dailyWindowCheck = validateSelectedVenueDailyBookingWindow()
  if (!dailyWindowCheck.ok) {
    setAvailabilityFromFieldErrors({ date: false, startTime: true, endTime: true })
    showNotice(dailyWindowCheck.message, 'Warning')
    return
  }

  const venue = (props.venueList || []).find(v => v.name === form.value.room)
  if (!venue?.id) {
    showNotice('Room not found', 'Warning')
    return
  }

  try {
    const result = await checkRoomAvailability(
      String(venue.id),
      form.value.date,
      form.value.startTime,
      form.value.endTime,
      props.booking?.id != null ? String(props.booking.id) : undefined
    )
    if (result?.available) {
      setAvailabilityPass()
    } else {
      const message = result?.message || 'Room is not available for the selected time slot'
      setAvailabilityFromFieldErrors(result?.fieldErrors)
      showNotice(message, 'Warning')
    }
  } catch (error) {
    console.error('Availability check failed:', error)
    const message =
      error?.response?.data?.message ||
      error?.message ||
      'Availability check failed. Please try again.'
    setAvailabilityFail()
    showNotice(message, 'Warning')
  }
}

/** 仅提交可持久化字段（场地布置/设备等 ℹ️ 行不入库） */
function buildBookingConfirmPayload () {
  const reservedByUserId = resolveSubmitReservedByUserId()
  const teaPayload = buildTeaServiceApiPayload(form.value)
  const payload = {
    reservedByUserId,
    room: form.value.room,
    roomName: form.value.room,
    date: form.value.date,
    startTime: form.value.startTime,
    endTime: form.value.endTime,
    topic: form.value.topic,
    attendeeCount: form.value.attendeeCount,
    displayOnHomepage: form.value.displayOnHomepage !== false,
    ...teaPayload,
    id: props.booking?.id
  }
  if (showMyNoteField.value) {
    payload.remark = form.value.remark
    payload.myNote = form.value.remark
  }
  return payload
}

function initializeForm() {
  if (props.booking) {
    const teaFromService = parseTeaServiceToForm(props.booking.teaService)
    form.value = {
      teaServiceSpecialRequest: '',
      teaServiceOption: '1',
      teaServiceRatioFrom: null,
      teaServiceRatioTo: null,
      teaServiceTeaPots: null,
      teaServiceWaterPots: null,
      ...teaFromService,
      ...props.booking,
      remark: props.booking.remark ?? props.booking.myNote ?? '',
      attendeeCount: props.booking.attendeeCount
        ?? props.booking.teaServiceParticipants
        ?? props.booking.participants
        ?? null,
      displayOnHomepage: props.booking.displayOnHomepage !== false,
      teaServiceOption: (() => {
        const raw = props.booking.teaServiceOption && props.booking.teaServiceOption !== 'none'
          ? String(props.booking.teaServiceOption)
          : teaFromService.teaServiceOption
        return raw === '4' ? '1' : raw
      })(),
      teaServiceOption4: Boolean(
        teaFromService.teaServiceOption4 ||
        props.booking.teaServiceOption4 ||
        String(props.booking.teaServiceSpecialRequest || teaFromService.teaServiceSpecialRequest || '').trim()
      ),
      teaServiceSpecialRequest: props.booking.teaServiceSpecialRequest
        || teaFromService.teaServiceSpecialRequest
        || ''
    }
    if (!form.value.fullName) {
      applyReservedByProfile({
        fullName: props.booking.reservedBy || props.booking.fullName || '',
        department: props.booking.department || '',
        contactPhone: props.booking.contact || props.booking.contactPhone || '',
        contactEmail: props.booking.email || props.booking.contactEmail || ''
      })
    } else if (props.allowAdminReservedBy && props.isAdmin) {
      void syncReservedByProfile(form.value.reservedByUserId)
    }
  } else {
    const selfId = defaultReservedByUser.value?.id || ''
    const profile = getCurrentUserProfile()
    form.value = {
      reservedByUserId: selfId,
      room: '',
      date: null, // 初始化日期为空
      startTime: '',
      endTime: '',
      topic: '',
      remark: '',
      teaServiceRequired: false,
      attendeeCount: null,
      displayOnHomepage: false,
      teaServiceOption: '1',
      teaServiceOption4: false,
      teaServiceRatioFrom: null,
      teaServiceRatioTo: null,
      teaServiceTeaPots: null,
      teaServiceWaterPots: null,
      teaServiceSpecialRequest: '',
      ...profile
    }
    if (props.selectedTime) {
      form.value.date = props.selectedTime.date
      form.value.startTime = props.selectedTime.time
      form.value.room = props.selectedTime.room || ''
      if (form.value.startTime) {
        form.value.endTime = nextVenueEndTimeAfter(form.value.startTime)
      }
    }
  }
  applyTeaServiceVisibilityRules()
  applyUploadEventTitleVisibilityRules()
}

function handleConfirm() {
  if (!formRef.value) return

  if (isApprovedOnlyNote.value) {
    emit('confirm', {
      id: props.booking?.id,
      remark: form.value.remark,
      room: props.booking?.room || props.booking?.roomName || form.value.room,
      roomName: props.booking?.room || props.booking?.roomName || form.value.room,
      date: props.booking?.date || form.value.date,
      startTime: props.booking?.startTime || form.value.startTime,
      endTime: props.booking?.endTime || form.value.endTime,
      topic: props.booking?.topic || form.value.topic,
      approvalStatus: props.booking?.approvalStatus
    })
    return
  }

  const participantCheck = validateParticipantCount()
  if (!participantCheck.ok) {
    showNotice(participantCheck.message, 'Error')
    return
  }

  const teaCheck = validateTeaServiceForm(form.value, { isAdmin: props.isAdmin })
  if (!teaCheck.ok) {
    showNotice(teaCheck.message, 'Error')
    return
  }

  if (isSameDayOrPastBookingRestricted(form.value.date, {
    isAdmin: props.isAdmin,
    todayYmd: todayYmdInAppTimeZone()
  })) {
    showNotice(SAME_DAY_BOOKING_NOT_ALLOWED, 'Warning')
    return
  }

  applyUploadEventTitleVisibilityRules()

  formRef.value.validate((valid) => {
    if (valid) {
      // 验证结束时间是否晚于开始时间
      if (form.value.startTime && form.value.endTime && form.value.startTime >= form.value.endTime) {
        showNotice('End time must be later than start time', 'Error')
        return
      }
      const dateRangeCheck = validateSelectedVenueBookingDateRange()
      if (!dateRangeCheck.ok) {
        setAvailabilityFromFieldErrors({ date: true, startTime: false, endTime: false })
        showNotice(dateRangeCheck.message, 'Error')
        return
      }
      const dailyWindowCheck = validateSelectedVenueDailyBookingWindow()
      if (!dailyWindowCheck.ok) {
        setAvailabilityFromFieldErrors({ date: false, startTime: true, endTime: true })
        showNotice(dailyWindowCheck.message, 'Error')
        return
      }
      submitBookingAfterValidation()
    } else {
      showNotice('Please fill in all required fields', 'Error')
    }
  })
}

function handleClose() {
  clearAvailabilityIndicators()
  emit('close')
  // 重置表单验证状态
  if (formRef.value) {
    formRef.value.clearValidate()
  }
}

watch(() => props.visible, (val) => {
  if (val) {
    initializeForm()
    clearAvailabilityIndicators()
    // 重置对话框位置
    dialogX.value = 0
    dialogY.value = 0
  }
})

watch(
  () => form.value.reservedByUserId,
  (userId) => {
    if (!props.visible || (!props.allowAdminReservedBy && props.booking)) return
    if (!props.isAdmin) return
    void syncReservedByProfile(userId)
  }
)

watch(() => form.value.room, () => {
  clearAvailabilityIndicators()
  applyTeaServiceVisibilityRules()
  applyUploadEventTitleVisibilityRules()
})

watch(
  () => [form.value.date, form.value.startTime, form.value.endTime],
  () => {
    clearAvailabilityIndicators()
  }
)

watch(() => form.value.date, () => {
  applyTeaServiceVisibilityRules()
})

watch(() => form.value.startTime, (start) => {
  if (!start) return
  if (!form.value.endTime || form.value.endTime <= start) {
    form.value.endTime = nextVenueEndTimeAfter(start)
  }
})

watch(() => form.value.teaServiceRequired, (yes) => {
  if (!yes) {
    form.value.teaServiceOption4 = false
    form.value.teaServiceSpecialRequest = ''
    return
  }
  if (!form.value.teaServiceOption || form.value.teaServiceOption === '4' || form.value.teaServiceOption === 'none') {
    form.value.teaServiceOption = '1'
  }
})

watch(() => form.value.teaServiceOption4, (on) => {
  if (!on) {
    form.value.teaServiceSpecialRequest = ''
  }
})

watch(() => form.value.teaServiceOption, (option) => {
  if (!['1', '2', '3'].includes(String(option || ''))) {
    form.value.teaServiceOption4 = false
    form.value.teaServiceSpecialRequest = ''
  }
})
</script>

<style>
/* 遮罩层 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  /* 解决小屏滚动问题：允许遮罩层滚动 */
  overflow-y: auto;
  padding: 20px 0;
}

/* 弹窗容器 */
.booking-dialog-wrapper {
  width: 75%;
  max-width: 900px;
  max-height: 94vh;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  /* 允许提示浮层越界画到遮罩上（teleported=false / 14" zoom）；纵向滚动仍由 modal-body 负责 */
  overflow: visible;
  position: relative;
  z-index: 10000;
  /* 修复小屏滚动：确保容器在flex布局中正确计算高度 */
  flex-shrink: 0;
}

/* 头部 */
.modal-header {
  background: #00723a;
  color: #fff;
  padding: 0.75rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: move;
  user-select: none;
  flex-shrink: 0; /* 头部不收缩 */
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}
.modal-title {
  font-size: 1.0625rem;
  font-weight: 600;
  line-height: 1.5;
}

/* 关闭按钮（加粗 ×） */
.modal-close {
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
.close-icon {
  width: 20px;
  height: 20px;
  stroke: white;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
}
.modal-close:hover .close-icon {
  stroke: #d1fae5;
}

/* 内容区 - 修复滚动和日期选择器样式问题 */
.modal-body {
  padding: 1.125rem 1.75rem;
  flex: 1;
  /* clip：teleported=false 时提示可越界显示，且不会像 visible+auto 那样把 overflow-x 算成 auto 产生横滚 */
  overflow-x: clip;
  overflow-y: auto;
  padding-bottom: 20px;
  /* 确保内容区高度计算正确 */
  min-height: 0;
}
.modal-body::-webkit-scrollbar {
  width: 6px;
}
.modal-body::-webkit-scrollbar-track {
  background: #f3f4f6;
  border-radius: 3px;
}
.modal-body::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

/* 底部 */
.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0; /* 底部不收缩 */
}

/* 修复下拉框样式 */
.room-select-popper,
.venue-time-picker-popper,
.date-picker-popper,
.reserved-by-user-select {
  z-index: 100001 !important;
}

.room-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.room-option-name {
  color: #111827;
}

.room-option-cap {
  margin-left: auto;
  font-size: 0.75rem;
  color: #6b7280;
}

.room-option.is-selected .room-option-name,
.room-option.is-selected .room-option-cap {
  font-weight: 700;
}

.room-color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* 修复日期选择器数字不显示问题 */
:deep(.el-date-table) {
  font-size: 14px;
}
:deep(.el-date-table td) {
  color: #333 !important;
  line-height: 28px;
}
:deep(.el-date-table td.disabled) {
  color: #ccc !important;
}
:deep(.el-date-table td.today) {
  color: #00723a !important;
  font-weight: bold;
}
:deep(.el-date-table td.current) {
  background-color: #00723a !important;
  color: #fff !important;
}
:deep(.el-date-table td.current:hover) {
  background-color: #005a2e !important;
}
:deep(.el-date-editor) {
  width: 100%;
}
:deep(.el-date-picker__header-label) {
  font-weight: 600;
  color: #333;
}

/* teleported=false：相对触发器定位；勿用 fixed（html zoom 0.8 挂 body 时会偏移） */
:deep(.date-picker-popper) {
  z-index: 100000 !important;
}

/* Tooltip 默认挂到 body，scoped 的 :deep(.el-popper) 无法作用到其上，会被 modal-overlay(9999) 挡住 */
.venue-booking-prompt-tooltip {
  z-index: 100001 !important;
  box-sizing: border-box;
  /* teleported=false 时不被窄列锁死宽度；短文案随内容，长文案到上限后换行 */
  width: fit-content !important;
  max-width: min(320px, 90vw) !important;
  white-space: pre-line;
  overflow-wrap: break-word;
  word-break: break-word;
  line-height: 1.45;
  text-align: left;
}

/* 右侧 Venue Setup 等：与主提示同一尺寸规则，避免 14" 窄列挤换行或超长单行 */
.venue-booking-prompt-tooltip--service {
  min-width: 10rem;
  max-width: min(320px, 90vw) !important;
}
</style>

<style scoped>
/* 原有表单样式保持不变 */
.booking-form {
  width: 100%;
}

.booking-form :deep(.el-form-item) {
  margin-bottom: 0.875rem;
}

.booking-form :deep(.el-form-item__label) {
  justify-content: flex-end;
  text-align: right;
}

.form-section {
  margin-bottom: 0.375rem;
}

.paired-layout {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  column-gap: 1.5rem;
  row-gap: 0.15rem;
  align-items: start;
}

.paired-left,
.paired-right {
  display: flex;
  flex-direction: column;
}

/* 左侧（茶歇等）较宽内容可能溢出到视觉上的右侧；抬高右列层级并让其在网格行内拉满高度，避免下半区事件落到左列 */
.paired-left {
  padding-left: 0.75rem;
  position: relative;
  z-index: 1;
  overflow: visible;
}

.paired-right {
  align-self: stretch;
  position: relative;
  z-index: 2;
  overflow: visible;
}

/* 茶歇详细选项跨整行，不局限在左列 */
.paired-tea-full-width {
  grid-column: 1 / -1;
  min-width: 0;
}

/* 小屏单列：左列 → 茶歇选项 → 右侧服务标签（避免茶歇块跑到 Venue Setup 下面） */
@media (max-width: 1099px) {
  .paired-layout > .paired-left {
    order: 1;
  }
  .paired-layout > .paired-tea-full-width:not(.display-title-public-item) {
    order: 2;
  }
  .paired-layout > .paired-right {
    order: 3;
  }
  .paired-layout > .display-title-public-item.paired-tea-full-width {
    order: 4;
  }
}

.form-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.875rem;
  width: 100%;
}

.form-row-three {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
}

.form-item-half {
  margin-bottom: 0;
}

.form-item-third {
  margin-bottom: 0;
}

.form-item-half,
.form-item-third,
.booking-form :deep(.el-form-item__content),
.booking-form :deep(.el-input),
.booking-form :deep(.el-select),
.booking-form :deep(.el-date-editor),
.booking-form :deep(.el-time-picker),
.booking-form :deep(.el-textarea) {
  min-width: 0;
}

.form-item-half.no-label-desktop :deep(.el-form-item__label),
.form-item-third.no-label-desktop :deep(.el-form-item__label) {
  display: none;
}

.form-item-half.no-label-desktop :deep(.el-form-item__content),
.form-item-third.no-label-desktop :deep(.el-form-item__content) {
  margin-left: 0 !important;
}

.field-with-availability {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  min-width: 0;
}

.field-with-availability__control {
  flex: 1;
  min-width: 0;
  width: 100%;
}

.field-with-availability :deep(.venue-time-picker.el-date-editor),
.field-with-availability :deep(.venue-time-picker.el-input),
.field-with-availability :deep(.venue-time-picker .el-input),
.field-with-availability :deep(.venue-step-time-picker) {
  width: 100%;
}

.field-with-availability__control.el-date-editor,
.field-with-availability__control.venue-step-time-picker {
  width: 100% !important;
}

.availability-ok,
.availability-fail {
  flex-shrink: 0;
  width: 1.25rem;
  text-align: center;
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1;
}

.availability-ok {
  color: #16a34a;
}

.availability-fail {
  color: #dc2626;
}

.check-availability-item {
  margin-bottom: 0.375rem;
}

.check-btn {
  width: 100%;
  background-color: #3b82f6;
  border-color: #3b82f6;
  font-weight: bold;
  font-size: 0.8125rem;
  padding: 0.5rem 1rem;
  color: #ffffff;
}

.check-btn:hover {
  background-color: #66b1ff;
  border-color: #66b1ff;
}

.section-divider {
  margin: 0.875rem 0;
}

.tea-service-options {
  background-color: #f9fafb;
  padding: 0.75rem 1rem;
  border-radius: 0.375rem;
  margin-top: 0.05rem;
  font-size: 14px;
  line-height: 1.45;
  text-align: left;
}

.tea-service-prompt {
  margin: 0 0 0.75rem;
  font-style: italic;
  font-weight: 700;
  font-size: inherit;
  color: #111827;
  text-align: left;
}

.tea-service-option-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  align-items: flex-start;
  /* Element Plus 的 .el-radio-group 默认 font-size: 0，行内 span 会继承为 0 而不可见 */
  font-size: 14px;
  line-height: 1.45;
}

.tea-service-option-group :deep(.el-radio) {
  height: auto;
  margin-right: 0;
  align-items: flex-start;
}

.tea-service-option-group :deep(.el-radio__label) {
  white-space: normal;
  line-height: inherit;
  font-size: inherit;
  padding-left: 0.5rem;
}

.tea-service-option-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 0.5rem;
  width: 100%;
  text-align: left;
}

.tea-service-option-row--inline {
  padding-left: 0;
}

.tea-service-option-row--stacked {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

.tea-service-option4 {
  margin-top: 0.35rem;
  padding-top: 0.35rem;
  border-top: 1px dashed #e5e7eb;
}

.tea-service-option4 :deep(.el-checkbox) {
  align-items: flex-start;
  height: auto;
  white-space: normal;
}

.tea-service-option4 :deep(.el-checkbox__label) {
  white-space: normal;
  line-height: 1.4;
}

.tea-option-label,
.tea-option-zh,
.tea-inline-text {
  font-size: inherit;
  line-height: inherit;
}

.tea-option-label {
  font-weight: 500;
  color: #111827;
}

.tea-option-zh {
  color: #374151;
}

.tea-option-zh--required {
  color: #dc2626;
}

.tea-inline-number {
  width: 88px;
}

.tea-inline-number :deep(.el-input__inner) {
  font-size: inherit;
}

.tea-inline-text {
  color: #111827;
  flex-shrink: 0;
}

.tea-service-option-row--stacked .tea-service-special-textarea {
  margin-left: 0;
  width: 100%;
}

.tea-service-special-textarea :deep(.el-textarea__inner) {
  line-height: inherit;
  font-size: inherit;
}

.tea-service-line {
  margin-bottom: 0.25rem;
}

.tea-service-followup {
  margin-bottom: 0;
}

.tea-service-special-req {
  margin-top: 0.5rem;
  margin-bottom: 0;
  align-items: flex-start;
}

.tea-service-special-req :deep(.el-form-item__label) {
  padding-top: 0.35rem;
}

.tea-service-line :deep(.el-form-item__label) {
  justify-content: flex-end;
  text-align: right;
}

.tea-service-line :deep(.el-form-item__content) {
  display: flex;
  align-items: center;
}

.tea-service-radios {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 1.25rem;
  row-gap: 0;
  justify-content: stretch;
  width: 100%;
  max-width: 36rem;
}

.paired-tea-full-width .tea-service-radios {
  max-width: none;
}

.tea-service-radios :deep(.el-radio) {
  margin-right: 0;
  white-space: nowrap;
}

.tea-service-note {
  margin: -0.375rem 0 0.625rem;
  color: #b45309;
  font-size: 0.75rem;
  line-height: 1.4;
}

.participants-hint {
  margin: 0 0 0.25rem 0;
  font-size: 0.75rem;
  color: #9ca3af;
  line-height: 1.2;
}

.participants-item :deep(.el-form-item__label) {
  margin-top: 1rem;
}

.tea-service-options .form-row {
  margin-bottom: 0;
}

.tea-service-options .form-item-half {
  margin-bottom: 0;
}

.service-item {
  margin-bottom: 0;
}

.service-label-left :deep(.el-form-item__label) {
  justify-content: flex-start;
  text-align: left;
  padding-left: 1.25rem;
  overflow: visible;
  position: relative;
  z-index: 2;
}

/* 仅标签、无输入域时左侧 content 仍占 flex 空间，可能挡住同项内靠后的 label/图标命中与 cursor */
.service-label-left :deep(.el-form-item__content) {
  pointer-events: none;
}

.service-label-with-icon {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  white-space: nowrap;
}

.service-info-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto;
  flex-shrink: 0;
}

.service-info-icon {
  color: #3b82f6;
}

.service-info-icon:hover {
  color: #2563eb;
}

.info-btn {
  color: #3b82f6;
  font-size: 0.8125rem;
  padding: 0;
}

.info-btn:hover {
  color: #2563eb;
}

.user-info-section {
  background-color: #f3f4f6;
  padding: 0.75rem 1.5rem 0.25rem 0.75rem;
  border-radius: 0.375rem;
}

.user-info-section :deep(.el-form-item) {
  display: flex;
  align-items: center;
}

.user-info-section :deep(.el-form-item__label) {
  flex-shrink: 0;
  white-space: nowrap;
  overflow: visible;
  width: 132px !important;
}

.user-info-section :deep(.el-form-item__content) {
  flex: 1;
  min-width: 0;
  margin-left: 0 !important;
}

.user-info-section :deep(.el-input) {
  width: 100%;
}

.user-info-section .form-row {
  margin-bottom: 0.5rem;
}

.user-info-section .form-row:last-child {
  margin-bottom: 0;
}

.booking-form :deep(.el-form-item__label) {
  font-size: 0.8125rem;
  color: #374151;
  font-weight: 500;
  line-height: 1.4;
  padding-bottom: 0.25rem;
}

.booking-form :deep(.el-input__inner),
.booking-form :deep(.el-textarea__inner) {
  font-size: 0.8125rem;
}

.two-line-input :deep(.el-textarea__inner) {
  line-height: 1.35;
  max-height: calc(1.35em * 2 + 0.9rem);
  overflow-y: auto;
  word-break: break-word;
}

.meeting-title-textarea :deep(.el-textarea__inner) {
  line-height: 1.4;
  max-height: calc(1.4em * 4 + 1rem);
  overflow-y: auto;
  word-break: break-word;
  resize: none;
}

.topic-item :deep(.el-form-item__label) {
  white-space: nowrap;
}

.no-wrap-label :deep(.el-form-item__label) {
  white-space: nowrap;
  overflow: visible;
}

.display-title-public-item {
  margin-bottom: 0.35rem !important;
  margin-top: 0.25rem;
}

.display-title-public-item :deep(.el-form-item__content) {
  margin-left: 0 !important;
  justify-content: flex-start !important;
}

.display-title-public-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 0.75rem 1.25rem;
  width: fit-content;
  max-width: 100%;
}

.display-title-public-label {
  flex: 0 1 auto;
  white-space: normal;
  font-size: 0.8125rem;
  color: #374151;
  font-weight: 500;
  line-height: 1.4;
}

.display-title-public-radios {
  flex: 0 0 auto;
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
  white-space: nowrap;
}

.tea-service-required-item {
  margin-bottom: 0.35rem !important;
}

.booking-form :deep(.el-input.is-disabled .el-input__inner) {
  background-color: #f9fafb;
  color: #6b7280;
}

.booking-form :deep(.el-radio__label) {
  font-size: 0.8125rem;
}

.cancel-btn {
  padding: 0.4375rem 1.25rem;
  font-size: 0.8125rem;
}

.submit-btn {
  background-color: #00723a;
  border-color: #00723a;
  font-weight: bold;
  padding: 0.4375rem 1.25rem;
  font-size: 0.8125rem;
  color: #ffffff;
}

.submit-btn:hover {
  background-color: #005a2e;
  border-color: #005a2e;
}

.notice-message {
  margin: 0;
  font-size: 15px;
  color: #374151;
  line-height: 1.6;
}

@media (max-width: 389px) {
  .form-row-three {
    grid-template-columns: 1fr 1fr;
  }
  .paired-layout {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 390px) and (max-width: 767px) {
  .form-row-three {
    grid-template-columns: 1fr 1fr;
  }
  .paired-layout {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 768px) and (max-width: 1099px) {
  .form-row-three {
    grid-template-columns: 1fr 1fr;
  }
  .paired-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 389px) {
  .booking-dialog-wrapper {
    width: 95% !important;
    max-height: 90vh; /* 小屏降低最大高度，留出更多滚动空间 */
  }
  .modal-body {
    padding: 1rem;
  }
  .form-row {
    grid-template-columns: 1fr;
  }
  .paired-layout {
    grid-template-columns: 1fr;
  }
  /* 小屏增加表单间距，提升可读性 */
  .booking-form :deep(.el-form-item) {
    margin-bottom: 1rem;
  }
}

@media (min-width: 390px) and (max-width: 767px) {
  .booking-dialog-wrapper {
    width: 95% !important;
    max-height: 90vh; /* 小屏降低最大高度，留出更多滚动空间 */
  }
  .modal-body {
    padding: 1rem;
  }
  .form-row {
    grid-template-columns: 1fr;
  }
  .paired-layout {
    grid-template-columns: 1fr;
  }
  /* 小屏增加表单间距，提升可读性 */
  .booking-form :deep(.el-form-item) {
    margin-bottom: 1rem;
  }
}

@media (min-width: 1100px) and (max-width: 1599px) {
  .booking-dialog-wrapper {
    width: 95% !important;
    /* max-height：124vh 由脚本 dialogWrapperStyle 控制（与 MeetingApproval 一致） */
  }
}

@media (min-width: 1600px) and (max-width: 2239px) {}

@media (min-width: 2240px) {}

/* 确保下拉框内容可见 */
:deep(.el-select-dropdown),
:deep(.el-popper) {
  z-index: 99999 !important;
}

/* 半宽 Start/End Time 的时间选择器 */
:deep(.form-row .form-item-half .venue-time-picker),
:deep(.form-row .form-item-half .el-date-editor.el-input),
:deep(.form-row .form-item-half .el-select) {
  width: 100%;
}
</style>