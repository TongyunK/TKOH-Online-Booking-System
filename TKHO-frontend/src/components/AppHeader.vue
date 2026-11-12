<template>
  <header
    ref="headerRef"
    class="app-header w-full bg-[#0A3D1F] text-white"
    :class="{ 'header-stacked': headerStacked }"
  >
    <div ref="headerLeftRef" class="header-left flex items-center gap-3">
      <img src="../assets/TKOH_logo.png" alt="TKOH Logo" class="header-logo" />
      <h1 class="header-title text-lg">{{ headerTitle }}</h1>
    </div>

    <div ref="headerRightRef" class="header-right">
      <div class="header-nav-scroll">
        <nav ref="headerNavRef" class="header-nav">
          <div v-if="isAdmin" class="admin-link-wrapper">
            <RouterLink
              to="/admin"
              class="header-link admin-link"
              :class="{ 'is-active': isAdminNavActive }"
            >
              Admin
            </RouterLink>
            <span v-if="totalPendingCount > 0" class="badge-dot">{{ totalPendingCount > 99 ? '99+' : totalPendingCount }}</span>
          </div>

      <!-- 仅管理员：Calendar / Manage Booking 悬停下拉，顺序 Venue 上、EV Charging 下 -->
      <template v-if="isAdmin">
        <div class="nav-dropdown">
          <button
            type="button"
            class="header-link dropdown-trigger"
            :class="{ 'is-active': isCalendarNavActive }"
          >
            {{ calendarNavLabel }}
          </button>
          <div class="dropdown-panel">
            <div class="dropdown-panel-inner">
              <RouterLink
                to="/VenueBooking/Calendar"
                class="dropdown-link"
                :class="{ 'is-active-sub': route.path === '/VenueBooking/Calendar' }"
              >
                Venue
              </RouterLink>
              <RouterLink
                to="/evBooking/Calendar"
                class="dropdown-link"
                :class="{ 'is-active-sub': route.path === '/evBooking/Calendar' || route.path === '/evBooking' }"
              >
                EV Charging
              </RouterLink>
            </div>
          </div>
        </div>

        <div class="nav-dropdown">
          <button
            type="button"
            class="header-link dropdown-trigger"
            :class="{ 'is-active': isManageNavActive }"
          >
            {{ manageNavLabel }}
          </button>
          <div class="dropdown-panel">
            <div class="dropdown-panel-inner">
              <RouterLink
                to="/VenueBooking/ManageBooking"
                class="dropdown-link"
                :class="{ 'is-active-sub': route.path === '/VenueBooking/ManageBooking' }"
              >
                Venue
              </RouterLink>
              <RouterLink
                to="/evBooking/ManageBooking"
                class="dropdown-link"
                :class="{ 'is-active-sub': route.path === '/evBooking/ManageBooking' }"
              >
                EV Charging
              </RouterLink>
            </div>
          </div>
        </div>
      </template>

      <!-- 普通用户：单链接 + Switch -->
      <template v-else>
        <RouterLink
          :to="calendarPath"
          class="header-link"
          :class="{ 'is-active': isCalendarNavActive }"
        >
          {{ calendarNavLabel }}
        </RouterLink>
        <RouterLink
          :to="manageBookingPath"
          class="header-link"
          :class="{ 'is-active': isActive(manageBookingPath) }"
        >
          {{ manageNavLabel }}
        </RouterLink>
      </template>

          <RouterLink
            to="/Account"
            class="header-link"
            :class="{ 'is-active': isActive('/Account') }"
            @click="saveCurrentPath"
          >
            {{ accountNavLabel }}
          </RouterLink>
        </nav>
      </div>

      <div ref="headerActionsRef" class="header-actions">
        <div class="logout-wrapper">
          <button type="button" class="logout-btn" @click="userStore.performLogout">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span class="logout-text">Log out</span>
          </button>
          <!-- 非管理员且非单一系统角色：悬停显示 Venue/EV 切换 -->
          <div v-if="showSwitchButton" class="switch-dropdown">
            <button type="button" class="switch-btn" @click="handleSwitch">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="17 1 21 5 17 9"></polyline>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                <polyline points="7 23 3 19 7 15"></polyline>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
              </svg>
              {{ switchButtonText }}
            </button>
          </div>
        </div>
        <FloatingHelpButton />
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useAdminStore } from '@/stores/admin'
import { storeToRefs } from 'pinia'
import { useAdminPendingUsersSync } from '@/composables/useAdminPendingUsersSync'
import { canSwitchBookingSystem } from '@/utils/systemAccess'
import FloatingHelpButton from '@/components/FloatingHelpButton.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const adminStore = useAdminStore()
const { isAdmin, userInfo } = storeToRefs(userStore)
const { totalPendingCount } = storeToRefs(adminStore)

