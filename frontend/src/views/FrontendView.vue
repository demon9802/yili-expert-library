<template>
  <div class="frontend-view">
    <!-- Header -->
    <header class="header">
      <div class="header-inner">
        <div class="header-left">
          <div class="header-title">{{ store.platformTitle }}</div>
          <div class="header-subtitle"></div>
        </div>
        <div class="header-actions">
          <div class="header-update">数据更新：{{ updateTimeText }}</div>
          <button class="btn btn-sm" style="background:rgba(255,255,255,0.15);color:white;font-size:12px;border:1px solid rgba(255,255,255,0.2)" @click="showDashboard">
            📊 数据仪表盘
          </button>
          <button
            v-if="store.mobileAdaptation"
            class="btn btn-sm"
            style="background:rgba(255,255,255,0.15);color:white;font-size:12px;border:1px solid rgba(255,255,255,0.2)"
            @click="toggleMobileMode"
          >
            {{ isMobile ? '💻 桌面版' : '📱 手机版' }}
          </button>
          <button
            v-if="(!store.currentUser || !store.isAdmin) && !(store.testMode && store.testRole !== 'user')"
            class="btn btn-sm"
            style="background:rgba(255,255,255,0.15);color:white;font-size:12px;border:1px solid rgba(255,255,255,0.2)"
            @click="goAdminLogin"
          >
            管理后台
          </button>
          <template v-if="(store.currentUser && store.isAdmin) || (store.testMode && store.testRole !== 'user')">
            <button class="btn btn-sm" style="background:rgba(255,255,255,0.15);color:white;font-size:12px;border:1px solid rgba(255,255,255,0.2)" @click="goAdmin">
              管理后台
            </button>
            <button class="btn btn-sm" style="background:rgba(255,255,255,0.15);color:white;font-size:12px;border:1px solid rgba(255,255,255,0.2)" @click="handleLogout">
              退出后台
            </button>
          </template>
          <template v-else-if="store.currentUser">
            <button class="btn btn-sm" style="background:rgba(255,255,255,0.15);color:white;font-size:12px;border:1px solid rgba(255,255,255,0.2)" @click="handleLogout">
              退出登录
            </button>
          </template>
        </div>
      </div>
    </header>

    <!-- Stats Bar -->
    <div class="stats-bar">
      <div class="stat-card stat-chart-card" style="flex:1;min-width:400px;padding:16px 20px">
        <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:4px">
          <div style="display:flex;align-items:baseline;gap:10px">
            <span class="inline-chart-mini-title" style="font-size:13px">领域人数分布</span>
          </div>
          <span style="font-size:12px;color:var(--primary);background:var(--primary-light);padding:3px 12px;border-radius:12px;font-weight:600">共{{ activeExpertCount }}位专家</span>
        </div>
        <div id="main-field-chart-inline" style="width:100%">
          <FieldChartInline />
        </div>
      </div>
    </div>

    <!-- Search Bar -->
    <div class="search-bar">
      <div class="search-input-wrapper">
        <span class="search-icon">🔍</span>
        <input
          v-model="store.searchQuery"
          class="search-input"
          type="text"
          placeholder="搜索专家姓名或关键词（如：AI、产品、清华...）"
          @input="onSearch"
          @focus="onSearchFocus"
          @blur="hideHistoryDelayed"
        />
        <span
          v-if="store.searchQuery"
          class="search-inline-clear"
          @click="clearSearch"
        >×</span>
        <!-- Search History Dropdown -->
        <div v-if="showHistory && store.searchHistory.length > 0" class="search-history-dropdown">
          <div class="search-history-header">
            <span>搜索历史</span>
            <span class="search-history-clear-all" @click="store.clearSearchHistory()">清空</span>
          </div>
          <div
            v-for="item in store.searchHistory"
            :key="item"
            class="search-history-item"
            @mousedown="useHistory(item)"
          >
            <span class="search-history-text">{{ item }}</span>
            <span class="search-history-delete" @mousedown.stop="store.removeSearchHistoryItem(item)">×</span>
          </div>
        </div>
      </div>
      <button class="search-btn" @click="doSearch">搜索</button>
      <button v-if="store.searchQuery" class="search-clear-btn" @click="clearSearch">✕ 清除</button>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <div class="filter-group">
        <span class="filter-label">分值：</span>
        <div class="score-filters">
          <input
            v-model.number="scoreMin"
            type="number"
            min="0"
            max="5"
            step="0.1"
            placeholder="最低"
            class="score-input"
            @change="applyScoreRange"
          />
          <span class="score-range-sep">-</span>
          <input
            v-model.number="scoreMax"
            type="number"
            min="0"
            max="5"
            step="0.1"
            placeholder="最高"
            class="score-input"
            @change="applyScoreRange"
          />
          <button
            v-if="scoreFilterActive"
            class="score-btn"
            @click="clearScoreFilter"
          >
            清除
          </button>
        </div>
      </div>
      <div class="filter-group">
        <span class="filter-label">排序：</span>
        <select v-model="store.currentSort" class="filter-select" @change="store.currentPage = 1">
          <option v-for="opt in sortOptions" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
        </select>
        <span class="sort-hint">默认排序按照姓名字母排序，不区分排名先后</span>
      </div>
    </div>

    <!-- Field Filter Bar -->
    <FieldFilterBar />

    <!-- Merged Filter Bar -->
    <div class="filter-bar merged-bar-wrapper" style="margin-top:8px">
      <div id="supplier-filter-group" class="filter-group">
        <span class="filter-label">是否在库：</span>
        <div class="field-filters">
          <span
            v-for="item in supplierOptions"
            :key="String(item.value)"
            class="field-tag field-tag-all"
            :class="{ active: store.supplierFilter === item.value }"
            :style="activeSupplierStyle(item.value)"
            @click="setSupplierFilter(item.value)"
          >
            {{ item.label }}
          </span>
        </div>
      </div>
      <div id="coop-filter-group" class="filter-group">
        <span class="filter-label">合作经历：</span>
        <div class="field-filters">
          <span
            v-for="item in cooperationOptions"
            :key="String(item.value)"
            class="field-tag field-tag-all"
            :class="{ active: store.cooperationFilter === item.value }"
            :style="activeCooperationStyle(item.value)"
            @click="setCooperationFilter(item.value)"
          >
            {{ item.label }}
          </span>
        </div>
      </div>
      <div id="fav-filter-group" class="filter-group">
        <span class="filter-label">收藏：</span>
        <div class="field-filters">
          <span
            v-for="item in favoriteOptions"
            :key="String(item.value)"
            class="field-tag field-tag-all favourite-tag"
            :class="{ active: store.favoritesFilter === item.value }"
            :style="activeFavoriteStyle(item.value)"
            @click="setFavoritesFilter(item.value)"
          >
            {{ item.label }}
          </span>
        </div>
        <button v-if="!store.currentUser" class="fav-login-btn" style="font-size:12px;padding:4px 12px;background:#EEF2FF;color:#4F46E5;border:1px solid #C7D2FE;border-radius:6px;cursor:pointer;white-space:nowrap;margin-left:8px" @click="showUserLogin = true">
          🔐 登录同步
        </button>
        <span v-else style="font-size:12px;color:#059669;margin-left:8px;background:#ECFDF5;padding:4px 10px;border-radius:6px;border:1px solid #A7F3D0;white-space:nowrap;cursor:pointer" @click="handleLogout">
          ✅ {{ userName }}
        </span>
      </div>
    </div>

    <!-- Expert Count -->
    <div id="expert-count" class="expert-count-info" v-html="countInfoHtml"></div>

    <!-- Expert Grid -->
    <div id="expert-grid" class="expert-grid">
      <div v-if="store.loading" class="loading" style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-secondary)">加载中...</div>
      <ExpertCard
        v-for="expert in store.paginatedExperts"
        :key="expert.id"
        :expert="expert"
        :search-query="store.searchQuery"
        @click="openDetail(expert)"
      />
    </div>

    <!-- Floating page navigation (V5: appears when filters scroll out of view) -->
    <div
      v-if="store.totalPages > 1"
      class="page-navigation-float"
      :class="{ visible: showFloatingNav }"
    >
      <PaginationControl
        :current-page="store.currentPage"
        :total-pages="store.totalPages"
        @change="onPageChange"
      />
    </div>


    <!-- Expert Detail Modal -->
    <ExpertDetailModal
      v-if="selectedExpert"
      :expert="selectedExpert"
      @close="selectedExpert = null"
    />

    <!-- Dashboard Modal -->
    <DashboardModal v-if="showDashboardModal" @close="showDashboardModal = false" />

    <!-- User Login Modal -->
    <UserLoginModal v-if="showUserLogin" @close="showUserLogin = false" @success="onUserLoginSuccess" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/store/appStore'
