<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">Access Right Management</h2>
      <div class="header-actions">
        <el-button type="default" class="cancel-btn" @click="handleExport">
          <font-awesome-icon :icon="['fas', 'file-excel']" /> Export Excel
        </el-button>
        <el-button type="default" class="submit-btn" @click="handleAdd">
          <font-awesome-icon :icon="['fas', 'plus']" /> {{ activeTab === 'role' ? 'Add Role' : 'Add Department / Unit' }}
        </el-button>
      </div>
    </div>

    <div class="page-content">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="Role" name="role">
          <div class="table-card">
      <el-table :data="paginatedData" height="100%" border stripe table-layout="auto" style="width: 100%">
        <el-table-column
          type="index"
          label="#"
          width="70"
          align="center"
          header-align="center"
          fixed="left"
          :index="getRoleRowIndex"
        />
        <el-table-column prop="roleName" min-width="190">
          <template #header>
            <SortableFilterHeader
              label="Role Name"
              :sort-indicator="getSortIndicator('role', 'roleName')"
              :filter-active="filterStates.role.roleName.length > 0"
              :options="roleNameOptions"
              :model-value="filterStates.role.roleName"
              @sort-asc="setSort('role', 'roleName', 'asc')"
              @sort-desc="setSort('role', 'roleName', 'desc')"
              @clear-sort="clearSort('role', 'roleName')"
              @update:model-value="(v) => updateFilter('role', 'roleName', v)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="description" min-width="260">
          <template #header>
            <span>Description</span>
          </template>
        </el-table-column>
        <el-table-column min-width="150">
          <template #header>
            <div class="th-header-tools">
              <button
                type="button"
                class="th-sort-btn"
                @click="toggleSort('role', 'AnnualVenueQuota')"
              >
                Annual Venue Quota
                <span class="sort-indicator">{{ getSortIndicator('role', 'AnnualVenueQuota') }}</span>
              </button>
            </div>
          </template>
          <template #default="{ row }">
            <el-tag effect="light" class="quota-tag quota-tag-venue">{{ formatAnnualQuota(row.AnnualVenueQuota) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column min-width="130">
          <template #header>
            <div class="th-header-tools">
              <button
                type="button"
                class="th-sort-btn"
                @click="toggleSort('role', 'AnnualEvQuota')"
              >
                Annual EV Quota
                <span class="sort-indicator">{{ getSortIndicator('role', 'AnnualEvQuota') }}</span>
              </button>
            </div>
          </template>
          <template #default="{ row }">
            <el-tag effect="light" class="quota-tag quota-tag-ev">{{ formatAnnualQuota(row.AnnualEvQuota) }}</el-tag>
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
          Showing {{ roleStartIndex + 1 }}-{{ roleEndIndex }} of {{ sortedRoleList.length }} records
        </div>
        <div class="pagination-controls">
          <button class="pagination-btn" :disabled="roleCurrentPage === 1" @click="roleCurrentPage--">Previous</button>
          <button
            v-for="page in roleVisiblePages"
            :key="page"
            :class="['pagination-btn', 'page-number', { active: page === roleCurrentPage }]"
            @click="roleCurrentPage = page"
          >
            {{ page }}
          </button>
          <button class="pagination-btn" :disabled="roleCurrentPage === roleTotalPages" @click="roleCurrentPage++">Next</button>
        </div>
        <div class="pagination-size">
          <select v-model.number="rolePageSize" class="page-size-select" @change="roleCurrentPage = 1">
            <option :value="10">10 / page</option>
            <option :value="20">20 / page</option>
            <option :value="50">50 / page</option>
            <option :value="100">100 / page</option>
          </select>
        </div>
      </div>
      </div>
        </el-tab-pane>

        <el-tab-pane label="Department / Unit" name="department">
          <div class="table-card">
      <el-table :data="paginatedDepartmentData" height="100%" border stripe table-layout="auto" style="width: 100%">
        <el-table-column
          type="index"
          label="#"
          width="70"
          align="center"
          header-align="center"
          fixed="left"
          :index="getDepartmentRowIndex"
        />
        <el-table-column prop="departmentName" min-width="220">
          <template #header>
            <SortableFilterHeader
              label="Abbreviation"
              :sort-indicator="getSortIndicator('department', 'departmentName')"
              :filter-active="filterStates.department.departmentName.length > 0"
              :options="departmentNameOptions"
              :model-value="filterStates.department.departmentName"
              @sort-asc="setSort('department', 'departmentName', 'asc')"
              @sort-desc="setSort('department', 'departmentName', 'desc')"
              @clear-sort="clearSort('department', 'departmentName')"
              @update:model-value="(v) => updateFilter('department', 'departmentName', v)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="description" min-width="280">
          <template #header>
            <span>Description</span>
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
          Showing {{ departmentStartIndex + 1 }}-{{ departmentEndIndex }} of {{ sortedDepartmentList.length }} records
        </div>
        <div class="pagination-controls">
          <button class="pagination-btn" :disabled="departmentCurrentPage === 1" @click="departmentCurrentPage--">Previous</button>
          <button
            v-for="page in departmentVisiblePages"
            :key="page"
            :class="['pagination-btn', 'page-number', { active: page === departmentCurrentPage }]"
            @click="departmentCurrentPage = page"
          >
            {{ page }}
          </button>
          <button class="pagination-btn" :disabled="departmentCurrentPage === departmentTotalPages" @click="departmentCurrentPage++">Next</button>
        </div>
        <div class="pagination-size">
          <select v-model.number="departmentPageSize" class="page-size-select" @change="departmentCurrentPage = 1">
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

    <BookingStyleModal
      v-model="showForm"
      :title="getFormTitle"
      max-width="500px"
    >
      <el-form :model="formData" label-width="160px">
        <el-form-item :label="activeTab === 'role' ? 'Role Name' : 'Department / Unit Name'">
          <el-input v-model="formData.name" />
        </el-form-item>
        <el-form-item label="Description">
          <el-input v-model="formData.description" type="textarea" :rows="3" />
        </el-form-item>
        <template v-if="activeTab === 'role'">
          <el-form-item label="Annual Venue Quota">
            <div class="quota-input-row">
              <el-input-number v-model="formData.AnnualVenueQuota" :min="0" :disabled="isVenueUnlimited" />
              <el-checkbox v-model="isVenueUnlimited">Unlimited</el-checkbox>
            </div>
          </el-form-item>
          <el-form-item label="Annual EV Quota">
            <div class="quota-input-row">
              <el-input-number v-model="formData.AnnualEvQuota" :min="0" :disabled="isEvUnlimited" />
              <el-checkbox v-model="isEvUnlimited">Unlimited</el-checkbox>
            </div>
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="showForm = false">Cancel</el-button>
        <el-button type="default" class="submit-btn" @click="handleSave">Save</el-button>
      </template>
    </BookingStyleModal>

    <BookingStyleModal v-model="showDeleteDialog" title="Confirm Delete" max-width="450px">
      <p>Are you sure you want to delete this {{ activeTab === 'role' ? 'role' : 'department / unit' }}?</p>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="showDeleteDialog = false">Cancel</el-button>
        <el-button type="default" class="action-btn action-delete" @click="confirmDelete">Delete</el-button>
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
import { ref, computed, watch, onMounted } from 'vue'
import * as XLSX from 'xlsx'
import BookingStyleModal from '@/components/BookingStyleModal.vue'
import SortableFilterHeader from '@/components/admin/SortableFilterHeader.vue'
import {
  getAccessRoles,
  getAccessDepartments,
  createAccessRole,
  updateAccessRole,
  deleteAccessRole,
  createAccessDepartment,
  updateAccessDepartment,
  deleteAccessDepartment
} from '@/api/accessRight'

const activeTab = ref('role')

const roleList = ref([])

const departmentList = ref([])

const roleCurrentPage = ref(1)
const rolePageSize = ref(20)
const departmentCurrentPage = ref(1)
const departmentPageSize = ref(20)

const filterStates = ref({
  role: {
    roleName: []
  },
  department: {
    departmentName: []
  }
})

const sortStates = ref({
  role: { key: '', order: '' },
  department: { key: '', order: '' }
})


const getUniqueFilterOptions = (list, key) => {
  return [...new Set((list || []).map(item => item?.[key]).filter(v => v !== null && v !== undefined && `${v}` !== ''))]
}

const updateFilter = (tab, key, value) => {
  filterStates.value[tab][key] = value ?? []
  if (tab === 'role') roleCurrentPage.value = 1
  if (tab === 'department') departmentCurrentPage.value = 1
}

const selectAllFilterOptions = (tab, key, options) => {
  updateFilter(tab, key, [...options])
}

const clearFilterOptions = (tab, key) => {
  updateFilter(tab, key, [])
}

const filterList = (list, tab) => {
  const filters = filterStates.value[tab]
  return list.filter(item =>
    Object.entries(filters).every(([key, value]) => {
      if (!Array.isArray(value) || value.length === 0) return true
      return value.map(v => String(v)).includes(String(item?.[key]))
    })
  )
}

const getSortValue = (item, key) => {
  const value = item?.[key]
  return value == null ? '' : value
}

const sortList = (list, tab) => {
  const { key, order } = sortStates.value[tab]
  if (!key || !order) return [...list]

  const sorted = [...list].sort((a, b) => {
    const aVal = getSortValue(a, key)
    const bVal = getSortValue(b, key)
    const aNum = Number(aVal)
    const bNum = Number(bVal)

    let result = 0
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && `${aVal}` !== '' && `${bVal}` !== '') {
      result = aNum - bNum
    } else {
      result = String(aVal).localeCompare(String(bVal), undefined, { sensitivity: 'base' })
    }

    return order === 'asc' ? result : -result
  })

  return sorted
}

const toggleSort = (tab, key) => {
  const current = sortStates.value[tab]
  if (current.key !== key) {
    sortStates.value[tab] = { key, order: 'asc' }
  } else if (current.order === 'asc') {
    sortStates.value[tab] = { key, order: 'desc' }
  } else if (current.order === 'desc') {
    sortStates.value[tab] = { key: '', order: '' }
  } else {
    sortStates.value[tab] = { key, order: 'asc' }
  }

  if (tab === 'role') roleCurrentPage.value = 1
  if (tab === 'department') departmentCurrentPage.value = 1
}

const setSort = (tab, key, order) => {
  sortStates.value[tab] = { key, order }
  if (tab === 'role') roleCurrentPage.value = 1
  if (tab === 'department') departmentCurrentPage.value = 1
}

const clearSort = (tab, key) => {
  if (sortStates.value[tab].key === key) {
    sortStates.value[tab] = { key: '', order: '' }
    if (tab === 'role') roleCurrentPage.value = 1
    if (tab === 'department') departmentCurrentPage.value = 1
  }
}

const getSortIndicator = (tab, key) => {
  const current = sortStates.value[tab]
  if (current.key !== key || !current.order) return '↕'
  return current.order === 'asc' ? '▲' : '▼'
}

const filteredRoleList = computed(() => filterList(roleList.value, 'role'))
const filteredDepartmentList = computed(() => filterList(departmentList.value, 'department'))
const roleNameOptions = computed(() => getUniqueFilterOptions(roleList.value, 'roleName'))
const departmentNameOptions = computed(() => getUniqueFilterOptions(departmentList.value, 'departmentName'))
const sortedRoleList = computed(() => sortList(filteredRoleList.value, 'role'))
const sortedDepartmentList = computed(() => sortList(filteredDepartmentList.value, 'department'))

const paginatedData = computed(() => {
  const start = (roleCurrentPage.value - 1) * rolePageSize.value
  const end = start + rolePageSize.value
  return sortedRoleList.value.slice(start, end)
})

const roleTotalPages = computed(() => Math.max(1, Math.ceil(sortedRoleList.value.length / rolePageSize.value)))
const roleStartIndex = computed(() => (roleCurrentPage.value - 1) * rolePageSize.value)
const roleEndIndex = computed(() => Math.min(roleStartIndex.value + rolePageSize.value, sortedRoleList.value.length))
const roleVisiblePages = computed(() => {
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, roleCurrentPage.value - Math.floor(maxVisible / 2))
  let end = Math.min(roleTotalPages.value, start + maxVisible - 1)
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1)
  }
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

