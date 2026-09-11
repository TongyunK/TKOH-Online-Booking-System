<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">EV Management</h2>
      <div class="header-actions">
        <el-button v-if="activeTab !== 'bookingWindow'" type="default" class="cancel-btn" @click="handleExport">
          <font-awesome-icon :icon="['fas', 'file-excel']" /> Export Excel
        </el-button>
        <el-button v-if="activeTab !== 'bookingWindow'" type="default" class="submit-btn" @click="handleAdd">
          <font-awesome-icon :icon="['fas', 'plus']" /> {{ activeTab === 'parking' ? 'Add EV' : 'Add Time Period' }}
        </el-button>
      </div>
    </div>

    <div class="page-content">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="EV Space" name="parking">
          <div class="table-card">
            <el-table :data="paginatedParkingData" height="100%" border stripe table-layout="auto" style="width: 100%">
              <el-table-column
                type="index"
                label="#"
                width="70"
                align="center"
                header-align="center"
                fixed="left"
                :index="getParkingRowIndex"
              />
              <el-table-column prop="evSpace" min-width="140">
                <template #header>
                  <SortableFilterHeader
                    label="EV Space"
                    :sort-indicator="getParkingSortIndicator('evSpace')"
                    :filter-active="parkingFilterState.evSpace.length > 0"
                    :options="parkingSlotOptions"
                    :model-value="parkingFilterState.evSpace"
                    @sort-asc="setParkingSort('evSpace', 'asc')"
                    @sort-desc="setParkingSort('evSpace', 'desc')"
                    @clear-sort="clearParkingSort('evSpace')"
                    @update:model-value="(v) => updateParkingFilter('evSpace', v)"
                  />
                </template>
              </el-table-column>
              <el-table-column prop="location" label="Location" min-width="180" />
              <el-table-column prop="status" label="Status" min-width="120">
                <template #default="{ row }">
                  <el-tag effect="light" :class="row.status === 'active' ? 'status-tag-active' : 'status-tag-inactive'">
                    {{ row.status === 'active' ? 'Active' : 'Inactive' }}
                  </el-tag>
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
                Showing {{ parkingStartIndex + 1 }}-{{ parkingEndIndex }} of {{ sortedParkingList.length }} records
              </div>
              <div class="pagination-controls">
                <button class="pagination-btn" :disabled="parkingCurrentPage === 1" @click="parkingCurrentPage--">Previous</button>
                <button
                  v-for="page in parkingVisiblePages"
                  :key="page"
                  :class="['pagination-btn', 'page-number', { active: page === parkingCurrentPage }]"
                  @click="parkingCurrentPage = page"
                >
                  {{ page }}
                </button>
                <button class="pagination-btn" :disabled="parkingCurrentPage === parkingTotalPages" @click="parkingCurrentPage++">Next</button>
              </div>
              <div class="pagination-size">
                <select v-model.number="parkingPageSize" class="page-size-select" @change="parkingCurrentPage = 1">
                  <option :value="10">10 / page</option>
                  <option :value="20">20 / page</option>
                  <option :value="50">50 / page</option>
                  <option :value="100">100 / page</option>
                </select>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="Booking Period" name="timePeriods">
          <div class="table-card">
            <el-table :data="paginatedTimePeriodsData" height="100%" border stripe table-layout="auto" style="width: 100%">
              <el-table-column
                type="index"
                label="#"
                width="70"
                align="center"
                header-align="center"
                fixed="left"
                :index="getTimePeriodsRowIndex"
              />
              <el-table-column prop="period" label="Time Period" min-width="120" />
              <el-table-column prop="startTime" label="Start Time" min-width="140" />
              <el-table-column prop="endTime" label="End Time" min-width="140" />
              <el-table-column prop="status" label="Status" min-width="120">
                <template #default="{ row }">
                  <el-tag effect="light" :class="row.status === 'active' ? 'status-tag-active' : 'status-tag-inactive'">
                    {{ row.status === 'active' ? 'Active' : 'Inactive' }}
                  </el-tag>
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
                Showing {{ timePeriodsStartIndex + 1 }}-{{ timePeriodsEndIndex }} of {{ timePeriodsList.length }} records
              </div>
              <div class="pagination-controls">
                <button class="pagination-btn" :disabled="timePeriodsCurrentPage === 1" @click="timePeriodsCurrentPage--">Previous</button>
                <button
                  v-for="page in timePeriodsVisiblePages"
                  :key="page"
                  :class="['pagination-btn', 'page-number', { active: page === timePeriodsCurrentPage }]"
                  @click="timePeriodsCurrentPage = page"
                >
                  {{ page }}
                </button>
                <button class="pagination-btn" :disabled="timePeriodsCurrentPage === timePeriodsTotalPages" @click="timePeriodsCurrentPage++">Next</button>
              </div>
              <div class="pagination-size">
                <select v-model.number="timePeriodsPageSize" class="page-size-select" @change="timePeriodsCurrentPage = 1">
                  <option :value="10">10 / page</option>
                  <option :value="20">20 / page</option>
                  <option :value="50">50 / page</option>
                  <option :value="100">100 / page</option>
                </select>
              </div>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="Booking Date Range" name="bookingWindow">
          <div class="booking-window-card">
            <div class="booking-window-header">
              <h3>EV Booking Date Range</h3>
              <span class="window-pill">
                <span class="window-pill-label">Current</span>
                <span class="window-pill-range">{{ evWindow.currentStartDate }} ~ {{ evWindow.currentEndDate }}</span>
              </span>
            </div>
            <div class="booking-window-form">
              <el-date-picker
                v-model="evWindowForm.startDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="Start date"
                :teleported="false"
              />
              <el-date-picker
                v-model="evWindowForm.endDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="End date"
                :teleported="false"
              />
              <el-button type="default" class="submit-btn" @click="handlePublishEvWindow">Publish</el-button>
              <el-button type="default" @click="applyCurrentCalendarYear">Current Year</el-button>
            </div>
            <div class="booking-window-meta">
              Last published by {{ evWindow.updatedBy }} at {{ formatDateTime(evWindow.updatedAt) }}
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <BookingStyleModal
      v-model="showForm"
      :title="getFormTitle"
      max-width="500px"
      custom-class="ev-management-form-modal"
    >
      <el-form :model="formData" label-width="120px">
        <template v-if="activeTab === 'parking'">
          <el-form-item label="EV Space">
            <el-input v-model="formData.evSpace" />
          </el-form-item>
          <el-form-item label="Location">
            <el-input v-model="formData.location" />
          </el-form-item>
          <el-form-item label="Active">
            <el-switch v-model="formData.status" active-value="active" inactive-value="inactive" />
          </el-form-item>
        </template>
        <template v-else>
          <el-form-item label="Time Period">
            <el-input v-model="formData.period" placeholder="e.g., AM, PM, Night" />
          </el-form-item>
          <el-form-item label="Start Time">
            <el-time-picker
              v-model="formData.startTime"
              format="HH:mm"
              value-format="HH:mm"
              :teleported="false"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="End Time">
            <el-time-picker
              v-model="formData.endTime"
              format="HH:mm"
              value-format="HH:mm"
              :teleported="false"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="Active">
            <el-switch v-model="formData.status" active-value="active" inactive-value="inactive" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="showForm = false">Cancel</el-button>
        <el-button type="default" class="submit-btn" @click="handleSave">Save</el-button>
      </template>
    </BookingStyleModal>

    <BookingStyleModal v-model="showDeleteDialog" title="Confirm Delete" max-width="450px">
      <p>Are you sure you want to delete this {{ activeTab === 'parking' ? 'EV' : 'time period' }}?</p>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="showDeleteDialog = false">Cancel</el-button>
        <el-button type="default" class="action-btn action-delete" @click="confirmDelete(false)">Delete</el-button>
      </template>
    </BookingStyleModal>

    <BookingStyleModal v-model="showCascadeDeleteDialog" title="Delete Related Records?" max-width="520px">
      <p class="notice-message">{{ cascadeDeleteMessage }}</p>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="showCascadeDeleteDialog = false">No</el-button>
        <el-button type="default" class="action-btn action-delete" @click="confirmDelete(true)">Yes, delete all</el-button>
      </template>
    </BookingStyleModal>

    <BookingStyleModal v-model="showNoticeDialog" :title="noticeTitle" max-width="420px">
      <p class="notice-message">{{ noticeMessage }}</p>
      <template #footer>
        <el-button type="default" class="submit-btn" @click="closeNoticeDialog">OK</el-button>
      </template>
    </BookingStyleModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import * as XLSX from 'xlsx'
