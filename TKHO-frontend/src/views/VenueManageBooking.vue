<template>
  <div class="page h-screen bg-[#f5f5f5] flex flex-col overflow-hidden" style="padding-top: var(--app-header-height, 60px);">
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
          <div class="status-filter-wrapper" data-filter="booking-status">
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
            placeholder="Search by topic, room, date, reserved by or my note"
            class="search-input"
          />
        </div>

        <div class="toolbar-right flex items-center gap-2">
          <!-- Columns Filter (only show in table view) -->
          <div v-if="currentView === 'table'" class="columns-filter-wrapper">
            <button class="columns-filter-btn" @click="toggleColumnsFilter">
              Columns
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="arrow-icon">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            <!-- Columns filter dropdown -->
            <div v-if="showColumnsFilter" class="columns-filter-dropdown" @click.stop>
              <div class="columns-filter-header">
                <span class="filter-title">Show columns:</span>
              </div>
              <div class="columns-filter-body">
                <label v-for="col in columnsForTablePicker" :key="col.key" class="column-checkbox">
                  <input type="checkbox" v-model="col.visible" :disabled="col.required" />
                  <span>{{ col.label }}</span>
                </label>
                <label class="column-checkbox select-all-option">
                  <input type="checkbox" v-model="allColumnsSelected" />
                  <span>Select All</span>
                </label>
              </div>
            </div>
          </div>

          <div v-if="isAdminAllBookingsView" class="export-excel-wrapper">
            <button
              type="button"
              class="export-excel-btn"
              :class="{ active: showExportMenu }"
              :disabled="exportingExcel"
              title="Export Excel"
              @click="toggleExportMenu"
            >
              <font-awesome-icon :icon="['fas', 'file-excel']" />
              <span class="export-excel-label-full">{{ exportingExcel ? 'Exporting...' : 'Export Excel' }}</span>
              <span class="export-excel-label-short">{{ exportingExcel ? '…' : 'Excel' }}</span>
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
                <h3 class="card-title">{{ getCardTitle(booking) }}</h3>
                <div class="card-header-right">
                  <el-popover
                    placement="top"
                    :width="340"
                    trigger="hover"
                    :teleported="cardPopoverTeleported"
                    popper-class="booking-card-popover"
                  >
                    <template #reference>
                      <button type="button" class="card-info-btn" title="More info">i</button>
                    </template>
                    <div class="booking-popover-content">
                      <div class="booking-popover-row"><span class="popover-label">Meeting / Event</span><span class="popover-value">{{ booking.topic || '-' }}</span></div>
                      <div v-if="!isAdminAllBookingsView" class="booking-popover-row"><span class="popover-label">My Note</span><span class="popover-value">{{ booking.myNote || '-' }}</span></div>
                      <div class="booking-popover-row"><span class="popover-label">Reserved By</span><span class="popover-value">{{ formatBookingReservedByDisplay(booking) || '-' }}</span></div>
                      <div class="booking-popover-row"><span class="popover-label">Contact</span><span class="popover-value">{{ booking.contact || '-' }}</span></div>
                      <div class="booking-popover-row"><span class="popover-label">Email</span><span class="popover-value">{{ booking.email || '-' }}</span></div>
                      <div class="booking-popover-row"><span class="popover-label">Tea Service</span><span class="popover-value">{{ formatTeaServiceStatus(booking) }}</span></div>
                      <div class="booking-popover-row"><span class="popover-label">Tea Special Requests</span><span class="popover-value">{{ formatTeaSpecialRequest(booking) }}</span></div>
                      <div class="booking-popover-row"><span class="popover-label">Display on Homepage</span><span class="popover-value">{{ formatDisplayOnHomepage(booking) }}</span></div>
                      <template v-if="isAdminAllBookingsView">
                        <div v-if="String(booking.approvalStatus || '').toLowerCase() === 'rejected'" class="booking-popover-row">
                          <span class="popover-label">Reason</span>
                          <span class="popover-value">{{ booking.reason || booking.rejectReason || '-' }}</span>
                        </div>
                      </template>
                    </div>
                  </el-popover>
                  <span :class="['status-badge', 'badge-' + booking.status]">
                    {{ formatStatus(booking.status) }}
                  </span>
                </div>
              </div>
              <div class="card-body">
                <div class="card-row">
                  <span class="card-label">Room</span>
                  <span class="card-value">{{ booking.room }}</span>
                </div>
                <div class="card-row">
                  <span class="card-label">Booking Date</span>
                  <span class="card-value">{{ booking.date }}</span>
                </div>
                <div class="card-row">
                  <span class="card-label">Time</span>
                  <span class="card-value">{{ booking.time }}</span>
                </div>
                <div class="card-row tea-service-row">
                  <span class="card-label tea-service-label">Tea Service</span>
                  <span class="card-value tea-service-value">
                    <el-popover
                      v-if="isBookingTeaServiceYes(booking)"
                      placement="top"
                      :width="300"
                      trigger="hover"
                      :teleported="cardPopoverTeleported"
                      popper-class="booking-card-tea-popover"
                    >
                      <template #reference>
                        <span
                          :class="[
                            'status-badge',
                            'tea-service-badge',
                            'card-tea-service-badge',
                            'badge-tea-service-yes',
                            'tea-service-badge--interactive'
                          ]"
                        >
                          {{ formatTeaServiceCardLabel(booking) }}
                        </span>
                      </template>
                      <div class="tea-service-popover-detail">
                        <div v-if="getTeaServiceSummaryText(booking)" class="tea-service-popover-line">
                          {{ getTeaServiceSummaryText(booking) }}
                        </div>
                        <div
                          v-if="formatTeaSpecialRequest(booking) !== '-'"
                          class="tea-service-popover-line tea-service-popover-special"
                        >
                          <span class="tea-service-popover-label">Special requests</span>
                          <span class="tea-service-popover-text">{{ formatTeaSpecialRequest(booking) }}</span>
                        </div>
                      </div>
                    </el-popover>
                    <span
                      v-else
                      :class="[
                        'status-badge',
                        'tea-service-badge',
                        'card-tea-service-badge',
                        'badge-tea-service-no'
                      ]"
                    >
                      {{ formatTeaServiceCardLabel(booking) }}
                    </span>
                  </span>
                </div>
                <div class="card-row">
                  <span class="card-label">Display on Homepage</span>
                  <span class="card-value">
                    <span
                      v-if="isBookingDisplayOnHomepageSupported(booking)"
                      :class="[
                        'status-badge',
                        'card-display-homepage-badge',
                        booking.displayOnHomepage !== false ? 'badge-display-homepage-yes' : 'badge-display-homepage-no'
                      ]"
                    >
                      {{ formatDisplayOnHomepage(booking) }}
                    </span>
                    <span v-else>-</span>
                  </span>
                </div>
                <div class="card-row">
                  <span class="card-label application-date-label">Application Date</span>
                  <span class="card-value">{{ formatApplicationDateForCard(booking.bookedOn) }}</span>
                </div>
                <div v-if="isBookingCanceledStatus(booking.status)" class="card-row">
                  <span class="card-label">Cancelled by</span>
                  <span class="card-value">{{ formatCancelledBy(booking) }}</span>
                </div>
                <div v-if="isBookingCanceledStatus(booking.status)" class="card-row">
                  <span class="card-label">Cancelled At</span>
                  <span class="card-value">{{ formatCancelledAt(booking) }}</span>
                </div>
              </div>
              <div class="card-footer">
                <div
                  v-if="isAdminAllBookingsView && (canShowAdminAllBookingsEditButton(booking) || canShowAdminAllBookingsCancelButton(booking))"
                  class="card-footer-actions"
                >
                  <button
                    v-if="canShowAdminAllBookingsEditButton(booking)"
                    type="button"
                    class="btn-action btn-edit"
                    @click="openAdminAllBookingsEdit(booking)"
                  >
                    Edit
                  </button>
                  <button
                    v-if="canShowAdminAllBookingsCancelButton(booking)"
                    type="button"
                    class="btn-action btn-cancel-small"
                    @click="cancelBooking(booking.id)"
                  >
                    Release
                  </button>
                </div>
                <div v-else-if="!isAdminAllBookingsView" class="card-footer-actions">
                  <button
                    v-if="canShowCancelButton(booking)"
                    type="button"
                    class="btn-action btn-cancel-small"
                    @click="cancelBooking(booking.id)"
                  >
                    Cancel
                  </button>
                </div>
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
                  <th v-if="availableColumns[0].visible" class="col-datetime">
                    <button type="button" class="th-sort-btn" @click="toggleSort('dateTime')">
                      Booking Date & Time
                      <span class="sort-indicator">{{ getSortIndicator('dateTime') }}</span>
                    </button>
                  </th>
                  <th v-if="availableColumns[1].visible" class="col-venue">
                    <SortableFilterHeader
                      label="Venue"
                      :sort-indicator="getSortIndicator('room')"
                      :filter-active="columnFilterState.room.length > 0"
                      :options="getFilterOptions('room')"
                      :model-value="columnFilterState.room"
                      @sort-asc="setSortByMenu('room', 'asc')"
                      @sort-desc="setSortByMenu('room', 'desc')"
                      @clear-sort="clearSortByMenu('room')"
                      @update:model-value="(v) => updateFilter('room', v)"
                    />
                  </th>
                  <th v-if="availableColumns[2].visible" class="col-topic">
                    <button type="button" class="th-sort-btn" @click="toggleSort('topic')">
                      Meeting / Event
                      <span class="sort-indicator">{{ getSortIndicator('topic') }}</span>
                    </button>
                  </th>
                  <th v-if="isReservedByTableColumnVisible">
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
                  <th v-if="isContactTableColumnVisible">
                    <button type="button" class="th-sort-btn" @click="toggleSort('contact')">
                      Contact No.
                      <span class="sort-indicator">{{ getSortIndicator('contact') }}</span>
                    </button>
                  </th>
                  <th v-if="isEmailTableColumnVisible">
                    <button type="button" class="th-sort-btn" @click="toggleSort('email')">
                      Email
                      <span class="sort-indicator">{{ getSortIndicator('email') }}</span>
                    </button>
                  </th>
                  <th v-if="availableColumns[6].visible">
                    <SortableFilterHeader
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
                  </th>
                  <th v-if="isTeaServiceTableColumnVisible" class="col-tea-service">
                    <button type="button" class="th-sort-btn" @click="toggleSort('teaService')">
                      Tea Service
                      <span class="sort-indicator">{{ getSortIndicator('teaService') }}</span>
                    </button>
                  </th>
                  <th v-if="isDisplayOnHomepageTableColumnVisible" class="col-display-homepage">
                    <button type="button" class="th-sort-btn th-sort-btn--stacked" @click="toggleSort('displayOnHomepage')">
                      <span class="display-homepage-header">Display on<br>Homepage</span>
                      <span class="sort-indicator">{{ getSortIndicator('displayOnHomepage') }}</span>
                    </button>
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
                  <th v-if="availableColumns[8].visible">
                    <button type="button" class="th-sort-btn" @click="toggleSort('bookedOn')">
                      Application Date
                      <span class="sort-indicator">{{ getSortIndicator('bookedOn') }}</span>
                    </button>
                  </th>
                  <th v-if="isMyNoteTableColumnVisible" class="col-mynote">My Note</th>
                  <th v-if="isCancelledByTableColumnVisible">
                    <button type="button" class="th-sort-btn" @click="toggleSort('cancelledBy')">
                      Cancelled by
                      <span class="sort-indicator">{{ getSortIndicator('cancelledBy') }}</span>
                    </button>
                  </th>
                  <th v-if="isCancelledAtTableColumnVisible">
                    <button type="button" class="th-sort-btn" @click="toggleSort('cancelledAt')">
                      Cancelled At
                      <span class="sort-indicator">{{ getSortIndicator('cancelledAt') }}</span>
                    </button>
                  </th>
                  <th v-if="isActionsTableColumnVisible" class="col-actions" :class="{ 'col-actions--compact': !isAdminAllBookingsView }">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(booking, index) in paginatedBookings" :key="booking.id">
                  <td class="no-cell">{{ startIndex + index + 1 }}</td>
                  <td v-if="availableColumns[0].visible" class="datetime-cell">
                    <div class="date">{{ booking.date }}</div>
                    <div class="time">{{ booking.time }}</div>
                  </td>
                  <td v-if="availableColumns[1].visible" class="col-venue">{{ booking.room }}</td>
                  <td v-if="availableColumns[2].visible" class="col-topic">{{ booking.topic }}</td>
                  <td v-if="isReservedByTableColumnVisible">{{ formatBookingReservedByDisplay(booking) }}</td>
                  <td v-if="isContactTableColumnVisible">{{ booking.contact }}</td>
                  <td v-if="isEmailTableColumnVisible">{{ booking.email }}</td>
                  <td v-if="availableColumns[6].visible">
                    <span :class="['status-badge', 'badge-' + booking.status]">
                      {{ formatStatus(booking.status) }}
                    </span>
                  </td>
                  <td v-if="isTeaServiceTableColumnVisible" class="col-tea-service">
                    <el-popover
                      v-if="isBookingTeaServiceYes(booking)"
                      placement="top"
                      :width="300"
                      trigger="hover"
                      :teleported="cardPopoverTeleported"
                      popper-class="booking-card-tea-popover"
                    >
                      <template #reference>
                        <span
                          :class="[
                            'status-badge',
                            'tea-service-badge',
                            'table-tea-service-badge',
                            'badge-tea-service-yes',
                            'tea-service-badge--interactive'
                          ]"
                        >
                          {{ formatTeaServiceCardLabel(booking) }}
                        </span>
                      </template>
                      <div class="tea-service-popover-detail">
                        <div v-if="getTeaServiceSummaryText(booking)" class="tea-service-popover-line">
                          {{ getTeaServiceSummaryText(booking) }}
                        </div>
                        <div
                          v-if="formatTeaSpecialRequest(booking) !== '-'"
                          class="tea-service-popover-line tea-service-popover-special"
                        >
                          <span class="tea-service-popover-label">Special requests</span>
                          <span class="tea-service-popover-text">{{ formatTeaSpecialRequest(booking) }}</span>
                        </div>
                      </div>
                    </el-popover>
                    <span
                      v-else
                      :class="[
                        'status-badge',
                        'tea-service-badge',
                        'table-tea-service-badge',
                        'badge-tea-service-no'
                      ]"
                    >
                      {{ formatTeaServiceCardLabel(booking) }}
                    </span>
                  </td>
                  <td v-if="isDisplayOnHomepageTableColumnVisible" class="col-display-homepage">
                    <span
                      v-if="isBookingDisplayOnHomepageSupported(booking)"
                      :class="[
                        'status-badge',
                        'display-homepage-badge',
                        booking.displayOnHomepage !== false ? 'badge-display-homepage-yes' : 'badge-display-homepage-no'
                      ]"
                    >
                      {{ formatDisplayOnHomepage(booking) }}
                    </span>
                    <span v-else>-</span>
                  </td>
                  <td v-if="isAdminAllBookingsView">{{ formatBookingSubmitterDisplay(booking) || '-' }}</td>
                  <td v-if="availableColumns[8].visible">{{ booking.bookedOn }}</td>
                  <td v-if="isMyNoteTableColumnVisible" class="col-mynote">
                    <span class="col-mynote-text">{{ booking.myNote || '-' }}</span>
                  </td>
                  <td v-if="isCancelledByTableColumnVisible">{{ formatCancelledBy(booking) }}</td>
                  <td v-if="isCancelledAtTableColumnVisible">{{ formatCancelledAt(booking) }}</td>
                  <td v-if="isActionsTableColumnVisible" class="actions-td" :class="{ 'actions-td--compact': !isAdminAllBookingsView }">
                    <div class="actions-cell">
                      <template v-if="isAdminAllBookingsView">
                        <button
                          v-if="canShowAdminAllBookingsEditButton(booking)"
                          type="button"
                          class="btn-action btn-edit"
                          @click="openAdminAllBookingsEdit(booking)"
                        >
                          Edit
                        </button>
                        <button
                          v-if="canShowAdminAllBookingsCancelButton(booking)"
                          type="button"
                          class="btn-action btn-cancel-small"
                          @click="cancelBooking(booking.id)"
                        >
                          Release
                        </button>
                      </template>
                      <template v-else>
                        <button
                          v-if="canShowCancelButton(booking)"
                          type="button"
                          class="btn-action btn-cancel-small"
                          @click="cancelBooking(booking.id)"
                        >
                          Cancel
                        </button>
                      </template>
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

    <!-- Cancel Booking Dialog -->
    <BookingStyleModal v-model="showCancelDialog" :title="cancelDialogTitle" max-width="540px">
      <p class="cancel-confirm-message">
        {{ cancelDialogMessage }}
      </p>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="showCancelDialog = false">No</el-button>
        <el-button type="default" class="action-btn action-delete" @click="confirmCancel">{{ cancelDialogConfirmLabel }}</el-button>
      </template>
    </BookingStyleModal>

    <VenueBookingDialog
      :visible="adminBookingDialogVisible"
      :booking="adminDialogBooking"
      mode="edit"
      :is-admin="true"
      :allow-admin-reserved-by="true"
      :venue-list="venueListForBookingDialog"
      :public-holiday-dates="holidaysByDate"
      :booking-window-start="venueBookingWindow.currentStartDate"
      :booking-window-end="venueBookingWindow.currentEndDate"
      @confirm="confirmAdminBookingDialog"
      @close="closeAdminBookingDialog"
    />

    <!-- Edit Booking Info Dialog -->
    <BookingStyleModal
      v-model="showEditDialog"
      title="Edit Booking"
      max-width="800px"
      :max-height="editBookingModalHeightPx"
      :dialog-height="editBookingModalHeightPx"
      overlay-padding="12px 16px"
      custom-class="edit-booking-modal"
    >
      <el-form :model="editForm" :rules="editFormRules" label-width="150px" class="edit-booking-form">
        <el-form-item label="Room / Venue" prop="room">
          <el-select
            v-model="editForm.room"
            filterable
            clearable
            default-first-option
            placeholder="Select venue"
            style="width: 100%"
            :disabled="isEditScheduleLocked"
            :teleported="false"
            :reserve-keyword="false"
            :filter-method="handleEditRoomFilter"
            :popper-options="editPickerPopperOptions"
            popper-class="edit-booking-room-select"
          >
            <el-option v-for="room in displayedEditableVenueOptions" :key="`edit-room-${room.name}`" :label="room.name" :value="room.name">
              <div class="edit-venue-option">
                <span class="edit-room-color-dot" :style="{ backgroundColor: room.color || '#3b82f6' }"></span>
                <span class="edit-venue-option-name">{{ room.name }}</span>
                <span class="edit-venue-option-cap">{{ formatRoomCapacity(room.roomCapacity) }}</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="Meeting / Event" prop="topic">
          <MeetingEventTitleInput
            v-model="editForm.topic"
            :max-units="meetingEventTitleMaxLength"
            placeholder="Enter meeting or event name"
            :disabled="isEditTopicLocked"
          />
        </el-form-item>
        <el-form-item label="Date" prop="date">
          <div class="field-with-availability">
            <el-date-picker
              v-model="editForm.date"
              class="field-with-availability__control"
              type="date"
              value-format="YYYY-MM-DD"
              format="DD/MM/YYYY"
              placeholder="Select booking date"
              :disabled="isEditScheduleLocked"
              :disabled-date="disabledEditBookingDate"
              :teleported="false"
              placement="bottom"
              popper-class="edit-booking-date-popper"
              :popper-options="editDatePopperOptions"
              style="width: 100%;"
            />
            <span v-if="!isEditScheduleLocked && editAvailabilityFieldOk.date" class="availability-ok" aria-hidden="true">?</span>
            <span v-else-if="!isEditScheduleLocked && editAvailabilityFieldFail.date" class="availability-fail" aria-hidden="true">?</span>
          </div>
        </el-form-item>
        <div class="form-row">
          <el-form-item label="Start Time" prop="startTime" class="form-item-half">
            <div class="field-with-availability">
              <VenueTimePicker
                v-model="editForm.startTime"
                class="field-with-availability__control venue-edit-time-picker"
                placeholder="Select start time"
                clearable
                :disabled="isEditScheduleLocked"
                :teleported="false"
              />
              <span v-if="!isEditScheduleLocked && editAvailabilityFieldOk.startTime" class="availability-ok" aria-hidden="true">?</span>
              <span v-else-if="!isEditScheduleLocked && editAvailabilityFieldFail.startTime" class="availability-fail" aria-hidden="true">?</span>
            </div>
          </el-form-item>
          <el-form-item label="End Time" prop="endTime" class="form-item-half">
            <div class="field-with-availability">
              <VenueTimePicker
                v-model="editForm.endTime"
                class="field-with-availability__control venue-edit-time-picker"
                placeholder="Select end time"
                clearable
                :disabled="isEditScheduleLocked"
                :teleported="false"
                :min-time="editForm.startTime"
              />
              <span v-if="!isEditScheduleLocked && editAvailabilityFieldOk.endTime" class="availability-ok" aria-hidden="true">?</span>
              <span v-else-if="!isEditScheduleLocked && editAvailabilityFieldFail.endTime" class="availability-fail" aria-hidden="true">?</span>
            </div>
          </el-form-item>
        </div>
        <el-form-item v-if="!isEditScheduleLocked" label=" " class="edit-check-availability-item">
          <el-button type="default" @click="checkEditAvailability" class="check-btn">
            CHECK AVAILABILITY
          </el-button>
        </el-form-item>
        <el-form-item label="My Note">
          <el-input v-model="editForm.myNote" type="textarea" :rows="2" placeholder="Enter your note" />
        </el-form-item>
        <el-form-item label="No. of participants" class="edit-tea-line no-wrap-label">
          <p v-if="selectedEditVenueCapacity != null" class="edit-participants-hint">
            min: 1, max: {{ selectedEditVenueCapacity }} (venue capacity)
          </p>
          <p v-else-if="editForm.room" class="edit-participants-hint">min: 1</p>
          <p v-else class="edit-participants-hint">Select a room to see capacity limit</p>
          <el-input-number
            v-model="editForm.teaServiceParticipants"
            :min="1"
            :max="200"
            controls-position="right"
            style="width: 100%"
            :disabled="isEditDetailsLocked"
          />
        </el-form-item>
        <el-form-item
          v-if="showEditTeaServiceRequiredOption"
          class="edit-tea-line no-wrap-label edit-tea-line--with-hint"
        >
          <template #label>
            <span class="service-label-with-icon service-label-with-icon--edit">
              Tea Service Required?
              <el-tooltip
                :content="teaServicePromptTooltip"
                placement="top-start"
                :teleported="cardPopoverTeleported"
                popper-class="venue-booking-prompt-tooltip"
              >
                <span class="service-info-trigger">
                  <el-icon class="service-info-icon"><InfoFilled /></el-icon>
                </span>
              </el-tooltip>
            </span>
          </template>
          <el-radio-group v-model="editForm.teaServiceRequired" :disabled="isEditDetailsLocked">
            <el-radio :label="true">Yes</el-radio>
            <el-radio :label="false">No</el-radio>
          </el-radio-group>
        </el-form-item>
        <div
          v-if="showEditTeaServiceRequiredOption && editForm.teaServiceRequired"
          class="edit-tea-service-box"
        >
          <div class="edit-tea-service-options">
            <p class="tea-service-prompt">Please tick as appropriate</p>

            <el-radio-group
              v-model="editForm.teaServiceOption"
              class="tea-service-option-group"
              :disabled="isEditDetailsLocked || isEditTeaServiceUnavailable"
            >
              <div class="tea-service-option-row">
                <el-radio label="1">
                  <span class="tea-option-label">
                    Option 1: Tea / Attendee <span class="tea-option-zh">?????</span>
                  </span>
                </el-radio>
              </div>

              <div class="tea-service-option-row tea-service-option-row--inline">
                <el-radio label="2">
                  <span class="tea-option-label">
                    Option 2: Tea / Attendee <span class="tea-option-zh">?????</span>,
                  </span>
                </el-radio>
                <el-input-number
                  v-model="editForm.teaServiceRatioFrom"
                  :min="1"
                  :disabled="editForm.teaServiceOption !== '2' || isEditDetailsLocked || isEditTeaServiceUnavailable"
                  controls-position="right"
                  class="tea-inline-number"
                />
                <span class="tea-inline-text">to</span>
                <el-input-number
                  v-model="editForm.teaServiceRatioTo"
                  :min="1"
                  :disabled="editForm.teaServiceOption !== '2' || isEditDetailsLocked || isEditTeaServiceUnavailable"
                  controls-position="right"
                  class="tea-inline-number"
                />
                <span class="tea-inline-text tea-option-zh">(X?X)</span>
              </div>

              <div class="tea-service-option-row tea-service-option-row--inline">
                <el-radio label="3">
                  <span class="tea-option-label">Option 3: Tea</span>
                </el-radio>
                <el-input-number
                  v-model="editForm.teaServiceTeaPots"
                  :min="0"
                  :disabled="editForm.teaServiceOption !== '3' || isEditDetailsLocked || isEditTeaServiceUnavailable"
                  controls-position="right"
                  class="tea-inline-number"
                />
                <span class="tea-inline-text">Pot(s) <span class="tea-option-zh">(??)</span> + Water</span>
                <el-input-number
                  v-model="editForm.teaServiceWaterPots"
                  :min="0"
                  :disabled="editForm.teaServiceOption !== '3' || isEditDetailsLocked || isEditTeaServiceUnavailable"
                  controls-position="right"
                  class="tea-inline-number"
                />
                <span class="tea-inline-text">Pot(s) <span class="tea-option-zh">(??)</span> + cups</span>
              </div>
            </el-radio-group>

            <div
              v-if="isAdmin"
              class="tea-service-option-row tea-service-option-row--stacked tea-service-option4"
            >
              <el-checkbox
                v-model="editForm.teaServiceOption4"
                :disabled="
                  isEditDetailsLocked ||
                  isEditTeaServiceUnavailable ||
                  !['1', '2', '3'].includes(String(editForm.teaServiceOption || ''))
                "
              >
                <span class="tea-option-label">
                  Option 4: Special requests other than Option 1 / 2 / 3
                  <span class="tea-option-zh tea-option-zh--required">(??????)</span>
                </span>
              </el-checkbox>
              <el-input
                v-model="editForm.teaServiceSpecialRequest"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 4 }"
                resize="none"
                class="tea-service-special-textarea"
                :disabled="
                  !editForm.teaServiceOption4 ||
                  isEditDetailsLocked ||
                  isEditTeaServiceUnavailable
                "
                placeholder="??????????"
              />
            </div>
          </div>
        </div>
        <el-form-item
          v-if="showEditUploadEventTitleOption"
          class="edit-tea-line display-title-public-item"
          label-width="0"
        >
          <div class="display-title-public-row">
            <span class="display-title-public-label">
              Upload event title to "Upcoming Events" on TKOH homepage?
            </span>
            <el-radio-group
              v-model="editForm.displayOnHomepage"
              :disabled="isEditScheduleLocked"
            >
              <el-radio :label="true">Yes</el-radio>
              <el-radio :label="false">No</el-radio>
            </el-radio-group>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="showEditDialog = false">Cancel</el-button>
        <el-button type="default" class="action-btn action-confirm" @click="confirmEditBooking">Save</el-button>
      </template>
    </BookingStyleModal>

    <!-- Handle Booking?All Bookings + upcoming????MeetingApproval -->
    <BookingStyleModal
      v-model="showHandleDialog"
      title="Handle Booking"
      max-width="760px"
      :max-height="handleBookingModalMaxHeight"
      custom-class="handle-booking-modal"
    >
      <el-form :model="handleForm" label-width="170px" class="handle-booking-form">
        <el-form-item label="Room / Venue">
          <el-input v-model="handleForm.room" disabled />
        </el-form-item>
        <el-form-item label="Meeting / Event Title" class="no-wrap-label">
          <MeetingEventTitleInput
            v-model="handleForm.topic"
            :max-units="meetingEventTitleMaxLength"
          />
        </el-form-item>
        <el-form-item label="Date">
          <el-input v-model="handleForm.date" disabled />
        </el-form-item>
        <el-form-item label="Time">
          <el-input v-model="handleForm.time" disabled />
        </el-form-item>
        <el-form-item label="No. of Participants" class="no-wrap-label">
          <el-input v-model="handleForm.participantCount" disabled />
        </el-form-item>
        <el-form-item label="Tea Service">
          <el-input v-model="handleForm.teaService" disabled />
        </el-form-item>
        <el-form-item
          v-if="showHandleUploadEventTitleOption"
          class="display-title-public-item"
          label-width="0"
        >
          <div class="display-title-public-row">
            <span class="display-title-public-label">
              Upload event title to "Upcoming Events" on TKOH homepage?
            </span>
            <el-radio-group v-model="handleForm.displayOnHomepage">
              <el-radio :label="true">Yes</el-radio>
              <el-radio :label="false">No</el-radio>
            </el-radio-group>
          </div>
        </el-form-item>
        <div class="contact-info-section">
          <el-form-item label="Name" label-width="154px">
            <el-input v-model="handleForm.userName" disabled />
          </el-form-item>
          <el-form-item label="Department / Unit" label-width="154px">
            <el-input v-model="handleForm.departmentUnit" disabled />
          </el-form-item>
          <el-form-item label="Contact No." label-width="154px">
            <el-input v-model="handleForm.contactPhone" disabled />
          </el-form-item>
          <el-form-item label="Email" label-width="154px">
            <el-input v-model="handleForm.contactEmail" disabled />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="showHandleDialog = false">Cancel</el-button>
        <el-button type="default" class="action-btn action-delete" @click="openRejectBookingDialog">Reject</el-button>
        <el-button type="default" class="action-btn action-approve" @click="confirmHandleApprove">Approve</el-button>
      </template>
    </BookingStyleModal>

    <BookingStyleModal
      v-model="showRejectBookingDialog"
      title="Reject Booking"
      max-width="720px"
      custom-class="reject-booking-modal"
    >
      <el-form :model="rejectBookingForm" class="reject-booking-form" label-width="132px">
        <el-form-item label="Reject Template">
          <el-select
            v-model="rejectBookingForm.selectedTemplateId"
            filterable
            clearable
            default-first-option
            style="width: 100%"
            placeholder="Type template name"
            :teleported="rejectBookingSelectTeleported"
            :reserve-keyword="false"
            :filter-method="handleRejectTemplateFilter"
            popper-class="reject-booking-template-select-popper"
            :popper-style="rejectBookingSelectTeleported ? { zIndex: 10100 } : {}"
            @change="handleRejectTemplateSelectChange"
          >
            <el-option
              v-for="tpl in displayedRejectTemplateOptions"
              :key="tpl.id"
              :label="tpl.name"
              :value="tpl.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="Reject Reason">
          <el-input
            v-model="rejectBookingForm.reason"
            type="textarea"
            :rows="6"
            placeholder="Reason for rejection"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="closeRejectBookingDialog">Cancel</el-button>
        <el-button type="default" class="action-btn action-delete" @click="confirmRejectBooking">Confirm Reject</el-button>
      </template>
    </BookingStyleModal>

    <BookingStyleModal v-model="showNoticeDialog" :title="noticeTitle" max-width="420px">
      <p class="notice-message">{{ noticeMessage }}</p>
      <template #footer>
        <el-button type="default" class="submit-btn" @click="showNoticeDialog = false">OK</el-button>
      </template>
    </BookingStyleModal>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import AppHeader from '../components/AppHeader.vue'
