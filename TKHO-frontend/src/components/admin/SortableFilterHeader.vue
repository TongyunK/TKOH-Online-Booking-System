<template>
  <button
    ref="triggerRef"
    type="button"
    class="th-dropdown-trigger"
    @click.stop="toggleMenu"
  >
    {{ label }}
    <span class="sort-indicator">{{ sortIndicator }}</span>
    <span v-if="filterable && filterActive" class="filter-dot" />
  </button>

  <teleport to="body">
    <div
      v-if="visible"
      ref="panelRef"
      class="th-menu-panel"
      :style="{ top: `${position.top}px`, left: `${position.left}px`, width: `${width}px` }"
      @click.stop
    >
      <div class="th-menu">
        <div class="th-menu-sort">
          <button type="button" class="th-menu-item" @click="emitSortAsc">
            <span class="menu-icon">↑</span><span>Sort Ascending</span>
          </button>
          <button type="button" class="th-menu-item" @click="emitSortDesc">
            <span class="menu-icon">↓</span><span>Sort Descending</span>
          </button>
          <button type="button" class="th-menu-item danger" @click="emitClearSort">
            <span class="menu-icon">✕</span><span>Clear Sorting</span>
          </button>
        </div>
        <template v-if="filterable">
          <div class="th-menu-divider"></div>
          <div class="th-menu-filter-title">
            <span class="menu-icon">⌕</span><span>Filter (Single / Multiple)</span>
          </div>
          <div class="th-filter-popover">
            <div class="th-filter-actions">
              <button type="button" class="th-filter-link" @click="handleSelectAll">Select All</button>
              <button type="button" class="th-filter-link" @click="handleClear">Clear</button>
            </div>
            <div class="th-checkbox-list">
              <el-checkbox-group :model-value="modelValue" @change="handleChange">
                <el-checkbox
                  v-for="option in options"
                  :key="`${label}-${optionKey(option)}`"
                  :label="optionValue(option)"
                >
                  {{ optionLabel(option) }}
                </el-checkbox>
              </el-checkbox-group>
              <div v-if="options.length === 0" class="th-no-options">No options</div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  sortIndicator: { type: String, default: '↕' },
  filterActive: { type: Boolean, default: false },
  filterable: { type: Boolean, default: true },
  options: { type: Array, default: () => [] },
  modelValue: { type: Array, default: () => [] },
  width: { type: Number, default: 260 }
})

const emit = defineEmits(['sort-asc', 'sort-desc', 'clear-sort', 'update:modelValue'])

const visible = ref(false)
const triggerRef = ref(null)
const panelRef = ref(null)
const position = ref({ left: 8, top: 8 })

const computeMenuPosition = (triggerEl) => {
  if (!triggerEl) return { left: 8, top: 8 }
  const rect = triggerEl.getBoundingClientRect()
  const margin = 8
  const htmlZoomRaw = Number.parseFloat(window.getComputedStyle(document.documentElement).zoom || '1')
  const htmlZoom = Number.isFinite(htmlZoomRaw) && htmlZoomRaw > 0 ? htmlZoomRaw : 1
  const normalizedLeft = rect.left / htmlZoom
  const normalizedBottom = rect.bottom / htmlZoom
  const maxLeft = Math.max(margin, window.innerWidth - props.width - margin)
  const left = Math.min(Math.max(normalizedLeft, margin), maxLeft)
  const top = normalizedBottom + 8
  return { left, top }
}

const updatePosition = () => {
  position.value = computeMenuPosition(triggerRef.value)
}

const closeMenu = () => {
  visible.value = false
}

const toggleMenu = () => {
  if (visible.value) {
    closeMenu()
    return
  }
  updatePosition()
  visible.value = true
}

const handleDocumentClick = (event) => {
  if (!visible.value) return
  const clickedTrigger = triggerRef.value?.contains(event.target)
  const clickedPanel = panelRef.value?.contains(event.target)
  if (!clickedTrigger && !clickedPanel) closeMenu()
}

const handleWindowReflow = () => {
  if (!visible.value) return
  updatePosition()
}

onMounted(() => {
  document.addEventListener('mousedown', handleDocumentClick)
  window.addEventListener('resize', handleWindowReflow)
  window.addEventListener('scroll', handleWindowReflow, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleDocumentClick)
  window.removeEventListener('resize', handleWindowReflow)
  window.removeEventListener('scroll', handleWindowReflow, true)
})

/** 支持 string 或 { value, label }（用户筛选用 id，展示用姓名） */
const optionValue = (option) => {
  if (option && typeof option === 'object' && 'value' in option) return option.value
  return option
}

const optionLabel = (option) => {
  if (option && typeof option === 'object' && 'label' in option) return String(option.label ?? '')
  return String(option ?? '')
}

const optionKey = (option) => String(optionValue(option))

const handleChange = (value) => {
  if (!props.filterable) return
  emit('update:modelValue', value ?? [])
}

const handleSelectAll = () => {
  if (!props.filterable) return
  emit('update:modelValue', props.options.map((option) => optionValue(option)))
}

const handleClear = () => {
  if (!props.filterable) return
  emit('update:modelValue', [])
}

const emitSortAsc = () => {
  emit('sort-asc')
  closeMenu()
}

const emitSortDesc = () => {
  emit('sort-desc')
  closeMenu()
}

const emitClearSort = () => {
  emit('clear-sort')
  closeMenu()
}
</script>

<style scoped>
.th-dropdown-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 600;
  padding: 0;
  cursor: pointer;
}

.sort-indicator {
  font-size: 0.75rem;
  color: #6b7280;
  line-height: 1;
}

.filter-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #00723a;
  display: inline-block;
}

.th-menu {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.th-menu-panel {
  position: fixed;
  z-index: 5000;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  background: #ffffff;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  padding: 0.5rem;
}

.th-menu-sort {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.th-menu-item {
  border: 1px solid #b7dec7;
  background: #f5fbf7;
  color: #14532d;
  border-radius: 0.375rem;
  padding: 0.3rem 0.5rem;
  font-size: 0.75rem;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.th-menu-item:hover {
  background: #e8f6ee;
  border-color: #8fcca9;
}

.th-menu-item.danger {
  color: #b91c1c;
  border-color: #f3c4c4;
  background: #fff6f6;
}

.th-menu-divider {
  height: 1px;
  background: #d3ebdd;
}

.th-menu-filter-title {
  font-size: 0.75rem;
  color: #166534;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.menu-icon {
  width: 0.9rem;
  text-align: center;
  color: #15803d;
}

.th-filter-popover {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.th-filter-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.th-filter-link {
  border: none;
  background: transparent;
  color: #15803d;
  font-size: 0.75rem;
  padding: 0;
  cursor: pointer;
  font-weight: 600;
}

.th-filter-link:hover {
  text-decoration: underline;
}

.th-checkbox-list {
  width: 100%;
  max-height: 180px;
  overflow: auto;
  border: 1px solid #c7e5d4;
  border-radius: 0.375rem;
  padding: 0.4rem 0.55rem;
  background: #f8fdf9;
}

.th-checkbox-list :deep(.el-checkbox) {
  display: flex;
  margin-right: 0;
  margin-bottom: 0.35rem;
}

.th-checkbox-list :deep(.el-checkbox:last-child) {
  margin-bottom: 0;
}

.th-no-options {
  font-size: 0.75rem;
  color: #9ca3af;
}
</style>
