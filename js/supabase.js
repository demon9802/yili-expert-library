/* ===== Supabase 数据层 ===== */
/* 初始化 Supabase 客户端 */
const SUPABASE_URL = 'https://owjdwwdipfsnumgoxzih.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GQR4Qj9MMaau2V-Zm7_bLA_XUhfaN6j';

// 注意：不声明 supabase 变量（CDN SDK 已用 var supabase 声明全局变量，let 会导致 SyntaxError）
try {
  if (typeof window.supabase !== 'undefined') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client initialized');
  } else {
    console.warn('Supabase CDN SDK not loaded');
  }
} catch(e) {
  console.warn('Supabase SDK init failed:', e.message);
}

// ===== Auth 状态 =====
var currentUser = null;
var isAdmin = false;

// 仅在 supabase 可用时初始化 auth
if (supabase) {
  supabase.auth.getSession().then(function(res) {
    var session = res.data && res.data.session;
    if (session) {
      currentUser = session.user;
      checkAdminStatus();
    }
  });
  supabase.auth.onAuthStateChange(function(event, session) {
    if (session) {
      currentUser = session.user;
      checkAdminStatus();
    } else {
      currentUser = null;
      isAdmin = false;
    }
  });
}

async function checkAdminStatus() {
  if (!currentUser) { isAdmin = false; return; }
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', currentUser.id).single();
  isAdmin = data?.is_admin === true;
}

// ===== 登录/登出 =====
async function signInWithEmail(email) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw error;
  return true;
}

async function signOut() {
  await supabase.auth.signOut();
  currentUser = null;
  isAdmin = false;
}

// ===== v4.20: 密码管理 =====
async function resetPassword(email) {
  if (!supabase) throw new Error('Supabase SDK 未加载，请刷新页面重试');
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });
  if (error) {
    var msg = String(error.message || '');
    if (msg.includes('rate') || msg.includes('limit')) throw new Error('请求过于频繁，请稍后再试');
    throw new Error(msg || '发送重置邮件失败');
  }
  return true;
}

async function changePassword(newPassword) {
  if (!supabase) throw new Error('Supabase SDK 未加载，请刷新页面重试');
  if (!currentUser) throw new Error('未登录，请先登录');
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    var msg = String(error.message || '');
    if (msg.includes('same as old')) throw new Error('新密码不能与旧密码相同');
    throw new Error(msg || '修改密码失败');
  }
  return true;
}

// v4.20: 重新认证（修改密码前验旧密码）
async function reauthenticate(password) {
  if (!supabase) throw new Error('Supabase SDK 未加载，请刷新页面重试');
  if (!currentUser) throw new Error('未登录，请先登录');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: currentUser.email,
    password: password
  });
  if (error) {
    var msg = String(error.message || '');
    if (msg.includes('Invalid login') || msg.includes('invalid')) throw new Error('旧密码错误');
    throw new Error(msg || '验证失败');
  }
  return true;
}

// ===== v4.21: 密保问题 + 用户管理 =====

// 保存密保问题（答案经客户端SHA-256哈希后存储）
async function saveSecurityQuestions(questions) {
  if (!supabase || !currentUser) throw new Error('未登录');
  if (!Array.isArray(questions) || questions.length !== 3) throw new Error('密保问题需填写 3 道');
  var hashed = questions.map(function(a) {
    return sha256(a.trim());
  });
  var { error } = await supabase.from('profiles').update({
    security_questions: hashed,
    security_attempts: 0,
    security_lock_until: null
  }).eq('id', currentUser.id);
  if (error) throw error;
  return true;
}

// 获取某用户的密保问题文本
async function getSecurityQuestionTexts(userId) {
  if (!supabase) return null;
  var { data } = await supabase.from('profiles').select('security_questions, security_lock_until, security_attempts').eq('id', userId).single();
  if (!data || !data.security_questions) return null;
  return {
    locked: data.security_lock_until && new Date(data.security_lock_until) > new Date(),
    lockUntil: data.security_lock_until,
    attemptsRemaining: Math.max(0, 3 - (data.security_attempts || 0)),
    questions: data.security_questions
  };
}

