<template>
  <div class="page-container">
    <div class="page-header">
      <div class="toolbar-left">
        <h3 class="toolbar-title">User Management</h3>
      </div>
      <div class="toolbar-right">
        <el-input
          v-model="currentSearch"
          placeholder="Search current table data"
          clearable
          class="toolbar-search"
        />
        <el-button type="default" class="cancel-btn" :loading="exportLoading" @click="handleExport">
          <font-awesome-icon :icon="['fas', 'file-excel']" /> Export Excel
        </el-button>
        <el-button type="default" class="submit-btn" @click="handleAdd">
          <font-awesome-icon :icon="['fas', 'plus']" /> Add User
        </el-button>
        <el-button type="default" class="cancel-btn" @click="showQRCode = true">
          <font-awesome-icon :icon="['fas', 'qrcode']" /> Registration QR Code
        </el-button>
      </div>
    </div>

    <div class="page-content">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="User List" name="list">
          <div class="table-card">
            <div class="table-view">
              <div class="table-wrapper">
                <el-table v-loading="usersLoading" :data="employeeList" height="100%" border stripe table-layout="auto" style="width: 100%">
                  <el-table-column
                    type="index"
                    label="#"
                    width="70"
                    align="center"
                    header-align="center"
                    fixed="left"
                    :index="getUserRowIndex"
                  />
                  <el-table-column prop="corpId" min-width="130" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleSort('user', 'corpId')">
                        CORP User ID
                        <span class="sort-indicator">{{ getSortIndicator('user', 'corpId') }}</span>
                      </button>
                    </template>
                  </el-table-column>
                  <el-table-column prop="employeeNo" label="Employee No." min-width="140" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                  <el-table-column prop="lastName" label="Last Name" min-width="130" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                  <el-table-column prop="firstName" label="First Name" min-width="130" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                  <el-table-column prop="department" min-width="140" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                    <template #header>
                      <SortableFilterHeader
                        label="Department / Unit"
                        :sort-indicator="getSortIndicator('user', 'department')"
                        :filter-active="columnFilterState.user.department.length > 0"
                        :options="getFilterOptions('user', 'department')"
                        :model-value="columnFilterState.user.department"
                        @sort-asc="setSortByMenu('user', 'department', 'asc')"
                        @sort-desc="setSortByMenu('user', 'department', 'desc')"
                        @clear-sort="clearSortByMenu('user', 'department')"
                        @update:model-value="(v) => updateFilter('user', 'department', v)"
                      />
                    </template>
                  </el-table-column>
                  <el-table-column prop="rank" label="Rank" min-width="110" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                  <el-table-column prop="email" label="Email" min-width="240" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                  <el-table-column prop="contact" label="Contact No." min-width="140" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                  <el-table-column prop="role" min-width="150" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                    <template #header>
                      <SortableFilterHeader
                        label="Role"
                        :sort-indicator="getSortIndicator('user', 'role')"
                        :filter-active="columnFilterState.user.role.length > 0"
                        :options="getFilterOptions('user', 'role')"
                        :model-value="columnFilterState.user.role"
                        @sort-asc="setSortByMenu('user', 'role', 'asc')"
                        @sort-desc="setSortByMenu('user', 'role', 'desc')"
                        @clear-sort="clearSortByMenu('user', 'role')"
                        @update:model-value="(v) => updateFilter('user', 'role', v)"
                      />
                    </template>
                  </el-table-column>
                  <el-table-column width="168" class-name="table-nowrap-col quota-col" label-class-name="table-nowrap-col quota-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleSort('user', 'venueQuota')">
                        Venue {{ rowQuotaYearLabel('current') }}
                        <span class="sort-indicator">{{ getSortIndicator('user', 'venueQuota') }}</span>
                      </button>
                    </template>
                    <template #default="{ row }">
                      <button
                        type="button"
                        class="quota-cell-btn"
                        :title="`Current year (${row.quotaYear || currentQuotaYear}) — click for yearly details`"
                        @click="openYearlyQuotaModal(row, 'venue', row.quotaYear || currentQuotaYear)"
                      >
                        {{ formatQuotaDisplay(row.usedQuotaVenue, row.annualQuotaVenue) }}
                      </button>
                    </template>
                  </el-table-column>
                  <el-table-column width="168" class-name="table-nowrap-col quota-col" label-class-name="table-nowrap-col quota-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleSort('user', 'venueQuotaNext')">
                        Venue {{ rowQuotaYearLabel('next') }}
                        <span class="sort-indicator">{{ getSortIndicator('user', 'venueQuotaNext') }}</span>
                      </button>
                    </template>
                    <template #default="{ row }">
                      <button
                        type="button"
                        class="quota-cell-btn"
                        :title="`Next year (${row.nextQuotaYear || nextQuotaYear}) — click for yearly details`"
                        @click="openYearlyQuotaModal(row, 'venue', row.nextQuotaYear || nextQuotaYear)"
                      >
                        {{ formatQuotaDisplay(row.usedQuotaVenueNext, row.annualQuotaVenueNext) }}
                      </button>
                    </template>
                  </el-table-column>
                  <el-table-column width="150" class-name="table-nowrap-col quota-col" label-class-name="table-nowrap-col quota-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleSort('user', 'evQuota')">
                        EV {{ rowQuotaYearLabel('current') }}
                        <span class="sort-indicator">{{ getSortIndicator('user', 'evQuota') }}</span>
                      </button>
                    </template>
                    <template #default="{ row }">
                      <button
                        type="button"
                        class="quota-cell-btn"
                        :title="`Current year (${row.quotaYear || currentQuotaYear}) — click for yearly details`"
                        @click="openYearlyQuotaModal(row, 'ev', row.quotaYear || currentQuotaYear)"
                      >
                        {{ formatQuotaDisplay(row.usedQuotaEV, row.annualQuotaEV) }}
                      </button>
                    </template>
                  </el-table-column>
                  <el-table-column prop="status" min-width="120" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleSort('user', 'status')">
                        Status
                        <span class="sort-indicator">{{ getSortIndicator('user', 'status') }}</span>
                      </button>
                    </template>
                    <template #default="{ row }">
                      <span :class="['status-pill', `status-${row.status}`]">
                        {{ row.status === 'active' ? 'Active' : row.status === 'inactive' ? 'Inactive' : 'Expired' }}
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="lastLoginTime" min-width="190" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleSort('user', 'lastLoginTime')">
                        Last login time
                        <span class="sort-indicator">{{ getSortIndicator('user', 'lastLoginTime') }}</span>
                      </button>
                    </template>
                    <template #default="{ row }">
                      {{ formatDateTimeDisplay(row.lastLoginTime) }}
                    </template>
                  </el-table-column>
                  <el-table-column label="Actions" width="185" fixed="right" class-name="actions-col">
                    <template #default="{ row }">
                      <div class="actions-cell">
                        <el-button size="small" class="action-btn action-edit" @click="handleEdit(row)">Edit</el-button>
                        <el-button size="small" class="action-btn action-inactivate" @click="handleInactivate(row)">Inactive</el-button>
                        <el-tooltip content="Clear yearly quota overrides (fall back to default)" placement="top">
                          <el-button size="small" class="action-btn action-reset" @click="handleResetQuota(row)">Reset</el-button>
                        </el-tooltip>
                        <el-tooltip content="Reset Password" placement="top">
                          <el-button size="small" class="action-btn action-reset-password" @click="handleResetPassword(row)">
                            <font-awesome-icon :icon="['fas', 'key']" />
                          </el-button>
                        </el-tooltip>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>
            <div class="pagination-bar">
              <div class="pagination-info">
                Showing {{ employeeTotal ? employeeStartIndex + 1 : 0 }}-{{ employeeEndIndex }} of {{ employeeTotal }} records
              </div>
              <div class="pagination-controls">
                <button
                  class="pagination-btn"
                  :disabled="employeeCurrentPage === 1 || usersLoading"
                  @click="goEmployeePage(employeeCurrentPage - 1)"
                >
                  Previous
                </button>
                <button
                  v-for="page in employeeVisiblePages"
                  :key="page"
                  :class="['pagination-btn', 'page-number', { active: page === employeeCurrentPage }]"
                  @click="goEmployeePage(page)"
                >
                  {{ page }}
                </button>
                <button
                  class="pagination-btn"
                  :disabled="employeeCurrentPage === employeeTotalPages || usersLoading"
                  @click="goEmployeePage(employeeCurrentPage + 1)"
                >
                  Next
                </button>
              </div>
              <div class="pagination-size">
                <select v-model.number="employeePageSize" class="page-size-select" @change="onEmployeePageSizeChange">
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
              Expired & Inactive
            </span>
          </template>
          <div class="table-card">
            <div class="table-view">
              <div class="table-wrapper">
                <el-table v-loading="expiredLoading" :data="expiredList" height="100%" border stripe table-layout="auto" style="width: 100%">
                  <el-table-column
                    type="index"
                    label="#"
                    width="70"
                    align="center"
                    header-align="center"
                    fixed="left"
                    :index="getExpiredRowIndex"
                  />
                  <el-table-column prop="corpId" min-width="130" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleSort('expired', 'corpId')">
                        CORP User ID
                        <span class="sort-indicator">{{ getSortIndicator('expired', 'corpId') }}</span>
                      </button>
                    </template>
                  </el-table-column>
                  <el-table-column prop="employeeNo" label="Employee No." min-width="140" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                  <el-table-column prop="lastName" label="Last Name" min-width="130" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                  <el-table-column prop="firstName" label="First Name" min-width="130" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                  <el-table-column prop="department" min-width="140" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                    <template #header>
                      <SortableFilterHeader
                        label="Department / Unit"
                        :sort-indicator="getSortIndicator('expired', 'department')"
                        :filter-active="columnFilterState.expired.department.length > 0"
                        :options="getFilterOptions('expired', 'department')"
                        :model-value="columnFilterState.expired.department"
                        @sort-asc="setSortByMenu('expired', 'department', 'asc')"
                        @sort-desc="setSortByMenu('expired', 'department', 'desc')"
                        @clear-sort="clearSortByMenu('expired', 'department')"
                        @update:model-value="(v) => updateFilter('expired', 'department', v)"
                      />
                    </template>
                  </el-table-column>
                  <el-table-column prop="rank" label="Rank" min-width="110" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                  <el-table-column prop="email" label="Email" min-width="240" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                  <el-table-column prop="contact" label="Contact No." min-width="140" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                  <el-table-column prop="role" min-width="150" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                    <template #header>
                      <SortableFilterHeader
                        label="Role"
                        :sort-indicator="getSortIndicator('expired', 'role')"
                        :filter-active="columnFilterState.expired.role.length > 0"
                        :options="getFilterOptions('expired', 'role')"
                        :model-value="columnFilterState.expired.role"
                        @sort-asc="setSortByMenu('expired', 'role', 'asc')"
                        @sort-desc="setSortByMenu('expired', 'role', 'desc')"
                        @clear-sort="clearSortByMenu('expired', 'role')"
                        @update:model-value="(v) => updateFilter('expired', 'role', v)"
                      />
                    </template>
                  </el-table-column>
                  <el-table-column width="168" class-name="table-nowrap-col quota-col" label-class-name="table-nowrap-col quota-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleSort('expired', 'venueQuota')">
                        Venue {{ rowQuotaYearLabel('current') }}
                        <span class="sort-indicator">{{ getSortIndicator('expired', 'venueQuota') }}</span>
                      </button>
                    </template>
                    <template #default="{ row }">
                      <button
                        type="button"
                        class="quota-cell-btn"
                        :title="`Current year (${row.quotaYear || currentQuotaYear}) — click for yearly details`"
                        @click="openYearlyQuotaModal(row, 'venue', row.quotaYear || currentQuotaYear)"
                      >
                        {{ formatQuotaDisplay(row.usedQuotaVenue, row.annualQuotaVenue) }}
                      </button>
                    </template>
                  </el-table-column>
                  <el-table-column width="168" class-name="table-nowrap-col quota-col" label-class-name="table-nowrap-col quota-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleSort('expired', 'venueQuotaNext')">
                        Venue {{ rowQuotaYearLabel('next') }}
                        <span class="sort-indicator">{{ getSortIndicator('expired', 'venueQuotaNext') }}</span>
                      </button>
                    </template>
                    <template #default="{ row }">
                      <button
                        type="button"
                        class="quota-cell-btn"
                        :title="`Next year (${row.nextQuotaYear || nextQuotaYear}) — click for yearly details`"
                        @click="openYearlyQuotaModal(row, 'venue', row.nextQuotaYear || nextQuotaYear)"
                      >
                        {{ formatQuotaDisplay(row.usedQuotaVenueNext, row.annualQuotaVenueNext) }}
                      </button>
                    </template>
                  </el-table-column>
                  <el-table-column width="150" class-name="table-nowrap-col quota-col" label-class-name="table-nowrap-col quota-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleSort('expired', 'evQuota')">
                        EV {{ rowQuotaYearLabel('current') }}
                        <span class="sort-indicator">{{ getSortIndicator('expired', 'evQuota') }}</span>
                      </button>
                    </template>
                    <template #default="{ row }">
                      <button
                        type="button"
                        class="quota-cell-btn"
                        :title="`Current year (${row.quotaYear || currentQuotaYear}) — click for yearly details`"
                        @click="openYearlyQuotaModal(row, 'ev', row.quotaYear || currentQuotaYear)"
                      >
                        {{ formatQuotaDisplay(row.usedQuotaEV, row.annualQuotaEV) }}
                      </button>
                    </template>
                  </el-table-column>
                  <el-table-column prop="status" min-width="120" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleSort('expired', 'status')">
                        Status
                        <span class="sort-indicator">{{ getSortIndicator('expired', 'status') }}</span>
                      </button>
                    </template>
                    <template #default="{ row }">
                      <span :class="['status-pill', `status-${row.status}`]">
                        {{ row.status === 'expired' ? 'Expired' : 'Inactive' }}
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="lastLoginTime" min-width="190" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleSort('expired', 'lastLoginTime')">
                        Last login time
                        <span class="sort-indicator">{{ getSortIndicator('expired', 'lastLoginTime') }}</span>
                      </button>
                    </template>
                    <template #default="{ row }">
                      {{ formatDateTimeDisplay(row.lastLoginTime) }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="inactivedBy" min-width="160" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleSort('expired', 'inactivedBy')">
                        Inactived By
                        <span class="sort-indicator">{{ getSortIndicator('expired', 'inactivedBy') }}</span>
                      </button>
                    </template>
                    <template #default="{ row }">
                      {{ formatInactivedBy(row) }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="inactiveTime" min-width="190" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleSort('expired', 'inactiveTime')">
                        Inactive Time
                        <span class="sort-indicator">{{ getSortIndicator('expired', 'inactiveTime') }}</span>
                      </button>
                    </template>
                    <template #default="{ row }">
                      {{ formatDateTimeDisplay(row.inactiveTime) }}
                    </template>
                  </el-table-column>
                  <el-table-column label="Actions" width="130" fixed="right" class-name="actions-col">
                    <template #default="{ row }">
                      <div class="actions-cell">
                        <el-button size="small" class="action-btn action-activate" @click="handleActivate(row)">Activate</el-button>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>
            <div class="pagination-bar">
              <div class="pagination-info">
                Showing {{ expiredTotal ? expiredStartIndex + 1 : 0 }}-{{ expiredEndIndex }} of {{ expiredTotal }} records
              </div>
              <div class="pagination-controls">
                <button
                  class="pagination-btn"
                  :disabled="expiredCurrentPage === 1 || expiredLoading"
                  @click="goExpiredPage(expiredCurrentPage - 1)"
                >
                  Previous
                </button>
                <button
                  v-for="page in expiredVisiblePages"
                  :key="page"
                  :class="['pagination-btn', 'page-number', { active: page === expiredCurrentPage }]"
                  @click="goExpiredPage(page)"
                >
                  {{ page }}
                </button>
                <button
                  class="pagination-btn"
                  :disabled="expiredCurrentPage === expiredTotalPages || expiredLoading"
                  @click="goExpiredPage(expiredCurrentPage + 1)"
                >
                  Next
                </button>
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

        <el-tab-pane name="pending">
          <template #label>
            <span>
              Pending Approval
              <el-badge
                :value="pendingUsersCount"
                :max="99"
                :show-zero="false"
                class="badge-item"
              />
            </span>
          </template>

          <el-tabs v-model="pendingSubTab" class="sub-tabs">
            <el-tab-pane label="Pending" name="pending">
              <div class="table-card">
                <div class="table-view">
                  <div class="table-wrapper">
                    <el-table v-loading="pendingPendingLoading" :data="pendingList" height="100%" border stripe table-layout="auto" style="width: 100%">
                      <el-table-column
                        type="index"
                        label="#"
                        width="70"
                        align="center"
                        header-align="center"
                        fixed="left"
                        :index="getPendingPendingRowIndex"
                      />
                      <el-table-column prop="corpId" min-width="130" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                        <template #header>
                          <button type="button" class="th-sort-btn" @click="toggleSort('pendingPending', 'corpId')">
                            CORP User ID
                            <span class="sort-indicator">{{ getSortIndicator('pendingPending', 'corpId') }}</span>
                          </button>
                        </template>
                      </el-table-column>
                      <el-table-column prop="employeeNo" label="Employee No." min-width="140" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                      <el-table-column prop="lastName" label="Last Name" min-width="130" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                      <el-table-column prop="firstName" label="First Name" min-width="130" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                      <el-table-column prop="department" min-width="140" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                        <template #header>
                          <SortableFilterHeader
                            label="Department / Unit"
                            :sort-indicator="getSortIndicator('pendingPending', 'department')"
                            :filter-active="columnFilterState.pendingPending.department.length > 0"
                            :options="getFilterOptions('pendingPending', 'department')"
                            :model-value="columnFilterState.pendingPending.department"
                            @sort-asc="setSortByMenu('pendingPending', 'department', 'asc')"
                            @sort-desc="setSortByMenu('pendingPending', 'department', 'desc')"
                            @clear-sort="clearSortByMenu('pendingPending', 'department')"
                            @update:model-value="(v) => updateFilter('pendingPending', 'department', v)"
                          />
                        </template>
                      </el-table-column>
                      <el-table-column prop="rank" label="Rank" min-width="110" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                      <el-table-column prop="email" label="Email" min-width="240" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                      <el-table-column label="Contact No." min-width="140" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                        <template #default="{ row }">
                          {{ row.contactNo ?? row.contact ?? '' }}
                        </template>
                      </el-table-column>
                      <el-table-column prop="reason" label="Application Reason" min-width="220" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                      <el-table-column prop="submittedAt" min-width="180" class-name="submitted-at-col table-nowrap-col" label-class-name="table-nowrap-col">
                        <template #header>
                          <button type="button" class="th-sort-btn" @click="toggleSort('pendingPending', 'submittedAt')">
                            Submitted At
                            <span class="sort-indicator">{{ getSortIndicator('pendingPending', 'submittedAt') }}</span>
                          </button>
                        </template>
                        <template #default="{ row }">
                          <span class="submitted-at-text">{{ formatDateTimeDisplay(row.submittedAt) }}</span>
                        </template>
                      </el-table-column>
                      <el-table-column label="Actions" width="120" fixed="right" class-name="actions-col">
                        <template #default="{ row }">
                          <div class="actions-cell">
                            <el-button size="small" class="action-btn action-edit" @click="handlePending(row)">Handle</el-button>
                          </div>
                        </template>
                      </el-table-column>
                    </el-table>
                  </div>
                </div>
                <div class="pagination-bar">
                  <div class="pagination-info">
                    Showing {{ pendingPendingTotal ? pendingPendingStartIndex + 1 : 0 }}-{{ pendingPendingEndIndex }} of {{ pendingPendingTotal }} records
                  </div>
                  <div class="pagination-controls">
                    <button class="pagination-btn" :disabled="pendingPendingCurrentPage === 1 || pendingPendingLoading" @click="goPendingPendingPage(pendingPendingCurrentPage - 1)">Previous</button>
                    <button
                      v-for="page in pendingPendingVisiblePages"
                      :key="page"
                      :class="['pagination-btn', 'page-number', { active: page === pendingPendingCurrentPage }]"
                      @click="goPendingPendingPage(page)"
                    >
                      {{ page }}
                    </button>
                    <button class="pagination-btn" :disabled="pendingPendingCurrentPage === pendingPendingTotalPages || pendingPendingLoading" @click="goPendingPendingPage(pendingPendingCurrentPage + 1)">Next</button>
                  </div>
                  <div class="pagination-size">
                    <select v-model.number="pendingPendingPageSize" class="page-size-select" @change="onPendingPendingPageSizeChange">
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
                    <el-table v-loading="pendingApprovedLoading" :data="pendingApprovedList" height="100%" border stripe table-layout="auto" style="width: 100%">
                      <el-table-column
                        type="index"
                        label="#"
                        width="70"
                        align="center"
                        header-align="center"
                        fixed="left"
                        :index="getPendingApprovedRowIndex"
                      />
                      <el-table-column prop="corpId" min-width="130" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                        <template #header>
                          <button type="button" class="th-sort-btn" @click="toggleSort('pendingApproved', 'corpId')">
                            CORP User ID
                            <span class="sort-indicator">{{ getSortIndicator('pendingApproved', 'corpId') }}</span>
                          </button>
                        </template>
                      </el-table-column>
                      <el-table-column prop="employeeNo" label="Employee No." min-width="140" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                      <el-table-column prop="lastName" label="Last Name" min-width="130" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                      <el-table-column prop="firstName" label="First Name" min-width="130" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                      <el-table-column prop="department" min-width="140" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                        <template #header>
                          <SortableFilterHeader
                            label="Department / Unit"
                            :sort-indicator="getSortIndicator('pendingApproved', 'department')"
                            :filter-active="columnFilterState.pendingApproved.department.length > 0"
                            :options="getFilterOptions('pendingApproved', 'department')"
                            :model-value="columnFilterState.pendingApproved.department"
                            @sort-asc="setSortByMenu('pendingApproved', 'department', 'asc')"
                            @sort-desc="setSortByMenu('pendingApproved', 'department', 'desc')"
                            @clear-sort="clearSortByMenu('pendingApproved', 'department')"
                            @update:model-value="(v) => updateFilter('pendingApproved', 'department', v)"
                          />
                        </template>
                      </el-table-column>
                      <el-table-column prop="rank" label="Rank" min-width="110" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                      <el-table-column prop="email" label="Email" min-width="240" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                      <el-table-column label="Contact No." min-width="140" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                        <template #default="{ row }">
                          {{ row.contactNo ?? row.contact ?? '' }}
                        </template>
                      </el-table-column>
                      <el-table-column prop="role" min-width="150" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                        <template #header>
                          <SortableFilterHeader
                            label="Role"
                            :sort-indicator="getSortIndicator('pendingApproved', 'role')"
                            :filter-active="columnFilterState.pendingApproved.role.length > 0"
                            :options="getFilterOptions('pendingApproved', 'role')"
                            :model-value="columnFilterState.pendingApproved.role"
                            @sort-asc="setSortByMenu('pendingApproved', 'role', 'asc')"
                            @sort-desc="setSortByMenu('pendingApproved', 'role', 'desc')"
                            @clear-sort="clearSortByMenu('pendingApproved', 'role')"
                            @update:model-value="(v) => updateFilter('pendingApproved', 'role', v)"
                          />
                        </template>
                      </el-table-column>
                      <el-table-column prop="approvedBy" min-width="200" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                        <template #header>
                          <button type="button" class="th-sort-btn" @click="toggleSort('pendingApproved', 'approvedBy')">
                            Approved By
                            <span class="sort-indicator">{{ getSortIndicator('pendingApproved', 'approvedBy') }}</span>
                          </button>
                        </template>
                        <template #default="{ row }">
                          {{ row.approvedBy || '-' }}
                        </template>
                      </el-table-column>
                      <el-table-column prop="approvedAt" min-width="180" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                        <template #header>
                          <button type="button" class="th-sort-btn" @click="toggleSort('pendingApproved', 'approvedAt')">
                            Approved At
                            <span class="sort-indicator">{{ getSortIndicator('pendingApproved', 'approvedAt') }}</span>
                          </button>
                        </template>
                        <template #default="{ row }">
                          {{ formatDateTimeDisplay(row.approvedAt ?? row.handledAt) }}
                        </template>
                      </el-table-column>
                    </el-table>
                  </div>
                </div>
                <div class="pagination-bar">
                  <div class="pagination-info">
                    Showing {{ pendingApprovedTotal ? pendingApprovedStartIndex + 1 : 0 }}-{{ pendingApprovedEndIndex }} of {{ pendingApprovedTotal }} records
                  </div>
                  <div class="pagination-controls">
                    <button class="pagination-btn" :disabled="pendingApprovedCurrentPage === 1 || pendingApprovedLoading" @click="goPendingApprovedPage(pendingApprovedCurrentPage - 1)">Previous</button>
                    <button
                      v-for="page in pendingApprovedVisiblePages"
                      :key="page"
                      :class="['pagination-btn', 'page-number', { active: page === pendingApprovedCurrentPage }]"
                      @click="goPendingApprovedPage(page)"
                    >
                      {{ page }}
                    </button>
                    <button class="pagination-btn" :disabled="pendingApprovedCurrentPage === pendingApprovedTotalPages || pendingApprovedLoading" @click="goPendingApprovedPage(pendingApprovedCurrentPage + 1)">Next</button>
                  </div>
                  <div class="pagination-size">
                    <select v-model.number="pendingApprovedPageSize" class="page-size-select" @change="onPendingApprovedPageSizeChange">
                      <option :value="10">10 / page</option>
                      <option :value="20">20 / page</option>
                      <option :value="50">50 / page</option>
                      <option :value="100">100 / page</option>
                    </select>
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="Rejected" name="rejected">
              <div class="table-card">
                <div class="table-view">
                  <div class="table-wrapper">
                    <el-table v-loading="pendingRejectedLoading" :data="pendingRejectedList" height="100%" border stripe table-layout="auto" style="width: 100%">
                      <el-table-column
                        type="index"
                        label="#"
                        width="70"
                        align="center"
                        header-align="center"
                        fixed="left"
                        :index="getPendingRejectedRowIndex"
                      />
                      <el-table-column prop="corpId" min-width="130" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                        <template #header>
                          <button type="button" class="th-sort-btn" @click="toggleSort('pendingRejected', 'corpId')">
                            CORP User ID
                            <span class="sort-indicator">{{ getSortIndicator('pendingRejected', 'corpId') }}</span>
                          </button>
                        </template>
                      </el-table-column>
                      <el-table-column prop="employeeNo" label="Employee No." min-width="140" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                      <el-table-column prop="lastName" label="Last Name" min-width="130" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                      <el-table-column prop="firstName" label="First Name" min-width="130" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                      <el-table-column prop="department" min-width="140" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                        <template #header>
                          <SortableFilterHeader
                            label="Department / Unit"
                            :sort-indicator="getSortIndicator('pendingRejected', 'department')"
                            :filter-active="columnFilterState.pendingRejected.department.length > 0"
                            :options="getFilterOptions('pendingRejected', 'department')"
                            :model-value="columnFilterState.pendingRejected.department"
                            @sort-asc="setSortByMenu('pendingRejected', 'department', 'asc')"
                            @sort-desc="setSortByMenu('pendingRejected', 'department', 'desc')"
                            @clear-sort="clearSortByMenu('pendingRejected', 'department')"
                            @update:model-value="(v) => updateFilter('pendingRejected', 'department', v)"
                          />
                        </template>
                      </el-table-column>
                      <el-table-column prop="rank" label="Rank" min-width="110" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                      <el-table-column prop="email" label="Email" min-width="240" class-name="table-nowrap-col" label-class-name="table-nowrap-col" />
                      <el-table-column label="Contact No." min-width="140" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                        <template #default="{ row }">
                          {{ row.contactNo ?? row.contact ?? '' }}
                        </template>
                      </el-table-column>
                      <el-table-column prop="rejectedAt" min-width="180" class-name="rejected-at-col table-nowrap-col" label-class-name="table-nowrap-col">
                        <template #header>
                          <button type="button" class="th-sort-btn" @click="toggleSort('pendingRejected', 'rejectedAt')">
                            Rejected At
                            <span class="sort-indicator">{{ getSortIndicator('pendingRejected', 'rejectedAt') }}</span>
                          </button>
                        </template>
                        <template #default="{ row }">
                          <span class="rejected-at-text">{{ formatDateTimeDisplay(row.rejectedAt ?? row.handledAt) }}</span>
                        </template>
                      </el-table-column>
                      <el-table-column prop="rejectedBy" min-width="200" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                        <template #header>
                          <button type="button" class="th-sort-btn" @click="toggleSort('pendingRejected', 'rejectedBy')">
                            Rejected By
                            <span class="sort-indicator">{{ getSortIndicator('pendingRejected', 'rejectedBy') }}</span>
                          </button>
                        </template>
                        <template #default="{ row }">
                          {{ row.rejectedBy || '-' }}
                        </template>
                      </el-table-column>
                      <el-table-column prop="rejectReason" min-width="220" class-name="table-nowrap-col" label-class-name="table-nowrap-col">
                        <template #header>
                          <button type="button" class="th-sort-btn" @click="toggleSort('pendingRejected', 'rejectReason')">
                            Reject Reason
                            <span class="sort-indicator">{{ getSortIndicator('pendingRejected', 'rejectReason') }}</span>
                          </button>
                        </template>
                        <template #default="{ row }">
                          {{ row.rejectReason || '-' }}
                        </template>
                      </el-table-column>
                    </el-table>
                  </div>
                </div>
                <div class="pagination-bar">
                  <div class="pagination-info">
                    Showing {{ pendingRejectedTotal ? pendingRejectedStartIndex + 1 : 0 }}-{{ pendingRejectedEndIndex }} of {{ pendingRejectedTotal }} records
                  </div>
                  <div class="pagination-controls">
                    <button class="pagination-btn" :disabled="pendingRejectedCurrentPage === 1 || pendingRejectedLoading" @click="goPendingRejectedPage(pendingRejectedCurrentPage - 1)">Previous</button>
                    <button
                      v-for="page in pendingRejectedVisiblePages"
                      :key="page"
                      :class="['pagination-btn', 'page-number', { active: page === pendingRejectedCurrentPage }]"
                      @click="goPendingRejectedPage(page)"
                    >
                      {{ page }}
                    </button>
                    <button class="pagination-btn" :disabled="pendingRejectedCurrentPage === pendingRejectedTotalPages || pendingRejectedLoading" @click="goPendingRejectedPage(pendingRejectedCurrentPage + 1)">Next</button>
                  </div>
                  <div class="pagination-size">
                    <select v-model.number="pendingRejectedPageSize" class="page-size-select" @change="onPendingRejectedPageSizeChange">
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
        </el-tab-pane>
      </el-tabs>
    </div>

    <BookingStyleModal
      v-model="showForm"
      :title="formMode === 'add' ? 'Add User' : 'Edit User'"
      max-width="600px"
      :max-height="userModalMaxHeight"
    >
      <el-form :model="formData" label-width="140px">
        <el-form-item label="CORP User ID">
          <el-input
            :model-value="formData.corpId"
            placeholder="Capital letters and numbers only"
            @input="onFormCorpIdInput"
          />
        </el-form-item>
        <el-form-item label="Employee No.">
          <el-input v-model="formData.employeeNo" />
        </el-form-item>
        <el-form-item label="Last Name">
          <el-input v-model="formData.lastName" />
        </el-form-item>
        <el-form-item label="First Name">
          <el-input v-model="formData.firstName" />
        </el-form-item>
        <el-form-item label="Department / Unit">
          <el-select
            v-model="formData.department"
            placeholder="Select department / unit"
            style="width: 100%"
            :teleported="false"
            filterable
            allow-create
            default-first-option
            :reserve-keyword="false"
            :filter-method="handleDepartmentFilter"
            @blur="handleDepartmentBlur"
          >
            <el-option v-for="dept in departmentOptions" :key="dept" :label="dept" :value="dept" />
          </el-select>
        </el-form-item>
        <el-form-item label="Rank">
          <el-input v-model="formData.rank" />
        </el-form-item>
        <el-form-item label="Email">
          <el-input v-model="formData.email" type="email" />
        </el-form-item>
        <el-form-item label="Contact No.">
          <el-input v-model="formData.contact" />
        </el-form-item>
        <el-form-item label="Role">
          <el-select
            v-model="formData.role"
            placeholder="Select role"
            style="width: 100%"
            placement="top-start"
            :teleported="pendingApprovalSelectTeleported"
            popper-class="pending-approval-select-popper"
            :popper-style="pendingApprovalSelectTeleported ? { zIndex: 10100 } : {}"
          >
            <el-option v-for="r in roleOptions" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="formMode === 'add'" label="Initial Password">
          <el-input v-model="formData.password" type="text" autocomplete="new-password" />
        </el-form-item>
        <el-form-item v-if="formMode === 'add'" label="Car Plate No.">
          <el-input
            :model-value="formData.carPlateNo"
            placeholder="Enter car plate no. (optional)"
            maxlength="8"
            @input="onAddUserCarPlateInput"
          />
        </el-form-item>
        <el-form-item label="Venue Quota">
          <div class="quota-input-row">
            <el-input-number v-model="formData.annualQuotaVenue" :min="0" :disabled="isVenueQuotaUnlimited" />
            <el-checkbox v-model="isVenueQuotaUnlimited">Unlimited</el-checkbox>
            <span v-if="formMode === 'edit'" class="quota-year-hint">(current year)</span>
          </div>
        </el-form-item>
        <el-form-item label="EV Quota">
          <div class="quota-input-row">
            <el-input-number v-model="formData.annualQuotaEV" :min="0" :disabled="isEvQuotaUnlimited" />
            <el-checkbox v-model="isEvQuotaUnlimited">Unlimited</el-checkbox>
            <span v-if="formMode === 'edit'" class="quota-year-hint">(current year)</span>
          </div>
        </el-form-item>
        <el-form-item label="Status">
          <el-select
            v-model="formData.status"
            style="width: 100%"
            placement="top-start"
            :teleported="pendingApprovalSelectTeleported"
            popper-class="pending-approval-select-popper"
            :popper-style="pendingApprovalSelectTeleported ? { zIndex: 10100 } : {}"
          >
            <el-option label="Active" value="active" />
            <el-option label="Inactive" value="inactive" />
            <el-option label="Expired" value="expired" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="showForm = false">Cancel</el-button>
        <el-button type="default" class="submit-btn" @click="handleSave">Save</el-button>
      </template>
    </BookingStyleModal>

    <BookingStyleModal v-model="showQRCode" title="User Registration QR Code" max-width="450px">
      <div style="text-align: center;">
        <canvas ref="qrCanvas" style="display: none;"></canvas>
        <img v-if="qrCodeDataUrl" :src="qrCodeDataUrl" style="width: 280px; height: 280px; margin: 0 auto;" alt="QR Code" />
        <div v-else style="font-size: 120px; color: #00723a;">
          <font-awesome-icon :icon="['fas', 'qrcode']" />
        </div>
        <p style="margin-top: 1rem; color: #666; font-size: 14px;">Scan to register as new user</p>
        <p style="font-size: 12px; color: #999; word-break: break-all; padding: 0 1rem;">{{ registrationUrl }}</p>
      </div>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="showQRCode = false">Close</el-button>
        <el-button type="default" class="submit-btn" @click="downloadQRCode">
          <font-awesome-icon :icon="['fas', 'download']" /> Download QR Code
        </el-button>
      </template>
    </BookingStyleModal>

    <!-- Delete Confirmation Dialog -->
    <BookingStyleModal v-model="showDeleteDialog" title="Confirm Delete" max-width="450px">
      <p style="font-size: 15px; color: #374151; line-height: 1.6;">
        Are you sure you want to delete this user?
      </p>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="showDeleteDialog = false">Cancel</el-button>
        <el-button type="default" class="action-btn action-delete" @click="confirmDelete">Delete</el-button>
      </template>
    </BookingStyleModal>

    <!-- Reset Quota Confirmation Dialog -->
    <BookingStyleModal v-model="showResetDialog" title="Confirm Reset Yearly Overrides" max-width="450px">
      <p style="font-size: 15px; color: #374151; line-height: 1.6;">
        Clear all yearly quota overrides for this user? Each year will fall back to the default annual quota. Used counts are based on bookings and will not be cleared.
      </p>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="showResetDialog = false">Cancel</el-button>
        <el-button type="default" class="action-btn action-reset" @click="confirmReset">Reset</el-button>
      </template>
    </BookingStyleModal>

    <!-- Yearly Quota Detail / Edit Dialog -->
    <BookingStyleModal
      v-model="showYearlyQuotaDialog"
      :title="yearlyQuotaModalTitle"
      max-width="620px"
    >
      <div v-loading="yearlyQuotaLoading" class="yearly-quota-modal">

        <div class="yearly-quota-section">
          <h4 class="yearly-quota-section-title">Yearly usage</h4>
          <el-table
            :data="yearlyQuotaRows"
            empty-text="No years with bookings yet"
            class="yearly-quota-table"
            row-key="year"
            highlight-current-row
            :row-class-name="yearlyQuotaRowClassName"
            style="width: 100%"
            @row-click="onYearlyUsageRowClick"
          >
            <el-table-column prop="year" label="Year" width="100" />
            <el-table-column label="Venue" min-width="150">
              <template #default="{ row }">
                <span class="yearly-quota-value">{{ formatQuotaDisplay(row.usedVenue, row.annualQuotaVenue) }}</span>
                <span v-if="row.hasCustomVenueLimit" class="override-tag">custom</span>
              </template>
            </el-table-column>
            <el-table-column label="EV" min-width="150">
              <template #default="{ row }">
                <span class="yearly-quota-value">{{ formatQuotaDisplay(row.usedEv, row.annualQuotaEv) }}</span>
                <span v-if="row.hasCustomEvLimit" class="override-tag">custom</span>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="yearly-quota-section">
          <h4 class="yearly-quota-section-title">Edit year quota</h4>
          <p v-if="!yearlyEditYearOptions.length" class="yearly-quota-tip">
            No editable years. Quota can only be changed after the user has at least one booking in that year.
          </p>
          <div
            v-else
            class="yearly-year-picker"
            role="listbox"
            aria-label="Select year"
          >
            <button
              v-for="y in yearlyEditYearOptions"
              :key="y"
              type="button"
              class="yearly-year-chip"
              :class="{ 'is-active': Number(yearlyEditForm.year) === Number(y) }"
              @click="selectYearlyEditYear(y)"
            >
              {{ y }}
            </button>
          </div>
          <template v-if="yearlyEditYearOptions.length">
            <el-form label-width="130px" class="yearly-quota-edit-form" label-position="left">
              <el-form-item label="Venue Quota">
                <div class="quota-input-row">
                  <el-input-number
                    v-model="yearlyEditForm.annualQuotaVenue"
                    :min="0"
                    size="large"
                    :disabled="yearlyEditVenueUnlimited"
                  />
                  <el-checkbox v-model="yearlyEditVenueUnlimited" class="yearly-quota-checkbox">
                    Unlimited
                  </el-checkbox>
                </div>
              </el-form-item>
              <el-form-item label="EV Quota">
                <div class="quota-input-row">
                  <el-input-number
                    v-model="yearlyEditForm.annualQuotaEV"
                    :min="0"
                    size="large"
                    :disabled="yearlyEditEvUnlimited"
                  />
                  <el-checkbox v-model="yearlyEditEvUnlimited" class="yearly-quota-checkbox">
                    Unlimited
                  </el-checkbox>
                </div>
              </el-form-item>
            </el-form>
            <p class="yearly-quota-defaults">
              Editing <strong>{{ yearlyEditForm.year }}</strong>.
              Default quotas:
              <strong>Venue {{ formatQuotaLimit(yearlyQuotaMeta.defaultAnnualQuotaVenue) }}</strong>,
              <strong>EV {{ formatQuotaLimit(yearlyQuotaMeta.defaultAnnualQuotaEv) }}</strong>
            </p>
          </template>
        </div>
      </div>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="showYearlyQuotaDialog = false">Close</el-button>
        <el-button
          type="default"
          class="submit-btn"
          :loading="yearlyQuotaSaving"
          :disabled="!yearlyEditYearOptions.length"
          @click="saveYearlyQuota"
        >
          Save Year Quota
        </el-button>
      </template>
    </BookingStyleModal>

    <!-- Reset Password Confirmation Dialog -->
    <BookingStyleModal v-model="showResetPasswordDialog" title="Confirm Reset Password" max-width="450px">
      <p style="font-size: 15px; color: #374151; line-height: 1.6;">
        Reset password for this user?
      </p>
      <el-form :model="resetPasswordForm" label-width="140px" style="margin-top: 12px;">
        <el-form-item label="Password">
          <el-input v-model="resetPasswordForm.password" type="text" autocomplete="new-password" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="showResetPasswordDialog = false">Cancel</el-button>
        <el-button type="default" class="action-btn action-reset-password" @click="confirmResetPassword">Reset Password</el-button>
      </template>
    </BookingStyleModal>

    <!-- Pending Approval Handle Dialog -->
    <BookingStyleModal
      v-model="showPendingHandleDialog"
      title="Pending Approval Details"
      max-width="650px"
      :max-height="userModalMaxHeight"
      custom-class="pending-approval-detail-modal"
    >
      <el-form :model="pendingHandleForm" label-width="140px">
        <el-form-item label="CORP User ID">
          <el-input
            :model-value="pendingHandleForm.corpId"
            placeholder="Capital letters and numbers only"
            @input="onPendingCorpIdInput"
          />
        </el-form-item>
        <el-form-item label="Employee No.">
          <el-input v-model="pendingHandleForm.employeeNo" />
        </el-form-item>
        <el-form-item label="Last Name">
          <el-input v-model="pendingHandleForm.lastName" />
        </el-form-item>
        <el-form-item label="First Name">
          <el-input v-model="pendingHandleForm.firstName" />
        </el-form-item>
        <el-form-item label="Department / Unit">
          <el-select
            v-model="pendingHandleForm.department"
            filterable
            clearable
            allow-create
            default-first-option
            style="width: 100%"
            placeholder="Type department / unit name"
            :teleported="pendingApprovalSelectTeleported"
            :reserve-keyword="false"
            :filter-method="handlePendingDepartmentFilter"
            popper-class="pending-approval-select-popper"
            :popper-style="pendingApprovalSelectTeleported ? { zIndex: 10100 } : {}"
          >
            <el-option
              v-for="dept in displayedPendingDepartmentOptions"
              :key="dept.id"
              :label="dept.departmentName"
              :value="dept.departmentName"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="Rank">
          <el-input v-model="pendingHandleForm.rank" />
        </el-form-item>
        <el-form-item label="Email">
          <el-input v-model="pendingHandleForm.email" type="email" />
        </el-form-item>
        <el-form-item label="Contact No.">
          <el-input v-model="pendingHandleForm.contact" />
        </el-form-item>
        <el-form-item label="Reason">
          <el-input v-model="pendingHandleForm.reason" disabled />
        </el-form-item>
        <el-form-item v-if="pendingHandleForm.reason === 'EV booking'" label="Car Plate No.">
          <el-input
            :model-value="pendingHandleForm.carPlateNo"
            placeholder="Enter car plate no."
            maxlength="8"
            @input="onPendingCarPlateInput"
          />
        </el-form-item>
        <el-form-item label="Role">
          <el-select
            v-model="pendingHandleForm.role"
            placeholder="Select role"
            style="width: 100%"
            placement="top-start"
            :teleported="pendingApprovalSelectTeleported"
            popper-class="pending-approval-select-popper"
            :popper-style="pendingApprovalSelectTeleported ? { zIndex: 10100 } : {}"
          >
            <el-option v-for="r in roleOptions" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item label="Initial Password">
          <el-input v-model="pendingHandleForm.password" type="text" autocomplete="new-password" />
        </el-form-item>
        <el-form-item label="Venue Quota">
          <div class="quota-input-row">
            <el-input-number
              v-model="pendingHandleForm.annualQuotaVenue"
              :min="0"
              :disabled="isPendingVenueQuotaUnlimited"
            />
            <el-checkbox v-model="isPendingVenueQuotaUnlimited">Unlimited</el-checkbox>
          </div>
        </el-form-item>
        <el-form-item label="EV Quota">
          <div class="quota-input-row">
            <el-input-number
              v-model="pendingHandleForm.annualQuotaEV"
              :min="0"
              :disabled="isPendingEvQuotaUnlimited"
            />
            <el-checkbox v-model="isPendingEvQuotaUnlimited">Unlimited</el-checkbox>
          </div>
        </el-form-item>
        <el-form-item label="Submitted At">
          <el-input
            :model-value="formatDateTimeDisplay(pendingHandleForm.submittedAt)"
            readonly
            disabled
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button
          type="default"
          class="cancel-btn"
          @click="showPendingHandleDialog = false"
        >Cancel</el-button>
        <el-button
          type="default"
          class="action-btn action-delete"
          @click="openRejectDialogFromPendingDetails"
        >Reject</el-button>
        <el-button
          type="default"
          class="action-btn action-approve"
          @click="confirmPendingApprove"
        >Approve</el-button>
      </template>
    </BookingStyleModal>

    <!-- Reject Reason Dialog -->
    <BookingStyleModal
      v-model="showRejectDialog"
      title="Reject Registration"
      max-width="720px"
      custom-class="reject-registration-modal"
    >
      <el-form :model="rejectForm" class="reject-registration-form" label-width="132px">
        <el-form-item label="Reject Template">
          <el-select
            v-model="rejectForm.selectedTemplateId"
            filterable
            clearable
            default-first-option
            style="width: 100%"
            placeholder="Type template name"
            :teleported="pendingApprovalSelectTeleported"
            :reserve-keyword="false"
            :filter-method="handleRejectTemplateFilter"
            popper-class="reject-template-select-popper"
            :popper-style="pendingApprovalSelectTeleported ? { zIndex: 10100 } : {}"
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
            v-model="rejectForm.reason"
            type="textarea"
            :rows="6"
            placeholder="Optional: reason for rejection"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="closeRejectRegistrationDialog">Cancel</el-button>
        <el-button type="default" class="action-btn action-delete" @click="confirmReject">Confirm Reject</el-button>
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
import * as XLSX from 'xlsx'
import QRCode from 'qrcode'
import BookingStyleModal from '@/components/BookingStyleModal.vue'
import SortableFilterHeader from '@/components/admin/SortableFilterHeader.vue'
import { storeToRefs } from 'pinia'
import { useAdminStore } from '@/stores/admin'
import { getAccessRoles, getAccessDepartments } from '@/api/accessRight'
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  replaceUserPassword,
  resetUserQuotas,
  getUserYearlyQuotas,
  upsertUserYearlyQuota,
  updateUserStatus,
  listPendingUsers,
  approvePendingUser,
  rejectPendingUser
} from '@/api/userManagement'
import { getPrompts } from '@/api/promptManagement'
import { notifyPendingUsersUpdated } from '@/utils/pendingUsersSync'

const adminStore = useAdminStore()
const { pendingUsersCount } = storeToRefs(adminStore)

const currentQuotaYear = ref(new Date().getFullYear())
const nextQuotaYear = computed(() => Number(currentQuotaYear.value) + 1)

function rowQuotaYearLabel (kind) {
  const year = kind === 'next' ? nextQuotaYear.value : currentQuotaYear.value
  return `(${year})`
}

/** 后端字段为 annualQuotaEv；表格与表单沿用 annualQuotaEV */
function normalizeUserRow (u) {
  const quotaYear = u.quotaYear ?? currentQuotaYear.value
  return {
    ...u,
    quotaYear,
    nextQuotaYear: u.nextQuotaYear ?? Number(quotaYear) + 1,
    annualQuotaEV: u.annualQuotaEv ?? u.annualQuotaEV ?? 0,
    usedQuotaEV: u.usedQuotaEv ?? u.usedQuotaEV ?? 0,
    annualQuotaVenue: u.annualQuotaVenue ?? u.annualQuotaVenue ?? 0,
    usedQuotaVenue: u.usedQuotaVenue ?? u.usedQuotaVenue ?? 0,
    annualQuotaVenueNext: u.annualQuotaVenueNext ?? u.annualQuotaVenue ?? 0,
    usedQuotaVenueNext: u.usedQuotaVenueNext ?? 0,
    defaultAnnualQuotaEV: u.defaultAnnualQuotaEv ?? u.defaultAnnualQuotaEV ?? u.annualQuotaEv ?? u.annualQuotaEV ?? 0,
    defaultAnnualQuotaVenue:
      u.defaultAnnualQuotaVenue ?? u.annualQuotaVenue ?? 0
  }
}

const showYearlyQuotaDialog = ref(false)
const yearlyQuotaLoading = ref(false)
const yearlyQuotaSaving = ref(false)
const yearlyQuotaFocus = ref('ev')
const yearlyQuotaUser = ref(null)
const yearlyQuotaRows = ref([])
const yearlyQuotaMeta = ref({
  currentYear: currentQuotaYear.value,
  defaultAnnualQuotaEv: 0,
  defaultAnnualQuotaVenue: 0
})
const yearlyEditEvUnlimited = ref(false)
const yearlyEditVenueUnlimited = ref(false)
const yearlyEditForm = ref({
  year: currentQuotaYear.value,
  annualQuotaEV: 0,
  annualQuotaVenue: 0
})

const yearlyQuotaModalTitle = computed(() => {
  const name = yearlyQuotaUser.value?.name || yearlyQuotaUser.value?.corpId || 'User'
  const kind = yearlyQuotaFocus.value === 'venue' ? 'Venue' : 'EV'
  return `${kind} Quota — ${name}`
})

/** 当前年、下一年及已有预订年份可改额度（与后端列表一致） */
const yearlyEditYearOptions = computed(() => {
  return (yearlyQuotaRows.value || [])
    .map((r) => Number(r.year))
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => a - b)
})