const showSwitchButton = computed(() => !isAdmin.value && canSwitchBookingSystem(userInfo.value))

/** 管理员任意页面/任意窗口均监听待审批同步（跨窗口更新顶栏与 Admin 侧栏角标） */
const { startSync: startAdminPendingSync, stopSync: stopAdminPendingSync } = useAdminPendingUsersSync()

watch(isAdmin, (isAdminUser) => {
  if (isAdminUser) startAdminPendingSync()
  else stopAdminPendingSync()
}, { immediate: true })

let pollingInterval = null
const headerRef = ref(null)
const headerLeftRef = ref(null)
const headerRightRef = ref(null)
const headerNavRef = ref(null)
const headerActionsRef = ref(null)
/** 仅当标题+导航真实放不下时才叠成两行（避免 0.86 缩放时过早换行） */
const headerStacked = ref(false)
let headerResizeObserver = null
let headerLayoutTimer = 0

const updateHeaderHeight = () => {
  const el = headerRef.value
  if (!el || typeof document === 'undefined') return
  document.documentElement.style.setProperty('--app-header-height', `${el.offsetHeight}px`)
}

async function syncHeaderLayout () {
  const header = headerRef.value
  const left = headerLeftRef.value
  const nav = headerNavRef.value
  const actions = headerActionsRef.value
  if (!header || !left || !nav || !actions) return

  const wasStacked = headerStacked.value
  // 先按单行测量自然宽度，再决定是否叠行
  headerStacked.value = false
  await nextTick()

  const style = getComputedStyle(header)
  const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
  const gap = parseFloat(style.columnGap || style.gap) || 0
  const rightGap = parseFloat(getComputedStyle(headerRightRef.value || header).columnGap || getComputedStyle(headerRightRef.value || header).gap) || 0
  const needWidth = left.scrollWidth + nav.scrollWidth + actions.scrollWidth + padX + gap + rightGap
  headerStacked.value = needWidth > header.clientWidth + 2

  await nextTick()
  updateHeaderHeight()
  if (wasStacked !== headerStacked.value) {
    await nextTick()
    updateHeaderHeight()
  }
}

function scheduleHeaderLayout () {
  window.clearTimeout(headerLayoutTimer)
  headerLayoutTimer = window.setTimeout(() => { void syncHeaderLayout() }, 40)
}