// 服务端验证密保答案（通过 RPC 调用 PostgreSQL 函数）
async function verifySecurityAnswers(userId, answers) {
  if (!supabase) throw new Error('Supabase 未加载');
  if (!Array.isArray(answers) || answers.length !== 3) throw new Error('需要回答 3 道密保题');
  var hashed = answers.map(function(a) { return sha256(a.trim()); });
  var { data, error } = await supabase.rpc('verify_security_answers', {
    p_user_id: userId,
    p_answers: hashed
  });
  if (error) {
    // RPC 尚未部署 → 客户端本地验证作为降级方案
    console.warn('verify_security_answers RPC not available, using client fallback');
    return verifySecurityAnswersClient(userId, answers);
  }
  return data;
}

// 客户端本地密保验证（RPC 不可用时的降级方案）
async function verifySecurityAnswersClient(userId, answers) {
  var info = await getSecurityQuestionTexts(userId);
  if (!info || !info.questions) return { success: false, error: '未设置密保问题' };
  if (info.locked) return { success: false, error: '密保已锁定，请稍后重试' };
  
  var allMatch = true;
  for (var i = 0; i < 3; i++) {
    if (sha256(String(answers[i] || '').trim()) !== info.questions[i]) {
      allMatch = false;
      break;
    }
  }
  
  if (allMatch) {
    await supabase.from('profiles').update({ security_attempts: 0, security_lock_until: null }).eq('id', userId);
    return { success: true };
  } else {
    var newAttempts = (info.attemptsRemaining > 0 ? (3 - info.attemptsRemaining) : 0) + 1;
    if (newAttempts >= 3) {
      await supabase.from('profiles').update({ security_attempts: newAttempts, security_lock_until: new Date(Date.now() + 5 * 60 * 1000).toISOString() }).eq('id', userId);
      return { success: false, error: '答错次数过多，密保已锁定 5 分钟' };
    } else {
      await supabase.from('profiles').update({ security_attempts: newAttempts }).eq('id', userId);
      return { success: false, error: '密保答案错误，还剩 ' + (3 - newAttempts) + ' 次机会' };
    }
  }
}

// 密保验证通过后修改密码
async function changePasswordAfterSecurityVerification(userId, newPassword) {
  if (!supabase) throw new Error('Supabase 未加载');
  if (!newPassword || newPassword.length < 6) throw new Error('新密码至少 6 位');
  var { error } = await supabase.rpc('admin_reset_password_by_id', {
    p_user_id: userId,
    p_password: newPassword
  });
  if (error) {
    console.warn('admin_reset_password_by_id RPC failed:', error.message);
    throw new Error('密码修改失败，请确认 SQL 迁移已执行（supabase-migration-v4.21.sql）');
  }
  return true;
}

// 管理员获取用户列表
async function fetchUserList() {
  if (!supabase) return [];
  var { data, error } = await supabase.rpc('get_user_list');
  if (error) {
    console.warn('get_user_list RPC failed, fallback:', error.message);
    var { data: d2, error: e2 } = await supabase.from('profiles').select('id, is_admin, security_questions, force_password_change');
    if (e2) return [];
    return (d2 || []).map(function(p) {
      return {
        id: p.id,
        email: '',
        is_admin: p.is_admin,
        has_security_questions: !!p.security_questions,
        force_password_change: p.force_password_change,
        created_at: null
      };
    });
  }
  return data || [];
}

// 管理员重置用户密码
async function adminResetUserPassword(userId, tempPassword) {
  if (!supabase) throw new Error('Supabase 未加载');
  var { error } = await supabase.rpc('admin_reset_password_by_id', {
    p_user_id: userId,
    p_password: tempPassword
  });
  if (error) {
    console.warn('admin_reset_password_by_id RPC failed:', error.message);
    throw new Error('重置失败，请确认 SQL 迁移已执行');
  }
  var { error: e2 } = await supabase.from('profiles').update({
    force_password_change: true
  }).eq('id', userId);
  if (e2) console.warn('标记强制改密失败:', e2.message);
  return true;
}

