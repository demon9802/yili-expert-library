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
import { settingApi } from '@/api/setting'
import { setToken, removeToken, getToken } from '@/api/request'
import { lsGet, lsSet, lsRemove, debounce, formatDateYMD, addMonthsToDateYMD } from '@/utils/helpers'
import { autoScoreExpert, OBSERVATION_THRESHOLD } from '@/utils/scoring'
import { observationApi } from '@/api/observation'

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
  const scoreFilter = ref<{ min: number | null; max: number | null }>({ min: null, max: null })
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

  // 前端评分展示开关（评分管理 → 前端展示控制）
  const showScores = ref<boolean>(true)

  // 排序选项（V5 管理后台可配置）
  const sortOptions = ref<{ id: string; name: string }[]>([
    { id: 'default', name: '默认排序' },
    { id: 'overall', name: '按综合评分' },
    { id: 'professional', name: '按专业度' },
    { id: 'influence', name: '按影响力' }
  ])

  // 平台名称（系统设置 → 主标题，驱动前台/后台标题与 document.title）
  const platformTitle = ref<string>('DACC·数智化赋能优质专家资源库')

  // 配色方案（系统设置 → 配色方案，运行时改写根 CSS 变量）
  const colorScheme = ref<string>('default')

  // 应用描述（系统设置）
  const appDescription = ref<string>('')

  // 数据更新时间（系统设置 → 数据更新时间）
  const updateTime = ref<string>('')

  // 配色方案预设（运行时改写 --primary / --primary-light / --primary-dark）
  const COLOR_SCHEMES: Record<string, { name: string; primary: string; light: string; dark: string }> = {
    default: { name: '默认蓝', primary: '#1a56db', light: '#e8f0fe', dark: '#1e40af' },
    teal: { name: '青绿', primary: '#0d9488', light: '#ccfbf1', dark: '#0f766e' },
    purple: { name: '紫', primary: '#7c3aed', light: '#ede9fe', dark: '#6d28d9' },
    rose: { name: '玫红', primary: '#e11d48', light: '#ffe4e6', dark: '#be123c' },
    amber: { name: '琥珀', primary: '#d97706', light: '#fef3c7', dark: '#b45309' },
  }

  // ===== Getters =====
  const filteredExperts = computed(() => {
    // 基础过滤：排除已淘汰专家（V5 getFilteredExperts 逻辑）
    let result = experts.value.filter(e => e.status !== 'eliminated')

    // 评分筛选：基础规则排除 <3★（观察库阈值，<3★ 专家不展示），再通过 min/max 区间做前端自定义筛选
    result = result.filter(e => {
      const overall = e.scores?.overall
      if (overall === null || overall === undefined) return false
      if (overall < OBSERVATION_THRESHOLD) return false
      if (scoreFilter.value.min != null && overall < scoreFilter.value.min) return false
      if (scoreFilter.value.max != null && overall > scoreFilter.value.max) return false
      return true
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

    // 排序（V5 默认排序/按综合评分/按专业度/按影响力）
    switch (currentSort.value) {
      case 'overall':
        result.sort((a, b) => (b.scores?.overall || 0) - (a.scores?.overall || 0))
        break
      case 'professional':
        result.sort((a, b) => (b.scores?.professional || 0) - (a.scores?.professional || 0))
        break
      case 'influence':
        result.sort((a, b) => (b.scores?.influence || 0) - (a.scores?.influence || 0))
        break
      default:
        // V5 默认排序：按姓名首字母排序（不区分排名先后）
        result.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-CN'))
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

    // 加载评分前端展示开关（失败不阻断主流程）
    try {
      const v = await settingApi.get('showScores')
      if (v != null) showScores.value = v !== 'false'
    } catch {
      /* 忽略 */
    }

    // 加载排序选项配置（失败使用默认值）
    try {
      const v = await settingApi.get('sortOptions')
      if (v) {
        const parsed = JSON.parse(v)
        if (Array.isArray(parsed) && parsed.length > 0) {
          sortOptions.value = parsed
        }
      }
    } catch {
      /* 忽略 */
    }

    // 加载平台名称/配色/描述/更新时间（系统设置）
    try {
      const [title, scheme, desc, ut] = await Promise.all([
        settingApi.get('mainTitle'),
        settingApi.get('colorScheme'),
        settingApi.get('description'),
        settingApi.get('updateTime'),
      ])
      if (title) platformTitle.value = title
      if (scheme) colorScheme.value = scheme
      if (desc) appDescription.value = desc
      if (ut) updateTime.value = ut
      applyColorScheme(colorScheme.value)
      updateDocumentTitle()
    } catch {
      /* 忽略 */
    }
  }

  async function setShowScores(v: boolean) {
    showScores.value = v
    try {
      await settingApi.save('showScores', v ? 'true' : 'false')
    } catch {
      /* 忽略 */
    }
  }

  async function saveSortOptions(options: { id: string; name: string }[]) {
    sortOptions.value = options
    try {
      await settingApi.save('sortOptions', JSON.stringify(options))
    } catch {
      /* 忽略 */
    }
  }

  // ===== 系统设置 =====
  function applyColorScheme(key: string) {
    const scheme = COLOR_SCHEMES[key] || COLOR_SCHEMES.default
    const root = document.documentElement
    root.style.setProperty('--primary', scheme.primary)
    root.style.setProperty('--primary-light', scheme.light)
    root.style.setProperty('--primary-dark', scheme.dark)
  }

  function updateDocumentTitle() {
    document.title = platformTitle.value || 'DACC·数智化赋能优质专家资源库'
  }

  async function setPlatformTitle(title: string) {
    const t = title.trim()
    if (!t) return
    platformTitle.value = t
    updateDocumentTitle()
    try {
      await settingApi.save('mainTitle', t)
    } catch {
      /* 忽略 */
    }
  }

  async function setColorScheme(key: string) {
    colorScheme.value = key
    applyColorScheme(key)
    try {
      await settingApi.save('colorScheme', key)
    } catch {
      /* 忽略 */
    }
  }

  async function setAppDescription(desc: string) {
    appDescription.value = desc
    try {
      await settingApi.save('description', desc)
    } catch {
      /* 忽略 */
    }
  }

  async function refreshUpdateTime() {
    const now = new Date().toISOString()
    updateTime.value = now
    try {
      await settingApi.save('updateTime', now)
    } catch {
      /* 忽略 */
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
      // 用一个受保护接口校验 token；优先从本地缓存恢复登录身份，避免刷新后只剩 token 无用户态
      await authApi.checkForcePasswordChange()
      const cached = lsGet('yili_current_user')
      if (cached) {
        currentUser.value = cached
        isAdmin.value = !!cached.isAdmin
      }
    } catch {
      // token 无效
      removeToken()
      lsRemove('yili_current_user')
      currentUser.value = null
      isAdmin.value = false
    }
  }

  async function login(email: string, password: string) {
    const result = await authApi.login(email, password)
    setToken(result.token)
    currentUser.value = result.user
    isAdmin.value = result.user.isAdmin || false
    lsSet('yili_current_user', result.user)
    return result
  }

  const isMaster = computed(() => isAdmin.value && currentUser.value?.role === 'master')
  const isSubAdmin = computed(() => isAdmin.value && currentUser.value?.role === 'sub')

  async function signUp(email: string, password: string) {
    const result = await authApi.signUp(email, password)
    setToken(result.token)
    currentUser.value = result.user
    isAdmin.value = false
    lsSet('yili_current_user', result.user)
    return result
  }

  function logout() {
    authApi.logout().catch(() => {})
    removeToken()
    lsRemove('yili_current_user')
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

  // ===== 观察库操作记录 =====
  // 记录一次观察库操作（移入/淘汰/延期/调分等），后端不可用时静默失败不影响主操作。
  async function recordObservationOperation(payload: {
    expertId: number
    expertName: string
    operation: string
    before: Record<string, any>
    after: Record<string, any>
    note: string
    tags?: string[]
  }) {
    const user = currentUser.value
    try {
      await observationApi.create({
        expertId: payload.expertId,
        expertName: payload.expertName,
        operation: payload.operation,
        operatorId: user ? String(user.id) : 'system',
        operatorName: user?.email || 'system',
        operatorRole: user?.role || 'unknown',
        beforeState: JSON.stringify(payload.before ?? {}),
        afterState: JSON.stringify(payload.after ?? {}),
        note: payload.note || '',
        tags: payload.tags || [],
        createdAt: new Date().toISOString(),
      } as any)
    } catch (e) {
      console.warn('记录观察库操作失败（不影响主操作）', e)
    }
  }

  // 依据综合分计算专家展示状态（动态流动）。已淘汰的不覆盖。
  // 返回 status / obsStatus（调高至合格分时 obsStatus=null 表示退出观察库）/ enteringObservation（是否新进入观察）。
  function statusFromScores(overall: number, currentStatus: string, currentObsStatus: string | null) {
    if (currentStatus === 'eliminated') {
      return { status: 'eliminated' as string, obsStatus: currentObsStatus, enteringObservation: false }
    }
    if (overall >= OBSERVATION_THRESHOLD) {
      // 合格：退出观察库
      return { status: 'active' as string, obsStatus: null, enteringObservation: false }
    }
    const wasObserving = currentStatus === 'observation' || !!currentObsStatus
    return {
      status: 'observation' as string,
      obsStatus: wasObserving ? (currentObsStatus || 'evaluating') : 'evaluating',
      enteringObservation: !wasObserving,
    }
  }

  // 把状态结论合并进更新 payload
  function applyStatusPayload(
    payload: Partial<Expert>,
    overall: number,
    currentStatus: string,
    currentObsStatus: string | null
  ) {
    if (currentStatus === 'eliminated') return
    const { status, obsStatus, enteringObservation } = statusFromScores(overall, currentStatus, currentObsStatus)
    payload.status = status
    payload.observationStatus = obsStatus
    if (enteringObservation) {
      const entry = formatDateYMD(new Date())
      payload.observationDate = entry
      payload.scores = { ...((payload.scores as any) || {}), observationDeadline: addMonthsToDateYMD(entry, 6) }
    }
  }

  // ===== 自动评分 =====
  async function autoScoreExpertById(id: number) {
    const idx = experts.value.findIndex(e => e.id === id)
    if (idx < 0) return null
    const result = autoScoreExpert(experts.value[idx], yiliProjects.value)
    const payload: Partial<Expert> = {
      scores: {
        ...(experts.value[idx].scores || {}),
        professional: result.professional,
        influence: result.influence,
        overall: result.overall,
        subScores: {
          professional: result.professionalItems,
          influence: result.influenceItems,
        },
      },
    }
    applyStatusPayload(payload, result.overall, experts.value[idx].status, experts.value[idx].observationStatus)
    const updated = await expertApi.update(id, payload)
    experts.value[idx] = updated
    return result
  }

  async function autoScoreAllExperts(): Promise<number> {
    let count = 0
    for (const e of experts.value) {
      if (e.status === 'eliminated') continue
      const result = autoScoreExpert(e, yiliProjects.value)
      const payload: Partial<Expert> = {
        scores: {
          ...(e.scores || {}),
          professional: result.professional,
          influence: result.influence,
          overall: result.overall,
          subScores: {
            professional: result.professionalItems,
            influence: result.influenceItems,
          },
        },
      }
      applyStatusPayload(payload, result.overall, e.status, e.observationStatus)
      const updated = await expertApi.update(e.id, payload)
      const idx = experts.value.findIndex(x => x.id === e.id)
      if (idx >= 0) experts.value[idx] = updated
      count += 1
    }
    return count
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
  // field 可携带 _oldName 表示改名（对齐 V5：改名级联专家、删除清理专家引用）
  async function saveField(field: Partial<Field> & { _oldName?: string }) {
    const oldName = field._oldName
    const keyName = oldName ?? field.name!
    if (field.id) {
      await fieldApi.update(keyName, field)
      const idx = fields.value.findIndex(f => f.name === keyName)
      if (idx >= 0) fields.value[idx] = { ...fields.value[idx], ...field } as Field
    } else {
      const created = await fieldApi.create(field)
      fields.value.push(created)
    }
    // 改名后同步本地专家缓存（后端已级联 DB，前端缓存保持一致避免脏筛选）
    if (oldName && field.name && oldName !== field.name) {
      experts.value = experts.value.map(e => ({
        ...e,
        fields: (e.fields || []).map(f => (f === oldName ? field.name! : f)),
      }))
    }
  }

  async function deleteField(name: string) {
    await fieldApi.delete(name)
    fields.value = fields.value.filter(f => f.name !== name)
    // 同步清理本地专家身上的领域引用（后端已级联 DB）
    experts.value = experts.value.map(e => ({
      ...e,
      fields: (e.fields || []).filter(f => f !== name),
    }))
  }

  // ===== 收藏 =====
  async function toggleFavorite(expertId: number) {
    const isFav = favorites.value.includes(expertId)
    if (isFav) {
      favorites.value = favorites.value.filter(id => id !== expertId)
    } else {
      favorites.value.push(expertId)
    }
    // 如果已登录，同步到后端；否则仅存 localStorage
    if (currentUser.value) {
      try {
        if (isFav) {
          await favoriteApi.removeFavorite(expertId)
        } else {
          await favoriteApi.addFavorite(expertId)
        }
      } catch {
        // 后端同步失败，回滚本地状态
        if (isFav) {
          favorites.value.push(expertId)
        } else {
          favorites.value = favorites.value.filter(id => id !== expertId)
        }
      }
    }
    // 持久化到 localStorage（无论是否登录）
    lsSet(STORAGE_KEY, {
      experts: experts.value,
      fields: fields.value,
      yiliProjects: yiliProjects.value,
      favorites: favorites.value,
    })
  }

  function isFavorited(expertId: number): boolean {
    return favorites.value.includes(expertId)
  }

  // 本地持久化（后端不可用时降级，保证导入/编辑在离线时也能落地到 localStorage）
  function persistLocal() {
    lsSet(STORAGE_KEY, {
      experts: experts.value,
      fields: fields.value,
      yiliProjects: yiliProjects.value,
      favorites: favorites.value,
    })
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
    scoreFilter.value = { min: null, max: null }
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
    currentPage, PAGE_SIZE, searchHistory, loading, showScores, sortOptions,
    platformTitle, colorScheme, appDescription, updateTime, COLOR_SCHEMES,
    // Getters
    filteredExperts, totalPages, paginatedExperts, isMaster, isSubAdmin,
    // Actions
    loadAppData, checkAuthState, login, signUp, logout,
    saveExpert, deleteExpert, autoScoreExpertById, autoScoreAllExperts, recordObservationOperation,
    saveProject, deleteProject,
    saveField, deleteField, toggleFavorite, isFavorited, setShowScores, saveSortOptions,
    setPlatformTitle, setColorScheme, setAppDescription, refreshUpdateTime, applyColorScheme,
    saveSearchHistory, removeSearchHistoryItem, clearSearchHistory,
    toggleFieldFilter, clearFilters, setMode, setAdminTab, persistLocal,
  }
})