import BookingStyleModal from '@/components/BookingStyleModal.vue'
import SortableFilterHeader from '@/components/admin/SortableFilterHeader.vue'
import {
  getEvParkingSlots,
  getEvTimePeriods,
  getEvBookingWindow,
  createEvParkingSlot,
  updateEvParkingSlot,
  deleteEvParkingSlot,
  createEvTimePeriod,
  updateEvTimePeriod,
  deleteEvTimePeriod,
  publishEvBookingWindow
} from '@/api/evManagement'
import { notifyEvBookingWindowUpdated } from '@/utils/evBookingWindowSync'
import { getCurrentCalendarYearBoundsYmd } from '@/utils/appTimezone'

const activeTab = ref('parking')
const parkingList = ref([])
const timePeriodsList = ref([])
const evWindow = ref({
  currentStartDate: '',
  currentEndDate: '',
  updatedBy: '-',
  updatedAt: null
})
const evWindowForm = ref({
  startDate: '',
  endDate: ''
})

// Parking pagination
const parkingCurrentPage = ref(1)
const parkingPageSize = ref(20)
const parkingSortState = ref({ key: '', order: '' })
const parkingFilterState = ref({ evSpace: [] })

const getUniqueOptions = (list, key) => {
  return [...new Set((list || []).map(item => item?.[key]).filter(v => v !== null && v !== undefined && `${v}` !== ''))]
}

