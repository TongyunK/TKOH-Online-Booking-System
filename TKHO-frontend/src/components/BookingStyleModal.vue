<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      :class="['modal-overlay booking-style-modal-root', customClass]"
      :style="overlayStyle"
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
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'

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
/** 按可视视口算出的 CSS 像素高度（已考虑 html zoom） */
const fitHeightPx = ref('')

const isEditBookingModal = computed(() =>
  String(props.customClass || '').split(/\s+/).includes('edit-booking-modal')
)

function getHtmlZoomScale () {
  if (typeof window === 'undefined') return 1
  const raw = Number.parseFloat(window.getComputedStyle(document.documentElement).zoom || '1')
  return Number.isFinite(raw) && raw > 0 ? raw : 1
}

/**
 * 保证弹窗视觉高度不超过窗口：
 * 缩放后显示高度 ≈ cssPx * zoom，故 cssPx = visualTarget / zoom
 */
function refreshFitHeightPx () {
  if (typeof window === 'undefined') {
    fitHeightPx.value = ''
    return
  }
  const shouldFit = isEditBookingModal.value || Boolean(props.dialogHeight)
  if (!shouldFit) {
    fitHeightPx.value = ''
    return
  }
  const visualH = window.visualViewport?.height || window.innerHeight || 800
  const zoom = getHtmlZoomScale()
  const pad = 24 // 上下留白
  const ratio = isEditBookingModal.value ? 0.88 : 0.9
  const visualTarget = Math.max(280, visualH * ratio - pad)
  fitHeightPx.value = `${Math.round(visualTarget / zoom)}px`
}

const overlayStyle = computed(() => ({
  padding: isEditBookingModal.value ? '12px 16px' : props.overlayPadding
}))

const wrapperStyle = computed(() => {
  const style = {
    transform: `translate(${dialogX.value}px, ${dialogY.value}px)`,
    width: props.dialogWidth,
    maxWidth: props.maxWidth,
    maxHeight: props.maxHeight
  }
  const lock = fitHeightPx.value || props.dialogHeight || ''
  if (lock) {
    style.height = lock
    style.maxHeight = lock
    style.minHeight = '0'
    style.overflow = 'hidden'
    style.flexShrink = '1'
  }
  return style
})

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
  () => [props.modelValue, props.dialogHeight, props.customClass],
  ([open]) => {
    if (open) {
      dialogX.value = 0
      dialogY.value = 0
      refreshFitHeightPx()
      document.addEventListener('keydown', onKeydown)
    } else {
      document.removeEventListener('keydown', onKeydown)
    }
  }
)

function onViewportChange () {
  if (props.modelValue) refreshFitHeightPx()
}

onMounted(() => {
  if (typeof window === 'undefined') return
  window.addEventListener('resize', onViewportChange, { passive: true })
  window.visualViewport?.addEventListener('resize', onViewportChange)
  window.visualViewport?.addEventListener('scroll', onViewportChange)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  document.removeEventListener('keydown', onKeydown)
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', onViewportChange)
    window.visualViewport?.removeEventListener('resize', onViewportChange)
    window.visualViewport?.removeEventListener('scroll', onViewportChange)
  }
})
</script>

<style>
/* 与 VenueBookingDialog.vue 弹窗外壳一致（选择器均挂在 booking-style-modal-root 下，避免互相污染） */
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
  box-sizing: border-box;
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
  overflow: visible;
  position: relative;
  z-index: 10051;
  flex-shrink: 0;
  box-sizing: border-box;
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

/* Edit Booking：高度由 :style 像素锁定；此处保证不撑破、内容区内滚 */
.booking-style-modal-root.edit-booking-modal {
  align-items: center;
  overflow-y: auto;
}

.booking-style-modal-root.edit-booking-modal .booking-dialog-wrapper {
  min-height: 0 !important;
  flex-shrink: 1 !important;
  overflow: hidden !important;
}

.booking-style-modal-root.edit-booking-modal .modal-body {
  flex: 1 1 auto !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  min-height: 0 !important;
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
}