watch(yearlyEditEvUnlimited, (checked) => {
  if (checked) yearlyEditForm.value.annualQuotaEV = -1
  else if (Number(yearlyEditForm.value.annualQuotaEV) < 0) yearlyEditForm.value.annualQuotaEV = 0
})
watch(yearlyEditVenueUnlimited, (checked) => {
  if (checked) yearlyEditForm.value.annualQuotaVenue = -1
  else if (Number(yearlyEditForm.value.annualQuotaVenue) < 0) yearlyEditForm.value.annualQuotaVenue = 0
})

/** 搜索：匹配合并名、姓名拆分字段、工号、职级 */
function matchesUserNameSearch (item, keyword) {
  return (
    String(item.name || '').toLowerCase().includes(keyword) ||
    String(item.firstName || '').toLowerCase().includes(keyword) ||
    String(item.lastName || '').toLowerCase().includes(keyword) ||
    String(item.employeeNo || '').toLowerCase().includes(keyword) ||
    String(item.rank || '').toLowerCase().includes(keyword)
  )
}

/** 审批人展示：有名字且仍有账号时「姓名 (id)」；账号删除后 FK 为空则仅显示快照姓名 */
function formatApproverDisplay (row) {
  const name = row.approverName ?? row.approver_name
  const id = row.approverUserId ?? row.approver_user_id
  if (name && id) return `${name} (${id})`
  if (name) return String(name)
  if (id) return String(id)
  return ''
}