// 检查是否需要强制改密
async function checkForcePasswordChange() {
  if (!supabase || !currentUser) return false;
  var { data } = await supabase.from('profiles').select('force_password_change').eq('id', currentUser.id).single();
  return data?.force_password_change === true;
}

// 清除强制改密标记
async function clearForcePasswordChange() {
  if (!supabase || !currentUser) return;
  await supabase.from('profiles').update({ force_password_change: false }).eq('id', currentUser.id);
}

// ===== 用户密码注册/登录（关闭邮件确认） =====
// 注意事项：
// 1. Supabase Dashboard → Authentication → Settings → "Confirm email" 须关闭
// 2. 关闭后 signUp 直接返回 session，无需邮箱验证
// 3. 注册失败"0"通常是 Supabase SDK 未能正确解析后端错误（如数据库故障）
async function signUpWithPassword(email, password) {
  if (!supabase) throw new Error('Supabase SDK 未加载，请刷新页面重试');
  console.log('[signUp] 开始注册:', email, '| Supabase URL:', SUPABASE_URL);
  try {
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password
    });
    
    if (error) {
      // 安全获取错误消息
      var msg = String(error.message != null ? error.message : '');
      var code = error.code || error.status || '';
      var status = error.status || 0;
      
      console.error('[signUp] 错误详情:', JSON.stringify({ message: msg, code: code, status: status, name: error.name }));
      
      // 已有账号
      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('duplicate') || code === 'user_already_exists') {
        throw new Error('该邮箱已注册，请直接登录');
      }
      // 网络错误 或 SDK 返回空消息
      if (msg === '0' || msg === '' || msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) {
        throw new Error('Supabase 连接失败（code:' + (code || '0') + '），请检查：\n1. 网络是否正常\n2. Supabase 项目状态 → Dashboard 查看项目是否 Active\n3. Database → Extensions 确认 pgcrypto 已启用');
      }
      // 邮箱确认相关
      if (msg.includes('not confirmed') || msg.includes('verify') || msg.includes('confirm')) {
        throw new Error('邮箱验证未关闭 → Supabase Dashboard → Authentication → Settings → 关闭 "Confirm email"');
      }
      // 频率限制
      if (status === 429 || msg.includes('rate') || msg.includes('limit')) {
        throw new Error('请求过于频繁，请稍后再试');
      }
      // 数据库错误
      if (msg.includes('Database error') || msg.includes('unexpected_failure') || status >= 500) {
        throw new Error('Supabase 数据库错误（' + (msg || 'Code ' + status) + '）→ 请检查 Supabase Dashboard 中 Database 是否正常、Extensions 是否启用');
      }
      // 其他错误，原样输出
      throw new Error(msg || ('Supabase 返回未知错误: ' + (code || '??')));
    }
    
    console.log('[signUp] 注册返回:', data ? (data.user ? '有user, session='+(data.session?'有':'无') : '有data无user') : '无data');
    // 邮箱确认已开启但未关闭：返回 user 但没有 session
    if (data.user && !data.session) {
      throw new Error('邮箱验证未关闭 → 请检查收件箱点击确认链接，或联系管理员在 Supabase 中关闭 "Confirm email"');
    }
    if (!data.user && !data.session) {
      throw new Error('注册返回异常：未获取到用户信息，请稍后重试');
    }
    return data;
  } catch(e) {
    // 已经是翻译过的 Error 直接抛出
    var emsg = String(e.message || '');
    if (emsg.indexOf('注册') >= 0 || emsg.indexOf('邮箱') >= 0 || emsg.indexOf('已注册') >= 0 || emsg.indexOf('无法连接') >= 0 || emsg.indexOf('请求过于频繁') >= 0 || emsg.indexOf('Supabase') >= 0) throw e;
    if (emsg.indexOf('网络') >= 0 || emsg.indexOf('SDK') >= 0) throw e;
    // 原始错误展示
    if (emsg && emsg !== '0') { throw new Error(emsg); }
    // 兜底
    console.error('[signUp] 未预期的异常:', e);
    throw new Error('Supabase 连接失败，请确认项目状态正常（Dashboard → 项目设置）');
  }
}

