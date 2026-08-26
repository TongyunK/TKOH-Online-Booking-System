<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">Display Management</h2>
      <div v-if="showSaveConfigButton" class="header-actions">
        <el-button type="default" class="submit-btn" @click="handleSaveConfig">Save Configuration</el-button>
      </div>
    </div>

    <div class="page-content">
      <el-tabs v-model="activeTab" class="main-tabs">
        <el-tab-pane label="Display Rules" name="rules" class="rules-tab-pane">
          <div class="rules-pane">
            <div class="table-card display-rules-card">
              <el-table :data="paginatedVenueRules" height="100%" border stripe table-layout="auto" style="width: 100%">
                <el-table-column type="index" label="#" width="70" align="center" />
                <el-table-column prop="venueName" label="Venue" min-width="180" />
                <el-table-column label="Display Type" min-width="180">
                  <template #default="{ row }">
                    <div class="display-type-buttons">
                      <button
                        :class="['type-btn', 'type-btn-single', { active: row.displayType === 'single' }]"
                        :disabled="row.venueId == null"
                        @click="row.displayType = 'single'"
                      >
                        Single
                      </button>
                      <button
                        :class="['type-btn', 'type-btn-merge', { active: row.displayType === 'merge' }]"
                        :disabled="row.venueId == null"
                        @click="row.displayType = 'merge'"
                      >
                        Merge
                      </button>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="Display Name" min-width="160">
                  <template #default="{ row }">
                    <el-input
                      v-model="row.displayName"
                      placeholder="e.g. CR1"
                      :disabled="row.venueId == null"
                    />
                  </template>
                </el-table-column>
              </el-table>

              <div v-if="rulesTotalPages > 1" class="pagination-bar">
                <div class="pagination-info">
                  Showing {{ rulesTotal === 0 ? 0 : rulesStartIndex + 1 }}-{{ rulesEndIndex }} of {{ rulesTotal }} records
                </div>
                <div class="pagination-controls">
                  <button class="pagination-btn" :disabled="rulesCurrentPage === 1" @click="rulesCurrentPage--">Previous</button>
                  <button
                    v-for="page in rulesVisiblePages"
                    :key="`rules-page-${page}`"
                    :class="['pagination-btn', 'page-number', { active: page === rulesCurrentPage }]"
                    @click="rulesCurrentPage = page"
                  >
                    {{ page }}
                  </button>
                  <button class="pagination-btn" :disabled="rulesCurrentPage === rulesTotalPages" @click="rulesCurrentPage++">Next</button>
                </div>
                <div class="pagination-size">
                  <select v-model.number="rulesPageSize" class="page-size-select" @change="rulesCurrentPage = 1">
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

        <el-tab-pane label="Preview Links" name="preview">
          <el-tabs v-model="previewSubTab" class="preview-sub-tabs">
            <el-tab-pane label="Single" name="single">
              <div class="table-card">
                <div class="card-title">Venue Independent Display</div>
                <div class="link-list">
                  <div v-for="item in independentPreviewLinks" :key="item.key" class="link-row">
                    <span class="link-label">{{ item.label }}</span>
                    <a :href="item.url" target="_blank" rel="noopener noreferrer" class="link-url">{{ item.url }}</a>
                  </div>
                </div>
              </div>

              <div class="table-card">
                <div class="card-title">Tea Service Display</div>
                <div class="link-list">
                  <div class="link-row">
                    <span class="link-label">Tea Service Board Preview</span>
                    <a :href="teaServicePreviewLink.url" target="_blank" rel="noopener noreferrer" class="link-url">{{ teaServicePreviewLink.url }}</a>
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="Merge" name="merge">
              <div class="table-card">
                <div class="card-title">Venue Merge Screen Preview Link</div>
                <div class="link-list">
                  <div v-for="item in mergedPreviewLinks" :key="item.key" class="link-row merge-link-row">
                    <span class="link-detail">{{ item.detail }}</span>
                    <a :href="item.url" target="_blank" rel="noopener noreferrer" class="link-url">{{ item.url }}</a>
                  </div>
                  <div v-if="mergedPreviewLinks.length === 0" class="empty-text">No venue is set to merge display</div>
                </div>
              </div>

              <div class="table-card">
                <div class="card-title">Merge Display Customization</div>
                <div class="merge-config-form">
                  <el-form label-width="150px">
                    <el-form-item label="Name &amp; Location">
                      <el-input
                        v-model="form.mergeDisplaySettings.panelTitleText"
                        type="textarea"
                        :rows="3"
                        :placeholder="mergePanelTitlePlaceholder"
                      />
                    </el-form-item>
                    <el-form-item label="Footer Ticker Text">
                      <el-input
                        v-model.trim="form.mergeDisplaySettings.footerTickerText"
                        type="textarea"
                        :rows="4"
                        placeholder="e.g. 請在會議期間佩戴外科口罩並保持安靜。For enquiries regarding Conference Rooms, please contact General Office."
                      />
                    </el-form-item>
                    <el-form-item label="QR Code Image">
                      <div class="qr-config-section">
                        <div class="qr-config-actions">
                          <el-upload
                            action="#"
                            :auto-upload="false"
                            :show-file-list="false"
                            :on-change="handleQrImageChange"
                            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                          >
                            <el-button type="default">Upload QR Image</el-button>
                          </el-upload>
                          <el-button
                            type="default"
                            class="danger-light-btn"
                            :disabled="!form.mergeDisplaySettings.qrCodeImage"
                            @click="handleClearQrImage"
                          >
                            Clear Image
                          </el-button>
                        </div>
                        <div class="qr-preview">
                          <ApiProtectedImg
                            v-if="form.mergeDisplaySettings.qrCodeImage"
                            :src="form.mergeDisplaySettings.qrCodeImage"
                            alt="Uploaded QR Code"
                            class="qr-preview-image"
                          />
                          <img
                            v-else
                            :src="defaultMergeQrSrc"
                            alt="Default QR Code"
                            class="qr-preview-image"
                          />
                          <span class="qr-preview-label">
                            {{ form.mergeDisplaySettings.qrCodeImage ? 'Custom QR Code uploaded' : 'Default QR Code (no custom image uploaded)' }}
                          </span>
                        </div>
                      </div>
                    </el-form-item>
                  </el-form>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="EV" name="ev">
              <div class="table-card">
                <div class="card-title">EV Display Board Preview Link</div>
                <div class="link-list">
                  <div class="link-row">
                    <a :href="evPreviewLink.url" target="_blank" rel="noopener noreferrer" class="link-url">{{ evPreviewLink.url }}</a>
                  </div>
                </div>
              </div>

              <div class="table-card">
                <div class="card-title">EV Display Customization</div>
                <el-form label-width="150px">
                  <el-form-item label="Footer Ticker Text">
                    <el-input
                      v-model.trim="form.evDisplaySettings.footerTickerText"
                      type="textarea"
                      :rows="3"
                      placeholder="e.g. 請依照已預約之時段及車位泊車，並於離場前移走車輛。"
                    />
                  </el-form-item>
                </el-form>
              </div>
            </el-tab-pane>
          </el-tabs>

        </el-tab-pane>
      </el-tabs>
    </div>

    <BookingStyleModal v-model="showNoticeDialog" :title="noticeTitle" max-width="420px">
      <p class="notice-message">{{ noticeMessage }}</p>
      <template #footer>
        <el-button type="default" class="submit-btn" @click="showNoticeDialog = false">OK</el-button>
      </template>
    </BookingStyleModal>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import BookingStyleModal from '@/components/BookingStyleModal.vue'