function normalizePendingApprovedRow (p) {
  const handled = p.handledAt ?? p.handled_at
  return {
    ...p,
    approvedAt: handled,
    approvedBy: formatApproverDisplay(p)
  }
}

function normalizePendingRejectedRow (p) {
  const handled = p.handledAt ?? p.handled_at
  const reason = p.rejectReason ?? p.reject_reason
  return {
    ...p,
    rejectedAt: handled,
    rejectedBy: formatApproverDisplay(p),
    rejectReason: reason ?? null
  }
}

const usersLoading = ref(false)
const expiredLoading = ref(false)
const pendingPendingLoading = ref(false)
const pendingApprovedLoading = ref(false)
const pendingRejectedLoading = ref(false)
const exportLoading = ref(false)

const employeeTotal = ref(0)
const expiredTotal = ref(0)
const pendingPendingTotal = ref(0)
const pendingApprovedTotal = ref(0)
const pendingRejectedTotal = ref(0)

const filterOptionsState = ref({
  user: { department: [], role: [] },
  expired: { department: [], role: [] },
  pendingPending: { department: [], role: [] },
  pendingApproved: { department: [], role: [] },
  pendingRejected: { department: [], role: [] }
})

let searchReloadTimer = null

function normalizeListResponse (payload) {
  if (Array.isArray(payload)) {
    return { items: payload, total: payload.length, filterOptions: null }
  }
  const items = Array.isArray(payload?.items) ? payload.items : []
  const total = Number(payload?.total)
  if (payload?.quotaYear != null) {
    currentQuotaYear.value = Number(payload.quotaYear) || currentQuotaYear.value
  }
  return {
    items,
    total: Number.isFinite(total) ? total : items.length,
    filterOptions: payload?.filterOptions || null
  }
}

