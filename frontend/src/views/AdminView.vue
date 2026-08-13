<template>
  <div class="admin-view">
    <!-- Admin Header -->
    <header class="admin-header">
      <div class="admin-header-inner">
        <div class="admin-header-left">
          <h1>DACC·数智化赋能优质专家资源库 · 管理后台</h1>
          <span class="role-badge">{{ roleLabel }}</span>
        </div>
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
import { computed, defineAsyncComponent, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/store/appStore'
import type { AdminTab } from '@/types'

const store = useAppStore()
const router = useRouter()

const roleLabel = computed(() => {
  if (store.isMaster) return '主管理员'
  if (store.isSubAdmin) return `子管理员：${store.currentUser?.email || ''}`
  return '管理员'
})

const allTabs: { key: AdminTab; label: string; masterOnly?: boolean }[] = [
  { key: 'experts', label: '专家管理' },
  { key: 'projects', label: '合作项目' },
  { key: 'ratings', label: '评分管理' },
  { key: 'sort', label: '排序标签' },
  { key: 'dashboard', label: '数据看板' },
  { key: 'categories', label: '分类管理' },
  { key: 'observation', label: '观察库' },
  { key: 'permissions', label: '权限管理', masterOnly: true },
  { key: 'settings', label: '系统设置', masterOnly: true },
  { key: 'users', label: '用户管理', masterOnly: true },
  { key: 'docs', label: '文档', masterOnly: true },
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
.admin-view {
  min-height: 100vh;
  background: var(--bg);
}

.admin-header {
  background: linear-gradient(135deg, #1e3a5f 0%, #1a56db 50%, #2563eb 100%);
  border-bottom: none;
  box-shadow: 0 2px 12px rgba(30, 58, 95, 0.25);
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
  gap: 16px;
}

.admin-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.admin-header h1 {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.role-badge {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.9);
  padding: 2px 10px;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 10px;
  white-space: nowrap;
  flex-shrink: 0;
}

.admin-header-actions {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.admin-header-actions .btn {
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.25);
  transition: var(--transition);
}

.admin-header-actions .btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.28);
  border-color: rgba(255, 255, 255, 0.4);
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

@media (max-width: 640px) {
  .admin-header-inner {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 12px 16px;
  }
  .admin-header h1 {
    font-size: 16px;
  }
  .admin-header-actions {
    justify-content: flex-start;
  }
}
</style>
