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
        <el-button type="default" class="cancel-btn" @click="handleExport">
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
                <el-table :data="paginatedUserData" height="100%" border stripe table-layout="auto" style="width: 100%">
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
                  <el-table-column width="160" class-name="table-nowrap-col quota-col" label-class-name="table-nowrap-col quota-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleSort('user', 'evQuota')">
                        EV Quota
                        <span class="sort-indicator">{{ getSortIndicator('user', 'evQuota') }}</span>
                      </button>
                    </template>
                    <template #default="{ row }">
                      {{ formatQuotaDisplay(row.usedQuotaEV, row.annualQuotaEV) }}
                    </template>
                  </el-table-column>
                  <el-table-column width="170" class-name="table-nowrap-col quota-col" label-class-name="table-nowrap-col quota-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleSort('user', 'venueQuota')">
                        Venue Quota
                        <span class="sort-indicator">{{ getSortIndicator('user', 'venueQuota') }}</span>
                      </button>
                    </template>
                    <template #default="{ row }">
                      {{ formatQuotaDisplay(row.usedQuotaVenue, row.annualQuotaVenue) }}
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
                        <el-tooltip content="Reset annual quota" placement="top">
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
                Showing {{ employeeStartIndex + 1 }}-{{ employeeEndIndex }} of {{ sortedUserList.length }} records
              </div>
              <div class="pagination-controls">
                <button
                  class="pagination-btn"
                  :disabled="employeeCurrentPage === 1"
                  @click="employeeCurrentPage--"
                >
                  Previous
                </button>
                <button
                  v-for="page in employeeVisiblePages"
                  :key="page"
                  :class="['pagination-btn', 'page-number', { active: page === employeeCurrentPage }]"
                  @click="employeeCurrentPage = page"
                >
                  {{ page }}
                </button>
                <button
                  class="pagination-btn"
                  :disabled="employeeCurrentPage === employeeTotalPages"
                  @click="employeeCurrentPage++"
                >
                  Next
                </button>
              </div>
              <div class="pagination-size">
                <select v-model.number="employeePageSize" class="page-size-select" @change="employeeCurrentPage = 1">
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
                <el-table :data="paginatedExpiredData" height="100%" border stripe table-layout="auto" style="width: 100%">
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
                  <el-table-column width="160" class-name="table-nowrap-col quota-col" label-class-name="table-nowrap-col quota-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleSort('expired', 'evQuota')">
                        EV Quota
                        <span class="sort-indicator">{{ getSortIndicator('expired', 'evQuota') }}</span>
                      </button>
                    </template>
                    <template #default="{ row }">
                      {{ formatQuotaDisplay(row.usedQuotaEV, row.annualQuotaEV) }}
                    </template>
                  </el-table-column>
                  <el-table-column width="170" class-name="table-nowrap-col quota-col" label-class-name="table-nowrap-col quota-col">
                    <template #header>
                      <button type="button" class="th-sort-btn" @click="toggleSort('expired', 'venueQuota')">
                        Venue Quota
                        <span class="sort-indicator">{{ getSortIndicator('expired', 'venueQuota') }}</span>
                      </button>
                    </template>
                    <template #default="{ row }">
                      {{ formatQuotaDisplay(row.usedQuotaVenue, row.annualQuotaVenue) }}
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
                Showing {{ expiredStartIndex + 1 }}-{{ expiredEndIndex }} of {{ sortedExpiredList.length }} records
              </div>
              <div class="pagination-controls">
                <button
                  class="pagination-btn"
                  :disabled="expiredCurrentPage === 1"
                  @click="expiredCurrentPage--"
                >
                  Previous
                </button>
                <button
                  v-for="page in expiredVisiblePages"
                  :key="page"
                  :class="['pagination-btn', 'page-number', { active: page === expiredCurrentPage }]"
                  @click="expiredCurrentPage = page"
                >
                  {{ page }}
                </button>
                <button
                  class="pagination-btn"
                  :disabled="expiredCurrentPage === expiredTotalPages"
                  @click="expiredCurrentPage++"
                >
                  Next
                </button>
              </div>
              <div class="pagination-size">
                <select v-model.number="expiredPageSize" class="page-size-select" @change="expiredCurrentPage = 1">
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
                    <el-table :data="paginatedPendingPendingData" height="100%" border stripe table-layout="auto" style="width: 100%">
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
                    Showing {{ pendingPendingStartIndex + 1 }}-{{ pendingPendingEndIndex }} of {{ sortedPendingPendingList.length }} records
                  </div>
                  <div class="pagination-controls">
                    <button class="pagination-btn" :disabled="pendingPendingCurrentPage === 1" @click="pendingPendingCurrentPage--">Previous</button>
                    <button
                      v-for="page in pendingPendingVisiblePages"
                      :key="page"
                      :class="['pagination-btn', 'page-number', { active: page === pendingPendingCurrentPage }]"
                      @click="pendingPendingCurrentPage = page"
                    >
                      {{ page }}
                    </button>
                    <button class="pagination-btn" :disabled="pendingPendingCurrentPage === pendingPendingTotalPages" @click="pendingPendingCurrentPage++">Next</button>
                  </div>
                  <div class="pagination-size">
                    <select v-model.number="pendingPendingPageSize" class="page-size-select" @change="pendingPendingCurrentPage = 1">
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
                    <el-table :data="paginatedPendingApprovedData" height="100%" border stripe table-layout="auto" style="width: 100%">
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
                    Showing {{ pendingApprovedStartIndex + 1 }}-{{ pendingApprovedEndIndex }} of {{ sortedPendingApprovedList.length }} records
                  </div>
                  <div class="pagination-controls">
                    <button class="pagination-btn" :disabled="pendingApprovedCurrentPage === 1" @click="pendingApprovedCurrentPage--">Previous</button>
                    <button
                      v-for="page in pendingApprovedVisiblePages"
                      :key="page"
                      :class="['pagination-btn', 'page-number', { active: page === pendingApprovedCurrentPage }]"
                      @click="pendingApprovedCurrentPage = page"
                    >
                      {{ page }}
                    </button>
                    <button class="pagination-btn" :disabled="pendingApprovedCurrentPage === pendingApprovedTotalPages" @click="pendingApprovedCurrentPage++">Next</button>
                  </div>
                  <div class="pagination-size">
                    <select v-model.number="pendingApprovedPageSize" class="page-size-select" @change="pendingApprovedCurrentPage = 1">
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
                    <el-table :data="paginatedPendingRejectedData" height="100%" border stripe table-layout="auto" style="width: 100%">
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
                    Showing {{ pendingRejectedStartIndex + 1 }}-{{ pendingRejectedEndIndex }} of {{ sortedPendingRejectedList.length }} records
                  </div>
                  <div class="pagination-controls">
                    <button class="pagination-btn" :disabled="pendingRejectedCurrentPage === 1" @click="pendingRejectedCurrentPage--">Previous</button>
                    <button
                      v-for="page in pendingRejectedVisiblePages"
                      :key="page"
                      :class="['pagination-btn', 'page-number', { active: page === pendingRejectedCurrentPage }]"
                      @click="pendingRejectedCurrentPage = page"
                    >
                      {{ page }}
                    </button>
                    <button class="pagination-btn" :disabled="pendingRejectedCurrentPage === pendingRejectedTotalPages" @click="pendingRejectedCurrentPage++">Next</button>
                  </div>
                  <div class="pagination-size">
                    <select v-model.number="pendingRejectedPageSize" class="page-size-select" @change="pendingRejectedCurrentPage = 1">
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
          <el-input v-model="formData.corpId" />
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
            :teleported="false"
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
        <el-form-item label="EV Quota">
          <div class="quota-input-row">
            <el-input-number v-model="formData.annualQuotaEV" :min="0" :disabled="isEvQuotaUnlimited" />
            <el-checkbox v-model="isEvQuotaUnlimited">Unlimited</el-checkbox>
          </div>
        </el-form-item>
        <el-form-item label="Venue Quota">
          <div class="quota-input-row">
            <el-input-number v-model="formData.annualQuotaVenue" :min="0" :disabled="isVenueQuotaUnlimited" />
            <el-checkbox v-model="isVenueQuotaUnlimited">Unlimited</el-checkbox>
          </div>
        </el-form-item>
        <el-form-item label="Status">
          <el-select
            v-model="formData.status"
            style="width: 100%"
            :teleported="false"
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
    <BookingStyleModal v-model="showResetDialog" title="Confirm Reset Quota" max-width="450px">
      <p style="font-size: 15px; color: #374151; line-height: 1.6;">
        Reset annual quota for this user?
      </p>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="showResetDialog = false">Cancel</el-button>
        <el-button type="default" class="action-btn action-reset" @click="confirmReset">Reset</el-button>
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
          <el-input v-model="pendingHandleForm.corpId" />
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
          <el-input v-model="pendingHandleForm.email" disabled />
        </el-form-item>
        <el-form-item label="Contact No.">
          <el-input v-model="pendingHandleForm.contact" />
        </el-form-item>
        <el-form-item label="Reason">
          <el-input v-model="pendingHandleForm.reason" disabled />
        </el-form-item>
        <el-form-item v-if="pendingHandleForm.reason === 'EV booking'" label="Car Plate No.">
          <el-input v-model="pendingHandleForm.carPlateNo" disabled />
        </el-form-item>
        <el-form-item label="Role">
          <el-select
            v-model="pendingHandleForm.role"
            placeholder="Select role"
            style="width: 100%"
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
  updateUserStatus,
  listPendingUsers,
  approvePendingUser,
  rejectPendingUser
} from '@/api/userManagement'
import { getPrompts } from '@/api/promptManagement'
import { notifyPendingUsersUpdated } from '@/utils/pendingUsersSync'