const paginatedDepartmentData = computed(() => {
  const start = (departmentCurrentPage.value - 1) * departmentPageSize.value
  const end = start + departmentPageSize.value
  return sortedDepartmentList.value.slice(start, end)
})

const departmentTotalPages = computed(() => Math.max(1, Math.ceil(sortedDepartmentList.value.length / departmentPageSize.value)))
const departmentStartIndex = computed(() => (departmentCurrentPage.value - 1) * departmentPageSize.value)
const departmentEndIndex = computed(() => Math.min(departmentStartIndex.value + departmentPageSize.value, sortedDepartmentList.value.length))
const departmentVisiblePages = computed(() => {
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, departmentCurrentPage.value - Math.floor(maxVisible / 2))
  let end = Math.min(departmentTotalPages.value, start + maxVisible - 1)
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1)
  }
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

const showForm = ref(false)
const formMode = ref('add')
const isVenueUnlimited = ref(false)
const isEvUnlimited = ref(false)
const formData = ref({
  name: '',
  description: '',
  AnnualVenueQuota: 30,
  AnnualEvQuota: 60
})

watch(isVenueUnlimited, (checked) => {
  if (checked) formData.value.AnnualVenueQuota = -1
  else if (Number(formData.value.AnnualVenueQuota) < 0) formData.value.AnnualVenueQuota = 0
})