function getPrimarySort (tableKey) {
  const first = sortStates.value[tableKey]?.[0]
  if (!first?.key) return { sortBy: undefined, sortOrder: undefined }
  return {
    sortBy: first.key,
    sortOrder: first.order === 'asc' ? 'asc' : 'desc'
  }
}

function buildUserParams (tableKey, { includeOptions = false, all = false } = {}) {
  const isExpired = tableKey === 'expired'
  const { sortBy, sortOrder } = getPrimarySort(tableKey)
  const filters = columnFilterState.value[tableKey] || { department: [], role: [] }
  const params = {
    page: isExpired ? expiredCurrentPage.value : employeeCurrentPage.value,
    pageSize: isExpired ? expiredPageSize.value : employeePageSize.value,
    q: isExpired ? expiredSearch.value : employeeSearch.value,
    statusScope: isExpired ? 'expired_inactive' : 'active',
    sortBy,
    sortOrder,
    departments: filters.department?.length ? filters.department.join(',') : undefined,
    roles: filters.role?.length ? filters.role.join(',') : undefined,
    includeOptions: includeOptions ? 1 : undefined,
    all: all ? 1 : undefined
  }
  return params
}

function buildPendingParams (tableKey, { includeOptions = false, all = false } = {}) {
  const status =
    tableKey === 'pendingApproved'
      ? 'approved'
      : tableKey === 'pendingRejected'
        ? 'rejected'
        : 'pending'
  const page =
    tableKey === 'pendingApproved'
      ? pendingApprovedCurrentPage.value
      : tableKey === 'pendingRejected'
        ? pendingRejectedCurrentPage.value
        : pendingPendingCurrentPage.value
  const pageSize =
    tableKey === 'pendingApproved'
      ? pendingApprovedPageSize.value
      : tableKey === 'pendingRejected'
        ? pendingRejectedPageSize.value
        : pendingPendingPageSize.value
  const { sortBy, sortOrder } = getPrimarySort(tableKey)
  const filters = columnFilterState.value[tableKey] || { department: [], role: [] }
  return {
    status,
    page,
    pageSize,
    q: pendingSearch.value || undefined,
    sortBy,
    sortOrder,
    departments: filters.department?.length ? filters.department.join(',') : undefined,
    includeOptions: includeOptions ? 1 : undefined,
    all: all ? 1 : undefined
  }
}

