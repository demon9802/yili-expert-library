/**
 * 伊利专家资源库 V6 - TypeScript 类型定义
 * 与后端 DTO 保持一致
 */

// ===== 专家 =====
export interface AdvantageItem {
  title?: string
  desc?: string
}

export interface Expert {
  id: number
  name: string
  fields: string[]
  advantages: Array<string | AdvantageItem>
  education: string
  qualifications: string
  courses: string
  contactPerson: string
  contactInfo: string
  contactType: string
  referrer: string
  isSupplier: boolean
  qualDisplay: string
  advDisplay: string
  scores: Scores
  status: string
  observationStatus: string | null
  observationDate: string | null
  contacts: ContactInfo[]
  createdBy: string
  createdAt: string
  updatedAt: string
  subScores: SubScores | null
}

export interface Scores {
  professional: number | null
  influence: number | null
  overall: number | null
  subScores?: SubScores
}

export interface DimensionSubScores {
  [key: string]: number | null
}

export interface SubScores {
  professional?: DimensionSubScores
  influence?: DimensionSubScores
}

export interface ContactInfo {
  type: string
  label?: string
  value: string
  person?: string
  info?: string
}

// ===== 合作项目 =====
export interface Project {
  id: number
  title: string
  expertId: number | null
  pendingExpertName: string
  year: number
  month: number | null
  satisfaction: string | null
  desc: string
  visible: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
}

// ===== 领域分类 =====
export interface Field {
  id?: number
  name: string
  color: string
  textColor: string
  hideWhenEmpty: boolean
  sortOrder: number
  creator: string | null
}

// ===== 用户 =====
export interface User {
  id: number
  email: string
  isAdmin: boolean
  forcePasswordChange?: boolean
}

export interface UserDTO {
  id: number
  email: string
  isAdmin: boolean
  hasSecurityQuestions: boolean
  forcePasswordChange: boolean
  createdAt: string
}

// ===== 认证 =====
export interface LoginResult {
  user: User
  token: string
}

// ===== 复合加载 =====
export interface AppData {
  experts: Expert[]
  fields: Field[]
  yiliProjects: Project[]
  favorites: number[]
}

// ===== 观察库操作 =====
export interface ObservationOperation {
  id: number
  expertId: number | null
  expertName: string
  operation: string
  operatorId: string
  operatorName: string
  operatorRole: string
  before: Record<string, any>
  after: Record<string, any>
  note: string
  tags: string[]
  createdAt: string
  _synced?: boolean
}

// ===== API 统一响应 =====
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

// ===== 应用状态 =====
export type AppMode = 'frontend' | 'admin'
export type AdminTab = 'experts' | 'projects' | 'ratings' | 'sort' | 'dashboard' | 'categories' | 'observation' | 'permissions' | 'settings' | 'users' | 'docs' | 'monthlyReport'

export interface AppState {
  mode: AppMode
  currentSort: string
  scoreFilter: number | null
  fieldFilter: Set<string>
  supplierFilter: boolean | null
  favoritesFilter: boolean | null
  cooperationFilter: boolean | null
  searchQuery: string
  adminSearchQuery: string
  adminTab: AdminTab
  adminSubTab: string
  editingExpert: Expert | null
  fieldsCollapsed: boolean
  db: AppDB | null
  currentUser: User | null
  currentPage: number
  PAGE_SIZE: number
}

export interface AppDB {
  experts: Expert[]
  fields: Field[]
  yiliProjects: Project[]
  favorites: number[]
  version?: string
  updateTime?: string
  [key: string]: any
}
