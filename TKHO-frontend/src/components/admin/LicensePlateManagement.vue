<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">License Plate Management</h2>
      <div class="header-actions">
        <el-input
          v-model="searchKeyword"
          placeholder="Search current table data"
          clearable
          class="toolbar-search"
        />
        <el-button type="default" class="cancel-btn" @click="handleExport">
          <font-awesome-icon :icon="['fas', 'file-excel']" /> Export Excel
        </el-button>
        <el-button type="default" class="submit-btn" @click="handleAdd">
          <font-awesome-icon :icon="['fas', 'plus']" /> Add License Plate
        </el-button>
      </div>
    </div>

    <div class="page-content">
      <div class="table-card">
        <el-table v-loading="tableLoading" :data="paginatedData" height="100%" border stripe table-layout="auto" style="width: 100%">
          <el-table-column
            type="index"
            label="#"
            width="70"
            align="center"
            header-align="center"
            fixed="left"
            :index="getRowIndex"
          />
          <el-table-column prop="plateNumber" min-width="170">
            <template #header>
              <SortableFilterHeader
                label="Plate Number"
                :sort-indicator="getSortIndicator('plateNumber')"
                :filter-active="plateFilterState.length > 0"
                :options="plateFilterOptions"
                :model-value="plateFilterState"
                @sort-asc="setSortByMenu('plateNumber', 'asc')"
                @sort-desc="setSortByMenu('plateNumber', 'desc')"
                @clear-sort="clearSortByMenu('plateNumber')"
                @update:model-value="updatePlateFilter"
              />
            </template>
          </el-table-column>
          <el-table-column prop="owner" min-width="200">
            <template #header>
              <SortableFilterHeader
                label="Owner"
                :sort-indicator="getSortIndicator('owner')"
                :filter-active="ownerFilterState.length > 0"
                :options="ownerFilterOptions"
                :model-value="ownerFilterState"
                @sort-asc="setSortByMenu('owner', 'asc')"
                @sort-desc="setSortByMenu('owner', 'desc')"
                @clear-sort="clearSortByMenu('owner')"
                @update:model-value="updateOwnerFilter"
              />
            </template>
            <template #default="{ row }">
              {{ row.owner }} ({{ row.corpId }})
            </template>
          </el-table-column>
          <el-table-column label="Actions" width="160" fixed="right" class-name="actions-col">
            <template #default="{ row }">
              <div class="actions-cell">
                <el-button size="small" class="action-btn action-edit" @click="handleEdit(row)">Edit</el-button>
                <el-button size="small" class="action-btn action-delete" @click="handleDelete(row)">Delete</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-bar">
          <div class="pagination-info">
            Showing {{ startIndex + 1 }}-{{ endIndex }} of {{ filteredLicensePlateList.length }} records
          </div>
          <div class="pagination-controls">
            <button class="pagination-btn" :disabled="currentPage === 1" @click="currentPage--">Previous</button>
            <button
              v-for="page in visiblePages"
              :key="page"
              :class="['pagination-btn', 'page-number', { active: page === currentPage }]"
              @click="currentPage = page"
            >
              {{ page }}
            </button>
            <button class="pagination-btn" :disabled="currentPage === totalPages" @click="currentPage++">Next</button>
          </div>
          <div class="pagination-size">
            <select v-model.number="pageSize" class="page-size-select" @change="currentPage = 1">
              <option :value="10">10 / page</option>
              <option :value="20">20 / page</option>
              <option :value="50">50 / page</option>
              <option :value="100">100 / page</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <BookingStyleModal
      v-model="showForm"
      :title="formMode === 'add' ? 'Add License Plate' : 'Edit License Plate'"
      max-width="520px"
      custom-class="license-plate-edit-modal"
    >
      <el-form :model="formData" label-width="140px">
        <el-form-item label="Owner">
          <el-select
            ref="ownerSelectRef"
            v-model="formData.corpId"
            filterable
            clearable
            style="width: 100%"
            placeholder="Type owner name / CORP User ID"
            :teleported="false"
            :reserve-keyword="false"
            :loading="ownerSearchLoading"
            :filter-method="handleOwnerFilter"
            @visible-change="handleOwnerDropdownVisibleChange"
            popper-class="license-plate-owner-select"
          >
            <el-option
              v-for="user in displayedEmployeeOptions"
              :key="user.corpId"
              :label="`${user.name} (${user.corpId})`"
              :value="user.corpId"
            >
              <div class="owner-option">
                <span class="owner-option-name">{{ user.name }}</span>
                <span class="owner-option-corp">{{ user.corpId }}</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="Plate Number">
          <el-input
            :model-value="formData.plateNumber"
            placeholder="e.g. AB1234"
            maxlength="8"
            show-word-limit
            @update:model-value="onPlateNumberInput"
          />
          <div class="field-hint">Max 8 characters — letters and numbers only (no spaces or symbols).</div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button type="default" class="cancel-btn" @click="showForm = false">Cancel</el-button>
        <el-button type="default" class="submit-btn" @click="handleSave">Save</el-button>
      </template>
    </BookingStyleModal>

    <BookingStyleModal v-model="showDeleteDialog" title="Confirm Delete" max-width="450px">
      <p>Are you sure you want to delete this license plate?</p>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="showDeleteDialog = false">Cancel</el-button>
        <el-button type="default" class="action-btn action-delete" @click="confirmDelete">Delete</el-button>
      </template>
    </BookingStyleModal>

    <BookingStyleModal
      v-model="showNoticeDialog"
      :title="noticeTitle"
      max-width="420px"
      :custom-class="noticeModalClass"
    >
      <p class="notice-message">{{ noticeMessage }}</p>
      <template #footer>
        <el-button type="default" class="submit-btn" @click="showNoticeDialog = false">OK</el-button>
      </template>
    </BookingStyleModal>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as XLSX from 'xlsx'
