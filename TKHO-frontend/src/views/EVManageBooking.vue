<template>
  <div class="page h-screen bg-[#f5f5f5] flex flex-col overflow-hidden" style="padding-top: var(--app-header-height, 64px);">
    <AppHeader />

    <main class="flex-1 flex flex-col px-2 md:px-3 lg:px-4 py-1 md:py-2 pb-1 overflow-hidden">
      <!-- Toolbar -->
      <div class="toolbar bg-white rounded-lg shadow-sm p-3 mb-1 flex items-center justify-between gap-3">
        <div class="toolbar-left flex items-center gap-3">
          <!-- Admin View Switcher (only for admin) -->
          <div v-if="isAdmin" class="view-switcher-wrapper">
            <div class="view-switcher">
              <button
                :class="['view-switch-btn', { active: bookingView === 'my' }]"
                @click="bookingView = 'my'"
              >
                My Bookings
              </button>
              <button
                :class="['view-switch-btn', { active: bookingView === 'all' }]"
                @click="bookingView = 'all'"
              >
                All Bookings
              </button>
            </div>
          </div>

          <!-- Status Filter -->
          <div class="status-filter-wrapper">
            <button class="status-filter-btn" @click="toggleStatusFilter">
              {{ statusFilterLabel }}
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="arrow-icon">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            <!-- Status filter dropdown -->
            <div v-if="showStatusFilter" class="status-filter-dropdown" @click.stop>
              <div class="status-filter-header">
                <span class="filter-title">Show bookings:</span>
              </div>
              <div class="status-filter-body">
                <label class="status-checkbox">
                  <input type="checkbox" v-model="statusFilters.upcoming" />
                  <span>Upcoming</span>
                </label>
                <label class="status-checkbox">
                  <input type="checkbox" v-model="statusFilters.past" />
                  <span>Past</span>
                </label>
                <label class="status-checkbox">
                  <input type="checkbox" v-model="statusFilters.cancelled" />
                  <span>Cancelled</span>
                </label>
                <label class="status-checkbox select-all-option">
                  <input type="checkbox" v-model="allStatusesSelected" />
                  <span>Select All</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Date Range Filter -->
          <div class="date-filter-wrapper">
            <button class="date-filter-btn" @click="toggleDateFilter">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="calendar-icon">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span>{{ dateFilterLabel }}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="arrow-icon">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            <!-- Date filter dropdown -->
            <div v-if="showDateFilter" class="date-filter-dropdown" @click.stop>
              <div class="date-filter-header">
                <span class="filter-title">Select date range:</span>
                <button v-if="dateRange" class="clear-all-btn" @click="clearDateFilter" title="Clear filter">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div class="date-filter-body">
                <!-- Quick date range options -->
                <div class="quick-date-options">
                  <button
                    v-for="option in quickDateOptions"
                    :key="option.label"
                    class="quick-date-btn"
                    :class="{ active: isQuickDateActive(option) }"
                    @click="selectQuickDate(option)"
                  >
                    {{ option.label }}
                  </button>
                </div>

                <!-- Custom date range picker -->
                <div class="custom-date-section">
                  <div class="custom-date-label">Custom Range:</div>
                  <el-date-picker
                    v-model="dateRange"
                    type="daterange"
                    :teleported="false"
                    range-separator="to"
                    start-placeholder="Start date"
                    end-placeholder="End date"
                    format="DD/MM/YYYY"
                    value-format="YYYY-MM-DD"
                    class="date-range-picker"
                    size="default"
                    :clearable="true"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Search -->
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Search by license plate, space or date"
            class="search-input"
          />
        </div>

        <div class="toolbar-right flex items-center gap-2">
          <div v-if="isAdminAllBookingsView" class="export-excel-wrapper">
            <button
              type="button"
              class="export-excel-btn"
              :class="{ active: showExportMenu }"
              :disabled="exportingExcel"
              @click="toggleExportMenu"
            >
              <font-awesome-icon :icon="['fas', 'file-excel']" />
              <span>{{ exportingExcel ? 'Exporting...' : 'Export Excel' }}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="arrow-icon">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            <div v-if="showExportMenu" class="export-excel-dropdown" @click.stop>
              <div class="export-excel-header">
                <span class="filter-title">Export to Excel</span>
              </div>
              <div class="export-excel-body">
                <button
                  type="button"
                  class="export-option-btn export-option-btn--primary"
                  :disabled="exportingExcel"
                  @click="handleExportExcel('current')"
                >
                  <span class="export-option-text">
                    <span class="export-option-label">Current filters</span>
                    <span class="export-option-desc">{{ currentExportDescription }}</span>
                  </span>
                  <span class="export-option-count">{{ exportOptionCounts.current }}</span>
                </button>

                <div class="export-section-label">Quick date ranges</div>
                <p class="export-section-hint">Date range only.</p>
                <div class="export-quick-options">
                  <button
                    v-for="option in quickDateOptions"
                    :key="option.value"
                    type="button"
                    class="export-quick-btn"
                    :disabled="exportingExcel"
                    @click="handleExportExcel('quick', option.value)"
                  >
                    <span>{{ option.label }}</span>
                    <span class="export-option-count export-option-count--compact">{{ exportOptionCounts[option.value] }}</span>
                  </button>
                </div>

                <button
                  type="button"
                  class="export-option-btn"
                  :disabled="exportingExcel"
                  @click="handleExportExcel('allDates')"
                >
                  <span class="export-option-text">
                    <span class="export-option-label">All dates</span>
                  </span>
                  <span class="export-option-count">{{ exportOptionCounts.allDates }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- View Switcher -->
          <button
            :class="['view-toggle-btn', { active: currentView === 'card' }]"
            @click="currentView = 'card'"
            title="Card View"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
            </svg>
          </button>
          <button
            :class="['view-toggle-btn', { active: currentView === 'table' }]"
            @click="currentView = 'table'"
            title="Table View"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- Content Area -->
      <div class="content-area flex-1 overflow-hidden flex flex-col">
        <!-- Card View -->
        <div v-if="currentView === 'card'" v-loading="bookingsLoading" class="card-view flex-1 overflow-y-auto">
          <div class="cards-grid">
            <div
              v-for="booking in paginatedBookings"
              :key="booking.id"
              class="booking-card"
              :class="'status-' + booking.status"
            >
              <div class="card-header">
                <h3 class="card-title">{{ booking.licensePlate }}</h3>
                <span :class="['status-badge', 'badge-' + booking.status]">
                  {{ formatStatus(booking.status) }}
                </span>
              </div>
              <div class="card-body">
                <div class="card-row">
                  <span class="card-label">EV Space</span>
                  <span class="card-value">{{ booking.space }}</span>
                </div>
                <div class="card-row">
                  <span class="card-label">Booking Date</span>
                  <span class="card-value">{{ booking.date }}</span>
                </div>
                <div class="card-row">
                  <span class="card-label">Time</span>
                  <span class="card-value">{{ booking.time }}</span>
                </div>
                <div class="card-row">
                  <span class="card-label">Application Date</span>
                  <span class="card-value">{{ formatApplicationDateTime(booking) }}</span>
                </div>
              </div>
              <div class="card-footer">
                <button
                  v-if="canShowEditButton(booking)"
                  class="btn-edit"
                  @click="editBooking(booking.id)"
                >
                  Edit
                </button>
                <button
                  v-if="canShowCancelButton(booking)"
                  class="btn-cancel"
                  @click="cancelBooking(booking.id)"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Table View -->
        <div v-else v-loading="bookingsLoading" class="table-view flex-1 overflow-hidden">
          <div
            ref="tableWrapperRef"
            class="table-wrapper"
            :class="{
              'is-scrolled-left': tableScrolledLeft,
              'is-scrolled-right': tableScrolledRight
            }"
            @scroll="updateTableScrollShadows"
          >
            <table class="bookings-table">
              <thead>
                <tr>
                  <th class="col-no">#</th>
                  <th class="col-datetime">
                    <button type="button" class="th-sort-btn" @click="toggleSort('bookingDateTime')">
                      Booking Date & Time
                      <span class="sort-indicator">{{ getSortIndicator('bookingDateTime') }}</span>
                    </button>
                  </th>
                  <th>
                    <SortableFilterHeader
                      v-if="isAdmin"
                      label="License Plate"
                      :sort-indicator="getSortIndicator('licensePlate')"
                      :filter-active="columnFilterState.licensePlate.length > 0"
                      :options="getFilterOptions('licensePlate')"
                      :model-value="columnFilterState.licensePlate"
                      @sort-asc="setSortByMenu('licensePlate', 'asc')"
                      @sort-desc="setSortByMenu('licensePlate', 'desc')"
                      @clear-sort="clearSortByMenu('licensePlate')"
                      @update:model-value="(v) => updateFilter('licensePlate', v)"
                    />
                    <span v-else>License Plate</span>
                  </th>
                  <th>
                    <SortableFilterHeader
                      v-if="isAdmin"
                      label="EV Space"
                      :sort-indicator="getSortIndicator('space')"
                      :filter-active="columnFilterState.space.length > 0"
                      :options="getFilterOptions('space')"
                      :model-value="columnFilterState.space"
                      @sort-asc="setSortByMenu('space', 'asc')"
                      @sort-desc="setSortByMenu('space', 'desc')"
                      @clear-sort="clearSortByMenu('space')"
                      @update:model-value="(v) => updateFilter('space', v)"
                    />
                    <span v-else>EV Space</span>
                  </th>
                  <th v-if="isAdminAllBookingsView">
                    <SortableFilterHeader
                      label="Reserved By"
                      :sort-indicator="getSortIndicator('reservedBy')"
                      :filter-active="columnFilterState.reservedBy.length > 0"
                      :options="getFilterOptions('reservedBy')"
                      :model-value="columnFilterState.reservedBy"
                      @sort-asc="setSortByMenu('reservedBy', 'asc')"
                      @sort-desc="setSortByMenu('reservedBy', 'desc')"
                      @clear-sort="clearSortByMenu('reservedBy')"
                      @update:model-value="(v) => updateFilter('reservedBy', v)"
                    />
                  </th>
                  <th>
                    <SortableFilterHeader
                      v-if="isAdmin"
                      label="Status"
                      :sort-indicator="getSortIndicator('status')"
                      :filter-active="columnFilterState.status.length > 0"
                      :options="getFilterOptions('status')"
                      :model-value="columnFilterState.status"
                      @sort-asc="setSortByMenu('status', 'asc')"
                      @sort-desc="setSortByMenu('status', 'desc')"
                      @clear-sort="clearSortByMenu('status')"
                      @update:model-value="(v) => updateFilter('status', v)"
                    />
                    <span v-else>Status</span>
                  </th>
                  <th v-if="isAdminAllBookingsView">
                    <SortableFilterHeader
                      label="Submitted By"
                      :sort-indicator="getSortIndicator('submitter')"
                      :filter-active="columnFilterState.submitter.length > 0"
                      :options="getFilterOptions('submitter')"
                      :model-value="columnFilterState.submitter"
                      @sort-asc="setSortByMenu('submitter', 'asc')"
                      @sort-desc="setSortByMenu('submitter', 'desc')"
                      @clear-sort="clearSortByMenu('submitter')"
                      @update:model-value="(v) => updateFilter('submitter', v)"
                    />
                  </th>
                  <th class="col-application-date">
                    <button type="button" class="th-sort-btn" @click="toggleSort('applicationDate')">
                      Application Date
                      <span class="sort-indicator">{{ getSortIndicator('applicationDate') }}</span>
                    </button>
                  </th>
                  <th class="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(booking, index) in paginatedBookings" :key="booking.id">
                  <td class="no-cell">{{ startIndex + index + 1 }}</td>
                  <td class="datetime-cell">
                    <div class="date">{{ booking.date }}</div>
                    <div class="time">{{ booking.time }}</div>
                  </td>
                  <td class="license-cell">{{ booking.licensePlate }}</td>
                  <td>{{ booking.space }}</td>
                  <td v-if="isAdminAllBookingsView">{{ booking.reservedBy || '-' }}</td>
                  <td>
                    <span :class="['status-badge', 'badge-' + booking.status]">
                      {{ formatStatus(booking.status) }}
                    </span>
                  </td>
                  <td v-if="isAdminAllBookingsView">{{ booking.submitter || '-' }}</td>
                  <td class="application-date-cell">{{ formatApplicationDateTime(booking) }}</td>
                  <td class="actions-td">
                    <div class="actions-cell">
                      <button
                        v-if="canShowEditButton(booking)"
                        type="button"
                        class="btn-action btn-edit"
                        @click="editBooking(booking.id)"
                      >
                        Edit
                      </button>
                      <button
                        v-if="canShowCancelButton(booking)"
                        class="btn-action btn-cancel-small"
                        @click="cancelBooking(booking.id)"
                      >
                        Cancel
                      </button>
                      <span v-if="!canShowEditButton(booking) && !canShowCancelButton(booking)">-</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Pagination -->
        <div class="pagination-bar">
          <div class="pagination-info">
            Showing {{ bookingsTotal ? startIndex + 1 : 0 }}-{{ endIndex }} of {{ bookingsTotal }} bookings
          </div>
          <div class="pagination-controls">
            <button
              class="pagination-btn"
              :disabled="currentPage === 1 || bookingsLoading"
              @click="goBookingsPage(currentPage - 1)"
            >
              Previous
            </button>
            <button
              v-for="page in visiblePages"
              :key="page"
              :class="['pagination-btn', 'page-number', { active: page === currentPage }]"
              @click="goBookingsPage(page)"
            >
              {{ page }}
            </button>
            <button
              class="pagination-btn"
              :disabled="currentPage === totalPages || bookingsLoading"
              @click="goBookingsPage(currentPage + 1)"
            >
              Next
            </button>
          </div>
          <div class="pagination-size">
            <select v-model="pageSize" class="page-size-select">
              <option :value="10">10 / page</option>
              <option :value="20">20 / page</option>
              <option :value="50">50 / page</option>
            </select>
          </div>
        </div>
      </div>
    </main>

    <!-- Cancel booking confirmation -->
    <BookingStyleModal
      v-model="showCancelDialog"
      title="Cancel Booking"
      max-width="500px"
    >
      <p class="cancel-confirm-message">
        Are you sure you want to cancel this EV booking? This action cannot be undone.
      </p>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="showCancelDialog = false">No</el-button>
        <el-button
          type="default"
          class="action-btn action-confirm"
          @click="confirmCancel"
        >
          Confirm
        </el-button>
      </template>
    </BookingStyleModal>

    <BookingStyleModal v-model="showNoticeDialog" :title="noticeTitle" max-width="420px">
      <p class="notice-message">{{ noticeMessage }}</p>
      <template #footer>
        <el-button type="default" class="action-confirm" @click="showNoticeDialog = false">OK</el-button>
      </template>
    </BookingStyleModal>

    <EVBookingDialog
      :visible="editDialogVisible"
      mode="edit"
      :initial-booking="editInitialBooking"
      :time-periods="editTimePeriods"
      :available-slots="editAvailableSlots"
      :booking-window-start="editBookingWindow.currentStartDate"
      :booking-window-end="editBookingWindow.currentEndDate"
      :public-holiday-dates="editHolidayDates"
      :is-admin="true"
      :submitting="editSubmitting"
      :refresh-calendar-availability="loadEditCalendarAvailability"
      @close="closeEditDialog"
      @confirm="handleEditConfirm"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { cancelEvManageBooking, listEvManageBookings, updateEvManageBooking } from '@/api/evManagement'
