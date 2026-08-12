# V6 技术栈改写结果报告

**改写日期**: 2026-08-12
**改写版本**: V5.9.15 → V6.0.0
**改写依据**: `WorkBuddy技术栈转换规范.docx`

---

## 一、改写概述

按照技术栈转换规范文档要求，将原单体项目（HTML+CSS+JS + Supabase BaaS）完整改写为前后端分离架构：

| 维度 | 旧架构 (V5) | 新架构 (V6) |
|------|-------------|-------------|
| 后端 | Supabase BaaS (Postgres + Auth) | Spring Boot 2.7.18 + MyBatis-Plus 3.5.5 + MySQL + Redis |
| 前端 | HTML + CSS + 原生JS (10,639行) | Vite 5 + Vue3 + TypeScript + SCSS |
| 认证 | Supabase Auth (Magic Link/OTP) | JWT + BCrypt |
| 数据库 | Supabase Postgres | MySQL (表名前缀 `yl_expert_resource_`) |
| 缓存 | localStorage | Spring Data Redis (key前缀 `expert_resource:`) |
| 状态管理 | 全局变量 appState | Pinia Store |
| 类型系统 | 无 | TypeScript 全面类型化 |

**文件统计**:
- 后端 Java 文件: 63 个
- 前端 Vue/TS/SCSS 文件: 43 个
- MySQL DDL: 1 个 (8张表)
- 配置文件: pom.xml + settings.xml + 7个yml

---

## 二、后端改写详情

### 2.1 已完成

| 模块 | 内容 | 状态 |
|------|------|------|
| **项目结构** | controller/service/mapper/entity/dto/config/utils 完整分层 | ✅ |
| **MySQL DDL** | 8张表 (user, expert, project, field, favorite, setting, observation_operation, page_view) 全部 `yl_expert_resource_` 前缀 | ✅ |
| **实体类** | 8个 MyBatis-Plus 实体 (@TableName, @TableId, @TableField) | ✅ |
| **Mapper** | 8个 BaseMapper 接口 | ✅ |
| **Service** | 8个 Service接口 + 8个 ServiceImpl 实现 | ✅ |
| **Controller** | 9个 REST Controller (Auth, Expert, Project, Field, Favorite, Setting, Observation, PageView, AppData) | ✅ |
| **认证系统** | JWT 生成/验证 + BCrypt 密码加密 + 拦截器 | ✅ |
| **密保问题** | SHA-256 哈希 + 3次锁定逻辑 (服务端实现) | ✅ |
| **用户管理** | 用户列表 + 管理员重置密码 + 强制改密 | ✅ |
| **全局异常** | @RestControllerAdvice 统一异常处理 | ✅ |
| **CORS** | 跨域配置 | ✅ |
| **多环境配置** | application.yml + dev/sit/prod + bootstrap-dev/sit/prod | ✅ |
| **pom.xml** | 多环境profiles + resources插件filtering | ✅ |
| **settings.xml** | 阿里云Maven仓库配置 | ✅ |
| **Redis配置** | RedisTemplate + JSON序列化 | ✅ |
| **MyBatis-Plus** | 分页插件 + 驼峰映射 | ✅ |

### 2.2 API 端点清单

| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 认证 | POST | /api/auth/signup | 注册 |
| 认证 | POST | /api/auth/login | 登录 |
| 认证 | POST | /api/auth/logout | 登出 |
| 认证 | POST | /api/auth/reset-password | 重置密码 |
| 认证 | PUT | /api/auth/change-password | 修改密码 |
| 认证 | POST | /api/auth/reauthenticate | 验证旧密码 |
| 认证 | GET | /api/auth/force-password-change | 检查强制改密 |
| 认证 | DELETE | /api/auth/force-password-change | 清除强制改密标记 |
| 密保 | PUT | /api/auth/security/questions | 保存密保问题 |
| 密保 | GET | /api/auth/security/questions/{userId} | 获取密保问题 |
| 密保 | POST | /api/auth/security/verify | 验证密保答案 |
| 密保 | POST | /api/auth/security/reset-password | 密保重置密码 |
| 用户 | GET | /api/auth/users | 用户列表 |
| 用户 | POST | /api/auth/users/reset-password | 管理员重置密码 |
| 专家 | GET | /api/experts | 列表 |
| 专家 | GET | /api/experts/{id} | 详情 |
| 专家 | POST | /api/experts | 新增 |
| 专家 | PUT | /api/experts/{id} | 修改 |
| 专家 | PUT | /api/experts/upsert | upsert |
| 专家 | DELETE | /api/experts/{id} | 删除 |
| 项目 | GET | /api/projects | 列表 |
| 项目 | POST | /api/projects | 新增 |
| 项目 | PUT | /api/projects/{id} | 修改 |
| 项目 | PUT | /api/projects/upsert | upsert |
| 项目 | DELETE | /api/projects/{id} | 删除 |
| 分类 | GET | /api/fields | 列表 |
| 分类 | POST | /api/fields | 新增 |
| 分类 | PUT | /api/fields/{name} | 修改 |
| 分类 | DELETE | /api/fields/{name} | 删除 |
| 收藏 | GET | /api/favorites | 列表 |
| 收藏 | POST | /api/favorites/{expertId} | 添加 |
| 收藏 | DELETE | /api/favorites/{expertId} | 移除 |
| 收藏 | GET | /api/favorites/{expertId}/check | 检查 |
| 设置 | GET | /api/settings/{key} | 获取 |
| 设置 | PUT | /api/settings/{key} | 保存 |
| 观察 | GET | /api/observation-operations | 列表 |
| 观察 | POST | /api/observation-operations | 新增 |
| 复合 | GET | /api/app-data | 全量加载 |
| 访问 | POST | /api/page-views | 记录访问 |
| 访问 | GET | /api/page-views/monthly | 月度统计 |