import BookingStyleModal from '@/components/BookingStyleModal.vue'
import SortableFilterHeader from '@/components/admin/SortableFilterHeader.vue'
import {
  listLicensePlates,
  createLicensePlate,
  updateLicensePlate,
  deleteLicensePlate
} from '@/api/licensePlateManagement'
import { listUserOwnerOptions } from '@/api/userManagement'

const licensePlateList = ref([])
const employeeList = ref([])
const ownerLoading = ref(false)
const ownerSearchLoading = ref(false)
const ownerHasMore = ref(false)
const ownerPage = ref(1)
const ownerSelectRef = ref(null)
const OWNER_PAGE_SIZE = 20
let ownerFilterTimer = null
let ownerDropdownScrollEl = null

function normalizeUserRow (u) {
  const statusRaw = String(u.status ?? '').toLowerCase()
  return {
    id: u.id,
    corpId: u.corpId,
    name: u.name,
    status: statusRaw === 'inactive' ? 'inactive' : statusRaw === 'expired' ? 'expired' : 'active'
  }
}

const tableLoading = ref(false)

async function loadLicensePlates () {
  tableLoading.value = true
  try {
    const data = await listLicensePlates()
    licensePlateList.value = Array.isArray(data) ? data : []
  } finally {
    tableLoading.value = false
  }
}

async function loadEmployees () {
  ownerPage.value = 1
  ownerHasMore.value = false
  employeeList.value = []
  await fetchOwnerOptions({ reset: true, keyword: '', showLoading: true })
  if (ownerHasMore.value) {
    void fetchOwnerOptions({ reset: false, keyword: '' })
  }
}

onMounted(async () => {
  try {
    await Promise.all([loadLicensePlates(), loadEmployees()])
  } catch (e) {
    console.error(e)
  }
})

const employeeOptions = computed(() => {
  return employeeList.value.filter(u => u.status === 'active')
})
const ownerKeyword = ref('')

const displayedEmployeeOptions = computed(() => {
  return employeeOptions.value
})

const mergeOwnerRows = (rows) => {
  const map = new Map(employeeList.value.map((u) => [String(u.corpId), u]))
  for (const row of rows) {
    map.set(String(row.corpId), normalizeUserRow(row))
  }
  employeeList.value = [...map.values()]
}

const fetchOwnerOptions = async ({
  reset = false,
  keyword = ownerKeyword.value,
  showLoading = false
} = {}) => {
  if (ownerLoading.value) return
  ownerLoading.value = true
  if (showLoading) ownerSearchLoading.value = true
  try {
    const targetPage = reset ? 1 : ownerPage.value
    const data = await listUserOwnerOptions({
      keyword: String(keyword || '').trim() || undefined,
      page: targetPage,
      pageSize: OWNER_PAGE_SIZE,
      scope: 'ev'
    })
    const rows = Array.isArray(data?.items) ? data.items : []
    if (reset) employeeList.value = []
    mergeOwnerRows(rows)
    ownerHasMore.value = Boolean(data?.hasMore)
    ownerPage.value = targetPage + 1
  } finally {
    ownerLoading.value = false
    if (showLoading) ownerSearchLoading.value = false
  }
}