import type { Expert } from '@/types'
import { debounce, formatDate } from '@/utils/helpers'
import FieldFilterBar from '@/components/FieldFilterBar.vue'
import ExpertCard from '@/components/ExpertCard.vue'
import PaginationControl from '@/components/PaginationControl.vue'
import ExpertDetailModal from '@/components/ExpertDetailModal.vue'
import DashboardModal from '@/components/DashboardModal.vue'
import UserLoginModal from '@/components/UserLoginModal.vue'
import FieldChartInline from '@/components/FieldChartInline.vue'

const store = useAppStore()
const router = useRouter()

const showHistory = ref(false)
const selectedExpert = ref<Expert | null>(null)
const isMobile = ref(false)

// 系统设置中的手机端适配开关：关闭后强制退出手机视图
watch(() => store.mobileAdaptation, enabled => {
  if (!enabled && isMobile.value) {
    isMobile.value = false
    document.body.classList.remove('mobile-mode')
  }
}, { immediate: true })

const showDashboardModal = ref(false)
const showUserLogin = ref(false)
const showFloatingNav = ref(false)

// V5: 浮动页码导航在顶部筛选栏滚出视口后显示
function updateFloatingNav() {
  const lastFilterBar = document.querySelector('.merged-bar-wrapper, .search-bar')
  if (lastFilterBar) {
    showFloatingNav.value = lastFilterBar.getBoundingClientRect().bottom < 0
  }
}