import BookingStyleModal from '@/components/BookingStyleModal.vue'
import VenueBookingDialog from '@/components/VenueBookingDialog.vue'
import VenueTimePicker from '@/components/VenueTimePicker.vue'
import MeetingEventTitleInput from '@/components/MeetingEventTitleInput.vue'
import SortableFilterHeader from '@/components/admin/SortableFilterHeader.vue'
import { InfoFilled } from '@element-plus/icons-vue'
import {
  getVenueManagementVenues,
  getVenueBookingWindow,
  approveVenueManageBooking,
  listVenueManageBookings,
  rejectVenueManageBooking,
  toggleVenueManageBookingCancel,
  updateVenueManageBooking
} from '@/api/venueManagement'
import { checkRoomAvailability } from '@/api/calendar'
import { getPrompts } from '@/api/promptManagement'
import { useAdminStore } from '@/stores/admin'
import { notifyAdminPendingUpdated } from '@/utils/adminPendingSync'
import { HTML_ZOOM_BREAKPOINT_MQ } from '@/utils/venueCalendarApi'
import { formatTeaServiceDisplay, parseTeaServiceToForm, validateTeaServiceForm, buildTeaServiceApiPayload, venueOffersTeaService, stripTeaServiceSpecialSuffix } from '@/utils/venueTeaService'
import { validateVenueBookingDateRange, isYmdOutsideVenueBookingDateRange } from '@/utils/venueBookingDateRange'
import { pickPromptTooltipText } from '@/utils/promptTooltip'
import { todayYmdInAppTimeZone } from '@/utils/appTimezone'
import { isRestrictedBookingDay } from '@/utils/bookingDateRestriction'
import { useHkPublicHolidays } from '@/composables/useHkPublicHolidays'
import {
  DEFAULT_MEETING_EVENT_TITLE_MAX_LENGTH,
  fetchMeetingEventTitleMaxLength,
  meetingEventTitleTooLongMessage,
  isMeetingEventTitleTooLong,
  createMeetingEventTitleMaxRule
} from '@/utils/meetingEventTitleMaxLength'
import { formatBookingReservedByDisplay, formatBookingSubmitterDisplay } from '@/utils/userDisplayName'
import * as XLSX from 'xlsx'