const parkingSlotOptions = computed(() => getUniqueOptions(parkingList.value, 'evSpace'))

const updateParkingFilter = (key, value) => {
  parkingFilterState.value[key] = value ?? []
  parkingCurrentPage.value = 1
}

const selectAllParkingFilterOptions = (key, options) => {
  updateParkingFilter(key, [...options])
}

const clearParkingFilterOptions = (key) => {
  updateParkingFilter(key, [])
}

const filteredParkingList = computed(() => {
  const selected = parkingFilterState.value.evSpace || []
  if (!selected.length) return parkingList.value
  return parkingList.value.filter(item => selected.map(v => String(v)).includes(String(item.evSpace)))
})

const sortedParkingList = computed(() => {
  const { key, order } = parkingSortState.value
  const rows = filteredParkingList.value.slice()
  if (!key || !order) return rows
  return rows.sort((a, b) => {
    const aVal = a?.[key] ?? ''
    const bVal = b?.[key] ?? ''
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { sensitivity: 'base' })
    return order === 'asc' ? cmp : -cmp
  })
})

const setParkingSort = (key, order) => {
  parkingSortState.value = { key, order }
  parkingCurrentPage.value = 1
}

const clearParkingSort = (key) => {
  if (parkingSortState.value.key === key) {
    parkingSortState.value = { key: '', order: '' }
    parkingCurrentPage.value = 1
  }
}

const getParkingSortIndicator = (key) => {
  if (parkingSortState.value.key !== key || !parkingSortState.value.order) return '↕'
  return parkingSortState.value.order === 'asc' ? '▲' : '▼'
}

const paginatedParkingData = computed(() => {
  const start = (parkingCurrentPage.value - 1) * parkingPageSize.value
  const end = start + parkingPageSize.value
  return sortedParkingList.value.slice(start, end)
})