function applyUserFilterOptions (tableKey, filterOptions) {
  if (!filterOptions) return
  filterOptionsState.value[tableKey] = {
    department: Array.isArray(filterOptions.departments) ? filterOptions.departments : [],
    role: Array.isArray(filterOptions.roles) ? filterOptions.roles : (filterOptionsState.value[tableKey]?.role || [])
  }
}

function applyPendingFilterOptions (tableKey, filterOptions) {
  if (!filterOptions) return
  filterOptionsState.value[tableKey] = {
    department: Array.isArray(filterOptions.departments) ? filterOptions.departments : [],
    role: filterOptionsState.value[tableKey]?.role || []
  }
}

async function loadActiveUsers ({ includeOptions = false } = {}) {
  usersLoading.value = true
  try {
    const payload = await listUsers(buildUserParams('user', { includeOptions }))
    const { items, total, filterOptions } = normalizeListResponse(payload)
    employeeList.value = items.map(normalizeUserRow)
    employeeTotal.value = total
    applyUserFilterOptions('user', filterOptions)
  } finally {
    usersLoading.value = false
  }
}

async function loadExpiredUsers ({ includeOptions = false } = {}) {
  expiredLoading.value = true
  try {
    const payload = await listUsers(buildUserParams('expired', { includeOptions }))
    const { items, total, filterOptions } = normalizeListResponse(payload)
    expiredList.value = items.map(normalizeUserRow)
    expiredTotal.value = total
    applyUserFilterOptions('expired', filterOptions)
  } finally {
    expiredLoading.value = false
  }
}

async function loadUsers () {
  await Promise.all([
    loadActiveUsers({ includeOptions: true }),
    loadExpiredUsers({ includeOptions: true })
  ])
}

async function loadPendingTable (tableKey, { includeOptions = false } = {}) {
  const loadingRef =
    tableKey === 'pendingApproved'
      ? pendingApprovedLoading
      : tableKey === 'pendingRejected'
        ? pendingRejectedLoading
        : pendingPendingLoading
  loadingRef.value = true
  try {
    const payload = await listPendingUsers(buildPendingParams(tableKey, { includeOptions }))
    const { items, total, filterOptions } = normalizeListResponse(payload)
    if (tableKey === 'pendingApproved') {
      pendingApprovedList.value = items.map(normalizePendingApprovedRow)
      pendingApprovedTotal.value = total
    } else if (tableKey === 'pendingRejected') {
      pendingRejectedList.value = items.map(normalizePendingRejectedRow)
      pendingRejectedTotal.value = total
    } else {
      pendingList.value = items
      pendingPendingTotal.value = total
    }
    applyPendingFilterOptions(tableKey, filterOptions)
  } finally {
    loadingRef.value = false
  }
}

async function loadPendingUsers ({ includeOptions = true } = {}) {
  await Promise.all([
    loadPendingTable('pendingPending', { includeOptions }),
    loadPendingTable('pendingApproved', { includeOptions }),
    loadPendingTable('pendingRejected', { includeOptions })
  ])
}

function scheduleTableReload (tableKey) {
  if (searchReloadTimer) clearTimeout(searchReloadTimer)
  searchReloadTimer = setTimeout(() => {
    resetTablePage(tableKey)
    if (tableKey === 'user') {
      loadActiveUsers({ includeOptions: true }).catch((e) => console.error(e))
    } else if (tableKey === 'expired') {
      loadExpiredUsers({ includeOptions: true }).catch((e) => console.error(e))
    } else if (tableKey === 'pendingAll') {
      pendingPendingCurrentPage.value = 1
      pendingApprovedCurrentPage.value = 1
      pendingRejectedCurrentPage.value = 1
      loadPendingUsers({ includeOptions: true }).catch((e) => console.error(e))
    } else {
      loadPendingTable(tableKey, { includeOptions: true }).catch((e) => console.error(e))
    }
  }, 300)
}

async function loadRoleAndDepartmentOptions () {
  const [rolesRes, deptsRes] = await Promise.all([
    getAccessRoles(),
    getAccessDepartments()
  ])
  accessRoleRows.value = Array.isArray(rolesRes) ? rolesRes : []
  roleOptions.value = accessRoleRows.value.map((r) => r.roleName)
  const depts = Array.isArray(deptsRes) ? deptsRes : []
  departmentRows.value = depts
  departmentOptions.value = depts
    .map((d) => d.departmentName)
    .filter((name) => String(name || '').trim())
    .sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }))
}

/** 来自后端 `prompts`（GET /prompt-management/prompts?category=reject_template） */
const rejectTemplatePrompts = ref([])

async function loadRejectTemplatePrompts () {
  try {
    const data = await getPrompts({ category: 'reject_template' })
    rejectTemplatePrompts.value = Array.isArray(data) ? data : []
  } catch (e) {
    console.error(e)
    rejectTemplatePrompts.value = []
  }
}

const activeTab = ref('list')
const pendingSubTab = ref('pending')

const employeeList = ref([])
const expiredList = ref([])

const pendingList = ref([])
const pendingApprovedList = ref([])
const pendingRejectedList = ref([])

const DEFAULT_PASSWORD = '123456'
const PLATE_MAX_LENGTH = 8

const sanitizePlateNumber = (raw) =>
  String(raw ?? '')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, PLATE_MAX_LENGTH)
    .toUpperCase()