const userStore = useUserStore()
const adminStore = useAdminStore()
const { isAdmin, userInfo } = storeToRefs(userStore)

const VIEW_PREFS_KEY = 'venueManageBooking.viewPrefs'
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

/** ???? All Bookings?? upcoming ?? Handle???? Edit/Cancel */
const isAdminAllBookingsView = computed(
  () => isAdmin.value && bookingView.value === 'all'
)

/** All Bookings 不含 My Note / Approval；My Bookings 不含 Approval / 联系人相关列；Cancelled 未勾选时不含 Cancelled by / Cancelled At */
const columnsForTablePicker = computed(() => {
  let cols = isAdminAllBookingsView.value
    ? availableColumns.value.filter((col) => col.key !== 'approvalStatus')
    : availableColumns.value.filter(
      (col) => !['approvalStatus', 'reservedBy', 'contact', 'email'].includes(col.key)
    )
  if (!statusFilters.value.cancelled) {
    cols = cols.filter((col) => col.key !== 'cancelledBy' && col.key !== 'cancelledAt')
  }
  return cols
})

const isReservedByTableColumnVisible = computed(() => {
  if (!isAdminAllBookingsView.value) return false
  return Boolean(availableColumns.value.find((c) => c.key === 'reservedBy')?.visible)
})

const isContactTableColumnVisible = computed(() => {
  if (!isAdminAllBookingsView.value) return false
  return Boolean(availableColumns.value.find((c) => c.key === 'contact')?.visible)
})

const isEmailTableColumnVisible = computed(() => {
  if (!isAdminAllBookingsView.value) return false
  return Boolean(availableColumns.value.find((c) => c.key === 'email')?.visible)
})

/** My Bookings：状态筛选未勾选 upcoming 时隐藏 Actions；All Bookings 始终显示 */
const isActionsTableColumnVisible = computed(() => {
  if (isAdminAllBookingsView.value) return true
  return Boolean(statusFilters.value.upcoming)
})

const isMyNoteTableColumnVisible = computed(() => {
  const col = availableColumns.value.find((c) => c.key === 'myNote')
  return Boolean(col?.visible)
})

const isCancelledByTableColumnVisible = computed(() => {
  if (!statusFilters.value.cancelled) return false
  const col = availableColumns.value.find((c) => c.key === 'cancelledBy')
  return Boolean(col?.visible)
})

const isCancelledAtTableColumnVisible = computed(() => {
  if (!statusFilters.value.cancelled) return false
  const col = availableColumns.value.find((c) => c.key === 'cancelledAt')
  return Boolean(col?.visible)
})

const isDisplayOnHomepageTableColumnVisible = computed(() => {
  const col = availableColumns.value.find((c) => c.key === 'displayOnHomepage')
  return Boolean(col?.visible)
})

const isTeaServiceTableColumnVisible = computed(() => {
  const col = availableColumns.value.find((c) => c.key === 'teaService')
  return Boolean(col?.visible)
})
const searchQuery = ref('')
const showColumnsFilter = ref(false)
const showStatusFilter = ref(false)
const showDateFilter = ref(false)
const showExportMenu = ref(false)
const exportingExcel = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const sortState = ref([
  { key: 'dateTime', order: 'asc' }
])
const columnFilterState = ref({
  room: [],
  reservedBy: [],
  approvalStatus: [],
  status: [],
  submitter: []
})
const showCancelDialog = ref(false)
const showEditDialog = ref(false)
const adminBookingDialogVisible = ref(false)
const adminDialogBooking = ref(null)
const { holidaysByDate, loadHolidays } = useHkPublicHolidays()

const venueBookingWindow = ref({
  currentStartDate: '',
  currentEndDate: ''
})

function disabledEditBookingDate (date) {
  const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  if (!isAdmin.value && ymd < todayYmdInAppTimeZone()) return true
  if (isYmdOutsideVenueBookingDateRange(
    ymd,
    venueBookingWindow.value.currentStartDate,
    venueBookingWindow.value.currentEndDate
  )) {
    return true
  }
  return isRestrictedBookingDay(ymd, {
    isAdmin: isAdmin.value,
    publicHolidayDates: holidaysByDate.value
  })
}
const cancelBookingId = ref(null)
const currentEditBookingId = ref(null)
const currentEditBookingApprovalStatus = ref('')
const editScheduleSnapshot = ref({ room: '', date: '', startTime: '', endTime: '' })
const editTeaSelectionSnapshot = ref({
  teaServiceOption: '1',
  teaServiceOption4: false,
  teaServiceRatioFrom: null,
  teaServiceRatioTo: null,
  teaServiceTeaPots: null,
  teaServiceWaterPots: null,
  teaServiceSpecialRequest: ''
})

const isBookingCanceledStatus = (status) => ['canceled', 'cancelled'].includes(String(status || '').toLowerCase())

const getBookingStartDateTime = (booking) => {
  const date = parseDate(booking?.date || '')
  if (Number.isNaN(date.getTime())) return null
  const start = String(booking?.time || '').split(' - ')[0] || ''
  const [h = '0', m = '0'] = start.split(':')
  date.setHours(Number.parseInt(h, 10) || 0, Number.parseInt(m, 10) || 0, 0, 0)
  return date
}

const canToggleBookingStatus = (booking) => {
  const startAt = getBookingStartDateTime(booking)
  if (!startAt) return false
  return startAt.getTime() > Date.now()
}

/** My Bookings：仅 upcoming 显示取消按钮（含当日） */
const canShowCancelButton = (booking) => {
  return String(booking?.status || '').toLowerCase() === 'upcoming'
}

const canShowEditButton = (booking) => {
  return String(booking?.status || '').toLowerCase() === 'upcoming'
}

/** All Bookings??????????upcoming ???? EV ???????????? */
const canShowAdminAllBookingsEditButton = (booking) => {
  return isAdminAllBookingsView.value && canShowEditButton(booking)
}

/** All Bookings??????????upcoming ???????????? EV ??? */
const canShowAdminAllBookingsCancelButton = (booking) => {
  return isAdminAllBookingsView.value && canShowEditButton(booking)
}

const venueListForBookingDialog = computed(() =>
  editableVenueMeta.value.map((venue) => ({
    id: venue.id != null ? String(venue.id) : undefined,
    name: venue.name,
    color: venue.color,
    roomCapacity: venue.roomCapacity,
    teaServiceAvailable: venue.teaServiceAvailable,
    userDefinedUploadEventTitle: venue.userDefinedUploadEventTitle !== false,
    status: 'active'
  }))
)

function mapManageBookingToDialogBooking (booking) {
  const [startTime = '', endTime = ''] = String(booking?.time || '').split(' - ')
  const teaFields = resolveEditTeaFields(booking)
  return {
    id: booking.id,
    room: booking.room || '',
    date: parseDisplayDateToIso(booking.date),
    startTime: startTime.trim(),
    endTime: endTime.trim(),
    topic: booking.topic || '',
    remark: booking.myNote || '',
    approvalStatus: booking.approvalStatus || '',
    attendeeCount: booking.teaServiceParticipants ?? booking.attendees ?? booking.attendeeCount ?? 1,
    teaServiceRequired: Boolean(booking.teaServiceRequired),
    displayOnHomepage: booking.displayOnHomepage !== false,
    reservedByUserId: booking.employeeId != null ? String(booking.employeeId) : '',
    reservedBy: booking.reservedByName || booking.reservedBy || '',
    corpId: booking.corpId || '',
    fullName: booking.reservedByName || booking.reservedBy || '',
    department: booking.department || '',
    rank: booking.rank || '',
    contactPhone: booking.contact || '',
    contactEmail: booking.email || '',
    teaService: booking.teaService,
    ...teaFields
  }
}

async function openAdminAllBookingsEdit (booking) {
  if (!canShowAdminAllBookingsEditButton(booking)) return
  if (!editableVenueMeta.value.length) {
    await loadEditableVenues()
  }
  adminDialogBooking.value = mapManageBookingToDialogBooking(booking)
  adminBookingDialogVisible.value = true
}

function closeAdminBookingDialog () {
  adminBookingDialogVisible.value = false
  adminDialogBooking.value = null
}

async function confirmAdminBookingDialog (bookingData) {
  const id = bookingData?.id != null ? String(bookingData.id) : ''
  if (!id) return

  const teaPayload = buildTeaServiceApiPayload(bookingData)
  try {
    await updateVenueManageBooking(id, {
      room: bookingData.room,
      topic: String(bookingData.topic || '').trim(),
      myNote: String(bookingData.myNote ?? bookingData.remark ?? '').trim(),
      date: bookingData.date,
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      teaServiceRequired: Boolean(teaPayload.teaServiceRequired),
      teaServiceOption: teaPayload.teaServiceOption,
      teaServiceRatioFrom: teaPayload.teaServiceRatioFrom,
      teaServiceRatioTo: teaPayload.teaServiceRatioTo,
      teaServiceTeaPots: teaPayload.teaServiceTeaPots,
      teaServiceWaterPots: teaPayload.teaServiceWaterPots,
      teaServiceParticipants: Number(bookingData.attendeeCount) || 1,
      teaServiceSpecialRequest: String(
        teaPayload.teaServiceSpecialRequest ?? bookingData.teaServiceSpecialRequest ?? ''
      ).trim(),
      displayOnHomepage: bookingData.displayOnHomepage !== false,
      reservedByUserId: bookingData.reservedByUserId || undefined
    })
    await loadBookings()
    closeAdminBookingDialog()
    showNotice('Booking updated successfully!', 'Success')
  } catch (error) {
    showNotice(getErrorMessage(error, 'Failed to update booking'), 'Error')
  }
}

const canShowHandleButton = (booking) => {
  const status = String(booking?.status || '').toLowerCase()
  const approvalStatus = String(booking?.approvalStatus || 'pending').toLowerCase()
  return status === 'upcoming' && approvalStatus === 'pending'
}