import { getEvCalendarAvailability } from '@/api/parking'
import { fetchActiveEvTimePeriods } from '@/utils/evTimePeriods'
import { fetchEvBookingWindow } from '@/utils/evBookingWindow'
import { resolveEvVisibleBookingRange } from '@/utils/evBookingVisibleRange'
import { todayYmdInAppTimeZone } from '@/utils/appTimezone'
import { useHkPublicHolidays } from '@/composables/useHkPublicHolidays'
import { SILENT_ERROR } from '@/utils/requestOptions'
import AppHeader from '../components/AppHeader.vue'
import BookingStyleModal from '../components/BookingStyleModal.vue'
import EVBookingDialog from '../components/EVBookingDialog.vue'
import SortableFilterHeader from '@/components/admin/SortableFilterHeader.vue'
import * as XLSX from 'xlsx'

const userStore = useUserStore()
const { isAdmin } = storeToRefs(userStore)

const VIEW_PREFS_KEY = 'evManageBooking.viewPrefs'
const DEFAULT_STATUS_FILTERS = {
  upcoming: true,
  past: false,
  cancelled: false
}

function readViewPrefs () {
  try {
    const raw = localStorage.getItem(VIEW_PREFS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function restoreStatusFilters (saved) {
  if (!saved || typeof saved !== 'object') return { ...DEFAULT_STATUS_FILTERS }
  return {
    upcoming: Boolean(saved.upcoming),
    past: Boolean(saved.past),
    cancelled: Boolean(saved.cancelled)
  }
}

function restoreDateRange (saved) {
  if (!Array.isArray(saved) || saved.length !== 2) return null
  const [start, end] = saved
  if (typeof start !== 'string' || typeof end !== 'string') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return null
  return [start, end]
}

function writeViewPrefs () {
  try {
    localStorage.setItem(VIEW_PREFS_KEY, JSON.stringify({
      bookingView: bookingView.value,
      currentView: currentView.value,
      statusFilters: { ...statusFilters.value },
      dateRange: dateRange.value && dateRange.value.length === 2
        ? [...dateRange.value]
        : null
    }))
  } catch {
    /* ignore quota / private mode */
  }
}

const savedViewPrefs = readViewPrefs()
const currentView = ref(
  savedViewPrefs?.currentView === 'table' || savedViewPrefs?.currentView === 'card'
    ? savedViewPrefs.currentView
    : 'card'
)
const bookingView = ref(
  savedViewPrefs?.bookingView === 'all' || savedViewPrefs?.bookingView === 'my'
    ? savedViewPrefs.bookingView
    : 'my'
) // 'my' or 'all' - for admin to switch between personal and all bookings
const dateRange = ref(restoreDateRange(savedViewPrefs?.dateRange))
const statusFilters = ref(restoreStatusFilters(savedViewPrefs?.statusFilters))

watch([bookingView, currentView, statusFilters, dateRange], writeViewPrefs, { deep: true })

watch(isAdmin, (admin) => {
  if (!admin && bookingView.value === 'all') {
    bookingView.value = 'my'
  }
}, { immediate: true })

const isAdminAllBookingsView = computed(() => isAdmin.value && bookingView.value === 'all')
const searchQuery = ref('')
const showStatusFilter = ref(false)
const showDateFilter = ref(false)
const showExportMenu = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const sortState = ref([
  { key: 'bookingDateTime', order: 'asc' }
])
const columnFilterState = ref({
  licensePlate: [],
  space: [],
  status: [],
  submitter: [],
  reservedBy: []
})
const showCancelDialog = ref(false)
const cancelBookingId = ref(null)
const editDialogVisible = ref(false)
const editSubmitting = ref(false)
const editingBooking = ref(null)
const editTimePeriods = ref([])
const editAvailableSlots = ref({})
const editBookingWindow = ref({
  currentStartDate: '',
  currentEndDate: '',
  evDateUpdateTime: '13:00'
})
const editPrerequisitesLoaded = ref(false)
const { holidaysByDate: editHolidayDates, loadHolidays: loadEditHolidays } = useHkPublicHolidays()

const canShowEditButton = (booking) => {
  return isAdmin.value && String(booking?.status || '').toLowerCase() === 'upcoming'
}

const isSameDayEvBooking = (booking) => {
  const bookingYmd = String(booking?.bookingDateYmd || booking?.dateSortKey || '').trim()
  return Boolean(bookingYmd && bookingYmd === todayYmdInAppTimeZone())
}

const canShowCancelButton = (booking) => {
  if (String(booking?.status || '').toLowerCase() !== 'upcoming') return false
  if (isAdmin.value) return true
  return !isSameDayEvBooking(booking)
}

const SAME_DAY_EV_CANCEL_MESSAGE =
  'Same-day EV bookings cannot be cancelled. Please contact an administrator to release your quota.'

const editInitialBooking = computed(() => {
  const booking = editingBooking.value
  if (!booking) return null
  return {
    reservedByUserId: booking.reservedByUserId || booking.employeeId || '',
    reservedBy: booking.reservedBy || '',
    reservedByCorpId: booking.corpId || '',
    licensePlateId: booking.licensePlateId || '',
    periodId: booking.periodId || '',
    bookingDateYmd: booking.bookingDateYmd || booking.dateSortKey || '',
    slotId: booking.slotId || '',
    space: booking.space || '',
    id: booking.id != null ? String(booking.id) : ''
  }
})
const showNoticeDialog = ref(false)
const noticeTitle = ref('Notice')
const noticeMessage = ref('')
const showNotice = (message, title = 'Notice') => {
  noticeTitle.value = title
  noticeMessage.value = message
  showNoticeDialog.value = true
}
const bookings = ref([])
const bookingsTotal = ref(0)
const bookingsLoading = ref(false)
const exportingExcel = ref(false)
const filterOptionsState = ref({
  licensePlate: [],
  space: [],
  status: ['upcoming', 'past', 'cancelled'],
  submitter: [],
  reservedBy: []
})
let searchReloadTimer = null
let suppressBookingsReload = false

function normalizeManageListResponse (payload) {
  if (Array.isArray(payload?.items)) {
    return {
      items: payload.items,
      total: Number(payload.total) || payload.items.length,
      filterOptions: payload.filterOptions || null
    }
  }
  if (Array.isArray(payload?.bookings)) {
    return {
      items: payload.bookings,
      total: Number(payload.total) || payload.bookings.length,
      filterOptions: payload.filterOptions || null
    }
  }
  return { items: [], total: 0, filterOptions: null }
}

function buildEvListParams ({ includeOptions = false, all = false, dateOnly = false, dateRangeOverride = undefined } = {}) {
  const scope = isAdmin.value && bookingView.value === 'all' ? 'all' : 'my'
  const primarySort = sortState.value?.[0]
  const activeStatuses = Object.keys(statusFilters.value).filter((key) => statusFilters.value[key])
  const range = dateRangeOverride === undefined ? dateRange.value : dateRangeOverride
  const params = {
    scope,
    page: currentPage.value,
    pageSize: pageSize.value,
    q: dateOnly ? undefined : (searchQuery.value || undefined),
    sortBy: primarySort?.key,
    sortOrder: primarySort?.order === 'asc' ? 'asc' : 'desc',
    statuses: dateOnly
      ? undefined
      : (activeStatuses.length && activeStatuses.length < 3 ? activeStatuses.join(',') : undefined),
    licensePlates: (!dateOnly && columnFilterState.value.licensePlate?.length)
      ? columnFilterState.value.licensePlate.join(',')
      : undefined,
    spaces: (!dateOnly && columnFilterState.value.space?.length)
      ? columnFilterState.value.space.join(',')
      : undefined,
    reservedBy: (!dateOnly && columnFilterState.value.reservedBy?.length)
      ? columnFilterState.value.reservedBy.join(',')
      : undefined,
    submitters: (!dateOnly && columnFilterState.value.submitter?.length)
      ? columnFilterState.value.submitter.join(',')
      : undefined,
    includeOptions: includeOptions ? 1 : undefined,
    all: all ? 1 : undefined
  }
  if (range && range.length === 2) {
    params.dateFrom = range[0]
    params.dateTo = range[1]
  }
  return params
}

const applyDateRangeToBookings = (result, range) => {
  if (!range || range.length !== 2) return result
  const [startDate, endDate] = range
  return result.filter((b) => {
    const bookingDate = b.dateSortKey
      ? new Date(`${b.dateSortKey}T12:00:00`)
      : parseDate(b.date)
    const start = new Date(startDate)
    const end = new Date(endDate)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    return bookingDate >= start && bookingDate <= end
  })
}

const buildFilteredBookings = (options = {}) => {
  const {
    dateRange: dateRangeOption,
    dateOnly = false,
  } = options

  let result = bookings.value

  if (dateOnly) {
    if (dateRangeOption && dateRangeOption.length === 2) {
      result = applyDateRangeToBookings(result, dateRangeOption)
    }
    return result
  }

  const activeStatuses = Object.keys(statusFilters.value).filter(key => statusFilters.value[key])
  if (activeStatuses.length > 0 && activeStatuses.length < 3) {
    result = result.filter(b => activeStatuses.includes(b.status))
  }

  const rangeToApply = dateRangeOption === undefined ? dateRange.value : dateRangeOption
  if (rangeToApply && rangeToApply.length === 2) {
    result = applyDateRangeToBookings(result, rangeToApply)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(b =>
      b.licensePlate.toLowerCase().includes(query) ||
      b.space.toLowerCase().includes(query) ||
      b.date.toLowerCase().includes(query)
    )
  }

  if (isAdmin.value) {
    if (columnFilterState.value.licensePlate.length) {
      const selected = new Set(columnFilterState.value.licensePlate)
      result = result.filter((b) => selected.has(b.licensePlate || ''))
    }
    if (columnFilterState.value.space.length) {
      const selected = new Set(columnFilterState.value.space)
      result = result.filter((b) => selected.has(b.space || ''))
    }
    if (columnFilterState.value.status.length) {
      const selected = new Set(columnFilterState.value.status)
      result = result.filter((b) => selected.has(b.status || ''))
    }
  }
  if (columnFilterState.value.reservedBy.length) {
    const selected = new Set(columnFilterState.value.reservedBy)
    result = result.filter((b) => selected.has(b.reservedBy || ''))
  }
  if (columnFilterState.value.submitter.length) {
    const selected = new Set(columnFilterState.value.submitter)
    result = result.filter((b) => selected.has(b.submitter || ''))
  }

  return result
}

const filteredBookings = computed(() => bookings.value)

// Helper function to parse date string "28 Mar 2026" to Date object
const parseDate = (dateStr) => {
  const months = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  }
  const parts = dateStr.split(' ')
  const day = parseInt(parts[0])
  const month = months[parts[1]]
  const year = parseInt(parts[2])
  return new Date(year, month, day)
}

const parseSubmittedAt = (dateTimeStr) => {
  if (!dateTimeStr) return new Date(0)
  const parts = String(dateTimeStr).trim().split(' ')
  if (parts.length < 4) return parseDate(dateTimeStr)
  const datePart = `${parts[0]} ${parts[1]} ${parts[2]}`
  const [h = '0', m = '0'] = (parts[3] || '').split(':')
  const date = parseDate(datePart)
  date.setHours(Number.parseInt(h, 10) || 0, Number.parseInt(m, 10) || 0, 0, 0)
  return date
}

const sortPeriodOrder = {
  AM: 1,
  PM: 2,
  Night: 3
}

const bookingDateMs = (booking) => {
  if (booking.dateSortKey) {
    return new Date(`${booking.dateSortKey}T12:00:00`).getTime()
  }
  return parseDate(booking.date).getTime()
}

const getSortValue = (booking, key) => {
  switch (key) {
    case 'bookingDateTime': {
      const dateTime = bookingDateMs(booking)
      const period = booking.time?.split(' ')?.[0] || ''
      const periodOrder = sortPeriodOrder[period] ?? 99
      return dateTime * 100 + periodOrder
    }
    case 'licensePlate':
      return booking.licensePlate || ''
    case 'space':
      return booking.space || ''
    case 'applicationDate':
      return parseSubmittedAt(booking.submittedAt || booking.bookedOn).getTime()
    case 'reservedBy':
      return booking.reservedBy || ''
    case 'submitter':
      return booking.submitter || ''
    case 'status':
      return booking.status || ''
    default:
      return ''
  }
}

const ADMIN_ONLY_TABLE_COLUMN_KEYS = ['licensePlate', 'space', 'status']

const isAdminOnlyTableColumn = (key) => ADMIN_ONLY_TABLE_COLUMN_KEYS.includes(key)

const clearAdminOnlyColumnControls = () => {
  for (const key of ADMIN_ONLY_TABLE_COLUMN_KEYS) {
    columnFilterState.value[key] = []
  }
  sortState.value = sortState.value.filter((item) => !isAdminOnlyTableColumn(item.key))
}

const sortBookingsList = (list) => {
  const activeSort = isAdmin.value
    ? sortState.value
    : sortState.value.filter((item) => !isAdminOnlyTableColumn(item.key))
  if (!activeSort.length) return list.slice()
  return list.slice().sort((a, b) => {
    for (const criterion of activeSort) {
      const aValue = getSortValue(a, criterion.key)
      const bValue = getSortValue(b, criterion.key)
      const direction = criterion.order === 'asc' ? 1 : -1
      let cmp = 0
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        cmp = aValue - bValue
      } else {
        cmp = String(aValue).localeCompare(String(bValue), undefined, { sensitivity: 'base' })
      }
      if (cmp !== 0) return cmp * direction
    }
    return 0
  })
}

const sortedBookings = computed(() => bookings.value)

function reloadBookingsAfterControlChange () {
  currentPage.value = 1
  loadBookings({ includeOptions: true }).catch((e) => console.error(e))
}

const toggleSort = (key) => {
  if (!isAdmin.value && isAdminOnlyTableColumn(key)) return
  const idx = sortState.value.findIndex(item => item.key === key)
  if (idx === -1) {
    sortState.value = [{ key, order: 'asc' }]
  } else if (sortState.value[idx].order === 'asc') {
    sortState.value = [{ key, order: 'desc' }]
  } else {
    sortState.value = []
  }
  reloadBookingsAfterControlChange()
}

const getSortIndicator = (key) => {
  const idx = sortState.value.findIndex(item => item.key === key)
  if (idx === -1) return '↕'
  return sortState.value[idx].order === 'asc' ? '▲' : '▼'
}

const setSortByMenu = (key, order) => {
  if (!isAdmin.value && isAdminOnlyTableColumn(key)) return
  sortState.value = [{ key, order }]
  reloadBookingsAfterControlChange()
}

const clearSortByMenu = (key) => {
  sortState.value = sortState.value.filter(item => item.key !== key)
  reloadBookingsAfterControlChange()
}

const getFilterOptions = (key) => filterOptionsState.value[key] || []

const updateFilter = (key, value) => {
  if (!isAdmin.value && isAdminOnlyTableColumn(key)) return
  columnFilterState.value[key] = Array.isArray(value) ? [...value] : []
  reloadBookingsAfterControlChange()
}

watch(isAdmin, (admin) => {
  if (admin) return
  clearAdminOnlyColumnControls()
}, { immediate: true })

// Status filter label
const statusFilterLabel = computed(() => {
  const activeStatuses = Object.keys(statusFilters.value).filter(key => statusFilters.value[key])
  if (activeStatuses.length === 3) {
    return 'All Status'
  } else if (activeStatuses.length === 0) {
    return 'No status selected'
  } else if (activeStatuses.length === 1) {
    return formatStatus(activeStatuses[0])
  } else {
    return `${activeStatuses.length} statuses`
  }
})

const allStatusesSelected = computed({
  get: () => Object.values(statusFilters.value).every(Boolean),
  set: (checked) => {
    statusFilters.value = {
      upcoming: checked,
      past: checked,
      cancelled: checked
    }
  }
})

// Date filter label
const dateFilterLabel = computed(() => {
  if (!dateRange.value || dateRange.value.length !== 2) {
    return 'All dates'
  }
  const [start, end] = dateRange.value
  const startDate = new Date(start)
  const endDate = new Date(end)
  const formatDate = (date) => {
    const day = date.getDate()
    const month = date.toLocaleDateString('en-US', { month: 'short' })
    return `${day} ${month}`
  }
  return `${formatDate(startDate)} - ${formatDate(endDate)}`
})

// Pagination (server-side)
const totalPages = computed(() => Math.max(1, Math.ceil(bookingsTotal.value / pageSize.value)))

const startIndex = computed(() => {
  if (!bookingsTotal.value) return 0
  return (currentPage.value - 1) * pageSize.value
})
const endIndex = computed(() => Math.min(startIndex.value + bookings.value.length, bookingsTotal.value))

const paginatedBookings = computed(() => bookings.value)

const visiblePages = computed(() => {
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages.value, start + maxVisible - 1)

  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1)
  }

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  return pages
})

