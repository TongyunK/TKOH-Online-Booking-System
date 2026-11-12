<template>
  <div class="admin-dashboard">
    <section class="dashboard-hero">
      <div class="hero-text">
        <h2 class="hero-title">Administration</h2>
        <p class="hero-sub">
          Welcome to TKOH GA Venue and EV Charging Booking System — use the shortcuts below or the sidebar to manage venues, EV, users and approvals.
        </p>
      </div>
      <div class="clock-card" aria-live="polite">
        <div class="clock-date">{{ formattedDate }}</div>
        <div class="clock-time">{{ formattedTime }}</div>
        <div class="clock-zone">{{ timezoneLabel }}</div>
      </div>
    </section>

    <section class="dashboard-section">
      <h3 class="section-title">Management</h3>
      <div class="quick-grid">
        <RouterLink
          v-for="item in managementLinks"
          :key="item.path"
          :to="item.path"
          class="quick-card"
        >
          <div class="card-header">
            <font-awesome-icon :icon="['fas', item.icon]" class="quick-icon" />
            <span v-if="item.badge && item.badge > 0" class="card-badge">{{ item.badge > 99 ? '99+' : item.badge }}</span>
          </div>
          <span class="quick-label">{{ item.label }}</span>
        </RouterLink>
      </div>
    </section>

    <section class="dashboard-section">
      <h3 class="section-title">Booking preview</h3>
      <div class="quick-grid quick-grid--two">
        <RouterLink
          v-for="item in bookingLinks"
          :key="item.path"
          :to="item.path"
          class="quick-card quick-card--secondary"
        >
          <font-awesome-icon :icon="['fas', item.icon]" class="quick-icon" />
          <span class="quick-label">{{ item.label }}</span>
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAdminStore } from '@/stores/admin'
import { storeToRefs } from 'pinia'
import { APP_TIMEZONE } from '@/utils/appTimezone'

const adminStore = useAdminStore()
const { pendingBookingsCount, pendingUsersCount } = storeToRefs(adminStore)

const now = ref(new Date())
let timer = null

function tick() {
  now.value = new Date()
}

