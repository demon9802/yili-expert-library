/**
 * 业务端入口分流守卫（生产环境）
 *
 * 规范来源：《数字伊利推送中转跳转页面.docx》
 * 仅适用于业务端（路由 meta.businessEntryRedirect === true 的路由，即前台 "/"）；
 * 管理后台（/admin-login、/admin）完全不适用：不跳转、不加门禁。
 *
 * 决策优先级（严格顺序，不得调整）：
 *   1. 非生产构建 → render（开发/本地/SIT 均不跳转）
 *   2. 数字伊利 APP（顶层窗口 + token/独立认证参数/appVersion/safeAreaTop 任一）→ render
 *   3. iframe（window.self !== window.top）→ render
 *   4. 移动端私有企微（移动 UA 且 wxworklocal）→ redirect-app-transit（公共中转页唤起 APP）
 *   5. 其他一切（普通 PC/手机浏览器、个人微信、非私有企微等）→ redirect-pc 固定地址
 */

/** 纯决策输入（全部参数化注入，不直接触碰浏览器，便于单测） */
export interface EntryEnv {
  /** 是否为生产构建（PROD 且非 sit 测试构建） */
  isProductionBuild: boolean
  /** 是否数字伊利 APP 环境（调用方按规范信号判定后传入） */
  isInDigitalYiliApp: boolean
  /** 是否处于 iframe 中 */
  isInIframe: boolean
  /** 是否移动端私有企微 */
  isPrivateWxWorkMobile: boolean
}

export type EntryDecision =
  | { action: 'render' }
  | { action: 'redirect-pc'; url: string }
  | { action: 'redirect-app-transit'; url: string }

/** 固定 PC 门户地址（不附加任何当前页面参数） */
export const PC_PORTAL_URL = 'https://portal.digitalyili.com/ai-expert-resource'
/** 私有企微公共生产中转页（公共 APP 唤起页，目标系统不自建） */
export const APP_TRANSIT_BASE_URL = 'https://digitalyili-h5.x.digitalyili.com/wxwork-land-app'
/** 中转页 APP 导航头标题 */
export const APP_TRANSIT_NAV_TITLE = '专家资源库'

const MOBILE_USER_AGENT_PATTERN = /iPhone|iPod|iPad|Android|Harmony|BlackBerry|Mobile/i
/** 私有企微以 wxworklocal 为准；不得用宽泛的 MicroMessenger/wxwork（会把个人微信误判为私有企微） */
const PRIVATE_WXWORK_USER_AGENT_PATTERN = /wxworklocal/i

export function isPrivateWxWorkMobileUa(userAgent: string): boolean {
  return MOBILE_USER_AGENT_PATTERN.test(userAgent) && PRIVATE_WXWORK_USER_AGENT_PATTERN.test(userAgent)
}

/** 纯环境决策：不执行跳转、不触碰业务状态，仅依据输入给出结论（href 用于构造中转页地址） */
export function resolveEntryDecision(env: EntryEnv & { href?: string }): EntryDecision {
  if (!env.isProductionBuild) return { action: 'render' }
  if (env.isInDigitalYiliApp) return { action: 'render' }
  if (env.isInIframe) return { action: 'render' }
  if (env.isPrivateWxWorkMobile) {
    const href = env.href ?? (typeof window !== 'undefined' ? window.location.href : '')
    return { action: 'redirect-app-transit', url: buildAppTransitUrlFromHref(href) }
  }
  return { action: 'redirect-pc', url: PC_PORTAL_URL }
}

/**
 * 构造私有企微公共中转页 URL：
 * - route = 清洗后的完整业务 URL（移除一次性认证参数 digitalYiliToken，不带敏感信息去中转页）
 * - navigationTitle = 专家资源库
 * - 用 URL/URLSearchParams 编码，不手工重复编码
 */
export function buildAppTransitUrlFromHref(href: string): string {
  const appTargetUrl = new URL(href)
  appTargetUrl.searchParams.delete('digitalYiliToken')
  const transitUrl = new URL(APP_TRANSIT_BASE_URL)
  transitUrl.searchParams.set('route', appTargetUrl.toString())
  transitUrl.searchParams.set('navigationTitle', APP_TRANSIT_NAV_TITLE)
  return transitUrl.toString()
}

/** 从浏览器收集环境信号（仅此函数触碰 window） */
export function collectBrowserEntryEnv(): EntryEnv & { href: string } {
  const isTopWindow = window.self === window.top
  const searchParams = new URL(window.location.href).searchParams
  const hasStandaloneAuthPayload = ['data', 'timestamp', 'code', 'sign'].every(key => searchParams.has(key))
  const isInDigitalYiliApp =
    isTopWindow &&
    (searchParams.has('digitalYiliToken') ||
      hasStandaloneAuthPayload ||
      'appVersion' in window ||
      'safeAreaTop' in window)
  return {
    // 生产构建 = PROD 且非 sit 测试构建（dev 本地与 build:sit 均不跳转）
    isProductionBuild: import.meta.env.PROD && import.meta.env.MODE !== 'sit',
    isInDigitalYiliApp,
    isInIframe: !isTopWindow,
    isPrivateWxWorkMobile: isPrivateWxWorkMobileUa(window.navigator.userAgent),
    href: window.location.href,
  }
}

/** 执行跳转（与决策分离；replace 避免返回键造成跳转循环） */
export function executeEntryRedirect(url: string): void {
  window.location.replace(url)
}