---

## 三、前端改写详情

### 3.1 已完成

| 模块 | 内容 | 状态 |
|------|------|------|
| **项目骨架** | Vite + Vue3 + TS + SCSS 完整配置 | ✅ |
| **类型系统** | 全部数据模型 TypeScript 类型定义 | ✅ |
| **API层** | 10个 API 模块 (auth, expert, project, field, favorite, setting, appData, observation, pageView, request) | ✅ |
| **状态管理** | Pinia Store (替代 appState + getDB/saveDB) | ✅ |
| **路由** | Vue Router (前端/管理后台) | ✅ |
| **样式** | SCSS 模块化 (variables + global + original 完整保留) | ✅ |
| **前台页面** | FrontendView (header, 搜索, 筛选, 专家卡片, 分页) | ✅ |
| **管理后台** | AdminView (12个标签页) | ✅ |
| **组件** | ExpertCard, FieldFilterBar, PaginationControl, LoginModal, ExpertDetailModal, ScoreBar | ✅ |
| **管理标签** | ExpertsTab, ProjectsTab, CategoriesTab, DashboardTab, UsersTab, RatingsTab, SortTab, ObservationTab, PermissionsTab, SettingsTab, DocsTab, MonthlyReportTab | ✅ |
| **工具函数** | sha256.ts, helpers.ts, changelog.ts | ✅ |

### 3.2 分阶段对照

| 阶段 | 文档要求 | 完成情况 |
|------|----------|----------|
| 1. 盘点基线 | API列表、数据模型、缓存点 | ✅ 已完成 |
| 2. 搭建骨架 | Vite+Vue3+TS工程 | ✅ 已完成 |
| 3. 迁移页面结构 | HTML→Vue组件 | ✅ 已完成 |
| 4. 迁移样式 | CSS→SCSS | ✅ 已完成 (原始CSS完整保留) |
| 5. 迁移交互逻辑 | JS→TS+Composition API | ⚠️ 部分完成 (核心逻辑已迁移，详细业务逻辑需迭代) |
| 6. 对照验收 | UI/功能一致性检查 | ⏳ 待用户验证 |

---

## 四、不确定项与风险点

### 4.1 高风险 (需优先确认)

| # | 风险项 | 说明 | 建议 |
|---|--------|------|------|
| 1 | **数据迁移** | Supabase Postgres → MySQL 的数据迁移未执行。当前仅有建表DDL，无数据迁移脚本。 | 需编写数据迁移脚本或手动导出导入。原 Supabase 中的专家/项目/分类数据需要迁移到新 MySQL 表中。 |
| 2 | **密码不兼容** | 原 Supabase Auth 使用自己的密码哈希算法，新系统使用 BCrypt。现有用户密码无法直接迁移。 | 需要为所有现有用户重置密码，或实现兼容验证逻辑。 |
| 3 | **Magic Link 登录** | 原系统支持 Magic Link (邮箱OTP) 登录，新系统仅支持密码登录。 | 如需保留 Magic Link，需额外实现邮件发送功能。 |
| 4 | **文件未编译验证** | 后端 Java 代码未经过 Maven 编译验证（环境无 JDK 1.8 + Maven）。前端未经过 npm install + build。 | 需在本地安装 JDK 1.8 + Maven 后执行 `mvn compile` 验证。前端需 `npm install && npm run build`。 |

### 4.2 中风险

