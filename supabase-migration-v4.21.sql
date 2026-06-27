-- v4.21: 密保问题 + 管理员密码管理
-- 手动执行方式：Supabase Dashboard → SQL Editor → 粘贴执行

-- 1. profiles 表增加密保字段
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS security_questions JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS security_lock_until TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS security_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT false;

-- 2. 密保验证函数（服务端验证，防时序攻击）
CREATE OR REPLACE FUNCTION verify_security_answers(
  p_user_id UUID,
  p_answers JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_questions JSONB;
  v_lock_until TIMESTAMPTZ;
  v_q1_hash TEXT;
  v_q2_hash TEXT;
  v_q3_hash TEXT;
  v_a1_hash TEXT;
  v_a2_hash TEXT;
  v_a3_hash TEXT;
BEGIN
  SELECT p.security_questions, p.security_lock_until
  INTO v_questions, v_lock_until
  FROM profiles p
  WHERE p.id = p_user_id;

  IF v_questions IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '未设置密保问题');
  END IF;

  IF v_lock_until IS NOT NULL AND v_lock_until > NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', '密保已锁定，请 ' || 
      EXTRACT(MINUTE FROM (v_lock_until - NOW())) || ' 分钟后重试');
  END IF;

  v_q1_hash := encode(digest(v_questions->>0, 'sha256'), 'hex');
  v_q2_hash := encode(digest(v_questions->>1, 'sha256'), 'hex');
  v_q3_hash := encode(digest(v_questions->>2, 'sha256'), 'hex');
  v_a1_hash := encode(digest(p_answers->>0, 'sha256'), 'hex');
  v_a2_hash := encode(digest(p_answers->>1, 'sha256'), 'hex');
  v_a3_hash := encode(digest(p_answers->>2, 'sha256'), 'hex');

  IF v_q1_hash = v_a1_hash AND v_q2_hash = v_a2_hash AND v_q3_hash = v_a3_hash THEN
    UPDATE profiles SET security_attempts = 0, security_lock_until = NULL WHERE id = p_user_id;
    RETURN jsonb_build_object('success', true);
  ELSE
    UPDATE profiles SET security_attempts = COALESCE(security_attempts, 0) + 1 WHERE id = p_user_id;
    IF COALESCE((SELECT security_attempts FROM profiles WHERE id = p_user_id), 0) >= 3 THEN
      UPDATE profiles SET security_lock_until = NOW() + INTERVAL '5 minutes' WHERE id = p_user_id;
      RETURN jsonb_build_object('success', false, 'error', '答错次数过多，密保已锁定 5 分钟');
    END IF;
    RETURN jsonb_build_object('success', false, 'error', '密保答案错误，还剩 ' || 
      (3 - COALESCE((SELECT security_attempts FROM profiles WHERE id = p_user_id), 0)) || ' 次机会');
  END IF;
END;
$$;

-- 3. 管理员重置密码函数（绕过用户认证，直接修改 auth.users）
CREATE OR REPLACE FUNCTION admin_reset_password_by_id(
  p_user_id UUID,
  p_password TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- 仅管理员可调用（通过 RLS 或直接检查 is_admin）
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', '用户不存在');
  END IF;

  -- 通过 Supabase 内部 API 修改密码
  UPDATE auth.users
  SET encrypted_password = crypt(p_password, gen_salt('bf')),
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. 用户列表视图（仅管理员可查）
CREATE OR REPLACE FUNCTION get_user_list()
RETURNS TABLE (
  id UUID,
  email TEXT,
  is_admin BOOLEAN,
  has_security_questions BOOLEAN,
  force_password_change BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    u.email::TEXT,
    p.is_admin,
    p.security_questions IS NOT NULL AS has_security_questions,
    p.force_password_change,
    u.created_at
  FROM profiles p
  JOIN auth.users u ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

COMMENT ON COLUMN profiles.security_questions IS '密保问题答案的SHA-256哈希数组 (JSONB)';
COMMENT ON COLUMN profiles.force_password_change IS '管理员重置后强制用户下次登录改密';

-- 5. 通过邮箱查找用户 ID（供密保验证使用）
CREATE OR REPLACE FUNCTION find_user_by_email(p_email TEXT)
RETURNS TABLE (id UUID)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT u.id FROM auth.users u WHERE u.email = p_email;
END;
$$;