function goBookingsPage (page) {
  const next = Math.min(Math.max(1, page), totalPages.value)
  if (next === currentPage.value) return
  currentPage.value = next
  loadBookings({ includeOptions: false }).catch((e) => console.error(e))
}

watch(searchQuery, () => {
  if (searchReloadTimer) clearTimeout(searchReloadTimer)
  searchReloadTimer = setTimeout(() => {
    reloadBookingsAfterControlChange()
  }, 300)
})

watch([statusFilters, dateRange], () => {
  if (suppressBookingsReload) return
  reloadBookingsAfterControlChange()
}, { deep: true })

watch(pageSize, () => {
  reloadBookingsAfterControlChange()
})

const formatStatus = (status) => {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

const formatApplicationDateTime = (booking) => {
  return booking?.submittedAt || booking?.bookedOn || '-'
}

const buildExportFileName = (range, label = '') => {
  const today = new Date().toISOString().split('T')[0]
  if (range && range.length === 2) {
    const [start, end] = range
    return `EV_All_Bookings_${start}_to_${end}.xlsx`
  }
  if (label) {
    const safeLabel = String(label).replace(/\s+/g, '_')
    return `EV_All_Bookings_${safeLabel}_${today}.xlsx`
  }
  return `EV_All_Bookings_${today}.xlsx`
}

const getExportRows = (mode, quickValue) => {
  if (mode === 'allDates') {
    return sortBookingsList(buildFilteredBookings({ dateOnly: true }))
  }
  if (mode === 'quick') {
    return sortBookingsList(buildFilteredBookings({
      dateRange: getQuickDateRange(quickValue),
      dateOnly: true,
    }))
  }
  return sortedBookings.value
}

const exportOptionCounts = computed(() => {
  // Exact counts require a separate full fetch; show current page total for "current".
  const counts = {
    current: bookingsTotal.value,
    allDates: '…'
  }
  for (const option of quickDateOptions) {
    counts[option.value] = '…'
  }
  return counts
})

const currentExportDescription = computed(() => {
  const parts = [dateFilterLabel.value, statusFilterLabel.value]
  if (searchQuery.value.trim()) {
    parts.push(`Search: "${searchQuery.value.trim()}"`)
  }
  return parts.join(' · ')
})

const closeExportMenu = () => {
  showExportMenu.value = false
  document.removeEventListener('click', handleExportMenuClickOutside)
}

const toggleExportMenu = (event) => {
  event.stopPropagation()
  if (exportingExcel.value) return

  showExportMenu.value = !showExportMenu.value
  showStatusFilter.value = false
  showDateFilter.value = false
  document.removeEventListener('click', handleStatusFilterClickOutside)
  document.removeEventListener('click', handleDateFilterClickOutside)

  if (showExportMenu.value) {
    setTimeout(() => {
      document.addEventListener('click', handleExportMenuClickOutside, { once: false })
    }, 0)
  } else {
    closeExportMenu()
  }
}

const handleExportMenuClickOutside = (event) => {
  const dropdown = document.querySelector('.export-excel-dropdown')
  const trigger = event.target.closest('.export-excel-wrapper')
  if (!dropdown?.contains(event.target) && !trigger) {
    closeExportMenu()
  }
}

const handleExportExcel = async (mode = 'current', quickValue) => {
  if (!isAdminAllBookingsView.value) return

  let fileName = buildExportFileName()
  let listParams
  if (mode === 'allDates') {
    fileName = buildExportFileName(null, 'All_Dates')
    listParams = buildEvListParams({ all: true, dateOnly: true, dateRangeOverride: null })
  } else if (mode === 'quick') {
    const quickOption = quickDateOptions.find((option) => option.value === quickValue)
    const quickRange = getQuickDateRange(quickValue)
    fileName = buildExportFileName(quickRange, quickOption?.label)
    listParams = buildEvListParams({ all: true, dateOnly: true, dateRangeOverride: quickRange })
  } else {
    if (dateRange.value && dateRange.value.length === 2) {
      fileName = buildExportFileName(dateRange.value)
    }
    listParams = buildEvListParams({ all: true })
  }

  exportingExcel.value = true
  closeExportMenu()
  try {
    const data = await listEvManageBookings(listParams)
    const rows = normalizeManageListResponse(data).items
    if (!rows.length) {
      showNotice('No bookings match the selected export range. Try another option.', 'Export Excel')
      return
    }
    const exportData = rows.map((booking, index) => ({
      '#': index + 1,
      'Booking ID': booking.id ?? '',
      'Booking Date': booking.date || '',
      'Booking Time': booking.time || '',
      'License Plate': booking.licensePlate || '',
      'EV Space': booking.space || '',
      'Reserved By': booking.reservedBy || '',
      'Status': formatStatus(booking.status || ''),
      'Submitted By': booking.submitter || '',
      'Application Date': formatApplicationDateTime(booking),
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'All Bookings')
    XLSX.writeFile(wb, fileName)
    showNotice(`Exported ${rows.length} booking${rows.length === 1 ? '' : 's'} to Excel.`, 'Success')
  } catch (error) {
    showNotice(getErrorMessage(error, 'Failed to export Excel file'), 'Error')
  } finally {
    exportingExcel.value = false
  }
}

// Toggle status filter
const toggleStatusFilter = (event) => {
  event.stopPropagation()
  closeExportMenu()
  showStatusFilter.value = !showStatusFilter.value

  if (showStatusFilter.value) {
    setTimeout(() => {
      document.addEventListener('click', handleStatusFilterClickOutside, { once: false })
    }, 0)
  } else {
    document.removeEventListener('click', handleStatusFilterClickOutside)
  }
}

// Click outside to close status filter
const handleStatusFilterClickOutside = (event) => {
  const dropdown = document.querySelector('.status-filter-dropdown')
  const filterBtn = event.target.closest('.status-filter-wrapper')

  if (!dropdown?.contains(event.target) && !filterBtn) {
    showStatusFilter.value = false
    document.removeEventListener('click', handleStatusFilterClickOutside)
  }
}

// Toggle date filter
const toggleDateFilter = (event) => {
  event.stopPropagation()
  closeExportMenu()
  showDateFilter.value = !showDateFilter.value

  if (showDateFilter.value) {
    setTimeout(() => {
      document.addEventListener('click', handleDateFilterClickOutside, { once: false })
    }, 0)
  } else {
    document.removeEventListener('click', handleDateFilterClickOutside)
  }
}

// Click outside to close date filter
const handleDateFilterClickOutside = (event) => {
  const dropdown = document.querySelector('.date-filter-dropdown')
  const filterBtn = event.target.closest('.date-filter-wrapper')

  // Check if click is inside el-date-picker popup
  const datePickerPopup = document.querySelector('.el-picker__popper')
  if (datePickerPopup && datePickerPopup.contains(event.target)) {
    return
  }

  if (!dropdown?.contains(event.target) && !filterBtn) {
    showDateFilter.value = false
    document.removeEventListener('click', handleDateFilterClickOutside)
  }
}

// Clear date filter
const clearDateFilter = () => {
  dateRange.value = null
}

// Quick date options
const quickDateOptions = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Last Month', value: 'lastMonth' },
  { label: 'This Year', value: 'thisYear' },
  { label: 'Last Year', value: 'lastYear' }
]

// Get date range for quick options
const getQuickDateRange = (option) => {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  switch (option) {
    case 'today':
      return [formatDateToString(today), formatDateToString(today)]

    case 'yesterday': {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      return [formatDateToString(yesterday), formatDateToString(yesterday)]
    }

    case 'thisMonth': {
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)
      return [formatDateToString(firstDay), formatDateToString(lastDay)]
    }

    case 'lastMonth': {
      const firstDay = new Date(year, month - 1, 1)
      const lastDay = new Date(year, month, 0)
      return [formatDateToString(firstDay), formatDateToString(lastDay)]
    }

    case 'thisYear': {
      const firstDay = new Date(year, 0, 1)
      const lastDay = new Date(year, 11, 31)
      return [formatDateToString(firstDay), formatDateToString(lastDay)]
    }

    case 'lastYear': {
      const firstDay = new Date(year - 1, 0, 1)
      const lastDay = new Date(year - 1, 11, 31)
      return [formatDateToString(firstDay), formatDateToString(lastDay)]
    }

    default:
      return null
  }
}

// Format date to YYYY-MM-DD string
const formatDateToString = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Select quick date option
const selectQuickDate = (option) => {
  const quickRange = getQuickDateRange(option.value)

  // If clicking the same option again, clear the filter
  if (isQuickDateActive(option)) {
    dateRange.value = null
  } else {
    dateRange.value = quickRange
  }
}

// Check if quick date option is active
const isQuickDateActive = (option) => {
  if (!dateRange.value || dateRange.value.length !== 2) return false
  const quickRange = getQuickDateRange(option.value)
  if (!quickRange) return false
  return dateRange.value[0] === quickRange[0] && dateRange.value[1] === quickRange[1]
}

const cancelBooking = (id) => {
  const booking = bookings.value.find((item) => String(item.id) === String(id))
  if (booking && !canShowCancelButton(booking)) {
    showNotice(SAME_DAY_EV_CANCEL_MESSAGE, 'Notice')
    return
  }
  cancelBookingId.value = id
  showCancelDialog.value = true
}

const getErrorMessage = (error, fallback = 'Operation failed') => {
  const message = error?.response?.data?.message
  if (Array.isArray(message)) return message[0] || fallback
  if (typeof message === 'string' && message.trim()) return message
  if (typeof error?.message === 'string' && error.message.trim()) return error.message
  return fallback
}

const loadBookings = async ({ includeOptions = true } = {}) => {
  bookingsLoading.value = true
  try {
    const data = await listEvManageBookings(buildEvListParams({ includeOptions }))
    const { items, total, filterOptions } = normalizeManageListResponse(data)
    bookings.value = items
    bookingsTotal.value = total
    if (filterOptions) {
      filterOptionsState.value = {
        licensePlate: Array.isArray(filterOptions.licensePlates) ? filterOptions.licensePlates : [],
        space: Array.isArray(filterOptions.spaces) ? filterOptions.spaces : [],
        status: ['upcoming', 'past', 'cancelled'],
        submitter: Array.isArray(filterOptions.submitters) ? filterOptions.submitters : [],
        reservedBy: Array.isArray(filterOptions.reservedBy) ? filterOptions.reservedBy : []
      }
    }
  } catch (error) {
    bookings.value = []
    bookingsTotal.value = 0
    showNotice(getErrorMessage(error, 'Failed to load bookings'), 'Error')
  } finally {
    bookingsLoading.value = false
  }
}

watch(bookingView, () => {
  closeExportMenu()
  if (isAdmin.value) {
    currentPage.value = 1
    void loadBookings({ includeOptions: true })
  }
})

const confirmCancel = async () => {
  const id = cancelBookingId.value
  if (id == null || id === '') {
    showCancelDialog.value = false
    return
  }
  try {
    await cancelEvManageBooking(String(id))
    showCancelDialog.value = false
    cancelBookingId.value = null
    await Promise.all([
      loadBookings(),
      userStore.refreshSessionUser()
    ])
    showNotice('EV booking cancelled successfully!', 'Success')
  } catch (error) {
    showNotice(getErrorMessage(error, 'Failed to cancel booking'), 'Error')
  }
}

const loadEditCalendarAvailability = async () => {
  const { startYmd, endYmd } = resolveEvVisibleBookingRange(
    editBookingWindow.value.currentStartDate,
    editBookingWindow.value.currentEndDate,
    { evDateUpdateTime: editBookingWindow.value.evDateUpdateTime || '13:00' }
  )
  if (!startYmd || !endYmd) {
    editAvailableSlots.value = {}
    return false
  }
  try {
    const data = await getEvCalendarAvailability({
      startDate: startYmd,
      endDate: endYmd
    }, SILENT_ERROR)
    editAvailableSlots.value = data?.availability && typeof data.availability === 'object'
      ? { ...data.availability }
      : {}
    return true
  } catch {
    editAvailableSlots.value = {}
    return false
  }
}

const ensureEditDialogPrerequisites = async () => {
  if (editPrerequisitesLoaded.value) return
  editTimePeriods.value = await fetchActiveEvTimePeriods()
  editBookingWindow.value = await fetchEvBookingWindow()
  const { currentStartDate, currentEndDate } = editBookingWindow.value
  if (currentStartDate && currentEndDate) {
    await loadEditHolidays(currentStartDate, currentEndDate)
  }
  await loadEditCalendarAvailability()
  editPrerequisitesLoaded.value = true
}

const editBooking = async (id) => {
  const booking = bookings.value.find((item) => String(item.id) === String(id))
  if (!booking || !canShowEditButton(booking)) return
  try {
    await ensureEditDialogPrerequisites()
    editingBooking.value = booking
    editDialogVisible.value = true
  } catch (error) {
    showNotice(getErrorMessage(error, 'Failed to open edit dialog'), 'Error')
  }
}

const closeEditDialog = () => {
  editDialogVisible.value = false
  editingBooking.value = null
  void loadEditCalendarAvailability()
}

const handleEditConfirm = async (bookingData) => {
  const id = editingBooking.value?.id
  if (id == null || id === '' || editSubmitting.value) return
  editSubmitting.value = true
  try {
    await updateEvManageBooking(String(id), {
      licensePlateId: String(bookingData.licensePlateId),
      periodId: String(bookingData.timePeriod),
      bookingDate: bookingData.date,
      slotId: bookingData.slotId ? String(bookingData.slotId) : undefined,
      reservedByUserId: bookingData.reservedByUserId
        ? String(bookingData.reservedByUserId)
        : undefined
    })
    closeEditDialog()
    await loadBookings()
    showNotice('EV booking updated successfully!', 'Success')
  } catch (error) {
    showNotice(getErrorMessage(error, 'Failed to update booking'), 'Error')
  } finally {
    editSubmitting.value = false
  }
}

const tableWrapperRef = ref(null)
const tableScrolledLeft = ref(false)
const tableScrolledRight = ref(false)

const updateTableScrollShadows = () => {
  const el = tableWrapperRef.value
  if (!el) {
    tableScrolledLeft.value = false
    tableScrolledRight.value = false
    return
  }
  const maxScrollLeft = el.scrollWidth - el.clientWidth
  tableScrolledLeft.value = el.scrollLeft > 1
  tableScrolledRight.value = maxScrollLeft > 1 && el.scrollLeft < maxScrollLeft - 1
}

watch(
  [currentView, paginatedBookings],
  async () => {
    if (currentView.value !== 'table') return
    await nextTick()
    updateTableScrollShadows()
  },
  { deep: true }
)

onMounted(() => {
  window.addEventListener('resize', updateTableScrollShadows, { passive: true })
  void loadBookings()
  nextTick(() => updateTableScrollShadows())
})

onUnmounted(() => {
  window.removeEventListener('resize', updateTableScrollShadows)
})

</script>

<style scoped>
.cancel-confirm-message {
  margin: 0;
  font-size: 15px;
  line-height: 1.55;
  color: #374151;
}

.notice-message {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: #374151;
}

.action-confirm {
  background-color: #00723a;
  border-color: #00723a;
  color: #ffffff;
}

.action-confirm:hover {
  background-color: #005a2e;
  border-color: #005a2e;
  color: #ffffff;
}

.page {
  height: var(--zoom-vh);
  background: linear-gradient(135deg, #f8ecdd 0%, #f5e6d3 50%, #f8ecdd 100%);
  position: relative;
}

.toolbar {
  flex-shrink: 0;
}

/* Admin View Switcher */
.view-switcher-wrapper {
  position: relative;
}

.view-switcher {
  display: inline-flex;
  background: #f3f4f6;
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}

.view-switch-btn {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.view-switch-btn:hover {
  color: #374151;
}

.view-switch-btn.active {
  background: #ffffff;
  color: #00723a;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}


.search-input {
  padding: 0.375rem 0.625rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  color: #374151;
  min-width: 350px;
  flex: 1;
  max-width: 500px;
}

.search-input:focus {
  outline: none;
  border-color: #00723a;
}

/* Date Filter */
.date-filter-wrapper {
  position: relative;
  display: inline-block;
}

.date-filter-btn {
  padding: 0.375rem 0.625rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: white;
  color: #374151;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 160px;
}

.date-filter-btn .calendar-icon {
  color: #00723a;
  flex-shrink: 0;
}

.date-filter-btn .arrow-icon {
  transition: transform 0.2s;
  margin-left: auto;
  flex-shrink: 0;
}

.date-filter-btn:hover {
  background-color: #f3f4f6;
  border-color: #9ca3af;
}

.date-filter-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  z-index: 1000;
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  border: 2px solid #00723a;
  min-width: 320px;
  animation: slideDown 0.2s ease-out;
}

.date-filter-header {
  padding: 12px 16px;
  border-bottom: 2px solid #00723a;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
}

.date-filter-header .filter-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: #00723a;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-filter-header .filter-title::before {
  content: '';
  display: inline-block;
  width: 4px;
  height: 16px;
  background: #00723a;
  border-radius: 2px;
}

.clear-all-btn {
  padding: 0.375rem;
  border: none;
  background: #fee2e2;
  color: #ef4444;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
  width: 28px;
  height: 28px;
}

.clear-all-btn:hover {
  background-color: #fecaca;
}

.clear-all-btn svg {
  stroke-width: 3;
}

.date-filter-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quick-date-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.375rem;
}

.quick-date-btn {
  padding: 0.375rem 0.625rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: white;
  color: #374151;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
  line-height: 1.2;
}

.quick-date-btn:hover {
  background-color: #f0fdf4;
  border-color: #00723a;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.quick-date-btn.active {
  background: linear-gradient(135deg, #00723a 0%, #059669 100%);
  border-color: #00723a;
  color: white;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 114, 58, 0.3);
  transform: translateY(-1px);
}

.custom-date-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 2px solid #e5e7eb;
}

