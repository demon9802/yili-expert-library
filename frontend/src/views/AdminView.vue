<template>
  <div class="admin-view">
    <!-- Admin Header -->
    <header class="admin-header">
      <div class="admin-header-inner">
        <h1>管理后台</h1>
        <div class="admin-header-actions">
          <button class="btn btn-text" @click="goFrontend">返回前台</button>
          <button class="btn btn-text" @click="handleLogout">退出登录</button>
        </div>
      </div>
    </header>

    <!-- Tab Navigation -->
    <nav class="admin-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="admin-tab"
        :class="{ active: store.adminTab === tab.key }"
        @click="store.setAdminTab(tab.key)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <!-- Tab Content -->
    <main class="admin-content">
      <div class="admin-content-inner">
        <component :is="currentTabComponent" />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/store/appStore'
import type { AdminTab } from '@/types'

const store = useAppStore()
const router = useRouter()

const tabs: { key: AdminTab; label: string }[] = [
  { key: 'experts', label: '专家管理' },
  { key: 'projects', label: '合作项目' },
  { key: 'ratings', label: '评分管理' },
  { key: 'sort', label: '排序管理' },
  { key: 'dashboard', label: '数据看板' },
  { key: 'categories', label: '分类管理' },
  { key: 'observation', label: '观察库' },
  { key: 'permissions', label: '权限管理' },
  { key: 'settings', label: '系统设置' },
  { key: 'users', label: '用户管理' },
  { key: 'docs', label: '文档' },
  { key: 'monthlyReport', label: '月报' },
]

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
.admin-view {
  min-height: 100vh;
  background: var(--bg);
}

.admin-header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 100;
}

.admin-header-inner {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.admin-header h1 {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.admin-header-actions {
  display: flex;
  gap: 12px;
}

.admin-header-actions .btn {
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid transparent;
  transition: var(--transition);
}

.admin-header-actions .btn:hover {
  color: var(--primary);
  background: var(--primary-light);
  border-color: var(--primary-light);
}

.admin-tabs {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  gap: 4px;
  padding: 0 24px;
  overflow-x: auto;
  scrollbar-width: none;
}

.admin-tabs::-webkit-scrollbar {
  display: none;
}

.admin-tab {
  padding: 14px 18px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  transition: var(--transition);
}

.admin-tab:hover {
  color: var(--primary);
}

.admin-tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
  font-weight: 600;
}

.admin-content {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 24px;
}

.admin-content-inner {
  background: var(--surface);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  padding: 24px;
  box-shadow: var(--shadow-sm);
}
</style>
