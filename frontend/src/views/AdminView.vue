<template>
  <div class="admin-view">
    <!-- Admin Header (V5: same style as frontend header) -->
    <header class="header">
      <div class="header-inner">
        <div class="header-left">
          <div class="header-title" style="font-size: 20px">{{ store.platformTitle }} - 管理后台</div>
        </div>
        <div class="header-actions">
          <div
            style="font-size:11px;color:rgba(255,255,255,0.7);padding:2px 10px;background:rgba(255,255,255,0.1);border-radius:10px"
          >
            {{ roleLabel }}
          </div>
          <div class="header-update">数据更新：{{ updateTimeText }}</div>
          <button
            class="btn btn-sm"
            style="background:rgba(255,255,255,0.15);color:white;font-size:12px;border:1px solid rgba(255,255,255,0.2)"
            @click="goFrontend"
          >
            ← 返回前台
          </button>
          <button
            class="btn btn-sm"
            style="background:rgba(255,255,255,0.15);color:white;font-size:12px;border:1px solid rgba(255,255,255,0.2)"
            @click="handleLogout"
          >
            退出登录
          </button>
        </div>
      </div>
    </header>

    <!-- Admin Container -->
    <div class="admin-container">
      <!-- Tab Navigation -->
      <nav class="admin-nav">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="admin-nav-item"
          :class="{ active: store.adminTab === tab.key }"
          @click="store.setAdminTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </nav>

      <!-- Panel Content -->
      <div id="admin-panel" class="admin-panel">
        <component :is="currentTabComponent" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/store/appStore'
import type { AdminTab } from '@/types'
import { formatDate } from '@/utils/helpers'

const store = useAppStore()
const router = useRouter()

const roleLabel = computed(() => {
  if (store.isMaster) return '主管理员'
  if (store.isSubAdmin) return `子管理员：${store.currentUser?.email || ''}`
  return '管理员'
})

const updateTimeText = computed(() => {
  return store.updateTime ? formatDate(store.updateTime) : formatDate(new Date().toISOString())
})

const allTabs: { key: AdminTab; label: string; masterOnly?: boolean }[] = [
  { key: 'experts', label: '专家管理' },
  { key: 'projects', label: '合作项目管理' },
  { key: 'ratings', label: '评分管理' },
  { key: 'dashboard', label: '数据看板' },
  { key: 'categories', label: '分类管理', masterOnly: true },
  { key: 'observation', label: '观察库' },
  { key: 'permissions', label: '权限管理', masterOnly: true },
  { key: 'settings', label: '系统设置', masterOnly: true },
  { key: 'users', label: '用户管理', masterOnly: true },
  { key: 'monthlyReport', label: '月度报告', masterOnly: true },
]

const tabs = computed(() => {
  if (store.isMaster) return allTabs
  return allTabs.filter(t => !t.masterOnly)
})

const visibleTabKeys = computed(() => tabs.value.map(t => t.key))

watch(visibleTabKeys, keys => {
  if (!keys.includes(store.adminTab)) {
    store.setAdminTab('experts')
  }
}, { immediate: true })

const tabComponentMap: Record<AdminTab, string> = {
  experts: 'ExpertsTab',
  projects: 'ProjectsTab',
  ratings: 'RatingsTab',
  sort: 'SortTab',
  dashboard: 'DashboardTab',
  categories: 'CategoriesTab',
  observation: 'ObservationTab',
  permissions: 'PermissionsTab',
  settings: 'SettingsTab',
  users: 'UsersTab',
  docs: 'DocsTab',
  monthlyReport: 'MonthlyReportTab',
}

const currentTabComponent = computed(() => {
  const name = tabComponentMap[store.adminTab]
  return defineAsyncComponent(() => import(`@/components/admin/${name}.vue`))
})

function goFrontend() {
  router.push('/')
}

function handleLogout() {
  store.logout()
  router.push('/')
}
</script>

<style scoped>
/* Keep minimal scoped styles; rely on global .header/.admin-container/.admin-nav/.admin-panel */
.admin-view {
  min-height: 100vh;
  background: var(--bg);
}
</style>
