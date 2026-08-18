/**
 * 入口分流决策验证脚本（可重复执行）
 * 用法：node scripts/verify-entry-decision.mjs
 * 依赖：项目 node_modules 内的 esbuild（vite 自带）编译 src/utils/entryGuard.ts 后加载执行。
 */
import { build } from 'esbuild'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// 编译 entryGuard.ts（仅类型剥离，import.meta.env 会被替换为字面量占位）
const outfile = join(mkdtempSync(join(tmpdir(), 'entry-guard-')), 'entryGuard.mjs')
await build({
  entryPoints: ['src/utils/entryGuard.ts'],
  bundle: true,
  format: 'esm',
  outfile,
  define: { 'import.meta.env.PROD': 'true', 'import.meta.env.MODE': '"production"' },
  logLevel: 'silent',
})
const mod = await import(`file://${outfile.replace(/\\/g, '/')}`)

const { resolveEntryDecision, buildAppTransitUrlFromHref, isPrivateWxWorkMobileUa, PC_PORTAL_URL } = mod

let passed = 0
let failed = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { passed++; console.log(`  ✓ ${name}`) }
  else { failed++; console.error(`  ✗ ${name}\n      期望 ${JSON.stringify(expected)}\n      实际 ${JSON.stringify(actual)}`) }
}

console.log('== 文档第七节：环境分流场景 ==')
// 1. 生产 + PC 普通浏览器 → 跳 PC 门户
check('生产+PC → redirect-pc', resolveEntryDecision({ isProductionBuild: true, isInDigitalYiliApp: false, isInIframe: false, isPrivateWxWorkMobile: false }),
  { action: 'redirect-pc', url: PC_PORTAL_URL })
// 2. 生产 + 移动端私有企微 → 中转页
const wxworkDecision = resolveEntryDecision({ isProductionBuild: true, isInDigitalYiliApp: false, isInIframe: false, isPrivateWxWorkMobile: true, href: 'https://yilidata-ai-expert-resource-web.x.digitalyili.com/?digitalYiliToken=abc123' })
check('生产+私有企微 → redirect-app-transit', wxworkDecision.action, 'redirect-app-transit')
check('中转页 route 已清除 digitalYiliToken', decodeURIComponent(new URL(wxworkDecision.url).searchParams.get('route')).includes('digitalYiliToken'), false)
check('中转页 navigationTitle', new URL(wxworkDecision.url).searchParams.get('navigationTitle'), '专家资源库')
check('中转页 base', new URL(wxworkDecision.url).origin + new URL(wxworkDecision.url).pathname, 'https://digitalyili-h5.x.digitalyili.com/wxwork-land-app')
// 3. 生产 + 数字伊利 APP → render（优先级最高）
check('生产+APP(token) → render', resolveEntryDecision({ isProductionBuild: true, isInDigitalYiliApp: true, isInIframe: false, isPrivateWxWorkMobile: true }).action, 'render')
check('生产+APP(独立认证参数) → render', resolveEntryDecision({ isProductionBuild: true, isInDigitalYiliApp: true, isInIframe: false, isPrivateWxWorkMobile: false }).action, 'render')
// 4. 生产 + iframe → render（优先级高于企微）
check('生产+iframe → render', resolveEntryDecision({ isProductionBuild: true, isInDigitalYiliApp: false, isInIframe: true, isPrivateWxWorkMobile: true }).action, 'render')
// 5. 非生产（dev/sit）→ render
check('非生产构建 → render', resolveEntryDecision({ isProductionBuild: false, isInDigitalYiliApp: false, isInIframe: false, isPrivateWxWorkMobile: false }).action, 'render')
// 6. 生产 + 普通移动浏览器/个人微信/非私有企微 → PC 地址
check('生产+个人微信(MicroMessenger 非 wxworklocal) → redirect-pc',
  resolveEntryDecision({ isProductionBuild: true, isInDigitalYiliApp: false, isInIframe: false, isPrivateWxWorkMobile: isPrivateWxWorkMobileUa('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0) AppleWebKit/605.1.15 MicroMessenger/8.0.38') }).action,
  'redirect-pc')
check('生产+普通手机浏览器 → redirect-pc',
  resolveEntryDecision({ isProductionBuild: true, isInDigitalYiliApp: false, isInIframe: false, isPrivateWxWorkMobile: isPrivateWxWorkMobileUa('Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile Safari/537.36') }).action,
  'redirect-pc')
check('生产+PC 企业微信(非私有 wxworklocal) → redirect-pc',
  resolveEntryDecision({ isProductionBuild: true, isInDigitalYiliApp: false, isInIframe: false, isPrivateWxWorkMobile: isPrivateWxWorkMobileUa('Mozilla/5.0 (Windows NT 10.0) wxwork/4.1') }).action,
  'redirect-pc')

console.log('== 私有企微 UA 判定 ==')
check('移动+wxworklocal → true', isPrivateWxWorkMobileUa('Mozilla/5.0 (iPhone) wxworklocal/1.2'), true)
check('纯 PC wxworklocal（非移动UA）→ false', isPrivateWxWorkMobileUa('Mozilla/5.0 (Windows NT 10.0) wxworklocal/1.2'), false)

console.log('== 中转页 URL 构造 ==')
const transit = buildAppTransitUrlFromHref('https://web.example.com/?digitalYiliToken=tok&foo=1#/home')
const route = new URL(transit).searchParams.get('route')
check('route 保留普通参数', decodeURIComponent(route), 'https://web.example.com/?foo=1#/home')
check('navigationTitle', new URL(transit).searchParams.get('navigationTitle'), '专家资源库')

console.log(`\n结果：${passed} 通过，${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)
