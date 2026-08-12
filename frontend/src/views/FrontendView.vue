<template>
  <div class="frontend-view">
    <!-- Header -->
    <header class="header">
      <div class="header-inner">
        <div class="header-left">
          <h1 class="header-title">伊利集团·数智化赋能优质专家资源库</h1>
          <p class="header-subtitle">汇聚行业精英，赋能数智化转型</p>
        </div>
        <div class="header-actions">
          <button v-if="!store.currentUser" class="btn btn-outline" @click="showLogin = true">
            管理员登录
          </button>
          <template v-if="store.isAdmin">
            <button class="btn btn-outline" @click="goAdmin">管理后台</button>
            <button class="btn btn-outline" @click="handleLogout">退出</button>
          </template>
        </div>
      </div>
    </header>

    <!-- Search & Filter Bar -->
    <div class="filter-section">
      <div class="filter-inner">
        <!-- Search -->
        <div class="search-box">
          <input
            v-model="store.searchQuery"
            type="text"
            placeholder="搜索专家姓名、领域、优势..."
            @input="onSearch"
            @focus="showHistory = true"
            @blur="hideHistoryDelayed"
          />
          <button v-if="store.searchQuery" class="search-clear" @click="clearSearch">×</button>
          <!-- Search History Dropdown -->
          <div v-if="showHistory && store.searchHistory.length > 0" class="search-history">
            <div
              v-for="item in store.searchHistory"
              :key="item"
              class="search-history-item"
              @mousedown="useHistory(item)"
            >
              {{ item }}
              <span class="remove" @mousedown.stop="store.removeSearchHistoryItem(item)">×</span>
            </div>
          </div>
        </div>

        <!-- Field Filter -->
        <FieldFilterBar />

        <!-- Sort & Filter Controls -->
        <div class="filter-controls">
          <select v-model="store.currentSort" class="sort-select">
            <option value="default">默认排序</option>
            <option value="score">评分最高</option>
            <option value="name">姓名排序</option>
            <option value="cooperation">合作最多</option>
          </select>

          <button
            class="filter-chip"
            :class="{ active: store.supplierFilter === true }"
            @click="toggleSupplier"
          >
            在库
          </button>
          <button
            class="filter-chip"
            :class="{ active: store.favoritesFilter === true }"
            @click="toggleFavorites"
          >
            收藏
          </button>
          <button
            class="filter-chip"
            :class="{ active: store.cooperationFilter === true }"
            @click="toggleCooperation"
          >
            已合作
          </button>
          <button
            v-if="hasActiveFilters"
            class="filter-chip clear"
            @click="store.clearFilters()"
          >
            清除筛选
          </button>
        </div>
      </div>
    </div>

    <!-- Expert Grid -->
    <main class="main-content">
      <div class="main-inner">
        <div v-if="store.loading" class="loading">加载中...</div>
        <div v-else-if="store.paginatedExperts.length === 0" class="empty-state">
          <p>暂无匹配的专家</p>
        </div>
        <div v-else class="expert-grid">
          <ExpertCard
            v-for="expert in store.paginatedExperts"
            :key="expert.id"
            :expert="expert"
            :is-favorite="store.isFavorited(expert.id)"
            @click="openDetail(expert)"
            @toggle-favorite="store.toggleFavorite(expert.id)"
          />
        </div>

        <!-- Pagination -->
        <PaginationControl
          v-if="store.totalPages > 1"
          :current-page="store.currentPage"
          :total-pages="store.totalPages"
          @change="onPageChange"
        />
      </div>
    </main>

    <!-- Login Modal -->
    <LoginModal v-if="showLogin" @close="showLogin = false" @success="onLoginSuccess" />

    <!-- Expert Detail Modal -->
    <ExpertDetailModal
      v-if="selectedExpert"
      :expert="selectedExpert"
      @close="selectedExpert = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/store/appStore'
import type { Expert } from '@/types'
import { debounce } from '@/utils/helpers'
import FieldFilterBar from '@/components/FieldFilterBar.vue'
import ExpertCard from '@/components/ExpertCard.vue'
import PaginationControl from '@/components/PaginationControl.vue'
import LoginModal from '@/components/LoginModal.vue'
import ExpertDetailModal from '@/components/ExpertDetailModal.vue'

const store = useAppStore()
const router = useRouter()

const showLogin = ref(false)
const showHistory = ref(false)
const selectedExpert = ref<Expert | null>(null)

const hasActiveFilters = computed(() =>
  store.fieldFilter.size > 0 ||
  store.scoreFilter !== null ||
  store.supplierFilter !== null ||
  store.favoritesFilter !== null ||
  store.cooperationFilter !== null ||
  store.searchQuery !== ''
)

const onSearch = debounce(() => {
  store.currentPage = 1
  if (store.searchQuery.trim()) {
    store.saveSearchHistory(store.searchQuery)
  }
}, 300)

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

function toggleSupplier() {
  store.supplierFilter = store.supplierFilter === true ? null : true
  store.currentPage = 1
}

function toggleFavorites() {
  store.favoritesFilter = store.favoritesFilter === true ? null : true
  store.currentPage = 1
}

function toggleCooperation() {
  store.cooperationFilter = store.cooperationFilter === true ? null : true
  store.currentPage = 1
}

function onPageChange(page: number) {
  store.currentPage = page
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function openDetail(expert: Expert) {
  selectedExpert.value = expert
}

function goAdmin() {
  router.push('/admin')
}

function handleLogout() {
  store.logout()
}

function onLoginSuccess() {
  showLogin.value = false
  if (store.isAdmin) {
    router.push('/admin')
  }
}
</script>
