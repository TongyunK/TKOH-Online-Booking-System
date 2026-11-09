<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">Prompts and Templates</h2>
      <div class="header-actions">
        <el-input
          v-model="currentSearch"
          class="toolbar-search"
          :placeholder="searchPlaceholder"
          clearable
        />
        <el-button type="default" class="cancel-btn" @click="handleExport">
          <font-awesome-icon :icon="['fas', 'file-excel']" /> Export Excel
        </el-button>
        <el-button v-if="activeTab === 'reject'" type="default" class="submit-btn" @click="handleAdd">
          <font-awesome-icon :icon="['fas', 'plus']" /> Add {{ activeTabLabel }}
        </el-button>
      </div>
    </div>

    <div class="page-content">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="Prompts and Templates" name="system" />
        <el-tab-pane label="Reject Template" name="reject" />
      </el-tabs>
      <div class="table-card">
      <el-table v-loading="tableLoading" :data="paginatedData" height="100%" border stripe table-layout="fixed" style="width: 100%">
        <el-table-column
          type="index"
          label="#"
          width="70"
          align="center"
          header-align="center"
          fixed="left"
          :index="getRowIndex"
        />
        <el-table-column
          prop="name"
          label="Name"
          width="290"
          show-overflow-tooltip
        />
        <el-table-column label="Content" min-width="320">
          <template #default="{ row }">
            <div
              v-if="activeTab === 'system'"
              class="formatted-content rich-content"
              v-html="renderFormattedContent(row.content)"
            />
            <span v-else>{{ row.content }}</span>
          </template>
        </el-table-column>
        <el-table-column
          label="Actions"
          :width="activeTab === 'reject' ? 140 : 110"
          fixed="right"
          class-name="actions-col"
        >
          <template #default="{ row }">
            <div class="actions-cell">
              <el-button size="small" class="action-btn action-edit" @click="handleEdit(row)">Edit</el-button>
              <el-button
                v-if="activeTab === 'reject'"
                size="small"
                class="action-btn action-delete"
                @click="handleDelete(row)"
              >
                Delete
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-bar">
        <div class="pagination-info">
          Showing {{ startIndex + 1 }}-{{ endIndex }} of {{ currentList.length }} records
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

    <BookingStyleModal
      v-model="showForm"
      :title="formModalTitle"
      :max-width="activeTab === 'system' ? '1240px' : '700px'"
      :max-height="formModalMaxHeight"
      :custom-class="formModalCustomClass"
    >
      <el-form :model="formData" label-width="120px">
        <el-form-item v-if="activeTab === 'reject' && formMode === 'edit'" label="Type">
          <el-input v-model="formData.key" :disabled="activeTab === 'system' || formMode === 'edit'" placeholder="e.g., reject_template_01" />
        </el-form-item>
        <el-form-item label="Name">
          <el-input v-model="formData.name" :disabled="activeTab === 'system'" placeholder="Display name" />
        </el-form-item>
        <el-form-item label="Content">
          <template v-if="activeTab === 'system'">
            <div
              class="rich-editor-wrap"
              :class="{ 'rich-editor-wrap--system-prompt': activeTab === 'system' }"
            >
              <div class="rich-editor-toolbar">
                <WangToolbar
                  :editor="editorRef"
                  :default-config="toolbarConfig"
                  mode="default"
                  class="wang-toolbar"
                />
              </div>
              <WangEditor
                v-model="formData.content"
                :default-config="editorConfig"
                mode="default"
                class="rich-editor rich-content wang-editor"
                @on-created="handleEditorCreated"
                @on-change="handleEditorChange"
              />
            </div>
          </template>
          <el-input
            v-else
            v-model="formData.content"
            type="textarea"
            :rows="6"
            placeholder="Prompt message content"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="showForm = false">Cancel</el-button>
        <el-button type="default" class="submit-btn" @click="handleSave">Save</el-button>
      </template>
    </BookingStyleModal>

    <BookingStyleModal v-model="showDeleteDialog" title="Confirm Delete" max-width="450px">
      <p>Are you sure you want to delete this prompt?</p>
      <template #footer>
        <el-button type="default" class="cancel-btn" @click="showDeleteDialog = false">Cancel</el-button>
        <el-button type="default" class="action-btn action-delete" @click="confirmDelete">Delete</el-button>
      </template>
    </BookingStyleModal>

    <BookingStyleModal v-model="showNoticeDialog" :title="noticeTitle" max-width="450px">
      <p>{{ noticeMessage }}</p>
      <template #footer>
        <el-button type="default" class="submit-btn" @click="showNoticeDialog = false">OK</el-button>
      </template>
    </BookingStyleModal>

  </div>
</template>