.custom-date-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #00723a;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.date-range-picker {
  width: 100%;
}

:deep(.el-date-editor) {
  width: 100%;
  border: 2px solid #d1d5db;
  border-radius: 0.375rem;
  transition: all 0.2s;
}

:deep(.el-date-editor:hover) {
  border-color: #00723a;
}

:deep(.el-date-editor.is-active) {
  border-color: #00723a;
  box-shadow: 0 0 0 3px rgba(0, 114, 58, 0.1);
}

:deep(.el-date-editor .el-range-input) {
  font-size: 0.8125rem;
  color: #111827;
}

:deep(.el-date-editor .el-range-separator) {
  font-size: 0.75rem;
  color: #00723a;
  font-weight: 600;
}

:deep(.el-date-editor .el-range__icon) {
  color: #00723a;
}

:deep(.el-date-editor .el-range__close-icon) {
  color: #ef4444;
}

.content-area {
  background-color: white;
  border-radius: 0.75rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  padding: 0.75rem;
}

/* Card View */
.card-view::-webkit-scrollbar {
  width: 8px;
}

.card-view::-webkit-scrollbar-track {
  background: #f3f4f6;
  border-radius: 4px;
}

.card-view::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 4px;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.75rem;
}

.booking-card {
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 0;
  background-color: white;
  transition: box-shadow 0.2s;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.booking-card.status-upcoming {
  border-left: 4px solid #00723a;
}

.booking-card.status-past {
  border-left: 4px solid #9ca3af;
}

.booking-card.status-cancelled {
  border-left: 4px solid #ef4444;
}

.booking-card:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0;
  gap: 0.5rem;
  background-color: #f3f4f6;
  padding: 0.5rem;
  margin: 0;
  border-bottom: 2px solid #d1d5db;
  flex-shrink: 0;
}