async function signInWithPassword(email, password) {
  if (!supabase) throw new Error('Supabase SDK 未加载，请刷新页面重试');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    var msg = String(error.message != null ? error.message : '');
    var code = error.code || error.status || '';
    if (msg === '0' || msg === '' || msg.includes('network') || msg.includes('fetch') || msg.includes('Failed to fetch')) {
      throw new Error('Supabase 连接失败（code:' + (code || '0') + '），请检查网络和 Supabase 项目状态');
    }
    if (msg.includes('Invalid login') || msg.includes('invalid')) {
      throw new Error('密码错误，请重试');
    }
    throw new Error(msg || ('登录失败: ' + (code || '未知错误')));
  }
  currentUser = data.user;
  await checkAdminStatus();
  return data;
}

// ===== 专家 CRUD =====
async function fetchExperts() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('experts').select('*').order('sort_order', { ascending: true }).order('id', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToExpert);
}

async function createExpert(expert) {
  if (!supabase) throw new Error('Supabase unavailable');
  const row = expertToRow(expert);
  delete row.id; // let DB auto-generate
  if (!row.created_by) row.created_by = currentUser?.email || '主管理员';
  const { data, error } = await supabase.from('experts').insert(row).select().single();
  if (error) throw error;
  return rowToExpert(data);
}

async function updateExpert(id, expert) {
  if (!supabase) throw new Error('Supabase unavailable');
  const row = expertToRow(expert);
  row.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('experts').update(row).eq('id', id).select().single();
  if (error) throw error;
  return rowToExpert(data);
}

async function deleteExpert(id) {
  if (!supabase) throw new Error('Supabase unavailable');
  const { error } = await supabase.from('experts').delete().eq('id', id);
  if (error) throw error;
}

// ===== 项目 CRUD =====
async function fetchProjects() {
  if (!supabase) return [];
  if (isAdmin) {
    const { data, error } = await supabase.from('projects').select('*').order('year', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToProject);
  }
  const { data, error } = await supabase.from('projects').select('*').eq('visible', true).order('year', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToProject);
}

async function createProject(project) {
  if (!supabase) throw new Error('Supabase unavailable');
  const row = projectToRow(project);
  if (!row.created_by) row.created_by = currentUser?.email || '主管理员';
  const { data, error } = await supabase.from('projects').insert(row).select().single();
  if (error) throw error;
  return rowToProject(data);
}

async function updateProject(id, project) {
  if (!supabase) throw new Error('Supabase unavailable');
  const row = projectToRow(project);
  row.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('projects').update(row).eq('id', id).select().single();
  if (error) throw error;
  return rowToProject(data);
}

async function deleteProject(id) {
  if (!supabase) throw new Error('Supabase unavailable');
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

// ===== 分类/领域 CRUD =====
async function fetchFields() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('fields').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToField);
}

async function createField(field) {
  if (!supabase) throw new Error('Supabase unavailable');
  const { data, error } = await supabase.from('fields').insert({
    name: field.name,
    color: field.color || '#2563EB',
    text_color: field.textColor || '#ffffff',
    hide_when_empty: field.hideWhenEmpty || false,
    sort_order: field.sortOrder || 0
  }).select().single();
  if (error) throw error;
  return rowToField(data);
}

async function updateField(name, field) {
  if (!supabase) return;
  const { error } = await supabase.from('fields').update({
    color: field.color,
    text_color: field.textColor,
    hide_when_empty: field.hideWhenEmpty,
    sort_order: field.sortOrder || 0
  }).eq('name', name);
  if (error) throw error;
}

async function deleteField(name) {
  if (!supabase) return;
  const { error } = await supabase.from('fields').delete().eq('name', name);
  if (error) throw error;
}