const currentPage = ref(1)
const pageSize = ref(20)
const searchKeyword = ref('')
const sortState = ref({ key: '', order: '' })
const plateFilterState = ref([])
const ownerFilterState = ref([])

const searchedLicensePlateList = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  return !keyword
    ? licensePlateList.value
    : licensePlateList.value.filter((item) =>
      String(item.plateNumber || '').toLowerCase().includes(keyword) ||
      String(item.owner || '').toLowerCase().includes(keyword) ||
      String(item.corpId || '').toLowerCase().includes(keyword)
    )
})

const filteredLicensePlateList = computed(() => {
  const filtered = searchedLicensePlateList.value.filter((item) => {
    const plateMatch = !plateFilterState.value.length || plateFilterState.value.includes(item.plateNumber)
    const ownerMatch = !ownerFilterState.value.length || ownerFilterState.value.includes(item.owner)
    return plateMatch && ownerMatch
  })

  const { key, order } = sortState.value
  if (!key || !order) return filtered

  const direction = order === 'asc' ? 1 : -1
  return filtered.slice().sort((a, b) => {
    const aValue = String(a[key] ?? '').toLowerCase()
    const bValue = String(b[key] ?? '').toLowerCase()
    return aValue.localeCompare(bValue) * direction
  })
})

const plateFilterOptions = computed(() => {
  const values = new Set(searchedLicensePlateList.value.map((item) => item.plateNumber).filter(Boolean))
  return [...values]
})

const ownerFilterOptions = computed(() => {
  const values = new Set(searchedLicensePlateList.value.map((item) => item.owner).filter(Boolean))
  return [...values]
})

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredLicensePlateList.value.slice(start, end)
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredLicensePlateList.value.length / pageSize.value)))
const startIndex = computed(() => (currentPage.value - 1) * pageSize.value)
const endIndex = computed(() => Math.min(startIndex.value + pageSize.value, filteredLicensePlateList.value.length))
const visiblePages = computed(() => {
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages.value, start + maxVisible - 1)
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

watch(searchKeyword, () => {
  currentPage.value = 1
})

watch(totalPages, (value) => {
  if (currentPage.value > value) {
    currentPage.value = value
  }
})

const toggleSort = (key) => {
  if (sortState.value.key !== key) {
    sortState.value = { key, order: 'asc' }
  } else if (sortState.value.order === 'asc') {
    sortState.value = { key, order: 'desc' }
  } else {
    sortState.value = { key: '', order: '' }
  }
  currentPage.value = 1
}

const getSortIndicator = (key) => {
  if (sortState.value.key !== key || !sortState.value.order) return '↕'
  return sortState.value.order === 'asc' ? '▲' : '▼'
}

const setSortByMenu = (key, order) => {
  sortState.value = { key, order }
  currentPage.value = 1
}

const clearSortByMenu = (key) => {
  if (sortState.value.key === key) {
    sortState.value = { key: '', order: '' }
    currentPage.value = 1
  }
}

const updatePlateFilter = (values) => {
  plateFilterState.value = values ?? []
  currentPage.value = 1
}

const updateOwnerFilter = (values) => {
  ownerFilterState.value = values ?? []
  currentPage.value = 1
}

const handleOwnerFilter = (query) => {
  const nextKeyword = String(query || '')
  if (nextKeyword === ownerKeyword.value && employeeList.value.length > 0) return
  ownerKeyword.value = nextKeyword
  if (ownerFilterTimer) clearTimeout(ownerFilterTimer)
  ownerFilterTimer = setTimeout(() => {
    ownerPage.value = 1
    ownerHasMore.value = false
    void fetchOwnerOptions({ reset: true, keyword: ownerKeyword.value, showLoading: true })
  }, 250)
}

const getOwnerDropdownScrollEl = () => {
  const select = ownerSelectRef.value
  const popperEl = select?.popperRef?.contentRef
  return (
    popperEl?.querySelector?.('.el-scrollbar__wrap') ??
    document.querySelector('.license-plate-owner-select .el-scrollbar__wrap')
  )
}

const unbindOwnerDropdownScroll = () => {
  if (!ownerDropdownScrollEl) return
  ownerDropdownScrollEl.removeEventListener('scroll', handleOwnerDropdownScroll)
  ownerDropdownScrollEl = null
}

const handleOwnerDropdownScroll = (event) => {
  const target = event?.target ?? ownerDropdownScrollEl
  if (!target) return
  const reachedBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 8
  if (!reachedBottom) return
  loadMoreOwnerOptions()
}

const bindOwnerDropdownScroll = () => {
  nextTick(() => {
    requestAnimationFrame(() => {
      if (ownerDropdownScrollEl) return
      const wrap = getOwnerDropdownScrollEl()
      if (!wrap) return
      ownerDropdownScrollEl = wrap
      ownerDropdownScrollEl.addEventListener('scroll', handleOwnerDropdownScroll, { passive: true })
    })
  })
}

const handleOwnerDropdownVisibleChange = (visible) => {
  if (!visible) {
    unbindOwnerDropdownScroll()
    return
  }
  if (!employeeList.value.length) {
    void fetchOwnerOptions({ reset: true, keyword: ownerKeyword.value, showLoading: true })
      .then(() => bindOwnerDropdownScroll())
    return
  }
  bindOwnerDropdownScroll()
}

const loadMoreOwnerOptions = () => {
  if (!ownerHasMore.value) return
  if (ownerLoading.value) return
  void fetchOwnerOptions({ reset: false, keyword: ownerKeyword.value })
}

onBeforeUnmount(() => {
  if (ownerFilterTimer) clearTimeout(ownerFilterTimer)
  unbindOwnerDropdownScroll()
})

const showForm = ref(false)
const formMode = ref('add')
const formData = ref({
  id: null,
  corpId: '',
  plateNumber: ''
})

const showDeleteDialog = ref(false)
const currentRow = ref(null)
const showNoticeDialog = ref(false)
const noticeTitle = ref('Notice')
const noticeMessage = ref('')
const noticeVariant = ref('default')

const noticeModalClass = computed(() =>
  noticeVariant.value === 'alert' ? 'license-plate-notice-validation' : ''
)

const showNotice = (message, title = 'Notice') => {
  noticeTitle.value = title
  noticeMessage.value = message
  noticeVariant.value = title === 'Validation' || title === 'Error' ? 'alert' : 'default'
  showNoticeDialog.value = true
}

const getErrorMessage = (error, fallback = 'Operation failed') => {
  const message = error?.response?.data?.message
  if (Array.isArray(message)) return message[0] || fallback
  if (typeof message === 'string' && message.trim()) return message
  if (typeof error?.message === 'string' && error.message.trim()) return error.message
  return fallback
}

/** Plate number: letters and digits only, max 8 (strips spaces / symbols / control chars). */
const PLATE_MAX_LENGTH = 8
const sanitizePlateNumber = (raw) =>
  String(raw ?? '')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, PLATE_MAX_LENGTH)