import {
  getDisplayConfig,
  saveDisplayConfig,
  uploadMergeQrImage,
  clearMergeQrImage
} from '@/api/displayManagement'
import ApiProtectedImg from '@/components/ApiProtectedImg.vue'

const activeTab = ref('rules')
const previewSubTab = ref('single')
const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
const defaultMergeQrSrc = `${import.meta.env.BASE_URL}displayQRCode.png`
const mergePanelTitlePlaceholder = 'Conference Room | 8/F Ambulatory Care Block\n會議室 | 日間醫療大樓8樓'
const rulesCurrentPage = ref(1)
const rulesPageSize = ref(20)
const loading = ref(false)

const config = ref(null)
const showNoticeDialog = ref(false)
const noticeTitle = ref('Notice')
const noticeMessage = ref('')

const showNotice = (message, title = 'Notice') => {
  noticeTitle.value = title
  noticeMessage.value = message
  showNoticeDialog.value = true
}

function buildFormFromConfig (data) {
  const rules = Array.isArray(data?.venueRules) ? data.venueRules : []
  const evRule = rules.find((item) => item.venueId == null)
  return {
    evDisplayMode: evRule?.displayType || data?.evDisplayMode || 'single',
    evDisplaySettings: {
      footerTickerText: data?.evDisplaySettings?.footerTickerText || ''
    },
    mergeDisplaySettings: {
      panelTitleText: data?.mergeDisplaySettings?.panelTitleText || '',
      footerTickerText: data?.mergeDisplaySettings?.footerTickerText || '',
      qrCodeImage: data?.mergeDisplaySettings?.qrCodeImage || ''
    },
    venueRules: rules.map((item) => ({
      venueId: item.venueId != null ? item.venueId : null,
      venueName: item.venueName || (item.venueId == null ? 'EV' : ''),
      displayType: item.displayType || 'single',
      status: String(item.status || 'active').toLowerCase() || 'active',
      displayName: item.displayName ?? (item.venueId == null ? 'EV' : ''),
      arrowDirection: item.arrowDirection ?? ''
    }))
  }
}

