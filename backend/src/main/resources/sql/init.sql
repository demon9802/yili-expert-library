-- ============================================================
-- 伊利专家资源库 V6 - MySQL 建表 DDL
-- 所有表名以 yl_expert_resource_ 开头，与原有业务表完全隔离
-- ============================================================

-- 1. 用户表（替代 Supabase auth.users + profiles）
CREATE TABLE IF NOT EXISTS `yl_expert_resource_user` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `email` VARCHAR(255) NOT NULL COMMENT '邮箱',
  `password_hash` VARCHAR(255) NOT NULL COMMENT '密码哈希(BCrypt)',
  `is_admin` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否管理员: 0=否, 1=是',
  `force_password_change` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否强制改密',
  `security_questions` JSON DEFAULT NULL COMMENT '密保问题(SHA-256哈希数组)',
  `security_attempts` INT NOT NULL DEFAULT 0 COMMENT '密保尝试次数',
  `security_lock_until` DATETIME DEFAULT NULL COMMENT '密保锁定截止时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 2. 专家表
CREATE TABLE IF NOT EXISTS `yl_expert_resource_expert` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '专家ID',
  `name` VARCHAR(255) NOT NULL COMMENT '姓名',
  `fields` JSON DEFAULT NULL COMMENT '领域标签数组',
  `advantages` JSON DEFAULT NULL COMMENT '核心优势数组',
  `education` TEXT DEFAULT NULL COMMENT '教育背景',
  `qualifications` TEXT DEFAULT NULL COMMENT '资质描述',
  `courses` TEXT DEFAULT NULL COMMENT '课程',
  `contact_person` VARCHAR(255) DEFAULT '' COMMENT '联系人',
  `contact_info` VARCHAR(500) DEFAULT '' COMMENT '联系方式',
  `contact_type` VARCHAR(50) DEFAULT 'phone' COMMENT '联系方式类型: phone/wechat/email',
  `referrer` VARCHAR(255) DEFAULT '' COMMENT '推荐人',
  `is_supplier` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否供应商',
  `qual_display` TEXT DEFAULT NULL COMMENT '资质展示文本',
  `adv_display` TEXT DEFAULT NULL COMMENT '优势展示文本',
  `scores` JSON DEFAULT NULL COMMENT '评分{professional,influence,overall,subScores}',
  `status` VARCHAR(50) DEFAULT 'active' COMMENT '状态: active/inactive/observed',
  `observation_status` VARCHAR(100) DEFAULT NULL COMMENT '观察状态',
  `observation_date` DATE DEFAULT NULL COMMENT '观察日期',
  `contacts` JSON DEFAULT NULL COMMENT '联系人详情数组',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序权重',
  `created_by` VARCHAR(255) DEFAULT '主管理员' COMMENT '创建人',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`),
  KEY `idx_status` (`status`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='专家表';

-- 3. 合作项目表
CREATE TABLE IF NOT EXISTS `yl_expert_resource_project` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '项目ID',
  `title` VARCHAR(500) NOT NULL COMMENT '项目标题',
  `expert_id` BIGINT DEFAULT NULL COMMENT '关联专家ID',
  `pending_expert_name` VARCHAR(255) DEFAULT '' COMMENT '待定专家姓名',
  `year` INT NOT NULL COMMENT '年份',
  `month` INT DEFAULT NULL COMMENT '月份',
  `satisfaction` VARCHAR(50) DEFAULT NULL COMMENT '满意度(raw值)',
  `description` TEXT DEFAULT NULL COMMENT '项目描述',
  `visible` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否可见',
  `created_by` VARCHAR(255) DEFAULT '主管理员' COMMENT '创建人',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_expert_id` (`expert_id`),
  KEY `idx_year` (`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='合作项目表';

-- 4. 领域/分类表
CREATE TABLE IF NOT EXISTS `yl_expert_resource_field` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `name` VARCHAR(255) NOT NULL COMMENT '领域名称',
  `color` VARCHAR(20) NOT NULL DEFAULT '#2563EB' COMMENT '背景色',
  `text_color` VARCHAR(20) NOT NULL DEFAULT '#ffffff' COMMENT '文字色',
  `hide_when_empty` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '无专家时隐藏',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序权重',
  `creator` VARCHAR(255) DEFAULT NULL COMMENT '创建者',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='领域分类表';

-- 5. 收藏表
CREATE TABLE IF NOT EXISTS `yl_expert_resource_favorite` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `user_id` BIGINT NOT NULL COMMENT '用户ID',
  `expert_id` BIGINT NOT NULL COMMENT '专家ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_expert` (`user_id`, `expert_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收藏表';

-- 6. 应用设置表
CREATE TABLE IF NOT EXISTS `yl_expert_resource_setting` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `setting_key` VARCHAR(255) NOT NULL COMMENT '设置键',
  `setting_value` JSON DEFAULT NULL COMMENT '设置值',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='应用设置表';

-- 7. 观察库操作记录表
CREATE TABLE IF NOT EXISTS `yl_expert_resource_observation_operation` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '操作ID',
  `expert_id` BIGINT DEFAULT NULL COMMENT '专家ID',
  `expert_name` VARCHAR(255) DEFAULT '' COMMENT '专家姓名',
  `operation` VARCHAR(100) NOT NULL COMMENT '操作类型',
  `operator_id` VARCHAR(255) DEFAULT '' COMMENT '操作人ID',
  `operator_name` VARCHAR(255) DEFAULT '' COMMENT '操作人姓名',
  `operator_role` VARCHAR(50) DEFAULT 'system' COMMENT '操作人角色',
  `before_state` JSON DEFAULT NULL COMMENT '操作前状态',
  `after_state` JSON DEFAULT NULL COMMENT '操作后状态',
  `note` TEXT DEFAULT NULL COMMENT '备注',
  `tags` JSON DEFAULT NULL COMMENT '标签数组',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_expert_id` (`expert_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='观察库操作记录表';

-- 8. 页面访问记录表（用于月报统计）
CREATE TABLE IF NOT EXISTS `yl_expert_resource_page_view` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `view_date` DATE NOT NULL COMMENT '访问日期',
  `view_count` INT NOT NULL DEFAULT 0 COMMENT '访问次数',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_view_date` (`view_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='页面访问记录表';

-- 注意：初始管理员账号由 DataInitializer 在应用启动时自动创建，
-- 避免在 SQL 中硬编码 BCrypt hash。
