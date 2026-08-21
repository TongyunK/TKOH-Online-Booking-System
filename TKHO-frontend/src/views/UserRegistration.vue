<template>
  <div class="reg-page">
    <header class="reg-header">
      <FloatingHelpButton />
    </header>
    <!-- 与 UserManagement「Pending Approval Details」一致：BookingStyleModal + pending-approval-detail-modal -->
    <BookingStyleModal
      v-model="resultOpen"
      :title="resultTitle"
      max-width="440px"
      dialog-width="92%"
      custom-class="pending-approval-detail-modal registration-result-modal"
      :close-on-click-overlay="false"
    >
      <div class="registration-result-body">
        <div class="registration-result-icon" :class="`is-${resultKind}`">
          <el-icon v-if="resultKind === 'success'" class="registration-result-icon-inner" :size="28"><Check /></el-icon>
          <el-icon v-else-if="resultKind === 'error'" class="registration-result-icon-inner" :size="26"><Close /></el-icon>
          <el-icon v-else class="registration-result-icon-inner" :size="26"><WarningFilled /></el-icon>
        </div>
        <p class="registration-result-msg">{{ resultMessage }}</p>
      </div>
      <template #footer>
        <el-button type="default" class="submit-btn" @click="resultOpen = false">OK</el-button>
      </template>
    </BookingStyleModal>
    <div class="reg-card">
      <h2 class="reg-title">User Registration</h2>
      <p class="reg-subtitle">Please complete the form to submit your account application.</p>
      <el-form
        :model="form"
        class="reg-form"
        :label-position="formLabelPosition"
        :label-width="formLabelWidth"
      >
        <el-form-item label="Corp ID">
          <el-input v-model="form.corpId" placeholder="Enter corp ID" />
        </el-form-item>
        <el-form-item label="Name">
          <el-input v-model="form.name" placeholder="Enter full name" />
        </el-form-item>
        <el-form-item label="Email">
          <el-input v-model="form.email" type="email" placeholder="example@tkoh.local" />
        </el-form-item>
        <el-form-item label="Contact No.">
          <el-input v-model="form.contactNo" placeholder="Enter contact number" />
        </el-form-item>
        <el-form-item label="Department">
          <el-select v-model="form.department" style="width: 100%" filterable placeholder="Select department">
            <el-option v-for="d in departments" :key="d.id" :label="d.departmentName" :value="d.departmentName" />
          </el-select>
        </el-form-item>
        <el-form-item label="Reason">
          <el-input v-model="form.reason" type="textarea" :rows="4" placeholder="Optional: brief reason for application" />
        </el-form-item>
      </el-form>
      <div class="actions">
        <el-button type="default" class="reg-action-btn back-login-btn" @click="goToLogin">Back to Login</el-button>
        <div class="actions-right">
          <el-button type="default" class="reg-action-btn" @click="resetForm">Reset</el-button>
          <el-button type="primary" class="reg-action-btn" :loading="submitting" @click="submit">Submit Application</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Check, Close, WarningFilled } from '@element-plus/icons-vue'
import BookingStyleModal from '@/components/BookingStyleModal.vue'
import FloatingHelpButton from '@/components/FloatingHelpButton.vue'
import { getRegistrationOptions, submitUserRegistration } from '@/api/userManagement'
import { notifyPendingUsersUpdated } from '@/utils/pendingUsersSync'

const departments = ref([])
const submitting = ref(false)
const router = useRouter()

const resultOpen = ref(false)
const resultKind = ref('success')
const resultTitle = ref('')
const resultMessage = ref('')
const pendingSuccessReset = ref(false)

/** 宽屏：标签在左、字段名靠右（label-position=right）；窄屏：置顶 + 16px 输入避免 iOS 聚焦放大 */
const formLabelPosition = ref('right')
const formLabelWidth = ref('120px')
let regLayoutMq

function syncRegistrationFormLayout () {
  if (!regLayoutMq) return
  if (regLayoutMq.matches) {
    formLabelPosition.value = 'top'
    formLabelWidth.value = 'auto'
  } else {
    formLabelPosition.value = 'right'
    formLabelWidth.value = '120px'
  }
}

function showResult (kind, title, message) {
  resultKind.value = kind
  resultTitle.value = title
  resultMessage.value = message
  pendingSuccessReset.value = kind === 'success'
  resultOpen.value = true
}

function onResultClosed () {
  if (pendingSuccessReset.value) {
    pendingSuccessReset.value = false
    resetForm()
  }
}

/** 点 footer OK 只改 v-model 时不会 emit close，与点 X / Esc 统一在关闭后处理成功重置 */
watch(resultOpen, (open) => {
  if (!open) onResultClosed()
})

const form = ref({
  corpId: '',
  name: '',
  department: '',
  email: '',
  contactNo: '',
  reason: ''
})

function resetForm () {
  form.value = { corpId: '', name: '', department: '', email: '', contactNo: '', reason: '' }
}