onMounted(() => {
  nextTick(() => {
    void syncHeaderLayout()
  })

  if (typeof ResizeObserver !== 'undefined' && headerRef.value) {
    headerResizeObserver = new ResizeObserver(() => {
      scheduleHeaderLayout()
    })
    headerResizeObserver.observe(headerRef.value)
  }
  window.addEventListener('resize', scheduleHeaderLayout, { passive: true })

  if (isAdmin.value) {
    const isOnAdminShell = () => route.path === '/admin' || route.path.startsWith('/admin/')
    if (!isOnAdminShell()) {
      adminStore.fetchPendingCounts()
      // 非 Admin 壳页：轻量轮询顶栏角标；Admin 壳页由 useAdminPendingUsersSync 统一轮询
      pollingInterval = setInterval(() => {
        if (!isOnAdminShell()) adminStore.fetchPendingCounts()
      }, 10000)
    }
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', scheduleHeaderLayout)
  window.clearTimeout(headerLayoutTimer)
  if (headerResizeObserver) {
    headerResizeObserver.disconnect()
    headerResizeObserver = null
  }
  if (pollingInterval) {
    clearInterval(pollingInterval)
  }
})

watch(
  [isAdmin, showSwitchButton, () => route.path, totalPendingCount],
  () => scheduleHeaderLayout()
)

const isActive = (path) => route.path === path

/** 所有 /admin 及子路径下均高亮 Admin */
const isAdminNavActive = computed(() => {
  const p = route.path
  return p === '/admin' || p.startsWith('/admin/')
})

const isVenuePage = computed(() => {
  if (route.path === '/Account') {
    const fromPath = sessionStorage.getItem('accountFromPath')
    if (fromPath) {
      return fromPath.includes('VenueBooking')
    }
  }
  return route.path.includes('VenueBooking')
})

const navSection = computed(() => {
  if (route.path === '/Account') {
    const fromPath = sessionStorage.getItem('accountFromPath')
    if (fromPath?.includes('/admin')) return 'admin'
    if (fromPath?.includes('VenueBooking')) return 'venue'
    return 'ev'
  }
  if (route.path.includes('/admin')) return 'admin'
  if (route.path.includes('VenueBooking')) return 'venue'
  return 'ev'
})

const calendarPath = computed(() =>
  isVenuePage.value ? '/VenueBooking/Calendar' : '/evBooking/Calendar'
)

const isCalendarNavActive = computed(() => {
  if (isAdmin.value) {
    return (
      route.path === '/VenueBooking/Calendar' ||
      route.path === '/evBooking/Calendar' ||
      route.path === '/evBooking'
    )
  }
  if (isVenuePage.value) {
    return route.path === '/VenueBooking/Calendar'
  }
  return route.path === '/evBooking' || route.path === '/evBooking/Calendar'
})

const isManageNavActive = computed(() => {
  if (isAdmin.value) {
    return route.path === '/VenueBooking/ManageBooking' || route.path === '/evBooking/ManageBooking'
  }
  return route.path === manageBookingPath.value
})

const headerTitle = computed(() => {
  if (route.path.includes('/admin')) {
    return 'TKOH GA Venue and EV Charging Booking System'
  }
  return isVenuePage.value ? 'TKOH Venue Booking' : 'TKOH EV Charging Booking'
})

const switchButtonText = computed(() => {
  return isVenuePage.value ? 'Switch EV Booking' : 'Switch Venue Booking'
})

const manageBookingPath = computed(() => {
  return isVenuePage.value ? '/VenueBooking/ManageBooking' : '/evBooking/ManageBooking'
})

const calendarNavLabel = computed(() => {
  if (isAdmin.value) return 'Calendar'
  if (navSection.value === 'ev' || navSection.value === 'venue') return 'Book Now'
  return 'Calendar'
})

const manageNavLabel = computed(() => {
  if (isAdmin.value) return 'Manage Booking'
  if (navSection.value === 'ev' || navSection.value === 'venue') return 'My Bookings'
  return 'Manage Booking'
})

const accountNavLabel = computed(() => {
  if (isAdmin.value) return 'My Account'
  if (navSection.value === 'ev' || navSection.value === 'venue') return 'My Account'
  return 'Account'
})

const handleSwitch = () => {
  if (isVenuePage.value) {
    router.push('/evBooking/Calendar')
  } else {
    router.push('/VenueBooking')
  }
}

const saveCurrentPath = () => {
  if (route.path !== '/Account') {
    sessionStorage.setItem('accountFromPath', route.path)
  }
}
</script>

<style scoped>
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 1.6rem;
  flex-wrap: nowrap;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: max-content;
}

.header-nav {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 1rem;
  white-space: nowrap;
  width: max-content;
  min-width: max-content;
}

.header-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-left: auto;
  min-width: 0;
  flex: 1 1 auto;
}

.header-nav-scroll {
  flex: 0 1 auto;
  min-width: 0;
  overflow: visible;
}

.header-logo {
  height: 32px;
  width: auto;
  object-fit: contain;
}

.header-title {
  margin: 0;
  color: #ffffff;
  font-weight: 700;
}

.header-link {
  font-weight: 700;
  color: #fff;
  background: transparent;
  padding: 0;
  border: 0;
  text-decoration: none;
  line-height: 1;
}

.header-link:hover {
  text-decoration: underline;
}

.header-link.is-active {
  text-decoration: underline;
}

.admin-link-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.admin-link {
  display: inline-block;
}

.admin-link:hover {
  text-decoration: underline;
}