/** 与后端 normalizePlateNumber 一致，用于查重比较 */
const normalizePlateKey = (raw) => sanitizePlateNumber(raw).toUpperCase()

const findExistingPlate = (plateKey, excludeId = null) => {
  const exclude = excludeId != null ? String(excludeId) : ''
  return licensePlateList.value.find((item) => {
    if (exclude && String(item.id) === exclude) return false
    return normalizePlateKey(item.plateNumber) === plateKey
  })
}

const formatPlateOwnerLabel = (row) => {
  if (!row) return 'another user'
  if (row.owner && row.corpId) return `${row.owner} (${row.corpId})`
  return row.owner || row.corpId || 'another user'
}

const onPlateNumberInput = (val) => {
  formData.value.plateNumber = sanitizePlateNumber(val)
}

const getRowIndex = (index) => (currentPage.value - 1) * pageSize.value + index + 1

const handleExport = () => {
  const exportData = licensePlateList.value.map(item => ({
    ID: item.id ?? '',
    'CORP User ID': item.corpId,
    'Plate Number': item.plateNumber,
    'Owner': item.owner
  }))

  const ws = XLSX.utils.json_to_sheet(exportData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'License Plates')
  XLSX.writeFile(wb, `License_Plates_${new Date().toISOString().split('T')[0]}.xlsx`)
  showNotice('Excel file exported successfully', 'Success')
}

const handleAdd = () => {
  formMode.value = 'add'
  ownerKeyword.value = ''
  formData.value = { id: null, corpId: '', plateNumber: '' }
  showForm.value = true
}