const isOwnBooking = (booking) => {
  const currentUserId = userInfo.value?.id
  const currentUserCorpId = userInfo.value?.corpId
  const currentUserEmail = String(userInfo.value?.email || '').trim().toLowerCase()
  if (currentUserId != null && booking?.employeeId != null) {
    return String(booking.employeeId) === String(currentUserId)
  }
  if (currentUserCorpId && booking?.corpId) {
    return String(booking.corpId) === String(currentUserCorpId)
  }
  if (currentUserEmail && booking?.email) {
    return String(booking.email).trim().toLowerCase() === currentUserEmail
  }
  return false
}

const canViewMyNote = (booking) => {
  if (!isOwnBooking(booking)) return false
  return String(booking?.myNote || '').trim().length > 0
}

const cancelDialogTitle = computed(() =>
  isAdminAllBookingsView.value ? 'Release Booking' : 'Cancel Booking'
)
const cancelDialogConfirmLabel = computed(() => 'Confirm')
const canManageBookingCancel = (booking) => {
  if (isAdminAllBookingsView.value) {
    return String(booking?.status || '').toLowerCase() === 'upcoming'
  }
  return String(booking?.status || '').toLowerCase() === 'upcoming' && canToggleBookingStatus(booking)
}

const cancelDialogMessage = computed(() => {
  if (isAdminAllBookingsView.value) {
    return 'Are you sure you want to release this venue booking? This action cannot be undone.'
  }
  return 'Are you sure you want to cancel this venue booking?'
})

const employeeList = ref([])
const showHandleDialog = ref(false)
const showRejectBookingDialog = ref(false)
const currentHandleBookingId = ref(null)
const showNoticeDialog = ref(false)
const noticeTitle = ref('Notice')
const noticeMessage = ref('')
const showNotice = (message, title = 'Notice') => {
  noticeTitle.value = title
  noticeMessage.value = message
  showNoticeDialog.value = true
}
const getErrorMessage = (error, fallback = 'Operation failed') => {
  const message = error?.response?.data?.message
  if (Array.isArray(message)) return message[0] || fallback
  if (typeof message === 'string' && message.trim()) return message
  if (typeof error?.message === 'string' && error.message.trim()) return error.message
  return fallback
}
const handleForm = ref({
  room: '',
  topic: '',
  date: '',
  time: '',
  participantCount: '-',
  teaService: 'No',
  userName: '',
  departmentUnit: '',
  contactPhone: '',
  contactEmail: '',
  displayOnHomepage: true,
  userDefinedUploadEventTitle: true
})

/** ??????Reject Template ?????? body??4" ????MeetingApproval ???*/
const REJECT_BOOKING_SELECT_MQ = HTML_ZOOM_BREAKPOINT_MQ
const rejectBookingSelectTeleported = ref(true)
let rejectBookingSelectMq = null

function updateRejectBookingSelectTeleported () {
  if (typeof window === 'undefined') return
  rejectBookingSelectTeleported.value = !window.matchMedia(REJECT_BOOKING_SELECT_MQ).matches
}

const rejectBookingForm = ref({
  selectedTemplateId: null,
  reason: ''
})

const rejectTemplateKeyword = ref('')
const meetingEventTitleMaxLength = ref(DEFAULT_MEETING_EVENT_TITLE_MAX_LENGTH)

const editForm = ref({
  room: '',
  topic: '',
  myNote: '',
  date: '',
  startTime: '',
  endTime: '',
  teaServiceRequired: false,
  teaServiceOption: '1',
  teaServiceOption4: false,
  teaServiceRatioFrom: null,
  teaServiceRatioTo: null,
  teaServiceTeaPots: null,
  teaServiceWaterPots: null,
  teaServiceParticipants: 1,
  teaServiceSpecialRequest: '',
  displayOnHomepage: true
})
const editFormRules = computed(() => ({
  room: [{ required: true, message: 'Please select room', trigger: 'change' }],
  topic: [
    { required: true, message: 'Please enter topic', trigger: 'blur' },
    createMeetingEventTitleMaxRule(() => meetingEventTitleMaxLength.value)
  ],
  date: [{ required: true, message: 'Please select date', trigger: 'change' }],
  startTime: [{ required: true, message: 'Please select start time', trigger: 'change' }],
  endTime: [{ required: true, message: 'Please select end time', trigger: 'change' }]
}))

function snapshotEditTeaSelection (form) {
  return {
    teaServiceOption: String(form.teaServiceOption || '1'),
    teaServiceOption4: Boolean(form.teaServiceOption4),
    teaServiceRatioFrom: form.teaServiceRatioFrom ?? null,
    teaServiceRatioTo: form.teaServiceRatioTo ?? null,
    teaServiceTeaPots: form.teaServiceTeaPots ?? null,
    teaServiceWaterPots: form.teaServiceWaterPots ?? null,
    teaServiceSpecialRequest: String(form.teaServiceSpecialRequest || '').trim()
  }
}

function isSameEditTeaSelection (form, snapshot) {
  return JSON.stringify(snapshotEditTeaSelection(form)) === JSON.stringify(snapshot)
}

function resolveEditTeaFields (booking) {
  let teaServiceObj = booking?.teaService
  if (typeof teaServiceObj === 'string') {
    try {
      teaServiceObj = JSON.parse(teaServiceObj)
    } catch {
      teaServiceObj = null
    }
  }
  const parsed = parseTeaServiceToForm(teaServiceObj)
  const option = booking?.teaServiceOption
  let normalizedOption = option && option !== 'none' ? String(option) : parsed.teaServiceOption
  if (normalizedOption === '4') normalizedOption = '1'
  const special = String(
    booking?.teaServiceSpecialRequest || parsed.teaServiceSpecialRequest || ''
  ).trim()
  return {
    teaServiceOption: normalizedOption || '1',
    teaServiceOption4: Boolean(parsed.teaServiceOption4 || special),
    teaServiceRatioFrom: booking?.teaServiceRatioFrom ?? parsed.teaServiceRatioFrom,
    teaServiceRatioTo: booking?.teaServiceRatioTo ?? parsed.teaServiceRatioTo,
    teaServiceTeaPots: booking?.teaServiceTeaPots ?? parsed.teaServiceTeaPots,
    teaServiceWaterPots: booking?.teaServiceWaterPots ?? parsed.teaServiceWaterPots,
    teaServiceSpecialRequest: special
  }
}

function isEditBookingDateTodayOrEarlier(ymd) {
  const date = String(ymd || '').trim()
  if (!date) return false
  return date <= todayYmdInAppTimeZone()
}

const showEditTeaServiceRequiredOption = computed(() => {
  if (!venueOffersTeaService(selectedEditVenueMeta.value)) return false
  //  ????????????????????
  if (isAdmin.value) return true
  return !isEditBookingDateTodayOrEarlier(editForm.value.date)
})

function applyEditTeaServiceVisibilityRules() {
  if (venueOffersTeaService(selectedEditVenueMeta.value)) {
    if (isAdmin.value || !isEditBookingDateTodayOrEarlier(editForm.value.date)) {
      return
    }
  }
  editForm.value.teaServiceRequired = false
  editForm.value.teaServiceOption4 = false
  editForm.value.teaServiceSpecialRequest = ''
}

const isEditTeaServiceUnavailable = computed(() => {
  if (!venueOffersTeaService(selectedEditVenueMeta.value)) return true
  if (isAdmin.value) return false
  return isEditBookingDateTodayOrEarlier(editForm.value.date)
})

const showEditUploadEventTitleOption = computed(() => {
  const venue = selectedEditVenueMeta.value
  if (venue == null) return false
  return venue.userDefinedUploadEventTitle !== false
})

const showHandleUploadEventTitleOption = computed(() => {
  return handleForm.value.userDefinedUploadEventTitle !== false
})

function applyEditUploadEventTitleVisibilityRules() {
  if (showEditUploadEventTitleOption.value) return
  editForm.value.displayOnHomepage = false
}

/** Approved???????? My Note?????????????*/
const isEditApprovedOnlyNote = computed(() =>
  !isAdmin.value &&
  String(currentEditBookingApprovalStatus.value || '').toLowerCase() === 'approved'
)
const isEditTopicLocked = computed(() => isEditApprovedOnlyNote.value)
/** ???????pending ????????/?????????? */
const isEditScheduleLocked = computed(() => {
  if (isAdmin.value) return false
  const status = String(currentEditBookingApprovalStatus.value || 'pending').toLowerCase()
  return status !== 'pending'
})
const isEditDetailsLocked = computed(() => isEditApprovedOnlyNote.value)
const promptList = ref([])
const systemFixedPromptList = ref([])
const teaServicePromptTooltip = computed(() =>
  pickPromptTooltipText(systemFixedPromptList.value, 'venue_add_booking_tea_service')
)
const meetingRejectTemplateOptions = computed(() =>
  promptList.value.filter(item => item.category === 'reject_template' && item.templateType === 'meeting_approval')
)

const displayedRejectTemplateOptions = computed(() => {
  const keyword = rejectTemplateKeyword.value.trim().toLowerCase()
  const source = meetingRejectTemplateOptions.value
  if (!keyword) return source.slice(0, 12)
  return source
    .filter((tpl) =>
      String(tpl.name || '').toLowerCase().includes(keyword) ||
      String(tpl.key || '').toLowerCase().includes(keyword) ||
      String(tpl.id ?? '').includes(keyword)
    )
    .slice(0, 30)
})

function handleRejectTemplateFilter (query) {
  rejectTemplateKeyword.value = String(query || '')
}

function handleRejectTemplateSelectChange (templateId) {
  if (templateId == null || templateId === '') {
    rejectBookingForm.value.reason = ''
    return
  }
  const selectedTemplate = meetingRejectTemplateOptions.value.find(
    (item) => String(item.id) === String(templateId)
  )
  if (!selectedTemplate) {
    rejectBookingForm.value.reason = ''
    return
  }
  rejectBookingForm.value.reason = selectedTemplate.content || ''
}

watch(showRejectBookingDialog, (open) => {
  if (open) {
    rejectTemplateKeyword.value = ''
  }
})
const editableVenueMeta = ref([])
const editRoomKeyword = ref('')
const fallbackEditableVenueOptions = [
  { name: 'Conference Room 1', color: '#3b82f6', roomCapacity: null },
  { name: 'Conference Room 2', color: '#14b8a6', roomCapacity: null },
  { name: 'Conference Room 3', color: '#0ea5e9', roomCapacity: null },
  { name: 'Discussion Room', color: '#22c55e', roomCapacity: null },
  { name: 'Discussion Room 2', color: '#10b981', roomCapacity: null },
  { name: 'Function Room', color: '#ec4899', roomCapacity: null },
  { name: 'Lecture Theatre', color: '#6366f1', roomCapacity: null },
  { name: 'Auditorium', color: '#8b5cf6', roomCapacity: null }
]
const editableVenueOptions = computed(() =>
  editableVenueMeta.value.length ? editableVenueMeta.value : fallbackEditableVenueOptions
)
const displayedEditableVenueOptions = computed(() => {
  const keyword = editRoomKeyword.value.trim().toLowerCase()
  const source = editableVenueOptions.value
  if (!keyword) return source.slice(0, 20)
  return source
    .filter((room) => String(room?.name || '').toLowerCase().includes(keyword))
    .slice(0, 40)
})
const selectedEditVenueMeta = computed(() => {
  const room = String(editForm.value.room || '').trim()
  if (!room) return null
  return editableVenueMeta.value.find((venue) => venue.name === room) || null
})
const selectedEditVenueCapacity = computed(() => {
  const cap = selectedEditVenueMeta.value?.roomCapacity
  return Number.isFinite(Number(cap)) ? Number(cap) : null
})

const handleEditRoomFilter = (query) => {
  editRoomKeyword.value = String(query || '')
}

const formatRoomCapacity = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return ''
  return `cap ${n}`
}
const editAvailabilityFieldOk = ref({
  date: false,
  startTime: false,
  endTime: false
})
const editAvailabilityFieldFail = ref({
  date: false,
  startTime: false,
  endTime: false
})

const clearEditAvailabilityIndicators = () => {
  editAvailabilityFieldOk.value = {
    date: false,
    startTime: false,
    endTime: false
  }
  editAvailabilityFieldFail.value = {
    date: false,
    startTime: false,
    endTime: false
  }
}

const setEditAvailabilityPass = () => {
  editAvailabilityFieldOk.value = {
    date: true,
    startTime: true,
    endTime: true
  }
  editAvailabilityFieldFail.value = {
    date: false,
    startTime: false,
    endTime: false
  }
}

/** fieldErrors ??true = ?????? */
const setEditAvailabilityFromFieldErrors = (fieldErrors) => {
  const dateFail = Boolean(fieldErrors?.date)
  const startFail = Boolean(fieldErrors?.startTime)
  const endFail = Boolean(fieldErrors?.endTime)
  const any =
    fieldErrors &&
    (dateFail || startFail || endFail)
  if (!any) {
    setEditAvailabilityFail()
    return
  }
  editAvailabilityFieldFail.value = {
    date: dateFail,
    startTime: startFail,
    endTime: endFail
  }
  editAvailabilityFieldOk.value = {
    date: !dateFail,
    startTime: !startFail,
    endTime: !endFail
  }
}

const setEditAvailabilityFail = () => {
  editAvailabilityFieldOk.value = {
    date: false,
    startTime: false,
    endTime: false
  }
  editAvailabilityFieldFail.value = {
    date: true,
    startTime: true,
    endTime: true
  }
}

const checkEditAvailability = async () => {
  clearEditAvailabilityIndicators()
  const schedule = isEditScheduleLocked.value
    ? editScheduleSnapshot.value
    : {
        date: editForm.value.date,
        startTime: editForm.value.startTime,
        endTime: editForm.value.endTime
      }
  if (!editForm.value.room || !schedule.date || !schedule.startTime || !schedule.endTime) {
    showNotice('Please fill in Room, Date, Start Time and End Time first', 'Warning')
    return
  }
  if (schedule.startTime >= schedule.endTime) {
    setEditAvailabilityFromFieldErrors({ date: false, startTime: true, endTime: true })
    showNotice('End Time must be later than Start Time', 'Warning')
    return
  }

  if (!editableVenueMeta.value.length) {
    await loadEditableVenues()
  }

  const venue = editableVenueMeta.value.find((item) => item.name === editForm.value.room)
  if (!venue?.id) {
    showNotice('Room not found', 'Warning')
    return
  }

  try {
    const result = await checkRoomAvailability(
      String(venue.id),
      schedule.date,
      schedule.startTime,
      schedule.endTime,
      currentEditBookingId.value != null ? String(currentEditBookingId.value) : undefined
    )
    if (result?.available) {
      setEditAvailabilityPass()
    } else {
      const message = result?.message || 'Room is not available for the selected time slot'
      setEditAvailabilityFromFieldErrors(result?.fieldErrors)
      showNotice(message, 'Warning')
    }
  } catch (error) {
    const message =
      error?.response?.data?.message ||
      error?.message ||
      'Availability check failed. Please try again.'
    setEditAvailabilityFail()
    showNotice(message, 'Warning')
  }
}

