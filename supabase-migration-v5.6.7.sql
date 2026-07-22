-- V5.6.7: 子管理员标签权限细化 — 为 fields 表添加 creator 字段
-- 手动执行方式：Supabase Dashboard → SQL Editor → 粘贴执行

-- 1. fields 表增加 creator 列（标记标签由谁创建：'master' = 主管理员, 其他字符串 = 子管理员账号名）
ALTER TABLE fields 
ADD COLUMN IF NOT EXISTS creator TEXT DEFAULT NULL;