watch(isEvUnlimited, (checked) => {
  if (checked) formData.value.AnnualEvQuota = -1
  else if (Number(formData.value.AnnualEvQuota) < 0) formData.value.AnnualEvQuota = 0
})

const getFormTitle = computed(() => {
  if (activeTab.value === 'role') {
    return formMode.value === 'add' ? 'Add Role' : 'Edit Role'
  } else {
    return formMode.value === 'add' ? 'Add Department / Unit' : 'Edit Department / Unit'
  }
})

const showDeleteDialog = ref(false)
const currentRow = ref(null)
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

const loadAccessLists = async () => {
  try {
    const [roles, depts] = await Promise.all([getAccessRoles(), getAccessDepartments()])
    roleList.value = Array.isArray(roles) ? roles : []
    departmentList.value = Array.isArray(depts) ? depts : []
  } catch (error) {
    showNotice(getErrorMessage(error, 'Failed to load access right data'), 'Error')
  }
}

onMounted(() => {
  loadAccessLists()
})

const getRoleRowIndex = (index) => (roleCurrentPage.value - 1) * rolePageSize.value + index + 1
const getDepartmentRowIndex = (index) => (departmentCurrentPage.value - 1) * departmentPageSize.value + index + 1

const formatAnnualQuota = (value) => (Number(value) === -1 ? 'unlimited bookings/year' : `${value} bookings/year`)