/** 14" html zoom ??????Popover / ??????body ??????style.css / MonthDayMorePopover ???*/
const cardPopoverTeleported = ref(true)
let cardPopoverTeleportedMq = null

function updateCardPopoverTeleported () {
  if (typeof window === 'undefined') return
  cardPopoverTeleported.value = !window.matchMedia(HTML_ZOOM_BREAKPOINT_MQ).matches
}

/** 14" ????100??599??Handle Booking ?????? MeetingApproval ???*/
const HANDLE_BOOKING_MODAL_MQ = HTML_ZOOM_BREAKPOINT_MQ
const handleBookingModalMaxHeight = ref('94vh')
/** Edit Booking：直接用视口像素限高（避免 vh/zoom/全局样式互相抵消） */
const editBookingModalHeightPx = ref('520px')
const editPickerOffsetY = ref(0)
const editPickerPopperOptions = computed(() => ({
  modifiers: [
    {
      name: 'offset',
      options: {
        offset: [0, editPickerOffsetY.value]
      }
    }
  ]
}))
const editDatePopperOptions = computed(() => ({
  modifiers: [
    {
      name: 'offset',
      options: {
        offset: [0, editPickerOffsetY.value]
      }
    },
    {
      name: 'flip',
      options: {
        fallbackPlacements: []
      }
    }
  ]
}))

function updateEditBookingModalHeightPx () {
  if (typeof window === 'undefined') return
  // 与 BookingStyleModal 一致：按可视高度限制，避免 zoom 0.88 后弹窗超出窗口
  const zoomRaw = Number.parseFloat(window.getComputedStyle(document.documentElement).zoom || '1')
  const zoom = Number.isFinite(zoomRaw) && zoomRaw > 0 ? zoomRaw : 1
  const visualH = window.visualViewport?.height || window.innerHeight || 800
  const px = Math.max(280, Math.round((visualH * 0.88 - 24) / zoom))
  editBookingModalHeightPx.value = `${px}px`
}

function updateHandleBookingModalMaxHeight () {
  if (typeof window === 'undefined') return
  const isLaptop14 = window.matchMedia(HANDLE_BOOKING_MODAL_MQ).matches
  handleBookingModalMaxHeight.value = isLaptop14 ? '120vh' : '94vh'
  updateEditBookingModalHeightPx()
  editPickerOffsetY.value = 0
}

let handleBookingModalMq = null

// Available columns for table view
const availableColumns = ref([
  { key: 'datetime', label: 'Date & Time', visible: true, required: true },
  { key: 'room', label: 'Venue', visible: true, required: false },
  { key: 'topic', label: 'Meeting / Event', visible: true, required: false },
  { key: 'reservedBy', label: 'Reserved By', visible: true, required: false },
  { key: 'contact', label: 'Contact No.', visible: true, required: false },
  { key: 'email', label: 'Email', visible: true, required: false },
  { key: 'status', label: 'Status', visible: true, required: false },
  { key: 'approvalStatus', label: 'Approval', visible: true, required: false },
  { key: 'bookedOn', label: 'Application Date', visible: true, required: false },
  { key: 'teaService', label: 'Tea Service', visible: true, required: false },
  { key: 'displayOnHomepage', label: 'Display on Homepage', visible: true, required: false },
  { key: 'myNote', label: 'My Note', visible: true, required: false },
  { key: 'cancelledBy', label: 'Cancelled by', visible: true, required: false },
  { key: 'cancelledAt', label: 'Cancelled At', visible: true, required: false }
])

const bookings = ref([])
const bookingsTotal = ref(0)
const bookingsLoading = ref(false)
const filterOptionsState = ref({
  room: [],
  reservedBy: [],
  status: ['upcoming', 'past', 'cancelled'],
  approvalStatus: [],
  submitter: []
})
let searchReloadTimer = null

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