// ===== 收藏 CRUD =====
// 获取当前用户 ID（兜底：session 尚未恢复时主动查询）
async function getUserId() {
  if (currentUser && currentUser.id) return currentUser.id;
  if (!supabase) return null;
  try {
    var r = await supabase.auth.getSession();
    if (r.data && r.data.session) {
      currentUser = r.data.session.user;
      return currentUser.id;
    }
  } catch(e) {}
  return null;
}

async function fetchFavorites() {
  if (!supabase) return [];
  var uid = await getUserId();
  if (!uid) return [];
  const { data, error } = await supabase.from('favorites').select('expert_id').eq('user_id', uid);
  if (error) return [];
  return (data || []).map(f => f.expert_id);
}

async function addFavorite(expertId) {
  if (!supabase) return false;
  var uid = await getUserId();
  if (!uid) return false;
  const { error } = await supabase.from('favorites').upsert({ user_id: uid, expert_id: expertId });
  return !error;
}

async function removeFavorite(expertId) {
  if (!supabase) return false;
  var uid = await getUserId();
  if (!uid) return false;
  const { error } = await supabase.from('favorites').delete().eq('user_id', uid).eq('expert_id', expertId);
  return !error;
}

async function isFavorite(expertId) {
  if (!supabase || !currentUser) return false;
  const { data } = await supabase.from('favorites').select('expert_id').eq('user_id', currentUser.id).eq('expert_id', expertId).maybeSingle();
  return !!data;
}

// ===== 复合加载：一次性获取页面所需数据 =====
async function loadAppData() {
  const [expertsResult, fieldsResult, projectsResult, favsResult] = await Promise.all([
    fetchExperts(),
    fetchFields(),
    fetchProjects(),
    fetchFavorites()
  ]);
  return {
    experts: expertsResult,
    fields: fieldsResult,
    yiliProjects: projectsResult,
    favorites: favsResult
  };
}

