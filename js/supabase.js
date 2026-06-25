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

// ===== 用户密码注册/登录（关闭邮件确认） =====
async function signUpWithPassword(email, password) {
  if (!supabase) throw new Error('Supabase SDK 未加载，请刷新页面重试');
  const { data, error } = await supabase.auth.signUp({ 
    email, 
    password,
    options: { emailRedirectTo: window.location.origin }
  });
  if (error) {
    // 常见错误翻译
    var msg = error.message || '';
    if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('duplicate')) {
      throw new Error('该邮箱已注册，请直接登录');
    }
    if (msg === '0' || msg.includes('network') || msg.includes('fetch')) {
      throw new Error('网络请求失败，请检查网络连接后重试');
    }
    throw error;
  }
  // 如果 Supabase 开启了邮箱确认，signUp 返回 user 但 session 为 null
  if (!data.user && !data.session) {
    throw new Error('注册请求已提交，请检查邮箱确认链接，或联系管理员关闭邮箱验证');
  }
  return data;
}

async function signInWithPassword(email, password) {
  if (!supabase) throw new Error('Supabase SDK 未加载，请刷新页面重试');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    var msg = error.message || '';
    if (msg === '0' || msg.includes('network') || msg.includes('fetch')) {
      throw new Error('网络请求失败，请检查网络连接后重试');
    }
    throw error;
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
