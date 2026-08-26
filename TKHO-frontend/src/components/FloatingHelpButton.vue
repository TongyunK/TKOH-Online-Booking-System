<template>
  <div class="tips-root">
    <button
      type="button"
      class="tips-button"
      title="Points to Note"
      aria-label="Points to Note"
      @click="dialogVisible = true"
    >
      <img :src="tipsIconSrc" alt="" class="tips-icon" />
    </button>

    <BookingStyleModal
      v-model="dialogVisible"
      title="Points to Note"
      max-width="1060px"
      :max-height="pointsToNoteMaxHeight"
      :overlay-padding="pointsToNoteOverlayPadding"
    >
      <div class="help-content">
        <p v-if="pointsToNoteLoading" class="empty-note">Loading...</p>
        <div
          v-else-if="currentPointsToNoteContent"
          class="help-rich-content"
          v-html="currentPointsToNoteContent"
        ></div>
        <p v-else class="empty-note">No points to note for current system.</p>
      </div>
    </BookingStyleModal>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getMockPromptList } from '@/mocks/mockData'
import { getPrompts, getPublicPointsToNote } from '@/api/promptManagement'
import { formatPointsToNoteForDisplay } from '@/utils/pointsToNoteHtml'
import BookingStyleModal from './BookingStyleModal.vue'

const props = defineProps({
  systemOverride: {
    type: String,
    default: ''
  }
})

const route = useRoute()
const userStore = useUserStore()
const dialogVisible = ref(false)
const tipsIconSrc = `${import.meta.env.BASE_URL}tips.png`
/** 与 style.css 14" html zoom:0.8 断点一致 */
const POINTS_TO_NOTE_MQ = '(min-width: 1100px) and (max-width: 1599px)'
const pointsToNoteMaxHeight = ref('94vh')
const pointsToNoteOverlayPadding = ref('24px 28px')
let pointsToNoteMq = null

function updatePointsToNoteModalLayout () {
  if (typeof window === 'undefined') return
  const is14Inch = window.matchMedia(POINTS_TO_NOTE_MQ).matches
  // zoom 0.8 下 CSS vh 视觉偏矮；用更大 vh 折算后接近满屏，并略减遮罩内边距
  pointsToNoteMaxHeight.value = is14Inch ? '110vh' : '94vh'
  pointsToNoteOverlayPadding.value = is14Inch ? '8px 20px' : '24px 28px'
}

const POINTS_TO_NOTE_KEYS = {
  parking: 'ev_booking_points_to_note',
  room: 'venue_booking_points_to_note'
}
const pointsToNoteByKey = ref({
  [POINTS_TO_NOTE_KEYS.parking]: '',
  [POINTS_TO_NOTE_KEYS.room]: ''
})
const pointsToNoteLoading = ref(false)

function resolveSystemFromPath (path) {
  const p = String(path || '')
  if (p.startsWith('/evBooking') || p.startsWith('/EVBooking')) return 'parking'
  if (p.startsWith('/VenueBooking')) return 'room'
  return ''
}

const applyPointsToNoteList = (list) => {
  const items = Array.isArray(list) ? list : []
  pointsToNoteByKey.value = {
    [POINTS_TO_NOTE_KEYS.parking]:
      items.find((item) => item.key === POINTS_TO_NOTE_KEYS.parking)?.content || '',
    [POINTS_TO_NOTE_KEYS.room]:
      items.find((item) => item.key === POINTS_TO_NOTE_KEYS.room)?.content || ''
  }
}

const loadPointsToNote = async () => {
  pointsToNoteLoading.value = true
  try {
    const data = userStore.token
      ? await getPrompts({ category: 'system_fixed' })
      : await getPublicPointsToNote()
    applyPointsToNoteList(data)
  } catch {
    applyPointsToNoteList(getMockPromptList())
  } finally {
    pointsToNoteLoading.value = false
  }
}

