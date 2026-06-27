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