.admin-link.is-active {
  text-decoration: underline;
}

.badge-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: #ef4444;
  color: #fff;
  font-size: 0.6875rem;
  font-weight: 700;
  border-radius: 9px;
  line-height: 1;
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
  animation: pulse-badge 2s ease-in-out infinite;
}

@keyframes pulse-badge {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.9;
  }
}

.nav-dropdown {
  position: relative;
  display: inline-block;
}

.dropdown-trigger {
  cursor: pointer;
  font-family: inherit;
  font-size: inherit;
  font-weight: 700;
  color: inherit;
}

.nav-dropdown:hover .dropdown-panel,
.dropdown-panel:hover {
  display: block;
}

.dropdown-panel {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  padding-top: 0.35rem;
  min-width: 148px;
  z-index: 1001;
}

.dropdown-panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 0.35rem;
}

.dropdown-panel-inner {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  background: #fff;
}

.dropdown-link {
  display: block;
  padding: 0.5rem 0.875rem;
  background: #fff;
  color: #0a3d1f;
  font-weight: 700;
  font-size: 0.875rem;
  text-decoration: none;
  border-bottom: 1px solid #e5e7eb;
}

.dropdown-link:last-child {
  border-bottom: none;
}

.dropdown-link:hover {
  background: #ecfdf5;
}

.dropdown-link.is-active-sub {
  background: #d1fae5;
  color: #065f46;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.header-actions :deep(.tips-root) {
  display: flex;
  align-items: center;
}

.header-actions :deep(.tips-button) {
  width: 28px;
  height: 28px;
}

.header-actions :deep(.tips-icon) {
  width: 28px;
  height: 28px;
}

.logout-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.logout-wrapper:hover .switch-dropdown,
.switch-dropdown:hover {
  display: block;
}

.switch-dropdown {
  display: none;
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0;
  z-index: 1000;
  padding-top: 0.5rem;
}

.logout-btn {
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
  border: none;
  color: #fff;
  font-weight: 700;
  font-size: 0.875rem;
  border-radius: 8px;
  padding: 0.375rem 0.75rem;
  min-height: 30px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(249, 115, 22, 0.3);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.logout-text {
  white-space: nowrap;
}

.logout-btn svg {
  width: 14px;
  height: 14px;
}

.logout-btn:hover {
  background: linear-gradient(135deg, #ea580c 0%, #dc2626 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4);
}

.logout-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(249, 115, 22, 0.3);
}

.switch-btn {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border: none;
  color: #fff;
  font-weight: 700;
  font-size: 0.875rem;
  border-radius: 8px;
  padding: 0.4rem 0.875rem;
  min-height: 32px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.switch-btn svg {
  width: 14px;
  height: 14px;
}

.switch-btn:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.switch-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
}

/* 内容实测放不下才叠成两行（不再用固定 1180 断点，避免 0.86 缩放后仍有空位却换行） */
.app-header.header-stacked {
  padding-inline: 0.9rem;
  flex-wrap: wrap;
  row-gap: 0.5rem;
}

.app-header.header-stacked h1 {
  font-size: 1rem;
}

.app-header.header-stacked .header-left {
  flex: 1 1 100%;
}

.app-header.header-stacked .header-right {
  width: 100%;
  flex: 1 1 100%;
  margin-left: 0;
  justify-content: flex-end;
  gap: 0.5rem;
}

.app-header.header-stacked .header-nav {
  gap: 0.625rem;
}

@media (max-width: 389px) {
  .app-header h1 {
    font-size: 1rem;
  }

  .header-logo {
    height: 24px;
  }

  .header-actions :deep(.tips-button),
  .header-actions :deep(.tips-icon) {
    width: 22px;
    height: 22px;
  }

  .header-right {
    gap: 0.4rem;
  }

  .header-nav { gap: 0.5rem; }
}

@media (min-width: 390px) and (max-width: 767px) {
  .app-header h1 {
    font-size: 1rem;
  }

  .header-logo {
    height: 24px;
  }

  .header-actions :deep(.tips-button),
  .header-actions :deep(.tips-icon) {
    width: 22px;
    height: 22px;
  }

  .header-right {
    gap: 0.45rem;
  }

  .header-nav { gap: 0.55rem; }
}
</style>