.card-title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
  flex: 1;
  line-height: 1.3;
}

.status-badge {
  padding: 0.1875rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 600;
  white-space: nowrap;
  display: inline-block;
  width: 4.5rem;
  box-sizing: border-box;
  text-align: center;
  flex-shrink: 0;
}

.badge-upcoming {
  background-color: #d1fae5;
  color: #065f46;
}

.badge-past {
  background-color: #e5e7eb;
  color: #4b5563;
}

.badge-cancelled {
  background-color: #fee2e2;
  color: #991b1b;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 0.3125rem;
  margin-bottom: 0;
  padding: 0.75rem;
  flex: 1;
}

.card-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
}

.card-label {
  color: #6b7280;
  font-weight: 500;
}

.card-value {
  color: #111827;
  font-weight: 400;
  text-align: right;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.3125rem;
  min-height: 0;
  align-items: flex-end;
  padding: 0 0.75rem 0.625rem 0.75rem;
  flex-shrink: 0;
  margin-top: auto;
}

.btn-cancel {
  background-color: #ef4444;
  color: white;
  padding: 0.1875rem 0.5rem;
  border-radius: 0.25rem;
  border: none;
  font-size: 0.625rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.card-footer .btn-edit {
  padding: 0.1875rem 0.5rem;
  border-radius: 0.25rem;
  border: none;
  font-size: 0.625rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-cancel:hover {
  background-color: #dc2626;
}

/* Status Filter */
.status-filter-wrapper {
  position: relative;
  display: inline-block;
}

.status-filter-btn {
  padding: 0.375rem 0.625rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: white;
  color: #374151;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 150px;
}

.status-filter-btn .arrow-icon {
  transition: transform 0.2s;
  margin-left: auto;
}

.status-filter-btn:hover {
  background-color: #f3f4f6;
  border-color: #9ca3af;
}

.status-filter-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  z-index: 1000;
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  border: 1px solid #e5e7eb;
  min-width: 200px;
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.status-filter-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.status-filter-header .filter-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #111827;
}

.status-filter-body {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.875rem;
  color: #374151;
}

.status-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #00723a;
}

