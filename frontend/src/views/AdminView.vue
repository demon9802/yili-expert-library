<template>
  <div class="admin-view">
    <!-- Admin Header (V5: same style as frontend header) -->
    <header class="header">
      <div class="header-inner">
        <div class="header-left">
          <div class="header-title" style="font-size: 20px">{{ store.platformTitle }} - 管理后台</div>
        </div>
        <div class="header-actions admin-header-actions">
          <div class="admin-user-badge">
            <span>{{ roleTitle }}</span>
            <span v-if="userEmail" class="admin-user-email">{{ userEmail }}</span>
          </div>
          <div class="header-update">数据更新：{{ updateTimeText }}</div>
          <button
            class="btn btn-sm admin-header-btn"
            @click="goFrontend"
          >
            ← 返回前台
          </button>
          <button
            class="btn btn-sm admin-header-btn"
            @click="toggleMobileMode"
          >
            {{ isMobile ? '💻 桌面版' : '📱 手机版' }}
          </button>
          <button
            class="btn btn-sm admin-header-btn"
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
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/store/appStore'
import type { AdminTab } from '@/types'
import { formatDate } from '@/utils/helpers'

const store = useAppStore()
const router = useRouter()

const isMobile = ref(false)

const roleTitle = computed(() => {
  if (store.isMaster) return '主管理员'
  if (store.isSubAdmin) return '子管理员'
  return '管理员'
})

const userEmail = computed(() => store.currentUser?.email || '')

const updateTimeText = computed(() => {
  return store.updateTime ? formatDate(store.updateTime) : formatDate(new Date().toISOString())
})

const allTabs: { key: AdminTab; label: string; masterOnly?: boolean }[] = [
  { key: 'experts', label: '专家管理' },
  { key: 'projects', label: '合作项目管理' },
  { key: 'ratings', label: '评分管理' },
  { key: 'observation', label: '观察库' },
  { key: 'dashboard', label: '仪表盘' },
  { key: 'categories', label: '分类管理', masterOnly: true },
  { key: 'permissions', label: '权限管理', masterOnly: true },
  { key: 'users', label: '用户管理', masterOnly: true },
  { key: 'settings', label: '系统设置', masterOnly: true },
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

function toggleMobileMode() {
  isMobile.value = !isMobile.value
  document.body.classList.toggle('mobile-mode', isMobile.value)
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

.admin-header-actions {
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: thin;
}

.admin-user-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.9);
  padding: 3px 10px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 12px;
  white-space: nowrap;
}

.admin-user-email {
  color: rgba(255, 255, 255, 0.72);
}

.admin-header-btn {
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  font-size: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

@media (max-width: 768px) {
  .header-inner {
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 10px;
  }

  .header-left {
    width: 100%;
  }

  .admin-header-actions {
    width: 100%;
    padding-bottom: 2px;
  }
}
</style>