| # | 风险项 | 说明 |
|---|--------|------|
| 5 | **前端业务逻辑完整度** | 原 app.js 有 10,639 行，当前 Vue 组件迁移了核心结构和主要功能，但部分详细交互逻辑（如Excel导入导出、图表渲染、评分规则浮窗、测试模式等）未完全迁移。 |
| 6 | **评分规则逻辑** | 原项目的评分计算函数 (scoreAchievement 等) 包含复杂的正则匹配和业务规则，当前 RatingsTab 仅实现了基础评分编辑，完整评分规则需迁移。 |
| 7 | **子管理员权限** | 原项目的权限系统较为复杂（字段级权限控制），当前 PermissionsTab 仅提供 JSON 编辑方式。 |
| 8 | **bootstrap.yml 依赖** | 文档要求使用 bootstrap-*.yml，需添加 `spring-cloud-starter-bootstrap` 依赖（已在 pom.xml 中包含），但未验证是否能正常加载。 |
| 9 | **Redis 连接** | dev 环境的 Redis 地址 (10.254.2.143:37937) 为内网地址，本地开发环境可能无法访问。 |

### 4.3 低风险

| # | 风险项 | 说明 |
|---|--------|------|
| 10 | **CSS 样式完整性** | 原始 CSS 完整复制为 `_original.scss`，样式应 100% 保持一致。但 Vue 组件的 scoped 样式可能需要微调。 |
| 11 | **localStorage 缓存策略** | 新架构仍保留 localStorage 作为离线缓存，但数据真理来源已从 localStorage+Supabase 变为 MySQL。缓存策略需验证。 |
| 12 | **EdgeOne 部署** | 新前端是 Vite 项目，构建产物在 `dist/` 目录，部署方式需调整为构建后部署。 |

---

## 五、未实现/待后续迭代项

| # | 功能 | 说明 |
|---|------|------|
| 1 | Excel 导入导出 | 原项目使用 SheetJS (xlsx) 实现专家数据导入导出，前端已引入 xlsx 依赖，但功能逻辑未迁移。 |
| 2 | 图表渲染 | 原项目有自定义图表渲染函数 (renderBarChart, renderDoughnutChart, renderScoreDistChart 等)，当前 DashboardTab 使用简单 HTML 条形图替代。 |
| 3 | 测试模式 | 原项目的测试模式 (testMode) 功能未迁移。 |
| 4 | 评分规则浮窗 | 前端详情页的评分规则"?"浮窗未实现。 |
| 5 | 手机端适配细节 | 极窄屏 (≤400px) 领域标签语义缩略等细节未完全迁移。 |
| 6 | 数据迁移脚本 | Supabase → MySQL 的数据迁移脚本未编写。 |
| 7 | 邮件发送 | 密码重置邮件功能未实现（当前生成临时密码但未发送）。 |
| 8 | Supabase RPC 替代 | 原项目使用 Supabase RPC (verify_security_answers, admin_reset_password_by_id, get_user_list) 的服务端函数，已在 Spring Boot Service 层重新实现。 |

---

## 六、环境依赖（需用户安装）

| 依赖 | 版本 | 用途 | 安装方式 |
|------|------|------|----------|
| JDK | 1.8 (jdk1.8.0_202) | 后端编译运行 | 下载安装 + 配置 JAVA_HOME |
| Maven | 3.8.x | 后端构建 | 下载解压 + 配置 MAVEN_HOME + 替换 settings.xml |
| Node.js | 18+ | 前端构建 | 已有 node 22.22.2 可用 |
| MySQL | 5.7+ / 8.0 | 数据库 | 需确保数据库可连接 |
| Redis | 任意版本 | 缓存 | 需确保 Redis 可连接 |

---

## 七、验收建议

### 7.1 后端验证步骤
1. 安装 JDK 1.8 + Maven
2. 替换 `backend/settings.xml` 到 Maven 配置目录
3. 执行 `mvn clean compile` 验证编译
4. 执行 `mvn spring-boot:run` 启动服务
5. 访问 `http://localhost:8080/api/app-data` 验证 API

### 7.2 前端验证步骤
1. `cd frontend && npm install`
2. `npm run dev` 启动开发服务器
3. 访问 `http://localhost:3000` 验证页面
4. 对比旧版页面，检查 UI 和功能一致性

### 7.3 UI 对照清单
- [ ] 前台 Header 样式
- [ ] 搜索框 + 搜索历史
- [ ] 领域筛选条
- [ ] 排序/筛选控件
- [ ] 专家卡片 (评分徽章、领域标签、收藏按钮)
- [ ] 专家详情弹窗
- [ ] 分页控件
- [ ] 登录/注册弹窗
- [ ] 管理后台各标签页

---

## 八、回滚方案

如改写后出现问题，可立即回滚至 V5.9.15：
1. 旧代码完整保留在根目录 (index.html, js/, css/)
2. EdgeOne 部署仍指向旧 index.html
3. 删除 `backend/` 和 `frontend/` 目录即可恢复原状
4. Supabase 数据库未做任何修改

---

**报告生成时间**: 2026-08-12 23:15
**改写人**: AI Agent (WorkBuddy)