const parkingTotalPages = computed(() => Math.max(1, Math.ceil(sortedParkingList.value.length / parkingPageSize.value)))
const parkingStartIndex = computed(() => (parkingCurrentPage.value - 1) * parkingPageSize.value)
const parkingEndIndex = computed(() => Math.min(parkingStartIndex.value + parkingPageSize.value, sortedParkingList.value.length))
const parkingVisiblePages = computed(() => {
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, parkingCurrentPage.value - Math.floor(maxVisible / 2))
  let end = Math.min(parkingTotalPages.value, start + maxVisible - 1)
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

// Time Periods pagination
const timePeriodsCurrentPage = ref(1)
const timePeriodsPageSize = ref(20)

const paginatedTimePeriodsData = computed(() => {
  const start = (timePeriodsCurrentPage.value - 1) * timePeriodsPageSize.value
  const end = start + timePeriodsPageSize.value
  return timePeriodsList.value.slice(start, end)
})

const timePeriodsTotalPages = computed(() => Math.max(1, Math.ceil(timePeriodsList.value.length / timePeriodsPageSize.value)))
const timePeriodsStartIndex = computed(() => (timePeriodsCurrentPage.value - 1) * timePeriodsPageSize.value)
const timePeriodsEndIndex = computed(() => Math.min(timePeriodsStartIndex.value + timePeriodsPageSize.value, timePeriodsList.value.length))
const timePeriodsVisiblePages = computed(() => {
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, timePeriodsCurrentPage.value - Math.floor(maxVisible / 2))
  let end = Math.min(timePeriodsTotalPages.value, start + maxVisible - 1)
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

const showForm = ref(false)
const formMode = ref('add')
const formData = ref({
  evSpace: '',
  location: '',
  period: '',
  startTime: '',
  endTime: '',
  status: 'active'
})

const showDeleteDialog = ref(false)
const showCascadeDeleteDialog = ref(false)
const cascadeDeleteMessage = ref('')
const currentRow = ref(null)
const showNoticeDialog = ref(false)
const noticeTitle = ref('Notice')
const noticeMessage = ref('')

const showNotice = (message, title = 'Notice') => {
  noticeTitle.value = title
  noticeMessage.value = message
  showNoticeDialog.value = true
}

const closeNoticeDialog = () => {
  showNoticeDialog.value = false
  showDeleteDialog.value = false
  showCascadeDeleteDialog.value = false
}

const getErrorMessage = (error, fallback = 'Operation failed') => {
  const message = error?.response?.data?.message
  if (Array.isArray(message)) return message[0] || fallback
  if (typeof message === 'string' && message.trim()) return message
  if (message && typeof message === 'object' && typeof message.message === 'string') {
    return message.message
  }
  if (typeof error?.message === 'string' && error.message.trim()) return error.message
  return fallback
}

const getRelatedBookingsConflict = (error) => {
  const data = error?.response?.data
  if (!data || typeof data !== 'object') return null
  const payload = data.message && typeof data.message === 'object' ? data.message : data
  if (payload?.code !== 'HAS_RELATED_BOOKINGS') return null
  return payload
}

const applyEvWindowFromApi = (win) => {
  if (!win) return
  evWindow.value = {
    currentStartDate: win.currentStartDate || '',
    currentEndDate: win.currentEndDate || '',
    updatedBy: win.updatedBy || '-',
    updatedAt: win.updatedAt ?? null
  }
  evWindowForm.value = {
    startDate: win.currentStartDate || '',
    endDate: win.currentEndDate || ''
  }
}

const loadEvManagementData = async () => {
  try {
    const [parking, periods, win] = await Promise.all([
      getEvParkingSlots(),
      getEvTimePeriods(),
      getEvBookingWindow()
    ])
    parkingList.value = Array.isArray(parking) ? parking : []
    timePeriodsList.value = Array.isArray(periods) ? periods : []
    applyEvWindowFromApi(win)
  } catch (error) {
    showNotice(getErrorMessage(error, 'Failed to load EV management data'), 'Error')
  }
}

onMounted(() => {
  loadEvManagementData()
})

const getFormTitle = computed(() => {
  if (activeTab.value === 'parking') {
    return formMode.value === 'add' ? 'Add EV' : 'Edit EV'
  } else {
    return formMode.value === 'add' ? 'Add Time Period' : 'Edit Time Period'
  }
})

const getParkingRowIndex = (index) => (parkingCurrentPage.value - 1) * parkingPageSize.value + index + 1
const getTimePeriodsRowIndex = (index) => (timePeriodsCurrentPage.value - 1) * timePeriodsPageSize.value + index + 1

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', { hour12: false })
}

const handleExport = () => {
  if (activeTab.value === 'parking') {
    const exportData = parkingList.value.map(item => ({
      'EV Space': item.evSpace,
      'Location': item.location,
      'Status': item.status === 'active' ? 'Active' : 'Inactive'
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'EV Parking')
    XLSX.writeFile(wb, `EV_Parking_${new Date().toISOString().split('T')[0]}.xlsx`)
  } else {
    const exportData = timePeriodsList.value.map(item => ({
      'Time Period': item.period,
      'Start Time': item.startTime,
      'End Time': item.endTime,
      'Status': item.status === 'active' ? 'Active' : 'Inactive'
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Time Periods')
    XLSX.writeFile(wb, `EV_Time_Periods_${new Date().toISOString().split('T')[0]}.xlsx`)
  }
  showNotice('Excel file exported successfully', 'Success')
}

const handleAdd = () => {
  formMode.value = 'add'
  if (activeTab.value === 'parking') {
    formData.value = { evSpace: '', location: '', status: 'active' }
  } else {
    formData.value = { period: '', startTime: '', endTime: '', status: 'active' }
  }
  showForm.value = true
}

const handlePublishEvWindow = async () => {
  if (!evWindowForm.value.startDate || !evWindowForm.value.endDate) {
    showNotice('Please select start and end date', 'Warning')
    return
  }
  if (evWindowForm.value.endDate < evWindowForm.value.startDate) {
    showNotice('End date must be later than start date', 'Warning')
    return
  }

  try {
    const data = await publishEvBookingWindow({
      startDate: evWindowForm.value.startDate,
      endDate: evWindowForm.value.endDate
    })
    applyEvWindowFromApi(data)
    notifyEvBookingWindowUpdated({
      currentStartDate: data?.currentStartDate,
      currentEndDate: data?.currentEndDate
    })
    showNotice('EV booking date range published', 'Success')
  } catch (error) {
    showNotice(getErrorMessage(error, 'Failed to publish booking date range'), 'Error')
  }
}

const applyCurrentCalendarYear = () => {
  const { startDate, endDate } = getCurrentCalendarYearBoundsYmd()
  evWindowForm.value.startDate = startDate
  evWindowForm.value.endDate = endDate
}

const handleEdit = (row) => {
  formMode.value = 'edit'
  formData.value = { ...row }
  showForm.value = true
}

const handleSave = async () => {
  try {
    if (activeTab.value === 'parking') {
      const evSpace = String(formData.value.evSpace || '').trim()
      if (!evSpace) {
        showNotice('Please enter EV space', 'Warning')
        return
      }
      const payload = {
        evSpace,
        location: String(formData.value.location || '').trim(),
        status: formData.value.status || 'active'
      }
      if (formMode.value === 'add') {
        await createEvParkingSlot(payload)
        showNotice('EV added successfully', 'Success')
      } else {
        await updateEvParkingSlot(formData.value.id, payload)
        showNotice('EV updated successfully', 'Success')
      }
    } else {
      const period = String(formData.value.period || '').trim()
      const startTime = formData.value.startTime
      const endTime = formData.value.endTime
      if (!period) {
        showNotice('Please enter time period', 'Warning')
        return
      }
      if (!startTime || !endTime) {
        showNotice('Please select start and end time', 'Warning')
        return
      }
      const payload = {
        period,
        startTime: String(startTime),
        endTime: String(endTime),
        status: formData.value.status || 'active'
      }
      if (formMode.value === 'add') {
        await createEvTimePeriod(payload)
        showNotice('Time period added successfully', 'Success')
      } else {
        await updateEvTimePeriod(formData.value.id, payload)
        showNotice('Time period updated successfully', 'Success')
      }
    }
    showForm.value = false
    await loadEvManagementData()
  } catch (error) {
    showNotice(getErrorMessage(error, 'Failed to save'), 'Error')
  }
}

const handleDelete = (row) => {
  currentRow.value = row
  showCascadeDeleteDialog.value = false
  cascadeDeleteMessage.value = ''
  showDeleteDialog.value = true
}

const confirmDelete = async (cascadeRelated = false) => {
  if (!currentRow.value) return
  const resourceLabel = activeTab.value === 'parking' ? 'EV space' : 'time period'
  try {
    if (activeTab.value === 'parking') {
      await deleteEvParkingSlot(currentRow.value.id, { cascadeRelated: Boolean(cascadeRelated) })
    } else {
      await deleteEvTimePeriod(currentRow.value.id, { cascadeRelated: Boolean(cascadeRelated) })
    }
    showNotice(
      cascadeRelated
        ? `${resourceLabel[0].toUpperCase()}${resourceLabel.slice(1)} and related booking records deleted successfully`
        : 'Deleted successfully',
      'Success'
    )
    showDeleteDialog.value = false
    showCascadeDeleteDialog.value = false
    cascadeDeleteMessage.value = ''
    currentRow.value = null
    await loadEvManagementData()
  } catch (error) {
    const conflict = getRelatedBookingsConflict(error)
    if (!cascadeRelated && conflict) {
      showDeleteDialog.value = false
      cascadeDeleteMessage.value = typeof conflict.message === 'string' && conflict.message.trim()
        ? conflict.message
        : `This ${resourceLabel} has related booking records. Do you also want to delete all related records?`
      showCascadeDeleteDialog.value = true
      return
    }
    showNotice(getErrorMessage(error, 'Failed to delete'), 'Error')
  }
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
  /* Booking Date Range 无右侧按钮时仍与有按钮标签页同高 */
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

.page-content :deep(.status-tag-active) {
  border-radius: 999px;
  font-weight: 600;
  padding: 0 10px;
  background-color: #dcfce7;
  color: #166534;
}

.page-content :deep(.status-tag-inactive) {
  border-radius: 999px;
  font-weight: 600;
  padding: 0 10px;
  background-color: #fee2e2;
  color: #991b1b;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 2.25rem;
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

.th-filter-popover :deep(.el-checkbox__input.is-checked .el-checkbox__inner),
.th-filter-popover :deep(.el-checkbox__input.is-indeterminate .el-checkbox__inner) {
  background-color: #00723a;
  border-color: #00723a;
}

.th-filter-popover :deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
  color: #14532d;
  font-weight: 600;
}

.page-content :deep(.el-tabs__header) {
  margin-bottom: 0.35rem;
}

.page-content :deep(.el-tabs) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.page-content :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
}

.page-content :deep(.el-tab-pane) {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.page-content :deep(.el-tabs__item) {
  font-size: 15px;
  font-weight: 500;
  padding: 0 24px;
  height: 44px;
  line-height: 44px;
}

.page-content :deep(.el-tabs__item.is-active) {
  color: #00723a;
  font-weight: 600;
}

.page-content :deep(.el-tabs__active-bar) {
  background-color: #00723a;
  height: 3px;
}

.booking-window-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  padding: 0.75rem;
  margin-bottom: 0.5rem;
}

.booking-window-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.6rem;
}

.booking-window-header h3 {
  margin: 0;
  font-size: 0.95rem;
}

.window-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  border: 1px solid #86efac;
  box-shadow: 0 2px 6px rgba(22, 101, 52, 0.12);
}

.window-pill-label {
  background: #166534;
  color: #ffffff;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.window-pill-range {
  color: #14532d;
  font-size: 0.8125rem;
  font-weight: 700;
}

.booking-window-form {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.booking-window-meta {
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: #6b7280;
}

.notice-message {
  margin: 0;
  font-size: 15px;
  color: #374151;
  line-height: 1.6;
}
</style>
