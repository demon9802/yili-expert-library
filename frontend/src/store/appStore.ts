/**
 * 应用状态管理 (Pinia Store)
 * 替代原项目的全局 appState + getDB/saveDB
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Expert, Field, Project, User, AppData, AppMode, AdminTab } from '@/types'
import { appDataApi } from '@/api/appData'
import { expertApi } from '@/api/expert'
import { projectApi } from '@/api/project'
import { fieldApi } from '@/api/field'
import { favoriteApi } from '@/api/favorite'
import { authApi } from '@/api/auth'
import { setToken, removeToken, getToken } from '@/api/request'
import { lsGet, lsSet, lsRemove, debounce } from '@/utils/helpers'

const STORAGE_KEY = 'yili_expert_db'
const SEARCH_HISTORY_KEY = 'yili_search_history'
const MAX_SEARCH_HISTORY = 5

export const useAppStore = defineStore('app', () => {
  // ===== State =====
  const mode = ref<AppMode>('frontend')
  const currentUser = ref<User | null>(null)
  const isAdmin = ref(false)

  const experts = ref<Expert[]>([])
  const fields = ref<Field[]>([])
  const yiliProjects = ref<Project[]>([])
  const favorites = ref<number[]>([])

  // 筛选状态
  const currentSort = ref('default')
  const scoreFilter = ref<number | null>(null)
  const fieldFilter = ref<Set<string>>(new Set())
  const supplierFilter = ref<boolean | null>(null)
  const favoritesFilter = ref<boolean | null>(null)
  const cooperationFilter = ref<boolean | null>(null)
  const searchQuery = ref('')
  const adminSearchQuery = ref('')

  // 管理后台状态
  const adminTab = ref<AdminTab>('experts')
  const adminSubTab = ref('list')
  const editingExpert = ref<Expert | null>(null)
  const fieldsCollapsed = ref(false)

  // 分页
  const currentPage = ref(1)
  const PAGE_SIZE = ref(20)

  // 搜索历史
  const searchHistory = ref<string[]>(lsGet(SEARCH_HISTORY_KEY) || [])

  // 加载状态
  const loading = ref(false)

  // ===== Getters =====
  const filteredExperts = computed(() => {
    // 基础过滤：排除已淘汰专家（V5 getFilteredExperts 逻辑）
    let result = experts.value.filter(e => e.status !== 'eliminated')

    // 评分筛选：默认 >=7（V5 观察库阈值），有显式筛选时用显式值
    const minScore = scoreFilter.value !== null ? scoreFilter.value : 7
    result = result.filter(e => {
      const overall = e.scores?.overall
      if (overall === null || overall === undefined) return false
      return overall >= minScore
    })

    // 领域筛选（V5 使用 AND 逻辑：专家必须包含所有选中领域）
    if (fieldFilter.value.size > 0) {
      const selectedFields = Array.from(fieldFilter.value)
      result = result.filter(e =>
        selectedFields.every(f => e.fields?.includes(f))
      )
    }

    // 供应商筛选
    if (supplierFilter.value !== null) {
      result = result.filter(e => e.isSupplier === supplierFilter.value)
    }

    // 收藏筛选
    if (favoritesFilter.value === true) {
      result = result.filter(e => favorites.value.includes(e.id))
    }

    // 合作筛选
    if (cooperationFilter.value !== null) {
      const cooperatedIds = new Set(
        yiliProjects.value.map(p => p.expertId).filter(Boolean)
      )
      result = result.filter(e =>
        cooperationFilter.value ? cooperatedIds.has(e.id) : !cooperatedIds.has(e.id)
      )
    }

    // 搜索
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase()
      result = result.filter(e =>
        e.name?.toLowerCase().includes(q) ||
        e.fields?.some(f => f.toLowerCase().includes(q)) ||
        e.advantages?.some(a => {
          const text = typeof a === 'string' ? a : ((a as any).title || '') + ((a as any).desc || '')
          return text.toLowerCase().includes(q)
        }) ||
        e.education?.toLowerCase().includes(q) ||
        e.qualifications?.toLowerCase().includes(q)
      )
    }

    // 排序
    switch (currentSort.value) {
      case 'score':
        result.sort((a, b) => (b.scores?.overall || 0) - (a.scores?.overall || 0))
        break
      case 'name':
        result.sort((a, b) => a.name?.localeCompare(b.name || '') || 0)
        break
      case 'cooperation':
        result.sort((a, b) => {
          const aP = yiliProjects.value.filter(p => p.expertId === a.id).length
          const bP = yiliProjects.value.filter(p => p.expertId === b.id).length
          return bP - aP
        })
        break
      default:
        // default sort by sortOrder/id
        break
    }

    return result
  })

  const totalPages = computed(() =>
    Math.ceil(filteredExperts.value.length / PAGE_SIZE.value)
  )

  const paginatedExperts = computed(() => {
    const start = (currentPage.value - 1) * PAGE_SIZE.value
    return filteredExperts.value.slice(start, start + PAGE_SIZE.value)
  })

  // ===== Actions =====
  async function loadAppData() {
    loading.value = true
    try {
      const data: AppData = await appDataApi.loadAppData()
      experts.value = data.experts || []
      fields.value = data.fields || []
      yiliProjects.value = data.yiliProjects || []
      favorites.value = data.favorites || []

      // 缓存到 localStorage
      lsSet(STORAGE_KEY, {
        experts: experts.value,
        fields: fields.value,
        yiliProjects: yiliProjects.value,
        favorites: favorites.value,
      })
    } catch (e) {
      // 降级: 从 localStorage 加载缓存
      const cached = lsGet(STORAGE_KEY)
      if (cached) {
        experts.value = cached.experts || []
        fields.value = cached.fields || []
        yiliProjects.value = cached.yiliProjects || []
        favorites.value = cached.favorites || []
      } else if (window.EXPERT_DATA) {
        // 开发/无后端 fallback: 使用原始 data.js
        experts.value = window.EXPERT_DATA.experts || []
        fields.value = window.EXPERT_DATA.fields || []
        yiliProjects.value = window.EXPERT_DATA.yiliProjects || []
        favorites.value = window.EXPERT_DATA.favorites || []
      }
    } finally {
      loading.value = false
    }
  }

  async function checkAuthState() {
    const token = getToken()
    if (!token) {
      currentUser.value = null
      isAdmin.value = false
      return
    }
    try {
      // 验证 token 有效性 - 通过检查 force password change 接口
      const forceChange = await authApi.checkForcePasswordChange()
      // token 有效
    } catch {
      // token 无效
      removeToken()
      currentUser.value = null
      isAdmin.value = false
    }
  }

  async function login(email: string, password: string) {
    const result = await authApi.login(email, password)
    setToken(result.token)
    currentUser.value = result.user
    isAdmin.value = result.user.isAdmin || false
    return result
  }

  async function signUp(email: string, password: string) {
    const result = await authApi.signUp(email, password)
    setToken(result.token)
    currentUser.value = result.user
    isAdmin.value = false
    return result
  }

  function logout() {
    authApi.logout().catch(() => {})
    removeToken()
    currentUser.value = null
    isAdmin.value = false
    mode.value = 'frontend'
  }

  // ===== 专家 CRUD =====
  async function saveExpert(expert: Partial<Expert>) {
    if (expert.id) {
      const updated = await expertApi.update(expert.id, expert)
      const idx = experts.value.findIndex(e => e.id === expert.id)
      if (idx >= 0) experts.value[idx] = updated
      return updated
    } else {
      const created = await expertApi.create(expert)
      experts.value.push(created)
      return created
    }
  }

  async function deleteExpert(id: number) {
    await expertApi.delete(id)
    experts.value = experts.value.filter(e => e.id !== id)
  }

  // ===== 项目 CRUD =====
  async function saveProject(project: Partial<Project>) {
    if (project.id) {
      const updated = await projectApi.update(project.id, project)
      const idx = yiliProjects.value.findIndex(p => p.id === project.id)
      if (idx >= 0) yiliProjects.value[idx] = updated
      return updated
    } else {
      const created = await projectApi.create(project)
      yiliProjects.value.push(created)
      return created
    }
  }

  async function deleteProject(id: number) {
    await projectApi.delete(id)
    yiliProjects.value = yiliProjects.value.filter(p => p.id !== id)
  }

  // ===== 领域 CRUD =====
  async function saveField(field: Partial<Field>) {
    if (field.id) {
      await fieldApi.update(field.name!, field)
      const idx = fields.value.findIndex(f => f.name === field.name)
      if (idx >= 0) fields.value[idx] = { ...fields.value[idx], ...field } as Field
    } else {
      const created = await fieldApi.create(field)
      fields.value.push(created)
    }
  }

  async function deleteField(name: string) {
    await fieldApi.delete(name)
    fields.value = fields.value.filter(f => f.name !== name)
  }

  // ===== 收藏 =====
  async function toggleFavorite(expertId: number) {
    if (favorites.value.includes(expertId)) {
      await favoriteApi.removeFavorite(expertId)
      favorites.value = favorites.value.filter(id => id !== expertId)
    } else {
      await favoriteApi.addFavorite(expertId)
      favorites.value.push(expertId)
    }
  }

  function isFavorited(expertId: number): boolean {
    return favorites.value.includes(expertId)
  }

  // ===== 搜索历史 =====
  function saveSearchHistory(query: string) {
    if (!query?.trim()) return
    const q = query.trim()
    searchHistory.value = searchHistory.value.filter(h => h.toLowerCase() !== q.toLowerCase())
    searchHistory.value.unshift(q)
    if (searchHistory.value.length > MAX_SEARCH_HISTORY) {
      searchHistory.value = searchHistory.value.slice(0, MAX_SEARCH_HISTORY)
    }
    lsSet(SEARCH_HISTORY_KEY, searchHistory.value)
  }

  function removeSearchHistoryItem(query: string) {
    searchHistory.value = searchHistory.value.filter(h => h !== query)
    lsSet(SEARCH_HISTORY_KEY, searchHistory.value)
  }

  function clearSearchHistory() {
    searchHistory.value = []
    lsRemove(SEARCH_HISTORY_KEY)
  }

  // ===== 筛选操作 =====
  function toggleFieldFilter(fieldName: string) {
    if (fieldFilter.value.has(fieldName)) {
      fieldFilter.value.delete(fieldName)
    } else {
      fieldFilter.value.add(fieldName)
    }
    currentPage.value = 1
  }

  function clearFilters() {
    fieldFilter.value.clear()
    scoreFilter.value = null
    supplierFilter.value = null
    favoritesFilter.value = null
    cooperationFilter.value = null
    searchQuery.value = ''
    currentPage.value = 1
  }

  function setMode(m: AppMode) {
    mode.value = m
  }

  function setAdminTab(tab: AdminTab) {
    adminTab.value = tab
  }

  return {
    // State
    mode, currentUser, isAdmin,
    experts, fields, yiliProjects, favorites,
    currentSort, scoreFilter, fieldFilter, supplierFilter,
    favoritesFilter, cooperationFilter, searchQuery, adminSearchQuery,
    adminTab, adminSubTab, editingExpert, fieldsCollapsed,
    currentPage, PAGE_SIZE, searchHistory, loading,
    // Getters
    filteredExperts, totalPages, paginatedExperts,
    // Actions
    loadAppData, checkAuthState, login, signUp, logout,
    saveExpert, deleteExpert, saveProject, deleteProject,
    saveField, deleteField, toggleFavorite, isFavorited,
    saveSearchHistory, removeSearchHistoryItem, clearSearchHistory,
    toggleFieldFilter, clearFilters, setMode, setAdminTab,
  }
})
