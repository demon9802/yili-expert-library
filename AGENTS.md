# AGENTS.md - 项目开发规范

> **重要**: 此文件是所有 AI Agent 和开发人员在此项目中工作时的指南。
>
> **V6 架构变更**: 自 V6 起，项目已拆分为前后端分离架构。

## 项目状态

- **根目录旧代码** (index.html, js/, css/, data/): **已废弃，不可修改**
- **backend/**: Spring Boot 后端项目（V6+）
- **frontend/**: Vue3 前端项目（V6+）

## 开发规则

1. **所有新功能开发必须在 `backend/` 和 `frontend/` 目录中进行**
2. **禁止修改根目录下的旧代码**（index.html, js/, css/, data/）
3. 旧代码仅作为参考，用于理解原始业务逻辑

## 后端开发规范 (backend/)

- 框架: Spring Boot 2.7 + MyBatis-Plus
- 数据库: MySQL，所有新表名以 `yl_expert_resource_` 开头
- **禁止操作数据库中已有的表**（非 `yl_expert_resource_` 前缀的表）
- Redis key 前缀: `expert_resource:`
- 端口: 8080
- 多环境配置: dev / sit / prod，默认 dev
- 项目结构: controller / service / mapper / entity / dto / config / utils

## 前端开发规范 (frontend/)

- 框架: Vite + Vue3 + TypeScript + SCSS
- **纯技术重构原则**: 不改变页面表现、不改变业务逻辑、不改变用户可见行为
- 状态管理: Pinia
- API 请求: 统一通过 `@/api/` 模块
- 样式: SCSS，全局变量在 `@/styles/_variables.scss`

## 版本规范

- V5 及之前: 旧单体架构（已废弃）
- V6+: 前后端分离架构

## 部署

- git push main → EdgeOne Pages 自动部署
- 正式链接: `https://yili-expert-library-bvw2itdk.zh-cn.edgeone.cool/`
