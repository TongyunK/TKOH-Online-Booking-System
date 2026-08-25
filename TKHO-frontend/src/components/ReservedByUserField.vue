<template>
  <div class="reserved-by-user-field">
    <el-form-item v-if="variant === 'form-item'" :label="label" :class="formItemClass">
      <el-select
        ref="selectRef"
        :model-value="modelValue"
        filterable
        remote
        :class="selectClass"
        :style="selectStyle"
        :placeholder="placeholder"
        :teleported="effectiveTeleported"
        :reserve-keyword="false"
        :loading="searchLoading"
        :remote-method="handleFilter"
        @update:model-value="emit('update:modelValue', $event)"
        @visible-change="handleDropdownVisibleChange"
        popper-class="reserved-by-user-select"
      >
        <el-option
          v-for="user in displayedOptions"
          :key="user.id"
          :label="formatUserLabel(user)"
          :value="user.id"
        >
          <div class="reserved-by-option">
            <span class="reserved-by-option-name">{{ formatUserDisplayName(user) }}</span>
            <span class="reserved-by-option-corp">{{ user.corpId }}</span>
          </div>
        </el-option>
      </el-select>
    </el-form-item>

    <el-select
      v-else
      ref="selectRef"
      :model-value="modelValue"
      filterable
      remote
      :class="selectClass"
      :style="selectStyle"
      :placeholder="placeholder"
      :teleported="effectiveTeleported"
      :reserve-keyword="false"
      :loading="searchLoading"
      :remote-method="handleFilter"
      @update:model-value="emit('update:modelValue', $event)"
      @visible-change="handleDropdownVisibleChange"
      popper-class="reserved-by-user-select"
    >
      <el-option
        v-for="user in displayedOptions"
        :key="user.id"
        :label="formatUserLabel(user)"
        :value="user.id"
      >
        <div class="reserved-by-option">
          <span class="reserved-by-option-name">{{ formatUserDisplayName(user) }}</span>
          <span class="reserved-by-option-corp">{{ user.corpId }}</span>
        </div>
      </el-option>
    </el-select>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { listUserOwnerOptions } from '@/api/userManagement'
import { HTML_ZOOM_BREAKPOINT_MQ } from '@/utils/venueCalendarApi'
import { formatUserDisplayName } from '@/utils/userDisplayName'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  defaultUser: {
    type: Object,
    default: null
  },
  /** 未传时随 14" html zoom 断点自动切换（断点内 false，断点外 true） */
  teleported: {
    type: Boolean,
    default: undefined
  },
  formItemClass: {
    type: String,
    default: ''
  },
  /** form-item：el-form 内；bare：仅下拉，由父级提供 form-section / form-label */
  variant: {
    type: String,
    default: 'form-item'
  },
  label: {
    type: String,
    default: 'Reserved By'
  },
  placeholder: {
    type: String,
    default: 'Select user'
  },
  selectClass: {
    type: String,
    default: ''
  },
  /**
   * venue：仅列出角色 annual_venue_quota > 0 或 -1（无限）的用户，并始终隐藏 SuperAdmin
   */
  ownerScope: {
    type: String,
    default: ''
  }
})

const selectStyle = { width: '100%' }

const emit = defineEmits(['update:modelValue'])

const autoPopperTeleported = ref(true)
let zoomBreakpointMq = null

function syncPopperTeleported () {
  if (typeof window === 'undefined') return
  autoPopperTeleported.value = !window.matchMedia(HTML_ZOOM_BREAKPOINT_MQ).matches
}

const effectiveTeleported = computed(() =>
  props.teleported !== undefined ? props.teleported : autoPopperTeleported.value
)

onMounted(() => {
  syncPopperTeleported()
  if (typeof window === 'undefined') return
  zoomBreakpointMq = window.matchMedia(HTML_ZOOM_BREAKPOINT_MQ)
  zoomBreakpointMq.addEventListener('change', syncPopperTeleported)
})

onBeforeUnmount(() => {
  zoomBreakpointMq?.removeEventListener('change', syncPopperTeleported)
  zoomBreakpointMq = null
  if (filterTimer) clearTimeout(filterTimer)
})

