/**
 * V6 变更日志
 * 技术栈转换：HTML+CSS+JS → Vite+Vue3+TS+SCSS / Supabase → Spring Boot
 */

export const CHANGELOG_V6 = [
  {
    version: '6.0.0',
    date: '2026-08-12',
    title: '技术栈全面转换',
    changes: [
      '后端: Supabase BaaS → Spring Boot 2.7 + MyBatis-Plus + MySQL + Redis',
      '前端: HTML+CSS+JS → Vite + Vue3 + TypeScript + SCSS',
      '架构: 单体应用 → 前后端分离',
      '认证: Supabase Auth (Magic Link/OTP) → JWT + BCrypt',
      '数据库: Supabase Postgres → MySQL (表名前缀 yl_expert_resource_)',
      '缓存: localStorage → Spring Data Redis (key前缀 expert_resource:)',
      'API: Supabase SDK → RESTful API (Spring Boot Controller)',
      '状态管理: 全局变量 appState → Pinia Store',
      '类型系统: 无 → TypeScript 全面类型化',
      '样式: 纯 CSS → SCSS 模块化',
      '旧项目标记为已废弃',
    ],
  },
]

export function getLatestVersion() {
  return CHANGELOG_V6[0]
}

export function getAllChanges() {
  return CHANGELOG_V6
}