.status-checkbox:hover {
  color: #00723a;
}

.select-all-option {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid #e5e7eb;
}

/* Pagination */
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.475rem 0.5rem 0.375rem;
  border-top: 1px solid #e5e7eb;
  background-color: white;
  flex-shrink: 0;
}

.pagination-info {
  font-size: 0.8125rem;
  color: #6b7280;
  margin-bottom: -8px;
}

.pagination-controls {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  margin-bottom: -8px;
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
  margin-bottom: -8px;
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

@media (max-width: 389px), (min-width: 390px) and (max-width: 767px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-left {
    width: 100%;
    justify-content: space-between;
  }

  .search-input {
    min-width: 0;
    flex: 1;
  }

  .cards-grid {
    grid-template-columns: 1fr;
  }

  .pagination-bar {
    flex-direction: column;
    gap: 0.75rem;
    align-items: stretch;
  }

  .pagination-controls {
    justify-content: center;
  }

  .pagination-info,
  .pagination-size {
    text-align: center;
  }
}

/* View Toggle Buttons */
.export-excel-wrapper {
  position: relative;
}

.export-excel-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: 34px;
  padding: 0 0.75rem;
  border: 1px solid #86c8a3;
  border-radius: 0.375rem;
  background: #f5fbf7;
  color: #14532d;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.export-excel-btn .arrow-icon {
  transition: transform 0.2s;
}