const form = ref(buildFormFromConfig({ venueRules: [] }))

async function loadDisplayConfig () {
  loading.value = true
  try {
    const data = await getDisplayConfig()
    config.value = data
    form.value = buildFormFromConfig(data)
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadDisplayConfig()
})

const showSaveConfigButton = computed(() => {
  return activeTab.value === 'rules' || (activeTab.value === 'preview' && ['merge', 'ev'].includes(previewSubTab.value))
})

const independentPreviewLinks = computed(() =>
  form.value.venueRules
    .filter(item =>
      item.displayType === 'single' &&
      item.venueId != null &&
      String(item.status || 'active').toLowerCase() === 'active'
    )
    .map(item => ({
      key: `single-${item.venueId}`,
      label: item.venueName,
      url: `${baseUrl}/VenueBooking/Display?displayType=single&venueId=${item.venueId}`
    }))
)

const mergedPreviewLinks = computed(() => {
  const mergedVenues = form.value.venueRules
    .filter(item =>
      item.displayType === 'merge' &&
      item.venueId != null &&
      String(item.status || 'active').toLowerCase() === 'active'
    )
    .map(item => item.venueName)

  if (mergedVenues.length === 0) return []

  return [{
    key: 'merge-all',
    detail: `(${mergedVenues.length} venues): ${mergedVenues.join(', ')}`,
    url: `${baseUrl}/VenueBooking/Display/Merge`
  }]
})

/** Display Rules：仅展示 Active venue（含 EV 行） */
const visibleVenueRules = computed(() =>
  form.value.venueRules.filter((item) =>
    item.venueId == null || String(item.status || 'active').toLowerCase() === 'active'
  )
)

const rulesTotal = computed(() => visibleVenueRules.value.length)
const rulesTotalPages = computed(() => Math.max(1, Math.ceil(rulesTotal.value / rulesPageSize.value)))
const rulesStartIndex = computed(() => (rulesCurrentPage.value - 1) * rulesPageSize.value)
const rulesEndIndex = computed(() => Math.min(rulesStartIndex.value + rulesPageSize.value, rulesTotal.value))
const paginatedVenueRules = computed(() =>
  visibleVenueRules.value.slice(rulesStartIndex.value, rulesStartIndex.value + rulesPageSize.value)
)
const rulesVisiblePages = computed(() => {
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, rulesCurrentPage.value - Math.floor(maxVisible / 2))
  let end = Math.min(rulesTotalPages.value, start + maxVisible - 1)
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1)
  }
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

watch([rulesTotal, rulesPageSize], () => {
  if (rulesCurrentPage.value > rulesTotalPages.value) {
    rulesCurrentPage.value = rulesTotalPages.value
  }
})

const teaServicePreviewLink = computed(() => ({
  url: `${baseUrl}/VenueBooking/Display/TeaService`
}))
const evPreviewLink = computed(() => ({
  url: `${baseUrl}/evBooking/Display`
}))