/** 与登录页 / 用户注册一致：仅大写字母与数字 */
const sanitizeCorpId = (raw) => String(raw ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()

const onAddUserCarPlateInput = (val) => {
  formData.value.carPlateNo = sanitizePlateNumber(val)
}

const onFormCorpIdInput = (val) => {
  formData.value.corpId = sanitizeCorpId(val)
}

const onPendingCorpIdInput = (val) => {
  pendingHandleForm.value.corpId = sanitizeCorpId(val)
}

const onPendingCarPlateInput = (val) => {
  pendingHandleForm.value.carPlateNo = sanitizePlateNumber(val)
}

const resetPasswordForm = ref({
  password: DEFAULT_PASSWORD
})

/** 14" 常见视口宽度约 1100–1599：与 src/style.css 中 html zoom 断点一致 */
const USER_FORM_MODAL_MQ = '(min-width: 1100px) and (max-width: 1599px)'
const userModalMaxHeight = ref('94vh')
/** 该断点下 html zoom 0.8，el-select 若 teleported 挂 body 会与缩放坐标不一致 → 下拉整体偏移；断点外仍挂 body 以免被弹窗裁切 */
const pendingApprovalSelectTeleported = ref(true)

function updateUserModalMaxHeight () {
  if (typeof window === 'undefined') return
  const mq = window.matchMedia(USER_FORM_MODAL_MQ)
  userModalMaxHeight.value = mq.matches ? '110vh' : '94vh'
  pendingApprovalSelectTeleported.value = !mq.matches
}

if (typeof window !== 'undefined') {
  updateUserModalMaxHeight()
}

let userFormModalMq = null

/** Admin 布局收到同步信号后递增 revision，此处仅刷新待审批三张表 */
watch(
  () => adminStore.pendingUsersListRevision,
  () => {
    loadPendingUsers().catch((e) => console.error(e))
  }
)

onMounted(async () => {
  if (!registrationUrl.value) {
    registrationUrl.value = `${window.location.origin}/register`
  }
  try {
    await Promise.all([
      loadRoleAndDepartmentOptions(),
      loadUsers(),
      loadPendingUsers(),
      loadRejectTemplatePrompts()
    ])
  } catch (e) {
    console.error(e)
  }
  updateUserModalMaxHeight()
  userFormModalMq = window.matchMedia(USER_FORM_MODAL_MQ)
  userFormModalMq.addEventListener('change', updateUserModalMaxHeight)
})

onUnmounted(() => {
  if (searchReloadTimer) clearTimeout(searchReloadTimer)
  if (userFormModalMq) {
    userFormModalMq.removeEventListener('change', updateUserModalMaxHeight)
  }
})

const employeeCurrentPage = ref(1)
const employeePageSize = ref(20)
const pendingPendingCurrentPage = ref(1)
const pendingPendingPageSize = ref(20)
const pendingApprovedCurrentPage = ref(1)
const pendingApprovedPageSize = ref(20)
const pendingRejectedCurrentPage = ref(1)
const pendingRejectedPageSize = ref(20)
const expiredCurrentPage = ref(1)
const expiredPageSize = ref(20)
const employeeSearch = ref('')
const expiredSearch = ref('')
const pendingSearch = ref('')

const roleOptions = ref([])
/** Access Right 角色完整列表（含 AnnualEvQuota / AnnualVenueQuota） */
const accessRoleRows = ref([])
const departmentOptions = ref([])
/** 部门完整列表（含 id），供 Pending Approval 下拉与 Add License Owner 同款交互 */
const departmentRows = ref([])
const pendingDepartmentKeyword = ref('')

const displayedPendingDepartmentOptions = computed(() => {
  const keyword = pendingDepartmentKeyword.value.trim().toLowerCase()
  const source = departmentRows.value
  if (!keyword) return source.slice(0, 12)
  return source
    .filter((d) =>
      String(d.departmentName || '').toLowerCase().includes(keyword) ||
      String(d.id || '').toLowerCase().includes(keyword)
    )
    .slice(0, 30)
})

const handlePendingDepartmentFilter = (query) => {
  pendingDepartmentKeyword.value = String(query || '')
}

const departmentInputKeyword = ref('')

const handleDepartmentFilter = (query) => {
  departmentInputKeyword.value = String(query || '')
}

const handleDepartmentBlur = () => {
  const typed = departmentInputKeyword.value.trim()
  if (typed) {
    formData.value.department = typed
  }
  departmentInputKeyword.value = ''
}

const sortStates = ref({
  user: [],
  expired: [],
  pendingPending: [],
  pendingApproved: [],
  pendingRejected: []
})

const columnFilterState = ref({
  user: { department: [], role: [] },
  expired: { department: [], role: [] },
  pendingPending: { department: [], role: [] },
  pendingApproved: { department: [], role: [] },
  pendingRejected: { department: [], role: [] }
})

/** ISO / Date → 本地可读：YYYY-MM-DD HH:mm:ss */
function formatDateTimeDisplay (value) {
  if (value == null || value === '') return '-'
  const d = value instanceof Date ? value : new Date(String(value).replace(',', ''))
  const ts = d.getTime()
  if (Number.isNaN(ts)) return String(value)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}:${s}`
}

function formatInactivedBy (row) {
  const text = String(row?.inactivedBy || '').trim()
  return text || '-'
}

function resetTablePage (tableKey) {
  if (tableKey === 'user') employeeCurrentPage.value = 1
  else if (tableKey === 'expired') expiredCurrentPage.value = 1
  else if (tableKey === 'pendingPending') pendingPendingCurrentPage.value = 1
  else if (tableKey === 'pendingApproved') pendingApprovedCurrentPage.value = 1
  else if (tableKey === 'pendingRejected') pendingRejectedCurrentPage.value = 1
}

function reloadTable (tableKey, { includeOptions = false } = {}) {
  if (tableKey === 'user') {
    return loadActiveUsers({ includeOptions })
  }
  if (tableKey === 'expired') {
    return loadExpiredUsers({ includeOptions })
  }
  return loadPendingTable(tableKey, { includeOptions })
}

const getFilterOptions = (tableKey, key) => {
  return filterOptionsState.value[tableKey]?.[key] || []
}

const updateFilter = (tableKey, key, value) => {
  columnFilterState.value[tableKey][key] = value ?? []
  resetTablePage(tableKey)
  reloadTable(tableKey, { includeOptions: false }).catch((e) => console.error(e))
}

const selectAllFilterOptions = (tableKey, key, options) => {
  updateFilter(tableKey, key, [...options])
}

const clearFilterOptions = (tableKey, key) => {
  updateFilter(tableKey, key, [])
}

const toggleSort = (tableKey, key) => {
  const state = sortStates.value[tableKey]
  const idx = state.findIndex(item => item.key === key)
  if (idx === -1) {
    sortStates.value[tableKey] = [{ key, order: 'asc' }]
  } else if (state[idx].order === 'asc') {
    sortStates.value[tableKey] = [{ key, order: 'desc' }]
  } else {
    sortStates.value[tableKey] = []
  }
  resetTablePage(tableKey)
  reloadTable(tableKey, { includeOptions: false }).catch((e) => console.error(e))
}

const setSortByMenu = (tableKey, key, order) => {
  sortStates.value[tableKey] = [{ key, order }]
  resetTablePage(tableKey)
  reloadTable(tableKey, { includeOptions: false }).catch((e) => console.error(e))
}

const clearSortByMenu = (tableKey, key) => {
  const state = sortStates.value[tableKey]
  const idx = state.findIndex(item => item.key === key)
  if (idx !== -1) state.splice(idx, 1)
  resetTablePage(tableKey)
  reloadTable(tableKey, { includeOptions: false }).catch((e) => console.error(e))
}

const getSortIndicator = (tableKey, key) => {
  const state = sortStates.value[tableKey] || []
  const idx = state.findIndex(item => item.key === key)
  if (idx === -1) return '↕'
  return state[idx].order === 'asc' ? '▲' : '▼'
}

function buildVisiblePages (currentPage, totalPages) {
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages, start + maxVisible - 1)
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
}

const currentSearch = computed({
  get: () => {
    if (activeTab.value === 'list') return employeeSearch.value
    if (activeTab.value === 'expired') return expiredSearch.value
    return pendingSearch.value
  },
  set: (value) => {
    if (activeTab.value === 'list') {
      employeeSearch.value = value
    } else if (activeTab.value === 'expired') {
      expiredSearch.value = value
    } else {
      pendingSearch.value = value
    }
  }
})

watch(employeeSearch, () => scheduleTableReload('user'))
watch(expiredSearch, () => scheduleTableReload('expired'))
watch(pendingSearch, () => scheduleTableReload('pendingAll'))

const employeeTotalPages = computed(() => Math.max(1, Math.ceil(employeeTotal.value / employeePageSize.value)))
const employeeStartIndex = computed(() => {
  if (!employeeTotal.value) return 0
  return (employeeCurrentPage.value - 1) * employeePageSize.value
})
const employeeEndIndex = computed(() => Math.min(employeeStartIndex.value + employeeList.value.length, employeeTotal.value))
const employeeVisiblePages = computed(() => buildVisiblePages(employeeCurrentPage.value, employeeTotalPages.value))

const expiredTotalPages = computed(() => Math.max(1, Math.ceil(expiredTotal.value / expiredPageSize.value)))
const expiredStartIndex = computed(() => {
  if (!expiredTotal.value) return 0
  return (expiredCurrentPage.value - 1) * expiredPageSize.value
})
const expiredEndIndex = computed(() => Math.min(expiredStartIndex.value + expiredList.value.length, expiredTotal.value))
const expiredVisiblePages = computed(() => buildVisiblePages(expiredCurrentPage.value, expiredTotalPages.value))

const pendingPendingTotalPages = computed(() => Math.max(1, Math.ceil(pendingPendingTotal.value / pendingPendingPageSize.value)))
const pendingPendingStartIndex = computed(() => {
  if (!pendingPendingTotal.value) return 0
  return (pendingPendingCurrentPage.value - 1) * pendingPendingPageSize.value
})
const pendingPendingEndIndex = computed(() => Math.min(pendingPendingStartIndex.value + pendingList.value.length, pendingPendingTotal.value))
const pendingPendingVisiblePages = computed(() => buildVisiblePages(pendingPendingCurrentPage.value, pendingPendingTotalPages.value))

const pendingApprovedTotalPages = computed(() => Math.max(1, Math.ceil(pendingApprovedTotal.value / pendingApprovedPageSize.value)))
const pendingApprovedStartIndex = computed(() => {
  if (!pendingApprovedTotal.value) return 0
  return (pendingApprovedCurrentPage.value - 1) * pendingApprovedPageSize.value
})
const pendingApprovedEndIndex = computed(() => Math.min(pendingApprovedStartIndex.value + pendingApprovedList.value.length, pendingApprovedTotal.value))
const pendingApprovedVisiblePages = computed(() => buildVisiblePages(pendingApprovedCurrentPage.value, pendingApprovedTotalPages.value))

const pendingRejectedTotalPages = computed(() => Math.max(1, Math.ceil(pendingRejectedTotal.value / pendingRejectedPageSize.value)))
const pendingRejectedStartIndex = computed(() => {
  if (!pendingRejectedTotal.value) return 0
  return (pendingRejectedCurrentPage.value - 1) * pendingRejectedPageSize.value
})
const pendingRejectedEndIndex = computed(() => Math.min(pendingRejectedStartIndex.value + pendingRejectedList.value.length, pendingRejectedTotal.value))
const pendingRejectedVisiblePages = computed(() => buildVisiblePages(pendingRejectedCurrentPage.value, pendingRejectedTotalPages.value))

function goEmployeePage (page) {
  const next = Math.min(Math.max(1, page), employeeTotalPages.value)
  if (next === employeeCurrentPage.value) return
  employeeCurrentPage.value = next
  loadActiveUsers({ includeOptions: false }).catch((e) => console.error(e))
}

function goExpiredPage (page) {
  const next = Math.min(Math.max(1, page), expiredTotalPages.value)
  if (next === expiredCurrentPage.value) return
  expiredCurrentPage.value = next
  loadExpiredUsers({ includeOptions: false }).catch((e) => console.error(e))
}

function goPendingPendingPage (page) {
  const next = Math.min(Math.max(1, page), pendingPendingTotalPages.value)
  if (next === pendingPendingCurrentPage.value) return
  pendingPendingCurrentPage.value = next
  loadPendingTable('pendingPending', { includeOptions: false }).catch((e) => console.error(e))
}

function goPendingApprovedPage (page) {
  const next = Math.min(Math.max(1, page), pendingApprovedTotalPages.value)
  if (next === pendingApprovedCurrentPage.value) return
  pendingApprovedCurrentPage.value = next
  loadPendingTable('pendingApproved', { includeOptions: false }).catch((e) => console.error(e))
}

function goPendingRejectedPage (page) {
  const next = Math.min(Math.max(1, page), pendingRejectedTotalPages.value)
  if (next === pendingRejectedCurrentPage.value) return
  pendingRejectedCurrentPage.value = next
  loadPendingTable('pendingRejected', { includeOptions: false }).catch((e) => console.error(e))
}

function onEmployeePageSizeChange () {
  employeeCurrentPage.value = 1
  loadActiveUsers({ includeOptions: false }).catch((e) => console.error(e))
}

function onExpiredPageSizeChange () {
  expiredCurrentPage.value = 1
  loadExpiredUsers({ includeOptions: false }).catch((e) => console.error(e))
}

function onPendingPendingPageSizeChange () {
  pendingPendingCurrentPage.value = 1
  loadPendingTable('pendingPending', { includeOptions: false }).catch((e) => console.error(e))
}

function onPendingApprovedPageSizeChange () {
  pendingApprovedCurrentPage.value = 1
  loadPendingTable('pendingApproved', { includeOptions: false }).catch((e) => console.error(e))
}

function onPendingRejectedPageSizeChange () {
  pendingRejectedCurrentPage.value = 1
  loadPendingTable('pendingRejected', { includeOptions: false }).catch((e) => console.error(e))
}

const showForm = ref(false)
const showQRCode = ref(false)
const showDeleteDialog = ref(false)
const showResetDialog = ref(false)
const showResetPasswordDialog = ref(false)
const showPendingHandleDialog = ref(false)
const showApproveDialog = ref(false)
const showRejectDialog = ref(false)
const currentRow = ref(null)
const showNoticeDialog = ref(false)
const noticeTitle = ref('Notice')
const noticeMessage = ref('')

const showNotice = (message, title = 'Notice') => {
  noticeTitle.value = title
  noticeMessage.value = message
  showNoticeDialog.value = true
}
const formMode = ref('add')
const isEvQuotaUnlimited = ref(false)
const isVenueQuotaUnlimited = ref(false)

const formData = ref({
  corpId: '',
  firstName: '',
  lastName: '',
  employeeNo: '',
  rank: '',
  department: '',
  role: '',
  contact: '',
  email: '',
  password: DEFAULT_PASSWORD,
  carPlateNo: '',
  annualQuotaEV: 0,
  annualQuotaVenue: 0,
  usedQuotaEV: 0,
  usedQuotaVenue: 0,
  status: 'active'
})

watch(isEvQuotaUnlimited, (checked) => {
  if (checked) formData.value.annualQuotaEV = -1
  else if (Number(formData.value.annualQuotaEV) < 0) formData.value.annualQuotaEV = 0
})

watch(isVenueQuotaUnlimited, (checked) => {
  if (checked) formData.value.annualQuotaVenue = -1
  else if (Number(formData.value.annualQuotaVenue) < 0) formData.value.annualQuotaVenue = 0
})

function getRoleQuotaDefaults (roleName) {
  if (!roleName) return null
  const role = accessRoleRows.value.find((r) => r.roleName === roleName)
  if (!role) return null
  const evQuota = Number(role.AnnualEvQuota ?? 0)
  const venueQuota = Number(role.AnnualVenueQuota ?? 0)
  return {
    evQuota,
    venueQuota,
    evUnlimited: evQuota === -1,
    venueUnlimited: venueQuota === -1
  }
}

function applyRoleQuotaDefaults (roleName) {
  const defaults = getRoleQuotaDefaults(roleName)
  if (!defaults) return
  isEvQuotaUnlimited.value = defaults.evUnlimited
  isVenueQuotaUnlimited.value = defaults.venueUnlimited
  formData.value.annualQuotaEV = defaults.evUnlimited ? -1 : defaults.evQuota
  formData.value.annualQuotaVenue = defaults.venueUnlimited ? -1 : defaults.venueQuota
}

function applyPendingRoleQuotaDefaults (roleName) {
  const defaults = getRoleQuotaDefaults(roleName)
  if (!defaults) return
  isPendingEvQuotaUnlimited.value = defaults.evUnlimited
  isPendingVenueQuotaUnlimited.value = defaults.venueUnlimited
  pendingHandleForm.value.annualQuotaEV = defaults.evUnlimited ? -1 : defaults.evQuota
  pendingHandleForm.value.annualQuotaVenue = defaults.venueUnlimited ? -1 : defaults.venueQuota
}

watch(
  () => formData.value.role,
  (roleName) => {
    if (formMode.value !== 'add' || !showForm.value) return
    applyRoleQuotaDefaults(roleName)
  }
)

const isPendingEvQuotaUnlimited = ref(false)
const isPendingVenueQuotaUnlimited = ref(false)

const pendingHandleForm = ref({
  id: null,
  corpId: '',
  firstName: '',
  lastName: '',
  employeeNo: '',
  rank: '',
  department: '',
  role: '',
  contact: '',
  email: '',
  reason: '',
  carPlateNo: '',
  password: DEFAULT_PASSWORD,
  annualQuotaEV: 0,
  annualQuotaVenue: 0,
  submittedAt: ''
})

watch(isPendingEvQuotaUnlimited, (checked) => {
  if (checked) pendingHandleForm.value.annualQuotaEV = -1
  else if (Number(pendingHandleForm.value.annualQuotaEV) < 0) pendingHandleForm.value.annualQuotaEV = 0
})

watch(isPendingVenueQuotaUnlimited, (checked) => {
  if (checked) pendingHandleForm.value.annualQuotaVenue = -1
  else if (Number(pendingHandleForm.value.annualQuotaVenue) < 0) pendingHandleForm.value.annualQuotaVenue = 0
})

watch(
  () => pendingHandleForm.value.role,
  (roleName) => {
    if (!showPendingHandleDialog.value) return
    applyPendingRoleQuotaDefaults(roleName)
  }
)

/** 拒绝弹窗是否从「Pending Approval Details」中的 Reject 打开（与列表行拒绝区分） */
const rejectFromPendingDetails = ref(false)

const rejectForm = ref({
  selectedTemplateId: null,
  reason: ''
})
const rejectTemplateOptions = computed(() =>
  rejectTemplatePrompts.value.filter((item) => item.templateType === 'user_application')
)

const rejectTemplateKeyword = ref('')

const displayedRejectTemplateOptions = computed(() => {
  const keyword = rejectTemplateKeyword.value.trim().toLowerCase()
  const source = rejectTemplateOptions.value
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
    rejectForm.value.reason = ''
    return
  }
  const selectedTemplate = rejectTemplateOptions.value.find(
    (item) => String(item.id) === String(templateId)
  )
  if (!selectedTemplate) {
    rejectForm.value.reason = ''
    return
  }
  rejectForm.value.reason = selectedTemplate.content || ''
}

watch(showRejectDialog, async (open) => {
  if (!open) {
    rejectFromPendingDetails.value = false
  } else {
    rejectTemplateKeyword.value = ''
    await loadRejectTemplatePrompts()
  }
})

const registrationUrl = ref('')
const qrCanvas = ref(null)
const qrCodeDataUrl = ref('')

// Watch showQRCode to generate QR code when dialog opens
watch(showQRCode, async (newVal) => {
  if (newVal && registrationUrl.value) {
    try {
      qrCodeDataUrl.value = await QRCode.toDataURL(registrationUrl.value, {
        width: 280,
        margin: 2,
        color: {
          dark: '#00723a',
          light: '#ffffff'
        }
      })
    } catch (error) {
      console.error('Failed to generate QR code:', error)
      showNotice('Failed to generate QR code', 'Error')
    }
  }
})


const downloadQRCode = () => {
  if (!qrCodeDataUrl.value) {
    showNotice('QR code not generated yet', 'Warning')
    return
  }

  const link = document.createElement('a')
  link.download = `User_Registration_QRCode_${new Date().toISOString().split('T')[0]}.png`
  link.href = qrCodeDataUrl.value
  link.click()
  showNotice('QR code downloaded successfully', 'Success')
}

const getUserRowIndex = (index) => {
  return (employeeCurrentPage.value - 1) * employeePageSize.value + index + 1
}

const getPendingPendingRowIndex = (index) => {
  return (pendingPendingCurrentPage.value - 1) * pendingPendingPageSize.value + index + 1
}

const getPendingApprovedRowIndex = (index) => {
  return (pendingApprovedCurrentPage.value - 1) * pendingApprovedPageSize.value + index + 1
}

const getPendingRejectedRowIndex = (index) => {
  return (pendingRejectedCurrentPage.value - 1) * pendingRejectedPageSize.value + index + 1
}

const getExpiredRowIndex = (index) => {
  return (expiredCurrentPage.value - 1) * expiredPageSize.value + index + 1
}

const formatQuotaDisplay = (used, annual) => {
  if (Number(annual) === -1) return `${used ?? 0} / Unlimited`
  return `${used ?? 0} / ${annual ?? 0}`
}

const formatQuotaLimit = (annual) => {
  if (Number(annual) === -1) return 'Unlimited'
  return String(annual ?? 0)
}

const applyYearlyPayload = (payload) => {
  const data = payload?.data ?? payload ?? {}
  currentQuotaYear.value = data.currentYear || currentQuotaYear.value
  yearlyQuotaMeta.value = {
    currentYear: data.currentYear || currentQuotaYear.value,
    defaultAnnualQuotaEv: data.defaultAnnualQuotaEv ?? 0,
    defaultAnnualQuotaVenue: data.defaultAnnualQuotaVenue ?? 0
  }
  yearlyQuotaRows.value = Array.isArray(data.years) ? data.years : []
}

const fillYearlyEditFromRow = (year) => {
  const y = Number(year) || yearlyQuotaMeta.value.currentYear
  yearlyEditForm.value.year = y
  const row = (yearlyQuotaRows.value || []).find((r) => Number(r.year) === y)
  const ev = row?.annualQuotaEv ?? yearlyQuotaMeta.value.defaultAnnualQuotaEv ?? 0
  const venue = row?.annualQuotaVenue ?? yearlyQuotaMeta.value.defaultAnnualQuotaVenue ?? 0
  yearlyEditEvUnlimited.value = Number(ev) === -1
  yearlyEditVenueUnlimited.value = Number(venue) === -1
  yearlyEditForm.value.annualQuotaEV = Number(ev) === -1 ? -1 : Number(ev ?? 0)
  yearlyEditForm.value.annualQuotaVenue = Number(venue) === -1 ? -1 : Number(venue ?? 0)
}

const selectYearlyEditYear = (year) => {
  fillYearlyEditFromRow(year)
}

const yearlyQuotaRowClassName = ({ row }) => {
  return Number(row?.year) === Number(yearlyEditForm.value.year)
    ? 'is-selected-year'
    : ''
}

const onYearlyUsageRowClick = (row) => {
  if (!row) return
  selectYearlyEditYear(row.year)
}

const openYearlyQuotaModal = async (row, focus = 'ev', preferredYear = null) => {
  yearlyQuotaUser.value = row
  yearlyQuotaFocus.value = focus === 'venue' ? 'venue' : 'ev'
  showYearlyQuotaDialog.value = true
  yearlyQuotaLoading.value = true
  try {
    const payload = await getUserYearlyQuotas(row.id)
    applyYearlyPayload(payload)
    const preferred = Number(preferredYear)
    const years = yearlyEditYearOptions.value
    const targetYear =
      (Number.isFinite(preferred) && years.includes(preferred) ? preferred : null)
      ?? years[0]
    if (targetYear != null) {
      fillYearlyEditFromRow(targetYear)
    }
  } catch (e) {
    console.error(e)
    showNotice('Failed to load yearly quotas', 'Error')
    showYearlyQuotaDialog.value = false
  } finally {
    yearlyQuotaLoading.value = false
  }
}

const saveYearlyQuota = async () => {
  if (!yearlyQuotaUser.value?.id) return
  if (!yearlyEditYearOptions.value.length) {
    showNotice('No editable year available', 'Warning')
    return
  }
  const year = Number.parseInt(String(yearlyEditForm.value.year), 10)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    showNotice('Please select a valid year', 'Warning')
    return
  }
  if (!yearlyEditYearOptions.value.includes(year)) {
    showNotice('Please select a year from the list', 'Warning')
    return
  }
  yearlyEditForm.value.year = year
  yearlyQuotaSaving.value = true
  try {
    const payload = await upsertUserYearlyQuota(yearlyQuotaUser.value.id, {
      year,
      annualQuotaEV: yearlyEditEvUnlimited.value ? -1 : Number(yearlyEditForm.value.annualQuotaEV ?? 0),
      annualQuotaVenue: yearlyEditVenueUnlimited.value ? -1 : Number(yearlyEditForm.value.annualQuotaVenue ?? 0)
    })
    applyYearlyPayload(payload)
    fillYearlyEditFromRow(year)
    await loadUsers()
    showNotice(`Quota for ${year} saved`, 'Success')
  } catch (e) {
    console.error(e)
    const msg = e?.response?.data?.message || e?.message || 'Failed to save yearly quota'
    showNotice(Array.isArray(msg) ? msg.join('; ') : msg, 'Error')
  } finally {
    yearlyQuotaSaving.value = false
  }
}

const handleExport = async () => {
  if (exportLoading.value) return
  exportLoading.value = true
  try {
    const payload = await listUsers({ all: 1, statusScope: 'all' })
    const { items } = normalizeListResponse(payload)
    const rows = items.map(normalizeUserRow)
    const exportData = rows.map(item => ({
      ID: item.id ?? '',
      'CORP User ID': item.corpId,
      'Employee No.': item.employeeNo || '',
      'First Name': item.firstName || '',
      'Last Name': item.lastName || '',
      'Department / Unit': item.department,
      'Rank': item.rank || '',
      'Email': item.email,
      'Contact No.': item.contact || '',
      'Role': item.role,
      'Quota Year (Current)': item.quotaYear || currentQuotaYear.value,
      [`Venue Quota (${item.quotaYear || currentQuotaYear.value})`]: item.annualQuotaVenue,
      [`Used Venue (${item.quotaYear || currentQuotaYear.value})`]: item.usedQuotaVenue,
      [`Venue Quota (${item.nextQuotaYear || nextQuotaYear.value})`]: item.annualQuotaVenueNext,
      [`Used Venue (${item.nextQuotaYear || nextQuotaYear.value})`]: item.usedQuotaVenueNext,
      [`EV Quota (${item.quotaYear || currentQuotaYear.value})`]: item.annualQuotaEV,
      [`Used EV (${item.quotaYear || currentQuotaYear.value})`]: item.usedQuotaEV,
      'Status': item.status === 'active' ? 'Active' : item.status === 'inactive' ? 'Inactive' : 'Expired',
      'Last login time': formatDateTimeDisplay(item.lastLoginTime),
      'Inactive Time': formatDateTimeDisplay(item.inactiveTime),
      'Inactived By': formatInactivedBy(item)
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Users')
    XLSX.writeFile(wb, `User_Management_${new Date().toISOString().split('T')[0]}.xlsx`)
    showNotice('Excel file exported successfully', 'Success')
  } catch (error) {
    console.error('Failed to export users:', error)
    showNotice('Failed to export Excel file', 'Error')
  } finally {
    exportLoading.value = false
  }
}

const handleAdd = () => {
  formMode.value = 'add'
  isEvQuotaUnlimited.value = false
  isVenueQuotaUnlimited.value = false
  formData.value = {
    corpId: '',
    firstName: '',
    lastName: '',
    employeeNo: '',
    rank: '',
    department: '',
    role: '',
    contact: '',
    email: '',
    password: DEFAULT_PASSWORD,
    carPlateNo: '',
    annualQuotaEV: 0,
    annualQuotaVenue: 0,
    usedQuotaEV: 0,
    usedQuotaVenue: 0,
    status: 'active'
  }
  showForm.value = true
}

const handleEdit = (row) => {
  formMode.value = 'edit'
  // 编辑弹窗展示当年有效额度（含按年覆盖），不是用户默认年额度
  const yearEv = row.annualQuotaEV
  const yearVenue = row.annualQuotaVenue
  formData.value = {
    ...row,
    password: '',
    annualQuotaEV: yearEv,
    annualQuotaVenue: yearVenue
  }
  isEvQuotaUnlimited.value = Number(yearEv) === -1
  isVenueQuotaUnlimited.value = Number(yearVenue) === -1
  showForm.value = true
}

const handleSave = async () => {
  try {
    const corpId = sanitizeCorpId(formData.value.corpId)
    formData.value.corpId = corpId
    if (!corpId) {
      showNotice('CORP User ID is required (capital letters and numbers only)', 'Warning')
      return
    }
    if (!String(formData.value.lastName || '').trim()) {
      showNotice('Last Name is required', 'Warning')
      return
    }
    if (formMode.value === 'add') {
      const carPlateNo = sanitizePlateNumber(formData.value.carPlateNo)
      await createUser({
        corpId,
        firstName: String(formData.value.firstName || '').trim(),
        lastName: String(formData.value.lastName || '').trim(),
        employeeNo: String(formData.value.employeeNo || '').trim(),
        rank: String(formData.value.rank || '').trim(),
        department: formData.value.department || undefined,
        role: formData.value.role || undefined,
        contact: formData.value.contact,
        email: formData.value.email,
        password: formData.value.password,
        carPlateNo: carPlateNo || undefined,
        annualQuotaEV: isEvQuotaUnlimited.value ? -1 : Number(formData.value.annualQuotaEV ?? 0),
        annualQuotaVenue: isVenueQuotaUnlimited.value ? -1 : Number(formData.value.annualQuotaVenue ?? 0),
        status: formData.value.status
      })
      showNotice(
        carPlateNo
          ? 'User added and license plate linked successfully'
          : 'User added successfully',
        'Success'
      )
    } else {
      const quotas = {
        annualQuotaEV: isEvQuotaUnlimited.value ? -1 : Number(formData.value.annualQuotaEV ?? 0),
        annualQuotaVenue: isVenueQuotaUnlimited.value ? -1 : Number(formData.value.annualQuotaVenue ?? 0)
      }
      const profilePayload = {
        corpId,
        firstName: String(formData.value.firstName || '').trim(),
        lastName: String(formData.value.lastName || '').trim(),
        employeeNo: String(formData.value.employeeNo || '').trim(),
        rank: String(formData.value.rank || '').trim(),
        department: formData.value.department || undefined,
        role: formData.value.role || undefined,
        contact: formData.value.contact,
        email: formData.value.email,
        status: formData.value.status
      }
      await updateUser(formData.value.id, profilePayload)
      // 优先写入当年额度；该年尚无预订时回退改默认年额度
      try {
        await upsertUserYearlyQuota(
          formData.value.id,
          { year: Number(currentQuotaYear.value), ...quotas },
          { silentError: true }
        )
      } catch {
        await updateUser(formData.value.id, quotas)
      }
      showNotice('User updated successfully', 'Success')
    }
    await Promise.all([loadUsers(), loadRoleAndDepartmentOptions()])
    showForm.value = false
  } catch (e) {
    console.error(e)
  }
}

const handleDelete = (row) => {
  currentRow.value = row
  showDeleteDialog.value = true
}

const confirmDelete = async () => {
  try {
    await deleteUser(currentRow.value.id)
    await loadUsers()
    showNotice('Deleted successfully', 'Success')
  } catch (e) {
    console.error(e)
  }
  showDeleteDialog.value = false
  currentRow.value = null
}

const handleResetQuota = (row) => {
  currentRow.value = row
  showResetDialog.value = true
}

const confirmReset = async () => {
  try {
    await resetUserQuotas(currentRow.value.id)
    await loadUsers()
    showNotice('Yearly quota overrides cleared', 'Success')
  } catch (e) {
    console.error(e)
  }
  showResetDialog.value = false
  currentRow.value = null
}

const handleResetPassword = (row) => {
  currentRow.value = row
  // 每次打开对话框都先填充默认密码，管理员可在弹窗里再改
  resetPasswordForm.value.password = DEFAULT_PASSWORD
  showResetPasswordDialog.value = true
}

const confirmResetPassword = async () => {
  try {
    await replaceUserPassword(currentRow.value.id, resetPasswordForm.value.password)
    await loadUsers()
    showNotice('Password reset successfully', 'Success')
  } catch (e) {
    console.error(e)
  }
  showResetPasswordDialog.value = false
  currentRow.value = null
}

const handleInactivate = async (row) => {
  try {
    await updateUserStatus(row.id, 'inactive')
    await loadUsers()
    showNotice('Account set to inactive', 'Success')
  } catch (e) {
    console.error(e)
  }
}

const handlePending = (row) => {
  currentRow.value = row
  isPendingEvQuotaUnlimited.value = false
  isPendingVenueQuotaUnlimited.value = false
  pendingHandleForm.value = {
    ...row,
    contact: row.contactNo ?? row.contact ?? '',
    password: DEFAULT_PASSWORD,
    annualQuotaEV: 0,
    annualQuotaVenue: 0
  }
  pendingDepartmentKeyword.value = ''
  showPendingHandleDialog.value = true
  if (pendingHandleForm.value.role) {
    applyPendingRoleQuotaDefaults(pendingHandleForm.value.role)
  }
}

const confirmPendingApprove = async () => {
  const data = { ...pendingHandleForm.value }
  const corpId = sanitizeCorpId(data.corpId)
  pendingHandleForm.value.corpId = corpId
  const role = String(data.role || '').trim()
  if (!corpId) {
    showNotice('CORP User ID is required (capital letters and numbers only)', 'Warning')
    return
  }
  if (!role) {
    showNotice('Please select a role before approving.', 'Warning')
    return
  }
  try {
    const carPlateNo = sanitizePlateNumber(data.carPlateNo)
    if (String(data.reason || '') === 'EV booking' && !carPlateNo) {
      showNotice('Car plate number is required for EV booking applications', 'Warning')
      return
    }
    await approvePendingUser(data.id, {
      corpId,
      firstName: String(data.firstName || '').trim(),
      lastName: String(data.lastName || '').trim(),
      employeeNo: String(data.employeeNo || '').trim(),
      rank: String(data.rank || '').trim(),
      department: data.department || undefined,
      email: String(data.email || '').trim(),
      role,
      contact: data.contact ?? '',
      password: data.password || DEFAULT_PASSWORD,
      annualQuotaEV: isPendingEvQuotaUnlimited.value ? -1 : Number(data.annualQuotaEV ?? 0),
      annualQuotaVenue: isPendingVenueQuotaUnlimited.value ? -1 : Number(data.annualQuotaVenue ?? 0),
      carPlateNo: carPlateNo || undefined
    })
    await loadUsers()
    await loadPendingUsers()
    adminStore.fetchPendingCounts()
    notifyPendingUsersUpdated()
    showNotice('Account created successfully', 'Success')
    showPendingHandleDialog.value = false
    currentRow.value = null
  } catch (e) {
    console.error(e)
  }
}

const openRejectDialogFromPendingDetails = () => {
  rejectFromPendingDetails.value = true
  rejectForm.value.selectedTemplateId = null
  rejectForm.value.reason = ''
  showRejectDialog.value = true
}

const closeRejectRegistrationDialog = () => {
  showRejectDialog.value = false
}

const handleActivate = async (row) => {
  try {
    await updateUserStatus(row.id, 'active')
    await loadUsers()
    showNotice('Account activated successfully', 'Success')
  } catch (e) {
    console.error(e)
  }
  currentRow.value = null
}

const handleApprove = (row) => {
  currentRow.value = row
  showApproveDialog.value = true
}

const confirmApprove = async () => {
  try {
    await approvePendingUser(currentRow.value.id, {
      password: DEFAULT_PASSWORD,
      annualQuotaEV: 30,
      annualQuotaVenue: 30
    })
    await loadUsers()
    await loadPendingUsers()
    adminStore.fetchPendingCounts()
    notifyPendingUsersUpdated()
    showNotice('Account created successfully', 'Success')
    showApproveDialog.value = false
    currentRow.value = null
  } catch (e) {
    console.error(e)
  }
}

const handleReject = (row) => {
  rejectFromPendingDetails.value = false
  currentRow.value = row
  const defaultTpl = rejectTemplateOptions.value.find((t) => t.key === 'user_application_reject_template')
  rejectForm.value.selectedTemplateId = defaultTpl?.id ?? null
  rejectForm.value.reason = ''
  handleRejectTemplateSelectChange(rejectForm.value.selectedTemplateId)
  showRejectDialog.value = true
}

const confirmReject = async () => {
  const row = rejectFromPendingDetails.value ? pendingHandleForm.value : currentRow.value
  if (!row?.id) {
    showNotice('No pending application selected', 'Warning')
    return
  }

  const reasonText = rejectForm.value.reason.trim()
  const rejectReason = reasonText || undefined
  const fromDetails = rejectFromPendingDetails.value

  try {
    await rejectPendingUser(row.id, rejectReason != null ? { rejectReason } : {})
    await loadPendingUsers()
    adminStore.fetchPendingCounts()
    notifyPendingUsersUpdated()
    showNotice('Registration rejected', 'Success')
  } catch (e) {
    console.error(e)
    return
  }
  showRejectDialog.value = false
  if (fromDetails) {
    showPendingHandleDialog.value = false
  }
  currentRow.value = null
}
</script>

<style scoped>
.page-container {
  height: 100%;
  min-height: 100%;
  min-width: 0;
  max-width: 100%;
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

.page-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0.25rem 0.6rem 0.6rem;
  display: flex;
  flex-direction: column;
}

.page-header {
  position: relative;
  overflow: hidden;
  background: #ffffff;
  color: #111827;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  padding: 0.75rem;
  margin: 0.45rem 0.6rem 0.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 3.625rem;
  box-sizing: border-box;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.toolbar-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #111827;
  white-space: nowrap;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
  min-width: 0;
}

.toolbar-search {
  width: min(460px, 48vw);
}

@media (max-width: 1180px) {
  .page-header {
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .toolbar-left {
    flex: 1 1 100%;
  }

  .toolbar-right {
    flex: 1 1 100%;
    margin-left: 0;
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .toolbar-search {
    width: 100%;
    min-width: 260px;
  }
}

@media (max-width: 768px) {
  .toolbar-right {
    gap: 0.375rem;
  }

  .toolbar-right :deep(.el-button) {
    flex: 1 1 auto;
    min-width: 140px;
  }

  .toolbar-search {
    min-width: 100%;
  }
}

.toolbar-right :deep(.el-button.cancel-btn) {
  background: #ffffff !important;
  color: #374151 !important;
  border: 1px solid #d1d5db !important;
  font-weight: 600;
  box-shadow: none;
}

.toolbar-right :deep(.el-button.cancel-btn:hover) {
  background: #f3f4f6 !important;
  border-color: #9ca3af !important;
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

.sub-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.sub-tabs :deep(.el-tabs__header) {
  margin-bottom: 0.35rem;
}

.sub-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
}

.sub-tabs :deep(.el-tab-pane) {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.sub-tabs :deep(.el-tabs__item) {
  font-size: 14px;
  font-weight: 500;
  padding: 0 20px;
  height: 40px;
  line-height: 40px;
}

.sub-tabs :deep(.el-tabs__item.is-active) {
  color: #00723a;
  font-weight: 600;
}

.sub-tabs :deep(.el-tabs__active-bar) {
  background-color: #00723a;
  height: 2px;
}

.page-content :deep(.el-table) {
  border-radius: 0;
  overflow: hidden;
  box-shadow: none;
  font-size: 0.8125rem;
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

.page-content :deep(.el-table td .cell) {
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

.page-content :deep(.el-table__row:hover) {
  background: #f9fafb;
}

.page-content :deep(.el-tag) {
  padding: 4px 12px;
  border-radius: 6px;
  font-weight: 500;
  border: none;
}

.table-view {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.table-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  padding: 0.3rem;
  height: 100%;
  flex: 1;
  min-height: 0;
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

.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 76px;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.status-pill.status-active {
  background: #dcfce7;
  color: #166534;
}

.status-pill.status-inactive {
  background: #fee2e2;
  color: #991b1b;
}

.status-pill.status-expired {
  background: #fef3c7;
  color: #92400e;
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

.action-btn :deep(span) {
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

.action-approve {
  background-color: #00723a !important;
}

.action-approve:hover {
  background-color: #005a2e !important;
}

.action-edit {
  background-color: #f97316 !important;
}

.action-edit:hover {
  background-color: #ea580c !important;
}

.action-reset {
  background-color: #3b82f6 !important;
}

.action-reset:hover {
  background-color: #2563eb !important;
}

.action-reset-password {
  background-color: #8b5cf6 !important;
}

.action-reset-password:hover {
  background-color: #7c3aed !important;
}

.action-activate {
  background-color: #22c55e !important;
}

.action-activate:hover {
  background-color: #16a34a !important;
}

.action-inactivate {
  background-color: #f59e0b !important;
}

.action-inactivate:hover {
  background-color: #d97706 !important;
}

.action-delete {
  background-color: #ef4444 !important;
}

.action-delete:hover {
  background-color: #dc2626 !important;
}

.badge-item {
  margin-left: 8px;
}

.badge-item :deep(.el-badge__content) {
  background-color: #f56c6c;
  border: 2px solid #ffffff;
  font-weight: 600;
}

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.75rem;
  padding: 0.7rem 0.5rem 0rem;
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

.pagination-container {
  display: flex;
  justify-content: flex-end;
}

.notice-message {
  margin: 0;
  font-size: 15px;
  color: #374151;
  line-height: 1.6;
}

.quota-input-row {
  display: inline-flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 0.65rem;
  max-width: 100%;
}

.quota-year-hint {
  flex-shrink: 0;
  font-size: 14px;
  color: #6b7280;
  line-height: 1.2;
  white-space: nowrap;
}

.quota-cell-btn {
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  color: #00723a;
  font: inherit;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.quota-cell-btn:hover {
  color: #005c2e;
}

.quota-hint {
  margin: 0.35rem 0 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
  white-space: normal;
}

.yearly-quota-modal {
  font-size: 15px;
  color: #374151;
  line-height: 1.55;
}

.yearly-quota-intro {
  margin: 0 0 1rem;
  font-size: 14px;
  color: #4b5563;
  line-height: 1.55;
}

.yearly-quota-section {
  margin-bottom: 1.25rem;
}

.yearly-quota-section:last-child {
  margin-bottom: 0;
}

.yearly-quota-section-title {
  margin: 0 0 0.65rem;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.yearly-quota-tip {
  margin: -0.25rem 0 0.65rem;
  font-size: 13px;
  color: #6b7280;
}

.yearly-year-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 1rem;
}

.yearly-year-chip {
  min-width: 72px;
  height: 40px;
  padding: 0 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  color: #374151;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.yearly-year-chip:hover {
  border-color: #00723a;
  color: #00723a;
}

.yearly-year-chip.is-active {
  border-color: #00723a;
  background: #00723a;
  color: #fff;
}

.yearly-quota-table {
  font-size: 15px;
  cursor: pointer;
}

.yearly-quota-table :deep(.el-table__body tr:hover > td) {
  background: #f0faf4 !important;
}

.yearly-quota-table :deep(.el-table__body tr.is-selected-year > td),
.yearly-quota-table :deep(.el-table__body tr.current-row > td) {
  background: #e6f4ec !important;
}

.yearly-quota-table :deep(.el-table__body tr.is-selected-year > td:first-child) {
  box-shadow: inset 3px 0 0 #00723a;
}

.yearly-quota-table :deep(.el-table__header th) {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  background: #f8faf8;
}

.yearly-quota-table :deep(.el-table__cell) {
  font-size: 15px;
  padding: 12px 0;
}

.yearly-quota-value {
  font-size: 15px;
  font-weight: 500;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}

.override-tag {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  color: #92400e;
  background: #fef3c7;
  vertical-align: middle;
}

.yearly-quota-edit-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.yearly-quota-edit-form :deep(.el-form-item__label) {
  font-size: 15px;
  font-weight: 500;
  color: #374151;
  line-height: 40px;
}

.yearly-quota-edit-form :deep(.el-input-number) {
  width: 160px;
}

.yearly-quota-checkbox {
  font-size: 15px;
}

.yearly-quota-checkbox :deep(.el-checkbox__label) {
  font-size: 15px;
  color: #374151;
}

.yearly-quota-defaults {
  margin: 0.25rem 0 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f3f4f6;
  font-size: 14px;
  color: #4b5563;
  line-height: 1.5;
}

.yearly-quota-defaults strong {
  color: #111827;
  font-weight: 600;
}

.yearly-quota-defaults-note {
  display: inline;
  color: #6b7280;
  font-weight: 400;
}

.submitted-at-text {
  white-space: nowrap;
}

.rejected-at-text {
  white-space: nowrap;
}

:deep(.submitted-at-col .cell) {
  white-space: nowrap;
}

:deep(.rejected-at-col .cell) {
  white-space: nowrap;
}

:deep(.name-col .cell) {
  white-space: nowrap;
}

:deep(.table-nowrap-col .cell) {
  white-space: nowrap;
}

.reject-registration-form :deep(.el-form-item__label) {
  white-space: nowrap;
  padding-right: 8px;
}
</style>

<!--
  popper-class 在 EP2 加在 .el-select-dropdown 上，不是外层 popper；
  z-index 用 popper-style 设在外层 tooltip/popper 上才可靠。
  max-height 只改内部 .el-select-dropdown__wrap / .el-scrollbar__wrap，勿压在错误节点；
  当前上限 min(42vh, 300px)，可按需再调。
-->
<style>
.pending-approval-select-popper.el-select-dropdown .el-select-dropdown__wrap {
  max-height: min(42vh, 300px) !important;
}

.pending-approval-select-popper.el-select-dropdown .el-scrollbar__wrap {
  max-height: min(42vh, 300px) !important;
}

.pending-approval-select-popper.el-select-dropdown .el-select-dropdown__list {
  padding-bottom: 8px;
}

/* Reject Registration：模板下拉（teleported 到 body 时需非 scoped） */
.reject-template-select-popper.el-select-dropdown .el-select-dropdown__wrap {
  max-height: min(42vh, 300px) !important;
}

.reject-template-select-popper.el-select-dropdown .el-scrollbar__wrap {
  max-height: min(42vh, 300px) !important;
}

.reject-template-select-popper.el-select-dropdown .el-select-dropdown__list {
  padding-bottom: 8px;
}
</style>
