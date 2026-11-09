<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">Meeting Approval</h2>
      <div class="header-actions">
        <el-input v-model="currentSearch" placeholder="Search current table data" clearable class="toolbar-search" />
        <div class="date-filter-wrapper">
          <button class="date-filter-btn" @click="toggleDateFilter">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" class="calendar-icon">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span>{{ dateFilterLabel }}</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" class="arrow-icon">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          <div v-if="showDateFilter" class="date-filter-dropdown" @click.stop>
            <div class="date-filter-header">
              <span class="filter-title">Select date range:</span>
              <button v-if="dateRange" class="clear-all-btn" @click="clearDateFilter" title="Clear filter">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div class="date-filter-body">
              <div class="quick-date-options">
                <button v-for="option in quickDateOptions" :key="option.label" class="quick-date-btn"
                  :class="{ active: isQuickDateActive(option) }" @click="selectQuickDate(option)">
                  {{ option.label }}
                </button>
              </div>

              <div class="custom-date-section">
                <div class="custom-date-label">Custom Range:</div>
                <el-date-picker v-model="dateRange" type="daterange" :teleported="false" range-separator="to"
                  start-placeholder="Start date" end-placeholder="End date" format="DD/MM/YYYY"
                  value-format="YYYY-MM-DD" class="date-range-picker" size="default" :clearable="true" />
              </div>
            </div>
          </div>
        </div>

        <el-button type="default" class="cancel-btn" :loading="exportLoading" @click="handleExport">
          <font-awesome-icon :icon="['fas', 'file-excel']" /> Export Excel
        </el-button>
      </div>
    </div>

    <div class="page-content">
      <el-tabs v-model="activeTab">
        <el-tab-pane name="pending">
          <template #label>
            <span>
              Pending Approval
              <el-badge :value="pendingBookingsCount" :max="99" :show-zero="false" class="badge-item" />
            </span>
          </template>

          <div class="table-card">
            <div class="table-view">
              <div class="table-wrapper">
                <el-table
                  v-loading="pendingLoading"
                  :data="pendingList"
                  class="meeting-approval-table"
                  height="100%"
                  border
                  stripe
                  table-layout="auto"
                  style="width: max-content; min-width: 100%"
                >
                  <el-table-column type="index" label="#" width="70" align="center" header-align="center" fixed="left"
                    class-name="table-nowrap-col" label-class-name="table-nowrap-col" :index="getPendingRowIndex" />
                  <el-table-column prop="venueName" min-width="200" class-name="table-nowrap-col"
                    label-class-name="table-nowrap-col">
                    <template #header>
                      <SortableFilterHeader label="Room / Venue" :sort-indicator="getPendingSortIndicator('venueName')"
                        :filter-active="columnFilterState.pending.venueName.length > 0" :options="pendingVenueOptions"
                        :model-value="columnFilterState.pending.venueName"
                        @sort-asc="setSortByMenu('pending', 'venueName', 'asc')"
                        @sort-desc="setSortByMenu('pending', 'venueName', 'desc')"
                        @clear-sort="clearSortByMenu('pending', 'venueName')"
                        @update:model-value="(v) => updateFilter('pending', 'venueName', v)" />
                    </template>
                  </el-table-column>
                  <el-table-column label="Reserved By" min-width="240" class-name="table-nowrap-col"
                    label-class-name="table-nowrap-col">
                    <template #header>
                      <SortableFilterHeader label="Reserved By" :sort-indicator="getPendingSortIndicator('reservedBy')"
                        :filter-active="columnFilterState.pending.reservedBy.length > 0"
                        :options="pendingReservedByOptions" :model-value="columnFilterState.pending.reservedBy"
                        @sort-asc="setSortByMenu('pending', 'reservedBy', 'asc')"
                        @sort-desc="setSortByMenu('pending', 'reservedBy', 'desc')"
                        @clear-sort="clearSortByMenu('pending', 'reservedBy')"
                        @update:model-value="(v) => updateFilter('pending', 'reservedBy', v)" />
                    </template>
                    <template #default="{ row }">
                      {{ formatReservedBy(row) }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="meetingTitle" label="Meeting / Event Title" width="400"
                    class-name="table-meeting-title-col" label-class-name="table-meeting-title-col" />
                  <el-table-column prop="date" min-width="130" class-name="table-nowrap-col"
                    label-class-name="table-nowrap-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="togglePendingSort('date')">
                        Date
                        <span class="sort-indicator">{{ getPendingSortIndicator('date') }}</span>
                      </button>
                    </template>
                  </el-table-column>
                  <el-table-column prop="time" min-width="150" class-name="table-nowrap-col"
                    label-class-name="table-nowrap-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="togglePendingSort('time')">
                        Time
                        <span class="sort-indicator">{{ getPendingSortIndicator('time') }}</span>
                      </button>
                    </template>
                  </el-table-column>
                  <el-table-column label="Tea Service" min-width="120" align="center" header-align="center"
                    class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                    <template #default="{ row }">
                      <el-popover
                        v-if="isBookingTeaServiceYes(row)"
                        placement="top"
                        :width="300"
                        trigger="hover"
                        popper-class="meeting-approval-tea-popover"
                      >
                        <template #reference>
                          <span
                            :class="[
                              'status-badge',
                              'tea-service-badge',
                              'badge-tea-service-yes',
                              'tea-service-badge--interactive'
                            ]"
                          >
                            {{ formatTeaServiceCardLabel(row) }}
                          </span>
                        </template>
                        <div class="tea-service-popover-detail">
                          <div v-if="getTeaServiceSummaryText(row)" class="tea-service-popover-line">
                            {{ getTeaServiceSummaryText(row) }}
                          </div>
                          <div
                            v-if="formatTeaSpecialRequest(row) !== '-'"
                            class="tea-service-popover-line tea-service-popover-special"
                          >
                            <span class="tea-service-popover-label">Special requests</span>
                            <span class="tea-service-popover-text">{{ formatTeaSpecialRequest(row) }}</span>
                          </div>
                        </div>
                      </el-popover>
                      <span
                        v-else
                        :class="['status-badge', 'tea-service-badge', 'badge-tea-service-no']"
                      >
                        {{ formatTeaServiceCardLabel(row) }}
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column width="90" align="center" header-align="center"
                    class-name="table-nowrap-col" label-class-name="col-display-homepage-header">
                    <template #header>
                      <span class="display-homepage-header">Display on<br>Homepage</span>
                    </template>
                    <template #default="{ row }">
                      <span
                        v-if="isBookingDisplayOnHomepageSupported(row)"
                        :class="[
                          'status-badge',
                          'display-homepage-badge',
                          row.displayOnHomepage !== false ? 'badge-display-homepage-yes' : 'badge-display-homepage-no'
                        ]"
                      >
                        {{ formatDisplayOnHomepage(row) }}
                      </span>
                      <span v-else>-</span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="submittedAt" min-width="180" class-name="table-nowrap-col"
                    label-class-name="table-nowrap-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="togglePendingSort('submittedAt')">
                        Submitted
                        <span class="sort-indicator">{{ getPendingSortIndicator('submittedAt') }}</span>
                      </button>
                    </template>
                  </el-table-column>
                  <el-table-column label="Actions" width="120" fixed="right" class-name="actions-col table-nowrap-col"
                    label-class-name="table-nowrap-col">
                    <template #default="{ row }">
                      <div class="actions-cell">
                        <el-button size="small" class="action-btn action-edit"
                          @click="handleOpen(row)">Handle</el-button>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>
            <div class="pagination-bar">
              <div class="pagination-info">
                Showing {{ pendingTotal ? pendingStartIndex + 1 : 0 }}-{{ pendingEndIndex }} of {{ pendingTotal }}
                records
              </div>
              <div class="pagination-controls">
                <button class="pagination-btn" :disabled="pendingCurrentPage === 1 || pendingLoading"
                  @click="goPendingPage(pendingCurrentPage - 1)">Previous</button>
                <button v-for="page in pendingVisiblePages" :key="page"
                  :class="['pagination-btn', 'page-number', { active: page === pendingCurrentPage }]"
                  @click="goPendingPage(page)">
                  {{ page }}
                </button>
                <button class="pagination-btn" :disabled="pendingCurrentPage === pendingTotalPages || pendingLoading"
                  @click="goPendingPage(pendingCurrentPage + 1)">Next</button>
              </div>
              <div class="pagination-size">
                <select v-model.number="pendingPageSize" class="page-size-select" @change="onPendingPageSizeChange">
                  <option :value="10">10 / page</option>
                  <option :value="20">20 / page</option>
                  <option :value="50">50 / page</option>
                  <option :value="100">100 / page</option>
                </select>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane name="expired">
          <template #label>
            <span>
              Expired
              <el-badge :value="expiredBookingsCount" :max="99" :show-zero="false"
                class="badge-item badge-item--expired" />
            </span>
          </template>
          <div class="table-card">
            <div class="table-view">
              <div class="table-wrapper">
                <el-table
                  v-loading="expiredLoading"
                  :data="expiredList"
                  class="meeting-approval-table"
                  height="100%"
                  border
                  stripe
                  table-layout="auto"
                  style="width: max-content; min-width: 100%"
                >
                  <el-table-column type="index" label="#" width="70" align="center" header-align="center" fixed="left"
                    class-name="table-nowrap-col" label-class-name="table-nowrap-col" :index="getExpiredRowIndex" />
                  <el-table-column prop="venueName" min-width="200" class-name="table-nowrap-col"
                    label-class-name="table-nowrap-col">
                    <template #header>
                      <SortableFilterHeader label="Room / Venue" :sort-indicator="getExpiredSortIndicator('venueName')"
                        :filter-active="columnFilterState.expired.venueName.length > 0" :options="expiredVenueOptions"
                        :model-value="columnFilterState.expired.venueName"
                        @sort-asc="setSortByMenu('expired', 'venueName', 'asc')"
                        @sort-desc="setSortByMenu('expired', 'venueName', 'desc')"
                        @clear-sort="clearSortByMenu('expired', 'venueName')"
                        @update:model-value="(v) => updateFilter('expired', 'venueName', v)" />
                    </template>
                  </el-table-column>
                  <el-table-column label="Reserved By" min-width="220" class-name="table-nowrap-col"
                    label-class-name="table-nowrap-col">
                    <template #header>
                      <SortableFilterHeader label="Reserved By" :sort-indicator="getExpiredSortIndicator('reservedBy')"
                        :filter-active="columnFilterState.expired.reservedBy.length > 0"
                        :options="expiredReservedByOptions" :model-value="columnFilterState.expired.reservedBy"
                        @sort-asc="setSortByMenu('expired', 'reservedBy', 'asc')"
                        @sort-desc="setSortByMenu('expired', 'reservedBy', 'desc')"
                        @clear-sort="clearSortByMenu('expired', 'reservedBy')"
                        @update:model-value="(v) => updateFilter('expired', 'reservedBy', v)" />
                    </template>
                    <template #default="{ row }">
                      {{ formatReservedBy(row) }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="meetingTitle" label="Meeting / Event Title" width="400"
                    class-name="table-meeting-title-col" label-class-name="table-meeting-title-col" />
                  <el-table-column prop="date" min-width="130" class-name="table-nowrap-col"
                    label-class-name="table-nowrap-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleExpiredSort('date')">
                        Date
                        <span class="sort-indicator">{{ getExpiredSortIndicator('date') }}</span>
                      </button>
                    </template>
                  </el-table-column>
                  <el-table-column prop="time" min-width="150" class-name="table-nowrap-col"
                    label-class-name="table-nowrap-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleExpiredSort('time')">
                        Time
                        <span class="sort-indicator">{{ getExpiredSortIndicator('time') }}</span>
                      </button>
                    </template>
                  </el-table-column>
                  <el-table-column label="Tea Service" min-width="120" align="center" header-align="center"
                    class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                    <template #default="{ row }">
                      <el-popover
                        v-if="isBookingTeaServiceYes(row)"
                        placement="top"
                        :width="300"
                        trigger="hover"
                        popper-class="meeting-approval-tea-popover"
                      >
                        <template #reference>
                          <span
                            :class="[
                              'status-badge',
                              'tea-service-badge',
                              'badge-tea-service-yes',
                              'tea-service-badge--interactive'
                            ]"
                          >
                            {{ formatTeaServiceCardLabel(row) }}
                          </span>
                        </template>
                        <div class="tea-service-popover-detail">
                          <div v-if="getTeaServiceSummaryText(row)" class="tea-service-popover-line">
                            {{ getTeaServiceSummaryText(row) }}
                          </div>
                          <div
                            v-if="formatTeaSpecialRequest(row) !== '-'"
                            class="tea-service-popover-line tea-service-popover-special"
                          >
                            <span class="tea-service-popover-label">Special requests</span>
                            <span class="tea-service-popover-text">{{ formatTeaSpecialRequest(row) }}</span>
                          </div>
                        </div>
                      </el-popover>
                      <span
                        v-else
                        :class="['status-badge', 'tea-service-badge', 'badge-tea-service-no']"
                      >
                        {{ formatTeaServiceCardLabel(row) }}
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column width="90" align="center" header-align="center"
                    class-name="table-nowrap-col" label-class-name="col-display-homepage-header">
                    <template #header>
                      <span class="display-homepage-header">Display on<br>Homepage</span>
                    </template>
                    <template #default="{ row }">
                      <span
                        v-if="isBookingDisplayOnHomepageSupported(row)"
                        :class="[
                          'status-badge',
                          'display-homepage-badge',
                          row.displayOnHomepage !== false ? 'badge-display-homepage-yes' : 'badge-display-homepage-no'
                        ]"
                      >
                        {{ formatDisplayOnHomepage(row) }}
                      </span>
                      <span v-else>-</span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="submittedAt" min-width="180" class-name="table-nowrap-col"
                    label-class-name="table-nowrap-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleExpiredSort('submittedAt')">
                        Submitted
                        <span class="sort-indicator">{{ getExpiredSortIndicator('submittedAt') }}</span>
                      </button>
                    </template>
                  </el-table-column>
                  <el-table-column label="Actions" width="120" fixed="right" class-name="actions-col table-nowrap-col"
                    label-class-name="table-nowrap-col">
                    <template #default="{ row }">
                      <div class="actions-cell">
                        <el-button size="small" class="action-btn action-edit"
                          @click="handleOpen(row)">Handle</el-button>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>
            <div class="pagination-bar">
              <div class="pagination-info">
                Showing {{ expiredTotal ? expiredStartIndex + 1 : 0 }}-{{ expiredEndIndex }} of {{ expiredTotal }}
                records
              </div>
              <div class="pagination-controls">
                <button class="pagination-btn" :disabled="expiredCurrentPage === 1 || expiredLoading"
                  @click="goExpiredPage(expiredCurrentPage - 1)">Previous</button>
                <button v-for="page in expiredVisiblePages" :key="page"
                  :class="['pagination-btn', 'page-number', { active: page === expiredCurrentPage }]"
                  @click="goExpiredPage(page)">
                  {{ page }}
                </button>
                <button class="pagination-btn" :disabled="expiredCurrentPage === expiredTotalPages || expiredLoading"
                  @click="goExpiredPage(expiredCurrentPage + 1)">Next</button>
              </div>
              <div class="pagination-size">
                <select v-model.number="expiredPageSize" class="page-size-select" @change="onExpiredPageSizeChange">
                  <option :value="10">10 / page</option>
                  <option :value="20">20 / page</option>
                  <option :value="50">50 / page</option>
                  <option :value="100">100 / page</option>
                </select>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="Approved" name="approved">
          <div class="table-card">
            <div class="table-view">
              <div class="table-wrapper">
                <el-table
                  v-loading="approvedLoading"
                  :data="approvedList"
                  class="meeting-approval-table"
                  height="100%"
                  border
                  stripe
                  table-layout="auto"
                  style="width: max-content; min-width: 100%"
                >
                  <el-table-column type="index" label="#" width="70" align="center" header-align="center" fixed="left"
                    class-name="table-nowrap-col" label-class-name="table-nowrap-col" :index="getApprovedRowIndex" />
                  <el-table-column prop="venueName" min-width="200" class-name="table-nowrap-col"
                    label-class-name="table-nowrap-col">
                    <template #header>
                      <SortableFilterHeader label="Room / Venue" :sort-indicator="getApprovedSortIndicator('venueName')"
                        :filter-active="columnFilterState.approved.venueName.length > 0" :options="approvedVenueOptions"
                        :model-value="columnFilterState.approved.venueName"
                        @sort-asc="setSortByMenu('approved', 'venueName', 'asc')"
                        @sort-desc="setSortByMenu('approved', 'venueName', 'desc')"
                        @clear-sort="clearSortByMenu('approved', 'venueName')"
                        @update:model-value="(v) => updateFilter('approved', 'venueName', v)" />
                    </template>
                  </el-table-column>
                  <el-table-column label="Reserved By" min-width="220" class-name="table-nowrap-col"
                    label-class-name="table-nowrap-col">
                    <template #header>
                      <SortableFilterHeader label="Reserved By" :sort-indicator="getApprovedSortIndicator('reservedBy')"
                        :filter-active="columnFilterState.approved.reservedBy.length > 0"
                        :options="approvedReservedByOptions" :model-value="columnFilterState.approved.reservedBy"
                        @sort-asc="setSortByMenu('approved', 'reservedBy', 'asc')"
                        @sort-desc="setSortByMenu('approved', 'reservedBy', 'desc')"
                        @clear-sort="clearSortByMenu('approved', 'reservedBy')"
                        @update:model-value="(v) => updateFilter('approved', 'reservedBy', v)" />
                    </template>
                    <template #default="{ row }">
                      {{ formatReservedBy(row) }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="meetingTitle" label="Meeting / Event Title" width="400"
                    class-name="table-meeting-title-col" label-class-name="table-meeting-title-col" />
                  <el-table-column prop="date" min-width="130" class-name="table-nowrap-col"
                    label-class-name="table-nowrap-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleApprovedSort('date')">
                        Date
                        <span class="sort-indicator">{{ getApprovedSortIndicator('date') }}</span>
                      </button>
                    </template>
                  </el-table-column>
                  <el-table-column prop="time" min-width="150" class-name="table-nowrap-col"
                    label-class-name="table-nowrap-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleApprovedSort('time')">
                        Time
                        <span class="sort-indicator">{{ getApprovedSortIndicator('time') }}</span>
                      </button>
                    </template>
                  </el-table-column>
                  <el-table-column label="Tea Service" min-width="120" align="center" header-align="center"
                    class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                    <template #default="{ row }">
                      <el-popover
                        v-if="isBookingTeaServiceYes(row)"
                        placement="top"
                        :width="300"
                        trigger="hover"
                        popper-class="meeting-approval-tea-popover"
                      >
                        <template #reference>
                          <span
                            :class="[
                              'status-badge',
                              'tea-service-badge',
                              'badge-tea-service-yes',
                              'tea-service-badge--interactive'
                            ]"
                          >
                            {{ formatTeaServiceCardLabel(row) }}
                          </span>
                        </template>
                        <div class="tea-service-popover-detail">
                          <div v-if="getTeaServiceSummaryText(row)" class="tea-service-popover-line">
                            {{ getTeaServiceSummaryText(row) }}
                          </div>
                          <div
                            v-if="formatTeaSpecialRequest(row) !== '-'"
                            class="tea-service-popover-line tea-service-popover-special"
                          >
                            <span class="tea-service-popover-label">Special requests</span>
                            <span class="tea-service-popover-text">{{ formatTeaSpecialRequest(row) }}</span>
                          </div>
                        </div>
                      </el-popover>
                      <span
                        v-else
                        :class="['status-badge', 'tea-service-badge', 'badge-tea-service-no']"
                      >
                        {{ formatTeaServiceCardLabel(row) }}
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column width="90" align="center" header-align="center"
                    class-name="table-nowrap-col" label-class-name="col-display-homepage-header">
                    <template #header>
                      <span class="display-homepage-header">Display on<br>Homepage</span>
                    </template>
                    <template #default="{ row }">
                      <span
                        v-if="isBookingDisplayOnHomepageSupported(row)"
                        :class="[
                          'status-badge',
                          'display-homepage-badge',
                          row.displayOnHomepage !== false ? 'badge-display-homepage-yes' : 'badge-display-homepage-no'
                        ]"
                      >
                        {{ formatDisplayOnHomepage(row) }}
                      </span>
                      <span v-else>-</span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="approvedBy" min-width="140" class-name="table-nowrap-col"
                    label-class-name="table-nowrap-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleApprovedSort('approvedBy')">
                        Approved By
                        <span class="sort-indicator">{{ getApprovedSortIndicator('approvedBy') }}</span>
                      </button>
                    </template>
                  </el-table-column>
                  <el-table-column prop="approvedAt" min-width="180" class-name="table-nowrap-col"
                    label-class-name="table-nowrap-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleApprovedSort('approvedAt')">
                        Approved At
                        <span class="sort-indicator">{{ getApprovedSortIndicator('approvedAt') }}</span>
                      </button>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>
            <div class="pagination-bar">
              <div class="pagination-info">
                Showing {{ approvedTotal ? approvedStartIndex + 1 : 0 }}-{{ approvedEndIndex }} of {{ approvedTotal }}
                records
              </div>
              <div class="pagination-controls">
                <button class="pagination-btn" :disabled="approvedCurrentPage === 1 || approvedLoading"
                  @click="goApprovedPage(approvedCurrentPage - 1)">Previous</button>
                <button v-for="page in approvedVisiblePages" :key="page"
                  :class="['pagination-btn', 'page-number', { active: page === approvedCurrentPage }]"
                  @click="goApprovedPage(page)">
                  {{ page }}
                </button>
                <button class="pagination-btn" :disabled="approvedCurrentPage === approvedTotalPages || approvedLoading"
                  @click="goApprovedPage(approvedCurrentPage + 1)">Next</button>
              </div>
              <div class="pagination-size">
                <select v-model.number="approvedPageSize" class="page-size-select" @change="onApprovedPageSizeChange">
                  <option :value="10">10 / page</option>
                  <option :value="20">20 / page</option>
                  <option :value="50">50 / page</option>
                  <option :value="100">100 / page</option>
                </select>
              </div>
            </div>
          </div>
        </el-tab-pane>

      </el-tabs>
    </div>

    <BookingStyleModal v-model="showHandleDialog" title="Handle Booking" max-width="760px"
      :max-height="handleBookingModalMaxHeight" custom-class="handle-booking-modal">
      <el-form :model="handleForm" label-width="170px" class="handle-booking-form">
        <el-form-item label="Room / Venue">
          <el-input v-model="handleForm.venueName" disabled />
        </el-form-item>
        <el-form-item label="Meeting / Event Title" class="no-wrap-label">
          <MeetingEventTitleInput
            v-model="handleForm.meetingTitle"
            :max-units="meetingEventTitleMaxLength"
          />
        </el-form-item>
        <el-form-item label="My Note" class="no-wrap-label">
          <el-input
            v-model="handleForm.myNote"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 6 }"
            resize="none"
            disabled
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
        <el-form-item label="Tea Special Requests" class="no-wrap-label">
          <el-input
            v-model="handleForm.teaServiceSpecialRequest"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 6 }"
            resize="none"
            disabled
          />
        </el-form-item>
        <el-form-item label="Display on Homepage">
          <el-input v-model="handleForm.displayOnHomepageText" disabled />
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
        <el-button type="default" class="action-btn action-approve" @click="confirmHandleApprove">Approve</el-button>
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import * as XLSX from 'xlsx'
import BookingStyleModal from '@/components/BookingStyleModal.vue'
import SortableFilterHeader from '@/components/admin/SortableFilterHeader.vue'
import MeetingEventTitleInput from '@/components/MeetingEventTitleInput.vue'
import { useAdminStore } from '@/stores/admin'
import {
  getPendingBookings,
  getExpiredBookings,
  getApprovedBookings,
  approveBooking,
} from '@/api/admin'
import { notifyAdminPendingUpdated } from '@/utils/adminPendingSync'
import { formatTeaServiceDisplay, stripTeaServiceSpecialSuffix } from '@/utils/venueTeaService'
import {
  DEFAULT_MEETING_EVENT_TITLE_MAX_LENGTH,
  fetchMeetingEventTitleMaxLength,
  meetingEventTitleTooLongMessage,
  isMeetingEventTitleTooLong
} from '@/utils/meetingEventTitleMaxLength'

