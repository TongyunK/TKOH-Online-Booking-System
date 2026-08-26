<template>
  <div class="meeting-event-title-input" :class="{ 'is-disabled': disabled }">
    <el-input
      :model-value="modelValue"
      type="textarea"
      :autosize="autosize"
      resize="none"
      class="meeting-title-textarea"
      :placeholder="placeholder"
      :disabled="disabled"
      :maxlength="MEETING_EVENT_TITLE_MAX_LENGTH_CEILING"
      @update:model-value="onInput"
    />
    <span
      class="meeting-event-title-count"
      :class="{ 'is-full': unitLength >= normalizedMaxUnits }"
      aria-live="polite"
    >
      {{ unitLength }} / {{ normalizedMaxUnits }}
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  MEETING_EVENT_TITLE_MAX_LENGTH_CEILING,
  DEFAULT_MEETING_EVENT_TITLE_MAX_LENGTH,
  clipMeetingEventTitleToMaxUnits,
  getMeetingEventTitleUnitLength
} from '@/utils/meetingEventTitleMaxLength'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  maxUnits: {
    type: Number,
    default: DEFAULT_MEETING_EVENT_TITLE_MAX_LENGTH
  },
  placeholder: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  autosize: {
    type: Object,
    default: () => ({ minRows: 1, maxRows: 4 })
  }
})

const emit = defineEmits(['update:modelValue'])

const normalizedMaxUnits = computed(() => {
  const value = Number(props.maxUnits)
  if (Number.isFinite(value) && value >= 1 && value <= MEETING_EVENT_TITLE_MAX_LENGTH_CEILING) {
    return Math.floor(value)
  }
  return DEFAULT_MEETING_EVENT_TITLE_MAX_LENGTH
})

const unitLength = computed(() => getMeetingEventTitleUnitLength(props.modelValue))

function onInput (value) {
  emit('update:modelValue', clipMeetingEventTitleToMaxUnits(value, normalizedMaxUnits.value))
}
</script>

<style scoped>
.meeting-event-title-input {
  position: relative;
  width: 100%;
}

.meeting-title-textarea :deep(.el-textarea__inner) {
  line-height: 1.4;
  max-height: calc(1.4em * 4 + 1rem);
  overflow-y: auto;
  word-break: break-word;
  resize: none;
  /* 为右下角计数留空，贴近 Element Plus show-word-limit */
  padding-bottom: 1.5rem;
}

.meeting-event-title-count {
  position: absolute;
  right: 10px;
  bottom: 6px;
  z-index: 1;
  font-size: 12px;
  line-height: 1;
  color: var(--el-text-color-placeholder, #a8abb2);
  background: transparent;
  pointer-events: none;
  user-select: none;
}

.meeting-event-title-count.is-full {
  color: var(--el-color-danger, #f56c6c);
}

.meeting-event-title-input.is-disabled .meeting-event-title-count {
  opacity: 0.7;
}
</style>