const handleEdit = (row) => {
  formMode.value = 'edit'
  ownerKeyword.value = ''
  ownerPage.value = 1
  ownerHasMore.value = false
  formData.value = {
    id: row.id,
    corpId: row.corpId || '',
    plateNumber: sanitizePlateNumber(row.plateNumber)
  }
  if (formData.value.corpId && !employeeList.value.some((u) => u.corpId === formData.value.corpId)) {
    void fetchOwnerOptions({ reset: true, keyword: formData.value.corpId })
  }
  showForm.value = true
}

const buildOwnerPayload = () => {
  const corpId = String(formData.value.corpId || '').trim()
  if (!corpId) return null
  const matched = employeeList.value.find((u) => u.corpId === corpId)
  return {
    corpId: matched ? corpId : undefined,
    ownerName: matched ? undefined : corpId
  }
}

const handleSave = async () => {
  const plate = sanitizePlateNumber(formData.value.plateNumber)
  formData.value.plateNumber = plate

  if (!plate) {
    showNotice('Please enter a plate number (letters and digits only; max 8 characters).', 'Validation')
    return
  }
  if (plate.length > PLATE_MAX_LENGTH) {
    showNotice(`Plate number must be at most ${PLATE_MAX_LENGTH} characters.`, 'Validation')
    return
  }

  const ownerPayload = buildOwnerPayload()
  if (!ownerPayload) {
    showNotice('Please select an owner.', 'Validation')
    return
  }

  const plateKey = normalizePlateKey(plate)
  const excludeId = formMode.value === 'edit' ? formData.value.id : null
  const duplicate = findExistingPlate(plateKey, excludeId)
  if (duplicate) {
    showNotice(
      `This license plate is already registered to ${formatPlateOwnerLabel(duplicate)}.`,
      'Validation'
    )
    return
  }

  try {
    if (formMode.value === 'add') {
      await createLicensePlate({ plateNumber: plate, ...ownerPayload })
      showNotice('License plate added successfully', 'Success')
    } else {
      await updateLicensePlate(formData.value.id, { plateNumber: plate, ...ownerPayload })
      showNotice('License plate updated successfully', 'Success')
    }
    await loadLicensePlates()
    showForm.value = false
  } catch (error) {
    const status = error?.response?.status
    const fallback = status === 409
      ? 'This license plate already exists and is bound to another user.'
      : 'Failed to save license plate.'
    showNotice(getErrorMessage(error, fallback), status === 409 ? 'Validation' : 'Error')
  }
}

const handleDelete = (row) => {
  currentRow.value = row
  showDeleteDialog.value = true
}

const confirmDelete = async () => {
  if (!currentRow.value?.id) {
    showDeleteDialog.value = false
    return
  }
  try {
    await deleteLicensePlate(currentRow.value.id)
    await loadLicensePlates()
    showNotice('Deleted successfully', 'Success')
  } catch (error) {
    showNotice(getErrorMessage(error, 'Failed to delete license plate.'), 'Error')
  }
  showDeleteDialog.value = false
  currentRow.value = null
}
</script>

<style scoped>
.page-container {
  height: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  animation: fadeInUp 0.4s ease;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.page-header::before {
  content: none;
  position: absolute;
  top: -50%;
  right: -10%;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
  border-radius: 50%;
}

.page-header {
  position: relative;
  overflow: hidden;
  background: #ffffff;
  color: #111827;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  padding: 0.75rem;
  margin: 0.45rem 0.6rem 0.25rem;
  min-height: 3.625rem;
  box-sizing: border-box;
}

.page-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  position: relative;
  z-index: 1;
}

.page-header :deep(.el-button) {
  background: #ffffff;
  color: #374151;
  border: 1px solid #d1d5db;
  font-weight: 600;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  box-shadow: none;
  transition: all 0.2s ease;
  position: relative;
  z-index: 1;
}

.page-header :deep(.el-button:hover) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.page-header :deep(.el-button:active) {
  transform: translateY(0);
}

.page-content :deep(.el-table) {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.page-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0.25rem 0.6rem 0.6rem;
  display: flex;
  flex-direction: column;
}

.page-content :deep(.el-table th) {
  background: #f3f4f6;
  color: #374151;
  font-weight: 600;
  font-size: 0.8125rem;
  padding: 0.5rem;
  border-bottom: 2px solid #d1d5db;
  white-space: nowrap;
}

.page-content :deep(.el-table th .cell) {
  white-space: nowrap;
  overflow: visible;
  text-overflow: clip;
}

.th-sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 600;
  padding: 0;
  cursor: pointer;
}

.sort-indicator {
  font-size: 0.68rem;
  color: #6b7280;
  line-height: 1;
}