.booking-style-modal-root.important-note-modal .modal-title {
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 800;
}

.booking-style-modal-root.important-note-modal .modal-close {
  filter: drop-shadow(0 0 0 transparent);
}

.booking-style-modal-root.important-note-modal .ev-rule-notice-content,
.booking-style-modal-root.important-note-modal .venue-rule-notice-content {
  color: #111827;
  font-size: 0.95rem;
  line-height: 1.65;
}

.booking-style-modal-root.important-note-modal .ev-rule-notice-empty,
.booking-style-modal-root.important-note-modal .venue-rule-notice-empty {
  color: #6b7280;
}

.booking-style-modal-root.important-note-modal .ev-rule-notice-content :deep(p),
.booking-style-modal-root.important-note-modal .venue-rule-notice-content :deep(p) {
  margin: 0 0 0.5rem;
}

.booking-style-modal-root.important-note-modal .ev-rule-notice-content :deep(strong),
.booking-style-modal-root.important-note-modal .ev-rule-notice-content :deep(b),
.booking-style-modal-root.important-note-modal .venue-rule-notice-content :deep(strong),
.booking-style-modal-root.important-note-modal .venue-rule-notice-content :deep(b) {
  font-weight: 700;
}

.booking-style-modal-root.important-note-modal .ev-rule-notice-content :deep(.attention-line),
.booking-style-modal-root.important-note-modal .ev-rule-notice-content :deep(.main-title) {
  font-weight: 700;
}

.booking-style-modal-root.important-note-modal .ev-rule-notice-content :deep(.attention-line) {
  color: #b91c1c;
}

.booking-style-modal-root.important-note-modal .ev-rule-notice-content :deep(.main-title) {
  font-size: 1.05rem;
  line-height: 1.5;
}

.booking-style-modal-root.important-note-modal .ev-rule-notice-content :deep(.section-title) {
  margin-top: 0.75rem;
  font-weight: 700;
}

.booking-style-modal-root.important-note-modal .ev-rule-notice-content :deep(.line-item) {
  margin: 0.25rem 0;
}

.booking-style-modal-root.important-note-modal .ev-rule-notice-content :deep(.line-item .change-highlight) {
  color: #b91c1c;
}

.booking-style-modal-root.important-note-modal .venue-rule-notice-content :deep(.venue-notice-line) {
  margin: 0.35rem 0;
}

.booking-style-modal-root.important-note-modal .venue-rule-notice-content :deep(.venue-notice-line.zh) {
  color: #374151;
}

.booking-style-modal-root.license-plate-edit-modal .modal-body {
  overflow: visible;
}

.booking-style-modal-root.pending-approval-detail-modal .modal-body {
  overflow-y: auto;
  min-height: 0;
}

.booking-style-modal-root.reject-registration-modal .modal-body {
  overflow: visible;
}

.booking-style-modal-root.reject-registration-modal .modal-footer {
  justify-content: flex-end;
}

/* System Prompt 富文本：工具栏/选区下拉可溢出 modal-body（配合 wangeditor modalAppendToBody） */
.booking-style-modal-root.system-prompt-edit-modal .modal-body {
  overflow: visible;
}

.booking-style-modal-root.system-prompt-edit-modal .modal-body .el-form-item,
.booking-style-modal-root.system-prompt-edit-modal .modal-body .el-form-item__content {
  overflow: visible;
}

.booking-style-modal-root.system-prompt-edit-modal .w-e-toolbar .w-e-bar-item,
.booking-style-modal-root.system-prompt-edit-modal .w-e-hover-bar .w-e-bar-item {
  position: relative;
}

.booking-style-modal-root.system-prompt-edit-modal .w-e-toolbar,
.booking-style-modal-root.system-prompt-edit-modal .w-e-hover-bar {
  overflow: visible;
}

.booking-style-modal-root.system-prompt-edit-modal .modal-body > .w-e-modal {
  z-index: 20;
}

@media screen and (min-width: 1100px) and (max-width: 1599px) {
  .booking-style-modal-root.system-prompt-edit-modal
    .modal-body {
    overflow: visible;
  }
}
</style>
