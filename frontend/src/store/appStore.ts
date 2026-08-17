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

const SEARCH_HISTORY_KEY = 'yili_search_history'
const MAX_SEARCH_HISTORY = 5
// 未登录用户的本地收藏键（无后端身份，仅作浏览器本地偏好，不属于业务数据集）
const FAV_LOCAL_KEY = 'yili_favorites_local'

// 测试模式：独立数据空间（本地快照），用于模拟不同角色视角，不影响正式数据
const TEST_MODE_KEY = 'yili_test_mode'
const TEST_ROLE_KEY = 'yili_test_role'
const TEST_DB_KEY = 'yili_test_db'

export const useAppStore = defineStore('app', () => {
  // ===== State =====
  const mode = ref<AppMode>('frontend')
  const currentUser = ref<User | null>(null)
  // authIsAdmin 仅反映真实登录态；对外暴露的 isAdmin 在测试模式下会按测试角色覆盖
  const authIsAdmin = ref(false)

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

  // 数据加载失败（后端不可用）标记：绝不回退到本地静态数据，仅用于前端提示
  const dataError = ref(false)

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

  // 手机端适配开关（系统设置 → 手机端视图）
  const mobileAdaptation = ref<boolean>(true)

  // 测试模式（独立数据空间模拟不同角色视角）
  // 初始值从 localStorage 恢复，避免刷新后丢失测试态
  const testMode = ref<boolean>(lsGet(TEST_MODE_KEY) === true)
  const testRole = ref<'master' | 'sub' | 'user'>(
    (lsGet(TEST_ROLE_KEY) as 'master' | 'sub' | 'user') || 'master'
  )

  // 配色方案预设（运行时改写 --primary / --primary-light / --primary-dark）
  const COLOR_SCHEMES: Record<string, { name: string; primary: string; light: string; dark: string }> = {
    default: { name: '默认蓝', primary: '#1a56db', light: '#e8f0fe', dark: '#1e40af' },
    teal: { name: '翡翠绿', primary: '#0d9488', light: '#ccfbf1', dark: '#0f766e' },
    purple: { name: '深邃紫', primary: '#7c3aed', light: '#ede9fe', dark: '#6d28d9' },
    amber: { name: '琥珀金', primary: '#d97706', light: '#fef3c7', dark: '#b45309' },
    dark: { name: '暗夜黑', primary: '#334155', light: '#f1f5f9', dark: '#0f172a' },
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
    dataError.value = false
    try {
      // 唯一数据源：后端 /api/app-data（数据库）
      const data: AppData = await appDataApi.loadAppData()
      experts.value = data.experts || []
      fields.value = data.fields || []
      yiliProjects.value = data.yiliProjects || []
      favorites.value = data.favorites || []
      // 未登录用户：合并浏览器本地收藏（无后端身份，仅本地偏好）
      if (!currentUser.value) {
        const localFav = lsGet(FAV_LOCAL_KEY)
        if (Array.isArray(localFav)) favorites.value = localFav
      }
    } catch (e) {
      // 后端不可用：不回退任何本地静态数据，避免展示过时/伪造数据集
      console.error('[appStore] 加载应用数据失败，数据须来自后端', e)
      dataError.value = true
      experts.value = []
      fields.value = []
      yiliProjects.value = []
      favorites.value = []
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

    // 加载手机端适配开关（系统设置）
    try {
      const v = await settingApi.get('mobileAdaptation')
      if (v != null) mobileAdaptation.value = v !== 'false'
    } catch {
      /* 忽略 */
    }

    // 系统更新时间兜底：设置表中没有记录时，取数据最新更新时间，避免永久显示"尚未设置"
    if (!updateTime.value) {
      const latest = deriveUpdateTimeFromData()
      if (latest) {
        updateTime.value = latest
        try {
          settingApi.save('updateTime', latest)
        } catch {
          /* 忽略 */
        }
      }
    }
  }

  async function setShowScores(v: boolean) {
    showScores.value = v
    if (testMode.value) return
    try {
      await settingApi.save('showScores', v ? 'true' : 'false')
    } catch {
      /* 忽略 */
    }
  }

  async function saveSortOptions(options: { id: string; name: string }[]) {
    sortOptions.value = options
    if (testMode.value) return
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
    if (testMode.value) return
    try {
      await settingApi.save('mainTitle', t)
    } catch {
      /* 忽略 */
    }
  }

  async function setColorScheme(key: string) {
    colorScheme.value = key
    applyColorScheme(key)
    if (testMode.value) return
    try {
      await settingApi.save('colorScheme', key)
    } catch {
      /* 忽略 */
    }
  }

  async function setAppDescription(desc: string) {
    appDescription.value = desc
    if (testMode.value) return
    try {
      await settingApi.save('description', desc)
    } catch {
      /* 忽略 */
    }
  }

  async function refreshUpdateTime() {
    const now = new Date().toISOString()
    updateTime.value = now
    if (testMode.value) return
    try {
      await settingApi.save('updateTime', now)
    } catch {
      /* 忽略 */
    }
  }

  // 从现有数据中推导最新的更新时间，作为系统更新时间的兜底值
  function deriveUpdateTimeFromData(): string | null {
    let latest = ''
    const items: any[] = [...experts.value, ...yiliProjects.value]
    items.forEach(item => {
      const t = item?.updatedAt || item?.createdAt
      if (t && (!latest || t > latest)) latest = t
    })
    return latest || null
  }

  async function setMobileAdaptation(enabled: boolean) {
    mobileAdaptation.value = enabled
    if (testMode.value) return
    try {
      await settingApi.save('mobileAdaptation', enabled ? 'true' : 'false')
    } catch {
      /* 忽略 */
    }
  }

  // ===== 测试模式（独立数据空间，模拟 master/sub/user 三种角色视角）=====
  // 设计：进入时把当前生产数据快照到独立 localStorage 空间；测试态内的所有写操作
  // 仅作用于本地响应式数据 + 该独立空间，绝不调用后端，从而不会污染正式库。
  // 退出时重新从生产库加载，丢弃测试态的任何本地修改。

  function persistTest() {
    lsSet(TEST_DB_KEY, {
      experts: experts.value,
      fields: fields.value,
      yiliProjects: yiliProjects.value,
      favorites: favorites.value,
    })
  }

  async function enterTestMode(role: 'master' | 'sub' | 'user' = 'master') {
    // 先快照当前生产数据（深拷贝，避免后续本地修改影响快照本身）
    const snapshot = {
      experts: JSON.parse(JSON.stringify(experts.value)),
      fields: JSON.parse(JSON.stringify(fields.value)),
      yiliProjects: JSON.parse(JSON.stringify(yiliProjects.value)),
      favorites: JSON.parse(JSON.stringify(favorites.value)),
    }
    lsSet(TEST_DB_KEY, snapshot)
    testRole.value = role
    testMode.value = true
    lsSet(TEST_MODE_KEY, true)
    lsSet(TEST_ROLE_KEY, role)
  }

  async function exitTestMode() {
    testMode.value = false
    testRole.value = 'master'
    lsRemove(TEST_MODE_KEY)
    lsRemove(TEST_ROLE_KEY)
    lsRemove(TEST_DB_KEY)
    // 重新从生产库加载，丢弃测试态的任何本地修改，保证正式数据纯净
    await loadAppData()
  }

  function switchTestRole(role: 'master' | 'sub' | 'user') {
    testRole.value = role
    lsSet(TEST_ROLE_KEY, role)
  }

  async function checkAuthState() {
    const token = getToken()
    if (!token) {
      currentUser.value = null
      authIsAdmin.value = false
      return
    }
    try {
      // 用一个受保护接口校验 token；优先从本地缓存恢复登录身份，避免刷新后只剩 token 无用户态
      await authApi.checkForcePasswordChange()
      const cached = lsGet('yili_current_user')
      if (cached) {
        currentUser.value = cached
        authIsAdmin.value = !!cached.isAdmin
      }
    } catch {
      // token 无效
      removeToken()
      lsRemove('yili_current_user')
      currentUser.value = null
      authIsAdmin.value = false
    }
  }

  async function login(email: string, password: string) {
    const result = await authApi.login(email, password)
    setToken(result.token)
    currentUser.value = result.user
    authIsAdmin.value = result.user.isAdmin || false
    lsSet('yili_current_user', result.user)
    // 管理员登录后立即重新加载完整项目列表，避免公开态只读列表（visible only）污染后台
    if (authIsAdmin.value) {
      await reloadProjects()
    }
    return result
  }

  // 对外暴露的 isAdmin：真实登录态优先；测试模式下按测试角色覆盖（user=无后台权限）
  const isAdmin = computed(() => {
    if (testMode.value) return testRole.value !== 'user'
    return authIsAdmin.value
  })

  // 角色判定：测试模式下完全由 testRole 决定，用于模拟 master/sub/user 三种视角
  const isMaster = computed(() => {
    if (testMode.value) return testRole.value === 'master'
    return authIsAdmin.value && currentUser.value?.role === 'master'
  })
  const isSubAdmin = computed(() => {
    if (testMode.value) return testRole.value === 'sub'
    return authIsAdmin.value && currentUser.value?.role === 'sub'
  })

  async function signUp(email: string, password: string) {
    const result = await authApi.signUp(email, password)
    setToken(result.token)
    currentUser.value = result.user
    authIsAdmin.value = false
    lsSet('yili_current_user', result.user)
    return result
  }

  function logout() {
    authApi.logout().catch(() => {})
    removeToken()
    lsRemove('yili_current_user')
    currentUser.value = null
    authIsAdmin.value = false
    mode.value = 'frontend'
  }

  // ===== 专家 CRUD =====
  async function saveExpert(expert: Partial<Expert>) {
    if (testMode.value) {
      // 测试模式：仅本地变更，写入独立数据空间，不触碰生产库
      if (expert.id) {
        const idx = experts.value.findIndex(e => e.id === expert.id)
        if (idx >= 0) experts.value[idx] = { ...experts.value[idx], ...expert } as Expert
        persistTest()
        return experts.value[idx]
      } else {
        const created = { ...expert, id: Date.now() } as Expert
        experts.value.push(created)
        persistTest()
        return created
      }
    }
    if (expert.id) {
      const updated = await expertApi.update(expert.id, expert)
      const idx = experts.value.findIndex(e => e.id === expert.id)
      if (idx >= 0) experts.value[idx] = updated
      await refreshUpdateTime()
      return updated
    } else {
      const created = await expertApi.create(expert)
      experts.value.push(created)
      await refreshUpdateTime()
      return created
    }
  }

  async function deleteExpert(id: number) {
    const e = experts.value.find(x => x.id === id)
    if (e) {
      await recordObservationOperation({
        expertId: e.id,
        expertName: e.name,
        operation: '删除',
        before: { status: e.status, observationStatus: e.observationStatus, scores: e.scores },
        after: { deleted: true },
        note: '永久删除专家',
        tags: ['delete'],
      })
    }
    if (testMode.value) {
      experts.value = experts.value.filter(x => x.id !== id)
      persistTest()
      return
    }
    await expertApi.delete(id)
    experts.value = experts.value.filter(x => x.id !== id)
    await refreshUpdateTime()
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
      payload.scores = { ...((payload.scores as any) || {}), observationDeadline: addMonthsToDateYMD(entry, 18) }
    }
  }

  // ===== 自动评分 =====
  async function autoScoreExpertById(id: number) {
    if (testMode.value) {
      const idx = experts.value.findIndex(e => e.id === id)
      if (idx < 0) return null
      const result = autoScoreExpert(experts.value[idx], yiliProjects.value)
      const merged = {
        ...experts.value[idx],
        scores: {
          ...(experts.value[idx].scores || {}),
          professional: result.professional,
          influence: result.influence,
          overall: result.overall,
        },
        subScores: { professional: result.professionalItems, influence: result.influenceItems },
      }
      applyStatusPayload(merged as Partial<Expert>, result.overall, experts.value[idx].status, experts.value[idx].observationStatus)
      experts.value[idx] = merged as Expert
      persistTest()
      return result
    }
    const idx = experts.value.findIndex(e => e.id === id)
    if (idx < 0) return null
    const result = autoScoreExpert(experts.value[idx], yiliProjects.value)
    const payload: Partial<Expert> = {
      scores: {
        ...(experts.value[idx].scores || {}),
        professional: result.professional,
        influence: result.influence,
        overall: result.overall,
        // observationDeadline 继续保留在 scores JSON 中（避免改表）
      },
      subScores: {
        professional: result.professionalItems,
        influence: result.influenceItems,
      },
    }
    applyStatusPayload(payload, result.overall, experts.value[idx].status, experts.value[idx].observationStatus)
    const updated = await expertApi.update(id, payload)
    experts.value[idx] = updated
    return result
  }

  async function autoScoreAllExperts(): Promise<number> {
    if (testMode.value) {
      let count = 0
      for (const e of experts.value) {
        if (e.status === 'eliminated') continue
        const result = autoScoreExpert(e, yiliProjects.value)
        e.scores = {
          ...(e.scores || {}),
          professional: result.professional,
          influence: result.influence,
          overall: result.overall,
        }
        e.subScores = { professional: result.professionalItems, influence: result.influenceItems }
        applyStatusPayload(e as Partial<Expert>, result.overall, e.status, e.observationStatus)
        count += 1
      }
      persistTest()
      return count
    }
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
        },
        subScores: {
          professional: result.professionalItems,
          influence: result.influenceItems,
        },
      }
      applyStatusPayload(payload, result.overall, e.status, e.observationStatus)
      const updated = await expertApi.update(e.id, payload)
      const idx = experts.value.findIndex(x => x.id === e.id)
      if (idx >= 0) experts.value[idx] = updated
      count += 1
    }
    await refreshUpdateTime()
    return count
  }

  // ===== 项目 CRUD =====
  async function saveProject(project: Partial<Project>) {
    if (testMode.value) {
      if (project.id) {
        const idx = yiliProjects.value.findIndex(p => p.id === project.id)
        if (idx >= 0) yiliProjects.value[idx] = { ...yiliProjects.value[idx], ...project } as Project
      } else {
        const created = { ...project, id: Date.now() } as Project
        yiliProjects.value.push(created)
      }
      persistTest()
      return
    }
    if (project.id) {
      const updated = await projectApi.update(project.id, project)
      const idx = yiliProjects.value.findIndex(p => p.id === project.id)
      if (idx >= 0) yiliProjects.value[idx] = updated
      await refreshUpdateTime()
      return updated
    } else {
      const created = await projectApi.create(project)
      yiliProjects.value.push(created)
      await refreshUpdateTime()
      return created
    }
  }

  async function deleteProject(id: number) {
    if (testMode.value) {
      yiliProjects.value = yiliProjects.value.filter(p => p.id !== id)
      persistTest()
      return
    }
    await projectApi.delete(id)
    yiliProjects.value = yiliProjects.value.filter(p => p.id !== id)
    await refreshUpdateTime()
  }

  // 强制从后端重新加载合作项目列表（管理员登录/切到管理页时使用，避免被公开态只读列表污染）
  async function reloadProjects() {
    if (testMode.value) return
    try {
      const list = await projectApi.findAll()
      yiliProjects.value = list
    } catch (e) {
      console.warn('刷新合作项目列表失败', e)
    }
  }

  // ===== 领域 CRUD =====
  // field 可携带 _oldName 表示改名（对齐 V5：改名级联专家、删除清理专家引用）
  async function saveField(field: Partial<Field> & { _oldName?: string }) {
    if (testMode.value) {
      const oldName = field._oldName
      const keyName = oldName ?? field.name!
      if (field.id) {
        const idx = fields.value.findIndex(f => f.name === keyName)
        if (idx >= 0) fields.value[idx] = { ...fields.value[idx], ...field } as Field
      } else {
        fields.value.push(field as Field)
      }
      if (oldName && field.name && oldName !== field.name) {
        experts.value = experts.value.map(e => ({
          ...e,
          fields: (e.fields || []).map(f => (f === oldName ? field.name! : f)),
        }))
      }
      persistTest()
      return
    }
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
    await refreshUpdateTime()
  }

  async function deleteField(name: string) {
    if (testMode.value) {
      fields.value = fields.value.filter(f => f.name !== name)
      experts.value = experts.value.map(e => ({
        ...e,
        fields: (e.fields || []).filter(f => f !== name),
      }))
      persistTest()
      return
    }
    await fieldApi.delete(name)
    fields.value = fields.value.filter(f => f.name !== name)
    // 同步清理本地专家身上的领域引用（后端已级联 DB）
    experts.value = experts.value.map(e => ({
      ...e,
      fields: (e.fields || []).filter(f => f !== name),
    }))
    await refreshUpdateTime()
  }

  // ===== 收藏 =====
  async function toggleFavorite(expertId: number) {
    const isFav = favorites.value.includes(expertId)
    if (isFav) {
      favorites.value = favorites.value.filter(id => id !== expertId)
    } else {
      favorites.value.push(expertId)
    }
    if (testMode.value) {
      // 测试模式：仅本地快照，不触碰生产库
      persistTest()
      return
    }
    if (currentUser.value) {
      // 已登录：同步到后端（唯一数据源）
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
    } else {
      // 未登录：仅浏览器本地收藏偏好
      lsSet(FAV_LOCAL_KEY, favorites.value)
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
    currentPage, PAGE_SIZE, searchHistory, loading, dataError, showScores, sortOptions,
    platformTitle, colorScheme, appDescription, updateTime, mobileAdaptation, COLOR_SCHEMES,
    // 测试模式
    testMode, testRole,
    // Getters
    filteredExperts, totalPages, paginatedExperts, isMaster, isSubAdmin,
    // Actions
    loadAppData, checkAuthState, login, signUp, logout,
    saveExpert, deleteExpert, autoScoreExpertById, autoScoreAllExperts, recordObservationOperation,
    saveProject, deleteProject, reloadProjects,
    saveField, deleteField, toggleFavorite, isFavorited, setShowScores, saveSortOptions,
    setPlatformTitle, setColorScheme, setAppDescription, refreshUpdateTime, setMobileAdaptation, applyColorScheme,
    saveSearchHistory, removeSearchHistoryItem, clearSearchHistory,
    toggleFieldFilter, clearFilters, setMode, setAdminTab,
    enterTestMode, exitTestMode, switchTestRole,
  }
})
