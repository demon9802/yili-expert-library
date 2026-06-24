/* ===== Supabase 数据层 ===== */
/* 初始化 Supabase 客户端 */
const SUPABASE_URL = 'https://owjdwwdipfsnumgoxzih.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GQR4Qj9MMaau2V-Zm7_bLA_XUhfaN6j';

// ⚠️ 不重新声明！currentUser/isAdmin/supabase 已在 index.html 内联脚本中用 var 全局声明
// 这里只做赋值，避免 let 与 var 在全局作用域冲突
try {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('Supabase client initialized');
} catch(e) {
  console.warn('Supabase SDK not loaded, running in offline mode:', e.message);
}

// ===== Auth 状态初始化 =====
currentUser = null;
isAdmin = false;

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
  var _supabase = supabase; // local ref for closure safety
  if (!_supabase) return;
  var result = await _supabase.from('profiles').select('is_admin').eq('id', currentUser.id).single();
  isAdmin = result.data && result.data.is_admin === true;
}

// ===== 登录/登出 =====
async function signInWithEmail(email) {
  var _supabase = supabase;
  if (!_supabase) throw new Error('Supabase unavailable');
  var result = await _supabase.auth.signInWithOtp({ email: email });
  if (result.error) throw result.error;
  return true;
}

async function signOut() {
  var _supabase = supabase;
  if (_supabase) await _supabase.auth.signOut();
  currentUser = null;
  isAdmin = false;
}

// ===== 专家 CRUD =====
async function fetchExperts() {
  if (!supabase) return [];
  var result = await supabase.from('experts').select('*').order('sort_order', { ascending: true }).order('id', { ascending: true });
  if (result.error) throw result.error;
  return (result.data || []).map(rowToExpert);
}

async function createExpert(expert) {
  if (!supabase) throw new Error('Supabase unavailable');
  var row = expertToRow(expert);
  delete row.id;
  if (!row.created_by) row.created_by = currentUser && currentUser.email || '主管理员';
  var result = await supabase.from('experts').insert(row).select().single();
  if (result.error) throw result.error;
  return rowToExpert(result.data);
}

async function updateExpert(id, expert) {
  if (!supabase) throw new Error('Supabase unavailable');
  var row = expertToRow(expert);
  row.updated_at = new Date().toISOString();
  var result = await supabase.from('experts').update(row).eq('id', id).select().single();
  if (result.error) throw result.error;
  return rowToExpert(result.data);
}

async function deleteExpert(id) {
  if (!supabase) throw new Error('Supabase unavailable');
  var result = await supabase.from('experts').delete().eq('id', id);
  if (result.error) throw result.error;
}

// ===== 项目 CRUD =====
async function fetchProjects() {
  if (!supabase) return [];
  var query;
  if (isAdmin) {
    query = supabase.from('projects').select('*').order('year', { ascending: false });
  } else {
    query = supabase.from('projects').select('*').eq('visible', true).order('year', { ascending: false });
  }
  var result = await query;
  if (result.error) throw result.error;
  return (result.data || []).map(rowToProject);
}

async function createProject(project) {
  if (!supabase) throw new Error('Supabase unavailable');
  var row = projectToRow(project);
  if (!row.created_by) row.created_by = currentUser && currentUser.email || '主管理员';
  var result = await supabase.from('projects').insert(row).select().single();
  if (result.error) throw result.error;
  return rowToProject(result.data);
}

async function updateProject(id, project) {
  if (!supabase) throw new Error('Supabase unavailable');
  var row = projectToRow(project);
  row.updated_at = new Date().toISOString();
  var result = await supabase.from('projects').update(row).eq('id', id).select().single();
  if (result.error) throw result.error;
  return rowToProject(result.data);
}

async function deleteProject(id) {
  if (!supabase) throw new Error('Supabase unavailable');
  var result = await supabase.from('projects').delete().eq('id', id);
  if (result.error) throw result.error;
}

// ===== 分类/领域 CRUD =====
async function fetchFields() {
  if (!supabase) return [];
  var result = await supabase.from('fields').select('*').order('sort_order', { ascending: true });
  if (result.error) throw result.error;
  return (result.data || []).map(rowToField);
}

async function createField(field) {
  if (!supabase) throw new Error('Supabase unavailable');
  var result = await supabase.from('fields').insert({
    name: field.name,
    color: field.color || '#2563EB',
    text_color: field.textColor || '#ffffff',
    hide_when_empty: field.hideWhenEmpty || false,
    sort_order: field.sortOrder || 0
  }).select().single();
  if (result.error) throw result.error;
  return rowToField(result.data);
}

async function updateField(name, field) {
  if (!supabase) return;
  var result = await supabase.from('fields').update({
    color: field.color,
    text_color: field.textColor,
    hide_when_empty: field.hideWhenEmpty,
    sort_order: field.sortOrder || 0
  }).eq('name', name);
  if (result.error) throw result.error;
}

async function deleteField(name) {
  if (!supabase) return;
  var result = await supabase.from('fields').delete().eq('name', name);
  if (result.error) throw result.error;
}

// ===== 收藏 CRUD =====
async function fetchFavorites() {
  if (!supabase || !currentUser) return [];
  var result = await supabase.from('favorites').select('expert_id').eq('user_id', currentUser.id);
  if (result.error) return [];
  return (result.data || []).map(function(f) { return f.expert_id; });
}

async function addFavorite(expertId) {
  if (!supabase || !currentUser) return false;
  var result = await supabase.from('favorites').upsert({ user_id: currentUser.id, expert_id: expertId });
  return !result.error;
}

async function removeFavorite(expertId) {
  if (!supabase || !currentUser) return false;
  var result = await supabase.from('favorites').delete().eq('user_id', currentUser.id).eq('expert_id', expertId);
  return !result.error;
}

async function isFavorite(expertId) {
  if (!supabase || !currentUser) return false;
  var result = await supabase.from('favorites').select('expert_id').eq('user_id', currentUser.id).eq('expert_id', expertId).maybeSingle();
  return !!result.data;
}

// ===== 复合加载：一次性获取页面所需数据 =====
async function loadAppData() {
  var results = await Promise.all([
    fetchExperts(),
    fetchFields(),
    fetchProjects(),
    fetchFavorites()
  ]);
  return {
    experts: results[0],
    fields: results[1],
    yiliProjects: results[2],
    favorites: results[3]
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