function goToLogin () {
  router.push('/login')
}

function normalizeSubmitErrorMessage (error) {
  const data = error?.response?.data
  if (data && typeof data === 'object') {
    const msg = data.message
    if (Array.isArray(msg)) return msg[0] || 'Submission failed'
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  if (error?.message && typeof error.message === 'string') return error.message
  return 'Submission failed. Please try again later.'
}

async function submit () {
  if (!form.value.corpId || !form.value.name || !form.value.department || !form.value.email || !form.value.contactNo) {
    showResult(
      'warning',
      'Cannot submit',
      'Please complete all required fields (Corp ID, Name, Email, Contact No., Department).'
    )
    return
  }
  submitting.value = true
  try {
    await submitUserRegistration(form.value)
  } catch (e) {
    console.error(e)
    submitting.value = false
    showResult('error', 'Submission failed', normalizeSubmitErrorMessage(e))
    return
  }
  submitting.value = false
  notifyPendingUsersUpdated()
  showResult(
    'success',
    'Submission successful',
    'Your application has been submitted successfully. Please wait for administrator approval.'
  )
}

onMounted(async () => {
  regLayoutMq = window.matchMedia('(max-width: 639px)')
  syncRegistrationFormLayout()
  regLayoutMq.addEventListener('change', syncRegistrationFormLayout)

  try {
    const data = await getRegistrationOptions()
    departments.value = data?.departments || []
  } catch (e) {
    console.error(e)
    departments.value = []
  }
})

onUnmounted(() => {
  regLayoutMq?.removeEventListener('change', syncRegistrationFormLayout)
})
</script>

<style scoped>
.reg-page {
  position: relative;
  z-index: 0;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #f5f7fa 0%, #edf2f7 100%);
  padding: 24px;
}

.reg-header {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 12px 24px;
}
/* 外壳与 UserManagement 的 notice / pending 弹窗一致；此处仅排布图标与说明文案 */
.registration-result-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  padding: 0.25rem 0 0.5rem;
}
.registration-result-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
}
.registration-result-icon.is-success {
  background: #00723a;
  color: #fff;
  box-shadow: 0 6px 18px rgba(0, 114, 58, 0.35);
}
.registration-result-icon.is-error {
  background: #dc2626;
  color: #fff;
  box-shadow: 0 6px 18px rgba(220, 38, 38, 0.35);
}
.registration-result-icon.is-warning {
  background: #d97706;
  color: #fff;
  box-shadow: 0 6px 18px rgba(217, 119, 6, 0.35);
}
.registration-result-icon-inner {
  margin: 0;
}
.registration-result-msg {
  margin: 0;
  max-width: 36em;
  font-size: 15px;
  line-height: 1.55;
  color: #374151;
}
.reg-card {
  width: 100%;
  max-width: 760px;
  background: #fff;
  border-radius: 16px;
  padding: 28px 28px 20px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, .10);
  border: 1px solid #eef2f7;
}
.reg-title {
  margin: 0;
  text-align: center;
  color: #0f172a;
  font-size: 30px;
  font-weight: 700;
}
.reg-subtitle {
  margin: 8px 0 20px;
  text-align: center;
  color: #64748b;
  font-size: 14px;
}
.reg-form :deep(.el-form-item__label) {
  font-weight: 600;
  color: #334155;
}
.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.actions-right {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  margin-left: auto;
}

@media screen and (max-width: 639px) {
  .reg-page {
    align-items: flex-start;
    padding: 12px 10px 24px;
  }
  .reg-card {
    border-radius: 12px;
    padding: 16px 14px 14px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  }
  .reg-title {
    font-size: 1.375rem;
    line-height: 1.25;
  }
  .reg-subtitle {
    font-size: 13px;
    margin: 6px 0 14px;
    line-height: 1.45;
  }
  .reg-form :deep(.el-form-item) {
    margin-bottom: 14px;
  }
  .reg-form :deep(.el-form-item:last-child) {
    margin-bottom: 6px;
  }
  .reg-form :deep(.el-form-item__label) {
    padding-bottom: 4px;
    line-height: 1.35;
    font-size: 16px;
  }
  /* iOS：输入框字号 <16px 时聚焦会整页放大；统一 16px 可避免 */
  .reg-form :deep(.el-input__inner),
  .reg-form :deep(.el-textarea__inner),
  .reg-form :deep(.el-select__wrapper),
  .reg-form :deep(.el-select__placeholder),
  .reg-form :deep(.el-select__selected-item),
  .reg-form :deep(.el-select__input) {
    font-size: 16px !important;
  }
  .actions {
    flex-direction: column;
    align-items: stretch;
    justify-content: stretch;
    gap: 10px;
    margin-top: 4px;
  }
  .actions-right {
    flex-direction: column;
    align-items: stretch;
    justify-content: stretch;
    gap: 10px;
    margin-left: 0;
    width: 100%;
  }
  .reg-action-btn {
    width: 100%;
    margin: 0 !important;
  }
}
</style>
