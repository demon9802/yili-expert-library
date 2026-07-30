# 伊利集团·数智化赋能优质专家资源库 — 项目迁移知识包

> **用途**：项目从个人账号迁移到企业团队账号时，新 workspace 的启动知识文件。  
> **生成日期**：2026-07-30  
> **当前版本**：v5.8.8.2（DB_VERSION 14）  
> **操作用户**：同一人，同一台电脑，仅账号从个人→企业团队

---

## 一、项目定位

伊利集团数字科技中心内部使用的专家资源管理系统，用于管理外部讲师/专家的信息、评分、合作项目记录，支持多维度筛选、仪表盘分析、月度报告导出。

---

## 二、当前部署与链路

```
代码编辑 → Git push → GitHub(demon9802/yili-expert-library) → EdgeOne Pages 自动部署 → 正式链接
                                    ↕
                            Supabase 云端数据库(新加坡)
```

| 组件 | 详情 |
|------|------|
| **前端托管** | EdgeOne Pages（腾讯 CDN，国内可访问） |
| **数据库** | Supabase PostgreSQL（`owjdwwdipfsnumgoxzih.supabase.co`，ap-southeast-1） |
| **代码仓库** | GitHub `demon9802/yili-expert-library`（main 分支） |
| **认证** | Supabase Auth（Magic Link + 本地密码登录） |
| **正式链接** | `https://yili-expert-library-bvw2itdk.zh-cn.edgeone.cool/` |
| **⚠️ EdgeOne 已知问题** | 默认域名有链接过期机制，需在 EdgeOne 控制台点 Preview 获取新链接；长期方案为绑定自定义域名 |

### 关键凭证（嵌入代码中，非环境变量）

- **Supabase URL**：`https://owjdwwdipfsnumgoxzih.supabase.co`
- **Supabase Anon Key**：`sb_publishable_GQR4Qj9MMaau2V-Zm7_bLA_XUhfaN6j`
- **Supabase DB Password**：`Demon847920522`（仅数据库管理用）
- **主管理员密码**：`yili2026`

---

## 三、项目目录结构

```
yili-expert-library/
├── index.html              # 入口（版本号 v5.8.5，cache bust v=107-109）
├── js/
│   ├── app.js              # 主逻辑（~9800行，所有前端+管理后台功能）
│   ├── supabase.js         # Supabase 数据层（CRUD、认证、同步）
│   ├── data.js             # 种子数据（仅新用户首次初始化）
│   └── changelog.js        # 版本更新日志数组 VERSION_CHANGELOG
├── css/
│   └── style.css           # 全局样式含 mobile-mode
├── data/                   # 历史数据文件（已不再使用）
├── docs/
│   ├── scoring-criteria-review-2026-07-28.md    # 评分细则讨论 v1
│   └── scoring-criteria-v2-2026-07-29.md        # 评分细则讨论 v2（10分制方案）
├── tools/
│   └── console-repair-13-experts.js             # 13位专家localStorage修复脚本
├── backup/                 # 历史备份
├── images/                 # 静态图片
├── .github/workflows/      # Supabase Keep-Alive（每5天ping）
├── supabase-migration.sql  # 主数据库迁移脚本（建表+RLS+初始数据）
├── supabase-migration-v4.21.sql
├── supabase-migration-v5.6.7.sql   # ALTER TABLE fields ADD creator
├── supabase-migration-v5.8.1.sql   # page_views表+RLS
├── supabase-rls-fix.sql
├── PERMISSIONS.md          # 数据主权与权限规则汇总
├── README.md
└── MIGRATION.md            # ← 本文件
```

---

## 四、数据库结构（Supabase）

### 表结构

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `fields` | 领域分类 | id, name, color, text_color, hide_when_empty, sort_order, creator |
| `experts` | 专家信息 | id, name, fields[], advantages(jsonb), education, qualifications, courses, contact_*, scores(jsonb), status, observation_status, contacts(jsonb), sort_order |
| `projects` | 合作项目 | id(TEXT), title, expert_id(FK), pending_expert_name, year, month, satisfaction(jsonb), description, visible |
| `favorites` | 用户收藏 | user_id(UUID FK), expert_id(FK) |
| `profiles` | 用户档案 | id(UUID PK=auth.users), email, is_admin, display_name |
| `page_views` | 页面访问计数 | (v5.8.1新增，SQL未执行) |

### RLS 权限模型

- **所有人可读**：fields, experts, projects(visible=true)
- **仅管理员可写**：fields, experts, projects, profiles
- **用户私有**：favorites（只能管理自己的）
- **管理员判断函数**：`is_admin_user()` — 查询 profiles 表中 `is_admin=true`

