-- v5.9.2: 观察库操作记录表
-- 手动执行方式：Supabase Dashboard → SQL Editor → 粘贴执行
-- 用途：记录观察库内专家的调分、淘汰、自动进出库等操作，支持主管理员审计与子管理员自审

-- 1. 创建 observation_operations 表
CREATE TABLE IF NOT EXISTS observation_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id TEXT REFERENCES experts(id) ON DELETE SET NULL,
  expert_name TEXT,
  operation TEXT NOT NULL, -- adjust / release / eliminate / auto_in / auto_out / ai_reset
  operator_id TEXT,
  operator_name TEXT,
  operator_role TEXT, -- master / sub / system
  before_state JSONB,
  after_state JSONB,
  note TEXT NOT NULL DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 索引
CREATE INDEX IF NOT EXISTS idx_observation_operations_expert_id ON observation_operations(expert_id);
CREATE INDEX IF NOT EXISTS idx_observation_operations_created_at ON observation_operations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_observation_operations_operator_id ON observation_operations(operator_id);

-- 3. RLS：仅管理员可读写
ALTER TABLE observation_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "observation_operations_admin_select" ON observation_operations;
CREATE POLICY "observation_operations_admin_select" ON observation_operations
  FOR SELECT USING (is_admin_user());

DROP POLICY IF EXISTS "observation_operations_admin_insert" ON observation_operations;
CREATE POLICY "observation_operations_admin_insert" ON observation_operations
  FOR INSERT WITH CHECK (is_admin_user());