onMounted(() => {
  window.addEventListener('scroll', updateFloatingNav, { passive: true })
  updateFloatingNav()
})

onUnmounted(() => {
  window.removeEventListener('scroll', updateFloatingNav)
})

// 分值区间筛选（用户输入最低-最高，最多一位小数，空值表示半开放区间）
const scoreMin = ref<number | null>(store.scoreFilter.min)
const scoreMax = ref<number | null>(store.scoreFilter.max)

watch(() => store.scoreFilter, (f) => {
  scoreMin.value = f.min
  scoreMax.value = f.max
}, { deep: true })

const scoreFilterActive = computed(() => scoreMin.value != null || scoreMax.value != null)

function roundScoreInput(v: number | string | null): number | null {
  if (v == null || v === '') return null
  const n = Math.round(Number(v) * 10) / 10
  return Number.isFinite(n) ? n : null
}

function applyScoreRange() {
  store.scoreFilter = {
    min: roundScoreInput(scoreMin.value),
    max: roundScoreInput(scoreMax.value)
  }
  store.currentPage = 1
}

function clearScoreFilter() {
  scoreMin.value = null
  scoreMax.value = null
  store.scoreFilter = { min: null, max: null }
  store.currentPage = 1
}

// sortOptions 现在由管理后台的「排序标签」配置并持久化到 settingApi
const sortOptions = computed(() => store.sortOptions)

const supplierOptions = [
  { label: '全部', value: null },
  { label: '是', value: true },
  { label: '否', value: false }
]

const cooperationOptions = [
  { label: '全部', value: null },
  { label: '已合作', value: true },
  { label: '尚未合作', value: false }
]

const favoriteOptions = [
  { label: '全部', value: null },
  { label: '♥ 我的收藏', value: true }
]

const updateTimeText = computed(() => {
  // Use a static fallback; real update time should come from backend/settings
  return formatDate(new Date().toISOString())
})

const activeExpertCount = computed(() =>
  store.experts.filter(e => e.status !== 'eliminated' && (e.scores?.overall ?? 0) >= 3).length
)

const userName = computed(() => {
  return store.currentUser?.email || ''
})

const countInfoHtml = computed(() => {
  const total = store.filteredExperts.length
  const totalPages = store.totalPages
  const pageInfo = totalPages > 1 ? `（第 ${store.currentPage}/${totalPages} 页）` : ''
  const searchHint = store.searchQuery ? ` <span class="search-results-hint">（搜索："${store.searchQuery}"）</span>` : ''
  return `共 <span>${total}</span> 位专家${pageInfo}${searchHint}`
})

const onSearch = debounce(() => {
  store.currentPage = 1
  if (store.searchQuery.trim()) {
    store.saveSearchHistory(store.searchQuery)
  }
}, 350)

function doSearch() {
  store.currentPage = 1
  if (store.searchQuery.trim()) {
    store.saveSearchHistory(store.searchQuery)
  }
}

function onSearchFocus() {
  if (store.searchQuery) showHistory.value = true
}

function clearSearch() {
  store.searchQuery = ''
  store.currentPage = 1
}

function useHistory(query: string) {
  store.searchQuery = query
  store.currentPage = 1
  showHistory.value = false
}

