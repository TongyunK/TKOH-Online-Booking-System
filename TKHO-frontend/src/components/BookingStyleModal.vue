<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      :class="['modal-overlay booking-style-modal-root', customClass]"
      @click.self="onOverlayClick"
    >
      <div
        class="booking-dialog-wrapper"
        :style="wrapperStyle"
      >
        <div class="modal-header" @mousedown="handleMouseDown">
          <span class="modal-title">{{ title }}</span>
          <button type="button" class="modal-close" aria-label="Close" @click="close">
            <svg viewBox="0 0 24 24" class="close-icon">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <slot />
        </div>
        <div v-if="$slots.footer" class="modal-footer">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, onUnmounted, computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  /** 与 VenueBookingDialog 一致：横向占比 */
  dialogWidth: {
    type: String,
    default: '92%'
  },
  maxWidth: {
    type: String,
    default: '640px'
  },
  /** 弹窗整体最大高度，默认 94vh，可按视口在页面侧覆盖 */
  maxHeight: {
    type: String,
    default: '94vh'
  },
  dialogHeight: {
    type: String,
    default: ''
  },
  overlayPadding: {
    type: String,
    default: '24px 28px'
  },
  /** 为 false 时点击遮罩不关闭（对齐 el-dialog close-on-click-modal=false） */
  closeOnClickOverlay: {
    type: Boolean,
    default: true
  },
  customClass: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'close'])

const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dialogX = ref(0)
const dialogY = ref(0)

const wrapperStyle = computed(() => ({
  transform: `translate(${dialogX.value}px, ${dialogY.value}px)`,
  '--bsm-width': props.dialogWidth,
  '--bsm-max-width': props.maxWidth,
  '--bsm-max-height': props.maxHeight,
  '--bsm-height': props.dialogHeight || 'auto',
  '--bsm-overlay-padding': props.overlayPadding
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

function onOverlayClick() {
  if (props.closeOnClickOverlay) close()
}

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function onKeydown(e) {
  if (e.key === 'Escape') close()
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      dialogX.value = 0
      dialogY.value = 0
      document.addEventListener('keydown', onKeydown)
    } else {
      document.removeEventListener('keydown', onKeydown)
    }
  }
)

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style>
/* 与 VenueBookingDialog.vue 弹窗外壳一致 */
.booking-style-modal-root.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10050;
  overflow-y: auto;
  padding: var(--bsm-overlay-padding, 24px 28px);
}

.booking-style-modal-root .booking-dialog-wrapper {
  width: var(--bsm-width, 92%);
  max-width: var(--bsm-max-width, 640px);
  height: var(--bsm-height, auto);
  max-height: var(--bsm-max-height, 94vh);
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  /* teleported=false 时下拉在弹窗内，避免 overflow:hidden 裁切 */
  overflow: visible;
  position: relative;
  z-index: 10051;
  flex-shrink: 0;
}

.booking-style-modal-root .modal-header {
  background: #00723a;
  color: #fff;
  padding: 0.75rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: move;
  user-select: none;
  flex-shrink: 0;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}

.booking-style-modal-root .modal-title {
  font-size: 1.0625rem;
  font-weight: 600;
  line-height: 1.5;
}