const buildSavePayload = () => {
  const editableVenueRules = form.value.venueRules.filter((item) => item.venueId != null)
  const hasSingle = editableVenueRules.some((item) => item.displayType === 'single')
  const hasMerge = editableVenueRules.some((item) => item.displayType === 'merge')
  const venueDisplayMode = hasSingle && hasMerge ? 'mixed' : hasMerge ? 'merge' : 'single'
  const evRule = form.value.venueRules.find((item) => item.venueId == null)

  return {
    venueDisplayMode,
    evDisplayMode: evRule?.displayType || form.value.evDisplayMode,
    mergeDisplaySettings: {
      panelTitleText: form.value.mergeDisplaySettings.panelTitleText,
      footerTickerText: form.value.mergeDisplaySettings.footerTickerText,
      qrCodeImage: form.value.mergeDisplaySettings.qrCodeImage
    },
    evDisplaySettings: {
      footerTickerText: form.value.evDisplaySettings.footerTickerText
    },
    venueRules: form.value.venueRules.map((item) => ({
      venueId: item.venueId,
      venueName: item.venueName,
      displayType: item.displayType,
      displayName: (item.displayName ?? (item.venueId == null ? 'EV' : '')).trim(),
      arrowDirection: item.arrowDirection ?? ''
    }))
  }
}

const handleSaveConfig = async () => {
  try {
    const data = await saveDisplayConfig(buildSavePayload())
    config.value = data
    form.value = buildFormFromConfig(data)
    showNotice('Display configuration saved', 'Success')
  } catch (e) {
    console.error(e)
  }
}

const handleQrImageChange = async (uploadFile) => {
  const rawFile = uploadFile?.raw
  if (!rawFile) return
  if (!rawFile.type.startsWith('image/')) {
    showNotice('Please upload an image file', 'Warning')
    return
  }
  try {
    const result = await uploadMergeQrImage(rawFile)
    form.value.mergeDisplaySettings.qrCodeImage = result?.qrCodeImage || ''
    showNotice('QR image uploaded successfully', 'Success')
  } catch (e) {
    console.error(e)
  }
}

const handleClearQrImage = async () => {
  try {
    await clearMergeQrImage()
    form.value.mergeDisplaySettings.qrCodeImage = ''
    showNotice('QR image cleared', 'Success')
  } catch (e) {
    console.error(e)
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

.page-content :deep(.el-tabs) {
  flex: 1;
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

.page-content :deep(.el-tabs__header) {
  margin-bottom: 0.35rem;
}

.page-content :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.page-content :deep(.main-tabs > .el-tabs__content) {
  flex: 1;
  min-height: 0;
}

.page-content :deep(.main-tabs > .el-tabs__content > .el-tab-pane) {
  height: 100%;
  min-height: 0;
}

.page-content :deep(.el-tab-pane) {
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

.table-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  padding: 0.75rem;
  margin-bottom: 0.6rem;
}

.rules-pane {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.display-rules-card {
  padding: 0.3rem;
  height: 100%;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
}

.display-rules-card :deep(.el-table) {
  flex: 1;
  min-height: 0;
}

.merge-config-form {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 0.75rem 0.75rem 0.25rem;
  background: #fafafa;
}

.qr-config-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.qr-config-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.qr-preview {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.qr-preview-image {
  width: 84px;
  height: 84px;
  border-radius: 4px;
  background: #ffffff;
  object-fit: cover;
  border: 1px solid rgba(0, 0, 0, 0.16);
  flex-shrink: 0;
}

.qr-preview-label {
  font-size: 0.8125rem;
  color: #6b7280;
  line-height: 1.4;
}

.danger-light-btn {
  border-color: #fecaca !important;
  color: #b91c1c !important;
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
}

.page-content :deep(.el-table td) {
  padding: 0.5rem;
  font-size: 0.8125rem;
  border-bottom: 1px solid #e5e7eb;
}

.page-content :deep(.el-table__row:hover) {
  background: #f9fafb;
}

.card-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #111827;
  margin-bottom: 0.6rem;
}

.link-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.75rem;
  padding: 0.475rem 0.5rem 0.375rem;
  border-top: 1px solid #e5e7eb;
  background-color: white;
  margin-top: auto;
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

.link-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.link-label {
  min-width: 180px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #374151;
}

.link-url {
  color: #2563eb;
  text-decoration: underline;
  word-break: break-all;
  font-size: 0.8125rem;
}

.link-detail {
  color: #374151;
  font-size: 0.8125rem;
  line-height: 1.35;
}

.merge-link-row {
  flex-direction: column;
  align-items: flex-start;
}

.empty-text {
  font-size: 0.8125rem;
  color: #6b7280;
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

.notice-message {
  margin: 0;
  font-size: 15px;
  color: #374151;
  line-height: 1.6;
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
</style>