/** 按路由选系统；Admin 后台固定 Venue；Account：admin 用 Venue，普通用户按进入系统 */
const activeSystem = computed(() => {
  if (props.systemOverride === 'parking' || props.systemOverride === 'room') {
    return props.systemOverride
  }
  const fromRoute = resolveSystemFromPath(route.path)
  if (fromRoute) return fromRoute

  // Admin 管理页：Venue Points to Note
  if (route.path.startsWith('/admin')) {
    return 'room'
  }

  // My Account：admin 显示 Venue；非 admin 按进入系统
  if (route.path.startsWith('/Account')) {
    if (userStore.isAdmin) return 'room'
    const fromAccountOrigin = resolveSystemFromPath(
      typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('accountFromPath') : ''
    )
    if (fromAccountOrigin) return fromAccountOrigin
    const systemFromStore = String(userStore.userInfo?.system || '').trim()
    if (systemFromStore === 'parking' || systemFromStore === 'room') return systemFromStore
    return 'room'
  }

  if (!userStore.isAdmin) {
    const systemFromStore = String(userStore.userInfo?.system || '').trim()
    if (systemFromStore === 'parking' || systemFromStore === 'room') return systemFromStore
  }

  return 'room'
})

const currentPointsToNoteKey = computed(() => {
  return POINTS_TO_NOTE_KEYS[activeSystem.value] || ''
})

const currentPointsToNoteContent = computed(() => {
  const targetKey = currentPointsToNoteKey.value
  if (!targetKey) return ''
  const rawContent = pointsToNoteByKey.value[targetKey] || ''
  return formatPointsToNoteForDisplay(rawContent)
})

onMounted(() => {
  loadPointsToNote()
  updatePointsToNoteModalLayout()
  if (typeof window !== 'undefined') {
    pointsToNoteMq = window.matchMedia(POINTS_TO_NOTE_MQ)
    pointsToNoteMq.addEventListener('change', updatePointsToNoteModalLayout)
  }
})

onUnmounted(() => {
  pointsToNoteMq?.removeEventListener('change', updatePointsToNoteModalLayout)
  pointsToNoteMq = null
})
</script>

<style scoped>
.tips-root {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.tips-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  overflow: visible;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.tips-button:hover {
  transform: scale(1.06);
  opacity: 0.92;
}

.tips-button:active {
  transform: scale(0.98);
}

.tips-icon {
  width: 28px;
  height: 28px;
  display: block;
  object-fit: contain;
  transform: scale(1.35);
  transform-origin: center;
}

.help-content {
  font-size: 16px;
  line-height: 1.6;
  color: #374151;
}

/* 全局 font-synthesis: none 会吞掉斜体，与 PromptManagement 预览区一致 */
.help-rich-content {
  font-synthesis: style;
}

.help-rich-content :deep(em),
.help-rich-content :deep(i),
.help-rich-content :deep([style*='font-style: italic']),
.help-rich-content :deep([style*='font-style:italic']) {
  font-style: italic !important;
}

.help-rich-content :deep(p) {
  margin: 0 0 8px;
}

.help-rich-content :deep(strong),
.help-rich-content :deep(b) {
  font-weight: 700;
  color: inherit;
}

.help-rich-content :deep(u) {
  text-decoration: underline;
}

.help-rich-content :deep(ol) {
  list-style-type: decimal;
  list-style-position: outside;
  margin: 0;
  padding-left: 1.5rem;
}

.help-rich-content :deep(ul) {
  list-style-type: disc;
  list-style-position: outside;
  margin: 0;
  padding-left: 1.5rem;
}

.help-rich-content :deep(li) {
  display: list-item;
}

.help-rich-content :deep(li + li) {
  margin-top: 6px;
}

.help-rich-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0 0;
  text-align: left;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.help-rich-content :deep(th),
.help-rich-content :deep(td) {
  padding: 6px 10px;
  font-size: 16px;
  text-align: left;
  border: 1px solid #d1d5db;
}

/* 表头默认浅绿底 + 深绿字（覆盖编辑器内联白底） */
.help-rich-content :deep(thead th),
.help-rich-content :deep(th) {
  font-weight: 700;
  background: linear-gradient(135deg, #d0e8d6 0%, #c8e6d0 100%) !important;
  color: #0a3d1f !important;
}

/* 无 thead 时，首行作表头 */
.help-rich-content :deep(table:not(:has(thead)) tbody > tr:first-child > td) {
  font-weight: 700;
  background: linear-gradient(135deg, #d0e8d6 0%, #c8e6d0 100%) !important;
  color: #0a3d1f !important;
}

.help-rich-content :deep(tbody tr:nth-child(odd)) td {
  background-color: #f8fcf9;
}

.help-rich-content :deep(tbody tr:nth-child(even)) td {
  background-color: #ffffff;
}

.empty-note {
  margin: 0;
  color: #6b7280;
}
</style>
