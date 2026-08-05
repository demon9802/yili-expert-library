# 专家资源库 · 当前部署版本技术栈清单

> **用途**：评估未来迁移到公司内部服务器的「改代码成本」。本文档列出当前线上版本（v5.8.9）实际使用的全部技术选型，含前端、数据层、部署托管与文件结构。
> **结论先行**：当前是**纯静态前端 + BaaS 云数据库**，无自建后端、无应用服务器、无构建步骤、无前端框架——迁移时前端几乎不用重写，主要成本在「数据层 + 鉴权」两处耦合点。

---

## 一、总体架构

```
[浏览器] ── 静态资源 ──> EdgeOne Pages (腾讯云CDN, 国内)
   │
   ├── localStorage (前端主缓存 / 离线数据)
   │
   └── Supabase JS SDK ──> Supabase Cloud (PostgreSQL + Auth, 新加坡)
```

- 无 Node/Java/Python 等后端服务；所有逻辑在浏览器端执行。
- 数据真理来源双轨：localStorage（本地）与 Supabase（云端）按 UNION 策略双向合并。

---

## 二、前端技术栈

| 维度 | 选型 | 说明 |
|---|---|---|
| 开发语言 | **原生 JavaScript (ES2020+)** | 无 TypeScript，无编译 |
| 前端框架 | **无（Vanilla JS）** | 自研 `h()` DOM 构建 helper（类 hyperscript），无虚拟 DOM，未用 React / Vue / Angular |
| 样式 | **原生 CSS（单文件）** | `css/style.css`，用 CSS 变量做主题；无 Sass/Less 预处理器，无 Tailwind/Bootstrap |
| 模块系统 | **无打包器 / 无 ES Module** | 通过 `<script>` 标签全局加载，依赖全局变量（`supabase`、`EXPERT_DATA`），非模块化工程 |
| 第三方库 | **CDN 引入（无 npm / 无本地依赖）** | 见下表 |
| 响应式 | CSS Media Query | PC + 移动端同一套代码自适应，无独立移动端框架 |
| 前端存储 | **localStorage** | 主数据缓存；未用 IndexedDB |

**第三方依赖（均为 CDN，可改为本地 vendor 文件）**

| 库 | 版本 | 用途 |
|---|---|---|
| `@supabase/supabase-js` | 2.x (UMD) | 数据库读写 + 登录鉴权客户端 |
| `xlsx` (SheetJS) | 0.18.5 | Excel 批量导入 / 导出（专家批量上传、导出） |

---

## 三、数据层 / 后端（BaaS）

| 维度 | 选型 | 说明 |
|---|---|---|
| 数据库 | **Supabase PostgreSQL** | 托管 SaaS，区域 `ap-southeast-1`（新加坡），项目 ID `owjdwwdipfsnumgoxzih` |
| 核心表 | `experts` / `fields` / `yili_projects` / `profiles` / `favorites` / `page_views` | 表结构见 `supabase-migration-*.sql` |
| 鉴权 | **Supabase Auth** | 两种方式并存：① Magic Link（邮箱验证码 `signInWithOtp`）② 本地密码登录（`signInWithPassword`） |
| 权限控制 | **PostgreSQL Row-Level Security (RLS)** | 配 `is_admin_user()` 函数区分主/子管理员 |
| 数据同步 | **前端双向合并** | `getDB()`/`saveDB()` 中 localStorage 与 Supabase 按 UNION 策略合并，localStorage 独有数据不丢失 |

> 所有 DB 交互集中在 `js/supabase.js`（数据访问层封装，约 730 行）+ `js/app.js` 内的 `getDB()/saveDB()` 调用。**这是迁移时唯一需要重写的数据耦合点。**

---

## 四、部署与托管

| 维度 | 选型 |
|---|---|
| 前端静态托管 | **EdgeOne Pages**（腾讯云 CDN，国内可访问） |
| 正式域名 | `https://yili-expert-library-bvw2itdk.zh-cn.edgeone.cool` |
| 触发部署 | `git push` → GitHub webhook → EdgeOne 自动同步（**无 CI 构建，纯静态文件同步**） |
| 代码仓库 | GitHub `demon9802/yili-expert-library`（main 分支） |
| 数据库托管 | Supabase Cloud（独立 SaaS，非自托管） |
| 工作流文件 | `.github/workflows/keep-alive.yml`（仅保活，非构建） |

---

## 五、文件结构与规模

| 文件 | 行数 / 大小 | 角色 |
|---|---|---|
| `index.html` | 921 B | 单入口，按序加载脚本 |
| `js/app.js` | ~9,800 行 | 主逻辑（渲染、评分、后台、路由），全局单文件 |
| `js/data.js` | ~1,970 行 / 112 KB | 初始专家数据（新用户首次初始化用，非真理来源） |
| `js/supabase.js` | ~730 行 | Supabase 数据层封装（迁移核心改动点） |
| `js/changelog.js` | — | 版本变更日志 |
| `css/style.css` | ~1,900 行 | 原生 CSS，含响应式 |
| `docs/` | — | 评分规则等文档，随站部署 |
| `supabase-migration-*.sql` | — | 表结构 / RLS 修复脚本（PostgreSQL 同源可复用） |

---

## 六、迁移改代码成本 · 关键耦合点（给技术同学）

| # | 耦合点 | 位置 | 迁移动作 | 预估成本 |
|---|---|---|---|---|
| 1 | **前端运行时** | 全部静态文件 | 任意静态服务器 / 内网 Web 服务器 / 内网 CDN 均可托管，**无需重写** | 极低 |
| 2 | **数据库访问层** | `js/supabase.js` + `js/app.js` 的 `getDB()/saveDB()` | 若迁内部 PostgreSQL：改 `supabase.js` 调用（约 730 行封装 + app.js 相关调用）；表结构 SQL 同源复用。若迁 MySQL：SQL 需转译 | 中 |
| 3 | **鉴权** | `js/supabase.js` auth 段（~200 行）+ `js/app.js` 的 `currentUser` 检查 | 接公司统一登录（SSO / LDAP / OAuth）时替换 magic-link/password 段与用户态判断 | 中 |
| 4 | **第三方 CDN 依赖** | `index.html` 两处 `<script>` | 内网无外网时，将 `xlsx`、`supabase-js` 改为本地 vendor 文件或内网镜像 | 低 |
| 5 | **移动端** | CSS 响应式 | 当前已是响应式网页；若内部要求**小程序 / App**，需另起壳（WebView 或原生） | 视要求 |
| 6 | **数据主权 / 合规** | Supabase 公网（新加坡） | 迁内部后数据归内网，需评估 RLS 策略是否沿用、是否需补充审计/脱敏 | 视合规要求 |

**一句话总结**：前端是零框架零构建的纯静态站，迁移落地成本主要在「数据库驱动（supabase.js）+ 鉴权（supabase auth）」两处，且代码已集中封装，改动面可控；若内部同用 PostgreSQL + 公司 SSO，整体改码量小。

---

*文档生成日期：2026-08-05 ｜ 对应线上版本：v5.8.9*
