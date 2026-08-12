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