.export-excel-btn.active .arrow-icon {
  transform: rotate(180deg);
}

.export-excel-btn:hover:not(:disabled),
.export-excel-btn.active:not(:disabled) {
  background: #e8f6ee;
  border-color: #4ade80;
  color: #14532d;
}

.export-excel-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.export-excel-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  z-index: 1000;
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  border: 2px solid #00723a;
  min-width: 360px;
  animation: slideDown 0.2s ease-out;
}

.export-excel-header {
  padding: 12px 16px;
  border-bottom: 2px solid #00723a;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
}

.export-excel-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.export-section-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #166534;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.export-section-hint {
  margin: -0.35rem 0 0;
  font-size: 0.75rem;
  color: #6b7280;
  line-height: 1.4;
}

.export-option-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid #c7e5d4;
  border-radius: 0.5rem;
  background: #f8fdf9;
  color: #14532d;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.export-option-btn--primary {
  background: #ecfdf3;
  border-color: #86c8a3;
}

.export-option-btn:hover:not(:disabled) {
  background: #e8f6ee;
  border-color: #4ade80;
}

.export-option-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.export-option-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.export-option-label {
  font-size: 0.8125rem;
  font-weight: 700;
}

.export-option-desc {
  font-size: 0.75rem;
  color: #4b5563;
  line-height: 1.35;
}