.page-content :deep(.el-table__row:hover) {
  background: #f9fafb;
}

.page-content :deep(.el-table td) {
  padding: 0.5rem;
  font-size: 0.8125rem;
  border-bottom: 1px solid #e5e7eb;
}

.page-content :deep(.el-button--small) {
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.page-content :deep(.el-button--small:hover) {
  transform: none;
  box-shadow: none;
}

.page-content :deep(.el-tag) {
  border-radius: 6px;
  font-weight: 500;
  border: none;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.toolbar-search {
  width: min(460px, 48vw);
}

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.75rem;
  padding: 0.475rem 0.5rem 0.375rem;
  border-top: 1px solid #e5e7eb;
  background-color: white;
  flex-shrink: 0;
}

.pagination-info {
  font-size: 0.8125rem;
  color: #6b7280;
}

.pagination-controls {
  display: flex;
  gap: 0.375rem;
  align-items: center;
}

.pagination-btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: white;
  color: #374151;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.pagination-btn:hover:not(:disabled) {
  background-color: #f3f4f6;
  border-color: #9ca3af;
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-btn.page-number {
  min-width: 36px;
  text-align: center;
}

.pagination-btn.page-number.active {
  background-color: #00723a;
  border-color: #00723a;
  color: white;
}

.pagination-btn.page-number.active:hover {
  background-color: #005a2e;
  border-color: #005a2e;
}

.pagination-size {
  display: flex;
  align-items: center;
}

.page-size-select {
  padding: 0.375rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: white;
  color: #374151;
  font-size: 0.8125rem;
  cursor: pointer;
}

.page-size-select:focus {
  outline: none;
  border-color: #00723a;
}

.page-content :deep(.el-table) {
  border-radius: 0;
  overflow: hidden;
  box-shadow: none;
  font-size: 0.8125rem;
}

.table-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  padding: 0.3rem;
  height: 100%;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.table-card :deep(.el-table) {
  flex: 1;
  min-height: 0;
}

.actions-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap;
  gap: 6px;
}

.actions-cell :deep(.el-button) {
  margin-left: 0 !important;
  white-space: nowrap;
}

.action-btn {
  border: none !important;
  padding: 0.25rem 0.5rem !important;
  border-radius: 0.25rem !important;
  font-size: 0.6875rem !important;
  font-weight: 600 !important;
  line-height: 1.2 !important;
  color: #ffffff !important;
  transition: all 0.2s !important;
}

.action-edit {
  background-color: #f97316 !important;
}

.action-edit:hover {
  background-color: #ea580c !important;
}

.action-delete {
  background-color: #ef4444 !important;
}

.action-delete:hover {
  background-color: #dc2626 !important;
}

.owner-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.owner-option-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owner-option-corp {
  color: #8492a6;
  font-size: 13px;
  flex-shrink: 0;
}

.notice-message {
  margin: 0;
  font-size: 15px;
  color: #374151;
  line-height: 1.6;
}

.field-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.4;
}

</style>

<style>
/* Teleport 到 body，Validation / Error 提示弹窗使用红色警示样式 */
.booking-style-modal-root.license-plate-notice-validation .booking-dialog-wrapper {
  border: 2px solid #dc2626;
  border-radius: 16px;
}

.booking-style-modal-root.license-plate-notice-validation .modal-header {
  background: #dc2626;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}

.booking-style-modal-root.license-plate-notice-validation .modal-title {
  color: #ffffff;
  font-weight: 700;
}

.booking-style-modal-root.license-plate-notice-validation .modal-close:hover .close-icon {
  stroke: #fecaca;
}

.booking-style-modal-root.license-plate-notice-validation .notice-message {
  color: #b91c1c;
  font-weight: 600;
}

.booking-style-modal-root.license-plate-notice-validation .submit-btn {
  border-color: #dc2626;
  color: #dc2626;
  font-weight: 600;
}

.booking-style-modal-root.license-plate-notice-validation .submit-btn:hover {
  background: #fef2f2;
  border-color: #b91c1c;
  color: #b91c1c;
}

.license-plate-owner-select.el-select-dropdown {
  overflow: hidden;
}

.license-plate-owner-select.el-select-dropdown .el-select-dropdown__wrap,
.license-plate-owner-select.el-select-dropdown .el-scrollbar__wrap {
  max-height: 260px !important;
}

.license-plate-owner-select.el-select-dropdown.el-popper {
  transition: none !important;
}
</style>
