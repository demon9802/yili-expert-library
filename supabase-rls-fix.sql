-- v4.26: 修复 projects / experts / fields 表的 RLS 策略
-- 系统使用本地密码管理员（不经过 Supabase Auth），因此 RLS 策略需要允许 anon 角色读写
-- 手动执行方式：Supabase Dashboard → SQL Editor → 粘贴执行

-- ① 确保 RLS 已启用（如未启用则跳过）
ALTER TABLE IF EXISTS projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS experts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS app_settings ENABLE ROW LEVEL SECURITY;

-- ② 删除旧策略（如有）
DROP POLICY IF EXISTS "projects_anon_read" ON projects;
DROP POLICY IF EXISTS "projects_anon_write" ON projects;
DROP POLICY IF EXISTS "projects_all" ON projects;
DROP POLICY IF EXISTS "experts_anon_read" ON experts;
DROP POLICY IF EXISTS "experts_anon_write" ON experts;
DROP POLICY IF EXISTS "experts_all" ON experts;
DROP POLICY IF EXISTS "fields_anon_read" ON fields;
DROP POLICY IF EXISTS "fields_anon_write" ON fields;
DROP POLICY IF EXISTS "fields_all" ON fields;
DROP POLICY IF EXISTS "app_settings_all" ON app_settings;

-- ③ 创建新策略：anon + authenticated 均可读写
-- projects 表
CREATE POLICY "projects_all" ON projects
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- experts 表
CREATE POLICY "experts_all" ON experts
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- fields 表
CREATE POLICY "fields_all" ON fields
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- app_settings 表
CREATE POLICY "app_settings_all" ON app_settings
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ④ 验证策略（可选）
-- SELECT schemaname, tablename, policyname, roles, cmd
-- FROM pg_policies
-- WHERE tablename IN ('projects', 'experts', 'fields', 'app_settings');