<script setup>
import { ref, shallowRef, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import * as XLSX from 'xlsx'
import { Editor as WangEditor, Toolbar as WangToolbar } from '@wangeditor/editor-for-vue'
import { i18nChangeLanguage, DomEditor } from '@wangeditor/editor'
import BookingStyleModal from '@/components/BookingStyleModal.vue'
import {
  getPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt
} from '@/api/promptManagement'
import '@/styles/rich-content.css'
import '@wangeditor/editor/dist/css/style.css'

const promptList = ref([])
const rejectTemplateDefaults = {
  user_application: {
    key: 'user_application_reject_template',
    name: 'User Application Reject Template',
    content: 'Your user application is rejected. Reason: {reason}'
  }
}
const activeTab = ref('system')
const rejectSubTab = ref('user_application')
const searchState = ref({
  system: '',
  user_application: ''
})
const activeTabLabel = computed(() => (activeTab.value === 'system' ? 'System Prompt' : 'Reject Template'))
const formModalTitle = computed(() => {
  if (formMode.value === 'add') {
    return activeTab.value === 'reject'
      ? 'Add Approval User Reject Template'
      : `Add ${activeTabLabel.value}`
  }
  return `Edit ${activeTabLabel.value}`
})
const currentSearchKey = computed(() => (activeTab.value === 'system' ? 'system' : rejectSubTab.value))
const currentSearch = computed({
  get: () => searchState.value[currentSearchKey.value] || '',
  set: (value) => {
    searchState.value[currentSearchKey.value] = value
  }
})
const searchPlaceholder = computed(() =>
  activeTab.value === 'system' ? 'Search by name or content' : 'Search reject templates by name or content'
)

const stripHtmlForSearch = (value) =>
  String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

const filterByNameOrContent = (list, query) => {
  const keyword = String(query || '').trim().toLowerCase()
  if (!keyword) return list
  return list.filter((item) => {
    const name = String(item?.name || '').toLowerCase()
    const content = stripHtmlForSearch(item?.content)
    return name.includes(keyword) || content.includes(keyword)
  })
}

const currentList = computed(() => {
  if (activeTab.value === 'system') {
    const base = promptList.value.filter(item => item.category === 'system_fixed')
    return filterByNameOrContent(base, searchState.value.system)
  }
  const base = promptList.value.filter(
    item => item.category === 'reject_template' && item.templateType === rejectSubTab.value
  )
  return filterByNameOrContent(base, searchState.value[rejectSubTab.value])
})

const currentPage = ref(1)
const pageSize = ref(20)
const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return currentList.value.slice(start, start + pageSize.value)
})
const totalPages = computed(() => Math.max(1, Math.ceil(currentList.value.length / pageSize.value)))
const startIndex = computed(() => (currentPage.value - 1) * pageSize.value)
const endIndex = computed(() => Math.min(startIndex.value + pageSize.value, currentList.value.length))
const visiblePages = computed(() => {
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages.value, start + maxVisible - 1)
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

watch([activeTab, rejectSubTab, searchState], () => {
  currentPage.value = 1
}, { deep: true })

const showForm = ref(false)
const formMode = ref('add')
const formData = ref({
  key: '',
  name: '',
  content: '',
  category: 'reject_template',
  canAdd: true,
  templateType: 'user_application'
})
const showDeleteDialog = ref(false)
const currentRow = ref(null)
const showNoticeDialog = ref(false)
const noticeTitle = ref('Operation Notice')
const noticeMessage = ref('')
const editorRef = shallowRef()
const toolbarConfig = {
  /** 工具栏/选区面板挂到 body，避免弹窗内 overflow 裁切（对齐 license owner 下拉体验） */
  modalAppendToBody: true,
  toolbarKeys: [
    'bold',
    'italic',
    'through',
    'underline',
    // 'fontSize',
    '|',
    'color',
    'bgColor',
    'justifyLeft',
    'justifyCenter',
    'justifyRight',
    '|',
    'insertLink',
    'bulletedList',
    'numberedList',
    '|',
    'insertTable',
    'deleteTable',
    '|',
    'undo',
    'redo',
    'clearStyle'
  ]
}
const editorConfig = {
  placeholder: 'Please enter content...'
}
const SYSTEM_PROMPT_MODAL_MQ = '(min-width: 1100px) and (max-width: 1599px)'
const systemPromptEditModalMaxHeight = ref('98vh')
const formModalMaxHeight = computed(() => (
  activeTab.value === 'system' ? systemPromptEditModalMaxHeight.value : '94vh'
))
const formModalCustomClass = computed(() => (
  activeTab.value === 'system' ? 'system-prompt-edit-modal' : ''
))
let systemPromptModalMq = null

function updateSystemPromptEditModalMaxHeight () {
  if (typeof window === 'undefined') return
  // 14 寸 zoom:0.8 时用更大 vh，折算后视口高度与 98vh 接近并略高
  systemPromptEditModalMaxHeight.value = window.matchMedia(SYSTEM_PROMPT_MODAL_MQ).matches ? '128vh' : '98vh'
}

function onSystemPromptModalMqChange () {
  updateSystemPromptEditModalMaxHeight()
  restoreAllPortaledDropPanels()
  const openPanel = document.querySelector(
    'body > .w-e-drop-panel, body > .w-e-modal, .system-prompt-edit-modal .w-e-drop-panel, .system-prompt-edit-modal .w-e-modal'
  )
  if (openPanel && editorRef.value) {
    editorRef.value.hidePanelOrModal?.()
  }
  if (editorRef.value) {
    bindWangHoverBarReposition(editorRef.value)
  } else {
    unbindWangHoverBarReposition()
  }
}

onMounted(() => {
  i18nChangeLanguage('en')
  updateSystemPromptEditModalMaxHeight()
  systemPromptModalMq = window.matchMedia(SYSTEM_PROMPT_MODAL_MQ)
  systemPromptModalMq.addEventListener('change', onSystemPromptModalMqChange)
  loadPromptList()
})

onUnmounted(() => {
  if (systemPromptModalMq) {
    systemPromptModalMq.removeEventListener('change', onSystemPromptModalMqChange)
  }
  unbindWangDropPanelReposition()
  unbindWangHoverBarReposition()
  editorRef.value?.destroy()
  editorRef.value = null
})

watch(showForm, async (opened) => {
  if (!opened) {
    unbindWangDropPanelReposition()
    unbindWangHoverBarReposition()
    editorRef.value?.hidePanelOrModal?.()
    return
  }
  if (activeTab.value !== 'system') return
  await nextTick()
  formData.value.content = sanitizeHtml(formData.value.content || '<p></p>')
})

const getRowIndex = (index) => (currentPage.value - 1) * pageSize.value + index + 1

function showNotice (message, title = 'Operation Notice') {
  noticeMessage.value = message
  noticeTitle.value = title
  showNoticeDialog.value = true
}

const getErrorMessage = (error, fallback = 'Operation failed') => {
  const message = error?.response?.data?.message
  if (Array.isArray(message)) return message[0] || fallback
  if (typeof message === 'string' && message.trim()) return message
  if (typeof error?.message === 'string' && error.message.trim()) return error.message
  return fallback
}

const tableLoading = ref(false)

const loadPromptList = async () => {
  tableLoading.value = true
  try {
    const data = await getPrompts()
    promptList.value = Array.isArray(data) ? data : []
  } catch (error) {
    showNotice(getErrorMessage(error, 'Failed to load prompts'), 'Error')
  } finally {
    tableLoading.value = false
  }
}

const handleExport = () => {
  const exportData = currentList.value.map(item => ({
    ID: item.id ?? '',
    Type: item.key,
    Name: item.name,
    Content: item.content,
    'Template Rule': item.canAdd ? 'Customizable' : 'Fixed'
  }))
  const ws = XLSX.utils.json_to_sheet(exportData)
  const wb = XLSX.utils.book_new()
  const sheetName = activeTab.value === 'system' ? 'Prompts and Templates' : 'Reject Template'
  const filePrefix = activeTab.value === 'system' ? 'System_Prompts' : 'Reject_Template'
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filePrefix}_${new Date().toISOString().split('T')[0]}.xlsx`)
  showNotice('Excel file exported successfully', 'Success')
}

const handleAdd = () => {
  if (activeTab.value === 'system') return
  const defaultType = 'user_application'
  const defaultPreset = rejectTemplateDefaults[defaultType]
  formMode.value = 'add'
  formData.value = {
    key: defaultPreset.key,
    name: defaultPreset.name,
    content: defaultPreset.content,
    category: 'reject_template',
    canAdd: true,
    templateType: defaultType
  }
  showForm.value = true
}

const handleEdit = (row) => {
  formMode.value = 'edit'
  formData.value = { ...row }
  showForm.value = true
}

function sanitizeHtml (html) {
  const container = document.createElement('div')
  container.innerHTML = html || ''
  container.querySelectorAll('script, iframe, object, embed, style, link').forEach((node) => node.remove())
  container.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase()
      const value = String(attr.value || '')
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name)
        continue
      }
      if ((name === 'href' || name === 'src') && value.trim().toLowerCase().startsWith('javascript:')) {
        el.removeAttribute(attr.name)
      }
      if (name === 'style') {
        const safe = value
          .split(';')
          .map(s => s.trim())
          .filter(Boolean)
          .filter(rule => /^(color|background-color|font-weight|font-style|text-decoration|text-align|margin-left|margin-right|width|max-width|display|list-style-type|list-style-position)\s*:/i.test(rule))
          .join('; ')
        if (safe) el.setAttribute('style', safe)
        else el.removeAttribute('style')
      }
    }
  })
  return container.innerHTML
}

const renderFormattedContent = (content) => sanitizeHtml(content)

const WANG_PANEL_Z_INDEX = 10060
const wangDropPanelAnchors = new WeakMap()

/** 色板 dropPanel、链接 insertLink/editLink 的 modal */
function isWangFloatingPanel (panel) {
  return panel?.type === 'dropPanel' || panel?.type === 'modal'
}
let wangDropPanelReposition = null
let wangDropPanelPositionTimers = []
let wangHoverBarScrollHandler = null
let wangHoverBarPointerHandler = null
let wangHoverBarPointerEl = null
let wangHoverBarScrollEl = null
let wangHoverBarScrollDebounceTimer = null
let wangHoverBarAlignRetryTimers = []
let wangHoverBarRepositioning = false

/**
 * 色板挂到 body/modal-body 后，mousedown 会使编辑器 blur、selection 变 null；
 * 此前在 click 捕获阶段 stopPropagation 会阻断 wangeditor 色块点击，导致改色无反应。
 */
function onWangDropPanelMouseDown (e) {
  e.preventDefault()
  e.stopPropagation()
}

function onWangDropPanelColorPick (e) {
  const panelEl = e.currentTarget
  const li = e.target?.closest?.('li')
  if (!li || !panelEl.contains(li)) return

  e.preventDefault()
  e.stopPropagation()

  const editor = editorRef.value
  if (!editor) return

  if (editor.selection == null) {
    editor.restoreSelection()
  }
  if (editor.selection == null) return

  const anchor = wangDropPanelAnchors.get(panelEl)
  const mark = anchor?.menuKey === 'bgColor' ? 'bgColor' : 'color'
  const val = li.getAttribute('data-value')

  if (val === '0' || li.classList.contains('clear')) {
    editor.removeMark(mark)
  } else if (val) {
    editor.addMark(mark, val)
  } else {
    return
  }

  formData.value.content = sanitizeHtml(editor.getHtml())
  editor.hidePanelOrModal?.()
}

function attachDropPanelSelectionGuard (panel) {
  const panelEl = panel?.$elem?.[0]
  if (!panelEl || panelEl.dataset.wangDropGuard === '1') return
  panelEl.dataset.wangDropGuard = '1'
  panelEl.addEventListener('mousedown', onWangDropPanelMouseDown, true)
  panelEl.addEventListener('click', onWangDropPanelColorPick, false)
}

function clearPortalPanelStyles (panelEl) {
  if (!panelEl) return
  for (const key of ['position', 'left', 'top', 'right', 'bottom', 'z-index']) {
    panelEl.style.removeProperty(key)
  }
}

function isBarItemEl (el) {
  return Boolean(el?.classList?.contains('w-e-bar-item'))
}

function toDropPanelAnchor (host) {
  if (!host) return null
  const trigger = host.matches?.('button') ? host : host.querySelector?.('button')
  if (!trigger) return null
  const barItem = isBarItemEl(host) ? host : host.closest?.('.w-e-bar-item')
  return {
    trigger,
    host: barItem || host,
    menuKey: trigger.getAttribute?.('data-menu-key') || ''
  }
}

function findActiveDropPanelAnchorIn (container) {
  if (!container) return null
  const selectors = [
    '.w-e-bar-item button.active',
    '.w-e-bar-item.active button',
    '.w-e-bar-item .w-e-button-container.active button'
  ]
  for (const sel of selectors) {
    const activeBtn = container.querySelector(sel)
    if (activeBtn) return toDropPanelAnchor(activeBtn.closest('.w-e-bar-item'))
  }
  return null
}

/** insertLink / editLink：show 瞬间可能尚无 .active，需回退到对应按钮 */
function findLinkMenuAnchorInModal () {
  const root = document.querySelector('.booking-style-modal-root.system-prompt-edit-modal')
  if (!root) return null
  for (const key of ['insertLink', 'editLink']) {
    const selectors = [
      `button[data-menu-key="${key}"].active`,
      `.w-e-bar-item.active button[data-menu-key="${key}"]`,
      `.w-e-bar-item button[data-menu-key="${key}"]`
    ]
    for (const sel of selectors) {
      const btn = root.querySelector(sel)
      if (btn) return toDropPanelAnchor(btn.closest('.w-e-bar-item'))
    }
  }
  return null
}

/** 仅匹配当前点击的 active 按钮，避免误用 hoverbar 里第一个颜色按钮导致整体偏下 */
function findDropPanelAnchorInModal () {
  const root = document.querySelector('.booking-style-modal-root.system-prompt-edit-modal')
  if (!root) return null

  const hoverBar = root.querySelector('.w-e-hover-bar.w-e-bar-show')
    || root.querySelector('.w-e-hover-bar:not(.w-e-bar-hidden)')
  const hoverAnchor = findActiveDropPanelAnchorIn(hoverBar)
  if (hoverAnchor) return hoverAnchor

  const toolbar = root.querySelector('.rich-editor-toolbar .w-e-toolbar, .wang-toolbar .w-e-toolbar')
  const toolbarAnchor = findActiveDropPanelAnchorIn(toolbar)
  if (toolbarAnchor) return toolbarAnchor

  return findLinkMenuAnchorInModal()
}

/** 以本次 show 时记录的按钮为准，避免切换颜色/背景色时仍定位到上一个 active */
function resolveLiveDropPanelAnchor (panel, showAnchor = null) {
  const panelEl = panel?.$elem?.[0]
  const cached = panelEl ? wangDropPanelAnchors.get(panelEl) : null
  if (cached?.trigger?.isConnected) return cached
  if (showAnchor?.trigger?.isConnected) return showAnchor

  const parent = panel?.$elem?.parent()?.[0]
  if (isBarItemEl(parent)) return toDropPanelAnchor(parent)

  if (panel?.type === 'modal') {
    return findLinkMenuAnchorInModal() || findDropPanelAnchorInModal()
  }
  return findDropPanelAnchorInModal()
}

/** 锚点缺失时仍抬升层级，避免留在 body 底层被 BookingStyleModal 遮住 */
function ensureWangPanelLayer (panelEl) {
  if (!panelEl) return
  panelEl.style.setProperty('z-index', String(WANG_PANEL_Z_INDEX), 'important')
  if (panelEl.parentNode === document.body) {
    panelEl.style.setProperty('position', 'fixed', 'important')
    panelEl.style.setProperty('right', 'auto', 'important')
    panelEl.style.setProperty('bottom', 'auto', 'important')
  }
}

/** 与 style.css html zoom 0.8 断点一致：挂 body + fixed 会与缩放坐标不一致 */
function shouldPortalWangDropPanelToBody () {
  if (typeof window === 'undefined') return true
  return !window.matchMedia(SYSTEM_PROMPT_MODAL_MQ).matches
}

function restoreDropPanelToHost (panelEl) {
  const anchor = wangDropPanelAnchors.get(panelEl)
  if (!anchor?.host?.isConnected || !panelEl) return
  anchor.host.appendChild(panelEl)
  clearPortalPanelStyles(panelEl)
}

function restoreAllPortaledDropPanels () {
  document.querySelectorAll('body > .w-e-drop-panel, body > .w-e-modal').forEach((panelEl) => {
    restoreDropPanelToHost(panelEl)
  })
  const root = document.querySelector('.booking-style-modal-root.system-prompt-edit-modal')
  if (!root) return
  root.querySelectorAll(
    '.modal-body > .w-e-drop-panel, .modal-body > .w-e-modal, .w-e-hover-bar .w-e-drop-panel, .w-e-hover-bar .w-e-modal'
  ).forEach((panelEl) => {
    restoreDropPanelToHost(panelEl)
  })
}

function isHoverbarAnchor (anchor) {
  return Boolean(anchor?.trigger?.closest('.w-e-hover-bar'))
}

function getSystemPromptModalBody () {
  return document.querySelector('.booking-style-modal-root.system-prompt-edit-modal .modal-body')
}

function getSystemPromptEditorRoot () {
  return document.querySelector('.booking-style-modal-root.system-prompt-edit-modal')
}

function getVisibleHoverBarEl () {
  const root = getSystemPromptEditorRoot()
  if (!root) return null
  const bar = root.querySelector('.w-e-hover-bar.w-e-bar-show')
  if (!bar || bar.classList.contains('w-e-bar-hidden')) return null
  return bar
}

function getHoverBarTargetDomNode (editor) {
  if (!editor?.selection) return null
  try {
    const elems = DomEditor.getSelectedElems(editor)
    if (elems?.length) {
      const node = DomEditor.toDOMNode(editor, elems[elems.length - 1])
      if (node?.nodeType === Node.ELEMENT_NODE) return node
      return node?.parentElement || null
    }
  } catch {
    /* ignore */
  }
  try {
    const native = window.getSelection?.()
    if (!native?.rangeCount) return null
    let node = native.getRangeAt(0).commonAncestorContainer
    if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement
    return node?.closest?.('a, img, table, span[data-w-e-type]') || node
  } catch {
    /* ignore */
  }
  return null
}

/** wangeditor hoverbar 用 offset + getBoundingClientRect 混算，html zoom 0.8 下会远离选区 */
function repositionHoverBarAtZoomBreakpoint (editor) {
  if (wangHoverBarRepositioning || shouldPortalWangDropPanelToBody()) return
  const hoverBar = getVisibleHoverBarEl()
  if (!hoverBar || !editor) return

  const host = hoverBar.offsetParent
  const target = getHoverBarTargetDomNode(editor)
  if (!host || !target) return

  const zoom = getHtmlZoomScale()
  const hostRect = host.getBoundingClientRect()
  const rect = target.getBoundingClientRect()
  if (!rect.width && !rect.height) return

  const relTop = (rect.top - hostRect.top) / zoom
  const relLeft = (rect.left - hostRect.left) / zoom
  const elH = rect.height / zoom
  const hostH = host.clientHeight
  const barW = hoverBar.offsetWidth || 120

  let topPx = null
  let bottomPx = null
  let useBottom = relTop > 40
  if (useBottom) {
    bottomPx = Math.max(5, hostH - relTop + 5)
  } else {
    topPx = Math.max(0, relTop + elH + 5)
  }

  let left = relLeft + 5
  const hostW = host.clientWidth
  if (left + barW > hostW - 8) {
    left = Math.max(8, (rect.right - hostRect.left) / zoom - barW)
  }
  left = Math.max(5, left)

  wangHoverBarRepositioning = true
  try {
    hoverBar.style.setProperty('position', 'absolute', 'important')
    hoverBar.style.setProperty('right', 'auto', 'important')
    hoverBar.style.setProperty('margin', '0', 'important')
    hoverBar.style.setProperty('transform', 'none', 'important')
    hoverBar.style.setProperty('z-index', '30', 'important')
    hoverBar.style.setProperty('left', `${left}px`, 'important')

    if (useBottom) {
      hoverBar.classList.add('w-e-bar-bottom')
      hoverBar.style.setProperty('top', 'auto', 'important')
      hoverBar.style.setProperty('bottom', `${bottomPx}px`, 'important')
    } else {
      hoverBar.classList.remove('w-e-bar-bottom')
      hoverBar.style.setProperty('bottom', 'auto', 'important')
      hoverBar.style.setProperty('top', `${topPx}px`, 'important')
    }
    hoverBar.classList.add('wang-hover-bar-positioned')
  } finally {
    wangHoverBarRepositioning = false
  }
}

function clearHoverBarAlignRetryTimers () {
  wangHoverBarAlignRetryTimers.forEach((id) => clearTimeout(id))
  wangHoverBarAlignRetryTimers = []
}

/**
 * 点击选区后对齐 hoverbar。不用 editor.change（会反复触发并重置定时器导致等很久）。
 * wangeditor 自身约 200ms debounce 后才显示 hoverbar，故在 0/180/240ms 各试一次。
 */
function alignHoverBarAfterSelection (editor) {
  if (shouldPortalWangDropPanelToBody() || !editor) return
  clearHoverBarAlignRetryTimers()

  const run = () => {
    const bar = getVisibleHoverBarEl()
    if (!bar) return
    repositionHoverBarAtZoomBreakpoint(editor)
  }

  ;[0, 180, 240].forEach((ms) => {
    wangHoverBarAlignRetryTimers.push(setTimeout(run, ms))
  })
}

function scheduleHoverBarRepositionOnScroll (editor) {
  if (shouldPortalWangDropPanelToBody() || !getVisibleHoverBarEl()) return
  if (wangHoverBarScrollDebounceTimer) clearTimeout(wangHoverBarScrollDebounceTimer)
  wangHoverBarScrollDebounceTimer = setTimeout(() => {
    wangHoverBarScrollDebounceTimer = null
    repositionHoverBarAtZoomBreakpoint(editor)
  }, 80)
}

function bindWangHoverBarReposition (editor) {
  unbindWangHoverBarReposition()
  if (!editor || shouldPortalWangDropPanelToBody()) return

  const onScroll = () => scheduleHoverBarRepositionOnScroll(editor)
  const onPointer = () => alignHoverBarAfterSelection(editor)
  wangHoverBarScrollHandler = onScroll
  wangHoverBarPointerHandler = onPointer

  editor.on('scroll', onScroll)
  editor.on('fullScreen', onScroll)
  editor.on('unFullScreen', onScroll)

  const scrollEl = getSystemPromptEditorRoot()?.querySelector('.w-e-text-container')
  if (scrollEl) {
    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    wangHoverBarScrollEl = scrollEl
  }

  const pointerTarget =
    getSystemPromptEditorRoot()?.querySelector('[data-slate-editor]')
    || scrollEl
  if (pointerTarget) {
    pointerTarget.addEventListener('mouseup', onPointer)
    pointerTarget.addEventListener('keyup', onPointer)
    wangHoverBarPointerEl = pointerTarget
  }
}

function unbindWangHoverBarReposition () {
  if (wangHoverBarScrollDebounceTimer) {
    clearTimeout(wangHoverBarScrollDebounceTimer)
    wangHoverBarScrollDebounceTimer = null
  }
  clearHoverBarAlignRetryTimers()
  wangHoverBarRepositioning = false
  if (wangHoverBarScrollEl && wangHoverBarScrollHandler) {
    wangHoverBarScrollEl.removeEventListener('scroll', wangHoverBarScrollHandler)
    wangHoverBarScrollEl = null
  }
  if (wangHoverBarPointerEl && wangHoverBarPointerHandler) {
    wangHoverBarPointerEl.removeEventListener('mouseup', wangHoverBarPointerHandler)
    wangHoverBarPointerEl.removeEventListener('keyup', wangHoverBarPointerHandler)
    wangHoverBarPointerEl = null
  }
  const editor = editorRef.value
  if (editor && wangHoverBarScrollHandler) {
    editor.off('scroll', wangHoverBarScrollHandler)
    editor.off('fullScreen', wangHoverBarScrollHandler)
    editor.off('unFullScreen', wangHoverBarScrollHandler)
  }
  wangHoverBarScrollHandler = null
  wangHoverBarPointerHandler = null
}

/** 14 寸 html zoom 下，视口坐标需换算为弹窗内 absolute 布局像素 */
function getHtmlZoomScale () {
  if (typeof window === 'undefined') return 1
  const raw = Number.parseFloat(window.getComputedStyle(document.documentElement).zoom || '1')
  return Number.isFinite(raw) && raw > 0 ? raw : 1
}

function getTriggerOffsetInHost (trigger, host) {
  const hostRect = host.getBoundingClientRect()
  const rect = trigger.getBoundingClientRect()
  const zoom = getHtmlZoomScale()
  return {
    left: (rect.left - hostRect.left + host.scrollLeft) / zoom,
    top: (rect.top - hostRect.top + host.scrollTop) / zoom,
    bottom: (rect.bottom - hostRect.top + host.scrollTop) / zoom,
    right: (rect.right - hostRect.left + host.scrollLeft) / zoom
  }
}

/** 14 寸 zoom：工具栏留在 bar-item；hoverbar 挂 modal-body，避免被 w-e-text-container 裁切成空白条 */
function positionDropPanelAtZoomBreakpoint ($panel, anchor, panel = null) {
  if (panel?.type === 'modal' || isHoverbarAnchor(anchor)) {
    positionDropPanelInModalBody($panel, anchor)
  } else {
    positionDropPanelInHost($panel, anchor)
  }
}

/** bar-item 内 absolute 对齐触发按钮 */
function positionDropPanelInHost ($panel, anchor) {
  const panelEl = $panel?.[0]
  const host = anchor?.host
  const trigger = anchor?.trigger
  if (!panelEl || !host || !trigger) return

  if (panelEl.parentNode === document.body || panelEl.parentNode !== host) {
    host.appendChild(panelEl)
  }
  clearPortalPanelStyles(panelEl)

  panelEl.style.setProperty('position', 'absolute', 'important')
  panelEl.style.setProperty('top', '100%', 'important')
  panelEl.style.setProperty('margin-top', '2px', 'important')
  panelEl.style.setProperty('z-index', String(WANG_PANEL_Z_INDEX), 'important')

  const bar = trigger.closest('.w-e-bar')
  if (bar) {
    const btnRect = trigger.getBoundingClientRect()
    const barRect = bar.getBoundingClientRect()
    if (btnRect.left - barRect.left >= barRect.width / 2) {
      panelEl.style.setProperty('left', 'auto', 'important')
      panelEl.style.setProperty('right', '0', 'important')
    } else {
      panelEl.style.setProperty('left', '0', 'important')
      panelEl.style.setProperty('right', 'auto', 'important')
    }
  } else {
    panelEl.style.setProperty('left', '0', 'important')
    panelEl.style.setProperty('right', 'auto', 'important')
  }
  panelEl.style.setProperty('margin', '0', 'important')
}

function positionDropPanelInModalBody ($panel, anchor) {
  const panelEl = $panel?.[0]
  const trigger = anchor?.trigger
  const host = getSystemPromptModalBody()
  if (!panelEl || !trigger || !host) return

  if (panelEl.parentNode !== host) {
    host.appendChild(panelEl)
  }
  clearPortalPanelStyles(panelEl)

  const offset = getTriggerOffsetInHost(trigger, host)
  if (!offset.right && !offset.bottom) return

  const zoom = getHtmlZoomScale()
  const ph = panelEl.offsetHeight || (panelEl.getBoundingClientRect().height / zoom) || 280
  const pw = panelEl.offsetWidth || (panelEl.getBoundingClientRect().width / zoom) || 220

  let top = offset.bottom + 2
  const triggerRect = trigger.getBoundingClientRect()
  if (triggerRect.bottom + ph * zoom > window.innerHeight - 8) {
    top = Math.max(8, offset.top - ph - 2)
  }

  let left = offset.left
  const hostLayoutWidth = host.offsetWidth
  if (left + pw > hostLayoutWidth - 8) {
    left = Math.max(8, offset.right - pw)
  }
  left = Math.min(Math.max(left, 8), Math.max(8, hostLayoutWidth - pw - 8))

  panelEl.style.setProperty('margin', '0', 'important')
  panelEl.style.setProperty('position', 'absolute', 'important')
  panelEl.style.setProperty('left', `${left}px`, 'important')
  panelEl.style.setProperty('top', `${top}px`, 'important')
  panelEl.style.setProperty('right', 'auto', 'important')
  panelEl.style.setProperty('bottom', 'auto', 'important')
  panelEl.style.setProperty('transform', 'none', 'important')
  panelEl.style.setProperty('z-index', String(WANG_PANEL_Z_INDEX), 'important')
}

function positionPortalDropPanel ($panel, anchor) {
  const panelEl = $panel?.[0]
  const trigger = anchor?.trigger
  if (!panelEl || !trigger) return
  const rect = trigger.getBoundingClientRect()
  if (!rect.width && !rect.height) return

  const ph = panelEl.getBoundingClientRect().height || panelEl.offsetHeight || 280
  const pw = panelEl.getBoundingClientRect().width || panelEl.offsetWidth || 220

  let top = rect.bottom + 2
  if (top + ph > window.innerHeight - 8) {
    top = Math.max(8, rect.top - ph - 2)
  }

  let left = rect.left
  const bar = trigger.closest('.w-e-bar')
  if (bar) {
    const barRect = bar.getBoundingClientRect()
    const btnCenter = rect.left + rect.width / 2
    if (btnCenter > barRect.left + barRect.width / 2) {
      left = rect.right - pw
    }
  }
  if (left + pw > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - pw - 8)
  }
  if (left < 8) left = 8

  panelEl.style.setProperty('margin', '0', 'important')
  panelEl.style.setProperty('position', 'fixed', 'important')
  panelEl.style.setProperty('left', `${left}px`, 'important')
  panelEl.style.setProperty('top', `${top}px`, 'important')
  panelEl.style.setProperty('right', 'auto', 'important')
  panelEl.style.setProperty('bottom', 'auto', 'important')
  panelEl.style.setProperty('transform', 'none', 'important')
  panelEl.style.setProperty('z-index', String(WANG_PANEL_Z_INDEX), 'important')
}

function clearWangDropPanelPositionTimers () {
  wangDropPanelPositionTimers.forEach((id) => clearTimeout(id))
  wangDropPanelPositionTimers = []
}

function schedulePortalDropPanelPosition (panel, showAnchor) {
  clearWangDropPanelPositionTimers()
  const $panel = panel.$elem
  const panelEl = $panel?.[0]
  const run = () => {
    if (!panel?.isShow || !isWangFloatingPanel(panel)) return
    const liveAnchor = resolveLiveDropPanelAnchor(panel, showAnchor)
    if (!liveAnchor?.trigger) return
    if (panelEl) {
      wangDropPanelAnchors.set(panelEl, liveAnchor)
    }
    if (panel?.type === 'modal') {
      if (shouldPortalWangDropPanelToBody()) {
        positionPortalDropPanel($panel, liveAnchor)
      } else {
        positionDropPanelInModalBody($panel, liveAnchor)
      }
    } else if (shouldPortalWangDropPanelToBody()) {
      positionPortalDropPanel($panel, liveAnchor)
    } else {
      positionDropPanelAtZoomBreakpoint($panel, liveAnchor, panel)
    }
    ensureWangPanelLayer(panelEl)
  }
  run()
  requestAnimationFrame(run)
  wangDropPanelPositionTimers = [0, 16, 50, 100, 150, 200].map((ms) => setTimeout(run, ms))
}

function mountDropPanelForBreakpoint ($panel, anchor, panel = null) {
  const panelEl = $panel?.[0]
  if (!panelEl || !anchor) return
  if (shouldPortalWangDropPanelToBody()) {
    if (panelEl.parentNode !== document.body) {
      document.body.appendChild(panelEl)
    }
    return
  }
  const mountHost = (panel?.type === 'modal' || isHoverbarAnchor(anchor))
    ? getSystemPromptModalBody()
    : anchor.host
  if (mountHost?.isConnected && panelEl.parentNode !== mountHost) {
    mountHost.appendChild(panelEl)
  }
}

/** color/bgColor 为 dropPanel；insertLink 为 modal（modalAppendToBody 默认 left:0 right:0 在 zoom 下会错位） */
function portalWangDropPanel (panel, showAnchor = null) {
  if (!isWangFloatingPanel(panel)) {
    panel?.$elem?.css?.({ zIndex: WANG_PANEL_Z_INDEX })
    return
  }
  const $panel = panel.$elem
  const panelEl = $panel?.[0]
  if (!$panel || !panelEl) return

  restoreAllPortaledDropPanels()

  let anchor = resolveLiveDropPanelAnchor(panel, showAnchor)
  if (!anchor && panel?.type === 'modal') {
    anchor = findLinkMenuAnchorInModal()
  }
  if (!anchor) {
    ensureWangPanelLayer(panelEl)
    return
  }

  wangDropPanelAnchors.set(panelEl, anchor)
  mountDropPanelForBreakpoint($panel, anchor, panel)
  if (panel?.type === 'dropPanel') {
    attachDropPanelSelectionGuard(panel)
  }
  schedulePortalDropPanelPosition(panel, anchor)
}

function restoreWangDropPanel (panel) {
  if (!isWangFloatingPanel(panel)) return
  clearWangDropPanelPositionTimers()
  const $panel = panel.$elem
  const panelEl = $panel?.[0]
  const anchor = panelEl ? wangDropPanelAnchors.get(panelEl) : null
  const host = anchor?.host
  if (!panelEl || !host || !$panel) return
  if (panelEl.parentNode !== host) {
    host.appendChild(panelEl)
  }
  clearPortalPanelStyles(panelEl)
  $panel.css({
    position: '',
    left: '',
    top: '',
    right: '',
    bottom: '',
    zIndex: ''
  })
  wangDropPanelAnchors.delete(panelEl)
}

function bindWangDropPanelReposition (panel) {
  unbindWangDropPanelReposition()
  const handler = () => {
    if (!panel?.isShow || !isWangFloatingPanel(panel)) return
    const anchor = resolveLiveDropPanelAnchor(panel, null)
    if (!anchor) return
    if (panel?.type === 'modal') {
      if (shouldPortalWangDropPanelToBody()) {
        positionPortalDropPanel(panel.$elem, anchor)
      } else {
        positionDropPanelInModalBody(panel.$elem, anchor)
      }
    } else if (shouldPortalWangDropPanelToBody()) {
      positionPortalDropPanel(panel.$elem, anchor)
    } else {
      positionDropPanelAtZoomBreakpoint(panel.$elem, anchor, panel)
    }
    ensureWangPanelLayer(panel.$elem?.[0])
  }
  wangDropPanelReposition = handler
  window.addEventListener('scroll', handler, true)
  window.addEventListener('resize', handler)
}

function unbindWangDropPanelReposition () {
  clearWangDropPanelPositionTimers()
  if (!wangDropPanelReposition) return
  window.removeEventListener('scroll', wangDropPanelReposition, true)
  window.removeEventListener('resize', wangDropPanelReposition)
  wangDropPanelReposition = null
}

function captureDropPanelShowAnchor (panel) {
  if (!isWangFloatingPanel(panel)) return null
  const panelEl = panel.$elem?.[0]
  const parent = panel.$elem?.parent()?.[0]
  const anchor = panelEl && isBarItemEl(parent) ? toDropPanelAnchor(parent) : null
  if (panelEl && anchor) {
    wangDropPanelAnchors.set(panelEl, anchor)
  }
  return anchor
}

function handleEditorCreated (editor) {
  editorRef.value = editor
  bindWangHoverBarReposition(editor)
  editor.on('modalOrPanelShow', (panel) => {
    const showAnchor = captureDropPanelShowAnchor(panel)
    if (panel?.type === 'dropPanel') {
      attachDropPanelSelectionGuard(panel)
    }
    void nextTick(() => {
      portalWangDropPanel(panel, showAnchor)
      if (isWangFloatingPanel(panel) && panel.isShow) {
        bindWangDropPanelReposition(panel)
      }
    })
  })
  editor.on('modalOrPanelHide', (panel) => {
    if (isWangFloatingPanel(panel)) {
      restoreWangDropPanel(panel)
    }
    unbindWangDropPanelReposition()
  })
}

function handleEditorChange (editor) {
  formData.value.content = sanitizeHtml(editor.getHtml())
}

const handleSave = async () => {
  if (activeTab.value === 'system' && editorRef.value) {
    formData.value.content = sanitizeHtml(editorRef.value.getHtml())
  }
  if (!formData.value.key || !formData.value.name || !formData.value.content) {
    showNotice('Please fill in all required fields', 'Validation Notice')
    return
  }
  try {
    if (formMode.value === 'add') {
      await createPrompt({
        promptKey: String(formData.value.key || '').trim(),
        name: String(formData.value.name || '').trim(),
        content: formData.value.content,
        category: 'reject_template',
        templateType: formData.value.templateType
      })
      showNotice(`${activeTabLabel.value} added successfully`, 'Success')
    } else if (activeTab.value === 'system') {
      await updatePrompt(formData.value.id, { content: formData.value.content })
      showNotice(`${activeTabLabel.value} updated successfully`, 'Success')
    } else {
      await updatePrompt(formData.value.id, {
        promptKey: String(formData.value.key || '').trim(),
        name: String(formData.value.name || '').trim(),
        content: formData.value.content,
        templateType: formData.value.templateType
      })
      showNotice(`${activeTabLabel.value} updated successfully`, 'Success')
    }
    showForm.value = false
    await loadPromptList()
  } catch (error) {
    showNotice(getErrorMessage(error, 'Failed to save'), 'Error')
  }
}

const handleDelete = (row) => {
  currentRow.value = row
  showDeleteDialog.value = true
}

const confirmDelete = async () => {
  if (activeTab.value !== 'reject' || !currentRow.value) {
    showDeleteDialog.value = false
    currentRow.value = null
    return
  }
  try {
    await deletePrompt(currentRow.value.id)
    showNotice('Deleted successfully', 'Success')
    showDeleteDialog.value = false
    currentRow.value = null
    await loadPromptList()
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

.page-content :deep(.el-tabs__header) {
  margin-bottom: 0.35rem;
}

.page-content :deep(.el-tabs) {
  flex: 0 0 auto;
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

.sub-tabs :deep(.el-tabs__header) {
  margin-bottom: 0.35rem;
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

.rich-editor-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  width: 100%;
  box-sizing: border-box;
  overflow: visible;
}

.rich-editor-toolbar :deep(.w-e-toolbar) {
  overflow: visible;
  flex-wrap: wrap;
}

.rich-editor-toolbar :deep(.w-e-bar-item) {
  position: relative;
  overflow: visible;
}

/* 勿改 position：wangeditor 用 inline absolute 将 hoverbar 贴在选区旁 */
.rich-editor :deep(.w-e-hover-bar) {
  overflow: visible !important;
  z-index: 25;
}

.rich-editor :deep(.w-e-hover-bar .w-e-bar-item) {
  position: relative;
  overflow: visible;
}

.rich-editor-wrap :deep(.w-e-drop-panel),
.rich-editor-wrap :deep(.w-e-modal) {
  box-sizing: border-box;
}

.rich-toolbar-style-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.rich-toolbar-style-group :deep(.el-button + .el-button) {
  margin-left: 0 !important;
}

.rich-toolbar-btn {
  width: 34px;
  min-width: 34px;
  height: 28px;
  padding: 0 !important;
  border-radius: 6px !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.rich-toolbar-btn--compact {
  width: 34px;
  min-width: 34px;
}

.rich-editor-wrap {
  display: block;
  width: 100%;
  min-width: 100%;
  max-width: 100%;
  overflow: visible;
}

.color-picker-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #4b5563;
}

.rich-toolbar-color {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  min-width: 54px;
  padding: 0 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
  color: #4b5563;
  box-sizing: border-box;
}

.color-picker-label input[type='color'] {
  width: 28px;
  height: 24px;
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 4px;
  padding: 0;
}

.rich-toolbar-color input[type='color'] {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid #d1d5db;
  padding: 0;
}

.rich-editor {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 100%;
  min-height: 150px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 0;
  box-sizing: border-box;
  line-height: 1.5;
  outline: none;
  white-space: pre-wrap;
  overflow: visible;
  /* Allow synthetic italic in this editor even when global font-synthesis is disabled. */
  font-synthesis: style;
}

.rich-editor :deep(.w-e-text-container) {
  min-height: 150px;
  max-height: min(42vh, 360px);
  overflow-y: auto !important;
  overflow-x: hidden;
}

.rich-editor-wrap--system-prompt .rich-editor :deep(.w-e-text-container) {
  min-height: 220px;
  max-height: min(58vh, 540px);
}

.rich-editor-wrap--system-prompt .rich-editor :deep(.ProseMirror) {
  min-height: 220px;
}

.rich-editor :deep(.w-e-scroll) {
  overflow: visible !important;
}

.rich-editor:focus {
  border-color: #00723a;
}

.rich-editor :deep(.ProseMirror) {
  min-height: 150px;
  outline: none !important;
  border: none !important;
  box-shadow: none !important;
}

/* Visual-only: hide trailing empty paragraph that ProseMirror keeps for caret. */

.formatted-content {
  white-space: pre-wrap;
  word-break: break-word;
  /* Keep italic visible in preview/render area as well. */
  font-synthesis: style;
}

.rich-editor :deep(em),
.rich-editor :deep(i),
.formatted-content :deep(em),
.formatted-content :deep(i) {
  font-style: italic !important;
}

.table-tool-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #ffffff;
  border: 1px solid #dfe7e2;
  border-radius: 10px;
  padding: 10px;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
}

.table-tool-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.table-tool-label {
  font-size: 12px;
  color: #4b5563;
  min-width: 66px;
}

.table-tool-group-title {
  font-size: 11px;
  font-weight: 700;
  color: #166534;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 4px;
}

.table-tool-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.table-tool-inline-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  width: 100%;
}

.table-tool-inline-actions :deep(.el-button) {
  width: 100%;
  margin: 0 !important;
  padding-left: 8px;
  padding-right: 8px;
}

.table-tool-offset {
  display: grid;
  grid-template-columns: 30px 1fr 30px;
  gap: 6px;
  width: 100%;
  align-items: center;
}

.table-tool-tip {
  font-size: 11px;
  color: #6b7280;
}

.text-style-icon {
  display: inline-block;
  width: 0.9rem;
  text-align: center;
  font-weight: 700;
}

.italic-icon {
  font-style: italic;
  transform: skewX(-14deg);
}

/* Keep system prompt content editor width stable inside el-form flex layout */
:deep(.el-form-item__content) .rich-editor-wrap {
  flex: 1 1 100%;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.toolbar-search {
  width: 300px;
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
</style>