.booking-style-modal-root .modal-close {
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

.booking-style-modal-root .close-icon {
  width: 20px;
  height: 20px;
  stroke: white;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
}

.booking-style-modal-root .modal-close:hover .close-icon {
  stroke: #d1fae5;
}

.booking-style-modal-root .modal-body {
  padding: 1.125rem 2rem 20px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.booking-style-modal-root .modal-body::-webkit-scrollbar {
  width: 6px;
}

.booking-style-modal-root .modal-body::-webkit-scrollbar-track {
  background: #f3f4f6;
  border-radius: 3px;
}

.booking-style-modal-root .modal-body::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.booking-style-modal-root .modal-footer {
  padding: 1rem 2rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
}

/* Edit Booking：时间/场地下拉 teleported=false，短表单时避免 modal-body 裁切 */
.booking-style-modal-root.edit-booking-modal .modal-body {
  overflow: visible;
}

/* Tea Service = Yes：整段表单在弹窗内容区统一上下滚动 */
.booking-style-modal-root.edit-booking-modal.edit-booking-modal--unified-scroll .modal-body {
  overflow-y: auto;
  overflow-x: clip;
  min-height: 0;
}

/* EV Important Note 等：Teleport 到 body，父页面 scoped 样式无法作用到此外壳，须在本组件内覆盖 */
.booking-style-modal-root.important-note-modal .booking-dialog-wrapper {
  border: 2px solid #ef1515;
  border-radius: 28px;
  width: min(94vw, 820px);
  max-width: 820px;
}

.booking-style-modal-root.important-note-modal .modal-header {
  background: #ef1515;
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  position: relative;
}

.booking-style-modal-root.important-note-modal .modal-title {
  width: 100%;
  text-align: center;
  font-size: 1.1875rem;
  font-weight: 700;
}

.booking-style-modal-root.important-note-modal .modal-close {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
}

/* EV / Venue Important Note 正文：统一字号（弹窗 Teleport 到 body，样式须写在此处） */
.booking-style-modal-root.important-note-modal .ev-rule-notice-content,
.booking-style-modal-root.important-note-modal .venue-rule-notice-content {
  color: #1f2937;
  font-size: 16px;
  line-height: 1.65;
  text-align: center;
  font-synthesis: style;
}

.booking-style-modal-root.important-note-modal .ev-rule-notice-empty,
.booking-style-modal-root.important-note-modal .venue-rule-notice-empty {
  text-align: center;
  color: #6b7280;
  font-size: 16px;
}

.booking-style-modal-root.important-note-modal .ev-rule-notice-content :deep(p),
.booking-style-modal-root.important-note-modal .venue-rule-notice-content :deep(p) {
  margin: 0 0 10px;
  font-size: 16px;
}

.booking-style-modal-root.important-note-modal .ev-rule-notice-content :deep(strong),
.booking-style-modal-root.important-note-modal .ev-rule-notice-content :deep(b),
.booking-style-modal-root.important-note-modal .venue-rule-notice-content :deep(strong),
.booking-style-modal-root.important-note-modal .venue-rule-notice-content :deep(b) {
  font-weight: 700;
  color: inherit;
}

.booking-style-modal-root.important-note-modal .ev-rule-notice-content :deep(.attention-line),
.booking-style-modal-root.important-note-modal .ev-rule-notice-content :deep(.main-title) {
  color: #ef4444;
  font-weight: 700;
  text-align: center;
}

.booking-style-modal-root.important-note-modal .ev-rule-notice-content :deep(.attention-line) {
  margin-bottom: 4px;
  font-size: 17px;
}

.booking-style-modal-root.important-note-modal .ev-rule-notice-content :deep(.main-title) {
  margin-bottom: 12px;
  font-size: 17px;
  line-height: 1.5;
}

.booking-style-modal-root.important-note-modal .ev-rule-notice-content :deep(.section-title) {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  text-decoration: underline;
}

.booking-style-modal-root.important-note-modal .ev-rule-notice-content :deep(.line-item) {
  margin-bottom: 4px;
  font-size: 16px;
  color: #111827;
}

.booking-style-modal-root.important-note-modal .ev-rule-notice-content :deep(.line-item .change-highlight) {
  color: #ef4444;
}

.booking-style-modal-root.important-note-modal .venue-rule-notice-content :deep(.venue-notice-line) {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 700;
  color: #ef4444;
}

.booking-style-modal-root.important-note-modal .venue-rule-notice-content :deep(.venue-notice-line.zh) {
  color: #111827;
  font-size: 16px;
  font-weight: 700;
}

/* License Plate owner selector:
 * keep dropdown inside modal (teleported=false) but allow it to overflow body area.
 * This is scoped by custom-class to avoid affecting other dialogs.
 */
.booking-style-modal-root.license-plate-edit-modal .modal-body {
  overflow: visible;
}

/* Pending approval details：与 Edit User 一致，内容区可滚动（14" zoom 断点下避免表单溢出） */
.booking-style-modal-root.pending-approval-detail-modal .modal-body {
  overflow-y: auto;
  overflow-x: clip;
  min-height: 0;
}

/* Reject Registration：模板下拉在弹窗内展开；收紧左右留白，减少左侧「空栏」感 */
.booking-style-modal-root.reject-registration-modal .modal-body {
  overflow: visible;
  padding-left: 1rem;
  padding-right: 1.25rem;
}

.booking-style-modal-root.reject-registration-modal .modal-footer {
  padding-left: 1rem;
  padding-right: 1.25rem;
}

/* System Prompt 富文本：工具栏/选区下拉可溢出 modal-body（配合 wangeditor modalAppendToBody） */
.booking-style-modal-root.system-prompt-edit-modal .modal-body {
  position: relative;
  overflow: visible;
}

.booking-style-modal-root.system-prompt-edit-modal .modal-body .el-form-item,
.booking-style-modal-root.system-prompt-edit-modal .modal-body .el-form-item__content {
  overflow: visible;
}

/* 14 寸 html zoom 断点：w-e 下拉留在弹窗 DOM 内，避免挂 body 后坐标偏移 */
.booking-style-modal-root.system-prompt-edit-modal .w-e-toolbar .w-e-bar-item,
.booking-style-modal-root.system-prompt-edit-modal .w-e-hover-bar .w-e-bar-item {
  position: relative;
  overflow: visible;
}

.booking-style-modal-root.system-prompt-edit-modal .w-e-toolbar,
.booking-style-modal-root.system-prompt-edit-modal .w-e-hover-bar {
  overflow: visible;
  z-index: 25;
}

.booking-style-modal-root.system-prompt-edit-modal .modal-body > .w-e-modal {
  z-index: 10060 !important;
}

/* insertLink modalAppendToBody：默认 z-index:1 会被遮罩盖住 */
body > .w-e-modal {
  z-index: 10060 !important;
}

/* 14 寸 zoom：校正完成前不绘制 hoverbar，避免先错后对再闪动 */
@media screen and (min-width: 1100px) and (max-width: 1599px) {
  .booking-style-modal-root.system-prompt-edit-modal
    .w-e-hover-bar.w-e-bar-show:not(.wang-hover-bar-positioned) {
    visibility: hidden !important;
  }
}
</style>