onMounted(() => {
  tick()
  timer = setInterval(tick, 1000)
  adminStore.fetchPendingCounts()
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const formattedDate = computed(() =>
  now.value.toLocaleDateString('en-GB', {
    timeZone: APP_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
)

const formattedTime = computed(() =>
  now.value.toLocaleTimeString('en-GB', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
)

const timezoneLabel = APP_TIMEZONE

const managementLinks = computed(() => [
  { path: '/admin/approval', label: 'Approval', icon: 'check-circle', badge: pendingBookingsCount.value },
  { path: '/admin/ev', label: 'EV', icon: 'car' },
  { path: '/admin/venue', label: 'Venue', icon: 'building' },
  { path: '/admin/user', label: 'User', icon: 'users', badge: pendingUsersCount.value },
  { path: '/admin/access-right', label: 'Access Right', icon: 'user-shield' },
  { path: '/admin/prompt', label: 'Templates', icon: 'message' }
])

const bookingLinks = [
  { path: '/VenueBooking/Calendar', label: 'Venue Calendar', icon: 'calendar' },
  { path: '/VenueBooking/ManageBooking', label: 'Manage Venue Booking', icon: 'clipboard-list' },
  { path: '/evBooking/Calendar', label: 'EV Calendar', icon: 'calendar-check' },
  { path: '/evBooking/ManageBooking', label: 'Manage EV Booking', icon: 'clipboard-list' }
]
</script>

<style scoped>
.admin-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0.75rem 1rem 1rem;
  min-height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
}

.dashboard-hero {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%);
  border-radius: 12px;
  border: 1px solid rgba(10, 61, 31, 0.1);
}

.hero-text {
  flex: 1;
  min-width: min(100%, 300px);
}

.hero-title {
  margin: 0 0 0.375rem;
  font-size: 1.5rem;
  font-weight: 800;
  color: #0a3d1f;
  letter-spacing: 0.01em;
}

.hero-sub {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #4b5563;
  max-width: 560px;
}

.clock-card {
  flex-shrink: 0;
  min-width: 200px;
  padding: 0.875rem 1.125rem;
  background: #ffffff;
  border: 1px solid rgba(10, 61, 31, 0.15);
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(10, 61, 31, 0.06);
}

.clock-date {
  font-size: 0.75rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.375rem;
}

.clock-time {
  font-size: 1.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #0a3d1f;
  letter-spacing: 0.03em;
  line-height: 1.2;
}

.clock-zone {
  margin-top: 0.375rem;
  font-size: 0.6875rem;
  color: #6b7280;
}

.dashboard-section {
  margin-bottom: 1.25rem;
}

.dashboard-section:last-child {
  margin-bottom: 0;
}

.section-title {
  margin: 0 0 0.625rem;
  font-size: 1rem;
  font-weight: 700;
  color: #111827;
}

.section-desc {
  margin: -0.125rem 0 0.625rem;
  font-size: 0.8125rem;
  color: #6b7280;
  line-height: 1.4;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

/* 2×2 布局，行宽与 Management 区域一致（同容器全宽） */
.quick-grid--two {
  grid-template-columns: repeat(2, 1fr);
}

.quick-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.375rem;
  padding: 0.875rem 1rem 0.75rem;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  text-decoration: none;
  color: inherit;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.15s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 0.5rem;
}

.card-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: #ef4444;
  color: #fff;
  font-size: 0.6875rem;
  font-weight: 700;
  border-radius: 10px;
  line-height: 1;
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.25);
}

.quick-card:hover {
  border-color: #00723a;
  box-shadow: 0 6px 20px rgba(0, 114, 58, 0.12);
  transform: translateY(-2px);
}

.quick-card--secondary {
  background: #fafafa;
  border-color: #e0e0e0;
}

.quick-card--secondary:hover {
  border-color: #00723a;
  background: #ffffff;
}

.quick-icon {
  font-size: 1.25rem;
  color: #00723a;
  margin-bottom: 0.125rem;
}

.quick-label {
  font-size: 0.875rem;
  font-weight: 700;
  color: #111827;
  line-height: 1.3;
}

.quick-hint {
  font-size: 0.6875rem;
  color: #6b7280;
  font-weight: 500;
  line-height: 1.3;
}

/* 响应式设计 */
@media (max-width: 767px) {
  .admin-dashboard {
    padding: 0.625rem 0.75rem 0.875rem;
  }

  .dashboard-hero {
    padding: 0.875rem 1rem;
    margin-bottom: 1rem;
    gap: 0.875rem;
  }

  .hero-title {
    font-size: 1.25rem;
  }

  .hero-sub {
    font-size: 0.8125rem;
  }

  .clock-card {
    width: 100%;
    min-width: unset;
    padding: 0.75rem 1rem;
  }

  .clock-time {
    font-size: 1.375rem;
  }

  .quick-grid {
    grid-template-columns: 1fr;
    gap: 0.625rem;
  }

  .quick-grid--two {
    grid-template-columns: 1fr;
  }

  .dashboard-section {
    margin-bottom: 1rem;
  }

  .quick-card {
    padding: 0.75rem 0.875rem 0.625rem;
  }
}

@media (min-width: 768px) and (max-width: 1099px) {
  .admin-dashboard {
    padding: 0.875rem 1rem 1rem;
  }

  .quick-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  }

  .quick-grid--two {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1100px) {
  .quick-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .quick-grid--two {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* 针对小屏幕高度优化 */
@media (max-height: 800px) {
  .admin-dashboard {
    padding: 0.5rem 1rem 0.75rem;
  }

  .dashboard-hero {
    padding: 0.75rem 1rem;
    margin-bottom: 0.875rem;
  }

  .hero-title {
    font-size: 1.375rem;
    margin-bottom: 0.25rem;
  }

  .hero-sub {
    font-size: 0.8125rem;
  }

  .clock-card {
    padding: 0.625rem 0.875rem;
  }

  .clock-time {
    font-size: 1.375rem;
  }

  .dashboard-section {
    margin-bottom: 0.875rem;
  }

  .section-title {
    margin-bottom: 0.5rem;
    font-size: 0.9375rem;
  }

  .section-desc {
    margin-bottom: 0.5rem;
  }

  .quick-card {
    padding: 0.625rem 0.75rem 0.5rem;
    gap: 0.25rem;
  }

  .quick-icon {
    font-size: 1.125rem;
  }

  .quick-label {
    font-size: 0.8125rem;
  }

  .quick-hint {
    font-size: 0.6875rem;
  }
}
</style>
