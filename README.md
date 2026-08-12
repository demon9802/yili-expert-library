# 伊利集团·数智化赋能优质专家资源库

> ⚠️ **此项目已废弃（V5 及之前版本）**
>
> 自 V6 起，项目已拆分为前后端分离架构：
> - **后端**: `backend/` — Spring Boot 2.7 + MyBatis-Plus + MySQL + Redis
> - **前端**: `frontend/` — Vite + Vue3 + TypeScript + SCSS
>
> 后续所有修改请在新项目目录中进行，不要修改根目录下的旧代码（index.html, js/, css/）。
>
> 旧代码仅作为参考保留，不再维护。

## 项目结构

```
yili-expert-library/
├── index.html          # [已废弃] 旧前端入口
├── js/                 # [已废弃] 旧前端逻辑
├── css/                # [已废弃] 旧前端样式
├── data/               # [已废弃] 旧初始数据
├── backend/            # [V6] Spring Boot 后端项目
│   ├── src/main/java/com/yili/expert/resource/
│   │   ├── controller/   # REST API 控制器
│   │   ├── service/      # 业务逻辑层
│   │   ├── mapper/       # MyBatis-Plus Mapper
│   │   ├── entity/       # 数据库实体类
│   │   ├── dto/          # 数据传输对象
│   │   ├── config/       # 配置类
│   │   ├── utils/        # 工具类
│   │   └── common/       # 通用组件
│   ├── src/main/resources/
│   │   ├── application.yml       # 主配置
│   │   ├── application-{dev,sit,prod}.yml  # 环境配置
│   │   ├── bootstrap-{dev,sit,prod}.yml    # 数据库/Redis连接
│   │   └── sql/init.sql          # MySQL 建表 DDL
│   ├── pom.xml           # Maven 配置
│   └── settings.xml      # Maven 阿里云仓库配置
├── frontend/           # [V6] Vue3 前端项目
│   ├── src/
│   │   ├── api/          # API 请求层
│   │   ├── components/   # Vue 组件
│   │   ├── views/        # 页面视图
│   │   ├── store/        # Pinia 状态管理
│   │   ├── types/        # TypeScript 类型定义
│   │   ├── utils/        # 工具函数
│   │   └── styles/       # SCSS 样式
│   ├── vite.config.ts    # Vite 配置
│   └── package.json      # 依赖配置
└── docs/                # 项目文档
```

## 技术栈（V6）

### 后端
- Spring Boot 2.7.18
- MyBatis-Plus 3.5.5
- MySQL（表名前缀 `yl_expert_resource_`）
- Redis（key 前缀 `expert_resource:`）
- JWT 认证
- JDK 1.8

### 前端
- Vite 5.x
- Vue 3.4
- TypeScript 5.4
- SCSS (Sass)
- Pinia 状态管理
- Vue Router 4

## 部署

- **正式链接**: `https://yili-expert-library-bvw2itdk.zh-cn.edgeone.cool/`
- **更新方式**: git push main → EdgeOne 自动部署