function hideHistoryDelayed() {
  setTimeout(() => { showHistory.value = false }, 200)
}

function setSupplierFilter(v: boolean | null) {
  store.supplierFilter = store.supplierFilter === v ? null : v
  store.currentPage = 1
}

function setCooperationFilter(v: boolean | null) {
  store.cooperationFilter = store.cooperationFilter === v ? null : v
  store.currentPage = 1
}

function setFavoritesFilter(v: boolean | null) {
  store.favoritesFilter = store.favoritesFilter === v ? null : v
  store.currentPage = 1
}

function onPageChange(page: number) {
  store.currentPage = page
  const grid = document.getElementById('expert-grid')
  if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function activeSupplierStyle(v: boolean | null) {
  if (store.supplierFilter !== v) return {}
  if (v === true) return { background: '#dcfce7', borderColor: '#22c55e', color: '#166534' }
  if (v === false) return { background: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b' }
  return { background: '#475569', color: '#fff', borderColor: '#475569' }
}

function activeCooperationStyle(v: boolean | null) {
  if (store.cooperationFilter !== v) return {}
  if (v === true) return { background: '#dcfce7', borderColor: '#22c55e', color: '#166534' }
  if (v === false) return { background: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b' }
  return { background: '#475569', color: '#fff', borderColor: '#475569' }
}

function activeFavoriteStyle(v: boolean | null) {
  if (store.favoritesFilter !== v) return {}
  if (v === true) return { background: '#FEF3C7', borderColor: '#F59E0B', color: '#92400E' }
  return { background: '#475569', color: '#fff', borderColor: '#475569' }
}

function openDetail(expert: Expert) {
  selectedExpert.value = expert
}

function goAdmin() {
  router.push('/admin')
}

function goAdminLogin() {
  router.push('/admin-login')
}

function handleLogout() {
  store.logout()
}

function onUserLoginSuccess() {
  showUserLogin.value = false
  // Reload app data to sync favorites from backend
  store.loadAppData()
}

function showDashboard() {
  showDashboardModal.value = true
}

function toggleMobileMode() {
  isMobile.value = !isMobile.value
  document.body.classList.toggle('mobile-mode', isMobile.value)
}
</script>

<style scoped>
/* V5 原版：轻盈毛玻璃，固定在视口底部，出现/隐藏用 opacity + pointer-events 控制。
   按钮沿用 V5 实心描边质感（border + surface 背景 + 13px），并整体压缩高度。 */
.page-navigation-float {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 888;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(12px) saturate(1.2);
  -webkit-backdrop-filter: blur(12px) saturate(1.2);
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 -1px 8px rgba(0, 0, 0, 0.06);
  opacity: 0;
  transform: translateY(100%);
  transition: opacity 0.3s ease, transform 0.3s ease;
  pointer-events: none;
}
.page-navigation-float.visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
.page-navigation-float :deep(.page-navigation-inline) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
}
.page-navigation-float :deep(.page-nav-inline-btn) {
  padding: 0 8px;
  height: 24px;
  font-size: 11px;
  line-height: 24px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #ffffff;
  color: var(--primary);
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: all var(--transition);
}
.page-navigation-float :deep(.page-nav-inline-btn.disabled) {
  opacity: 0.45;
  cursor: not-allowed;
}
.page-navigation-float :deep(.page-nav-inline-num) {
  min-width: 24px;
  height: 24px;
  padding: 0 3px;
  font-size: 11px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #ffffff;
  color: var(--text-secondary);
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition);
}
.page-navigation-float :deep(.page-nav-inline-num.active) {
  background: var(--primary);
  border-color: var(--primary);
  color: #ffffff;
}
.page-navigation-float :deep(.page-nav-inline-info) {
  font-size: 11px;
  color: var(--text-muted);
  margin-left: 4px;
  white-space: nowrap;
}
@media (max-width: 480px) {
  .page-navigation-float {
    padding: 2px 6px;
  }
  .page-navigation-float :deep(.page-navigation-inline) {
    gap: 3px;
  }
  .page-navigation-float :deep(.page-nav-inline-btn),
  .page-navigation-float :deep(.page-nav-inline-num) {
    height: 22px;
    font-size: 10px;
    line-height: 22px;
  }
  .page-navigation-float :deep(.page-nav-inline-num) {
    min-width: 22px;
  }
  .page-navigation-float :deep(.page-nav-inline-btn) {
    padding: 0 6px;
  }
}
</style>
