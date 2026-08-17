/**
 * 数字伊利（内部平台）用户身份对接
 *
 * 规范来源：《ai项目获取用户信息.docx》
 * - H5 链接后可能拼接参数 digitalYiliToken（也可能不带，需判空）
 * - 用该 token 调 POST /api/auth/digital-yili/getUserInfo（body: { digital_yili_token }）
 *   换取用户信息 { userCode, userName, deptCode, deptName, buName }
 * - 用户信息本地缓存 24 小时（token 作 key），过期自动刷新，避免频繁调用三方接口
 *
 * 访问控制（业务要求）：非数科人员（deptName 不含"数字科技"）→ 前端显示"访问受限"。
 */
import { BASE_URL } from '@/api/request'

const DY_USER_CACHE_KEY = 'yili_dy_user_cache'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 小时

export interface DigitalYiliUser {
  userCode: string
  userName: string
  deptCode?: string
  deptName?: string
  buName?: string
}

export type DyAccessStatus =
  | { status: 'no-token' }                                    // URL 未携带 token：不做校验（本地/直连场景）
  | { status: 'ok'; user: DigitalYiliUser; fromCache: boolean } // 数科人员，正常访问
  | { status: 'denied'; reason: string }                      // 非数科人员 / token 无效 → 访问受限
  | { status: 'unknown'; reason: string }                     // 接口不可达等：降级放行并告警（联调期不被卡死）

/** 数科人员判定：部门名包含"数字科技"（示例 deptName=总部数字科技中心） */
export function isShuKeUser(user: DigitalYiliUser): boolean {
  return /数字科技/.test(user.deptName || '')
}

/** 从当前 URL 读取 digitalYiliToken（可能为空） */
export function getDigitalYiliTokenFromUrl(): string | null {
  const v = new URLSearchParams(window.location.search).get('digitalYiliToken')
  return v && v.trim() ? v.trim() : null
}

/** 读取本地缓存（token 匹配且未过 24h 才有效） */
function readCache(token: string): DigitalYiliUser | null {
  try {
    const raw = localStorage.getItem(DY_USER_CACHE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as { token: string; user: DigitalYiliUser; expireAt: number }
    if (c.token !== token || Date.now() > c.expireAt) return null
    return c.user
  } catch {
    return null
  }
}

function writeCache(token: string, user: DigitalYiliUser) {
  try {
    localStorage.setItem(DY_USER_CACHE_KEY, JSON.stringify({ token, user, expireAt: Date.now() + CACHE_TTL_MS }))
  } catch { /* 缓存失败不影响主流程 */ }
}

/** 调用对接方获取用户信息接口（裸 fetch，返回 null 表示业务失败） */
async function fetchUserInfo(token: string): Promise<DigitalYiliUser | null> {
  const res = await fetch(`${BASE_URL}/auth/digital-yili/getUserInfo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ digital_yili_token: token }),
  })
  if (!res.ok) return null
  const data = await res.json().catch(() => null)
  if (!data || !data.userCode) return null // 失败示例 {code:400/401,msg:"登录失败"}
  return data as DigitalYiliUser
}

/**
 * 主入口：解析当前访问的数字伊利身份并判定访问权限。
 * 调用时机：App 挂载时（页面加载/刷新）。
 *
 * 访问策略（2026-08-17 用户确认）：
 * - 带 token：验证数科身份，非数科 → 访问受限
 * - 不带 token：部署环境（SIT/PROD）一律"访问受限"（须从内部平台入口进入）；
 *   仅 localhost 本地开发放行，保证开发调试不受影响。
 */
export async function resolveDigitalYiliAccess(): Promise<DyAccessStatus> {
  const token = getDigitalYiliTokenFromUrl()
  if (!token) {
    const h = window.location.hostname
    const isLocalDev = h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '[::1]'
    if (isLocalDev) return { status: 'no-token' }
    return { status: 'denied', reason: '缺少身份凭证（digitalYiliToken），请从内部平台进入本系统' }
  }

  // ① 本地缓存命中（24h 内同 token 直接复用，不调三方接口）
  const cached = readCache(token)
  if (cached) return { status: 'ok', user: cached, fromCache: true }

  // ② 调接口换取用户信息
  try {
    const user = await fetchUserInfo(token)
    if (!user) {
      // 接口明确业务失败（token 无效/过期）：无法确认身份 → 拒绝访问
      return { status: 'denied', reason: '身份令牌无效或已过期，请从内部平台重新进入' }
    }
    writeCache(token, user)
    if (!isShuKeUser(user)) {
      return { status: 'denied', reason: `${user.userName || userCodeFallback(user)}（${user.deptName || '未知部门'}）无访问权限，本系统仅限数字科技中心人员使用` }
    }
    return { status: 'ok', user, fromCache: false }
  } catch (e) {
    // 网络/接口未就绪（404、超时等）：无法验证 → 降级放行并告警，避免联调期阻断全部访问
    // TODO: 接口稳定后可改为严格模式（拒绝并提示稍后再试）
    console.warn('[digitalYili] 用户信息接口不可用，本次降级放行：', e)
    return { status: 'unknown', reason: String(e) }
  }
}

function userCodeFallback(user: DigitalYiliUser): string {
  return user.userCode || '未知用户'
}
