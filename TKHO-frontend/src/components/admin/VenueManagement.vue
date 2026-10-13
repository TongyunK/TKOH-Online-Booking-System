<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">Venue Management</h2>
      <div class="header-actions">
        <el-button v-if="activeMainTab === 'venueList'" type="default" class="cancel-btn" @click="handleExport">
          <font-awesome-icon :icon="['fas', 'file-excel']" /> Export Excel
        </el-button>
        <el-button v-if="activeMainTab === 'venueList'" type="default" class="submit-btn" @click="handleAdd">
          <font-awesome-icon :icon="['fas', 'plus']" /> Add Venue
        </el-button>
      </div>
    </div>

    <div class="page-content">
      <el-tabs v-model="activeMainTab" class="main-tabs">
        <el-tab-pane label="Venue List" name="venueList">
          <div class="venue-list-pane">
          <el-tabs v-model="activeCategory" class="sub-tabs" @tab-change="handleTabChange">
            <el-tab-pane label="Conference & Discussion Rooms" name="conference_discussion" />
            <el-tab-pane label="Other Venues" name="other_venues" />
          </el-tabs>
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
        <el-table-column prop="name" min-width="240">
          <template #header>
            <SortableFilterHeader
              label="Room / Venue Name"
              :sort-indicator="getSortIndicator('name')"
              :filter-active="columnFilterState.name.length > 0"
              :options="nameOptions"
              :model-value="columnFilterState.name"
              @sort-asc="setSort('name', 'asc')"
              @sort-desc="setSort('name', 'desc')"
              @clear-sort="clearSort('name')"
              @update:model-value="(v) => updateFilter('name', v)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="nameZh" label="Name (ZH)" min-width="240" />
        <el-table-column prop="type" min-width="130">
          <template #header>
            <SortableFilterHeader
              label="Type"
              :sort-indicator="getSortIndicator('type')"
              :filter-active="columnFilterState.type.length > 0"
              :options="typeOptions"
              :model-value="columnFilterState.type"
              @sort-asc="setSort('type', 'asc')"
              @sort-desc="setSort('type', 'desc')"
              @clear-sort="clearSort('type')"
              @update:model-value="(v) => updateFilter('type', v)"
            />
          </template>
          <template #default="{ row }">
            <el-tag effect="light" :class="getTypeTagClass(row.type)">
              {{ getTypeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="color" label="Color" min-width="120">
          <template #default="{ row }">
            <div class="venue-color-cell">
              <span class="venue-color-dot" :style="{ backgroundColor: row.color }"></span>
              <span>{{ row.color }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="location" label="Location" min-width="220" />
        <el-table-column prop="locationZh" label="Location (ZH)" min-width="200" />
        <el-table-column label="Capacity" min-width="110" align="center">
          <template #default="{ row }">
            {{ row.roomCapacity ?? row.capacity ?? '-' }}
          </template>
        </el-table-column>
        <el-table-column label="Daily Open Hours" min-width="150" align="center">
          <template #default="{ row }">
            {{ formatVenueDailyBookingWindowLabel(row) || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="Tea Service" min-width="120" align="center">
          <template #default="{ row }">
            <el-tag
              effect="light"
              :class="normalizeTeaServiceAvailable(row.teaServiceAvailable) ? 'tea-service-tag-yes' : 'tea-service-tag-no'"
            >
              {{ normalizeTeaServiceAvailable(row.teaServiceAvailable) ? 'Yes' : 'No' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          width="90"
          align="center"
          header-align="center"
          class-name="table-nowrap-col"
          label-class-name="col-display-homepage-header"
        >
          <template #header>
            <span class="display-homepage-header">Display on<br>Homepage</span>
          </template>
          <template #default="{ row }">
            <span
              :class="[
                'status-badge',
                'display-homepage-badge',
                normalizeUserDefinedUploadEventTitle(row.userDefinedUploadEventTitle)
                  ? 'badge-display-homepage-yes'
                  : 'badge-display-homepage-no'
              ]"
            >
              {{ normalizeUserDefinedUploadEventTitle(row.userDefinedUploadEventTitle) ? 'Yes' : 'No' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column min-width="150">
          <template #header>
            <SortableFilterHeader
              label="Display Type"
              :sort-indicator="getSortIndicator('displayType')"
              :filter-active="columnFilterState.displayType.length > 0"
              :options="displayTypeOptions"
              :model-value="columnFilterState.displayType"
              @sort-asc="setSort('displayType', 'asc')"
              @sort-desc="setSort('displayType', 'desc')"
              @clear-sort="clearSort('displayType')"
              @update:model-value="(v) => updateFilter('displayType', v)"
            />
          </template>
          <template #default="{ row }">
            <el-tag effect="light" :class="row.displayType === 'single' ? 'display-tag-single' : 'display-tag-merge'">
              {{ row.displayType === 'single' ? 'Single' : 'Merge' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Image" min-width="160">
          <template #default="{ row }">
            <el-button v-if="row.image" type="default" size="small" class="check-btn" @click="handleViewImage(row)">
              View
            </el-button>
            <span v-else style="color: #9ca3af;">No image</span>
          </template>
        </el-table-column>
        <el-table-column label="Blocked Periods" min-width="170">
          <template #default="{ row }">
            <div class="block-period-cell">
              <el-tag type="info">{{ row.blocks?.length || 0 }} blocked</el-tag>
              <el-button size="small" class="action-btn action-block" @click="handleManageBlocks(row)">Block</el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="status" min-width="110">
          <template #header>
            <SortableFilterHeader
              label="Status"
              :sort-indicator="getSortIndicator('status')"
              :filter-active="columnFilterState.status.length > 0"
              :options="statusOptions"
              :model-value="columnFilterState.status"
              @sort-asc="setSort('status', 'asc')"
              @sort-desc="setSort('status', 'desc')"
              @clear-sort="clearSort('status')"
              @update:model-value="(v) => updateFilter('status', v)"
            />
          </template>
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
              Showing {{ filteredTotal === 0 ? 0 : startIndex + 1 }}-{{ endIndex }} of {{ filteredTotal }} records
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
        </el-tab-pane>

        <el-tab-pane label="Booking Date Range" name="bookingWindow">
          <div class="booking-window-card">
            <div class="booking-window-header">
              <h3>Venue Booking Date Range</h3>
              <span class="window-pill">
                <span class="window-pill-label">Current</span>
                <span class="window-pill-range">{{ venueWindow.currentStartDate }} ~ {{ venueWindow.currentEndDate }}</span>
              </span>
            </div>
            <div class="booking-window-form">
              <el-date-picker
                v-model="venueWindowForm.startDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="Start date"
                :teleported="false"
              />
              <el-date-picker
                v-model="venueWindowForm.endDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="End date"
                :teleported="false"
              />
              <el-button type="default" class="submit-btn" @click="handlePublishVenueWindow">Publish</el-button>
            </div>
            <div class="booking-window-meta">
              Last published by {{ venueWindow.updatedBy }} at {{ formatDateTime(venueWindow.updatedAt) }}
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <BookingStyleModal
      v-model="showForm"
      :title="formMode === 'add' ? 'Add Venue' : 'Edit Venue'"
      max-width="600px"
    >
      <el-form :model="formData" label-width="150px" class="venue-form">
        <el-form-item label="Room / Venue Name">
          <el-input v-model="formData.name" />
        </el-form-item>
        <el-form-item label="Name (ZH)">
          <el-input v-model="formData.nameZh" placeholder="場地中文名稱" />
        </el-form-item>
        <el-form-item label="Type">
          <el-select v-model="formData.type" style="width: 100%" :teleported="false">
            <el-option label="Conference" value="conference" />
            <el-option label="Discussion" value="discussion" />
            <el-option label="Other" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="Color">
          <div class="color-input-group">
            <el-color-picker v-model="formData.color" :teleported="false" />
            <el-input v-model.trim="formData.color" placeholder="#F4E9DA" maxlength="9" />
          </div>
        </el-form-item>
        <el-form-item label="Location">
          <el-input v-model="formData.location" />
        </el-form-item>
        <el-form-item label="Location (ZH)">
          <el-input v-model="formData.locationZh" placeholder="位置中文名稱" />
        </el-form-item>
        <el-form-item label="Capacity">
          <el-input-number
            v-model="formData.roomCapacity"
            :min="1"
            :step="1"
            :precision="0"
            style="width: 100%"
            controls-position="right"
          />
        </el-form-item>
        <el-form-item label="Daily Open Hours">
          <div class="daily-booking-window-row">
            <el-time-picker
              v-model="formData.dailyBookingStartTime"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="Start"
              :teleported="false"
              clearable
            />
            <span class="daily-booking-window-sep">to</span>
            <el-time-picker
              v-model="formData.dailyBookingEndTime"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="End"
              :teleported="false"
              clearable
            />
          </div>
        </el-form-item>
        <el-form-item label="Display Type">
          <div class="display-type-buttons">
            <button
              type="button"
              :class="['type-btn', 'type-btn-single', { active: formData.displayType === 'single' }]"
              @click="formData.displayType = 'single'"
            >
              Single
            </button>
            <button
              type="button"
              :class="['type-btn', 'type-btn-merge', { active: formData.displayType === 'merge' }]"
              @click="formData.displayType = 'merge'"
            >
              Merge
            </button>
          </div>
        </el-form-item>
        <el-form-item label="Image">
          <el-upload
            class="venue-image-upload"
            :class="{ 'venue-image-upload--full': (formData.imageList?.length || 0) >= 1 }"
            v-model:file-list="formData.imageList"
            action="#"
            list-type="picture-card"
            :auto-upload="false"
            :limit="1"
            accept=".jpg,.jpeg,.png,.webp"
            :on-change="handleImageChange"
            :on-remove="handleImageRemove"
            :on-preview="handlePreview"
            :on-exceed="handleExceed"
          >
            <font-awesome-icon v-if="(formData.imageList?.length || 0) < 1" :icon="['fas', 'plus']" />
          </el-upload>
        </el-form-item>
        <el-form-item label="Tea Service">
          <el-switch
            v-model="formData.teaServiceAvailable"
            :active-value="true"
            :inactive-value="false"
          />
        </el-form-item>
        <el-form-item label="Display on Homepage">
          <el-switch
            v-model="formData.userDefinedUploadEventTitle"
            :active-value="true"
            :inactive-value="false"
          />
        </el-form-item>
        <el-form-item label="Active">
          <el-switch v-model="formData.status" active-value="active" inactive-value="inactive" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="showForm = false">Cancel</el-button>
        <el-button type="default" class="submit-btn" @click="handleSave">Save</el-button>
      </template>
    </BookingStyleModal>

    <BookingStyleModal v-model="showImagePreview" title="Image Preview" max-width="800px" dialog-width="94%">
      <img :src="previewImageUrl" style="width: 100%" alt="" />
    </BookingStyleModal>

    <BookingStyleModal v-model="showDeleteDialog" title="Confirm Delete" max-width="450px">
      <p>Are you sure you want to delete this venue?</p>
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

    <BookingStyleModal
      v-model="showBlockDialog"
      :title="`Manage Block Period - ${blockVenueName}`"
      max-width="980px"
      :dialog-height="blockDialogHeight"
      :max-height="blockDialogMaxHeight"
      :overlay-padding="blockDialogOverlayPadding"
    >
      <div ref="blockModalContentRef" class="block-modal-content">
        <el-form ref="blockFormSectionRef" :model="blockForm" label-width="90px">
          <div class="block-form-row">
            <el-form-item label="Start">
              <el-date-picker
                v-model="blockForm.startAt"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm"
                placeholder="Start datetime"
                :teleported="false"
                style="width: 220px"
              />
            </el-form-item>
            <el-form-item label="End">
              <el-date-picker
                v-model="blockForm.endAt"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm"
                placeholder="End datetime"
                :teleported="false"
                style="width: 220px"
              />
            </el-form-item>
          </div>
          <el-form-item label="Reason">
            <el-input
              v-model.trim="blockForm.reason"
              type="textarea"
              :rows="3"
              placeholder="e.g. Maintenance / Cleaning / Event Setup"
            />
          </el-form-item>
        </el-form>
        <div ref="blockToolbarRef" class="block-toolbar">
          <span v-if="isBlockTimeRangeInvalid" class="block-range-warning">End datetime must be later than start datetime</span>
          <el-button type="default" class="submit-btn" :disabled="isBlockTimeRangeInvalid" @click="handleAddBlockPeriod">Add Block Period</el-button>
        </div>
        <div class="block-table-wrap">
          <el-table class="block-table" :data="paginatedBlockData" :max-height="blockTableMaxHeight" border stripe table-layout="fixed" style="width: 100%">
            <el-table-column type="index" label="#" width="70" align="center" />
            <el-table-column prop="startAt" label="Start" min-width="110">
              <template #header>
                <button type="button" class="th-sort-btn" @click="toggleBlockSort('startAt')">
                  Start
                  <span class="sort-indicator">{{ getBlockSortIndicator('startAt') }}</span>
                </button>
              </template>
              <template #default="{ row }">
                {{ formatBlockDateTime(row.startAt) }}
              </template>
            </el-table-column>
            <el-table-column prop="endAt" label="End" min-width="110">
              <template #header>
                <button type="button" class="th-sort-btn" @click="toggleBlockSort('endAt')">
                  End
                  <span class="sort-indicator">{{ getBlockSortIndicator('endAt') }}</span>
                </button>
              </template>
              <template #default="{ row }">
                {{ formatBlockDateTime(row.endAt) }}
              </template>
            </el-table-column>
            <el-table-column prop="reason" label="Reason" min-width="260" />
            <el-table-column label="Actions" width="120" align="center">
              <template #default="{ row }">
                <el-button size="small" class="action-btn action-delete" @click="handleRemoveBlockPeriod(row.id)">Delete</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div ref="blockPaginationRef" class="pagination-bar block-pagination-bar">
            <div class="pagination-info">
              Showing {{ blockStartIndex + 1 }}-{{ blockEndIndex }} of {{ currentVenueBlocks.length }} records
            </div>
            <div class="pagination-controls">
              <button class="pagination-btn" :disabled="blockCurrentPage === 1" @click="blockCurrentPage--">Previous</button>
              <button
                v-for="page in blockVisiblePages"
                :key="page"
                :class="['pagination-btn', 'page-number', { active: page === blockCurrentPage }]"
                @click="blockCurrentPage = page"
              >
                {{ page }}
              </button>
              <button class="pagination-btn" :disabled="blockCurrentPage === blockTotalPages" @click="blockCurrentPage++">Next</button>
            </div>
            <div class="pagination-size">
              <select v-model.number="blockPageSize" class="page-size-select" @change="blockCurrentPage = 1">
                <option :value="5">5 / page</option>
                <option :value="10">10 / page</option>
                <option :value="20">20 / page</option>
                <option :value="50">50 / page</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="showBlockDialog = false">Close</el-button>
      </template>
    </BookingStyleModal>

    <BookingStyleModal
      v-model="showNoticeDialog"
      :title="noticeTitle"
      max-width="420px"
      custom-class="venue-notice-modal"
    >
      <p class="notice-message">{{ noticeMessage }}</p>
      <template #footer>
        <el-button type="default" class="submit-btn" @click="closeNoticeDialog">OK</el-button>
      </template>
    </BookingStyleModal>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as XLSX from 'xlsx'
import BookingStyleModal from '@/components/BookingStyleModal.vue'
import SortableFilterHeader from '@/components/admin/SortableFilterHeader.vue'
import {
  getVenueManagementVenues,
  createVenue,
  updateVenue,
  deleteVenue,
  getVenueBookingWindow,
  publishVenueBookingWindow,
  createVenueBlock,
  deleteVenueBlock,
  uploadVenueImage
} from '@/api/venueManagement'
import { loadProtectedAssetUrl } from '@/utils/apiAsset'
import { formatVenueDailyBookingWindowLabel } from '@/utils/venueDailyBookingWindow'

function normalizeTeaServiceAvailable (value, defaultValue = true) {
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  if (value === undefined || value === null) return defaultValue
  return Boolean(value)
}

function normalizeUserDefinedUploadEventTitle (value, defaultValue = true) {
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  if (value === undefined || value === null) return defaultValue
  return Boolean(value)
}

function normalizeDailyBookingTime (value) {
  const raw = String(value ?? '').trim()
  return raw || null
}

const venueList = ref([])
const activeMainTab = ref('venueList')
const activeCategory = ref('conference_discussion')

const currentPage = ref(1)
const pageSize = ref(20)
const venueWindow = ref({
  currentStartDate: '',
  currentEndDate: '',
  updatedBy: '-',
  updatedAt: null
})
const venueWindowForm = ref({
  startDate: '',
  endDate: ''
})

const filteredVenueList = computed(() =>
  venueList.value.filter(item => (item.tab ?? item.category) === activeCategory.value)
)
const columnFilterState = ref({
  name: [],
  type: [],
  displayType: [],
  status: []
})
const sortState = ref([])

const getUniqueOptions = (list, key) => {
  return [...new Set((list || []).map(item => getSortValue(item, key)).filter(v => v !== null && v !== undefined && `${v}` !== ''))]
}

const nameOptions = computed(() => getUniqueOptions(filteredVenueList.value, 'name'))
const typeOptions = computed(() => getUniqueOptions(filteredVenueList.value, 'type'))
const displayTypeOptions = computed(() => getUniqueOptions(filteredVenueList.value, 'displayType'))
const statusOptions = computed(() => getUniqueOptions(filteredVenueList.value, 'status'))

const updateFilter = (key, value) => {
  columnFilterState.value[key] = value ?? []
  currentPage.value = 1
}

const selectAllFilterOptions = (key, options) => {
  updateFilter(key, [...options])
}

const clearFilterOptions = (key) => {
  updateFilter(key, [])
}

const filteredByColumnList = computed(() => {
  return filteredVenueList.value.filter((item) => {
    return Object.entries(columnFilterState.value).every(([key, selected]) => {
      if (!Array.isArray(selected) || selected.length === 0) return true
      const value = String(getSortValue(item, key))
      return selected.map(v => String(v)).includes(value)
    })
  })
})

const filteredTotal = computed(() => filteredByColumnList.value.length)

const getSortValue = (item, key) => {
  switch (key) {
    case 'name':
      return item.name || ''
    case 'type':
      return getTypeLabel(item.type)
    case 'displayType':
      return item.displayType === 'single' ? 'Single' : 'Merge'
    case 'status':
      return item.status || ''
    default:
      return ''
  }
}

const sortedVenueList = computed(() => {
  if (!sortState.value.length) return filteredByColumnList.value.slice()
  return filteredByColumnList.value.slice().sort((a, b) => {
    for (const criterion of sortState.value) {
      const aValue = getSortValue(a, criterion.key)
      const bValue = getSortValue(b, criterion.key)
      const direction = criterion.order === 'asc' ? 1 : -1
      const cmp = String(aValue).localeCompare(String(bValue), undefined, { sensitivity: 'base' })
      if (cmp !== 0) return cmp * direction
    }
    return 0
  })
})

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return sortedVenueList.value.slice(start, end)
})

const totalPages = computed(() => Math.max(1, Math.ceil(sortedVenueList.value.length / pageSize.value)))
const startIndex = computed(() => (currentPage.value - 1) * pageSize.value)
const endIndex = computed(() => Math.min(startIndex.value + pageSize.value, sortedVenueList.value.length))
const visiblePages = computed(() => {
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages.value, start + maxVisible - 1)
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1)
  }
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

const showForm = ref(false)
const formMode = ref('add')
const formData = ref({
  name: '',
  nameZh: '',
  tab: 'conference_discussion',
  type: 'conference',
  color: '',
  location: '',
  locationZh: '',
  roomCapacity: null,
  dailyBookingStartTime: null,
  dailyBookingEndTime: null,
  teaServiceAvailable: true,
  userDefinedUploadEventTitle: false,
  displayType: 'single',
  image: '',
  imageList: [],
  status: 'active'
})

const showImagePreview = ref(false)
const previewImageUrl = ref('')
const showDeleteDialog = ref(false)
const showCascadeDeleteDialog = ref(false)
const cascadeDeleteMessage = ref('')
const currentRow = ref(null)
const showBlockDialog = ref(false)
const currentBlockVenue = ref(null)
const blockForm = ref({
  startAt: '',
  endAt: '',
  reason: ''
})
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

const getSelectedVenueImageFile = () => {
  const first = formData.value?.imageList?.[0]
  return first?.raw || null
}

const tableLoading = ref(false)

const loadVenueList = async () => {
  tableLoading.value = true
  try {
    const data = await getVenueManagementVenues()
    venueList.value = Array.isArray(data) ? data : []
  } catch (error) {
    showNotice(getErrorMessage(error, 'Failed to load venue list'), 'Error')
  } finally {
    tableLoading.value = false
  }
}

const loadVenueWindow = async () => {
  try {
    const data = await getVenueBookingWindow()
    venueWindow.value = {
      currentStartDate: data?.currentStartDate || '',
      currentEndDate: data?.currentEndDate || '',
      updatedBy: data?.updatedBy || '-',
      updatedAt: data?.updatedAt || null
    }
    venueWindowForm.value = {
      startDate: venueWindow.value.currentStartDate,
      endDate: venueWindow.value.currentEndDate
    }
  } catch (error) {
    showNotice(getErrorMessage(error, 'Failed to load booking date range'), 'Error')
  }
}
const blockModalContentRef = ref(null)
const blockFormSectionRef = ref(null)
const blockToolbarRef = ref(null)
const blockPaginationRef = ref(null)
const blockCurrentPage = ref(1)
const blockPageSize = ref(20)

const getRowIndex = (index) => (currentPage.value - 1) * pageSize.value + index + 1

const toggleSort = (key) => {
  const idx = sortState.value.findIndex(item => item.key === key)
  if (idx === -1) {
    sortState.value.push({ key, order: 'asc' })
  } else if (sortState.value[idx].order === 'asc') {
    sortState.value[idx].order = 'desc'
  } else {
    sortState.value.splice(idx, 1)
  }
  currentPage.value = 1
}

const setSort = (key, order) => {
  const idx = sortState.value.findIndex(item => item.key === key)
  if (idx === -1) {
    sortState.value.push({ key, order })
  } else {
    sortState.value[idx].order = order
  }
  currentPage.value = 1
}

const clearSort = (key) => {
  const idx = sortState.value.findIndex(item => item.key === key)
  if (idx !== -1) {
    sortState.value.splice(idx, 1)
    currentPage.value = 1
  }
}

const getSortIndicator = (key) => {
  const idx = sortState.value.findIndex(item => item.key === key)
  if (idx === -1) return ''
  const arrow = sortState.value[idx].order === 'asc' ? '↑' : '↓'
  return `${arrow}${idx + 1}`
}

const tabFromVenueType = (type) => (
  type === 'conference' || type === 'discussion' ? 'conference_discussion' : 'other_venues'
)

const getTypeLabel = (type) => {
  if (type === 'conference') return 'Conference'
  if (type === 'discussion') return 'Discussion'
  return 'Other'
}

const getTypeTagClass = (type) => {
  if (type === 'conference') return 'type-tag type-tag-conference'
  if (type === 'discussion') return 'type-tag type-tag-discussion'
  return 'type-tag type-tag-other'
}

const isValidHexColor = (value) => /^#[0-9A-Za-z]{6,8}$/.test(value)
const blockVenueName = computed(() => currentBlockVenue.value?.name || 'Venue')
const currentVenueBlocks = computed(() => currentBlockVenue.value?.blocks || [])
/** 14" 断点实现参考 MeetingApproval 的 matchMedia 方式 */
const BLOCK_MODAL_MQ = '(min-width: 1100px) and (max-width: 1599px)'
const blockDialogMaxHeight = ref('90vh')
const blockDialogHeight = ref('84vh')
const blockDialogOverlayPadding = ref('20px 0')
const blockTableMaxHeight = ref('42vh')
const blockSortState = ref({ key: '', order: '' })

const parseBlockDateMs = (value) => {
  if (!value) return Number.NEGATIVE_INFINITY
  const normalized = typeof value === 'string' ? value.replace(' ', 'T') : value
  const t = new Date(normalized).getTime()
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t
}

const parseBlockCreatedMs = (item) => {
  const createdAtMs = parseBlockDateMs(item?.createdAt)
  if (createdAtMs !== Number.NEGATIVE_INFINITY) return createdAtMs
  const idNum = Number(item?.id)
  return Number.isFinite(idNum) ? idNum : Number.NEGATIVE_INFINITY
}

const isBlockTimeRangeInvalid = computed(() => {
  if (!blockForm.value.startAt || !blockForm.value.endAt) return false
  return parseBlockDateMs(blockForm.value.endAt) <= parseBlockDateMs(blockForm.value.startAt)
})

const sortedBlockData = computed(() => {
  const list = currentVenueBlocks.value.slice()
  const { key, order } = blockSortState.value
  if (!key || !order) {
    // 默认：按创建时间倒序（最新创建在前）
    return list.sort((a, b) => parseBlockCreatedMs(b) - parseBlockCreatedMs(a))
  }
  const direction = order === 'asc' ? 1 : -1
  return list.sort((a, b) => {
    const av = parseBlockDateMs(a[key])
    const bv = parseBlockDateMs(b[key])
    if (av === bv) return String(a.id).localeCompare(String(b.id)) * direction
    return (av - bv) * direction
  })
})

const blockTotalPages = computed(() => Math.max(1, Math.ceil(sortedBlockData.value.length / blockPageSize.value)))
const blockStartIndex = computed(() => {
  if (currentVenueBlocks.value.length === 0) return 0
  return (blockCurrentPage.value - 1) * blockPageSize.value
})
const blockEndIndex = computed(() => {
  if (currentVenueBlocks.value.length === 0) return 0
  return Math.min(blockStartIndex.value + blockPageSize.value, currentVenueBlocks.value.length)
})
const blockVisiblePages = computed(() => {
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, blockCurrentPage.value - Math.floor(maxVisible / 2))
  let end = Math.min(blockTotalPages.value, start + maxVisible - 1)
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})
const paginatedBlockData = computed(() => {
  const start = blockStartIndex.value
  const end = start + blockPageSize.value
  return sortedBlockData.value.slice(start, end)
})

const toggleBlockSort = (key) => {
  if (blockSortState.value.key !== key) {
    blockSortState.value = { key, order: 'asc' }
  } else if (blockSortState.value.order === 'asc') {
    blockSortState.value = { key, order: 'desc' }
  } else {
    blockSortState.value = { key: '', order: '' }
  }
  blockCurrentPage.value = 1
}

const getBlockSortIndicator = (key) => {
  if (blockSortState.value.key !== key || !blockSortState.value.order) return '↕'
  return blockSortState.value.order === 'asc' ? '▲' : '▼'
}

function updateBlockDialogModalSize () {
  if (typeof window === 'undefined') return
  const is14Inch = window.matchMedia(BLOCK_MODAL_MQ).matches
  blockDialogMaxHeight.value = is14Inch ? '120vh' : '90vh'
  blockDialogHeight.value = is14Inch ? '116vh' : '84vh'
  blockDialogOverlayPadding.value = is14Inch ? '1px 0' : '20px 0'
  updateBlockTableMaxHeight()
}

let blockDialogMq = null

const handleTabChange = () => {
  currentPage.value = 1
}

watch(filteredTotal, () => {
  if (currentPage.value > totalPages.value) {
    currentPage.value = totalPages.value
  }
})

watch([() => currentVenueBlocks.value.length, blockPageSize], () => {
  if (blockCurrentPage.value > blockTotalPages.value) {
    blockCurrentPage.value = blockTotalPages.value
  }
  updateBlockTableMaxHeight()
})

watch(showBlockDialog, (val) => {
  if (val) updateBlockTableMaxHeight()
})

onMounted(async () => {
  await Promise.all([loadVenueList(), loadVenueWindow()])
  updateBlockDialogModalSize()
  blockDialogMq = window.matchMedia(BLOCK_MODAL_MQ)
  blockDialogMq.addEventListener('change', updateBlockDialogModalSize)
})

onUnmounted(() => {
  if (blockDialogMq) {
    blockDialogMq.removeEventListener('change', updateBlockDialogModalSize)
  }
})

const handleExport = () => {
  const exportData = venueList.value.map(item => ({
    'Room / Venue Name': item.name,
    'Name (ZH)': item.nameZh || '',
    'Type': getTypeLabel(item.type),
    'Color': item.color,
    'Location': item.location,
    'Location (ZH)': item.locationZh || '',
    'Capacity': item.roomCapacity ?? item.capacity ?? '',
    'Daily Open Hours': formatVenueDailyBookingWindowLabel(item) || '-',
    'Tea Service': normalizeTeaServiceAvailable(item.teaServiceAvailable) ? 'Yes' : 'No',
    'Display on homepage': normalizeUserDefinedUploadEventTitle(item.userDefinedUploadEventTitle) ? 'Yes' : 'No',
    'Display Type': item.displayType === 'single' ? 'Single' : 'Merge',
    'Status': item.status === 'active' ? 'Active' : 'Inactive'
  }))

  const ws = XLSX.utils.json_to_sheet(exportData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Venues')
  XLSX.writeFile(wb, `Venue_Management_${new Date().toISOString().split('T')[0]}.xlsx`)
  showNotice('Excel file exported successfully', 'Success')
}

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const d = date.getDate()
  const m = date.getMonth() + 1
  const y = date.getFullYear()
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${d}/${m}/${y}, ${hh}:${mm}:${ss}`
}

const formatBlockDateTime = (value) => {
  if (!value) return '-'

  // 兼容 ISO（2026-05-16T16:00:00.000Z）与本地格式（YYYY-MM-DD HH:mm）
  const normalized = typeof value === 'string' ? value.replace(' ', 'T') : value
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return String(value)

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

const handlePublishVenueWindow = async () => {
  if (!venueWindowForm.value.startDate || !venueWindowForm.value.endDate) {
    showNotice('Please select start and end date', 'Warning')
    return
  }
  if (venueWindowForm.value.endDate < venueWindowForm.value.startDate) {
    showNotice('End date must be later than start date', 'Warning')
    return
  }

  try {
    const published = await publishVenueBookingWindow({
      startDate: venueWindowForm.value.startDate,
      endDate: venueWindowForm.value.endDate
    })
    venueWindow.value = {
      currentStartDate: published?.currentStartDate || venueWindowForm.value.startDate,
      currentEndDate: published?.currentEndDate || venueWindowForm.value.endDate,
      updatedBy: published?.updatedBy || 'Venue Admin',
      updatedAt: published?.updatedAt || new Date().toISOString()
    }
    showNotice('Venue booking date range published', 'Success')
  } catch (error) {
    showNotice(getErrorMessage(error, 'Failed to publish venue booking date range'), 'Error')
  }
}

const handleAdd = () => {
  formMode.value = 'add'
  formData.value = {
    name: '',
    nameZh: '',
    tab: activeCategory.value,
    type: activeCategory.value === 'conference_discussion' ? 'conference' : 'other',
    color: '',
    location: '',
    locationZh: '',
    roomCapacity: null,
    dailyBookingStartTime: null,
    dailyBookingEndTime: null,
    teaServiceAvailable: true,
    userDefinedUploadEventTitle: false,
    displayType: 'single',
    image: '',
    imageList: [],
    blocks: [],
    status: 'active'
  }
  showForm.value = true
}

const handleEdit = async (row) => {
  formMode.value = 'edit'
  const imagePath = row?.image || ''
  formData.value = {
    id: row?.id,
    name: row?.name || '',
    nameZh: row?.nameZh || '',
    tab: row?.tab ?? row?.category ?? activeCategory.value,
    type: row?.type ?? ((row?.tab ?? row?.category) === 'conference_discussion' ? 'conference' : 'other'),
    color: row?.color || '',
    location: row?.location || '',
    locationZh: row?.locationZh || '',
    roomCapacity: row?.roomCapacity ?? row?.capacity ?? null,
    dailyBookingStartTime: row?.dailyBookingStartTime || null,
    dailyBookingEndTime: row?.dailyBookingEndTime || null,
    teaServiceAvailable: normalizeTeaServiceAvailable(row?.teaServiceAvailable),
    userDefinedUploadEventTitle: normalizeUserDefinedUploadEventTitle(row?.userDefinedUploadEventTitle),
    displayType: row?.displayType || 'single',
    image: imagePath,
    imageList: [],
    blocks: Array.isArray(row?.blocks) ? [...row.blocks] : [],
    status: row?.status || 'active'
  }
  showForm.value = true

  if (!imagePath) return
  try {
    const previewUrl = await loadProtectedAssetUrl(imagePath)
    if (!showForm.value || formMode.value !== 'edit' || formData.value.id !== row?.id) return
    formData.value.imageList = previewUrl ? [{ url: previewUrl }] : []
  } catch (err) {
    console.warn('[VenueManagement] preview image load failed', err)
  }
}

const handleSave = async () => {
  if (!formData.value.color) {
    showNotice('Please select a color for calendar display', 'Warning')
    return
  }

  if (!isValidHexColor(formData.value.color)) {
    showNotice('Please enter a valid HEX color value, e.g. #F4E9DA', 'Warning')
    return
  }

  if (!formData.value.type) {
    showNotice('Please select a type', 'Warning')
    return
  }

  if (formData.value.roomCapacity == null || Number(formData.value.roomCapacity) < 1) {
    showNotice('Capacity must be at least 1', 'Warning')
    return
  }

  const dailyStart = normalizeDailyBookingTime(formData.value.dailyBookingStartTime)
  const dailyEnd = normalizeDailyBookingTime(formData.value.dailyBookingEndTime)
  if ((dailyStart && !dailyEnd) || (!dailyStart && dailyEnd)) {
    showNotice('Daily open booking hours require both start and end time', 'Warning')
    return
  }
  if (dailyStart && dailyEnd && dailyStart >= dailyEnd) {
    showNotice('Daily open booking end time must be later than start time', 'Warning')
    return
  }

  const selectedImageFile = getSelectedVenueImageFile()
  if (selectedImageFile) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(selectedImageFile.type)) {
      showNotice('Image format must be jpg, png, or webp', 'Warning')
      return
    }
    if (selectedImageFile.size > 2 * 1024 * 1024) {
      showNotice('Image size must be less than 2MB', 'Warning')
      return
    }
  }

  const venueTab = tabFromVenueType(formData.value.type)
  const normalizedFormData = {
    tab: venueTab,
    name: formData.value.name,
    nameZh: formData.value.nameZh,
    type: formData.value.type,
    color: formData.value.color,
    location: formData.value.location,
    locationZh: formData.value.locationZh,
    roomCapacity: formData.value.roomCapacity == null ? null : Number(formData.value.roomCapacity),
    dailyBookingStartTime: dailyStart,
    dailyBookingEndTime: dailyEnd,
    teaServiceAvailable: normalizeTeaServiceAvailable(formData.value.teaServiceAvailable),
    userDefinedUploadEventTitle: normalizeUserDefinedUploadEventTitle(formData.value.userDefinedUploadEventTitle),
    displayType: formData.value.displayType,
    status: formData.value.status,
    image: selectedImageFile ? (formData.value.image || '') : (formData.value.imageList?.[0]?.url || '')
  }

  try {
    let persistedVenue = null
    if (formMode.value === 'add') {
      const created = await createVenue(normalizedFormData)
      persistedVenue = created
      venueList.value.push(created)
    } else {
      const updated = await updateVenue(formData.value.id, normalizedFormData)
      const index = venueList.value.findIndex(item => String(item.id) === String(formData.value.id))
      if (index !== -1) {
        venueList.value[index] = updated
        persistedVenue = updated
      }
    }

    if (selectedImageFile && persistedVenue?.id) {
      const uploaded = await uploadVenueImage(persistedVenue.id, selectedImageFile)
      const idx = venueList.value.findIndex(item => String(item.id) === String(persistedVenue.id))
      if (idx !== -1) {
        venueList.value[idx] = {
          ...venueList.value[idx],
          image: uploaded?.image || venueList.value[idx].image
        }
      }
    }

    showForm.value = false
    if (venueTab !== activeCategory.value) {
      activeCategory.value = venueTab
      currentPage.value = 1
    }
    showNotice(formMode.value === 'add' ? 'Venue added successfully' : 'Venue updated successfully', 'Success')
  } catch (error) {
    // 保存失败：只提示错误，编辑弹窗保持打开，允许用户继续修改
    showForm.value = true
    showNotice(getErrorMessage(error, 'Failed to save venue'), 'Error')
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
  try {
    await deleteVenue(currentRow.value.id, { cascadeRelated: Boolean(cascadeRelated) })
    const index = venueList.value.findIndex(item => String(item.id) === String(currentRow.value.id))
    if (index !== -1) {
      venueList.value.splice(index, 1)
    }
    showNotice(
      cascadeRelated
        ? 'Venue and related booking records deleted successfully'
        : 'Deleted successfully',
      'Success'
    )
    showDeleteDialog.value = false
    showCascadeDeleteDialog.value = false
    cascadeDeleteMessage.value = ''
    currentRow.value = null
  } catch (error) {
    const conflict = getRelatedBookingsConflict(error)
    if (!cascadeRelated && conflict) {
      showDeleteDialog.value = false
      cascadeDeleteMessage.value = typeof conflict.message === 'string' && conflict.message.trim()
        ? conflict.message
        : 'This venue has related booking records. Do you also want to delete all related records?'
      showCascadeDeleteDialog.value = true
      return
    }
    showNotice(getErrorMessage(error, 'Failed to delete venue'), 'Error')
  }
}

const handleViewImage = async (row) => {
  if (row.image) {
    previewImageUrl.value = await loadProtectedAssetUrl(row.image)
    showImagePreview.value = true
  } else {
    showNotice('No image available', 'Notice')
  }
}

const handleExceed = () => {
  showNotice('Only one image is allowed', 'Warning')
}

const handleImageChange = (_file, fileList) => {
  // 强制只保留 1 张：若用户重复选择，保留最后一次选择的文件
  if (Array.isArray(fileList) && fileList.length > 1) {
    formData.value.imageList = fileList.slice(-1)
    return
  }
  formData.value.imageList = fileList
}

const handleImageRemove = () => {
  formData.value.imageList = []
  formData.value.image = ''
}

const resetBlockForm = () => {
  blockForm.value = {
    startAt: '',
    endAt: '',
    reason: ''
  }
}

const handleManageBlocks = (row) => {
  if (!Array.isArray(row.blocks)) row.blocks = []
  currentBlockVenue.value = row
  blockCurrentPage.value = 1
  resetBlockForm()
  showBlockDialog.value = true
  updateBlockTableMaxHeight()
}

const handleAddBlockPeriod = async () => {
  if (!currentBlockVenue.value) return
  if (!blockForm.value.startAt || !blockForm.value.endAt || !blockForm.value.reason) {
    showNotice('Please fill in Start, End and Reason', 'Warning')
    return
  }
  const startAtDate = new Date(blockForm.value.startAt.replace(' ', 'T'))
  const endAtDate = new Date(blockForm.value.endAt.replace(' ', 'T'))
  if (Number.isNaN(startAtDate.getTime()) || Number.isNaN(endAtDate.getTime())) {
    showNotice('Invalid date time format', 'Warning')
    return
  }
  if (endAtDate <= startAtDate) {
    showNotice('End datetime must be later than start datetime', 'Warning')
    return
  }
  try {
    const created = await createVenueBlock(currentBlockVenue.value.id, {
      startAt: new Date(blockForm.value.startAt.replace(' ', 'T')).toISOString(),
      endAt: new Date(blockForm.value.endAt.replace(' ', 'T')).toISOString(),
      reason: blockForm.value.reason
    })
    currentBlockVenue.value.blocks.push(created)
    blockCurrentPage.value = Math.max(1, Math.ceil(currentBlockVenue.value.blocks.length / blockPageSize.value))
    resetBlockForm()
    updateBlockTableMaxHeight()
    showNotice('Blocked period added', 'Success')
  } catch (error) {
    showNotice(getErrorMessage(error, 'Failed to add blocked period'), 'Error')
  }
}

const handleRemoveBlockPeriod = async (blockId) => {
  if (!currentBlockVenue.value) return
  try {
    await deleteVenueBlock(currentBlockVenue.value.id, blockId)
    const index = currentBlockVenue.value.blocks.findIndex(item => String(item.id) === String(blockId))
    if (index !== -1) {
      currentBlockVenue.value.blocks.splice(index, 1)
      updateBlockTableMaxHeight()
      showNotice('Blocked period removed', 'Success')
    }
  } catch (error) {
    showNotice(getErrorMessage(error, 'Failed to remove blocked period'), 'Error')
  }
}

function updateBlockTableMaxHeight () {
  nextTick(() => {
    const contentEl = blockModalContentRef.value
    const formEl = blockFormSectionRef.value?.$el || blockFormSectionRef.value
    const toolbarEl = blockToolbarRef.value
    const paginationEl = blockPaginationRef.value
    if (!contentEl || !formEl || !toolbarEl || !paginationEl) return
    const contentHeight = contentEl.clientHeight
    const reservedHeight = formEl.offsetHeight + toolbarEl.offsetHeight + paginationEl.offsetHeight + 18
    // 回收分页栏下方压缩出来的空间，优先给表格显示更多行
    const available = Math.max(180, contentHeight - reservedHeight + 16)
    blockTableMaxHeight.value = `${available}px`
  })
}

const handlePreview = (file) => {
  previewImageUrl.value = file.url || (file.raw ? URL.createObjectURL(file.raw) : '')
  showImagePreview.value = true
}
</script>

<style scoped>
.daily-booking-window-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: nowrap;
  width: 100%;
}

.daily-booking-window-row :deep(.el-date-editor) {
  width: 140px;
  flex: 0 0 140px;
}

.daily-booking-window-sep {
  color: #6b7280;
  font-size: 14px;
  flex: 0 0 auto;
  white-space: nowrap;
}

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
  border-radius: 0;
  overflow: hidden;
  box-shadow: none;
  font-size: 0.8125rem;
}

.page-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0.25rem 0.6rem 0.6rem;
  display: flex;
  flex-direction: column;
}

.page-content :deep(.el-tabs) {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.page-content :deep(.main-tabs) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.page-content :deep(.main-tabs > .el-tabs__content) {
  flex: 1;
  min-height: 0;
}

.page-content :deep(.main-tabs > .el-tabs__content > .el-tab-pane) {
  height: 100%;
  min-height: 0;
}

.page-content :deep(.sub-tabs) {
  flex: none;
}

.page-content :deep(.el-tabs__header) {
  margin-bottom: 0.35rem;
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

.page-content :deep(.el-table th.col-display-homepage-header),
.page-content :deep(.el-table th.col-display-homepage-header .cell) {
  white-space: normal;
  line-height: 1.25;
  text-align: center;
  padding-left: 0.25rem;
  padding-right: 0.25rem;
}

.display-homepage-header {
  display: inline-block;
  line-height: 1.25;
  font-size: 0.75rem;
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

.page-content :deep(.type-tag) {
  border-radius: 999px;
  font-weight: 600;
  padding: 0 10px;
}

.page-content :deep(.type-tag-conference) {
  background-color: #dbeafe;
  color: #1d4ed8;
}

 

.page-content :deep(.type-tag-other) {
  background-color: #dcfce7;
  color: #166534;
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
  gap: 0.75rem;
  min-height: 32px;
  align-items: center;
}

.block-period-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.block-modal-content {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin-bottom: -8px;
}

.block-form-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.block-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-end;
  margin-top: -10px;
  margin-bottom: 0.6rem;
}

.block-range-warning {
  margin-right: auto;
  color: #b91c1c;
  font-size: 0.8125rem;
  font-weight: 600;
}

.block-table-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.block-table-wrap :deep(.el-table) {
  width: 100% !important;
  max-width: 100%;
}

.block-pagination-bar {
  margin-top: auto;
  margin-bottom: 0;
  padding-bottom: 0;
}

.block-modal-content :deep(.el-textarea__inner) {
  overflow-y: auto;
  resize: none;
}

.venue-color-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.venue-color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid #d1d5db;
  display: inline-block;
}

.color-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.color-input-group :deep(.el-color-picker) {
  flex: 0 0 auto;
}

.color-input-group :deep(.el-input) {
  flex: 1;
}

/* 已有一张图时隐藏 picture-card 的触发器空框，不可点击 */
.venue-image-upload--full :deep(.el-upload.el-upload--picture-card) {
  display: none !important;
}

.venue-form :deep(.el-form-item__label) {
  white-space: nowrap;
}

.venue-form :deep(.el-form-item__content) {
  max-width: 92%;
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

.venue-list-pane {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
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

.action-block {
  background-color: #3b82f6 !important;
}

.action-block:hover {
  background-color: #2563eb !important;
}

.display-type-buttons {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.type-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 12px;
  border: 2px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  color: #6b7280;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
  min-width: 70px;
}

.type-btn:hover {
  border-color: #9ca3af;
  background: #f9fafb;
}

.type-btn-single.active {
  border-color: #16a34a;
  background: #dcfce7;
  color: #16a34a;
}

.type-btn-merge.active {
  border-color: #2563eb;
  background: #dbeafe;
  color: #2563eb;
}

.page-content :deep(.tea-service-tag-yes) {
  border-radius: 999px;
  font-weight: 600;
  padding: 0 10px;
  background-color: #dcfce7;
  color: #166534;
}

.page-content :deep(.tea-service-tag-no) {
  border-radius: 999px;
  font-weight: 600;
  padding: 0 10px;
  background-color: #f3f4f6;
  color: #6b7280;
}

.status-badge {
  padding: 0.1875rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 600;
  white-space: nowrap;
  display: inline-block;
  box-sizing: border-box;
  text-align: center;
}

.badge-display-homepage-yes {
  background-color: #dcfce7;
  color: #166534;
}

.badge-display-homepage-no {
  background-color: #f3f4f6;
  color: #6b7280;
}

.display-homepage-badge {
  width: auto;
  min-width: 0;
  padding: 0.125rem 0.4375rem;
  text-align: center;
}

.page-content :deep(.display-tag-single) {
  border-radius: 999px;
  font-weight: 600;
  padding: 0 10px;
  background-color: #dcfce7;
  color: #16a34a;
}

.page-content :deep(.display-tag-merge) {
  border-radius: 999px;
  font-weight: 600;
  padding: 0 10px;
  background-color: #dbeafe;
  color: #2563eb;
}

.notice-message {
  margin: 0;
  font-size: 15px;
  color: #374151;
  line-height: 1.6;
}

:deep(.venue-notice-modal.modal-overlay) {
  z-index: 12000 !important;
}

:deep(.venue-notice-modal .booking-dialog-wrapper) {
  z-index: 12001 !important;
}
</style>
