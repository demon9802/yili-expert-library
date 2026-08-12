-- v5.8.1 / v5.9.9: 月度报告 — page_views 表（事件型，支持匿名写入）
-- 手动执行方式：Supabase Dashboard → SQL Editor → 粘贴执行
-- 说明：experts.updated_at 列已存在（supabase.js 中 expertToRow 已使用），无需重复添加

-- 1. 创建 page_views 表（系统页面访问统计，每行代表一次访问事件）
CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month TEXT NOT NULL,           -- 格式：YYYY-MM
  page_path TEXT,                     -- 访问路径
  viewer_id UUID,                     -- 登录用户 ID（匿名为 NULL）
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. page_views 索引
CREATE INDEX IF NOT EXISTS idx_page_views_year_month ON page_views(year_month);

-- 3. RLS：任何人可写入访问事件，仅管理员可读取统计
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "page_views_anon_insert" ON page_views;
CREATE POLICY "page_views_anon_insert" ON page_views
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "page_views_admin_select" ON page_views;
CREATE POLICY "page_views_admin_select" ON page_views
  FOR SELECT USING (is_admin_user());

-- 4. 确认 experts.updated_at 存在（已验证存在，此处仅作文档记录）
-- 专家表 expertToRow 映射：updated_at → updatedAt
-- 保存时自动设置：row.updated_at = new Date().toISOString()
-- 如意外缺失，取消注释下方语句：
-- ALTER TABLE experts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 5. projects.updated_at 确认（已验证存在）
-- 项目表 projectToRow 映射：updated_at → updatedAt
-- 如意外缺失，取消注释下方语句：
-- ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