const adminStore = useAdminStore()
const { pendingBookingsCount } = storeToRefs(adminStore)
const activeTab = ref('pending')
const meetingEventTitleMaxLength = ref(DEFAULT_MEETING_EVENT_TITLE_MAX_LENGTH)

const searchState = ref({
  pending: '',
  expired: '',
  approved: '',
})

const currentSearch = computed({
  get: () => searchState.value[activeTab.value] || '',
  set: (value) => {
    searchState.value[activeTab.value] = value
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

const pendingList = ref([])
const expiredList = ref([])
const approvedList = ref([])
const pendingTotal = ref(0)
const expiredTotal = ref(0)
const approvedTotal = ref(0)
const pendingLoading = ref(false)
const expiredLoading = ref(false)
const approvedLoading = ref(false)
const pendingVenueOptions = ref([])
const pendingReservedByOptions = ref([])
const expiredVenueOptions = ref([])
const expiredReservedByOptions = ref([])
const approvedVenueOptions = ref([])
const approvedReservedByOptions = ref([])
const exportLoading = ref(false)

let searchReloadTimer = null

function normalizeListResponse(payload) {
  if (Array.isArray(payload)) {
    return { items: payload, total: payload.length, filterOptions: null }
  }
  const items = Array.isArray(payload?.items) ? payload.items : []
  const total = Number(payload?.total)
  return {
    items,
    total: Number.isFinite(total) ? total : items.length,
    filterOptions: payload?.filterOptions || null
  }
}

function getPrimarySort(state) {
  const first = state.value?.[0]
  if (!first?.key) return { sortBy: undefined, sortOrder: undefined }
  return {
    sortBy: first.key,
    sortOrder: first.order === 'asc' ? 'asc' : 'desc'
  }
}

function buildListParams(tableKey, { includeOptions = false, all = false } = {}) {
  const page =
    tableKey === 'pending'
      ? pendingCurrentPage.value
      : tableKey === 'expired'
        ? expiredCurrentPage.value
        : approvedCurrentPage.value
  const pageSize =
    tableKey === 'pending'
      ? pendingPageSize.value
      : tableKey === 'expired'
        ? expiredPageSize.value
        : approvedPageSize.value
  const sortState =
    tableKey === 'pending'
      ? pendingSortState
      : tableKey === 'expired'
        ? expiredSortState
        : approvedSortState
  const { sortBy, sortOrder } = getPrimarySort(sortState)
  const filters = columnFilterState.value[tableKey] || { venueName: [], reservedBy: [] }
  const params = {
    page,
    pageSize,
    q: searchState.value[tableKey] || undefined,
    sortBy,
    sortOrder,
    venueNames: filters.venueName?.length ? filters.venueName.join(',') : undefined,
    reservedBy: filters.reservedBy?.length ? filters.reservedBy.join(',') : undefined,
    includeOptions: includeOptions ? 1 : undefined,
    all: all ? 1 : undefined
  }
  if (dateRange.value?.length === 2) {
    params.dateFrom = dateRange.value[0]
    params.dateTo = dateRange.value[1]
  }
  return params
}

function applyFilterOptions(tableKey, filterOptions) {
  if (!filterOptions) return
  const venues = Array.isArray(filterOptions.venues) ? filterOptions.venues : []
  const reservedBy = Array.isArray(filterOptions.reservedBy) ? filterOptions.reservedBy : []
  if (tableKey === 'pending') {
    pendingVenueOptions.value = venues
    pendingReservedByOptions.value = reservedBy
  } else if (tableKey === 'expired') {
    expiredVenueOptions.value = venues
    expiredReservedByOptions.value = reservedBy
  } else if (tableKey === 'approved') {
    approvedVenueOptions.value = venues
    approvedReservedByOptions.value = reservedBy
  }
}

async function loadTable(tableKey, { includeOptions = false } = {}) {
  const loadingRef =
    tableKey === 'pending'
      ? pendingLoading
      : tableKey === 'expired'
        ? expiredLoading
        : approvedLoading
  const fetcher =
    tableKey === 'pending'
      ? getPendingBookings
      : tableKey === 'expired'
        ? getExpiredBookings
        : getApprovedBookings

  loadingRef.value = true
  try {
    const payload = await fetcher(buildListParams(tableKey, { includeOptions }))
    const { items, total, filterOptions } = normalizeListResponse(payload)
    if (tableKey === 'pending') {
      pendingList.value = items
      pendingTotal.value = total
    } else if (tableKey === 'expired') {
      expiredList.value = items
      expiredTotal.value = total
    } else {
      approvedList.value = items
      approvedTotal.value = total
    }
    applyFilterOptions(tableKey, filterOptions)
  } catch (error) {
    console.error(`Failed to load ${tableKey} meeting approval list:`, error)
    showNotice('Failed to load meeting approval data', 'Error')
  } finally {
    loadingRef.value = false
  }
}

async function loadMeetingApprovalLists({ includeOptions = true } = {}) {
  await Promise.all([
    loadTable('pending', { includeOptions }),
    loadTable('expired', { includeOptions }),
    loadTable('approved', { includeOptions })
  ])
}

function scheduleSearchReload(tableKey) {
  if (searchReloadTimer) clearTimeout(searchReloadTimer)
  searchReloadTimer = setTimeout(() => {
    resetTablePage(tableKey)
    loadTable(tableKey, { includeOptions: true }).catch((e) => console.error(e))
  }, 300)
}

const showDateFilter = ref(false)
const dateRange = ref(null)
const quickDateOptions = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Last Month', value: 'lastMonth' },
  { label: 'This Year', value: 'thisYear' },
  { label: 'Last Year', value: 'lastYear' }
]

const pendingCurrentPage = ref(1)
const pendingPageSize = ref(20)
const expiredCurrentPage = ref(1)
const expiredPageSize = ref(20)
const approvedCurrentPage = ref(1)
const approvedPageSize = ref(20)
const dateFilterLabel = computed(() => {
  if (!dateRange.value || dateRange.value.length !== 2) return 'All dates'
  const [start, end] = dateRange.value
  const startDate = new Date(start)
  const endDate = new Date(end)
  const fmt = (date) => `${date.getDate()} ${date.toLocaleDateString('en-US', { month: 'short' })}`
  return `${fmt(startDate)} - ${fmt(endDate)}`
})

const columnFilterState = ref({
  pending: { venueName: [], reservedBy: [] },
  expired: { venueName: [], reservedBy: [] },
  approved: { venueName: [], reservedBy: [] },
  rejected: { venueName: [], reservedBy: [] }
})

const pendingSortState = ref([])
const expiredSortState = ref([])
const approvedSortState = ref([])
const expiredBookingsCount = computed(() => expiredTotal.value)

function getTableSortState(tableKey) {
  if (tableKey === 'pending') return pendingSortState
  if (tableKey === 'expired') return expiredSortState
  return approvedSortState
}

function resetTablePage(tableKey) {
  if (tableKey === 'pending') pendingCurrentPage.value = 1
  else if (tableKey === 'expired') expiredCurrentPage.value = 1
  else if (tableKey === 'approved') approvedCurrentPage.value = 1
}

const updateFilter = (tableKey, key, value) => {
  columnFilterState.value[tableKey][key] = value ?? []
  resetTablePage(tableKey)
  loadTable(tableKey, { includeOptions: false }).catch((e) => console.error(e))
}

function toggleSortState(state, key) {
  const idx = state.value.findIndex(item => item.key === key)
  if (idx === -1) {
    state.value = [{ key, order: 'asc' }]
  } else if (state.value[idx].order === 'asc') {
    state.value = [{ key, order: 'desc' }]
  } else {
    state.value = []
  }
}

function getSortIndicatorFromState(state, key) {
  const idx = state.value.findIndex(item => item.key === key)
  if (idx === -1) return '↕'
  return state.value[idx].order === 'asc' ? '▲' : '▼'
}

function reloadAfterSort(tableKey) {
  resetTablePage(tableKey)
  loadTable(tableKey, { includeOptions: false }).catch((e) => console.error(e))
}

const togglePendingSort = (key) => {
  toggleSortState(pendingSortState, key)
  reloadAfterSort('pending')
}

const toggleExpiredSort = (key) => {
  toggleSortState(expiredSortState, key)
  reloadAfterSort('expired')
}

const toggleApprovedSort = (key) => {
  toggleSortState(approvedSortState, key)
  reloadAfterSort('approved')
}

const getPendingSortIndicator = (key) => getSortIndicatorFromState(pendingSortState, key)
const getExpiredSortIndicator = (key) => getSortIndicatorFromState(expiredSortState, key)
const getApprovedSortIndicator = (key) => getSortIndicatorFromState(approvedSortState, key)

const setSortByMenu = (tableKey, key, order) => {
  const state = getTableSortState(tableKey)
  state.value = [{ key, order }]
  reloadAfterSort(tableKey)
}

const clearSortByMenu = (tableKey, key) => {
  const state = getTableSortState(tableKey)
  const idx = state.value.findIndex(item => item.key === key)
  if (idx !== -1) state.value.splice(idx, 1)
  reloadAfterSort(tableKey)
}

function buildVisiblePages(currentPage, totalPages) {
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages, start + maxVisible - 1)
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
}

const pendingTotalPages = computed(() => Math.max(1, Math.ceil(pendingTotal.value / pendingPageSize.value)))
const pendingStartIndex = computed(() => {
  if (!pendingTotal.value) return 0
  return (pendingCurrentPage.value - 1) * pendingPageSize.value
})
const pendingEndIndex = computed(() => Math.min(pendingStartIndex.value + pendingList.value.length, pendingTotal.value))
const pendingVisiblePages = computed(() => buildVisiblePages(pendingCurrentPage.value, pendingTotalPages.value))

const expiredTotalPages = computed(() => Math.max(1, Math.ceil(expiredTotal.value / expiredPageSize.value)))
const expiredStartIndex = computed(() => {
  if (!expiredTotal.value) return 0
  return (expiredCurrentPage.value - 1) * expiredPageSize.value
})
const expiredEndIndex = computed(() => Math.min(expiredStartIndex.value + expiredList.value.length, expiredTotal.value))
const getExpiredRowIndex = (index) => (expiredCurrentPage.value - 1) * expiredPageSize.value + index + 1
const expiredVisiblePages = computed(() => buildVisiblePages(expiredCurrentPage.value, expiredTotalPages.value))

const approvedTotalPages = computed(() => Math.max(1, Math.ceil(approvedTotal.value / approvedPageSize.value)))
const approvedStartIndex = computed(() => {
  if (!approvedTotal.value) return 0
  return (approvedCurrentPage.value - 1) * approvedPageSize.value
})
const approvedEndIndex = computed(() => Math.min(approvedStartIndex.value + approvedList.value.length, approvedTotal.value))
const approvedVisiblePages = computed(() => buildVisiblePages(approvedCurrentPage.value, approvedTotalPages.value))

function goPendingPage(page) {
  const next = Math.min(Math.max(1, page), pendingTotalPages.value)
  if (next === pendingCurrentPage.value) return
  pendingCurrentPage.value = next
  loadTable('pending', { includeOptions: false }).catch((e) => console.error(e))
}

function goExpiredPage(page) {
  const next = Math.min(Math.max(1, page), expiredTotalPages.value)
  if (next === expiredCurrentPage.value) return
  expiredCurrentPage.value = next
  loadTable('expired', { includeOptions: false }).catch((e) => console.error(e))
}

function goApprovedPage(page) {
  const next = Math.min(Math.max(1, page), approvedTotalPages.value)
  if (next === approvedCurrentPage.value) return
  approvedCurrentPage.value = next
  loadTable('approved', { includeOptions: false }).catch((e) => console.error(e))
}

function onPendingPageSizeChange() {
  pendingCurrentPage.value = 1
  loadTable('pending', { includeOptions: false }).catch((e) => console.error(e))
}

function onExpiredPageSizeChange() {
  expiredCurrentPage.value = 1
  loadTable('expired', { includeOptions: false }).catch((e) => console.error(e))
}

function onApprovedPageSizeChange() {
  approvedCurrentPage.value = 1
  loadTable('approved', { includeOptions: false }).catch((e) => console.error(e))
}

function toggleDateFilter(event) {
  event.stopPropagation()
  showDateFilter.value = !showDateFilter.value
  if (showDateFilter.value) {
    setTimeout(() => {
      document.addEventListener('click', handleDateFilterClickOutside, { once: false })
    }, 0)
  } else {
    document.removeEventListener('click', handleDateFilterClickOutside)
  }
}

function handleDateFilterClickOutside(event) {
  const dropdown = document.querySelector('.date-filter-dropdown')
  const filterBtn = event.target.closest('.date-filter-wrapper')
  const datePickerPopup = document.querySelector('.el-picker__popper')
  if (datePickerPopup && datePickerPopup.contains(event.target)) return
  if (!dropdown?.contains(event.target) && !filterBtn) {
    showDateFilter.value = false
    document.removeEventListener('click', handleDateFilterClickOutside)
  }
}

function clearDateFilter() {
  dateRange.value = null
}

function formatDateToString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getQuickDateRange(option) {
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

function selectQuickDate(option) {
  const quickRange = getQuickDateRange(option.value)
  if (isQuickDateActive(option)) {
    dateRange.value = null
  } else {
    dateRange.value = quickRange
  }
}

function isQuickDateActive(option) {
  if (!dateRange.value || dateRange.value.length !== 2) return false
  const quickRange = getQuickDateRange(option.value)
  if (!quickRange) return false
  return dateRange.value[0] === quickRange[0] && dateRange.value[1] === quickRange[1]
}

watch(dateRange, () => {
  pendingCurrentPage.value = 1
  expiredCurrentPage.value = 1
  approvedCurrentPage.value = 1
  loadMeetingApprovalLists({ includeOptions: true }).catch((e) => console.error(e))
})

watch(
  () => searchState.value.pending,
  () => scheduleSearchReload('pending')
)
watch(
  () => searchState.value.expired,
  () => scheduleSearchReload('expired')
)
watch(
  () => searchState.value.approved,
  () => scheduleSearchReload('approved')
)

const showHandleDialog = ref(false)
const currentHandleRow = ref(null)
/** 14" 视口（1100–1599）：Handle Booking 弹窗略增高，与 UserManagement 一致 */
const HANDLE_BOOKING_MODAL_MQ = '(min-width: 1100px) and (max-width: 1599px)'
const handleBookingModalMaxHeight = ref('94vh')

function updateHandleBookingModalMaxHeight() {
  if (typeof window === 'undefined') return
  handleBookingModalMaxHeight.value = window.matchMedia(HANDLE_BOOKING_MODAL_MQ).matches ? '120vh' : '94vh'
}

let handleBookingModalMq = null

watch(
  () => adminStore.pendingBookingsListRevision,
  () => {
    loadMeetingApprovalLists({ includeOptions: true }).catch((e) => console.error(e))
  }
)

onMounted(() => {
  updateHandleBookingModalMaxHeight()
  handleBookingModalMq = window.matchMedia(HANDLE_BOOKING_MODAL_MQ)
  handleBookingModalMq.addEventListener('change', updateHandleBookingModalMaxHeight)
  void fetchMeetingEventTitleMaxLength().then((maxLength) => {
    meetingEventTitleMaxLength.value = maxLength
  })
  loadMeetingApprovalLists({ includeOptions: true })
})

onUnmounted(() => {
  if (searchReloadTimer) clearTimeout(searchReloadTimer)
  if (handleBookingModalMq) {
    handleBookingModalMq.removeEventListener('change', updateHandleBookingModalMaxHeight)
  }
  document.removeEventListener('click', handleDateFilterClickOutside)
})

const handleForm = ref({
  venueName: '',
  userName: '',
  departmentUnit: '',
  contactPhone: '',
  contactEmail: '',
  meetingTitle: '',
  myNote: '-',
  date: '',
  time: '',
  participantCount: '-',
  teaService: 'No',
  teaServiceSpecialRequest: '-',
  displayOnHomepageText: 'Yes'
})

function isBookingTeaServiceYes(row) {
  const flag = row?.teaServiceRequired
  if (flag === true || flag === 1 || flag === 'true' || flag === '1') return true
  if (flag === false || flag === 0 || flag === 'false' || flag === '0') return false

  const option = String(
    row?.teaServiceOption ?? row?.teaService?.option ?? ''
  ).trim()
  if (option === 'none') return false
  if (option === '1' || option === '2' || option === '3' || option === '4') return true

  const summary = String(row?.teaServiceSummary || '').trim()
  if (!summary || summary === '-' || summary.startsWith('无')) return false
  return true
}

function formatTeaServiceCardLabel(row) {
  if (!isBookingTeaServiceYes(row)) return 'No'
  const count = row?.teaServiceParticipants ?? row?.attendeeCount ?? row?.participants ?? row?.attendees
  const n = Number(count)
  return Number.isFinite(n) ? `Yes (${n})` : 'Yes'
}

function getTeaServiceSummaryText(row) {
  const count = row?.teaServiceParticipants ?? row?.attendeeCount ?? row?.participants ?? row?.attendees
  if (row?.teaService && typeof row.teaService === 'object') {
    const text = formatTeaServiceDisplay(row.teaService, count, { includeSpecialRequest: false })
    if (text && text !== '-') return text
  }
  const summary = stripTeaServiceSpecialSuffix(row?.teaServiceSummary)
  if (summary && summary !== '-') return summary
  if (row?.teaServiceRequired === true) return 'Tea service required'
  return ''
}

function formatTeaServiceStatus(row) {
  const count = row?.teaServiceParticipants ?? row?.attendeeCount ?? row?.participants ?? row?.attendees
  if (!isBookingTeaServiceYes(row)) {
    return formatTeaServiceDisplay({ option: 'none', attendees: count }, count)
  }
  if (row?.teaService && typeof row.teaService === 'object') {
    return formatTeaServiceDisplay(row.teaService, count, { includeSpecialRequest: false })
  }
  const summary = stripTeaServiceSpecialSuffix(row?.teaServiceSummary)
  if (summary) return summary
  return formatTeaServiceDisplay(row?.teaService, count, { includeSpecialRequest: false })
}

function formatTeaSpecialRequest(row) {
  const direct = String(row?.teaServiceSpecialRequest || '').trim()
  if (direct) return direct
  let teaServiceObj = row?.teaService
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

function isBookingDisplayOnHomepageSupported(row) {
  return row?.userDefinedUploadEventTitle !== false
}

function formatDisplayOnHomepage(row) {
  if (!isBookingDisplayOnHomepageSupported(row)) return '-'
  return row?.displayOnHomepage !== false ? 'Yes' : 'No'
}

const getPendingRowIndex = (index) => (pendingCurrentPage.value - 1) * pendingPageSize.value + index + 1
const getApprovedRowIndex = (index) => (approvedCurrentPage.value - 1) * approvedPageSize.value + index + 1

/** 展示姓名 + corpId */
function formatReservedBy(row) {
  const name = row.userName || ''
  const corpFromRow = row.bookerCorpId
  if (corpFromRow) {
    return name ? `${name} (${corpFromRow})` : corpFromRow
  }
  return name || '-'
}

const handleExport = async () => {
  if (exportLoading.value) return
  exportLoading.value = true
  try {
    const exportParams = { all: 1 }
    if (dateRange.value?.length === 2) {
      exportParams.dateFrom = dateRange.value[0]
      exportParams.dateTo = dateRange.value[1]
    }
    const [pendingPayload, expiredPayload, approvedPayload] = await Promise.all([
      getPendingBookings(exportParams),
      getExpiredBookings(exportParams),
      getApprovedBookings(exportParams)
    ])
    const pendingItems = normalizeListResponse(pendingPayload).items
    const expiredItems = normalizeListResponse(expiredPayload).items
    const approvedItems = normalizeListResponse(approvedPayload).items
    const allData = [
      ...pendingItems.map(item => ({ ...item, status: 'Pending' })),
      ...expiredItems.map(item => ({ ...item, status: 'Expired' })),
      ...approvedItems.map(item => ({ ...item, status: 'Approved' })),
    ]
    const exportData = allData.map((item, index) => ({
      '#': index + 1,
      ID: item.id || item.bookingId || '',
      'Room / Venue': item.venueName,
      'Reserved By': formatReservedBy(item),
      'Department / Unit': item.department || '',
      'Meeting / Event Title': item.meetingTitle,
      'Date': item.date,
      'Time': item.time,
      'Submitted': item.submittedAt || '',
      'Tea Service': formatTeaServiceStatus(item),
      'Tea Special Requests': formatTeaSpecialRequest(item),
      'Display on Homepage': formatDisplayOnHomepage(item),
      'Status': item.status,
      'Processed At': item.approvedAt || item.rejectedAt || '',
      'Processed By': item.approvedBy || item.rejectedBy || '',
      'Reason': item.reason || ''
    }))
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Meeting Approvals')
    XLSX.writeFile(wb, `Meeting_Approval_${new Date().toISOString().split('T')[0]}.xlsx`)
    showNotice('Excel file exported successfully', 'Success')
  } catch (error) {
    console.error('Failed to export meeting approval data:', error)
    showNotice('Failed to export Excel file', 'Error')
  } finally {
    exportLoading.value = false
  }
}

const handleOpen = (row) => {
  currentHandleRow.value = row
  handleForm.value = {
    venueName: row.venueName || '',
    userName: row.userName || '',
    departmentUnit: row.department || '-',
    contactPhone: row.contactPhone || '-',
    contactEmail: row.contactEmail || '-',
    meetingTitle: row.meetingTitle || '',
    myNote: String(row.myNote || row.notes || row.remark || '').trim() || '-',
    date: row.date || '',
    time: row.time || '',
    participantCount: row.attendeeCount
      ?? row.participants
      ?? row.teaServiceParticipants
      ?? row.teaService?.attendees
      ?? '-',
    teaService: formatTeaServiceStatus(row),
    teaServiceSpecialRequest: formatTeaSpecialRequest(row),
    displayOnHomepageText: formatDisplayOnHomepage(row)
  }
  showHandleDialog.value = true
}

const confirmHandleApprove = async () => {
  if (!currentHandleRow.value) return
  const row = currentHandleRow.value
  const meetingTitle = handleForm.value.meetingTitle?.trim() || undefined
  if (meetingTitle && isMeetingEventTitleTooLong(meetingTitle, meetingEventTitleMaxLength.value)) {
    showNotice(meetingEventTitleTooLongMessage(meetingEventTitleMaxLength.value), 'Warning')
    return
  }
  try {
    await approveBooking(row.id, {
      meetingTitle
    })
    showHandleDialog.value = false
    currentHandleRow.value = null
    await Promise.all([
      loadMeetingApprovalLists({ includeOptions: true }),
      adminStore.fetchPendingCounts()
    ])
    notifyAdminPendingUpdated({ source: 'bookings' })
    showNotice('Booking approved successfully', 'Success')
  } catch (error) {
    console.error('Failed to approve booking:', error)
  }
}
</script>

<style scoped>
.page-container {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  overflow: hidden;
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

.page-header {
  position: relative;
  overflow: visible;
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
}

.page-header :deep(.el-button:hover) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.page-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0.25rem 0.6rem 0.6rem;
  display: flex;
  flex-direction: column;
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

.page-content :deep(.el-table) {
  border-radius: 0;
  overflow: hidden;
  box-shadow: none;
  font-size: 0.8125rem;
}

.page-content :deep(.meeting-approval-table .el-table__body-wrapper) {
  overflow: auto;
}

.page-content :deep(.table-nowrap-col .cell) {
  white-space: nowrap;
}

.page-content :deep(.table-reason-col .cell) {
  white-space: normal;
  word-break: break-word;
  line-height: 1.45;
}

.page-content :deep(.table-meeting-title-col) {
  box-sizing: border-box;
}

.page-content :deep(.table-meeting-title-col .cell) {
  max-width: 400px;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
  line-height: 1.45;
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

.page-content :deep(.el-table td) {
  padding: 0.5rem;
  font-size: 0.8125rem;
  border-bottom: 1px solid #e5e7eb;
}

.page-content :deep(.el-table td.table-nowrap-col .cell) {
  white-space: nowrap;
}

.page-content :deep(.el-table__row:hover) {
  background: #f9fafb;
}

.page-content :deep(.el-button--small) {
  padding: 6px 14px;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.page-content :deep(.el-button--small:hover) {
  transform: none;
  box-shadow: none;
}

.page-content :deep(.el-tag) {
  padding: 4px 12px;
  border-radius: 6px;
  font-weight: 500;
  border: none;
}

.badge-item {
  margin-left: 8px;
}

.badge-item :deep(.el-badge__content) {
  background-color: #f56c6c;
  border: 2px solid #ffffff;
  font-weight: 600;
}

.badge-item--expired :deep(.el-badge__content) {
  background-color: #e6a23c;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.toolbar-search {
  width: min(460px, 48vw);
}

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
  right: 0;
  left: auto;
  min-width: 320px;
  background: white;
  border: 2px solid #00723a;
  border-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  z-index: 1000;
  animation: slideDown 0.2s ease-out;
}

.date-filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 2px solid #00723a;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
}

.filter-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: #00723a;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-title::before {
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
  color: #6b7280;
  font-size: 0.75rem;
}

:deep(.el-date-editor .el-range__icon) {
  color: #00723a;
}

:deep(.el-date-editor .el-range__close-icon) {
  color: #6b7280;
}

.date-range-picker {
  width: 100%;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-view {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.table-wrapper {
  flex: 1;
  min-height: 0;
  overflow-x: auto;
  overflow-y: auto;
  width: 100%;
}

.table-wrapper::-webkit-scrollbar,
.table-view::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.table-wrapper::-webkit-scrollbar-track,
.table-view::-webkit-scrollbar-track {
  background: #f3f4f6;
  border-radius: 4px;
}

.table-wrapper::-webkit-scrollbar-thumb,
.table-view::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 4px;
}

.table-card :deep(.meeting-approval-table) {
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

/* Handle Booking Form */
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

.meeting-title-textarea :deep(.el-textarea__inner) {
  line-height: 1.4;
  max-height: calc(1.4em * 4 + 1rem);
  overflow-y: auto;
  word-break: break-word;
  resize: none;
}

.notice-message {
  margin: 0;
  font-size: 15px;
  color: #374151;
  line-height: 1.6;
}

.reject-booking-form :deep(.el-form-item__label) {
  white-space: nowrap;
  padding-right: 8px;
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

.badge-tea-service-yes {
  background-color: #ccfbf1;
  color: #0f766e;
}

.badge-tea-service-no {
  background-color: #f3f4f6;
  color: #6b7280;
}

.tea-service-badge,
.display-homepage-badge {
  width: auto;
  min-width: 0;
  padding: 0.125rem 0.4375rem;
  text-align: center;
}

.tea-service-badge--interactive {
  cursor: help;
}

.tea-service-badge--interactive:hover {
  filter: brightness(0.97);
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
</style>

<style>
.reject-booking-template-select-popper.el-select-dropdown .el-select-dropdown__wrap {
  max-height: min(42vh, 300px) !important;
}

.reject-booking-template-select-popper.el-select-dropdown .el-scrollbar__wrap {
  max-height: min(42vh, 300px) !important;
}

.reject-booking-template-select-popper.el-select-dropdown .el-select-dropdown__list {
  padding-bottom: 8px;
}

.meeting-approval-tea-popover.el-popper {
  z-index: 3000;
}
</style>
