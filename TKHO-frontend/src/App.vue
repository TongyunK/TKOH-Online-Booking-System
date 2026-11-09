<template>
  <div id="app">
    <router-view />
    <GlobalStatusDialog />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from './stores/user'
import { isPublicRoute } from './utils/publicRoutes'
import { useIdleAutoLogout } from './composables/useIdleAutoLogout'
import GlobalStatusDialog from './components/GlobalStatusDialog.vue'

const userStore = useUserStore()
const route = useRoute()

useIdleAutoLogout()

onMounted(async () => {
  userStore.initUserInfo()
  // 免登录页（登录/注册/大屏）不要带过期 token 调 /auth/me，否则会触发全局 401 并跳转登录
  if (isPublicRoute(route.path)) {
    return
  }
  await userStore.refreshSessionUser()
})
</script>

<style scoped>
#app {
  min-height: var(--zoom-vh);
  background-color: #f5f5f5;
}
</style>

<style>
:root {
  --app-header-height: 60px;
}

/* 自定义日期选择器样式 - 全局样式 */
.el-picker-panel {
  border: 1px solid #e5e7eb !important;
}

.el-date-picker__header-label {
  color: #374151 !important;
  font-weight: 600 !important;
}

.el-date-table td.today .el-date-table-cell__text {
  color: #0A3D1F !important;
  font-weight: 700 !important;
}

.el-date-table td.current:not(.disabled) .el-date-table-cell__text {
  background-color: #0A3D1F !important;
  color: white !important;
}

.el-date-table td.available:hover .el-date-table-cell__text {
  background-color: #d6f3c5 !important;
  color: #0A3D1F !important;
}

.el-picker-panel__icon-btn:hover {
  color: #0A3D1F !important;
}
</style>