### 管理员授权方式

在 Supabase SQL Editor 中执行：
```sql
UPDATE profiles SET is_admin = true WHERE email = '你的邮箱';
```

---

## 五、数据主权架构（核心铁律）

### 数据流

```
管理员操作 → saveDB() → localStorage（真理来源）+ Supabase（云端同步）
                                ↑
新用户首次访问 → data.js（种子数据） → localStorage 初始化
```

### 核心铁律（⚠️ 必须遵守）

1. **localStorage 是唯一数据真理来源**，`data.js` 仅用于新用户首次初始化
2. **领域颜色永久锁定**：仅由主管理员在后台「分类管理」修改，任何 migration/版本升级/页面加载不得覆盖已有颜色
3. **数据合并 UNION 策略**：`getDB()` 中 Supabase ∪ localStorage，localStorage 独有数据不得丢弃
4. **getDB() 白名单/扩散法**：v5.8.6 已改为扩散法（`...localDB`），新增 db 属性不再需要维护白名单
5. **代码 migration 不得覆盖管理员已有数据**（结构性迁移除外）
6. **管理员需覆盖数据 → 明确指令 → 手动执行脚本，绝不自动**

---

## 六、更新部署工作流

### 标准流程

1. **编辑代码**：在 `C:\Users\PC\WorkBuddy\Claw\yili-expert-library\` 下修改
2. **更新版本号**：`index.html` 中 `<title>` 版本号 + 所有 `?v=` 参数递增
3. **如有数据结构变更**：升级 `js/app.js` 中 `CURRENT_DB_VERSION`（当前14）
4. **如有新功能**：追加到 `js/changelog.js` 的 `VERSION_CHANGELOG` 数组
5. **Git 提交**：`git add` → `git commit` → `git push origin main`
6. **自动部署**：EdgeOne Pages 检测到 GitHub push → 1-2分钟自动部署

### 多工具协作

| 操作 | 工具/方式 |
|------|----------|
| Git push | GitHub Desktop 或命令行 |
| Supabase SQL | Supabase 控制台 → SQL Editor |
| 腾讯文档进度表 | WorkBuddy 中通过 tencent-docs skill |
| EdgeOne 部署 | GitHub push 自动触发 |
| EdgeOne 更新链接 | EdgeOne 控制台 → 项目 → Preview |

---

## 七、当前版本状态

### 已完成（已部署）

**v5.8.8.2**（commit `c393bef`，2026-07-29）：
- 前端专家详情分号显示修复（`formatRichText` + 自动数据迁移）
- 月度报告仪表盘4卡横向并排布局（HTML + PDF）

**v5.8.8 / v5.8.8.1**（commit `78b1750` / `06a41b8`，2026-07-28/29）：
- 批量导入修复：advDisplay/qualDisplay + parseQualPairs 分号清理
- 环形图图例双行布局防重叠（SVG + Canvas）
- 仪表盘侧并排布局 + 管理后台分值分布恢复
- 13位专家 localStorage 修复脚本
- 导入模板改【】标注、不需分号

**更早版本**：v5.8.0（月度报告）→ v5.8.1（导出PNG/PDF）→ v5.8.2（Excel导入导出升级）→ v5.8.3（手机端开关/子管理员权限）→ v5.8.4（数据合并BUG修复/仪表盘精简/管理后台排序）→ v5.8.5（getDB白名单缺陷）→ v5.8.6（白名单→扩散法）→ v5.8.7（合作项目变更分类/领域分布柱状图/分值分布环形图恢复）

### ⚠️ 待执行（SQL未跑）

- `supabase-migration-v5.8.1.sql`：创建 `page_views` 表（月度报告 Section④ 依赖）
- 需在 Supabase SQL Editor 手动执行

### 待定 / 讨论中（未实施）

1. **v5.8.7 联系方式交互**（进度表记录 `r1Vo6S`）：
   - 手机端 tel:/mailto: 直接交互 + 电脑端优化 + 多联系方式智能解析
   - 状态：正常推进，优先级 P2，未实现

2. **评分细则重构**（持续讨论）：
   - 方向：纯10分制，含子维度细化评分标准
   - 讨论文档：`docs/scoring-criteria-v2-2026-07-29.md`
   - 4项待决策：院校权威度加权、机构权威度系数、缺失信息标记、项目满意度是否纳入综合评分
   - **状态：暂存，用户待进一步衡量**

3. **EdgeOne 访问链接过期**：
   - 短期：EdgeOne 控制台 → Preview 获取新链接
   - 长期：绑定自定义域名（不过期+保留中国CDN）

---

## 八、核心源数据表

| 表名 | 链接 | file_id | sheet_id |
|------|------|---------|----------|
| ①初始源数据 | [【数字科技中心】数智化赋能优质专家库](https://docs.qq.com/sheet/DTUROVmZod2FxSGFO?tab=n99xou) | `DTUROVmZod2FxSGFO` | `n99xou` |
| ②进度更新表 | [【数科中心】专家库版本更新进度管理表](https://docs.qq.com/smartsheet/DTVJIWmh2ZXdBUE14?tab=t00i2h) | `DTVJIWmh2ZXdBUE14` | `t00i2h` |

进度表选项 ID 参考：P3=`oQaDnc`、已完成=`oA4nPs`、正常推进=`oS3t9a`、V5=`oLMyVF/o0XIU4`、UI/交互=`owWCxp`、权限设置=`ogUJac`

---

## 九、腾讯文档 MCP 使用方式

新 session 中延迟工具可能不可用，改用命令行方式：

```bash
cd "C:\Users\PC\AppData\Local\Programs\WorkBuddy\resources\app.asar.unpacked\resources\builtin-plugins\tencent-docs-plugin\skills\tencent-docs"
"C:\Users\PC\.workbuddy\binaries\python\versions\3.13.12\python.exe" tencentdocs.py tdoc_call tencent-docs <tool> '<json_args>'
```

先执行 `tdoc_init` 检查环境。

---

## 十、合作项目管理

- 项目数据：`db.yiliProjects[]`（独立数组，非附加在专家上）
- 必填字段：title + expertId（或 pendingExpertName）+ year
- 待关联项目：expertId=null → 黄色高亮，前端不显示在专家卡片上
- 满意度：存储原始 value+scale，前端统一显示10分制
- 管理后台 Tab：「合作项目管理」在「专家管理」之后
- 删除权限：仅创建者+主管理员

---

## 十一、13位专家数据修复

13位专家（2026-07-23 批量导入）仅存在于 localStorage，不在 Supabase 中。需要在新浏览器中执行修复脚本：

修复脚本：`tools/console-repair-13-experts.js`
使用方式：在正式域名下打开浏览器控制台，粘贴执行即可。

---

## 十二、迁移到企业账号操作清单

### 你需要做的（用户操作）

1. **在企业账号下创建新对话/workspace**（可以是空白对话）
2. **将本 `MIGRATION.md` 文件内容作为第一条消息发送**给新 workspace，让它理解项目全貌
3. **连接必需的 Connectors**：
   - **GitHub**（必需）：代码推送，仓库 `demon9802/yili-expert-library`
   - **EdgeOne Pages / EdgeOne Makers**（必需）：部署管理
   - **腾讯文档**（重要）：进度表更新
4. **验证部署链路**：在新 workspace 中做一次测试性的小修改 → git push → 确认 EdgeOne 自动部署
5. **确认代码本地路径不变**：`C:\Users\PC\WorkBuddy\Claw\yili-expert-library\`

### 新 workspace 启动后第一件事

新 workspace 应该：
1. 读取本 MIGRATION.md 作为项目记忆
2. 读取 `C:\Users\PC\WorkBuddy\2026-06-16-16-14-18\.workbuddy\memory\MEMORY.md`（项目记忆）
3. 读取最近的 daily log 了解最新进展
4. 确认 git remote 连接正常
5. 确认 Supabase 连接正常
6. 确认 EdgeOne 部署状态

---

## 十三、快速链接汇总

| 用途 | 链接 |
|------|------|
| 正式访问 | `https://yili-expert-library-bvw2itdk.zh-cn.edgeone.cool/` |
| GitHub 仓库 | `https://github.com/demon9802/yili-expert-library` |
| Supabase 控制台 | `https://supabase.com/dashboard/project/owjdwwdipfsnumgoxzih` |
| 腾讯文档源数据 | `https://docs.qq.com/sheet/DTUROVmZod2FxSGFO?tab=n99xou` |
| 腾讯文档进度表 | `https://docs.qq.com/smartsheet/DTVJIWmh2ZXdBUE14?tab=t00i2h` |
| EdgeOne 控制台 | 登录腾讯云 → EdgeOne Pages → yili-expert-library 项目 |

---

*此文件应在迁移完成后由新 workspace 读取作为初始记忆，之后新 workspace 会建立自己的 daily log。*