const PAGE_SIZE = 20
const selectRef = ref(null)
const searchLoading = ref(false)
const ownerLoading = ref(false)
const ownerKeyword = ref('')
const ownerPage = ref(1)
const ownerHasMore = ref(false)
const userOptions = ref([])

function formatUserLabel (user) {
  if (!user) return ''
  const displayName = formatUserDisplayName(user)
  return displayName ? `${displayName} (${user.corpId})` : String(user.corpId || '')
}

function mergeUsers (rows) {
  const map = new Map(userOptions.value.map((u) => [u.id, u]))
  for (const row of rows) {
    map.set(row.id, row)
  }
  userOptions.value = [...map.values()]
}

async function fetchUsers ({ reset = false, keyword = ownerKeyword.value, showLoading = false } = {}) {
  if (ownerLoading.value) return
  ownerLoading.value = true
  if (showLoading) searchLoading.value = true
  try {
    const targetPage = reset ? 1 : ownerPage.value
    const data = await listUserOwnerOptions({
      keyword: String(keyword || '').trim() || undefined,
      page: targetPage,
      pageSize: PAGE_SIZE,
      ...(String(props.ownerScope || '').trim()
        ? { scope: String(props.ownerScope).trim() }
        : {})
    })
    const rows = Array.isArray(data?.items) ? data.items : []
    if (reset) userOptions.value = []
    mergeUsers(rows)
    ownerHasMore.value = Boolean(data?.hasMore)
    ownerPage.value = targetPage + 1
  } finally {
    ownerLoading.value = false
    if (showLoading) searchLoading.value = false
  }
}

const displayedOptions = computed(() => {
  const list = [...userOptions.value]
  const current = props.defaultUser
  if (current?.id && !list.some((u) => u.id === current.id)) {
    list.unshift(current)
  }
  const selected = list.find((u) => u.id === props.modelValue)
  if (props.modelValue && !selected && current?.id === props.modelValue) {
    list.unshift(current)
  }
  return list.sort((a, b) =>
    String(formatUserDisplayName(a) || '').localeCompare(String(formatUserDisplayName(b) || ''))
  )
})

let filterTimer = null
function handleFilter (query) {
  ownerKeyword.value = query
  if (filterTimer) clearTimeout(filterTimer)
  filterTimer = setTimeout(() => {
    ownerPage.value = 1
    void fetchUsers({ reset: true, keyword: query, showLoading: true })
  }, 250)
}

function handleDropdownVisibleChange (visible) {
  if (!visible) return
  ownerKeyword.value = ''
  ownerPage.value = 1
  void fetchUsers({ reset: true, keyword: '', showLoading: true })
  nextTick(() => {
    requestAnimationFrame(() => {
      const popper = selectRef.value?.popperRef?.contentRef?.$el
        ?? document.querySelector('.reserved-by-user-select')
      const wrap = popper?.querySelector?.('.el-scrollbar__wrap')
      if (!wrap) return
      const onScroll = () => {
        if (!ownerHasMore.value || ownerLoading.value) return
        if (wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 24) {
          void fetchUsers({ keyword: ownerKeyword.value })
        }
      }
      wrap.addEventListener('scroll', onScroll, { passive: true })
      wrap._reservedByScrollCleanup = () => wrap.removeEventListener('scroll', onScroll)
    })
  })
}

watch(
  () => props.defaultUser,
  (user) => {
    if (user?.id) mergeUsers([user])
  },
  { immediate: true }
)
</script>

<style scoped>
.reserved-by-user-field {
  overflow: visible;
  position: relative;
  z-index: 4;
}

.reserved-by-user-field :deep(.el-form-item) {
  overflow: visible;
}

.reserved-by-user-field :deep(.el-form-item__content) {
  overflow: visible;
}

.reserved-by-option {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.reserved-by-option-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reserved-by-option-corp {
  color: #6b7280;
  font-size: 12px;
  flex-shrink: 0;
}
</style>

<style>
/* teleported=false：相对触发器定位；html zoom 0.8 时挂 body 会偏移（见 style.css 1100–1599px） */
.reserved-by-user-select.el-select-dropdown,
.reserved-by-user-select.el-popper {
  z-index: 100001 !important;
}

.reserved-by-user-select.el-select-dropdown .el-scrollbar__wrap {
  max-height: 260px !important;
}
</style>