.export-option-count {
  flex-shrink: 0;
  min-width: 1.75rem;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: #dcfce7;
  color: #166534;
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.export-option-count--compact {
  min-width: auto;
  flex-shrink: 0;
}

.export-quick-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.export-quick-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  color: #374151;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.export-quick-btn:hover:not(:disabled) {
  background: #f0fdf4;
  border-color: #86c8a3;
  color: #14532d;
}

.export-quick-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.view-toggle-btn {
  padding: 0.375rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: white;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.view-toggle-btn:hover {
  background-color: #f3f4f6;
  border-color: #9ca3af;
}

.view-toggle-btn.active {
  background-color: #00723a;
  border-color: #00723a;
  color: white;
}

/* Table View */
.table-view {
  position: relative;
}

.table-wrapper {
  overflow-x: auto;
  overflow-y: auto;
  height: 100%;
}

.table-view::-webkit-scrollbar,
.table-wrapper::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.table-view::-webkit-scrollbar-track,
.table-wrapper::-webkit-scrollbar-track {
  background: #f3f4f6;
  border-radius: 4px;
}

.table-view::-webkit-scrollbar-thumb,
.table-wrapper::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 4px;
}

.bookings-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.bookings-table thead {
  background-color: #f3f4f6;
  color: #374151;
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 2px solid #d1d5db;
}

.bookings-table th {
  padding: 0.5rem;
  text-align: left;
  font-weight: 600;
  white-space: nowrap;
  font-size: 0.8125rem;
}

.th-sort-btn {
  border: none;
  background: transparent;
  padding: 0;
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  color: inherit;
  font-weight: inherit;
  font-size: inherit;
  cursor: pointer;
}

.sort-indicator {
  font-size: 11px;
  color: #6b7280;
  line-height: 1;
}

.bookings-table th.col-datetime {
  width: 220px;
  min-width: 220px;
}

.bookings-table th.col-no {
  width: 50px;
  min-width: 50px;
  text-align: center;
  position: sticky;
  left: 0;
  top: 0;
  z-index: 12;
  background-color: #f3f4f6;
  box-shadow: none;
}

.table-wrapper.is-scrolled-left .bookings-table th.col-no,
.table-wrapper.is-scrolled-left .bookings-table .no-cell {
  box-shadow: 6px 0 8px -4px rgba(15, 23, 42, 0.12);
}

.bookings-table th.col-actions {
  width: 100px;
  min-width: 100px;
  text-align: center;
  position: sticky;
  right: 0;
  background-color: #f3f4f6;
  z-index: 11;
  box-shadow: none;
}

.table-wrapper.is-scrolled-right .bookings-table th.col-actions,
.table-wrapper.is-scrolled-right .bookings-table td.actions-td {
  box-shadow: -6px 0 8px -4px rgba(15, 23, 42, 0.12);
}

.bookings-table th.col-application-date,
.bookings-table td.application-date-cell {
  min-width: 180px;
  white-space: nowrap;
}

.bookings-table td {
  padding: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.bookings-table td.actions-td {
  position: sticky;
  right: 0;
  background-color: white;
  text-align: center;
  width: 100px;
  min-width: 100px;
}

.bookings-table tbody tr:hover td.actions-td {
  background-color: #f9fafb;
}

.bookings-table tbody tr:hover {
  background-color: #f9fafb;
}

.no-cell {
  text-align: center;
  color: #6b7280;
  font-weight: 500;
  position: sticky;
  left: 0;
  z-index: 8;
  background-color: #ffffff;
  box-shadow: none;
}

.bookings-table tbody tr:hover .no-cell {
  background-color: #f9fafb;
}

.license-cell {
  font-weight: 600;
  color: #111827;
}

.datetime-cell {
  white-space: nowrap;
}

.datetime-cell .date {
  font-weight: 500;
  color: #111827;
  font-size: 0.8125rem;
}

.datetime-cell .time {
  font-size: 0.75rem;
  color: #6b7280;
}

.actions-cell {
  display: flex;
  gap: 0.3125rem;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
}

.btn-action {
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  border: none;
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-cancel-small {
  background-color: #ef4444;
  color: white;
}

.btn-cancel-small:hover {
  background-color: #dc2626;
}

.btn-edit {
  background-color: #f97316;
  color: white;
}

.btn-edit:hover {
  background-color: #ea580c;
}
</style>