const handleExport = () => {
  if (activeTab.value === 'role') {
    const exportData = roleList.value.map(item => ({
      'Role Name': item.roleName,
      'Description': item.description,
      'Annual Venue Quota': item.AnnualVenueQuota,
      'Annual EV Quota': item.AnnualEvQuota,
      'User Count': item.employeeCount
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Roles')
    XLSX.writeFile(wb, `Role_Management_${new Date().toISOString().split('T')[0]}.xlsx`)
  } else {
    const exportData = departmentList.value.map(item => ({
      'Department / Unit Name': item.departmentName,
      'Description': item.description,
      'User Count': item.employeeCount
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Departments')
    XLSX.writeFile(wb, `Department_Management_${new Date().toISOString().split('T')[0]}.xlsx`)
  }
  showNotice('Excel file exported successfully', 'Success')
}

const handleAdd = () => {
  formMode.value = 'add'
  if (activeTab.value === 'role') {
    formData.value = { name: '', description: '', AnnualVenueQuota: 30, AnnualEvQuota: 60 }
    isVenueUnlimited.value = false
    isEvUnlimited.value = false
  } else {
    formData.value = { name: '', description: '' }
  }
  showForm.value = true
}

const handleEdit = (row) => {
  formMode.value = 'edit'
  if (activeTab.value === 'role') {
    formData.value = { ...row, name: row.roleName }
    isVenueUnlimited.value = Number(row.AnnualVenueQuota) === -1
    isEvUnlimited.value = Number(row.AnnualEvQuota) === -1
  } else {
    formData.value = { ...row, name: row.departmentName }
  }
  showForm.value = true
}

const handleSave = async () => {
  try {
    if (activeTab.value === 'role') {
      const rolePayload = {
        roleName: String(formData.value.name || '').trim(),
        description: String(formData.value.description || '').trim(),
        annualVenueQuota: isVenueUnlimited.value ? -1 : Number(formData.value.AnnualVenueQuota ?? 0),
        annualEvQuota: isEvUnlimited.value ? -1 : Number(formData.value.AnnualEvQuota ?? 0)
      }
      if (!rolePayload.roleName) {
        showNotice('Please enter a role name', 'Warning')
        return
      }
      if (formMode.value === 'add') {
        await createAccessRole(rolePayload)
        showNotice('Role added successfully', 'Success')
      } else {
        await updateAccessRole(formData.value.id, rolePayload)
        showNotice('Role updated successfully', 'Success')
      }
    } else {
      const deptPayload = {
        departmentName: String(formData.value.name || '').trim(),
        description: String(formData.value.description || '').trim()
      }
      if (!deptPayload.departmentName) {
        showNotice('Please enter a department / unit name', 'Warning')
        return
      }
      if (formMode.value === 'add') {
        await createAccessDepartment(deptPayload)
        showNotice('Department / Unit added successfully', 'Success')
      } else {
        await updateAccessDepartment(formData.value.id, deptPayload)
        showNotice('Department / Unit updated successfully', 'Success')
      }
    }
    showForm.value = false
    await loadAccessLists()
  } catch (error) {
    showNotice(getErrorMessage(error, 'Failed to save'), 'Error')
  }
}

const handleDelete = (row) => {
  if (row.employeeCount > 0) {
    showNotice(`Cannot delete ${activeTab.value} with assigned users`, 'Warning')
    return
  }
  currentRow.value = row
  showDeleteDialog.value = true
}

const confirmDelete = async () => {
  if (!currentRow.value) return
  try {
    if (activeTab.value === 'role') {
      await deleteAccessRole(currentRow.value.id)
      showNotice('Deleted successfully', 'Success')
    } else {
      await deleteAccessDepartment(currentRow.value.id)
      showNotice('Deleted successfully', 'Success')
    }
    showDeleteDialog.value = false
    currentRow.value = null
    await loadAccessLists()
  } catch (error) {
    showNotice(getErrorMessage(error, 'Failed to delete'), 'Error')
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

.page-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0.25rem 0.6rem 0.6rem;
  display: flex;
  flex-direction: column;
}

.page-content :deep(.el-tabs) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.page-content :deep(.el-tabs__header) {
  margin-bottom: 0.35rem;
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

.page-content :deep(.el-table td) {
  padding: 0.5rem;
  font-size: 0.8125rem;
  border-bottom: 1px solid #e5e7eb;
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

.page-content :deep(.quota-tag) {
  border-radius: 999px;
  font-weight: 600;
  padding: 0 10px;
}

.page-content :deep(.quota-tag-venue) {
  background-color: #dbeafe;
  color: #1d4ed8;
}

.page-content :deep(.quota-tag-ev) {
  background-color: #dcfce7;
  color: #166534;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
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

.table-card :deep(.el-table) {
  flex: 1;
  min-height: 0;
  overflow: visible;
}

.table-card :deep(.el-table__header-wrapper) {
  position: relative;
  z-index: 30;
  overflow: visible;
}

.table-card :deep(.el-table__header) {
  overflow: visible;
}

.table-card :deep(.el-table__body-wrapper) {
  position: relative;
  z-index: 10;
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

.th-sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.sort-indicator {
  font-size: 0.75rem;
  color: #6b7280;
  line-height: 1;
}

.quota-input-row {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
}

.th-header-tools {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
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

.th-menu-anchor {
  position: relative;
  display: inline-block;
}

.th-menu-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 260px;
  z-index: 5000;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  background: #ffffff;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  padding: 0.5rem;
}

.th-menu-panel.global {
  position: fixed;
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

.th-filter-popover :deep(.el-checkbox__inner:hover) {
  border-color: #00723a;
}

.notice-message {
  margin: 0;
  font-size: 15px;
  color: #374151;
  line-height: 1.6;
}

</style>