// ===== 数据转换：Supabase row ↔ App model =====
function rowToExpert(row) {
  return {
    id: row.id,
    name: row.name,
    fields: row.fields || [],
    advantages: row.advantages || [],
    education: row.education || '',
    qualifications: row.qualifications || '',
    courses: row.courses || '',
    contactPerson: row.contact_person || '',
    contactInfo: row.contact_info || '',
    contactType: row.contact_type || 'phone',
    referrer: row.referrer || '',
    isSupplier: row.is_supplier,
    qualDisplay: row.qual_display || '',
    advDisplay: row.adv_display || '',
    scores: row.scores || { professional: null, influence: null, overall: null },
    status: row.status || 'active',
    observationStatus: row.observation_status || null,
    observationDate: row.observation_date || null,
    contacts: row.contacts || [],
    createdBy: row.created_by || '主管理员',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function expertToRow(expert) {
  return {
    id: expert.id,
    name: expert.name,
    fields: expert.fields || [],
    advantages: expert.advantages || [],
    education: expert.education || '',
    qualifications: expert.qualifications || '',
    courses: expert.courses || '',
    contact_person: expert.contactPerson || '',
    contact_info: expert.contactInfo || '',
    contact_type: expert.contactType || 'phone',
    referrer: expert.referrer || '',
    is_supplier: expert.isSupplier || false,
    qual_display: expert.qualDisplay || '',
    adv_display: expert.advDisplay || '',
    scores: expert.scores || { professional: null, influence: null, overall: null },
    status: expert.status || 'active',
    observation_status: expert.observationStatus || null,
    observation_date: expert.observationDate || null,
    contacts: expert.contacts || [],
    created_by: expert.createdBy || '主管理员',
    created_at: expert.createdAt || new Date().toISOString(),
    updated_at: expert.updatedAt || new Date().toISOString()
  };
}

function rowToProject(row) {
  return {
    id: row.id,
    title: row.title,
    expertId: row.expert_id,
    pendingExpertName: row.pending_expert_name || '',
    year: row.year,
    month: row.month || null,
    satisfaction: row.satisfaction || null,
    desc: row.description || '',
    visible: row.visible,
    createdBy: row.created_by || '主管理员',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function projectToRow(project) {
  return {
    id: project.id,
    title: project.title,
    expert_id: project.expertId,
    pending_expert_name: project.pendingExpertName || '',
    year: project.year,
    month: project.month || null,
    satisfaction: project.satisfaction || null,
    description: project.desc || '',
    visible: project.visible !== false,
    created_by: project.createdBy || '主管理员',
    created_at: project.createdAt || new Date().toISOString(),
    updated_at: project.updatedAt || new Date().toISOString()
  };
}

function rowToField(row) {
  return {
    name: row.name,
    color: row.color,
    textColor: row.text_color || '#ffffff',
    hideWhenEmpty: row.hide_when_empty || false,
    sortOrder: row.sort_order || 0
  };
}

// ===== 权限数据同步（子管理员账号 + 分享设置）=====
async function syncPermissions(permissionsData) {
  if (!supabase) return;
  const { error } = await supabase.from('app_settings').upsert({
    key: 'permissions',
    value: permissionsData,
    updated_at: new Date().toISOString()
  }, { onConflict: 'key' });
  if (error) console.warn('Permissions sync warning:', error.message);
}

async function fetchPermissions() {
  if (!supabase) return null;
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'permissions').maybeSingle();
  if (error || !data) return null;
  return data.value;
}

// ===== v4.21: SHA-256 纯客户端实现（不依赖外部库）=====
function sha256(str) {
  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
  function ch(x, y, z) { return (x & y) ^ (~x & z); }
  function maj(x, y, z) { return (x & y) ^ (x & z) ^ (y & z); }
  function bsig0(x) { return rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22); }
  function bsig1(x) { return rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25); }
  function ssig0(x) { return rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3); }
  function ssig1(x) { return rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10); }

  var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];

  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) { bytes.push(0xc0 | (code >>> 6)); bytes.push(0x80 | (code & 0x3f)); }
    else if (code < 0xd800 || code >= 0xe000) {
      bytes.push(0xe0 | (code >>> 12)); bytes.push(0x80 | ((code >>> 6) & 0x3f)); bytes.push(0x80 | (code & 0x3f));
    } else {
      i++; code = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      bytes.push(0xf0 | (code >>> 18)); bytes.push(0x80 | ((code >>> 12) & 0x3f));
      bytes.push(0x80 | ((code >>> 6) & 0x3f)); bytes.push(0x80 | (code & 0x3f));
    }
  }

  var bitLen = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  for (var j = 7; j >= 0; j--) bytes.push(Math.floor(bitLen / Math.pow(2, j * 8)) & 0xff);

  var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  for (var b = 0; b < bytes.length; b += 64) {
    var W = new Array(64);
    var t;
    for (t = 0; t < 16; t++)
      W[t] = bytes[b + t * 4] << 24 | bytes[b + t * 4 + 1] << 16 | bytes[b + t * 4 + 2] << 8 | bytes[b + t * 4 + 3];
    for (t = 16; t < 64; t++) W[t] = (ssig1(W[t - 2]) + W[t - 7] + ssig0(W[t - 15]) + W[t - 16]) >>> 0;
    var a = H[0], bv = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (t = 0; t < 64; t++) {
      var T1 = (h + bsig1(e) + ch(e, f, g) + K[t] + W[t]) >>> 0;
      var T2 = (bsig0(a) + maj(a, bv, c)) >>> 0;
      h = g; g = f; f = e; e = (d + T1) >>> 0; d = c; c = bv; bv = a; a = (T1 + T2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + bv) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  var hex = '';
  for (var k = 0; k < 8; k++) {
    var val = H[k];
    hex += ((val >>> 24) & 0xff).toString(16).padStart(2, '0');
    hex += ((val >>> 16) & 0xff).toString(16).padStart(2, '0');
    hex += ((val >>> 8) & 0xff).toString(16).padStart(2, '0');
    hex += (val & 0xff).toString(16).padStart(2, '0');
  }
  return hex;
}