function buildVenueListParams ({ includeOptions = false, all = false, dateOnly = false, dateRangeOverride = undefined } = {}) {
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
    venueNames: (!dateOnly && columnFilterState.value.room?.length)
      ? columnFilterState.value.room.join(',')
      : undefined,
    reservedByUserIds: (!dateOnly && columnFilterState.value.reservedBy?.length)
      ? columnFilterState.value.reservedBy.join(',')
      : undefined,
    submitterUserIds: (!dateOnly && columnFilterState.value.submitter?.length)
      ? columnFilterState.value.submitter.join(',')
      : undefined,
    approvalStatuses: (!dateOnly && columnFilterState.value.approvalStatus?.length)
      ? columnFilterState.value.approvalStatus.join(',')
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

// Helper function to parse date string "10 Feb 2026" to Date object
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

const applyDateRangeToBookings = (result, range) => {
  if (!range || range.length !== 2) return result
  const [startDate, endDate] = range
  return result.filter((b) => {
    const bookingDate = parseDate(b.date)
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

  if (isAdmin.value && bookingView.value === 'my') {
    const currentUserId = userInfo.value?.id
    const currentUserCorpId = userInfo.value?.corpId
    const currentUserEmail = userInfo.value?.email || 'karen.shen@ha.org.hk'
    result = result.filter((b) => {
      if (currentUserId != null && b.employeeId != null) return String(b.employeeId) === String(currentUserId)
      if (currentUserCorpId && b.corpId) return String(b.corpId) === String(currentUserCorpId)
      return (b.email || '') === currentUserEmail
    })
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
      String(b.topic || '').toLowerCase().includes(query) ||
      String(b.room || '').toLowerCase().includes(query) ||
      String(b.date || '').toLowerCase().includes(query) ||
      String(formatBookingReservedByDisplay(b) || b.reservedBy || '').toLowerCase().includes(query) ||
      String(b.department || '').toLowerCase().includes(query) ||
      String(b.myNote || '').toLowerCase().includes(query)
    )
  }

  if (columnFilterState.value.room.length) {
    const selected = new Set(columnFilterState.value.room)
    result = result.filter((b) => selected.has(b.room || ''))
  }
  if (columnFilterState.value.reservedBy.length) {
    const selected = new Set(columnFilterState.value.reservedBy.map(String))
    result = result.filter((b) =>
      selected.has(String(b.reservedByUserId || b.employeeId || ''))
    )
  }
  if (columnFilterState.value.approvalStatus.length) {
    const selected = new Set(columnFilterState.value.approvalStatus)
    result = result.filter((b) => selected.has(b.approvalStatus || 'pending'))
  }
  if (columnFilterState.value.status.length) {
    const selected = new Set(columnFilterState.value.status)
    result = result.filter((b) => selected.has(b.status || ''))
  }
  if (columnFilterState.value.submitter.length) {
    const selected = new Set(columnFilterState.value.submitter.map(String))
    result = result.filter((b) => selected.has(String(b.submitterUserId || '')))
  }

  return result
}

const filteredBookings = computed(() => bookings.value)

const parseBookedOnDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return new Date(0)
  const parts = dateTimeStr.split(' ')
  if (parts.length < 4) return parseDate(dateTimeStr)
  const datePart = `${parts[0]} ${parts[1]} ${parts[2]}`
  const [h = '0', m = '0'] = (parts[3] || '').split(':')
  const date = parseDate(datePart)
  date.setHours(Number.parseInt(h, 10) || 0, Number.parseInt(m, 10) || 0, 0, 0)
  return date
}

const parseStartMinutes = (timeRange) => {
  const start = (timeRange || '').split(' - ')[0] || ''
  const [h = '0', m = '0'] = start.split(':')
  return (Number.parseInt(h, 10) || 0) * 60 + (Number.parseInt(m, 10) || 0)
}

const parseDisplayDateToIso = (dateStr) => {
  if (!dateStr) return ''
  const date = parseDate(dateStr)
  return Number.isNaN(date.getTime()) ? '' : formatDateToString(date)
}

const formatIsoDateToDisplay = (isoDate) => {
  if (!isoDate) return ''
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return ''
  const day = date.getDate()
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  const year = date.getFullYear()
  return `${day} ${month} ${year}`
}

const getSortValue = (booking, key) => {
  switch (key) {
    case 'dateTime':
      return parseDate(booking.date).getTime() * 10000 + parseStartMinutes(booking.time)
    case 'room':
      return booking.room || ''
    case 'topic':
      return booking.topic || ''
    case 'reservedBy':
      return formatBookingReservedByDisplay(booking) || booking.reservedBy || ''
    case 'contact':
      return booking.contact || ''
    case 'email':
      return booking.email || ''
    case 'approvalStatus':
      return booking.approvalStatus || 'pending'
    case 'status':
      return booking.status || ''
    case 'submitter':
      return formatBookingSubmitterDisplay(booking) || booking.submitter || ''
    case 'bookedOn':
      return parseBookedOnDateTime(booking.bookedOn).getTime()
    case 'teaService': {
      if (!isBookingTeaServiceYes(booking)) return 0
      const count = Number(
        booking.teaServiceParticipants ?? booking.attendeeCount ?? booking.participants
      )
      return Number.isFinite(count) ? 1 + count : 1
    }
    case 'displayOnHomepage': {
      if (!isBookingDisplayOnHomepageSupported(booking)) return -1
      return booking.displayOnHomepage !== false ? 1 : 0
    }
    case 'cancelledBy':
      return booking.cancelledBy || ''
    case 'cancelledAt':
      return booking.cancelledAt || ''
    default:
      return ''
  }
}

const sortBookingsList = (list) => {
  if (!sortState.value.length) return list.slice()
  return list.slice().sort((a, b) => {
    for (const criterion of sortState.value) {
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
  sortState.value = [{ key, order }]
  reloadBookingsAfterControlChange()
}

const clearSortByMenu = (key) => {
  sortState.value = sortState.value.filter(item => item.key !== key)
  reloadBookingsAfterControlChange()
}

const getFilterOptions = (key) => filterOptionsState.value[key] || []

const updateFilter = (key, value) => {
  columnFilterState.value[key] = Array.isArray(value) ? [...value] : []
  reloadBookingsAfterControlChange()
}

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

const allColumnsSelected = computed({
  get: () => columnsForTablePicker.value.every((col) => col.visible),
  set: (checked) => {
    columnsForTablePicker.value.forEach((col) => {
      col.visible = col.required ? true : checked
    })
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

const buildExportFileName = (range, label = '') => {
  const today = new Date().toISOString().split('T')[0]
  if (range && range.length === 2) {
    const [start, end] = range
    return `Venue_All_Bookings_${start}_to_${end}.xlsx`
  }
  if (label) {
    const safeLabel = String(label).replace(/\s+/g, '_')
    return `Venue_All_Bookings_${safeLabel}_${today}.xlsx`
  }
  return `Venue_All_Bookings_${today}.xlsx`
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
  showColumnsFilter.value = false
  document.removeEventListener('click', handleStatusFilterClickOutside)
  document.removeEventListener('mousedown', handleDateFilterClickOutside, true)
  document.removeEventListener('click', handleColumnsFilterClickOutside)

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

const getExportDepartment = (booking) => {
  if (booking?.department) return String(booking.department)
  const plainName = booking?.reservedByName || booking?.reservedBy || ''
  const matched = employeeList.value.find(
    (e) => e.name === plainName
      || (e.name && plainName && e.name.toLowerCase() === plainName.toLowerCase())
      || (booking?.corpId && e.corpId === booking.corpId)
      || (booking?.email && e.email === booking.email)
      || (booking?.employeeId != null && String(e.id) === String(booking.employeeId)),
  )
  return matched?.department || ''
}

const getExportParticipantCount = (booking) => {
  const count = booking?.attendees
    ?? booking?.attendeeCount
    ?? booking?.participants
    ?? booking?.teaServiceParticipants
    ?? booking?.teaService?.attendees
  const n = Number(count)
  return Number.isFinite(n) ? n : ''
}

const handleExportExcel = async (mode = 'current', quickValue) => {
  if (!isAdminAllBookingsView.value) return

  let fileName = buildExportFileName()
  let listParams
  if (mode === 'allDates') {
    fileName = buildExportFileName(null, 'All_Dates')
    listParams = buildVenueListParams({ all: true, dateOnly: true, dateRangeOverride: null })
  } else if (mode === 'quick') {
    const quickOption = quickDateOptions.find((option) => option.value === quickValue)
    const quickRange = getQuickDateRange(quickValue)
    fileName = buildExportFileName(quickRange, quickOption?.label)
    listParams = buildVenueListParams({ all: true, dateOnly: true, dateRangeOverride: quickRange })
  } else {
    if (dateRange.value && dateRange.value.length === 2) {
      fileName = buildExportFileName(dateRange.value)
    }
    listParams = buildVenueListParams({ all: true })
  }

  exportingExcel.value = true
  closeExportMenu()
  try {
    const data = await listVenueManageBookings(listParams)
    const rows = normalizeManageListResponse(data).items
    if (!rows.length) {
      showNotice('No bookings match the selected export range. Try another option.', 'Export Excel')
      return
    }
    const exportData = rows.map((booking, index) => ({
      '#': index + 1,
      'Booking ID': booking.id ?? '',
      'Date': booking.date || '',
      'Time': booking.time || '',
      'Venue': booking.room || '',
      'Meeting / Event': booking.topic || '',
      'Reserved By': formatBookingReservedByDisplay(booking) || booking.reservedBy || '',
      'Department / Unit': getExportDepartment(booking),
      'No. of participants': getExportParticipantCount(booking),
      'Contact No.': booking.contact || '',
      'Email': booking.email || '',
      'Status': formatStatus(booking.status || ''),
      'Approval': formatStatus(booking.approvalStatus || 'pending'),
      'Tea Service': formatTeaServiceStatus(booking),
      'Tea Special Requests': formatTeaSpecialRequest(booking),
      'Display on Homepage': formatDisplayOnHomepage(booking),
      'Submitted By': formatBookingSubmitterDisplay(booking) || booking.submitter || '',
      'Application Date': booking.bookedOn || '',
      'My Note': booking.myNote || '',
      'Cancelled by': formatCancelledBy(booking),
      'Cancelled At': formatCancelledAt(booking),
      'Reject Reason': booking.reason || booking.rejectReason || '',
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
  reloadBookingsAfterControlChange()
}, { deep: true })

watch(pageSize, () => {
  reloadBookingsAfterControlChange()
})

watch(() => editForm.value.date, () => {
  applyEditTeaServiceVisibilityRules()
})

watch(() => editForm.value.room, () => {
  applyEditTeaServiceVisibilityRules()
  applyEditUploadEventTitleVisibilityRules()
})

watch(() => editForm.value.teaServiceRequired, (yes) => {
  if (!yes) {
    editForm.value.teaServiceOption4 = false
    editForm.value.teaServiceSpecialRequest = ''
    return
  }
  if (!editForm.value.teaServiceOption || editForm.value.teaServiceOption === 'none' || editForm.value.teaServiceOption === '4') {
    editForm.value.teaServiceOption = '1'
  }
})

watch(() => editForm.value.teaServiceOption4, (on) => {
  if (!on) {
    editForm.value.teaServiceSpecialRequest = ''
  }
})

watch(() => editForm.value.teaServiceOption, (option) => {
  if (!['1', '2', '3'].includes(String(option || ''))) {
    editForm.value.teaServiceOption4 = false
    editForm.value.teaServiceSpecialRequest = ''
  }
})

/** Start ?????15 ?????? End Time ???? */
function nextVenueEndTimeAfter (startHm, endHour = 21, step = 15) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(startHm || '').trim())
  if (!m) return ''
  let total = Number(m[1]) * 60 + Number(m[2]) + step
  total = Math.ceil(total / step) * step
  const hour = Math.floor(total / 60)
  const minute = total % 60
  if (hour > endHour || (hour === endHour && minute > 0)) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(hour)}:${pad(minute)}`
}

watch(() => editForm.value.startTime, (start) => {
  clearEditAvailabilityIndicators()
  if (!start) {
    editForm.value.endTime = ''
    return
  }
  if (!editForm.value.endTime || editForm.value.endTime <= start) {
    editForm.value.endTime = nextVenueEndTimeAfter(start)
  }
})

watch(
  () => [editForm.value.room, editForm.value.date, editForm.value.startTime, editForm.value.endTime],
  () => {
    clearEditAvailabilityIndicators()
  }
)

// Format status to capitalize first letter
const formatStatus = (status) => {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

const getCardTitle = (booking) => {
  return booking?.title || booking?.topic || '-'
}

const isBookingTeaServiceYes = (booking) => {
  const flag = booking?.teaServiceRequired
  if (flag === true || flag === 1 || flag === 'true' || flag === '1') return true
  if (flag === false || flag === 0 || flag === 'false' || flag === '0') return false

  // ??????????option / summary ????????????? Yes
  const option = String(
    booking?.teaServiceOption ?? booking?.teaService?.option ?? ''
  ).trim()
  if (option === 'none') return false
  if (option === '1' || option === '2' || option === '3' || option === '4') return true

  const summary = String(booking?.teaServiceSummary || '').trim()
  if (!summary || summary === '-' || summary.startsWith('???')) return false
  return true
}

/** ???????? Yes (??) / No */
const formatTeaServiceCardLabel = (booking) => {
  if (!isBookingTeaServiceYes(booking)) return 'No'
  const count = booking.teaServiceParticipants ?? booking.attendeeCount ?? booking.participants
  const n = Number(count)
  return Number.isFinite(n) ? `Yes (${n})` : 'Yes'
}

const getTeaServiceSummaryText = (booking) => {
  const count = booking?.teaServiceParticipants ?? booking?.attendeeCount ?? booking?.participants
  if (booking?.teaService && typeof booking.teaService === 'object') {
    const text = formatTeaServiceDisplay(booking.teaService, count, { includeSpecialRequest: false })
    if (text && text !== '-') return text
  }
  const summary = stripTeaServiceSpecialSuffix(booking?.teaServiceSummary)
  if (summary && summary !== '-') return summary
  if (booking?.teaServiceRequired === true) return 'Tea service required'
  return ''
}

const formatTeaServiceStatus = (booking) => {
  const count = booking?.teaServiceParticipants ?? booking?.attendeeCount ?? booking?.participants
  if (!isBookingTeaServiceYes(booking)) {
    return formatTeaServiceDisplay({ option: 'none', attendees: count }, count)
  }
  if (booking?.teaService && typeof booking.teaService === 'object') {
    return formatTeaServiceDisplay(booking.teaService, count, { includeSpecialRequest: false })
  }
  const summary = stripTeaServiceSpecialSuffix(booking?.teaServiceSummary)
  if (summary) return summary
  return formatTeaServiceDisplay(booking?.teaService, count, { includeSpecialRequest: false })
}

const formatTeaSpecialRequest = (booking) => {
  const direct = String(booking?.teaServiceSpecialRequest || '').trim()
  if (direct) return direct
  let teaServiceObj = booking?.teaService
  if (typeof teaServiceObj === 'string') {
    try {
      teaServiceObj = JSON.parse(teaServiceObj)
    } catch {
      teaServiceObj = null
    }
  }
  const fromTeaService = String(
    teaServiceObj?.specialRequest || teaServiceObj?.notes || ''
  ).trim()
  if (fromTeaService) return fromTeaService
  return '-'
}

const formatApplicationDateForCard = (bookedOn) => {
  if (!bookedOn) return ''
  const text = String(bookedOn).trim()
  const parts = text.split(/\s+/)
  if (parts.length >= 3) {
    return `${parts[0]} ${parts[1]} ${parts[2]}`
  }
  return text
}

const formatCancelledBy = (booking) => {
  if (!isBookingCanceledStatus(booking?.status)) return '-'
  const name = String(booking?.cancelledBy || '').trim()
  return name || '-'
}

const formatCancelledAt = (booking) => {
  if (!isBookingCanceledStatus(booking?.status)) return '-'
  const text = String(booking?.cancelledAt || '').trim()
  return text || '-'
}

const isBookingDisplayOnHomepageSupported = (booking) => {
  if (booking?.userDefinedUploadEventTitle === false) return false
  const room = String(booking?.room || booking?.roomName || '').trim()
  if (room) {
    const venueMeta = editableVenueMeta.value.find((v) => v.name === room)
    if (venueMeta?.userDefinedUploadEventTitle === false) return false
  }
  return booking?.userDefinedUploadEventTitle !== false
}

const formatDisplayOnHomepage = (booking) => {
  if (!isBookingDisplayOnHomepageSupported(booking)) return '-'
  return booking?.displayOnHomepage !== false ? 'Yes' : 'No'
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
  const wrapper = document.querySelector('[data-filter="booking-status"]')
  if (!wrapper?.contains(event.target)) {
    showStatusFilter.value = false
    document.removeEventListener('click', handleStatusFilterClickOutside)
  }
}

// Toggle columns filter
const toggleColumnsFilter = (event) => {
  event.stopPropagation()
  closeExportMenu()
  showColumnsFilter.value = !showColumnsFilter.value

  if (showColumnsFilter.value) {
    setTimeout(() => {
      document.addEventListener('click', handleColumnsFilterClickOutside, { once: false })
    }, 0)
  } else {
    document.removeEventListener('click', handleColumnsFilterClickOutside)
  }
}

// Click outside to close columns filter
const handleColumnsFilterClickOutside = (event) => {
  const dropdown = document.querySelector('.columns-filter-dropdown')
  const filterBtn = event.target.closest('.columns-filter-wrapper')

  if (!dropdown?.contains(event.target) && !filterBtn) {
    showColumnsFilter.value = false
    document.removeEventListener('click', handleColumnsFilterClickOutside)
  }
}

// Toggle date filter
const toggleDateFilter = (event) => {
  event.stopPropagation()
  closeExportMenu()
  showDateFilter.value = !showDateFilter.value

  if (showDateFilter.value) {
    setTimeout(() => {
      document.addEventListener('mousedown', handleDateFilterClickOutside, true)
    }, 0)
  } else {
    document.removeEventListener('mousedown', handleDateFilterClickOutside, true)
  }
}

// Click outside to close date filter
const handleDateFilterClickOutside = (event) => {
  const target = event.target
  const dropdown = document.querySelector('.date-filter-dropdown')
  const filterWrapper = target.closest('.date-filter-wrapper')
  const inDatePicker = !!target.closest('.el-picker__popper')
  const path = typeof event.composedPath === 'function' ? event.composedPath() : []
  const inDropdownPath = dropdown ? path.includes(dropdown) : false

  if (!inDatePicker && !filterWrapper && !inDropdownPath) {
    showDateFilter.value = false
    document.removeEventListener('mousedown', handleDateFilterClickOutside, true)
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
  const booking = bookings.value.find(b => b.id === id)
  if (!booking) return
  if (isBookingCanceledStatus(booking.status)) {
    showNotice('Cancelled bookings cannot be restored.', 'Warning')
    return
  }
  if (!canManageBookingCancel(booking)) {
    showNotice(
      isAdminAllBookingsView.value
        ? 'Only upcoming bookings can be released.'
        : 'Only bookings before meeting start time can be cancelled.',
      'Warning'
    )
    return
  }
  cancelBookingId.value = id
  showCancelDialog.value = true
}

const confirmCancel = async () => {
  const booking = bookings.value.find(b => b.id === cancelBookingId.value)
  if (!booking) return
  if (isBookingCanceledStatus(booking.status) || !canManageBookingCancel(booking)) {
    showCancelDialog.value = false
    showNotice(
      isAdminAllBookingsView.value
        ? 'Only upcoming bookings can be released.'
        : 'Only bookings before meeting start time can be cancelled.',
      'Warning'
    )
    return
  }

  try {
    await toggleVenueManageBookingCancel(String(booking.id))
    await Promise.all([
      loadBookings(),
      userStore.refreshSessionUser()
    ])
    showCancelDialog.value = false
    showNotice(
      isAdminAllBookingsView.value
        ? 'Venue booking released successfully!'
        : 'Venue booking cancelled successfully!',
      'Success'
    )
  } catch (error) {
    showNotice(
      getErrorMessage(
        error,
        isAdminAllBookingsView.value ? 'Failed to release booking' : 'Failed to cancel booking'
      ),
      'Error'
    )
  }
}

const editBooking = (id) => {
  const booking = bookings.value.find(b => b.id === id)
  if (!booking || !canShowEditButton(booking)) return
  const [startTime = '', endTime = ''] = String(booking.time || '').split(' - ')
  currentEditBookingId.value = id
  currentEditBookingApprovalStatus.value = booking.approvalStatus || ''
  const teaFields = resolveEditTeaFields(booking)
  editTeaSelectionSnapshot.value = snapshotEditTeaSelection(teaFields)
  const bookingDate = parseDisplayDateToIso(booking.date)
  editScheduleSnapshot.value = {
    room: booking.room || '',
    date: bookingDate,
    startTime: startTime.trim(),
    endTime: endTime.trim()
  }
  editForm.value = {
    room: booking.room || '',
    topic: booking.topic || '',
    myNote: booking.myNote || booking.note || booking.remark || '',
    date: bookingDate,
    startTime: startTime.trim(),
    endTime: endTime.trim(),
    teaServiceRequired: Boolean(booking.teaServiceRequired),
    teaServiceParticipants: booking.teaServiceParticipants || booking.attendeeCount || 1,
    displayOnHomepage: booking.displayOnHomepage !== false,
    ...teaFields
  }
  applyEditTeaServiceVisibilityRules()
  applyEditUploadEventTitleVisibilityRules()
  updateEditBookingModalHeightPx()
  showEditDialog.value = true
}

const confirmEditBooking = async () => {
  const id = currentEditBookingId.value
  if (id == null) return

  // Approved?????? My Note
  if (isEditApprovedOnlyNote.value) {
    try {
      await updateVenueManageBooking(String(id), {
        myNote: editForm.value.myNote?.trim() || ''
      })
      await loadBookings()
      showEditDialog.value = false
      currentEditBookingId.value = null
      currentEditBookingApprovalStatus.value = ''
      showNotice('Booking updated successfully', 'Success')
    } catch (error) {
      showNotice(getErrorMessage(error, 'Failed to update booking'), 'Error')
    }
    return
  }

  if (!editForm.value.topic.trim()) {
    showNotice('Please enter Meeting / Event', 'Warning')
    return
  }
  if (isMeetingEventTitleTooLong(editForm.value.topic.trim(), meetingEventTitleMaxLength.value)) {
    showNotice(meetingEventTitleTooLongMessage(meetingEventTitleMaxLength.value), 'Warning')
    return
  }
  const schedule = isEditScheduleLocked.value
    ? editScheduleSnapshot.value
    : {
        date: editForm.value.date,
        startTime: editForm.value.startTime,
        endTime: editForm.value.endTime
      }
  if (!schedule.date) {
    showNotice('Please select Booking Date', 'Warning')
    return
  }
  if (!isEditScheduleLocked.value) {
    const dateRangeCheck = validateVenueBookingDateRange(
      schedule.date,
      venueBookingWindow.value.currentStartDate,
      venueBookingWindow.value.currentEndDate
    )
    if (!dateRangeCheck.ok) {
      showNotice(dateRangeCheck.message, 'Warning')
      return
    }
  }
  if (!schedule.startTime || !schedule.endTime) {
    showNotice('Please select Start Time and End Time', 'Warning')
    return
  }
  if (schedule.startTime >= schedule.endTime) {
    showNotice('End Time must be later than Start Time', 'Warning')
    return
  }
  if (
    editForm.value.teaServiceRequired &&
    isEditTeaServiceUnavailable.value &&
    !isSameEditTeaSelection(editForm.value, editTeaSelectionSnapshot.value)
  ) {
    showNotice('Near-date bookings cannot change tea service options. You can only cancel Tea Service.', 'Warning')
    return
  }
  const teaCheck = validateTeaServiceForm({
    ...editForm.value,
    attendeeCount: editForm.value.teaServiceParticipants
  }, { isAdmin: isAdmin.value })
  if (!teaCheck.ok) {
    showNotice(teaCheck.message, 'Warning')
    return
  }
  const teaPayload = buildTeaServiceApiPayload({
    ...editForm.value,
    attendeeCount: editForm.value.teaServiceParticipants
  })
  applyEditUploadEventTitleVisibilityRules()
  try {
    await updateVenueManageBooking(String(id), {
      room: isEditScheduleLocked.value ? editScheduleSnapshot.value.room : editForm.value.room,
      topic: editForm.value.topic.trim(),
      myNote: editForm.value.myNote?.trim() || '',
      date: schedule.date,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      teaServiceRequired: Boolean(teaPayload.teaServiceRequired),
      teaServiceOption: teaPayload.teaServiceOption,
      teaServiceRatioFrom: teaPayload.teaServiceRatioFrom,
      teaServiceRatioTo: teaPayload.teaServiceRatioTo,
      teaServiceTeaPots: teaPayload.teaServiceTeaPots,
      teaServiceWaterPots: teaPayload.teaServiceWaterPots,
      teaServiceParticipants: editForm.value.teaServiceParticipants || 1,
      teaServiceSpecialRequest: teaPayload.teaServiceSpecialRequest || '',
      displayOnHomepage: editForm.value.displayOnHomepage !== false
    })
    await loadBookings()
    showEditDialog.value = false
    currentEditBookingId.value = null
    currentEditBookingApprovalStatus.value = ''
    editTeaSelectionSnapshot.value = snapshotEditTeaSelection({
      teaServiceOption: '1',
      teaServiceRatioFrom: null,
      teaServiceRatioTo: null,
      teaServiceTeaPots: null,
      teaServiceWaterPots: null,
      teaServiceSpecialRequest: ''
    })
    showNotice('Booking updated successfully', 'Success')
  } catch (error) {
    showNotice(getErrorMessage(error, 'Failed to update booking'), 'Error')
  }
}

function openHandleBooking (booking) {
  if (booking.status !== 'upcoming') return
  currentHandleBookingId.value = booking.id
  const name = booking.reservedByName || booking.reservedBy || ''
  const matched = employeeList.value.find(
    (e) =>
      (booking.employeeId != null && String(e.id) === String(booking.employeeId))
      || (booking.corpId && e.corpId === booking.corpId)
      || e.name === name
      || (e.name && name && e.name.toLowerCase() === name.toLowerCase())
  )
  const venueMeta = editableVenueMeta.value.find((v) => v.name === booking.room)
  const uploadEnabled =
    booking.userDefinedUploadEventTitle !== false &&
    (venueMeta == null || venueMeta.userDefinedUploadEventTitle !== false)
  handleForm.value = {
    room: booking.room || '',
    topic: booking.topic || '',
    date: booking.date || '',
    time: booking.time || '',
    participantCount: booking.teaServiceParticipants
      ?? booking.attendeeCount
      ?? booking.participants
      ?? booking.teaService?.attendees
      ?? '-',
    teaService: formatTeaServiceStatus(booking),
    userName: name,
    departmentUnit: matched?.department || booking.department || '-',
    contactPhone: booking.contact || '-',
    contactEmail: booking.email || '-',
    displayOnHomepage: booking.displayOnHomepage !== false,
    userDefinedUploadEventTitle: uploadEnabled
  }
  showHandleDialog.value = true
}

function openRejectBookingDialog () {
  if (currentHandleBookingId.value == null) return
  rejectBookingForm.value.selectedTemplateId = null
  rejectBookingForm.value.reason = ''
  showRejectBookingDialog.value = true
}

function closeRejectBookingDialog () {
  showRejectBookingDialog.value = false
}

async function confirmHandleApprove () {
  const id = currentHandleBookingId.value
  if (id == null) return
  const topic = handleForm.value.topic.trim()
  if (isMeetingEventTitleTooLong(topic, meetingEventTitleMaxLength.value)) {
    showNotice(meetingEventTitleTooLongMessage(meetingEventTitleMaxLength.value), 'Warning')
    return
  }
  try {
    await approveVenueManageBooking(String(id), {
      topic,
      displayOnHomepage: handleForm.value.displayOnHomepage !== false
    })
    showHandleDialog.value = false
    currentHandleBookingId.value = null
    await loadBookings()
    await adminStore.fetchPendingCounts()
    notifyAdminPendingUpdated({ source: 'bookings' })
    showNotice('Booking approved successfully', 'Success')
  } catch (error) {
    showNotice(getErrorMessage(error, 'Failed to approve booking'), 'Error')
  }
}

async function confirmRejectBooking () {
  if (!rejectBookingForm.value.reason.trim()) {
    showNotice('Please provide a reason for rejection', 'Warning')
    return
  }
  const id = currentHandleBookingId.value
  if (id == null) return
  const topic = handleForm.value.topic.trim()
  if (isMeetingEventTitleTooLong(topic, meetingEventTitleMaxLength.value)) {
    showNotice(meetingEventTitleTooLongMessage(meetingEventTitleMaxLength.value), 'Warning')
    return
  }
  try {
    await rejectVenueManageBooking(String(id), {
      topic,
      reason: rejectBookingForm.value.reason.trim(),
      displayOnHomepage: handleForm.value.displayOnHomepage !== false
    })
    showRejectBookingDialog.value = false
    showHandleDialog.value = false
    currentHandleBookingId.value = null
    await loadBookings()
    await adminStore.fetchPendingCounts()
    notifyAdminPendingUpdated({ source: 'bookings' })
    showNotice('Booking rejected', 'Success')
  } catch (error) {
    showNotice(getErrorMessage(error, 'Failed to reject booking'), 'Error')
  }
}

const loadBookings = async ({ includeOptions = true } = {}) => {
  bookingsLoading.value = true
  try {
    const data = await listVenueManageBookings(buildVenueListParams({ includeOptions }))
    const { items, total, filterOptions } = normalizeManageListResponse(data)
    bookings.value = items
    bookingsTotal.value = total
    if (filterOptions) {
      const normalizePersonOptions = (list) => {
        if (!Array.isArray(list)) return []
        return list.map((item) => {
          if (item && typeof item === 'object' && 'value' in item) {
            return { value: String(item.value), label: String(item.label ?? item.value) }
          }
          return { value: String(item), label: String(item) }
        })
      }
      filterOptionsState.value = {
        room: Array.isArray(filterOptions.venues) ? filterOptions.venues : [],
        reservedBy: normalizePersonOptions(filterOptions.reservedBy),
        status: ['upcoming', 'past', 'cancelled'],
        approvalStatus: filterOptionsState.value.approvalStatus || [],
        submitter: normalizePersonOptions(filterOptions.submitters)
      }
    }
  } catch (error) {
    bookings.value = []
    bookingsTotal.value = 0
    showNotice(getErrorMessage(error, 'Failed to load venue bookings'), 'Error')
  } finally {
    bookingsLoading.value = false
  }
}

const loadRejectPrompts = async () => {
  try {
    const data = await getPrompts({ category: 'reject_template' })
    promptList.value = Array.isArray(data) ? data : []
  } catch {
    promptList.value = []
  }
}

const loadSystemFixedPrompts = async () => {
  try {
    const data = await getPrompts({ category: 'system_fixed' })
    systemFixedPromptList.value = Array.isArray(data) ? data : []
  } catch {
    systemFixedPromptList.value = []
  }
}

const loadEditableVenues = async () => {
  try {
    const venues = await getVenueManagementVenues()
    editableVenueMeta.value = Array.isArray(venues)
      ? venues
        .filter((v) => String(v?.status || '').toLowerCase() !== 'inactive')
        .map((v) => ({
          id: v?.id,
          name: String(v?.name || '').trim(),
          color: String(v?.color || '#3b82f6').trim() || '#3b82f6',
          roomCapacity: v?.roomCapacity ?? null,
          teaServiceAvailable: v?.teaServiceAvailable !== false,
          userDefinedUploadEventTitle: v?.userDefinedUploadEventTitle !== false
        }))
        .filter((v) => v.name)
      : []
  } catch {
    editableVenueMeta.value = []
  }
}

const loadVenueBookingWindow = async () => {
  try {
    const window = await getVenueBookingWindow()
    if (window?.currentStartDate && window?.currentEndDate) {
      venueBookingWindow.value = {
        currentStartDate: window.currentStartDate,
        currentEndDate: window.currentEndDate
      }
    }
  } catch {
    // keep previous / empty; submit validation will still warn if empty
  }
}

watch(bookingView, () => {
  closeExportMenu()
  if (isAdmin.value) {
    currentPage.value = 1
    void loadBookings({ includeOptions: true })
  }
})

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
  [currentView, availableColumns, isActionsTableColumnVisible, isAdminAllBookingsView, paginatedBookings],
  async () => {
    if (currentView.value !== 'table') return
    await nextTick()
    updateTableScrollShadows()
  },
  { deep: true }
)

onMounted(() => {
  updateHandleBookingModalMaxHeight()
  updateRejectBookingSelectTeleported()
  updateCardPopoverTeleported()
  handleBookingModalMq = window.matchMedia(HANDLE_BOOKING_MODAL_MQ)
  handleBookingModalMq.addEventListener('change', updateHandleBookingModalMaxHeight)
  rejectBookingSelectMq = window.matchMedia(REJECT_BOOKING_SELECT_MQ)
  rejectBookingSelectMq.addEventListener('change', updateRejectBookingSelectTeleported)
  cardPopoverTeleportedMq = window.matchMedia(HTML_ZOOM_BREAKPOINT_MQ)
  cardPopoverTeleportedMq.addEventListener('change', updateCardPopoverTeleported)
  window.addEventListener('resize', updateTableScrollShadows, { passive: true })
  window.addEventListener('resize', updateEditBookingModalHeightPx, { passive: true })
  void fetchMeetingEventTitleMaxLength().then((maxLength) => {
    meetingEventTitleMaxLength.value = maxLength
  })
  void loadBookings()
  void loadRejectPrompts()
  void loadSystemFixedPrompts()
  void loadEditableVenues()
  void loadVenueBookingWindow()
  void loadHolidays()
  nextTick(() => updateTableScrollShadows())
})

onUnmounted(() => {
  if (handleBookingModalMq) {
    handleBookingModalMq.removeEventListener('change', updateHandleBookingModalMaxHeight)
  }
  if (rejectBookingSelectMq) {
    rejectBookingSelectMq.removeEventListener('change', updateRejectBookingSelectTeleported)
  }
  if (cardPopoverTeleportedMq) {
    cardPopoverTeleportedMq.removeEventListener('change', updateCardPopoverTeleported)
  }
  window.removeEventListener('resize', updateEditBookingModalHeightPx)
  window.removeEventListener('resize', updateTableScrollShadows)
  document.removeEventListener('mousedown', handleDateFilterClickOutside, true)
  document.removeEventListener('click', handleExportMenuClickOutside)
})
</script>

<style scoped>
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


.filter-select {
  padding: 0.375rem 0.625rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  color: #374151;
  background-color: white;
  cursor: pointer;
  min-width: 130px;
}

.filter-select:focus {
  outline: none;
  border-color: #00723a;
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

.date-range-picker :deep(.el-date-editor) {
  width: 100%;
  border: 2px solid #d1d5db;
  border-radius: 0.375rem;
  transition: all 0.2s;
}

.date-range-picker :deep(.el-date-editor:hover) {
  border-color: #00723a;
}

.date-range-picker :deep(.el-date-editor.is-active) {
  border-color: #00723a;
  box-shadow: 0 0 0 3px rgba(0, 114, 58, 0.1);
}

.date-range-picker :deep(.el-date-editor .el-range-input) {
  font-size: 0.8125rem;
  color: #111827;
}

.date-range-picker :deep(.el-date-editor .el-range-separator) {
  font-size: 0.75rem;
  color: #00723a;
  font-weight: 600;
}

.date-range-picker :deep(.el-date-editor .el-range__icon) {
  color: #00723a;
}

.date-range-picker :deep(.el-date-editor .el-range__close-icon) {
  color: #ef4444;
}

.export-excel-wrapper {
  position: relative;
  flex-shrink: 0;
}

.export-excel-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: 34px;
  padding: 0 0.65rem;
  border: 1px solid #86c8a3;
  border-radius: 0.375rem;
  background: #f5fbf7;
  color: #14532d;
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.2s;
}

.export-excel-btn > span {
  white-space: nowrap;
}

.export-excel-label-short {
  display: none;
}

/* 中宽屏 / 0.86 缩放区间：空间紧时只显示 Excel */
@media screen and (max-width: 1599px) {
  .export-excel-label-full {
    display: none;
  }

  .export-excel-label-short {
    display: inline;
  }
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
  padding: 0.75rem;
  background-color: white;
  transition: box-shadow 0.2s;
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

/* teleported=false??????zoom ?? DOM ????????????????*/
.booking-card-popover.el-popper,
.booking-card-tea-popover.el-popper {
  z-index: 100;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
  gap: 0.5rem;
  background-color: #f3f4f6;
  padding: 0.5rem;
  margin: -0.75rem -0.75rem 0.5rem -0.75rem;
  border-bottom: 2px solid #d1d5db;
}

.card-header-right {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.card-info-btn {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 9999px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #6b7280;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}

.card-info-btn:hover {
  color: #00723a;
  border-color: #00723a;
}

.booking-popover-content {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  font-size: 0.75rem;
}

.booking-popover-row {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  align-items: flex-start;
  gap: 0.5rem;
}

.booking-popover-row .popover-label {
  color: #6b7280;
  white-space: nowrap;
}

.booking-popover-row .popover-value {
  color: #000 !important;
  text-align: right;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  font-weight: 400;
  min-width: 0;
}

.booking-popover-row .status-badge {
  justify-self: end;
}

.card-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
  flex: 1;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
}

.card-approval-badge {
  padding: 0.125rem 0.4375rem;
  font-size: 0.625rem;
  width: auto;
  min-width: 4rem;
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

.badge-approval-approved {
  background-color: #d1fae5;
  color: #065f46;
}

.badge-approval-rejected {
  background-color: #fee2e2;
  color: #991b1b;
}

.badge-approval-pending {
  background-color: #fef3c7;
  color: #92400e;
}

.badge-display-homepage-yes {
  background-color: #dcfce7;
  color: #166534;
}

.badge-display-homepage-no {
  background-color: #f3f4f6;
  color: #6b7280;
}

.badge-tea-service-yes {
  background-color: #ccfbf1;
  color: #0f766e;
}

.badge-tea-service-no {
  background-color: #f3f4f6;
  color: #6b7280;
}

.tea-service-badge,
.table-tea-service-badge,
.card-tea-service-badge {
  width: auto;
  min-width: 0;
  padding: 0.125rem 0.4375rem;
  text-align: center;
}

.card-tea-service-badge {
  font-size: 0.625rem;
}

.tea-service-badge--interactive {
  cursor: help;
}

.tea-service-badge--interactive:hover {
  filter: brightness(0.97);
}

.display-homepage-badge,
.card-display-homepage-badge {
  width: auto;
  min-width: 0;
  padding: 0.125rem 0.4rem;
  text-align: center;
}

.card-display-homepage-badge {
  font-size: 0.625rem;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 0.3125rem;
  margin-bottom: 0.625rem;
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

.tea-service-label {
  white-space: nowrap;
}

.application-date-label {
  white-space: nowrap;
}

.tea-service-value {
  margin-left: 0.5rem;
}

.tea-service-popover-detail {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: #111827;
}

.tea-service-popover-line {
  margin: 0;
}

.tea-service-popover-special {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tea-service-popover-label {
  color: #6b7280;
  font-weight: 600;
}

.tea-service-popover-text {
  word-break: break-word;
}

/* Edit dialog ??tea options aligned with VenueBookingDialog.vue */
.edit-tea-service-note {
  margin: 0 0 0.5rem 0;
  font-size: 0.8125rem;
  color: #b45309;
  line-height: 1.4;
}

.edit-booking-form {
  max-width: 720px;
  margin: 0 auto;
}

.edit-booking-form :deep(.el-form-item) {
  margin-bottom: 14px;
}

.edit-booking-form :deep(.el-form-item__label) {
  white-space: nowrap;
  padding-left: 20px;
  justify-content: flex-end;
}

.edit-venue-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.edit-venue-option-name {
  color: #111827;
}

.edit-venue-option-cap {
  margin-left: auto;
  font-size: 0.75rem;
  color: #6b7280;
}

.edit-room-color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 0 0 1px rgba(107, 114, 128, 0.35);
  flex-shrink: 0;
}

:deep(.edit-booking-room-select .el-select-dropdown__item) {
  height: 34px;
  line-height: 34px;
}

:deep(.edit-venue-time-picker-popper) {
  z-index: 100001 !important;
}

.edit-booking-form :deep(.form-row .el-form-item__content) {
  overflow: visible;
}

.edit-booking-form :deep(.el-date-editor .el-input__wrapper) {
  box-shadow: 0 0 0 1px #d1d5db inset !important;
}

.edit-booking-form :deep(.el-date-editor .el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #9ca3af inset !important;
}

.field-with-availability {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.field-with-availability__control {
  flex: 1;
  min-width: 0;
}

.field-with-availability__control.el-date-editor,
.field-with-availability :deep(.venue-edit-time-picker.el-date-editor),
.field-with-availability :deep(.venue-edit-time-picker.el-input),
.field-with-availability :deep(.venue-edit-time-picker .el-input),
.field-with-availability :deep(.venue-step-time-picker) {
  width: 100%;
}

.availability-ok,
.availability-fail {
  width: 20px;
  min-width: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
  font-weight: 700;
}

.availability-ok {
  color: #16a34a;
}

.availability-fail {
  color: #dc2626;
}

.edit-check-availability-item {
  margin-bottom: 10px;
}

.check-btn {
  width: 100%;
  background-color: #3b82f6;
  border-color: #3b82f6;
  font-weight: 700;
  font-size: 0.8125rem;
  color: #ffffff;
}

.check-btn:hover {
  background-color: #66b1ff;
  border-color: #66b1ff;
  color: #ffffff;
}

.edit-tea-service-box {
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  margin-bottom: 0.5rem;
  font-size: 14px;
  line-height: 1.45;
  text-align: left;
}

.edit-tea-service-options {
  margin-bottom: 0;
}

.edit-tea-service-options .tea-service-prompt {
  margin: 0 0 0.75rem;
  font-style: italic;
  font-weight: 700;
  font-size: inherit;
  color: #111827;
  text-align: left;
}

.edit-tea-service-options .tea-service-option-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  align-items: flex-start;
  font-size: 14px;
  line-height: 1.45;
}

.edit-tea-service-options .tea-service-option-group :deep(.el-radio) {
  height: auto;
  margin-right: 0;
  align-items: flex-start;
}

.edit-tea-service-options .tea-service-option-group :deep(.el-radio__label) {
  white-space: normal;
  line-height: inherit;
  font-size: inherit;
  padding-left: 0.5rem;
}

.edit-tea-service-options .tea-service-option-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 0.5rem;
  width: 100%;
  text-align: left;
}

.edit-tea-service-options .tea-service-option-row--stacked {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

.edit-tea-service-options .tea-service-option4 {
  margin-top: 0.35rem;
  padding-top: 0.35rem;
  border-top: 1px dashed #e5e7eb;
  width: 100%;
}

.edit-tea-service-options .tea-service-option4 :deep(.el-checkbox) {
  align-items: flex-start;
  height: auto;
  white-space: normal;
}

.edit-tea-service-options .tea-service-option4 :deep(.el-checkbox__label) {
  white-space: normal;
  line-height: 1.4;
}

.edit-tea-service-options .tea-option-label,
.edit-tea-service-options .tea-option-zh,
.edit-tea-service-options .tea-inline-text {
  font-size: inherit;
  line-height: inherit;
}

.edit-tea-service-options .tea-option-label {
  font-weight: 500;
  color: #111827;
}

.edit-tea-service-options .tea-option-zh {
  color: #374151;
}

.edit-tea-service-options .tea-option-zh--required {
  color: #dc2626;
}

.edit-tea-service-options .tea-inline-number {
  width: 88px;
}

.edit-tea-service-options .tea-inline-number :deep(.el-input__inner) {
  font-size: inherit;
}

.edit-tea-service-options .tea-inline-text {
  color: #111827;
  flex-shrink: 0;
}

.edit-tea-service-options .tea-service-option-row--stacked .tea-service-special-textarea {
  margin-left: 0;
  width: 100%;
}

.edit-tea-service-options .tea-service-special-textarea :deep(.el-textarea__inner) {
  line-height: inherit;
  font-size: inherit;
}

.edit-participants-hint {
  margin: 0 0 0.25rem 0;
  font-size: 0.75rem;
  color: #9ca3af;
  line-height: 1.2;
}

.edit-tea-line :deep(.el-form-item__label) {
  justify-content: flex-end;
  text-align: right;
  white-space: nowrap;
}

.display-title-public-item :deep(.el-form-item__label) {
  display: none;
}

.meeting-title-textarea :deep(.el-textarea__inner) {
  line-height: 1.4;
  max-height: calc(1.4em * 4 + 1rem);
  overflow-y: auto;
  word-break: break-word;
  resize: none;
}

.display-title-public-item :deep(.el-form-item__content) {
  margin-left: 0 !important;
  justify-content: flex-start !important;
}

.display-title-public-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 0.75rem 1.25rem;
  width: fit-content;
  max-width: 100%;
}

.display-title-public-label {
  flex: 0 1 auto;
  white-space: normal;
  color: #2c2c2c;
  font-size: inherit;
  font-weight: 500;
  line-height: 1.4;
  text-align: left;
}

.display-title-public-item :deep(.el-radio-group) {
  flex: 0 0 auto;
  display: inline-flex;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.edit-tea-line--with-hint :deep(.el-form-item__label) {
  overflow: visible;
}

.service-label-with-icon--edit {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
  white-space: nowrap;
}

.service-info-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.service-info-icon {
  color: #3b82f6;
}

.service-info-icon:hover {
  color: #2563eb;
}

.edit-tea-line :deep(.el-form-item__content) {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.card-footer {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
  min-height: 24px;
  margin-top: auto;
}

.card-footer-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.card-footer > .btn-action,
.card-footer-actions .btn-action {
  padding-top: 0.125rem;
  padding-bottom: 0.125rem;
}

.reason-row {
  display: flex;
  gap: 0.25rem;
  font-size: 0.75rem;
  align-items: flex-start;
}

.reason-label {
  color: #6b7280;
  font-weight: 500;
  flex-shrink: 0;
}

.reason-text {
  color: #111827;
  font-weight: 400;
  flex: 1;
  word-break: break-word;
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
  align-self: flex-end;
}

.btn-cancel:hover {
  background-color: #dc2626;
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
  width: max-content;
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.8125rem;
}

.bookings-table thead {
  background-color: #f3f4f6;
  color: #374151;
}

.bookings-table th {
  padding: 0.5rem;
  text-align: left;
  font-weight: 600;
  white-space: nowrap;
  font-size: 0.8125rem;
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: #f3f4f6;
  border-bottom: 2px solid #d1d5db;
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

.bookings-table th.col-venue,
.bookings-table td.col-venue {
  min-width: 180px;
  white-space: nowrap;
}

.bookings-table th.col-topic,
.bookings-table td.col-topic {
  width: 400px;
  min-width: 400px;
  max-width: 400px;
  box-sizing: border-box;
}

.bookings-table td.col-topic {
  word-break: break-word;
  white-space: normal;
  overflow-wrap: anywhere;
}

.bookings-table th.col-mynote,
.bookings-table td.col-mynote {
  width: 260px;
  min-width: 220px;
  max-width: 280px;
  box-sizing: border-box;
}

.bookings-table th.col-tea-service,
.bookings-table td.col-tea-service {
  text-align: center;
  white-space: nowrap;
}

.bookings-table th.col-tea-service .th-sort-btn {
  justify-content: center;
}

.bookings-table th.col-display-homepage,
.bookings-table td.col-display-homepage {
  text-align: center;
  width: 90px;
  min-width: 90px;
  max-width: 90px;
  padding-left: 0.25rem;
  padding-right: 0.25rem;
  white-space: normal;
}

.bookings-table th.col-display-homepage .th-sort-btn {
  justify-content: center;
}

.bookings-table th.col-display-homepage .th-sort-btn--stacked {
  align-items: center;
  gap: 0.28rem;
  white-space: normal;
}

.bookings-table th.col-display-homepage .display-homepage-header {
  display: inline-block;
  line-height: 1.25;
  font-size: 0.75rem;
  text-align: center;
}

.bookings-table td.col-mynote {
  vertical-align: top;
}

.col-mynote-text {
  display: block;
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.35;
}

.bookings-table th.col-datetime {
  width: 140px;
  min-width: 140px;
}

.bookings-table th.col-no {
  width: 50px;
  min-width: 50px;
  text-align: center;
  position: sticky;
  left: 0;
  top: 0;
  z-index: 15;
  background-color: #f3f4f6;
  box-shadow: none;
}

.table-wrapper.is-scrolled-left .bookings-table th.col-no,
.table-wrapper.is-scrolled-left .bookings-table .no-cell {
  box-shadow: 6px 0 8px -4px rgba(15, 23, 42, 0.12);
}

.bookings-table th.col-actions {
  width: 155px;
  min-width: 155px;
  max-width: 155px;
  text-align: center;
  position: sticky;
  top: 0;
  right: 0;
  background-color: #f3f4f6;
  z-index: 14;
  box-sizing: border-box;
  box-shadow: none;
}

.table-wrapper.is-scrolled-right .bookings-table th.col-actions,
.table-wrapper.is-scrolled-right .bookings-table td.actions-td {
  box-shadow: -6px 0 8px -4px rgba(15, 23, 42, 0.12);
}

.bookings-table th.col-actions--compact {
  width: 140px;
  min-width: 140px;
  max-width: 140px;
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
  width: 155px;
  min-width: 155px;
  max-width: 155px;
  box-sizing: border-box;
  z-index: 9;
  box-shadow: none;
}

.bookings-table td.actions-td--compact {
  width: 140px;
  min-width: 140px;
  max-width: 140px;
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

.btn-approve {
  background-color: #00723a;
  color: white;
}

.btn-approve:hover {
  background-color: #005a2e;
}

.btn-edit {
  background-color: #f97316;
  color: white;
}

.btn-edit:hover {
  background-color: #ea580c;
}

.btn-cancel-small {
  background-color: #ef4444;
  color: white;
}

.btn-cancel-small:hover {
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

/* Columns Filter */
.columns-filter-wrapper {
  position: relative;
  display: inline-block;
}

.columns-filter-btn {
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
}

.columns-filter-btn .arrow-icon {
  transition: transform 0.2s;
}

.columns-filter-btn:hover {
  background-color: #f3f4f6;
  border-color: #9ca3af;
}

.columns-filter-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  z-index: 1000;
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  border: 1px solid #e5e7eb;
  min-width: 200px;
  animation: slideDown 0.2s ease-out;
}

.columns-filter-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.columns-filter-header .filter-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #111827;
}

.columns-filter-body {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.column-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.875rem;
  color: #374151;
}

.column-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #00723a;
}

.column-checkbox input[type="checkbox"]:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.column-checkbox:hover {
  color: #00723a;
}

/* Pagination */
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* padding: 0.1875rem 1rem; */
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
  /* margin-top: 6px; */
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

.cancel-message {
  margin-bottom: 1rem;
  color: #374151;
  font-size: 0.875rem;
}

.edit-info-message {
  margin: 0;
  color: #374151;
  font-size: 0.9375rem;
  line-height: 1.5;
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

  .toolbar-left,
  .toolbar-right {
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

  .bookings-table {
    font-size: 0.75rem;
  }

  .bookings-table th,
  .bookings-table td {
    padding: 0.5rem;
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

/* Handle Booking ???? MeetingApproval ????*/
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

.action-approve {
  background-color: #00723a !important;
}

.action-approve:hover {
  background-color: #005a2e !important;
}

.action-delete {
  background-color: #ef4444 !important;
}

.action-delete:hover {
  background-color: #dc2626 !important;
}

.action-confirm {
  background-color: #00723a !important;
}

.action-confirm:hover {
  background-color: #005a2e !important;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.form-item-half {
  margin-bottom: 0;
}

.form-item-half.no-label-desktop :deep(.el-form-item__label) {
  display: none;
}

.form-item-half.no-label-desktop :deep(.el-form-item__content) {
  margin-left: 0 !important;
}

.contact-info-section {
  background-color: #f3f4f6;
  padding: 0.75rem 0.75rem 0.25rem 1.25rem;
  border-radius: 0.375rem;
  margin-bottom: 0.5rem;
}

.contact-info-section :deep(.el-form-item__label) {
  white-space: nowrap;
}

.contact-info-section :deep(.el-form-item__content) {
  min-width: 0;
}

.contact-info-section :deep(.el-input) {
  width: 96%;
  max-width: 100%;
}

.handle-booking-form :deep(.no-wrap-label .el-form-item__label) {
  white-space: nowrap;
}

.reject-booking-form :deep(.el-form-item__label) {
  white-space: nowrap;
  padding-right: 8px;
}

.cancel-confirm-message {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.6;
  color: #374151;
}

.notice-message {
  margin: 0;
  font-size: 0.9rem;
  color: #374151;
  line-height: 1.6;
}
</style>

/* Edit Booking ????????????????*/
<style>
.edit-booking-date-popper.el-picker__popper[data-popper-placement^='bottom'] .el-popper__arrow {
  left: 50% !important;
  right: auto !important;
  transform: translateX(-50%) !important;
}

.edit-venue-time-picker-popper {
  z-index: 100001 !important;
}

.reject-booking-template-select-popper.el-select-dropdown .el-select-dropdown__wrap {
  max-height: min(42vh, 300px) !important;
}

.reject-booking-template-select-popper.el-select-dropdown .el-scrollbar__wrap {
  max-height: min(42vh, 300px) !important;
}

.reject-booking-template-select-popper.el-select-dropdown .el-select-dropdown__list {
  padding-bottom: 8px;
}

.venue-booking-prompt-tooltip {
  z-index: 100001 !important;
  box-sizing: border-box;
  width: fit-content !important;
  max-width: min(320px, 90vw) !important;
  white-space: pre-line;
  overflow-wrap: break-word;
  word-break: break-word;
  line-height: 1.45;
  text-align: left;
}
</style>