const adminStore = useAdminStore()
const { pendingUsersCount } = storeToRefs(adminStore)

/** 后端字段为 annualQuotaEv；表格与表单沿用 annualQuotaEV */
function normalizeUserRow (u) {
  return {
    ...u,
    annualQuotaEV: u.annualQuotaEv ?? u.annualQuotaEV ?? 0,
    usedQuotaEV: u.usedQuotaEv ?? u.usedQuotaEV ?? 0,
    annualQuotaVenue: u.annualQuotaVenue ?? u.annualQuotaVenue ?? 0,
    usedQuotaVenue: u.usedQuotaVenue ?? u.usedQuotaVenue ?? 0
  }
}

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

async function loadUsers () {
  const data = await listUsers()
  const rows = Array.isArray(data) ? data : []
  employeeList.value = rows.map(normalizeUserRow)
}

async function loadPendingUsers () {
  const [pendingData, approvedData, rejectedData] = await Promise.all([
    listPendingUsers('pending'),
    listPendingUsers('approved'),
    listPendingUsers('rejected')
  ])
  pendingList.value = Array.isArray(pendingData) ? pendingData : []
  pendingApprovedList.value = (Array.isArray(approvedData) ? approvedData : []).map(normalizePendingApprovedRow)
  pendingRejectedList.value = (Array.isArray(rejectedData) ? rejectedData : []).map(normalizePendingRejectedRow)
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
  departmentOptions.value = depts.map((d) => d.departmentName)
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

const onAddUserCarPlateInput = (val) => {
  formData.value.carPlateNo = sanitizePlateNumber(val)
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

const expiredList = computed(() =>
  employeeList.value.filter((item) => item.status === 'expired' || item.status === 'inactive')
)

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

const filteredUserList = computed(() => {
  const keyword = employeeSearch.value.trim().toLowerCase()
  const base = employeeList.value.filter((item) => item.status === 'active')
  if (!keyword) return base
  return base.filter(item =>
    String(item.corpId).toLowerCase().includes(keyword) ||
    matchesUserNameSearch(item, keyword) ||
    String(item.department).toLowerCase().includes(keyword) ||
    String(item.contact || '').toLowerCase().includes(keyword) ||
    String(item.email).toLowerCase().includes(keyword) ||
    String(item.role).toLowerCase().includes(keyword)
  )
})

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

const parseDateTimeForSort = (value) => {
  if (!value) return 0
  const parsed = new Date(String(value).replace(',', ''))
  const ts = parsed.getTime()
  return Number.isNaN(ts) ? 0 : ts
}

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

const getSortValue = (row, key) => {
  switch (key) {
    case 'corpId':
    case 'department':
    case 'role':
    case 'status':
    case 'approvedBy':
    case 'rejectedBy':
    case 'rejectReason':
      return row[key] || ''
    case 'evQuota':
      return Number(row.usedQuotaEV || 0) * 10000 + Number(row.annualQuotaEV || 0)
    case 'venueQuota':
      return Number(row.usedQuotaVenue || 0) * 10000 + Number(row.annualQuotaVenue || 0)
    case 'lastLoginTime':
      return parseDateTimeForSort(row.lastLoginTime)
    case 'inactiveTime':
      return parseDateTimeForSort(row.inactiveTime)
    case 'inactivedBy':
      return formatInactivedBy(row)
    case 'submittedAt':
    case 'approvedAt':
      return parseDateTimeForSort(row.approvedAt ?? row.handledAt ?? row.handled_at)
    case 'rejectedAt':
      return parseDateTimeForSort(row.rejectedAt ?? row.handledAt ?? row.handled_at)
    default:
      return ''
  }
}

const sortList = (rows, tableKey) => {
  const state = sortStates.value[tableKey] || []
  if (!state.length) return rows.slice()
  return rows.slice().sort((a, b) => {
    for (const criterion of state) {
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

const getUniqueOptions = (rows, key) => {
  return [...new Set((rows || []).map(row => row?.[key]).filter(v => v !== null && v !== undefined && `${v}` !== ''))]
}

const getFilterOptions = (tableKey, key) => {
  if (tableKey === 'user') return getUniqueOptions(filteredUserList.value, key)
  if (tableKey === 'expired') return getUniqueOptions(filteredExpiredList.value, key)
  if (tableKey === 'pendingPending') return getUniqueOptions(pendingPendingList.value, key)
  if (tableKey === 'pendingApproved') return getUniqueOptions(pendingApprovedList.value, key)
  if (tableKey === 'pendingRejected') return getUniqueOptions(pendingRejectedList.value, key)
  return []
}

const updateFilter = (tableKey, key, value) => {
  columnFilterState.value[tableKey][key] = value ?? []
  if (tableKey === 'user') employeeCurrentPage.value = 1
  if (tableKey === 'expired') expiredCurrentPage.value = 1
  if (tableKey === 'pendingPending') pendingPendingCurrentPage.value = 1
  if (tableKey === 'pendingApproved') pendingApprovedCurrentPage.value = 1
  if (tableKey === 'pendingRejected') pendingRejectedCurrentPage.value = 1
}

const selectAllFilterOptions = (tableKey, key, options) => {
  updateFilter(tableKey, key, [...options])
}

const clearFilterOptions = (tableKey, key) => {
  updateFilter(tableKey, key, [])
}

const applyTableFilters = (rows, tableKey) => {
  const state = columnFilterState.value[tableKey]
  return rows.filter((row) => {
    const depSelected = state.department || []
    const roleSelected = state.role || []
    const depMatch = !depSelected.length || depSelected.map(v => String(v)).includes(String(row.department || ''))
    const roleMatch = !roleSelected.length || roleSelected.map(v => String(v)).includes(String(row.role || ''))
    return depMatch && roleMatch
  })
}

const toggleSort = (tableKey, key) => {
  const state = sortStates.value[tableKey]
  const idx = state.findIndex(item => item.key === key)
  if (idx === -1) {
    state.push({ key, order: 'asc' })
  } else if (state[idx].order === 'asc') {
    state[idx].order = 'desc'
  } else {
    state.splice(idx, 1)
  }
  if (tableKey === 'user') employeeCurrentPage.value = 1
  if (tableKey === 'expired') expiredCurrentPage.value = 1
  if (tableKey === 'pendingPending') pendingPendingCurrentPage.value = 1
  if (tableKey === 'pendingApproved') pendingApprovedCurrentPage.value = 1
  if (tableKey === 'pendingRejected') pendingRejectedCurrentPage.value = 1
}

const setSortByMenu = (tableKey, key, order) => {
  const state = sortStates.value[tableKey]
  const idx = state.findIndex(item => item.key === key)
  if (idx === -1) {
    state.push({ key, order })
  } else {
    state[idx].order = order
  }
  if (tableKey === 'user') employeeCurrentPage.value = 1
  if (tableKey === 'expired') expiredCurrentPage.value = 1
  if (tableKey === 'pendingPending') pendingPendingCurrentPage.value = 1
  if (tableKey === 'pendingApproved') pendingApprovedCurrentPage.value = 1
  if (tableKey === 'pendingRejected') pendingRejectedCurrentPage.value = 1
}

const clearSortByMenu = (tableKey, key) => {
  const state = sortStates.value[tableKey]
  const idx = state.findIndex(item => item.key === key)
  if (idx !== -1) state.splice(idx, 1)
  if (tableKey === 'user') employeeCurrentPage.value = 1
  if (tableKey === 'expired') expiredCurrentPage.value = 1
  if (tableKey === 'pendingPending') pendingPendingCurrentPage.value = 1
  if (tableKey === 'pendingApproved') pendingApprovedCurrentPage.value = 1
  if (tableKey === 'pendingRejected') pendingRejectedCurrentPage.value = 1
}

const getSortIndicator = (tableKey, key) => {
  const state = sortStates.value[tableKey] || []
  const idx = state.findIndex(item => item.key === key)
  if (idx === -1) return '↕'
  const arrow = state[idx].order === 'asc' ? '▲' : '▼'
  return `${arrow}${idx + 1}`
}

const filteredExpiredList = computed(() => {
  const keyword = expiredSearch.value.trim().toLowerCase()
  const base = employeeList.value.filter((item) => item.status === 'expired' || item.status === 'inactive')
  if (!keyword) return base
  return base.filter(item =>
    String(item.corpId).toLowerCase().includes(keyword) ||
    matchesUserNameSearch(item, keyword) ||
    String(item.department).toLowerCase().includes(keyword) ||
    String(item.contact || '').toLowerCase().includes(keyword) ||
    String(item.email).toLowerCase().includes(keyword) ||
    String(item.role).toLowerCase().includes(keyword)
  )
})

const pendingPendingList = computed(() => pendingList.value)
const sortedPendingPendingList = computed(() => sortList(applyTableFilters(pendingPendingList.value, 'pendingPending'), 'pendingPending'))
const sortedPendingApprovedList = computed(() => sortList(applyTableFilters(pendingApprovedList.value, 'pendingApproved'), 'pendingApproved'))
const sortedPendingRejectedList = computed(() => sortList(applyTableFilters(pendingRejectedList.value, 'pendingRejected'), 'pendingRejected'))
const sortedUserList = computed(() => sortList(applyTableFilters(filteredUserList.value, 'user'), 'user'))
const sortedExpiredList = computed(() => sortList(applyTableFilters(filteredExpiredList.value, 'expired'), 'expired'))

const paginatedPendingPendingData = computed(() => {
  const start = (pendingPendingCurrentPage.value - 1) * pendingPendingPageSize.value
  const end = start + pendingPendingPageSize.value
  return sortedPendingPendingList.value.slice(start, end)
})

const pendingPendingTotalPages = computed(() => Math.max(1, Math.ceil(sortedPendingPendingList.value.length / pendingPendingPageSize.value)))
const pendingPendingStartIndex = computed(() => (pendingPendingCurrentPage.value - 1) * pendingPendingPageSize.value)
const pendingPendingEndIndex = computed(() => Math.min(pendingPendingStartIndex.value + pendingPendingPageSize.value, sortedPendingPendingList.value.length))
const pendingPendingVisiblePages = computed(() => {
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, pendingPendingCurrentPage.value - Math.floor(maxVisible / 2))
  let end = Math.min(pendingPendingTotalPages.value, start + maxVisible - 1)
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

const paginatedPendingApprovedData = computed(() => {
  const start = (pendingApprovedCurrentPage.value - 1) * pendingApprovedPageSize.value
  const end = start + pendingApprovedPageSize.value
  return sortedPendingApprovedList.value.slice(start, end)
})

const pendingApprovedTotalPages = computed(() => Math.max(1, Math.ceil(sortedPendingApprovedList.value.length / pendingApprovedPageSize.value)))
const pendingApprovedStartIndex = computed(() => (pendingApprovedCurrentPage.value - 1) * pendingApprovedPageSize.value)
const pendingApprovedEndIndex = computed(() => Math.min(pendingApprovedStartIndex.value + pendingApprovedPageSize.value, sortedPendingApprovedList.value.length))
const pendingApprovedVisiblePages = computed(() => {
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, pendingApprovedCurrentPage.value - Math.floor(maxVisible / 2))
  let end = Math.min(pendingApprovedTotalPages.value, start + maxVisible - 1)
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

const paginatedPendingRejectedData = computed(() => {
  const start = (pendingRejectedCurrentPage.value - 1) * pendingRejectedPageSize.value
  const end = start + pendingRejectedPageSize.value
  return sortedPendingRejectedList.value.slice(start, end)
})

const pendingRejectedTotalPages = computed(() => Math.max(1, Math.ceil(sortedPendingRejectedList.value.length / pendingRejectedPageSize.value)))
const pendingRejectedStartIndex = computed(() => (pendingRejectedCurrentPage.value - 1) * pendingRejectedPageSize.value)
const pendingRejectedEndIndex = computed(() => Math.min(pendingRejectedStartIndex.value + pendingRejectedPageSize.value, sortedPendingRejectedList.value.length))
const pendingRejectedVisiblePages = computed(() => {
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, pendingRejectedCurrentPage.value - Math.floor(maxVisible / 2))
  let end = Math.min(pendingRejectedTotalPages.value, start + maxVisible - 1)
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

const filteredPendingList = computed(() => {
  const keyword = pendingSearch.value.trim().toLowerCase()
  if (!keyword) return pendingList.value
  return pendingList.value.filter(item =>
    String(item.corpId).toLowerCase().includes(keyword) ||
    matchesUserNameSearch(item, keyword) ||
    String(item.department).toLowerCase().includes(keyword) ||
    String(item.contactNo ?? item.contact ?? '').toLowerCase().includes(keyword) ||
    String(item.email).toLowerCase().includes(keyword)
  )
})

const currentSearch = computed({
  get: () => {
    if (activeTab.value === 'list') return employeeSearch.value
    if (activeTab.value === 'expired') return expiredSearch.value
    return pendingSearch.value
  },
  set: (value) => {
    if (activeTab.value === 'list') {
      employeeSearch.value = value
      employeeCurrentPage.value = 1
    } else if (activeTab.value === 'expired') {
      expiredSearch.value = value
      expiredCurrentPage.value = 1
    } else {
      pendingSearch.value = value
      pendingPendingCurrentPage.value = 1
    }
  }
})

const paginatedUserData = computed(() => {
  const start = (employeeCurrentPage.value - 1) * employeePageSize.value
  const end = start + employeePageSize.value
  return sortedUserList.value.slice(start, end)
})

const employeeTotalPages = computed(() => Math.max(1, Math.ceil(sortedUserList.value.length / employeePageSize.value)))
const employeeStartIndex = computed(() => (employeeCurrentPage.value - 1) * employeePageSize.value)
const employeeEndIndex = computed(() => Math.min(employeeStartIndex.value + employeePageSize.value, sortedUserList.value.length))
const employeeVisiblePages = computed(() => {
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, employeeCurrentPage.value - Math.floor(maxVisible / 2))
  let end = Math.min(employeeTotalPages.value, start + maxVisible - 1)
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1)
  }
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

const paginatedPendingData = computed(() => {
  const start = (pendingPendingCurrentPage.value - 1) * pendingPendingPageSize.value
  const end = start + pendingPendingPageSize.value
  return filteredPendingList.value.slice(start, end)
})

const pendingTotalPages = computed(() => Math.max(1, Math.ceil(filteredPendingList.value.length / pendingPendingPageSize.value)))
const pendingStartIndex = computed(() => (pendingPendingCurrentPage.value - 1) * pendingPendingPageSize.value)
const pendingEndIndex = computed(() => Math.min(pendingStartIndex.value + pendingPendingPageSize.value, filteredPendingList.value.length))
const pendingVisiblePages = computed(() => {
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, pendingPendingCurrentPage.value - Math.floor(maxVisible / 2))
  let end = Math.min(pendingTotalPages.value, start + maxVisible - 1)
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1)
  }
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

const paginatedExpiredData = computed(() => {
  const start = (expiredCurrentPage.value - 1) * expiredPageSize.value
  const end = start + expiredPageSize.value
  return sortedExpiredList.value.slice(start, end)
})

const expiredTotalPages = computed(() => Math.max(1, Math.ceil(sortedExpiredList.value.length / expiredPageSize.value)))
const expiredStartIndex = computed(() => (expiredCurrentPage.value - 1) * expiredPageSize.value)
const expiredEndIndex = computed(() => Math.min(expiredStartIndex.value + expiredPageSize.value, sortedExpiredList.value.length))
const expiredVisiblePages = computed(() => {
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, expiredCurrentPage.value - Math.floor(maxVisible / 2))
  let end = Math.min(expiredTotalPages.value, start + maxVisible - 1)
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1)
  }
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

watch([employeeTotalPages, pendingTotalPages, expiredTotalPages], () => {
  if (employeeCurrentPage.value > employeeTotalPages.value) {
    employeeCurrentPage.value = employeeTotalPages.value
  }
  if (pendingPendingCurrentPage.value > pendingTotalPages.value) {
    pendingPendingCurrentPage.value = pendingTotalPages.value
  }
  if (expiredCurrentPage.value > expiredTotalPages.value) {
    expiredCurrentPage.value = expiredTotalPages.value
  }
})

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

const handleExport = () => {
  const exportData = employeeList.value.map(item => ({
    'CORP User ID': item.corpId,
    'Employee No.': item.employeeNo || '',
    'First Name': item.firstName || '',
    'Last Name': item.lastName || '',
    'Department / Unit': item.department,
    'Rank': item.rank || '',
    'Email': item.email,
    'Contact No.': item.contact || '',
    'Role': item.role,
    'EV Quota': item.annualQuotaEV,
    'Used Quota (EV)': item.usedQuotaEV,
    'Venue Quota': item.annualQuotaVenue,
    'Used Quota (Venue)': item.usedQuotaVenue,
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
  formData.value = { ...row, password: '' }
  isEvQuotaUnlimited.value = Number(row.annualQuotaEV) === -1
  isVenueQuotaUnlimited.value = Number(row.annualQuotaVenue) === -1
  showForm.value = true
}

const handleSave = async () => {
  try {
    if (!String(formData.value.lastName || '').trim()) {
      showNotice('Last Name is required', 'Warning')
      return
    }
    if (formMode.value === 'add') {
      const carPlateNo = sanitizePlateNumber(formData.value.carPlateNo)
      await createUser({
        corpId: formData.value.corpId.trim(),
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
      await updateUser(formData.value.id, {
        corpId: formData.value.corpId,
        firstName: String(formData.value.firstName || '').trim(),
        lastName: String(formData.value.lastName || '').trim(),
        employeeNo: String(formData.value.employeeNo || '').trim(),
        rank: String(formData.value.rank || '').trim(),
        department: formData.value.department || undefined,
        role: formData.value.role || undefined,
        contact: formData.value.contact,
        email: formData.value.email,
        annualQuotaEV: isEvQuotaUnlimited.value ? -1 : Number(formData.value.annualQuotaEV ?? 0),
        annualQuotaVenue: isVenueQuotaUnlimited.value ? -1 : Number(formData.value.annualQuotaVenue ?? 0),
        usedQuotaEV: formData.value.usedQuotaEV,
        usedQuotaVenue: formData.value.usedQuotaVenue,
        status: formData.value.status
      })
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
    showNotice('Quota reset successfully', 'Success')
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
  const role = String(data.role || '').trim()
  if (!role) {
    showNotice('Please select a role before approving.', 'Warning')
    return
  }
  try {
    await approvePendingUser(data.id, {
      corpId: String(data.corpId || '').trim(),
      firstName: String(data.firstName || '').trim(),
      lastName: String(data.lastName || '').trim(),
      employeeNo: String(data.employeeNo || '').trim(),
      rank: String(data.rank || '').trim(),
      department: data.department || undefined,
      role,
      contact: data.contact ?? '',
      password: data.password || DEFAULT_PASSWORD,
      annualQuotaEV: isPendingEvQuotaUnlimited.value ? -1 : Number(data.annualQuotaEV ?? 0),
      annualQuotaVenue: isPendingVenueQuotaUnlimited.value ? -1 : Number(data.annualQuotaVenue ?? 0)
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
  gap: 0.65rem;
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
