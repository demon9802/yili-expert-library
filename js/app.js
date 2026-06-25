/* ===== 伊利集团·数智化赋能优质专家资源库 - 主应用 ===== */
/* Version 4.12 | 2026-06-25 | 筛选UI高亮修复 + syncFilterUI */

// 前端版本标记 - 打开控制台（F12）可查看当前加载版本
console.log('%c[专家资源库 v4.12] 加载时间: ' + new Date().toLocaleString() + ' | Supabase Cloud', 'color:#059669;font-weight:700;font-size:13px;');

// v4.0 兜底声明 — 确保 supabase.js 的全局变量在任何情况下都可用
if (typeof currentUser === 'undefined') var currentUser = null;
if (typeof isAdmin === 'undefined') var isAdmin = false;

// ===== DATA STORE =====
const STORAGE_KEY = 'yili_expert_db';
const ADMIN_KEY = 'yili_admin_config';
const FAVORITES_KEY = 'yili_expert_favorites';

// ===== v4.1 测试模式 =====
const TEST_MODE_KEY = 'yili_test_mode';
const TEST_STORAGE_KEY = 'yili_expert_db_test';
const TEST_FAVORITES_KEY = 'yili_expert_favorites_test';
var testModeRole = 'user'; // 测试模式默认角色：master | sub | user

function isTestMode() {
  return localStorage.getItem(TEST_MODE_KEY) === 'true';
}

function enterTestMode() {
  localStorage.setItem(TEST_MODE_KEY, 'true');
  window.location.reload(true);
}

function exitTestMode() {
  localStorage.removeItem(TEST_MODE_KEY);
  localStorage.removeItem(TEST_STORAGE_KEY);
  localStorage.removeItem(TEST_FAVORITES_KEY);
  window.location.reload(true);
}

function switchTestRole(role) {
  testModeRole = role;
  if (role === 'user') {
    isAdmin = false;
    currentUser = null;
    appState.currentUser = null;
    appState.mode = 'frontend';
    renderFrontend();
  } else if (role === 'master') {
    currentUser = { role: 'master' };
    isAdmin = true;
    appState.currentUser = { role: 'master' };
    appState.mode = 'admin';
    appState.adminTab = 'experts';
    renderAdmin();
  } else if (role === 'sub') {
    currentUser = { role: 'sub', account: 'test_sub', permissions: getDefaultSubPermissions() };
    isAdmin = true;
    appState.currentUser = currentUser;
    appState.mode = 'admin';
    appState.adminTab = 'experts';
    renderAdmin();
  }
}

// v4.2: 测试模式 — 优先从真实环境快照初始化，不使用 Supabase
async function loadTestDB() {
  // 1. 尝试加载已有的测试数据
  const raw = localStorage.getItem(TEST_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.experts && parsed.experts.length > 0) {
        console.log('[test mode] 使用已有测试数据:', parsed.experts.length, '位专家');
        return parsed;
      }
    } catch(e) { console.warn('[test mode] 测试数据损坏，重新初始化'); }
  }
  
  // 2. 无测试数据 → 从真实环境 localStorage 快照初始化（含管理员已设置的分类颜色、项目数据等）
  var seedDb = null;
  const realRaw = localStorage.getItem(STORAGE_KEY);
  if (realRaw) {
    try {
      const realDb = JSON.parse(realRaw);
      if (realDb && realDb.experts && realDb.experts.length > 0) {
        seedDb = JSON.parse(JSON.stringify(realDb)); // 深拷贝，隔离测试环境
        console.log('[test mode] 从真实环境数据快照初始化:', seedDb.experts.length, '位专家,', (seedDb.yiliProjects||[]).length, '个项目');
      }
    } catch(e) { console.warn('[test mode] 真实数据解析失败，回退到种子数据'); }
  }
  
  // 3. 真实环境无数据 → 从 Supabase 异步获取（异步不阻塞，但耗时）
  if (!seedDb && typeof supabase !== 'undefined') {
    try {
      console.log('[test mode] 尝试从 Supabase 获取数据快照...');
      const { data: expertsData } = await supabase.from('experts').select('*');
      const { data: fieldsData } = await supabase.from('fields').select('*');
      const { data: projectsData } = await supabase.from('yili_projects').select('*');
      if (expertsData && expertsData.length > 0) {
        seedDb = { experts: expertsData, fields: fieldsData || [], yiliProjects: projectsData || [], favorites: [] };
        console.log('[test mode] 从 Supabase 快照初始化:', seedDb.experts.length, '位专家');
      }
    } catch(e) { console.warn('[test mode] Supabase 快照失败:', e.message); }
  }
  
  // 4. 最终回退：从 data.js 种子数据
  if (!seedDb) {
    if (typeof EXPERT_DATA === 'undefined') {
      console.error('[test mode] 所有数据源均不可用');
      return { experts: [], fields: [], yiliProjects: [], favorites: [], permissions: { adminPassword:'yili2026', users:[], shareSettings:{ linkActive:true, requireLogin:true } }, ratingConfig: JSON.parse(JSON.stringify(DEFAULT_RATING_CONFIG)), sortOptions: DEFAULT_SORT_OPTIONS, uiConfig: JSON.parse(JSON.stringify(DEFAULT_UI_CONFIG)), categoryConfig:[], dashboardConfig:{}, observationLibrary:[], version: CURRENT_DB_VERSION, updateTime:new Date().toISOString() };
    }
    console.log('[test mode] 回退到 data.js 种子数据');
    seedDb = JSON.parse(JSON.stringify(EXPERT_DATA));
  }
  
  // 统一设置测试环境固定配置
  seedDb.permissions = { adminPassword: 'yili2026', users: [
    { account: 'testsub', password: 'test123', permissions: getDefaultSubPermissions(), addedAt: new Date().toISOString() }
  ], shareSettings: { linkActive: true, requireLogin: true } };
  seedDb.ratingConfig = JSON.parse(JSON.stringify(DEFAULT_RATING_CONFIG));
  seedDb.sortOptions = DEFAULT_SORT_OPTIONS;
  seedDb.uiConfig = JSON.parse(JSON.stringify(DEFAULT_UI_CONFIG));
  seedDb.dashboardConfig = { chartType: 'doughnut', showCharts: ['fields', 'scoreNumeric', 'scoreDist'], barChartType: 'bar' };
  seedDb.yiliProjects = seedDb.yiliProjects || [];
  seedDb.observationLibrary = [];
  seedDb.favorites = [];
  seedDb.version = CURRENT_DB_VERSION;
  seedDb.totalExperts = seedDb.experts ? seedDb.experts.length : 0;
  seedDb.totalFields = seedDb.fields ? seedDb.fields.length : 0;
  seedDb.updateTime = new Date().toISOString();
  
  // 持久化测试数据
  localStorage.setItem(TEST_STORAGE_KEY, JSON.stringify(seedDb));
  console.log('[test mode] 测试数据就绪:', seedDb.experts.length, '位专家, 项目:', (seedDb.yiliProjects||[]).length, '个, 子管理测试账号: testsub / test123');
  return seedDb;
}

// ===== v4.0 收藏功能 — Supabase优先，localStorage兜底 =====
function getFavorites() {
  // v4.5: 游客收藏修复 — appState.db.favorites 可能被 loadAppData() 覆盖为空，
  // 回退到独立 FAVORITES_KEY 获取正确的收藏数据
  if (appState.db && appState.db.favorites && appState.db.favorites.length > 0) {
    return appState.db.favorites;
  }
  // 回退：从独立 localStorage 键读取（游客收藏存在这里）
  var key = isTestMode() ? TEST_FAVORITES_KEY : FAVORITES_KEY;
  try {
    var raw = localStorage.getItem(key);
    if (raw) {
      var favs = JSON.parse(raw);
      if (favs.length > 0) {
        // 如果 appState.db 中收藏为空但独立存储有数据，回填到 appState
        if (appState.db) appState.db.favorites = favs;
        return favs;
      }
    }
  } catch(e) {}
  return [];
}
async function saveFavorites(arr) {
  appState.db.favorites = arr;
  // 独立存储（游客收藏的主存储）
  localStorage.setItem(isTestMode() ? TEST_FAVORITES_KEY : FAVORITES_KEY, JSON.stringify(arr));
  // v4.5: 同步到 STORAGE_KEY，防止 getDB() 覆盖
  if (appState.db) {
    try {
      var raw = localStorage.getItem(isTestMode() ? 'yili_expert_db_test' : STORAGE_KEY);
      if (raw) {
        var db = JSON.parse(raw);
        db.favorites = arr;
        localStorage.setItem(isTestMode() ? 'yili_expert_db_test' : STORAGE_KEY, JSON.stringify(db));
      }
    } catch(e) {}
  }
}
function isFavorited(expertId) {
  return getFavorites().includes(expertId);
}
async function toggleFavorite(expertId) {
  const favs = getFavorites();
  const idx = favs.indexOf(expertId);
  let isNowFav;
  if (idx >= 0) {
    favs.splice(idx, 1);
    isNowFav = false;
    if (currentUser && !isTestMode()) await removeFavorite(expertId);
  } else {
    favs.push(expertId);
    isNowFav = true;
    if (currentUser && !isTestMode()) await addFavorite(expertId);
  }
  await saveFavorites(favs);
  return isNowFav;
}

// Default ratingConfig with sub-dimensions
const DEFAULT_RATING_CONFIG = {
  dimensions: [
    { 
      id: 'professional', name: '专业度', weight: 0.5, 
      desc: '评估专家的学历背景、行业资质及专业成果',
      subDimensions: [
        { name: '学历与学术背景', weight: 0.35, maxScore: 10 },
        { name: '行业资质与认证', weight: 0.30, maxScore: 10 },
        { name: '专业成果与经验', weight: 0.35, maxScore: 10 }
      ]
    },
    { 
      id: 'influence', name: '影响力', weight: 0.5, 
      desc: '评估专家的社会荣誉、专业头衔及行业地位',
      subDimensions: [
        { name: '社会荣誉与奖项', weight: 0.35, maxScore: 10 },
        { name: '职称与专业头衔', weight: 0.25, maxScore: 10 },
        { name: '管理履历与行业地位', weight: 0.40, maxScore: 10 }
      ]
    }
  ],
  aiScoringEnabled: true,
  showScores: false
};

const DEFAULT_SORT_OPTIONS = [
  { id: 'default', name: '默认排序' },
  { id: 'overall', name: '按综合评分' },
  { id: 'professional', name: '按专业度' },
  { id: 'influence', name: '按影响力' }
];

const DEFAULT_UI_CONFIG = {
  mainTitle: '伊利集团·数智化赋能优质专家资源库',
  colorScheme: 'default'
};

const COLOR_SCHEMES = {
  default: { name: '默认蓝', primary: '#1D4ED8', primaryLight: '#DBEAFE', accent: '#3B82F6' },
  emerald: { name: '翡翠绿', primary: '#065F46', primaryLight: '#D1FAE5', accent: '#10B981' },
  purple:  { name: '深邃紫', primary: '#6B21A8', primaryLight: '#F3E8FF', accent: '#8B5CF6' },
  amber:   { name: '琥珀金', primary: '#92400E', primaryLight: '#FEF3C7', accent: '#F59E0B' },
  dark:    { name: '暗夜黑', primary: '#111827', primaryLight: '#1F2937', accent: '#6366F1' }
};

const CURRENT_DB_VERSION = 13;

// ===== UI Config Management =====
function applyUiConfig(uic) {
  if (!uic) uic = appState.db.uiConfig || DEFAULT_UI_CONFIG;
  // Apply color scheme
  const scheme = COLOR_SCHEMES[uic.colorScheme] || COLOR_SCHEMES.default;
  const root = document.documentElement;
  root.style.setProperty('--primary', scheme.primary);
  root.style.setProperty('--primary-light', scheme.primaryLight);
  root.style.setProperty('--accent', scheme.accent);
  // Update page title
  document.title = uic.mainTitle || DEFAULT_UI_CONFIG.mainTitle;
}

// Migrate ratingConfig to ensure sub-dimensions always exist
function migrateRatingConfig(cfg) {
  if (!cfg) {
    return JSON.parse(JSON.stringify(DEFAULT_RATING_CONFIG));
  }
  if (!cfg.dimensions) {
    cfg.dimensions = JSON.parse(JSON.stringify(DEFAULT_RATING_CONFIG.dimensions));
    return cfg;
  }
  // Ensure each dimension has subDimensions
  cfg.dimensions.forEach((dim, idx) => {
    if (!dim.subDimensions || dim.subDimensions.length === 0) {
      const defaultDim = DEFAULT_RATING_CONFIG.dimensions[idx];
      if (defaultDim && defaultDim.subDimensions) {
        dim.subDimensions = JSON.parse(JSON.stringify(defaultDim.subDimensions));
      }
    }
  });
  // Ensure both dimensions exist
  if (cfg.dimensions.length < 2) {
    const missing = DEFAULT_RATING_CONFIG.dimensions.filter(
      dd => !cfg.dimensions.find(d => d.id === dd.id)
    );
    missing.forEach(d => cfg.dimensions.push(JSON.parse(JSON.stringify(d))));
  }
  if (cfg.aiScoringEnabled === undefined) {
    cfg.aiScoringEnabled = true;
  }
  if (cfg.showScores === undefined) {
    cfg.showScores = true;
  }
  return cfg;
}

// ===== v4.0 Supabase-backed getDB =====
async function getDB() {
  // v4.1: 测试模式 — 从 data.js 种子数据初始化，存测试 localStorage
  if (isTestMode()) {
    return await loadTestDB();
  }
  
  // v4.4: 确保 session 在 loadAppData 之前已恢复
  try {
    if (typeof supabase !== 'undefined' && supabase && !currentUser) {
      var sessionRes = await supabase.auth.getSession();
      if (sessionRes.data && sessionRes.data.session) {
        currentUser = sessionRes.data.session.user;
        await checkAdminStatus();
      }
    }
  } catch(e) { /* session 恢复失败，继续以未登录状态运行 */ }
  
  try {
    // 尝试从 Supabase 加载数据
    const appData = await loadAppData();
    console.log('[getDB] loadAppData result:', { experts: appData.experts.length, fields: appData.fields.length, projects: (appData.yiliProjects||[]).length, favs: (appData.favorites||[]).length });
    if (appData.experts.length > 0 || appData.fields.length > 0) {
      // Supabase 有数据 → 优先使用
      const raw = localStorage.getItem(STORAGE_KEY);
      let localConfig = { ratingConfig: null, sortOptions: null, uiConfig: null, dashboardConfig: null, observationLibrary: [], permissions: null, fields: null };
      if (raw) {
        try {
          const l = JSON.parse(raw);
          localConfig.ratingConfig = l.ratingConfig;
          localConfig.sortOptions = l.sortOptions;
          localConfig.uiConfig = l.uiConfig;
          localConfig.dashboardConfig = l.dashboardConfig;
          localConfig.observationLibrary = l.observationLibrary || [];
          localConfig.permissions = l.permissions;
          localConfig.fields = l.fields; // 管理员修改的分类颜色
        } catch(e) {}
      }
      
      // 合并字段：Supabase 提供字段列表，localStorage 提供颜色覆盖
      // 修复 v4.0 初始阶段管理员修改未同步到 Supabase 导致刷新后颜色丢失
      let fields = appData.fields;
      if (localConfig.fields && localConfig.fields.length > 0) {
        const localFieldMap = {};
        localConfig.fields.forEach(function(f) { if (f && f.name) localFieldMap[f.name] = f; });
        fields = fields.map(function(f) {
          const local = localFieldMap[f.name];
          if (local && local.color) {
            return {
              name: f.name,
              color: local.color,
              textColor: local.textColor || '#ffffff',
              hideWhenEmpty: local.hideWhenEmpty !== undefined ? local.hideWhenEmpty : f.hideWhenEmpty,
              sortOrder: local.sortOrder !== undefined ? local.sortOrder : f.sortOrder
            };
          }
          return f;
        });
      }
      
      // v4.4: 登录用户收藏双向合并 — localStorage ∪ Supabase
      var mergedFavorites = appData.favorites.slice();
      if (currentUser) {
        var localRaw = localStorage.getItem(STORAGE_KEY);
        var localFavs = localRaw ? (JSON.parse(localRaw).favorites || []) : [];
        var supabaseFavSet = new Set(appData.favorites);
        for (var fi = 0; fi < localFavs.length; fi++) {
          if (!supabaseFavSet.has(localFavs[fi])) {
            mergedFavorites.push(localFavs[fi]);
            addFavorite(localFavs[fi]).catch(function(){}); // 异步推送到 Supabase
          }
        }
        console.log('[getDB] Merged favorites: local=' + localFavs.length + ' supabase=' + appData.favorites.length + ' → merged=' + mergedFavorites.length);
      }
      
      const db = {
        experts: appData.experts,
        fields: fields,
        yiliProjects: appData.yiliProjects,
        favorites: mergedFavorites,
        ratingConfig: migrateRatingConfig(localConfig.ratingConfig || JSON.parse(JSON.stringify(DEFAULT_RATING_CONFIG))),
        sortOptions: localConfig.sortOptions || DEFAULT_SORT_OPTIONS,
        uiConfig: localConfig.uiConfig || JSON.parse(JSON.stringify(DEFAULT_UI_CONFIG)),
        dashboardConfig: localConfig.dashboardConfig || { chartType: 'doughnut', showCharts: ['fields', 'scoreNumeric', 'scoreDist'], barChartType: 'bar' },
        observationLibrary: localConfig.observationLibrary || [],
        permissions: localConfig.permissions || await fetchPermissions() || { adminPassword: 'yili2026', users: [], shareSettings: { linkActive: true, requireLogin: true } },
        categoryConfig: fields,
        totalExperts: appData.experts.length,
        totalFields: appData.fields.length,
        version: CURRENT_DB_VERSION,
        updateTime: new Date().toISOString()
      };
      
      // 缓存到 localStorage 作为离线备份
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      return db;
    }
    
    // Supabase 无数据 → 用 localStorage 或 data.js 初始化
    return loadFromLocalOrFallback();
  } catch(e) {
    console.warn('Supabase load failed, using localStorage fallback:', e.message);
    return loadFromLocalOrFallback();
  }
}

function loadFromLocalOrFallback() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.experts && parsed.experts.length > 0) {
        return ensureMinimalConfig(parsed);
      }
    }
  } catch(e) { console.warn('localStorage data corrupted, reinitializing...'); }
  
  // 从 data.js 初始化
  if (typeof EXPERT_DATA === 'undefined') {
    console.error('EXPERT_DATA not loaded.');
    return { experts: [], fields: [], totalExperts: 0, totalFields: 0, permissions: { adminPassword:'yili2026', users:[], shareSettings:{ linkActive:true, requireLogin:true } }, ratingConfig: JSON.parse(JSON.stringify(DEFAULT_RATING_CONFIG)), sortOptions: DEFAULT_SORT_OPTIONS, uiConfig: JSON.parse(JSON.stringify(DEFAULT_UI_CONFIG)), categoryConfig:[], dashboardConfig:{}, yiliProjects:[], observationLibrary:[], version: CURRENT_DB_VERSION, updateTime:new Date().toISOString() };
  }
  
  const db = JSON.parse(JSON.stringify(EXPERT_DATA));
  db.permissions = { adminPassword: 'yili2026', users: [], shareSettings: { linkActive: true, requireLogin: true } };
  db.ratingConfig = JSON.parse(JSON.stringify(DEFAULT_RATING_CONFIG));
  db.sortOptions = DEFAULT_SORT_OPTIONS;
  db.uiConfig = JSON.parse(JSON.stringify(DEFAULT_UI_CONFIG));
  db.categoryConfig = EXPERT_DATA.fields || [];
  db.dashboardConfig = { chartType: 'doughnut', showCharts: ['fields', 'scoreNumeric', 'scoreDist'], barChartType: 'bar' };
  db.yiliProjects = [];
  db.observationLibrary = [];
  db.version = CURRENT_DB_VERSION;
  db.updateTime = EXPERT_DATA.updateTime || new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  return db;
}

function ensureMinimalConfig(db) {
  if (!db.ratingConfig) db.ratingConfig = JSON.parse(JSON.stringify(DEFAULT_RATING_CONFIG));
  if (!db.sortOptions) db.sortOptions = DEFAULT_SORT_OPTIONS;
  if (!db.uiConfig) db.uiConfig = JSON.parse(JSON.stringify(DEFAULT_UI_CONFIG));
  if (!db.dashboardConfig) db.dashboardConfig = { chartType: 'doughnut', showCharts: ['fields', 'scoreNumeric', 'scoreDist'], barChartType: 'bar' };
  if (!db.observationLibrary) db.observationLibrary = [];
  if (!db.permissions) db.permissions = { adminPassword: 'yili2026', users: [], shareSettings: { linkActive: true, requireLogin: true } };
  return db;
}

function saveDB(db) {
  // v4.1: 测试模式 — 只写测试 localStorage，不连 Supabase
  if (isTestMode()) {
    localStorage.setItem(TEST_STORAGE_KEY, JSON.stringify(db));
    console.log('[test mode] 数据已保存（测试隔离）');
    return;
  }
  // 保存到 localStorage（配置类和离线缓存）
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  // v4.0: 管理员登录时，后台同步专家/项目/分类到 Supabase
  if (currentUser && isAdmin && db.experts && db.experts.length > 0) {
    debounceSyncToSupabase(db);
  }
}

// 防抖 Sync: 500ms 内多次 saveDB 只触发一次 Supabase 同步
let _syncTimer = null;
function debounceSyncToSupabase(db) {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    syncToSupabase(db).catch(e => console.warn('Supabase sync failed:', e.message));
  }, 500);
}

async function syncToSupabase(db) {
  console.log('[Supabase] Syncing experts, projects, fields...');
  // Sync experts
  if (db.experts) {
    for (const expert of db.experts) {
      try {
        await updateExpert(expert.id, expert);
      } catch(e) {
        // Expert might not exist yet → create
        try { await createExpert(expert); } catch(e2) { console.warn('Expert sync error:', expert.name, e2.message); }
      }
    }
  }
  // Sync projects
  if (db.yiliProjects && db.yiliProjects.length > 0) {
    for (const proj of db.yiliProjects) {
      try {
        await updateProject(proj.id, proj);
      } catch(e) {
        try { await createProject(proj); } catch(e2) { console.warn('Project sync error:', proj.title, e2.message); }
      }
    }
  }
  // Sync fields
  if (db.fields) {
    for (const field of db.fields) {
      try {
        await updateField(field.name, field);
      } catch(e) {
        try { await createField(field); } catch(e2) { console.warn('Field sync error:', field.name, e2.message); }
      }
    }
  }
  // Sync permissions (sub-admin accounts, share settings)
  if (db.permissions) {
    try { await syncPermissions(db.permissions); } catch(e) { console.warn('Permissions sync error:', e.message); }
  }
  console.log('[Supabase] Sync complete.');
}

// v4.1: 管理员登录后重新拉取 Supabase 项目数据
async function refreshProjectsFromSupabase() {
  try {
    const projects = await fetchProjects();
    if (projects && projects.length > 0 && appState.db) {
      appState.db.yiliProjects = projects;
      saveDB(appState.db);
      console.log('[Supabase] Projects refreshed:', projects.length);
    }
  } catch(e) {
    console.warn('[Supabase] Project refresh failed:', e.message);
  }
}

// ===== STATE =====
let appState = {
  mode: 'frontend', // 'frontend' | 'admin'
  currentSort: 'default',
  scoreFilter: null,
  fieldFilter: new Set(), // Multi-select: empty Set = show all
  supplierFilter: null, // null=全部, true=是(在库), false=否(不在库)
  favoritesFilter: null, // v3.0: null=全部, true=仅显示收藏
  cooperationFilter: null, // v3.5: null=全部, true=已合作, false=尚未合作
  searchQuery: '',
  adminTab: 'experts',
  adminSubTab: 'list',
  editingExpert: null,
  fieldsCollapsed: false,
  db: null,
  currentUser: null, // { role: 'master' | 'sub', permissions: {...}, account: '' }
  // Pagination state
  currentPage: 1,
  PAGE_SIZE: 20
};

function isMasterAdmin() {
  return appState.currentUser && appState.currentUser.role === 'master';
}

function hasPermission(action) {
  if (isMasterAdmin()) return true;
  if (!appState.currentUser || !appState.currentUser.permissions) return false;
  return !!appState.currentUser.permissions[action];
}

function recalcExpertFromSubscores(e) {
  const cfg = appState.db.ratingConfig;
  const profDim = cfg.dimensions.find(d => d.id === 'professional');
  const inflDim = cfg.dimensions.find(d => d.id === 'influence');
  let prof = 0, infl = 0;
  if (e.subScores && e.subScores.professional && profDim && profDim.subDimensions) {
    profDim.subDimensions.forEach(sd => {
      const v = e.subScores.professional[sd.name] || 5;
      prof += v * sd.weight;
    });
  }
  if (e.subScores && e.subScores.influence && inflDim && inflDim.subDimensions) {
    inflDim.subDimensions.forEach(sd => {
      const v = e.subScores.influence[sd.name] || 5;
      infl += v * sd.weight;
    });
  }
  e.scores.professional = Math.round(prof * 10) / 10;
  e.scores.influence = Math.round(infl * 10) / 10;
  e.scores.overall = Math.round((e.scores.professional * profDim.weight + e.scores.influence * inflDim.weight) * 10) / 10;
}

function initState() {
  // v4.0: 初始化时填充空 db，等待异步加载完成
  appState.db = { experts: [], fields: [], yiliProjects: [], favorites: [], ratingConfig: DEFAULT_RATING_CONFIG, sortOptions: DEFAULT_SORT_OPTIONS, uiConfig: DEFAULT_UI_CONFIG, permissions: {} };
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) { if (!b.has(v)) return false; }
  return true;
}

// ===== COLOR UTILS =====
// 根据hex颜色计算亮度，返回适合的文字颜色
function getTextColorForBg(hexColor) {
  // 移除#号
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // 计算相对亮度 (W3C公式)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  // 亮度>0.55视为浅色，使用深色文字
  return luminance > 0.55 ? '#1a1a1a' : '#ffffff';
}

// 获取标签在未选中状态下的文字颜色（浅色背景用深色文字）
function getFieldTagTextColor(fieldColor) {
  // 未选中状态：背景是 color + '22'（透明），所以实际显示在白底上
  // 文字颜色用原色，但如果原色太浅则加深
  const hex = fieldColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  // 颜色本身亮度>0.65，用同色系深色（乘以0.6）
  if (luminance > 0.65) {
    const dr = Math.round(r * 0.55);
    const dg = Math.round(g * 0.55);
    const db = Math.round(b * 0.55);
    return `rgb(${dr},${dg},${db})`;
  }
  return fieldColor;
}

// ===== UTILS =====
function toast(msg, type='') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.remove(); }, 2500);
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  } catch(e) { return isoStr; }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function h(tag, attrs={}, ...children) {
  const el = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    if (k === 'className') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'innerHTML') el.innerHTML = v;
    else if (k in el) {
      try { el[k] = v; } catch(e) { el.setAttribute(k, String(v)); }
    }
    else el.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (typeof c === 'string') el.appendChild(document.createTextNode(c));
    else if (c instanceof Node) el.appendChild(c);
    else if (c && typeof c === 'object' && c.nodeType) el.appendChild(c);
  }
  return el;
}

// ===== v4.1 测试模式横幅 =====
function renderTestBanner() {
  // Remove existing banner if any
  var exist = document.getElementById('test-mode-banner');
  if (exist) exist.remove();
  
  var banner = document.createElement('div');
  banner.id = 'test-mode-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10000;background:#FEE2E2;color:#991B1B;text-align:center;padding:6px 16px;font-size:13px;font-weight:600;border-bottom:2px solid #FCA5A5;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;';
  
  // Left section: icon + text
  var info = document.createElement('span');
  info.textContent = '🧪 测试模式 — 数据不会同步到云端';
  banner.appendChild(info);
  
  // Role selector
  var sel = document.createElement('select');
  sel.style.cssText = 'padding:2px 8px;font-size:12px;border:1px solid #FCA5A5;border-radius:4px;background:#fff;color:#991B1B;cursor:pointer;';
  var roles = [
    { value: 'master', label: '🔑 主管理员' },
    { value: 'sub', label: '👤 子管理员' },
    { value: 'user', label: '👥 普通用户' }
  ];
  roles.forEach(function(r) {
    var opt = document.createElement('option');
    opt.value = r.value;
    opt.textContent = r.label;
    if (r.value === testModeRole) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.onchange = function() { switchTestRole(this.value); };
  banner.appendChild(sel);
  
  // Exit button
  var exitBtn = document.createElement('button');
  exitBtn.textContent = '退出测试';
  exitBtn.style.cssText = 'padding:2px 12px;font-size:12px;background:#DC2626;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;';
  exitBtn.onclick = function() {
    if (confirm('退出测试模式？\n\n测试数据将被清除，返回正常模式。')) {
      exitTestMode();
    }
  };
  banner.appendChild(exitBtn);
  
  document.body.insertBefore(banner, document.body.firstChild);
  
  // Add top padding to body to avoid content overlap
  var origStyle = document.body.style.paddingTop;
  document.body.style.paddingTop = '38px';
  
  // Clean up on exit
  window._testBannerCleanup = function() {
    var b = document.getElementById('test-mode-banner');
    if (b) b.remove();
    document.body.style.paddingTop = '0px';
  };
}

// ===== RENDER FRONTEND =====
function renderFrontend() {
  if (isTestMode()) renderTestBanner();
  const app = document.getElementById('app');
  app.innerHTML = '';
  
  // Clean up stale page navigation (will be re-created by renderExpertGrid)
  const existingPageNav = document.getElementById('page-navigation');
  if (existingPageNav) existingPageNav.remove();
  const existingFloatNav = document.getElementById('page-navigation-float');
  if (existingFloatNav) existingFloatNav.remove();
  if (_floatingNavScrollHandler) {
    window.removeEventListener('scroll', _floatingNavScrollHandler);
    _floatingNavScrollHandler = null;
  }
  
  const db = appState.db;
  applyUiConfig(db.uiConfig);
  const isAdmin = appState.mode === 'admin';
  
  // Header
  const header = h('header', { className: 'header' });
  const headerInner = h('div', { className: 'header-inner' });
  
  const headerLeft = h('div', { className: 'header-left' });
  headerLeft.appendChild(h('div', { className: 'header-title' }, db.uiConfig ? db.uiConfig.mainTitle : '伊利集团·数智化赋能优质专家资源库'));
  headerLeft.appendChild(h('div', { className: 'header-subtitle' }, ''));
  headerInner.appendChild(headerLeft);
  
  const headerActions = h('div', { className: 'header-actions' });
  headerActions.appendChild(h('div', { className: 'header-update' }, '数据更新：' + formatDate(db.updateTime)));
  
  headerActions.appendChild(h('button', {
    className: 'btn btn-sm',
    style: { background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '12px', border: '1px solid rgba(255,255,255,0.2)' },
    id: 'admin-entry-btn',
    onclick: () => {
      if (appState.mode === 'admin') {
        signOut().then(() => {
          appState.mode = 'frontend';
          appState.currentUser = null;
          renderFrontend();
        });
      } else {
        showAdminLogin();
      }
    }
  }, isAdmin ? '退出后台' : (currentUser ? '管理员入口' : '管理员入口')));
  headerInner.appendChild(headerActions);
  
  header.appendChild(headerInner);
  app.appendChild(header);
  
  // Stats bar
  const activeExperts = db.experts.filter(e => e.status !== 'eliminated');
  
  // 前端可见领域数（不含 hideWhenEmpty 且无讲师的标签）
  const frontendFieldSet = new Set(activeExperts.flatMap(e => e.fields || []));
  const statsVisibleFields = db.fields.filter(f => {
    if (f.hideWhenEmpty && !frontendFieldSet.has(f.name)) return false;
    return true;
  });
  
  const statsBar = h('div', { className: 'stats-bar' });
  
  // 领域人数分布：带专家总数头部的整合图表卡片
  const chartCard = h('div', { className: 'stat-card stat-chart-card', style: { flex: '1', minWidth: '400px', padding: '16px 20px' } });
  
  // v4.2: 专家总数徽章 — 始终显示全部前端可见专家数量，不受筛选影响
  // 图表数据由 renderMainFieldChart() 独立计算（基于全部非淘汰专家）
  
  // 头部：标题 + 专家总数徽章
  const chartHeader = h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' } });
  const chartTitleWrap = h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '10px' } });
  chartTitleWrap.appendChild(h('span', { className: 'inline-chart-mini-title', style: { fontSize:'13px' } }, '领域人数分布'));
  chartHeader.appendChild(chartTitleWrap);
  
  // 专家总数蓝底徽章：合并为"共XX位专家"（基于全部可见专家，不随筛选变化）
  const totalCount = activeExperts.length;
  const totalBadge = h('span', { style: { fontSize:'12px', color:'var(--primary)', background:'var(--primary-light)', padding:'3px 12px', borderRadius:'12px', fontWeight:'600' } }, '共' + totalCount + '位专家');
  chartHeader.appendChild(totalBadge);
  chartCard.appendChild(chartHeader);
  
  const chartContainer = h('div', { id: 'main-field-chart-inline', style: { width: '100%' } });
  chartCard.appendChild(chartContainer);
  statsBar.appendChild(chartCard);
  
  app.appendChild(statsBar);
  
  // Search bar
  const searchBar = h('div', { className: 'search-bar' });
  const searchWrapper = h('div', { className: 'search-input-wrapper' });
  searchWrapper.appendChild(h('span', { className: 'search-icon' }, '🔍'));
  const searchInput = h('input', {
    className: 'search-input',
    placeholder: '搜索专家姓名或关键词（如：AI、产品、清华...）',
    value: appState.searchQuery,
    onkeydown: (e) => {
      if (e.key === 'Enter') {
        doSearch();
      }
    }
  });
  searchWrapper.appendChild(searchInput);
  searchBar.appendChild(searchWrapper);
  
  searchBar.appendChild(h('button', {
    className: 'search-btn',
    onclick: () => doSearch()
  }, '搜索'));
  
  if (appState.searchQuery) {
    searchBar.appendChild(h('button', {
      className: 'search-clear-btn',
      onclick: () => {
        appState.searchQuery = '';
        appState.currentPage = 1;
        syncFilterUI();
        renderExpertGrid();
      }
    }, '✕ 清除'));
  }
  
  app.appendChild(searchBar);
  
  // Filter bar
  const filterBar = h('div', { className: 'filter-bar' });
  
  // Score filter
  // Score filter (hidden when scores are hidden)
  if (db.ratingConfig.showScores !== false) {
  const scoreGroup = h('div', { className: 'filter-group' });
  scoreGroup.appendChild(h('span', { className: 'filter-label' }, '分值：'));
  const scoreBtns = h('div', { className: 'score-filters' });
  const scoreKeys = ['全部', '9+', '8+', '7+'];
  const scoreValues = [null, 9, 8, 7];
  scoreValues.forEach((v, i) => {
    const btn = h('button', {
      className: 'score-btn' + (appState.scoreFilter === v ? ' active' : ''),
      onclick: () => {
        appState.scoreFilter = v;
        appState.currentPage = 1;
        syncFilterUI();
        renderExpertGrid();
      }
    }, scoreKeys[i]);
    scoreBtns.appendChild(btn);
  });
  scoreGroup.appendChild(scoreBtns);
  filterBar.appendChild(scoreGroup);
  }
  
  // Sort (completely hidden when scores are hidden on frontend)
  const sortGroup = h('div', { className: 'filter-group' });
  if (db.ratingConfig.showScores !== false) {
    sortGroup.appendChild(h('span', { className: 'filter-label' }, '排序：'));
    const sortSelect = h('select', {
      className: 'filter-select',
      onchange: (e) => {
        appState.currentSort = e.target.value;
        appState.currentPage = 1;
        renderExpertGrid();
      }
    });
    db.sortOptions.forEach(opt => {
      const o = h('option', { value: opt.id }, opt.name);
      if (appState.currentSort === opt.id) o.selected = true;
      sortSelect.appendChild(o);
    });
    sortGroup.appendChild(sortSelect);
  }
  sortGroup.appendChild(h('span', { className: 'sort-hint' }, '默认排序按照姓名字母排序，不区分排名先后'));
  filterBar.appendChild(sortGroup);
  
  app.appendChild(filterBar);
  
  // Field filter
  const fieldBar = h('div', { className: 'filter-bar field-bar-wrapper', style: { marginTop: '8px' } });
  const fieldGroup = h('div', { className: 'filter-group' });
  fieldGroup.appendChild(h('span', { className: 'filter-label' }, '适用领域：'));
  const fieldFilters = h('div', { className: 'field-filters', id: 'field-filters' });
  
  // "全部" tag
  const allTag = h('span', {
    className: 'field-tag field-tag-all' + (appState.fieldFilter.size === 0 ? ' active' : ''),
    onclick: () => {
      appState.fieldFilter = new Set();
      appState.currentPage = 1;
      syncFilterUI();
      renderExpertGrid();
    }
  }, '全部');
  fieldFilters.appendChild(allTag);
  
  // 前端过滤：hideWhenEmpty=true 的标签，在前端可见专家中无对应讲师时不展示
  const frontendExperts = db.experts.filter(e => e.status !== 'eliminated');
  const usedFieldNames = new Set(frontendExperts.flatMap(e => e.fields || []));
  const visibleFields = db.fields.filter(f => {
    if (f.hideWhenEmpty && !usedFieldNames.has(f.name)) return false;
    return true;
  });

  const maxVisible = 8;
  const showAll = !appState.fieldsCollapsed;
  const fieldsToShow = showAll ? visibleFields : visibleFields.slice(0, maxVisible);
  
  fieldsToShow.forEach(f => {
    const isActive = appState.fieldFilter.has(f.name);
    // 顶部筛选栏：背景保持领域色，文字统一深灰色
    const activeBgColor = f.color;
    const activeTextColor = '#4A4A4A';
    const inactiveBgColor = f.color + '22';
    const inactiveTextColor = '#4A4A4A';
    
    const tag = h('span', {
      className: 'field-tag' + (isActive ? ' active' : ''),
      style: {
        background: isActive ? activeBgColor : inactiveBgColor,
        color: isActive ? activeTextColor : inactiveTextColor,
        borderColor: f.color
      },
      onclick: () => {
        const newFilter = new Set(appState.fieldFilter);
        if (newFilter.has(f.name)) {
          newFilter.delete(f.name);
        } else {
          newFilter.add(f.name);
        }
        appState.fieldFilter = newFilter;
        appState.currentPage = 1;
        syncFilterUI();
        renderExpertGrid();
      }
    }, f.name);
    fieldFilters.appendChild(tag);
  });
  
  if (visibleFields.length > maxVisible) {
    const toggleBtn = h('button', {
      className: 'field-toggle-btn',
      onclick: () => {
        appState.fieldsCollapsed = !appState.fieldsCollapsed;
        appState.currentPage = 1;
        syncFilterUI();
        renderExpertGrid();
      }
    }, showAll ? '收起 ▲' : '更多 ▼');
    fieldFilters.appendChild(toggleBtn);
  }
  
  fieldGroup.appendChild(fieldFilters);
  fieldBar.appendChild(fieldGroup);
  app.appendChild(fieldBar);
  
  // v3.5: 合并筛选栏 — 是否在库 + 合作经历 + 收藏筛选 同行
  const mergedBar = h('div', { className: 'filter-bar merged-bar-wrapper', style: { marginTop: '8px' } });
  
  // 是否在库
  const supplierGroup = h('div', { className: 'filter-group', id: 'supplier-filter-group' });
  supplierGroup.appendChild(h('span', { className: 'filter-label' }, '是否在库：'));
  const supplierFilters = h('div', { className: 'field-filters' });
  ['全部', '是', '否'].forEach(label => {
    const filterVal = label === '全部' ? null : (label === '是');
    const isActive = appState.supplierFilter === filterVal;
    supplierFilters.appendChild(h('span', {
      className: 'field-tag field-tag-all' + (isActive ? ' active' : ''),
      onclick: () => {
        appState.supplierFilter = filterVal;
        appState.currentPage = 1;
        syncFilterUI();
        renderExpertGrid();
      }
    }, label));
  });
  supplierGroup.appendChild(supplierFilters);
  mergedBar.appendChild(supplierGroup);
  
  // 合作经历
  const coopGroup = h('div', { className: 'filter-group', id: 'coop-filter-group' });
  coopGroup.appendChild(h('span', { className: 'filter-label' }, '合作经历：'));
  const coopFilters = h('div', { className: 'field-filters' });
  [
    { label: '全部', value: null },
    { label: '已合作', value: true },
    { label: '尚未合作', value: false }
  ].forEach(item => {
    const isActive = appState.cooperationFilter === item.value;
    coopFilters.appendChild(h('span', {
      className: 'field-tag field-tag-all' + (isActive ? ' active' : ''),
      style: isActive ? (item.value === true ? { background: '#dcfce7', borderColor: '#22c55e', color: '#166534' } : (item.value === false ? { background: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b' } : {})) : {},
      onclick: () => {
        appState.cooperationFilter = item.value;
        appState.currentPage = 1;
        syncFilterUI();
        renderExpertGrid();
      }
    }, item.label));
  });
  coopGroup.appendChild(coopFilters);
  mergedBar.appendChild(coopGroup);
  
  // 收藏筛选
  const favGroup = h('div', { className: 'filter-group', id: 'fav-filter-group' });
  favGroup.appendChild(h('span', { className: 'filter-label' }, '收藏：'));
  const favFilters = h('div', { className: 'field-filters' });
  ['全部', '⭐ 我的收藏'].forEach(label => {
    const filterVal = label.includes('收藏');
    const isActive = appState.favoritesFilter === filterVal;
    favFilters.appendChild(h('span', {
      className: 'field-tag field-tag-all favourite-tag' + (isActive ? ' active' : ''),
      style: isActive ? { background: '#FEF3C7', borderColor: '#F59E0B', color: '#92400E' } : {},
      onclick: () => {
        appState.favoritesFilter = filterVal ? true : null;
        appState.currentPage = 1;
        syncFilterUI();
        renderExpertGrid();
      }
    }, label));
  });
  favGroup.appendChild(favFilters);
  // 用户登录入口（替换原来的 💡 小图标）
  if (!currentUser) {
    var loginBtn = h('button', {
      className: 'fav-login-btn',
      style: { fontSize: '12px', padding: '4px 12px', background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: '8px' },
      onclick: showUserLoginModal
    }, '🔐 登录同步');
    loginBtn.title = '登录后收藏数据可跨设备同步';
    favGroup.appendChild(loginBtn);
  } else {
    var userBadge = h('span', {
      style: { fontSize: '12px', color: '#059669', marginLeft: '8px', background: '#ECFDF5', padding: '4px 10px', borderRadius: '6px', border: '1px solid #A7F3D0', whiteSpace: 'nowrap' }
    }, '✅ ' + (currentUser.email || '').split('@')[0]);
    userBadge.title = '已登录：' + (currentUser.email || '') + '（点击退出）';
    userBadge.style.cursor = 'pointer';
    userBadge.onclick = async function() {
      if (!confirm('确定退出登录？收藏数据将保留在本地。')) return;
      await signOut();
      appState.db.favorites = (JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').favorites || []);
      renderFrontend();
    };
    favGroup.appendChild(userBadge);
  }
  mergedBar.appendChild(favGroup);
  
  app.appendChild(mergedBar);
  
  // Expert grid
  const countInfo = h('div', { className: 'expert-count-info', id: 'expert-count' });
  app.appendChild(countInfo);
  
  const grid = h('div', { className: 'expert-grid', id: 'expert-grid' });
  app.appendChild(grid);
  
  renderExpertGrid();
  
  // Render main page field chart
  setTimeout(() => renderMainFieldChart(), 200);
}

// ===== v4.12: 筛选 UI 同步 — 筛选变化后更新按钮高亮状态 =====
function syncFilterUI() {
  var db = appState.db;
  
  // 1. 分值筛选按钮
  document.querySelectorAll('.score-btn').forEach(function(btn) {
    var t = btn.textContent.trim();
    var valMap = { '全部': null, '9+': 9, '8+': 8, '7+': 7 };
    if (valMap[t] !== undefined) {
      btn.classList.toggle('active', appState.scoreFilter === valMap[t]);
    }
  });
  
  // 2. 领域筛选 "全部" 标签
  var fieldAll = document.querySelector('#field-filters .field-tag-all');
  if (fieldAll) fieldAll.classList.toggle('active', appState.fieldFilter.size === 0);
  
  // 3. 领域筛选各标签（含颜色内联样式同步）
  document.querySelectorAll('#field-filters .field-tag:not(.field-tag-all)').forEach(function(tag) {
    var name = tag.textContent.trim();
    var isActive = appState.fieldFilter.has(name);
    tag.classList.toggle('active', isActive);
    var f = db.fields.find(function(ff) { return ff.name === name; });
    if (f) {
      tag.style.background = isActive ? f.color : (f.color + '22');
      tag.style.color = '#4A4A4A';
      tag.style.borderColor = f.color;
    }
  });
  
  // 4. 是否在库筛选
  var supplierGroup = document.getElementById('supplier-filter-group');
  if (supplierGroup) {
    supplierGroup.querySelectorAll('.field-tag').forEach(function(tag) {
      var t = tag.textContent.trim();
      var val = t === '全部' ? null : (t === '是');
      tag.classList.toggle('active', appState.supplierFilter === val);
    });
  }
  
  // 5. 合作经历筛选
  var coopGroup = document.getElementById('coop-filter-group');
  if (coopGroup) {
    coopGroup.querySelectorAll('.field-tag').forEach(function(tag) {
      var t = tag.textContent.trim();
      var val = t === '全部' ? null : (t === '已合作');
      var isActive = appState.cooperationFilter === val;
      tag.classList.toggle('active', isActive);
      // 清除内联样式让 CSS 类控制外观
      if (isActive) {
        if (val === true) {
          tag.style.background = '#dcfce7'; tag.style.borderColor = '#22c55e'; tag.style.color = '#166534';
        } else if (val === false) {
          tag.style.background = '#fef2f2'; tag.style.borderColor = '#fca5a5'; tag.style.color = '#991b1b';
        }
      } else {
        tag.style.background = ''; tag.style.borderColor = ''; tag.style.color = '';
      }
    });
  }
  
  // 6. 收藏筛选
  var favGroup = document.getElementById('fav-filter-group');
  if (favGroup) {
    favGroup.querySelectorAll('.field-tag').forEach(function(tag) {
      var t = tag.textContent.trim();
      var val = t.includes('收藏');
      var isActive = appState.favoritesFilter === val;
      tag.classList.toggle('active', isActive);
      if (isActive && val) {
        tag.style.background = '#FEF3C7'; tag.style.borderColor = '#F59E0B'; tag.style.color = '#92400E';
      } else {
        tag.style.background = ''; tag.style.borderColor = ''; tag.style.color = '';
      }
    });
  }
}

// ===== v3.0: 垂直领域导航已移除，代码备份在 backup/vertical-nav-backup.js =====

function doSearch() {
  const input = document.querySelector('.search-input');
  if (input) {
    appState.searchQuery = input.value.trim();
    appState.currentPage = 1;
    renderExpertGrid();
  }
}

function getRelevanceScore(expert, query) {
  if (!query) return 0;
  const q = query.toLowerCase();
  let score = 0;
  
  // 1. Name matching (highest weight)
  const nameLower = expert.name.toLowerCase();
  if (nameLower === q) {
    score += 100; // Exact name match
  } else if (nameLower.startsWith(q)) {
    score += 50; // Name starts with query
  } else if (nameLower.includes(q)) {
    score += 35; // Name contains query
    // Bonus for earlier match position
    const pos = nameLower.indexOf(q);
    score += Math.max(0, 10 - pos * 0.5);
  }
  
  // 2. Field/category matching
  expert.fields.forEach(f => {
    const fLower = f.toLowerCase();
    if (fLower === q) {
      score += 40;
    } else if (fLower.includes(q)) {
      score += 25;
    }
  });
  
  // 3. Advantages matching (title + desc)
  if (expert.advantages) {
    expert.advantages.forEach(adv => {
      const titleLower = (adv.title || '').toLowerCase();
      const descLower = (adv.desc || '').toLowerCase();
      if (titleLower.includes(q)) score += 15;
      if (descLower.includes(q)) score += 10;
    });
  }
  
  // 4. Qualifications matching
  if (expert.qualifications) {
    const ql = expert.qualifications.toLowerCase();
    if (ql.includes(q)) score += 8;
  }
  
  // 5. Courses matching
  if (expert.courses) {
    const cl = expert.courses.toLowerCase();
    if (cl.includes(q)) score += 8;
  }
  
  // 6. Education matching
  if (expert.education) {
    const el = expert.education.toLowerCase();
    if (el.includes(q)) score += 6;
  }
  
  // 7. Contact person matching (all contacts)
  const searchContacts = getContactsList(expert);
  searchContacts.forEach(c => {
    if (c.person && c.person.toLowerCase().includes(q)) score += 3;
    if (c.info && c.info.toLowerCase().includes(q)) score += 3;
  });
  
  // 8. Referrer matching
  if (expert.referrer) {
    const rl = expert.referrer.toLowerCase();
    if (rl.includes(q)) score += 3;
  }
  
  // 9. Bonus for multi-word queries: count how many words match
  const queryWords = q.split(/\s+/).filter(w => w.length > 0);
  if (queryWords.length > 1) {
    const allFields = [
      nameLower,
      ...expert.fields.map(f => f.toLowerCase()),
      ...(expert.advantages || []).map(a => (a.title + ' ' + a.desc).toLowerCase()),
      (expert.qualifications || '').toLowerCase(),
      (expert.courses || '').toLowerCase(),
      (expert.education || '').toLowerCase()
    ].join(' ');
    let wordMatches = 0;
    queryWords.forEach(w => {
      if (allFields.includes(w)) wordMatches++;
    });
    score += wordMatches * 10;
  }
  
  return score;
}

function getFilteredExperts() {
  const db = appState.db;
  let experts = db.experts.filter(e => e.status !== 'eliminated');
  
  // Score filter (only when user actively selects a threshold)
  if (appState.scoreFilter) {
    experts = experts.filter(e => e.scores.overall >= appState.scoreFilter);
  }
  
  // Field filter (multi-select, AND logic - expert must have ALL selected fields)
  if (appState.fieldFilter.size > 0) {
    const selectedFields = Array.from(appState.fieldFilter);
    experts = experts.filter(e => selectedFields.every(f => e.fields.includes(f)));
  }
  
  // Supplier filter (null=全部, true=是(在库), false=否)
  if (appState.supplierFilter !== null) {
    experts = experts.filter(e => !!e.isSupplier === appState.supplierFilter);
  }
  
  // v3.0: Favorites filter
  if (appState.favoritesFilter) {
    const favIds = getFavorites();
    experts = experts.filter(e => favIds.includes(e.id));
  }
  
  // v3.5: Cooperation experience filter
  if (appState.cooperationFilter !== null) {
    experts = experts.filter(e => {
      const hasProjects = db.yiliProjects && Array.isArray(db.yiliProjects) &&
        db.yiliProjects.some(p => p.expertId === e.id && p.visible);
      return appState.cooperationFilter ? hasProjects : !hasProjects;
    });
  }
  
  // Search - broad match across name, fields, qualifications, courses, advantages
  if (appState.searchQuery) {
    const q = appState.searchQuery.toLowerCase();
    experts = experts.filter(e => {
      // Check if any field matches
      const allContacts = getContactsList(e);
      const allText = [
        e.name.toLowerCase(),
        ...e.fields.map(f => f.toLowerCase()),
        ...(e.advantages || []).map(a => (a.title + ' ' + a.desc).toLowerCase()),
        (e.qualifications || '').toLowerCase(),
        (e.courses || '').toLowerCase(),
        (e.education || '').toLowerCase(),
        ...allContacts.map(c => (c.person + ' ' + c.info).toLowerCase()),
        (e.referrer || '').toLowerCase()
      ].join(' ');
      return allText.includes(q);
    });
    // Attach relevance scores and sort by relevance
    experts.forEach(e => { e._relevance = getRelevanceScore(e, appState.searchQuery); });
    experts.sort((a, b) => b._relevance - a._relevance);
  } else {
    // Clean up relevance scores
    experts.forEach(e => { delete e._relevance; });
  }
  
  // Sort (only when no search query; search uses relevance sort)
  if (!appState.searchQuery) {
    switch (appState.currentSort) {
      case 'overall':
        experts.sort((a,b) => b.scores.overall - a.scores.overall);
        break;
      case 'professional':
        experts.sort((a,b) => b.scores.professional - a.scores.professional);
        break;
      case 'influence':
        experts.sort((a,b) => b.scores.influence - a.scores.influence);
        break;
      default:
        experts.sort((a,b) => a.name.localeCompare(b.name, 'zh'));
    }
  }
  
  return experts;
}

function renderExpertGrid() {
  const grid = document.getElementById('expert-grid');
  const countInfo = document.getElementById('expert-count');
  if (!grid) return;

  grid.innerHTML = '';
  const allExperts = getFilteredExperts();

  // Pagination
  const totalPages = Math.max(1, Math.ceil(allExperts.length / appState.PAGE_SIZE));
  // Clamp current page to valid range
  if (appState.currentPage > totalPages) appState.currentPage = totalPages;
  if (appState.currentPage < 1) appState.currentPage = 1;
  const startIdx = (appState.currentPage - 1) * appState.PAGE_SIZE;
  const paginatedExperts = allExperts.slice(startIdx, startIdx + appState.PAGE_SIZE);

  countInfo.innerHTML = '共 <span>' + allExperts.length + '</span> 位专家' +
    (totalPages > 1 ? '（第 ' + appState.currentPage + '/' + totalPages + ' 页）' : '') +
    (appState.searchQuery ? ' <span class="search-results-hint">（搜索："' + escapeHtml(appState.searchQuery) + '"）</span>' : '');

  const db = appState.db;

  paginatedExperts.forEach(expert => {
    const card = h('div', {
      className: 'expert-card',
      onclick: () => showExpertDetail(expert)
    });
    
    // ===== Card Header: avatar + name/fields two-line layout =====
    const cardHeader = h('div', { className: 'card-header' });
    
    // Avatar circle (blue circle + white surname)
    const surname = expert.name.charAt(0);
    const avatar = h('div', { className: 'card-avatar' }, surname);
    cardHeader.appendChild(avatar);
    
    // Right side: name row + fields row
    const headerInfo = h('div', { className: 'card-header-info' });
    
    // Row 1: name + fav star + scores
    const nameRow = h('div', { className: 'card-name-row' });
    nameRow.appendChild(h('div', { className: 'card-name' }, expert.name));
    
    // v3.1: 收藏星标 ⭐ — 放在姓名右侧行内
    const favved = isFavorited(expert.id);
    const favStar = h('span', {
      className: 'card-fav-star' + (favved ? ' active' : ''),
      title: favved ? '取消收藏' : '收藏专家',
      onclick: async (e) => {
        e.stopPropagation();
        const nowFavved = await toggleFavorite(expert.id);
        favStar.className = 'card-fav-star' + (nowFavved ? ' active' : '');
        favStar.title = nowFavved ? '取消收藏' : '收藏专家';
        favStar.textContent = nowFavved ? '⭐' : '☆';
      }
    }, favved ? '⭐' : '☆');
    nameRow.appendChild(favStar);
    
    if (db.ratingConfig.showScores !== false) {
      const scoreBox = h('div', { className: 'card-score-box' });
      const overallScore = h('div', { className: 'card-score-main' });
      overallScore.appendChild(h('span', { className: 'star' }, '★'));
      overallScore.appendChild(h('span', {}, expert.scores.overall.toFixed(1)));
      scoreBox.appendChild(overallScore);
      const subScores = h('div', { className: 'card-score-subs' });
      const profTag = h('span', { className: 'card-score-sub prof' }, '专业度 ' + expert.scores.professional.toFixed(0));
      const inflTag = h('span', { className: 'card-score-sub infl' }, '影响力 ' + expert.scores.influence.toFixed(0));
      subScores.appendChild(profTag);
      subScores.appendChild(inflTag);
      scoreBox.appendChild(subScores);
      nameRow.appendChild(scoreBox);
    }
    headerInfo.appendChild(nameRow);
    
    // Row 2: fields
    const fieldsRow = h('div', { className: 'card-fields-row' });
    expert.fields.forEach(fName => {
      const fieldMeta = db.fields.find(f => f.name === fName);
      const color = fieldMeta ? fieldMeta.color : '#64748b';
      const textColor = fieldMeta ? (fieldMeta.textColor || getTextColorForBg(color)) : '#ffffff';
      fieldsRow.appendChild(h('span', {
        className: 'card-field-tag',
        style: { background: color, color: textColor }
      }, fName));
    });
    headerInfo.appendChild(fieldsRow);
    
    cardHeader.appendChild(headerInfo);
    card.appendChild(cardHeader);
    
    // ===== 资历资质（简化：▸符号，每条1行，最多3条）- 统一浅色 =====
    const qualItems = getQualSimpleItems(expert);
    if (qualItems.length > 0) {
      const qualDiv = h('div', { className: 'card-qual-highlights' });
      qualItems.forEach((q, qi) => {
        const line = h('div', { className: 'card-qual-line' });
        line.appendChild(h('span', {
          className: 'card-qual-bullet'
        }, '▸'));
        line.appendChild(h('span', {
          className: 'card-qual-text'
        }, q));
        qualDiv.appendChild(line);
      });
      card.appendChild(qualDiv);
    }
    
    // Yili projects — 显示已合作项目（次数+最近项目，位于资历与优势之间）
    const visibleProjects = (db.yiliProjects && Array.isArray(db.yiliProjects))
      ? db.yiliProjects.filter(p => p.expertId === expert.id && p.visible).sort((a,b) => b.year - a.year || (b.month||0) - (a.month||0))
      : [];
    if (visibleProjects.length > 0) {
      const projBox = h('div', { className: 'card-yili-project' });
      const latest = visibleProjects[0];
      if (visibleProjects.length === 1) {
        // 仅1次：不显示次数，直接显示项目信息
        projBox.appendChild(h('div', { className: 'proj-count-line' }, '📋 最近合作：' + latest.title));
        let metaStr = latest.year + '年';
        if (latest.month) metaStr += (latest.month < 10 ? '0' : '') + latest.month + '月';
        projBox.appendChild(h('div', { className: 'proj-detail-line' }, metaStr));
        // 满意度 — 五角星 + 数值
        if (latest.satisfaction && latest.satisfaction.value) {
          const stars = formatSatisfactionStars(latest.satisfaction);
          const numVal = formatSatisfactionDisplay(latest.satisfaction);
          const satLine = h('div', { className: 'proj-detail-line' });
          satLine.appendChild(h('span', { style: 'color:#eab308;letter-spacing:2px' }, stars));
          satLine.appendChild(h('span', { style: 'color:#166534;margin-left:6px;font-size:11px' }, numVal + '/10'));
          projBox.appendChild(satLine);
        }
      } else {
        // ≥2次：首行显示次数，次行显示标题，第三行显示时间，第四行显示满意度
        projBox.appendChild(h('div', { className: 'proj-count-line' }, '📋 已合作 ' + visibleProjects.length + ' 次'));
        projBox.appendChild(h('div', { className: 'proj-detail-line', style: 'font-weight:600' }, '最近合作：' + latest.title));
        let detailStr = latest.year + '年';
        if (latest.month) detailStr += (latest.month < 10 ? '0' : '') + latest.month + '月';
        projBox.appendChild(h('div', { className: 'proj-detail-line' }, detailStr));
        // 满意度 — 五角星 + 数值
        if (latest.satisfaction && latest.satisfaction.value) {
          const stars = formatSatisfactionStars(latest.satisfaction);
          const numVal = formatSatisfactionDisplay(latest.satisfaction);
          const satLine = h('div', { className: 'proj-detail-line' });
          satLine.appendChild(h('span', { style: 'color:#eab308;letter-spacing:2px' }, stars));
          satLine.appendChild(h('span', { style: 'color:#166534;margin-left:6px;font-size:11px' }, numVal + '/10'));
          projBox.appendChild(satLine);
        }
      }
      card.appendChild(projBox);
    }
    
    // Advantages（突出优势 - 数字标号1、2、3，蓝色加粗内容） 
    const advItems = getAdvItems(expert);
    if (advItems.length > 0) {
      const advList = h('div', { className: 'card-advantages-new' });
      advItems.forEach((item, idx) => {
        const advItemDiv = h('div', { className: 'card-advantage-title-item' });
        advItemDiv.appendChild(h('span', { className: 'card-adv-num' }, String(idx + 1)));
        // Process highlight: text before ：is blue bold
        const colonIdx = item.indexOf('：');
        if (colonIdx > 0) {
          advItemDiv.appendChild(h('span', { className: 'card-adv-title-bold' }, item.substring(0, colonIdx) + '：'));
          advItemDiv.appendChild(h('span', {}, item.substring(colonIdx + 1)));
        } else {
          advItemDiv.appendChild(h('span', { className: 'card-adv-title-bold' }, item));
        }
        advList.appendChild(advItemDiv);
      });
      card.appendChild(advList);
    }
    
    // Education（下移）
    if (expert.education && expert.education !== '未公开') {
      card.appendChild(h('div', { className: 'card-edu card-edu-bottom' }, '🎓 ' + (expert.education.length > 50 ? expert.education.substring(0,50)+'...' : expert.education)));
    }
    
    // Contact (v3.1: 卡片只显示第一个联系人)
    const contacts = getContactsList(expert);
    if (contacts.length > 0 && (contacts[0].person || contacts[0].info)) {
      const contactDiv = h('div', { className: 'card-contact' });
      if (contacts[0].person) {
        contactDiv.appendChild(h('span', {}, '👤 ' + contacts[0].person));
      }
      if (contacts[0].info) {
        const typeLabel = contacts[0].type === 'email' ? '📧 ' : contacts[0].type === 'wechat' ? '💬 ' : '📞 ';
        const displayInfo = contacts[0].info.length > 25 ? contacts[0].info.substring(0,25)+'...' : contacts[0].info;
        contactDiv.appendChild(h('span', {}, typeLabel + displayInfo));
      }
      // v3.2: 卡片只显示第一位联系人，不提示还有更多
      card.appendChild(contactDiv);
    }
    
    // Supplier bookmark badge - top-right corner (异形书签)
    if (expert.isSupplier) {
      card.appendChild(h('div', { className: 'card-supplier-bookmark' }, '库内供应商'));
    }
    
    grid.appendChild(card);
  });

  // Always render right-side page navigation (single-page shows simplified: "1" + "顶部")
  renderPageNavigation(allExperts.length, totalPages);
}

// ===== v3.0: INLINE PAGE NAVIGATION (bottom of grid) =====
function renderPageNavigation(totalItems, totalPages) {
  // Clean up old navs
  const oldNav = document.getElementById('page-navigation');
  if (oldNav) oldNav.remove();
  const oldFloat = document.getElementById('page-navigation-float');
  if (oldFloat) oldFloat.remove();
  
  const grid = document.getElementById('expert-grid');
  if (!grid) return;
  
  const gotoPage = (p) => {
    appState.currentPage = p;
    renderExpertGrid();
    const gridEl = document.getElementById('expert-grid');
    if (gridEl) gridEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  
  // Build NAV HTML helper (returns DOM fragment)
  function buildNavHTML() {
    const frag = document.createDocumentFragment();
    const isMultiPage = totalPages > 1;
    
    const prevBtn = h('button', {
      className: 'page-nav-inline-btn' + (appState.currentPage === 1 ? ' disabled' : ''),
      onclick: () => { if (appState.currentPage > 1) gotoPage(appState.currentPage - 1); }
    }, '‹ 上页');
    frag.appendChild(prevBtn);
    
    if (isMultiPage) {
      const maxPageBtns = 7;
      let startPage = Math.max(1, appState.currentPage - Math.floor(maxPageBtns / 2));
      let endPage = Math.min(totalPages, startPage + maxPageBtns - 1);
      if (endPage - startPage < maxPageBtns - 1) {
        startPage = Math.max(1, endPage - maxPageBtns + 1);
      }
      if (startPage > 1) {
        frag.appendChild(h('button', { className: 'page-nav-inline-num', onclick: () => gotoPage(1) }, '1'));
        if (startPage > 2) frag.appendChild(h('span', { className: 'page-nav-inline-ellipsis' }, '…'));
      }
      for (let p = startPage; p <= endPage; p++) {
        frag.appendChild(h('button', {
          className: 'page-nav-inline-num' + (p === appState.currentPage ? ' active' : ''),
          onclick: () => gotoPage(p)
        }, String(p)));
      }
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) frag.appendChild(h('span', { className: 'page-nav-inline-ellipsis' }, '…'));
        frag.appendChild(h('button', { className: 'page-nav-inline-num', onclick: () => gotoPage(totalPages) }, String(totalPages)));
      }
    } else {
      frag.appendChild(h('button', { className: 'page-nav-inline-num active' }, '1'));
    }
    
    frag.appendChild(h('button', {
      className: 'page-nav-inline-btn' + (appState.currentPage === totalPages ? ' disabled' : ''),
      onclick: () => { if (appState.currentPage < totalPages) gotoPage(appState.currentPage + 1); }
    }, '下页 ›'));
    
    frag.appendChild(h('span', { className: 'page-nav-inline-info' }, appState.currentPage + ' / ' + totalPages + ' 页'));
    frag.appendChild(h('button', {
      className: 'page-nav-inline-btn',
      onclick: () => { window.scrollTo({ top: 0, behavior: 'smooth' }); }
    }, '返回顶部'));
    
    return frag;
  }
  
  // v3.2: 仅保留浮动页码导航（浮动在视口底部），移除底部内联导航避免重叠
  const floatNav = document.createElement('div');
  floatNav.id = 'page-navigation-float';
  floatNav.className = 'page-navigation-float';
  floatNav.appendChild(buildNavHTML()); // clone buttons with fresh event listeners
  document.body.appendChild(floatNav);
  
  // Scroll observer: show floating nav when filter bar is off-screen
  setupFloatingNavScroll();
}

// v3.0: 浮动页码导航 — 当顶部筛选不可见时，浮动在视口底部
let _floatingNavScrollHandler = null;
function setupFloatingNavScroll() {
  if (_floatingNavScrollHandler) {
    window.removeEventListener('scroll', _floatingNavScrollHandler);
  }
  _floatingNavScrollHandler = function() {
    const floatNav = document.getElementById('page-navigation-float');
    if (!floatNav) return;
    // Find the last filter bar (supplier/favourite bars) to detect when they're off-screen
    const lastFilterBar = document.querySelector('.merged-bar-wrapper, .search-bar');
    if (lastFilterBar) {
      const rect = lastFilterBar.getBoundingClientRect();
      // Show float nav when the last filter bar is scrolled above the viewport
      if (rect.bottom < 0) {
        floatNav.classList.add('visible');
      } else {
        floatNav.classList.remove('visible');
      }
    }
  };
  window.addEventListener('scroll', _floatingNavScrollHandler, { passive: true });
  // Initial check
  _floatingNavScrollHandler();
}

// v3.0: page nav is now inline at bottom — no fixed sidebar scroll handler needed

// Extract qualification items for card display
// Uses G column "资历显示字段" - plain text split by \n or ■
function getQualSimpleItems(expert) {
  if (expert.qualDisplay) {
    const raw = String(expert.qualDisplay).trim();
    if (!raw) return [];
    // Split by \n first, then by ■ as fallback
    let items = [];
    if (raw.includes('\n')) {
      items = raw.split('\n').map(s => s.trim()).filter(Boolean);
    } else if (raw.includes('■')) {
      items = raw.split('■').map(s => s.trim()).filter(Boolean);
      // Clean ■ markers: keep text after 】
      items = items.map(it => {
        const cleanMatch = it.match(/】\s*(.+)/);
        if (cleanMatch) return cleanMatch[1].trim();
        return it;
      });
    } else {
      items = [raw];
    }
    return items.slice(0, 3);
  }
  return [];
}

// Extract advantage items for card display
// Priority: expert.advDisplay (new) → extract from advantages array (fallback)
function getAdvItems(expert) {
  // Use D column "优势显示字段" - concise format with 1、2、3 number prefixes
  if (expert.advDisplay) {
    const items = String(expert.advDisplay).split('\n').map(s => s.trim()).filter(Boolean);
    // Strip "1、", "2、" etc. prefix since card has its own number badges
    return items.slice(0, 4).map(item => item.replace(/^\d+[、，．.]\s*/, ''));
  }
  return [];
}

// ===== EXPERT DETAIL MODAL =====
function showExpertDetail(expert) {
  const db = appState.db;
  const overlay = h('div', { className: 'modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const content = h('div', { className: 'modal-content' });
  
  // Header
  const modalHeader = h('div', { className: 'modal-header' });
  // Group name + fav star + supplier ribbon together
  const nameGroup = h('span', { className: 'modal-title-group' });
  const nameSpan = h('span', { className: 'modal-title' }, expert.name);
  nameGroup.appendChild(nameSpan);
  // v3.1: 收藏星标 — 姓名右侧，库内供应商标签左侧
  const detailFavved = isFavorited(expert.id);
  const detailFavStar = h('span', {
    className: 'card-fav-star detail-fav-star' + (detailFavved ? ' active' : ''),
    title: detailFavved ? '取消收藏' : '收藏专家',
    onclick: (e) => {
      e.stopPropagation();
      const nowFavved = toggleFavorite(expert.id);
      detailFavStar.className = 'card-fav-star detail-fav-star' + (nowFavved ? ' active' : '');
      detailFavStar.title = nowFavved ? '取消收藏' : '收藏专家';
      detailFavStar.textContent = nowFavved ? '⭐' : '☆';
    }
  }, detailFavved ? '⭐' : '☆');
  nameGroup.appendChild(detailFavStar);
  // Supplier ribbon - inline after name and star
  if (expert.isSupplier) {
    const supplierTag = h('span', { className: 'detail-supplier-ribbon' }, '库内供应商');
    nameGroup.appendChild(supplierTag);
  }
  modalHeader.appendChild(nameGroup);
  const closeBtn = h('button', { className: 'modal-close', onclick: () => overlay.remove() }, '✕');
  modalHeader.appendChild(closeBtn);
  content.appendChild(modalHeader);
  
  const body = h('div', { className: 'modal-body' });
  
  // Score with dimensions - horizontal triple layout (controlled by showScores toggle)
  const cfg = db.ratingConfig;
  
  if (cfg.showScores !== false) {
  const scoreSection = h('div', { className: 'detail-section' });
  scoreSection.appendChild(h('div', { className: 'detail-section-title' }, '评分信息'));
  
  // Three scores at same level
  const scoreRow = h('div', { className: 'detail-score-row' });
  
  // Overall score
  const overallCard = h('div', { className: 'detail-score-card' });
  overallCard.appendChild(h('div', { className: 'detail-score-card-val overall' }, expert.scores.overall.toFixed(1)));
  overallCard.appendChild(h('div', { className: 'detail-score-card-label' }, '综合评分'));
  scoreRow.appendChild(overallCard);
  
  // Professional score
  const profCard = h('div', { className: 'detail-score-card' });
  profCard.appendChild(h('div', { className: 'detail-score-card-val prof' }, expert.scores.professional.toFixed(0)));
  profCard.appendChild(h('div', { className: 'detail-score-card-label' }, '专业度'));
  scoreRow.appendChild(profCard);
  
  // Influence score
  const inflCard = h('div', { className: 'detail-score-card' });
  inflCard.appendChild(h('div', { className: 'detail-score-card-val infl' }, expert.scores.influence.toFixed(0)));
  inflCard.appendChild(h('div', { className: 'detail-score-card-label' }, '影响力'));
  scoreRow.appendChild(inflCard);
  
  scoreSection.appendChild(scoreRow);
  
  // Sub-dimension progress bars - in a unified area
  if (expert.subScores) {
    const profDim = cfg.dimensions.find(d => d.id === 'professional');
    const inflDim = cfg.dimensions.find(d => d.id === 'influence');
    
    if (profDim && inflDim) {
      const subArea = h('div', { className: 'detail-score-sub-area' });
      
      // Professional sub-section
      if (expert.subScores.professional) {
        const profBlock = h('div', { className: 'detail-score-sub-block' });
        profBlock.appendChild(h('div', { className: 'detail-score-sub-title prof' }, '专业度 · 细分标准'));
        const profList = h('div', { className: 'score-bar-list' });
        profDim.subDimensions.forEach(sd => {
          const val = expert.subScores.professional[sd.name] || 0;
          profList.appendChild(renderScoreBar(sd.name, val, 'blue'));
        });
        profBlock.appendChild(profList);
        subArea.appendChild(profBlock);
      }
      
      // Influence sub-section
      if (expert.subScores.influence) {
        const inflBlock = h('div', { className: 'detail-score-sub-block' });
        inflBlock.appendChild(h('div', { className: 'detail-score-sub-title infl' }, '影响力 · 细分标准'));
        const inflList = h('div', { className: 'score-bar-list' });
        inflDim.subDimensions.forEach(sd => {
          const val = expert.subScores.influence[sd.name] || 0;
          inflList.appendChild(renderScoreBar(sd.name, val, 'amber'));
        });
        inflBlock.appendChild(inflList);
        subArea.appendChild(inflBlock);
      }
      
      scoreSection.appendChild(subArea);
    }
  }
  
  body.appendChild(scoreSection);
  }
  
  // Fields
  const fieldsSection = h('div', { className: 'detail-section' });
  fieldsSection.appendChild(h('div', { className: 'detail-section-title' }, '适用领域'));
  const fieldTags = h('div', { className: 'detail-field-tags' });
  expert.fields.forEach(fName => {
    const fMeta = db.fields.find(f => f.name === fName);
    const color = fMeta ? fMeta.color : '#64748b';
    const textColor = fMeta ? (fMeta.textColor || getTextColorForBg(color)) : '#ffffff';
    fieldTags.appendChild(h('span', { className: 'card-field-tag', style: { background: color, color: textColor, padding:'6px 14px', fontSize:'13px' } }, fName));
  });
  fieldsSection.appendChild(fieldTags);
  body.appendChild(fieldsSection);
  
  // Education
  if (expert.education && expert.education !== '未公开') {
    const eduSection = h('div', { className: 'detail-section' });
    eduSection.appendChild(h('div', { className: 'detail-section-title' }, '学历'));
    eduSection.appendChild(h('div', { className: 'detail-text' }, expert.education));
    body.appendChild(eduSection);
  }
  
  // Advantages (as intro with ■ format, preserving original data source style)
  if (expert.advantages && expert.advantages.length > 0) {
    const advSection = h('div', { className: 'detail-section' });
    advSection.appendChild(h('div', { className: 'detail-section-title' }, '专家简介'));
    const advBox = h('div', { className: 'detail-advantages' });
    expert.advantages.forEach(adv => {
      const item = h('div', { className: 'detail-advantage-item' });
      const content = adv.title ? '■' + adv.title + '：' + adv.desc : '■' + adv.desc;
      item.textContent = content;
      advBox.appendChild(item);
    });
    advSection.appendChild(advBox);
    body.appendChild(advSection);
  }
  
  // Qualifications
  if (expert.qualifications && expert.qualifications !== '未公开') {
    const qualSection = h('div', { className: 'detail-section' });
    qualSection.appendChild(h('div', { className: 'detail-section-title' }, '资历资质'));
    const qualText = h('div', { className: 'detail-text' });
    qualText.innerHTML = formatRichText(expert.qualifications);
    qualSection.appendChild(qualText);
    body.appendChild(qualSection);
  }
  
  // Reference Cases (formerly 课程/案例)
  if (expert.courses) {
    const courseSection = h('div', { className: 'detail-section' });
    courseSection.appendChild(h('div', { className: 'detail-section-title' }, '参考案例'));
    const courseText = h('div', { className: 'detail-text' });
    courseText.innerHTML = formatRichText(expert.courses);
    courseSection.appendChild(courseText);
    body.appendChild(courseSection);
  }
  
  // Yili projects — 显示全部可见项目（时间倒序）
  const visibleProjects = (db.yiliProjects && Array.isArray(db.yiliProjects))
    ? db.yiliProjects.filter(p => p.expertId === expert.id && p.visible).sort((a,b) => b.year - a.year || (b.month||0) - (a.month||0))
    : [];
  if (visibleProjects.length > 0) {
    const yiliSection = h('div', { className: 'detail-section' });
    yiliSection.appendChild(h('div', { className: 'detail-section-title' }, '伊利合作项目（' + visibleProjects.length + '）'));
    const projList = h('div', { style: visibleProjects.length > 5 ? 'max-height:420px;overflow-y:auto' : '' });
    visibleProjects.forEach((proj, idx) => {
      const projCard = h('div', {
        style: 'padding:12px 16px;margin-bottom:' + (idx < visibleProjects.length - 1 ? '8px' : '0') + ';background:linear-gradient(135deg, #f0fdf4, #dcfce7);border:1px solid #bbf7d0;border-radius:8px;font-size:14px;color:#166534'
      });
      // 1. 项目名称
      projCard.appendChild(h('div', { style: 'font-weight:600;margin-bottom:4px;font-size:14px' }, proj.title));
      // 2. 时间（年度 + 月度精确）
      let timeStr = proj.year + '年';
      if (proj.month) timeStr += proj.month + '月';
      const timeLine = h('div', { style: 'font-size:12px;color:#15803d;margin-bottom:2px' });
      timeLine.textContent = timeStr;
      projCard.appendChild(timeLine);
      // 3. 满意度（五角星 + 数值）
      if (proj.satisfaction && proj.satisfaction.value) {
        const stars = formatSatisfactionStars(proj.satisfaction);
        const numVal = formatSatisfactionDisplay(proj.satisfaction);
        const satLine = h('div', { style: 'font-size:13px;color:#f59e0b;margin-bottom:2px' });
        satLine.appendChild(h('span', { style: 'letter-spacing:2px' }, stars));
        satLine.appendChild(h('span', { style: 'color:#166534;margin-left:6px;font-size:12px' }, numVal + '/10'));
        projCard.appendChild(satLine);
      }
      // 4. 项目描述（为空不显示）
      if (proj.desc) {
        projCard.appendChild(h('div', { style: 'font-size:13px;color:#15803d;margin-top:4px;line-height:1.6' }, proj.desc));
      }
      projList.appendChild(projCard);
    });
    yiliSection.appendChild(projList);
    body.appendChild(yiliSection);
  }
  
  // Contact (v3.1: 支持多联系人依次显示)
  const detailContacts = getContactsList(expert);
  if (detailContacts.length > 0 || expert.referrer) {
    const contactSection = h('div', { className: 'detail-section' });
    contactSection.appendChild(h('div', { className: 'detail-section-title' }, '联系方式'));
    const typeMap = { email: '邮箱', wechat: '微信', phone: '电话' };
    
    detailContacts.forEach((c, idx) => {
      if (c.person || c.info) {
        const label = detailContacts.length === 1 ? '联系人' : ('联系人' + (idx + 1));
        let line = label + '：' + (c.person || '');
        if (c.info) {
          line += '，' + (typeMap[c.type] || '联系方式') + '：' + c.info;
        }
        contactSection.appendChild(h('div', { className: 'detail-text', style: { marginBottom: detailContacts.length > 1 ? '6px' : '0' } }, line));
      }
    });
    
    if (expert.referrer) {
      contactSection.appendChild(h('div', { className: 'detail-text', style: { marginTop: '8px' } }, '内部推荐人：' + expert.referrer));
    }
    body.appendChild(contactSection);
  }
  
  content.appendChild(body);
  overlay.appendChild(content);
  document.body.appendChild(overlay);
}

function formatRichText(text) {
  if (!text) return '';
  // Helper: auto-linkify URLs in a text segment
  function linkify(s) {
    const escaped = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const urlRegex = /(https?:\/\/[^\s<>"'}\uFF0C\u3002\uFF1B\uFF09\uFF08()]+)/gi;
    return escaped.replace(urlRegex, function(match) {
      const clean = match.replace(/[\u3002\uFF0C\u3001\uFF1B\uFF09\uFF09\u201C\u201D''\]\u3011]$/, '');
      return '<a href="' + clean + '" target="_blank" rel="noopener" style="color:var(--primary);word-break:break-all;">' + clean + '</a>';
    });
  }
  // Helper: clean content \u2014 replace / separators with line breaks, never orphan slashes
  function cleanContent(s) {
    // First linkify URLs (so https:// inside <a> tags is never touched)
    var r = linkify(s);
    // Replace literal newlines with <br>
    r = r.replace(/\n/g, '<br>');
    // Rule 1: " / " (space-slash-space) => line break between items
    r = r.replace(/ \/ /g, '<br>');
    // Rule 2: " /<br>" (space-slash at end of an item) => just <br>
    r = r.replace(/ \/<br>/g, '<br>');
    // Rule 3: "/ " (slash-space) => line break
    r = r.replace(/\/ /g, '<br>');
    // Rule 4: trailing "/" at end of content => remove
    r = r.replace(/\s*\/\s*$/, '');
    // Rule 5: leading "/" => remove
    r = r.replace(/^\s*\/\s*/, '');
    // Rule 6: remaining isolated / => wrap in nowrap (only outside <a> tags)
    r = r.replace(/(<a\b[^>]*>[\s\S]*?<\/a>)|(\/)/gi, function(m, atag, slash) {
      return atag || '<span style="white-space:nowrap">&#8203;/&#8203;</span>';
    });
    return r;
  }
  // Split by \u3010category\u3011 and render as sub-heading + content
  var result = '';
  var parts = text.split(/\u3010([^\u3011]+)\u3011/);
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();
    if (!part) continue;
    if (i % 2 === 1) {
      result += '<div class="detail-sub-heading">' + part.replace(/\//g, '<span style="white-space:nowrap">&#8203;/&#8203;</span>') + '</div>';
    } else {
      result += '<div class="detail-sub-content">' + cleanContent(part) + '</div>';
    }
  }
  if (result === '') {
    result = '<div class="detail-sub-content">' + cleanContent(text) + '</div>';
  }
  return result;
}

function renderScoreBar(label, score, colorClass) {
  const pct = Math.round(score / 10 * 100);
  const item = h('div', { className: 'score-bar-item' });
  
  const infoRow = h('div', { className: 'score-bar-info' });
  infoRow.appendChild(h('span', { className: 'score-bar-label' }, label));
  infoRow.appendChild(h('span', { className: 'score-bar-value ' + colorClass }, score + ' 分'));
  item.appendChild(infoRow);
  
  const track = h('div', { className: 'score-bar-track' });
  const fill = h('div', {
    className: 'score-bar-fill ' + colorClass,
    style: { width: pct + '%' }
  });
  track.appendChild(fill);
  item.appendChild(track);
  
  return item;
}

// ===== DASHBOARD =====
function renderMainFieldChart() {
  const db = appState.db;
  const experts = db.experts.filter(e => e.status !== 'eliminated');
  
  // Filter fields same as filter bar logic
  const chartUsedFields = new Set(experts.flatMap(e => e.fields || []));
  const chartVisibleFields = db.fields.filter(f => {
    if (f.hideWhenEmpty && !chartUsedFields.has(f.name)) return false;
    return true;
  });
  
  const fieldCount = {};
  chartVisibleFields.forEach(f => { fieldCount[f.name] = 0; });
  experts.forEach(e => {
    e.fields.forEach(f => { if (fieldCount[f] !== undefined) fieldCount[f]++; });
  });
  
  const fieldNames = Object.keys(fieldCount);
  const fieldValues = Object.values(fieldCount);
  const fieldColors = chartVisibleFields.map(f => f.color);
  
  // Try both old and new container IDs
  let container = document.getElementById('main-field-chart-inline');
  if (!container) {
    container = document.getElementById('main-field-chart');
  }
  if (!container) return;
  
// Shorten field names for chart display (4-5 chars, no rotation)
const shortNames = fieldNames.map(n => {
  const abbrevMap = {
    'AI': 'AI',
    '产品': '产品',
    '产品创新': '产品创新',
    '内容营销': '内容营销',
    '商业模式': '商业模式',
    '战略规划/战略解码/战略落地': '战略规划',
    '技术': '技术',
    '数据': '数据',
    '数智化供应链': '数智供应链',
    '数智化营销': '数智营销',
    '流程管理': '流程管理',
    '电商': '电商',
    '组织人才': '组织人才',
    '通用（领导力/协同/执行力/目标管理）': '通用',
    '会员运营': '会员运营'
  };
  return abbrevMap[n] || (n.length > 5 ? n.substring(0, 4) + '…' : n);
});
  
  const targetId = container.id;
  renderVerticalBarChart(targetId, shortNames, fieldNames, fieldValues, fieldColors);
}

function renderVerticalBarChart(containerId, displayLabels, fullLabels, data, colors) {
  const container = document.getElementById(containerId);
  if (!container || data.length === 0) return;

  // Build legend HTML for left and right sides
  function buildLegendHTML(labels, colors, side) {
    let html = '';
    const half = Math.ceil(labels.length / 2);
    const start = side === 'left' ? 0 : half;
    const end = side === 'left' ? half : labels.length;
    for (let i = start; i < end; i++) {
      const color = (colors && colors[i]) ? colors[i] : '#3B82F6';
      html += '<div style="display:flex;align-items:flex-start;gap:7px;margin-bottom:8px;font-size:10px;line-height:1.35;">';
      html += '<span style="display:inline-block;width:9px;height:9px;border-radius:2px;flex-shrink:0;margin-top:2px;background:' + color + ';"></span>';
      html += '<span style="color:#475569;white-space:normal;word-break:break-word;max-width:118px;">' + escapeHtml(labels[i]) + '</span>';
      html += '</div>';
    }
    return html;
  }

  const colCount = data.length;
  const colW = 22;
  const gap = 22;
  const maxH = 110;
  const bottomPad = 32;
  const topPad = 22;
  const chartSidePad = 16;
  const legendWidth = 140;
  const w = colCount * (colW + gap) - gap + chartSidePad * 2;
  const h = maxH + topPad + bottomPad;
  const maxVal = Math.max(...data, 1);

  // Center the chart+legend wrapper
  container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;overflow-x:auto;">' +
    '<div style="display:flex;align-items:flex-start;flex-shrink:0;gap:24px;">' +
    '<div style="width:' + legendWidth + 'px;flex-shrink:0;padding-right:16px;padding-top:8px;">' +
      buildLegendHTML(fullLabels, colors, 'left') +
    '</div>' +
    '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="overflow:visible;flex-shrink:0;">' +
    '</svg>' +
    '<div style="width:' + legendWidth + 'px;flex-shrink:0;padding-left:16px;padding-top:8px;">' +
      buildLegendHTML(fullLabels, colors, 'right') +
    '</div>' +
    '</div></div>';

  // Get the SVG element we just created
  const svgEl = container.querySelector('svg');
  if (!svgEl) return;

  let svg = '';

  data.forEach((val, i) => {
    const x = chartSidePad + i * (colW + gap);
    const bh = Math.max(6, (val / maxVal) * maxH);
    const y = topPad + maxH - bh;
    const color = (colors && colors[i]) ? colors[i] : '#3B82F6';

    // Bar
    svg += '<rect x="' + x + '" y="' + y + '" width="' + colW + '" height="' + bh + '" rx="4" fill="' + color + '" opacity="0.88">';
    svg += '<title>' + escapeHtml(fullLabels[i]) + ': ' + val + '人</title>';
    svg += '</rect>';

    // Value on top
    svg += '<text x="' + (x + colW/2) + '" y="' + (y - 4) + '" text-anchor="middle" font-size="11" fill="' + color + '" font-weight="600">' + val + '</text>';

    // Label below - with more bottom padding for spacing
    const label = displayLabels[i];
    svg += '<text x="' + (x + colW/2) + '" y="' + (h - 8) + '" text-anchor="middle" font-size="9" fill="#64748b" font-weight="400">';
    svg += escapeHtml(label) + '</text>';
  });

  svgEl.innerHTML = svg;
}

function renderHorizontalBarChart(containerId, displayLabels, fullLabels, data, colors) {
  const container = document.getElementById(containerId);
  if (!container || data.length === 0) return;
  
  const maxVal = Math.max(...data, 1);
  const isInline = containerId === 'main-field-chart-inline';
  const barH = isInline ? 20 : 28;
  const gap = isInline ? 4 : 6;
  const labelW = isInline ? 75 : 110;
  const chartW = Math.max(container.clientWidth - 30, 500);
  const svgW = chartW;
  const svgH = data.length * (barH + gap) + 20;
  
  let svg = '<svg width="100%" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '" style="overflow:visible">';
  
  data.forEach((val, i) => {
    const y = i * (barH + gap) + 10;
    const barW = Math.max(4, (val / maxVal) * (chartW - labelW - 60));
    
    // Label
    svg += '<text x="' + (labelW - 5) + '" y="' + (y + barH/2 + 5) + '" text-anchor="end" font-size="11" fill="#475569" style="cursor:default">';
    svg += '<title>' + escapeHtml(fullLabels[i]) + '</title>';
    svg += escapeHtml(displayLabels[i]) + '</text>';
    
    // Bar background
    svg += '<rect x="' + labelW + '" y="' + y + '" width="' + (chartW - labelW - 60) + '" height="' + barH + '" rx="4" fill="#f1f5f9"/>';
    // Bar fill
    svg += '<rect x="' + labelW + '" y="' + y + '" width="' + barW + '" height="' + barH + '" rx="4" fill="' + (colors[i] || '#3B82F6') + '" opacity="0.85"/>';
    // Value
    svg += '<text x="' + (labelW + barW + 6) + '" y="' + (y + barH/2 + 5) + '" font-size="11" fill="' + (colors[i] || '#3B82F6') + '" font-weight="600">' + val + '人</text>';
  });
  
  svg += '</svg>';
  container.innerHTML = svg;
}

function showDashboard() {
  const db = appState.db;
  const experts = db.experts.filter(e => e.status !== 'eliminated');
  
  const overlay = h('div', { className: 'modal-overlay dashboard-modal', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const content = h('div', { className: 'modal-content' });
  
  const modalHeader = h('div', { className: 'modal-header' });
  modalHeader.appendChild(h('div', { className: 'modal-title' }, '📊 数据仪表盘'));
  modalHeader.appendChild(h('button', { className: 'modal-close', onclick: () => overlay.remove() }, '✕'));
  content.appendChild(modalHeader);
  
  const body = h('div', { className: 'modal-body' });
  const grid = h('div', { className: 'dashboard-grid' });
  
  // Field distribution chart
  const fieldCard = h('div', { className: 'dashboard-card full' });
  fieldCard.appendChild(h('h4', {}, '领域分布情况'));
  const fieldChart = h('div', { className: 'chart-container tall' });
  fieldChart.id = 'chart-fields';
  fieldCard.appendChild(fieldChart);
  grid.appendChild(fieldCard);
  
  // Average scores - numeric display (controlled by showScores)
  if (db.ratingConfig.showScores !== false) {
  const avgCard = h('div', { className: 'dashboard-card' });
  avgCard.appendChild(h('h4', {}, '各项评分平均分'));
  const avgDisplay = h('div', { id: 'chart-avg-display' });
  avgCard.appendChild(avgDisplay);
  grid.appendChild(avgCard);
  
  // Score distribution - doughnut chart
  const distCard = h('div', { className: 'dashboard-card' });
  distCard.appendChild(h('h4', {}, '综合评分专家数量占比（7分及以上）'));
  const distChart = h('div', { className: 'chart-container' });
  distChart.id = 'chart-dist';
  distCard.appendChild(distChart);
  grid.appendChild(distCard);
  }
  
  body.appendChild(grid);
  content.appendChild(body);
  overlay.appendChild(content);
  document.body.appendChild(overlay);
  
  // Render after DOM insertion
  setTimeout(() => renderCharts(experts), 100);
}

function renderCharts(experts) {
  const db = appState.db;
  
  // 仪表盘领域分布：同样过滤 hideWhenEmpty 且当前可见专家中无对应讲师的标签
  const chartUsedFields = new Set(experts.flatMap(e => e.fields || []));
  const chartVisibleFields = db.fields.filter(f => {
    if (f.hideWhenEmpty && !chartUsedFields.has(f.name)) return false;
    return true;
  });

  // Field distribution
  const fieldCount = {};
  chartVisibleFields.forEach(f => { fieldCount[f.name] = 0; });
  experts.forEach(e => {
    e.fields.forEach(f => { if (fieldCount[f] !== undefined) fieldCount[f]++; });
  });
  
  const fieldNames = Object.keys(fieldCount);
  const fieldValues = Object.values(fieldCount);
  const fieldColors = chartVisibleFields.map(f => f.color);
  
  renderBarChart('chart-fields', fieldNames, fieldValues, fieldColors, '领域分布');
  
  // Average scores - numeric display
  const profAvg = (experts.reduce((s,e) => s + e.scores.professional, 0) / experts.length).toFixed(1);
  const inflAvg = (experts.reduce((s,e) => s + e.scores.influence, 0) / experts.length).toFixed(1);
  const overallAvg = (experts.reduce((s,e) => s + e.scores.overall, 0) / experts.length).toFixed(1);
  
  const avgDisplay = document.getElementById('chart-avg-display');
  if (avgDisplay) {
    avgDisplay.innerHTML = '<div class="score-numeric-grid">' +
      '<div class="score-numeric-item"><div class="label">专业度</div><div class="value blue">' + profAvg + '</div><div class="sub">满分10分</div></div>' +
      '<div class="score-numeric-item"><div class="label">影响力</div><div class="value amber">' + inflAvg + '</div><div class="sub">满分10分</div></div>' +
      '<div class="score-numeric-item"><div class="label">综合评分</div><div class="value green">' + overallAvg + '</div><div class="sub">加权平均</div></div>' +
      '</div>';
  }
  
  // Score distribution - doughnut
  const ranges = ['7.0-7.5分', '7.5-8.0分', '8.0-8.5分', '8.5-9.0分', '9.0分以上'];
  const rangeCount = [0,0,0,0,0];
  experts.forEach(e => {
    const s = e.scores.overall;
    if (s < 7.5) rangeCount[0]++;
    else if (s < 8.0) rangeCount[1]++;
    else if (s < 8.5) rangeCount[2]++;
    else if (s < 9.0) rangeCount[3]++;
    else rangeCount[4]++;
  });
  
  renderDoughnutChart('chart-dist', ranges, rangeCount);
}

function renderBarChart(containerId, labels, data, colors, title) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const maxVal = Math.max(...data, 1);
  const chartHeight = Math.max(container.clientHeight - 50, 200);
  const chartWidth = Math.max(container.clientWidth, 500);
  const barWidth = Math.min(60, (chartWidth - 80) / labels.length - 10);
  const svgHeight = chartHeight + 40;
  
  let svg = '<svg width="100%" height="' + svgHeight + '" viewBox="0 0 ' + chartWidth + ' ' + svgHeight + '" style="overflow:visible">';
  
  // Y axis
  svg += '<line x1="50" y1="10" x2="50" y2="' + (chartHeight + 10) + '" stroke="#e2e8f0" stroke-width="1"/>';
  svg += '<line x1="50" y1="' + (chartHeight + 10) + '" x2="' + (chartWidth - 10) + '" y2="' + (chartHeight + 10) + '" stroke="#e2e8f0" stroke-width="1"/>';
  
  // Y labels with proper padding
  for (let i = 0; i <= 4; i++) {
    const y = chartHeight + 10 - (chartHeight * i / 4);
    const val = Math.round(maxVal * i / 4);
    svg += '<text x="45" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="#94a3b8">' + val + '</text>';
    svg += '<line x1="50" y1="' + y + '" x2="' + (chartWidth - 10) + '" y2="' + y + '" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="3,3"/>';
  }
  
  labels.forEach((label, i) => {
    const x = 60 + i * (chartWidth - 70) / labels.length;
    const h = Math.max(2, (data[i] / maxVal) * chartHeight);
    const y = chartHeight + 10 - h;
    
    svg += '<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + h + '" rx="4" fill="' + (colors[i] || '#3B82F6') + '" opacity="0.85"/>';
    
    // Value label above bar with enough space
    svg += '<text x="' + (x + barWidth/2) + '" y="' + Math.max(12, y - 6) + '" text-anchor="middle" font-size="11" font-weight="600" fill="#475569">' + data[i] + '</text>';
    
    // X label
    const labelText = label.length > 6 ? label.substring(0,6)+'…' : label;
    svg += '<text x="' + (x + barWidth/2) + '" y="' + (chartHeight + 30) + '" text-anchor="middle" font-size="10" fill="#64748b" transform="rotate(-20,' + (x + barWidth/2) + ',' + (chartHeight + 30) + ')">' + labelText + '</text>';
  });
  
  svg += '</svg>';
  container.innerHTML = svg;
}

function renderDoughnutChart(containerId, labels, data) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
  const total = data.reduce((a,b) => a+b, 0);
  const h = Math.max(280, container.clientHeight);
  const w = container.clientWidth || 400;
  
  let svg = '<svg width="100%" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="overflow:visible">';
  
  const cx = w * 0.38, cy = h * 0.48, r = Math.min(w * 0.22, 90);
  const innerR = r * 0.55;
  let startAngle = -Math.PI / 2;
  
  data.forEach((val, i) => {
    if (val === 0) return;
    const angle = (val / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    
    const x1o = cx + r * Math.cos(startAngle);
    const y1o = cy + r * Math.sin(startAngle);
    const x2o = cx + r * Math.cos(endAngle);
    const y2o = cy + r * Math.sin(endAngle);
    const x1i = cx + innerR * Math.cos(startAngle);
    const y1i = cy + innerR * Math.sin(startAngle);
    const x2i = cx + innerR * Math.cos(endAngle);
    const y2i = cy + innerR * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    
    svg += '<path d="M' + x1o.toFixed(1) + ',' + y1o.toFixed(1) + ' A' + r + ',' + r + ' 0 ' + largeArc + ' 1 ' + x2o.toFixed(1) + ',' + y2o.toFixed(1) + ' L' + x2i.toFixed(1) + ',' + y2i.toFixed(1) + ' A' + innerR + ',' + innerR + ' 0 ' + largeArc + ' 0 ' + x1i.toFixed(1) + ',' + y1i.toFixed(1) + ' Z" fill="' + colors[i] + '" opacity="0.9"/>';
    
    // Percentage label on slice
    const midAngle = startAngle + angle / 2;
    const labelR = (r + innerR) / 2;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);
    const pct = (val/total*100).toFixed(1);
    if (pct > 5) {
      svg += '<text x="' + lx.toFixed(1) + '" y="' + (ly + 4).toFixed(1) + '" text-anchor="middle" font-size="11" font-weight="700" fill="white">' + pct + '%</text>';
    }
    
    startAngle = endAngle;
  });
  
  // Center text
  svg += '<text x="' + cx + '" y="' + (cy - 6) + '" text-anchor="middle" font-size="22" font-weight="700" fill="#1e293b">' + total + '</text>';
  svg += '<text x="' + cx + '" y="' + (cy + 16) + '" text-anchor="middle" font-size="12" fill="#64748b">位专家</text>';
  
  // Legend
  const legendX = w * 0.62;
  data.forEach((val, i) => {
    const ly = 16 + i * 32;
    const pct = total > 0 ? (val/total*100).toFixed(1) : 0;
    svg += '<rect x="' + legendX + '" y="' + ly + '" width="14" height="14" rx="3" fill="' + colors[i] + '"/>';
    svg += '<text x="' + (legendX + 20) + '" y="' + (ly + 12) + '" font-size="12" fill="#475569">' + labels[i] + '</text>';
    svg += '<text x="' + (legendX + 145) + '" y="' + (ly + 12) + '" font-size="12" font-weight="600" fill="#1e293b" text-anchor="end">' + val + '人 (' + pct + '%)</text>';
  });
  
  svg += '</svg>';
  container.innerHTML = svg;
}

// ===== ADMIN LOGIN (v4.0 — Supabase Auth) =====
function showAdminLogin() {
  appState.mode = 'admin';
  const app = document.getElementById('app');
  app.innerHTML = '';

  // Clean up page navigation
  const existingPageNav = document.getElementById('page-navigation');
  if (existingPageNav) existingPageNav.remove();
  const existingFloatNavA = document.getElementById('page-navigation-float');
  if (existingFloatNavA) existingFloatNavA.remove();
  if (_floatingNavScrollHandler) {
    window.removeEventListener('scroll', _floatingNavScrollHandler);
    _floatingNavScrollHandler = null;
  }
  
  const vertSel = document.getElementById('vertical-field-selector');
  if (vertSel) vertSel.classList.remove('visible');

  const loginBox = h('div', { className: 'admin-login' });
  loginBox.appendChild(h('h2', {}, '管理员登录'));

  // 说明文字（用元素避免 br 被当作文本）
  const hintP = h('p', { style: { fontSize: '13px', color: '#64748B', marginBottom: '16px', lineHeight: '1.6' } });
  hintP.appendChild(document.createTextNode('主管理员：账号留空，输入主密码即可登录。'));
  hintP.appendChild(h('br'));
  hintP.appendChild(document.createTextNode('子管理员：输入主管理员分发的账号和密码。'));
  loginBox.appendChild(hintP);
  
  // Account input
  loginBox.appendChild(h('input', { type: 'text', placeholder: '账号（主管理员留空）', id: 'login-account' }));
  
  const pwdInput = h('input', { type: 'password', placeholder: '请输入密码', id: 'admin-pwd' });
  loginBox.appendChild(pwdInput);
  
  const errorDiv = h('div', { className: 'error', id: 'login-error', style: { display: 'none' } });
  loginBox.appendChild(errorDiv);
  
  loginBox.appendChild(h('button', {
    className: 'btn btn-primary',
    style: { width: '100%' },
    onclick: () => {
      const account = document.getElementById('login-account').value.trim();
      const pwd = document.getElementById('admin-pwd').value;
      const db = appState.db;
      const inTest = isTestMode();
      
      if (!account) {
        // Master admin login
        if (pwd === db.permissions.adminPassword) {
          appState.currentUser = { role: 'master' };
          isAdmin = true;
          appState.mode = 'admin';
          appState.adminTab = 'experts';
          if (inTest) { testModeRole = 'master'; renderAdmin(); }
          else refreshProjectsFromSupabase().then(function() { renderAdmin(); });
        } else {
          showLoginError('密码错误，请重试');
        }
      } else {
        // Sub-admin login
        const user = db.permissions.users.find(u => u.account === account);
        if (!user) {
          showLoginError('账号不存在');
        } else if (user.password !== pwd) {
          showLoginError('密码错误');
        } else {
          appState.currentUser = {
            role: 'sub',
            account: user.account,
            permissions: user.permissions || getDefaultSubPermissions()
          };
          isAdmin = true;
          appState.mode = 'admin';
          appState.adminTab = 'experts';
          if (inTest) { testModeRole = 'sub'; renderAdmin(); }
          else refreshProjectsFromSupabase().then(function() { renderAdmin(); });
        }
      }
    }
  }, '登录'));
  
  function showLoginError(msg) {
    const err = document.getElementById('login-error');
    err.style.display = 'block';
    err.textContent = msg;
  }
  
  // v4.1: 测试模式入口
  loginBox.appendChild(h('button', {
    className: 'btn',
    style: { width: '100%', marginTop: '8px', background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' },
    onclick: function() {
      if (confirm('进入测试模式？\n\n测试模式使用独立的数据空间，不会影响真实生产数据。\n\n支持切换三种角色视角：\n• 主管理员\n• 子管理员（testsub / test123）\n• 普通用户')) {
        enterTestMode();
      }
    }
  }, '🧪 进入测试模式'));
  
  loginBox.appendChild(h('button', {
    className: 'btn btn-secondary',
    style: { width: '100%', marginTop: '8px' },
    onclick: () => {
      appState.mode = 'frontend';
      renderFrontend();
    }
  }, '返回前端'));
  
  app.appendChild(loginBox);
  
  setTimeout(() => {
    document.getElementById('admin-pwd').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loginBox.querySelector('.btn-primary').click();
    });
  }, 100);
}

// ===== USER LOGIN/REGISTER MODAL (v4.1) =====
function showUserLoginModal() {
  if (isTestMode()) {
    toast('🧪 测试模式下无需登录，可使用角色切换器体验不同视角', 'info');
    return;
  }
  var overlay = h('div', {
    id: 'user-login-overlay',
    style: {
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.4)', zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    // 移除遮罩点击关闭：仅✕和取消按钮可关闭，防止用户误触重新输入
  });

  var modal = h('div', { style: {
    background: '#fff', borderRadius: '12px', padding: '28px 24px',
    width: '380px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
    position: 'relative'
  }});

  // P0: 关闭按钮（右上角）
  modal.appendChild(h('button', {
    style: {
      position: 'absolute', top: '12px', right: '14px',
      background: 'none', border: 'none', cursor: 'pointer',
      fontSize: '18px', color: '#94A3B8', lineHeight: 1, padding: '4px'
    },
    title: '关闭',
    onclick: function() { overlay.remove(); }
  }, '✕'));
  
  modal.appendChild(h('h3', { style: { margin: '0 0 6px 0', fontSize: '18px', color: '#1E293B' } }, '登录 / 注册'));
  modal.appendChild(h('p', { style: { fontSize: '13px', color: '#64748B', margin: '0 0 20px 0', lineHeight: '1.5' } },
    '登录后收藏数据可跨设备同步。首次使用时将自动注册。'
  ));

  var emailInput = h('input', { type: 'email', placeholder: '请输入邮箱', id: 'user-email', style: {
    width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px',
    fontSize: '14px', boxSizing: 'border-box', marginBottom: '12px'
  }});
  modal.appendChild(emailInput);

  var pwdInput = h('input', { type: 'password', placeholder: '请输入密码（至少6位）', id: 'user-pwd', style: {
    width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px',
    fontSize: '14px', boxSizing: 'border-box', marginBottom: '8px'
  }});
  modal.appendChild(pwdInput);

  var msgDiv = h('div', { id: 'user-login-msg', style: { fontSize: '13px', minHeight: '20px', marginBottom: '8px' } });
  modal.appendChild(msgDiv);

  var btnRow = h('div', { style: { display: 'flex', gap: '8px', marginTop: '4px' } });

  btnRow.appendChild(h('button', {
    style: { flex: 1, padding: '10px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
    onclick: async function() {
      var email = document.getElementById('user-email').value.trim();
      var pwd = document.getElementById('user-pwd').value;
      if (!email) { msgDiv.textContent = '请输入邮箱'; msgDiv.style.color = '#DC2626'; return; }
      if (pwd.length < 6) { msgDiv.textContent = '密码至少6位'; msgDiv.style.color = '#DC2626'; return; }
      msgDiv.textContent = '正在登录...'; msgDiv.style.color = '#2563EB';
      try {
        await signInWithPassword(email, pwd);
        msgDiv.textContent = '✅ 登录成功！'; msgDiv.style.color = '#059669';
        setTimeout(function() {
          overlay.remove();
          syncFavoritesAfterLogin();
          renderFrontend();
        }, 800);
      } catch(e) {
        var eMsg = e.message || '';
        // 账号不存在 → 自动注册
        if (eMsg.includes('Invalid login') || eMsg.includes('invalid_credentials') || eMsg.includes('not found') || eMsg.includes('密码错误')) {
          msgDiv.textContent = '账号不存在，正在自动注册...'; msgDiv.style.color = '#2563EB';
          try {
            var result = await signUpWithPassword(email, pwd);
            if (result.user && result.session) {
              currentUser = result.user;
              msgDiv.textContent = '✅ 注册成功！已自动登录'; msgDiv.style.color = '#059669';
              setTimeout(function() {
                overlay.remove();
                syncFavoritesAfterLogin();
                renderFrontend();
              }, 800);
            } else if (result.user) {
              msgDiv.textContent = '⚠️ 注册成功，请检查收件箱验证邮箱后再登录'; msgDiv.style.color = '#D97706';
            }
          } catch(e2) {
            msgDiv.textContent = (e2.message || '注册失败，请重试');
            msgDiv.style.color = '#DC2626';
          }
        } else {
          msgDiv.textContent = eMsg || '登录失败，请重试';
          msgDiv.style.color = '#DC2626';
        }
      }
    }
  }, '登录 / 注册'));

  btnRow.appendChild(h('button', {
    style: { flex: 1, padding: '10px', background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
    onclick: function() { overlay.remove(); }
  }, '取消'));

  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  setTimeout(function() { document.getElementById('user-email').focus(); }, 100);
}

// v4.4: 登录后收藏双向同步 — Supabase ↔ localStorage 合并
async function syncFavoritesAfterLogin() {
  if (!currentUser || isTestMode()) return;
  try {
    // 1. 读取本地收藏
    var raw = localStorage.getItem(STORAGE_KEY);
    var localFavs = raw ? (JSON.parse(raw).favorites || []) : [];
    
    // 2. 读取 Supabase 收藏
    var remoteFavs = await fetchFavorites();
    
    // 3. 双向合并：取并集
    var remoteSet = new Set(remoteFavs);
    var localSet = new Set(localFavs);
    var merged = remoteFavs.slice();
    
    // 4. 本地独有 → 推送到 Supabase
    for (var i = 0; i < localFavs.length; i++) {
      if (!remoteSet.has(localFavs[i])) {
        merged.push(localFavs[i]);
        await addFavorite(localFavs[i]);
      }
    }
    
    // 5. Supabase 独有 → 写入 appState + localStorage
    for (var j = 0; j < remoteFavs.length; j++) {
      if (!localSet.has(remoteFavs[j])) {
        // 已在 merged 中，确保写入 localStorage
      }
    }
    
    // 6. 应用合并结果
    appState.db.favorites = merged;
    if (appState.db && raw) {
      var fullDb = JSON.parse(raw);
      fullDb.favorites = merged;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fullDb));
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.db));
    }
    
    console.log('[syncFav] 双向同步完成: local=' + localFavs.length + ' supabase=' + remoteFavs.length + ' → merged=' + merged.length);
  } catch(e) { console.warn('Favorites sync on login failed:', e.message); }
}

function getDefaultSubPermissions() {
  return {
    expertView: true, expertAdd: true, expertEdit: true, expertDelete: false,
    expertImport: true, expertExport: true, expertScore: true,
    categoryManage: true,
    ratingManage: false, dashboardManage: true, observationManage: true,
    projectsManage: true, docsManage: false,
    sortManage: false, permissionManage: false, systemSettings: false
  };
}

function renderAdmin() {
  if (isTestMode()) renderTestBanner();
  const app = document.getElementById('app');
  app.innerHTML = '';
  
  // Clean up page navigation and its scroll handler
  const existingPageNav = document.getElementById('page-navigation');
  if (existingPageNav) existingPageNav.remove();
  const existingFloatNav = document.getElementById('page-navigation-float');
  if (existingFloatNav) existingFloatNav.remove();
  if (_floatingNavScrollHandler) {
    window.removeEventListener('scroll', _floatingNavScrollHandler);
    _floatingNavScrollHandler = null;
  }

  const db = appState.db;
  const isMaster = isMasterAdmin();
  
  // Header
  const header = h('header', { className: 'header' });
  const headerInner = h('div', { className: 'header-inner' });
  
  const headerLeft = h('div', { className: 'header-left' });
  const adminTitle = (db.uiConfig ? db.uiConfig.mainTitle : '伊利集团·数智化赋能优质专家资源库') + ' - 管理后台';
  headerLeft.appendChild(h('div', { className: 'header-title', style: { fontSize: '20px' } }, adminTitle));
  headerInner.appendChild(headerLeft);
  
  const headerActions = h('div', { className: 'header-actions' });
  // Current user badge
  const roleLabel = isMaster ? '主管理员' : ('子管理员：' + (appState.currentUser.account || ''));
  headerActions.appendChild(h('div', { style: { fontSize:'11px', color:'rgba(255,255,255,0.7)', padding:'2px 10px', background:'rgba(255,255,255,0.1)', borderRadius:'10px' } }, roleLabel));
  headerActions.appendChild(h('div', { className: 'header-update' }, '数据更新：' + formatDate(db.updateTime)));
  
  headerActions.appendChild(h('button', {
    className: 'btn btn-sm',
    style: { background:'rgba(255,255,255,0.15)', color:'white', fontSize:'12px', border:'1px solid rgba(255,255,255,0.2)' },
    onclick: () => {
      appState.mode = 'frontend';
      renderFrontend();
    }
  }, '← 返回前端'));
  
  headerActions.appendChild(h('button', {
    className: 'btn btn-sm',
    style: { background:'rgba(255,255,255,0.15)', color:'white', fontSize:'12px', border:'1px solid rgba(255,255,255,0.2)' },
    onclick: () => {
      appState.currentUser = null;
      appState.mode = 'frontend';
      renderFrontend();
    }
  }, '退出登录'));
  headerInner.appendChild(headerActions);
  
  header.appendChild(headerInner);
  app.appendChild(header);
  
  // Container
  const container = h('div', { className: 'admin-container' });
  
  // Navigation - filtered by permissions
  const nav = h('div', { className: 'admin-nav' });
  const allTabs = [
    { id: 'experts', name: '专家管理', perm: 'expertView' },
    { id: 'projects', name: '合作项目管理', perm: 'projectsManage' },
    { id: 'ratings', name: '评分管理', perm: 'ratingManage' },
    { id: 'sort', name: '排序标签', perm: 'sortManage' },
    { id: 'dashboard', name: '仪表盘', perm: 'dashboardManage' },
    { id: 'categories', name: '分类管理', perm: 'categoryManage' },
    { id: 'observation', name: '观察库', perm: 'observationManage' },
    { id: 'permissions', name: '权限管理', perm: 'permissionManage' },
    { id: 'settings', name: '系统设置', perm: 'systemSettings' },
    { id: 'docs', name: '📋系统文档', perm: 'docsManage' }
  ];
  
  const visibleTabs = isMaster ? allTabs : allTabs.filter(t => hasPermission(t.perm) && t.id !== 'categories' && t.id !== 'docs');
  
  visibleTabs.forEach(tab => {
    nav.appendChild(h('button', {
      className: 'admin-nav-item' + (appState.adminTab === tab.id ? ' active' : ''),
      onclick: () => {
        appState.adminTab = tab.id;
        renderAdmin();
      }
    }, tab.name));
  });
  container.appendChild(nav);
  
  // Panel
  const panel = h('div', { className: 'admin-panel', id: 'admin-panel' });
  container.appendChild(panel);
  app.appendChild(container);
  
  // Render active tab
  switch (appState.adminTab) {
    case 'experts': renderExpertsTab(panel); break;
    case 'projects': renderProjectsTab(panel); break;
    case 'ratings': renderRatingsTab(panel); break;
    case 'sort': renderSortTab(panel); break;
    case 'dashboard': renderDashboardTab(panel); break;
    case 'categories': renderCategoriesTab(panel); break;
    case 'observation': renderObservationTab(panel); break;
    case 'permissions': renderPermissionsTab(panel); break;
    case 'settings': renderSettingsTab(panel); break;
    case 'docs': renderDocsTab(panel); break;
  }
}

function renderExpertsTab(panel) {
  const db = appState.db;
  panel.innerHTML = '';
  panel.appendChild(h('h3', {}, '专家管理'));
  
  // Toolbar
  const toolbar = h('div', { className: 'admin-toolbar' });
  
  const searchInput = h('input', {
    className: 'admin-search',
    placeholder: '搜索专家姓名...',
    value: appState.searchQuery,
    oninput: (e) => {
      appState.searchQuery = e.target.value;
      renderExpertsTab(document.getElementById('admin-panel'));
    }
  });
  toolbar.appendChild(searchInput);
  
  toolbar.appendChild(h('button', {
    className: 'btn btn-primary btn-sm',
    onclick: () => showExpertForm(null)
  }, '+ 新增专家'));
  
  toolbar.appendChild(h('button', {
    className: 'btn btn-secondary btn-sm',
    onclick: () => showExportOptions()
  }, '📥 导出'));
  
  toolbar.appendChild(h('button', {
    className: 'btn btn-secondary btn-sm',
    onclick: () => showImportDialog()
  }, '📤 导入'));
  
  panel.appendChild(toolbar);
  
  // Filter row
  if (!appState._adminFilters) appState._adminFilters = { field: '', scoreMin: '', status: '' };
  const af = appState._adminFilters;
  
  const filterRow = h('div', { className: 'admin-filter-row' });
  
  // Field filter
  const fieldSel = h('select', {
    className: 'filter-select',
    onchange: (e) => {
      af.field = e.target.value;
      renderExpertsTab(document.getElementById('admin-panel'));
    }
  });
  fieldSel.appendChild(h('option', { value: '' }, '全部领域'));
  db.fields.forEach(f => {
    const o = h('option', { value: f.name }, f.name);
    if (af.field === f.name) o.selected = true;
    fieldSel.appendChild(o);
  });
  filterRow.appendChild(h('span', { style:{ fontSize:'12px', color:'var(--text-secondary)' } }, '领域：'));
  filterRow.appendChild(fieldSel);
  
  // Score filter
  const scoreSel = h('select', {
    className: 'filter-select',
    onchange: (e) => {
      af.scoreMin = e.target.value;
      renderExpertsTab(document.getElementById('admin-panel'));
    }
  });
  scoreSel.appendChild(h('option', { value: '' }, '全部评分'));
  ['9','8','7','6'].forEach(v => {
    const o = h('option', { value: v }, v + '分及以上');
    if (af.scoreMin === v) o.selected = true;
    scoreSel.appendChild(o);
  });
  filterRow.appendChild(h('span', { style:{ fontSize:'12px', color:'var(--text-secondary)' } }, '评分：'));
  filterRow.appendChild(scoreSel);
  
  // Status filter
  const statusSel = h('select', {
    className: 'filter-select',
    onchange: (e) => {
      af.status = e.target.value;
      renderExpertsTab(document.getElementById('admin-panel'));
    }
  });
  statusSel.appendChild(h('option', { value: '' }, '全部状态'));
  statusSel.appendChild(h('option', { value: 'active' }, '正常'));
  statusSel.appendChild(h('option', { value: 'observation' }, '观察中'));
  statusSel.appendChild(h('option', { value: 'eliminated' }, '已淘汰'));
  if (af.status === 'active') statusSel.children[1].selected = true;
  else if (af.status === 'observation') statusSel.children[2].selected = true;
  else if (af.status === 'eliminated') statusSel.children[3].selected = true;
  filterRow.appendChild(h('span', { style:{ fontSize:'12px', color:'var(--text-secondary)' } }, '状态：'));
  filterRow.appendChild(statusSel);
  
  // Clear filters
  filterRow.appendChild(h('button', {
    className: 'btn btn-sm',
    style: { background:'var(--bg)', border:'1px solid var(--border)', fontSize:'11px', color:'var(--text-secondary)' },
    onclick: () => {
      appState._adminFilters = { field: '', scoreMin: '', status: '' };
      renderExpertsTab(document.getElementById('admin-panel'));
    }
  }, '清除筛选'));
  
  panel.appendChild(filterRow);
  
  // Filter data
  let experts = db.experts;
  if (appState.searchQuery) {
    const q = appState.searchQuery.toLowerCase();
    experts = experts.filter(e => e.name.toLowerCase().includes(q));
  }
  if (af.field) {
    experts = experts.filter(e => e.fields.includes(af.field));
  }
  if (af.scoreMin) {
    experts = experts.filter(e => e.scores.overall >= parseInt(af.scoreMin));
  }
  if (af.status) {
    experts = experts.filter(e => e.status === af.status || (af.status === 'observation' && (e.status === 'observation' || e.observationStatus)));
  }
  
  // Table
  const tableWrapper = h('div', { className: 'table-scroll-wrapper' });
  const table = h('table', { className: 'data-table' });
  
  const thead = h('thead');
  const headers = ['姓名', '适用领域', '学历', '核心优势', '专业度', '影响力', '综合评分', '联系人', '联系方式', '状态', '录入时间', '录入者', '操作'];
  const headerRow = h('tr');
  headers.forEach(hdr => headerRow.appendChild(h('th', { style:{ whiteSpace:'nowrap' } }, hdr)));
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  const tbody = h('tbody');
  experts.forEach(e => {
    const row = h('tr');
    row.appendChild(h('td', { style:{ fontWeight:'600' } }, e.name));
    row.appendChild(h('td', { title: e.fields.join(', ') }, e.fields.join(', ')));
    const eduText = (e.education || '-');
    row.appendChild(h('td', { title: eduText, style:{ maxWidth:'120px' } }, eduText));
    const advText = (e.advantages || []).slice(0, 2).map(a => (a.title || '') + (a.title ? '：' : '') + a.desc).join('；') || '-';
    row.appendChild(h('td', { title: advText, style:{ maxWidth:'150px' } }, advText));
    row.appendChild(h('td', {}, String(e.scores.professional)));
    row.appendChild(h('td', {}, String(e.scores.influence)));
    row.appendChild(h('td', { style: { fontWeight:'bold', color: e.scores.overall >= 8 ? '#059669' : e.scores.overall >= 7 ? '#d97706' : '#dc2626' } }, e.scores.overall.toFixed(1)));
    const adminContacts = getContactsList(e);
    const firstContact = adminContacts.length > 0 ? adminContacts[0] : { person: '-', info: '-' };
    row.appendChild(h('td', {}, firstContact.person || '-'));
    const contactDisplay = firstContact.info ? (firstContact.info.length > 15 ? firstContact.info.substring(0,15)+'...' : firstContact.info) : '-';
    const contactTitle = adminContacts.map(c => (c.person ? c.person + ': ' : '') + c.info).join(' | ');
    row.appendChild(h('td', { title: contactTitle }, contactDisplay + (adminContacts.length > 1 ? ' +' + (adminContacts.length - 1) : '')));
    const statusLabel = e.status === 'eliminated' ? '已淘汰' : (e.status === 'observation' || e.observationStatus) ? '观察中' : '正常';
    row.appendChild(h('td', { style:{ color: e.status === 'eliminated' ? '#dc2626' : (e.status === 'observation' || e.observationStatus) ? '#d97706' : '#059669' } }, statusLabel));
    row.appendChild(h('td', { style:{ fontSize:'11px', whiteSpace:'nowrap' } }, e.createdAt ? formatDate(e.createdAt).substring(0, 10) : '-'));
    row.appendChild(h('td', { style:{ fontSize:'11px' } }, e.createdBy || '主管理员'));
    
    const actions = h('td', { className: 'actions' });
    actions.appendChild(h('button', { className: 'btn btn-secondary btn-sm', onclick: () => showExpertForm(e) }, '编辑'));
    actions.appendChild(h('button', { className: 'btn btn-danger btn-sm', onclick: () => deleteExpert(e.id) }, '删除'));
    row.appendChild(actions);
    
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  tableWrapper.appendChild(table);
  panel.appendChild(tableWrapper);
  panel.appendChild(h('div', { style: { marginTop:'12px', fontSize:'12px', color:'var(--text-muted)' } }, '共 ' + experts.length + ' 条记录'));
}

// ===== 合作项目管理 =====

function getProjectsForExpert(expertId) {
  const db = appState ? appState.db : getDB();
  if (!db.yiliProjects || !Array.isArray(db.yiliProjects)) return [];
  return db.yiliProjects.filter(p => p.expertId === expertId);
}

function getProjectExpertName(expertId) {
  const db = appState ? appState.db : getDB();
  if (!expertId) return null;
  const expert = db.experts.find(e => e.id === expertId);
  return expert ? expert.name : null;
}

function formatSatisfactionDisplay(sat) {
  if (!sat || !sat.value) return '';
  const v = sat.scale === 5 ? sat.value * 2 : sat.value;
  const rounded = Math.round(v * 100) / 100;
  // Format: keep up to 2 decimals, strip trailing zeros
  const str = rounded.toFixed(2);
  return parseFloat(str).toString();
}

function formatSatisfactionStars(sat) {
  if (!sat || !sat.value) return '';
  const v = sat.scale === 5 ? sat.value * 2 : sat.value;
  const rounded = Math.round(v);
  const maxStars = 10;
  let stars = '';
  for (let i = 0; i < maxStars; i++) {
    stars += i < rounded ? '★' : '☆';
  }
  return stars;
}

function renderProjectsTab(panel) {
  const db = appState.db;
  panel.innerHTML = '';
  panel.appendChild(h('h3', {}, '合作项目管理'));

  // Init state
  if (!appState._projectFilters) appState._projectFilters = { year: '', quarter: '', visibility: '', search: '' };
  const pf = appState._projectFilters;

  // Ensure projects array exists
  if (!db.yiliProjects || !Array.isArray(db.yiliProjects)) db.yiliProjects = [];

  // Toolbar
  const toolbar = h('div', { className: 'admin-toolbar' });

  const searchInput = h('input', {
    className: 'admin-search',
    placeholder: '搜索项目名称...',
    value: pf.search,
    oninput: (e) => {
      pf.search = e.target.value;
      renderProjectsTab(document.getElementById('admin-panel'));
    }
  });
  toolbar.appendChild(searchInput);

  // Year filter
  const yearSel = h('select', {
    className: 'filter-select',
    onchange: (e) => { pf.year = e.target.value; renderProjectsTab(document.getElementById('admin-panel')); }
  });
  yearSel.appendChild(h('option', { value: '' }, '全部年度'));
  const years = [...new Set(db.yiliProjects.map(p => p.year).filter(Boolean))].sort((a,b) => b-a);
  years.forEach(y => {
    const opt = h('option', { value: String(y) }, String(y));
    if (pf.year === String(y)) opt.selected = true;
    yearSel.appendChild(opt);
  });
  toolbar.appendChild(yearSel);

  // Quarter filter (available quarters from filtered year)
  const quarterSel = h('select', {
    className: 'filter-select',
    onchange: (e) => { pf.quarter = e.target.value; renderProjectsTab(document.getElementById('admin-panel')); }
  });
  quarterSel.appendChild(h('option', { value: '' }, '全部季度'));
  ['Q1','Q2','Q3','Q4'].forEach(q => {
    const opt = h('option', { value: q }, q);
    if (pf.quarter === q) opt.selected = true;
    quarterSel.appendChild(opt);
  });
  toolbar.appendChild(quarterSel);

  // Visibility filter
  const visSel = h('select', {
    className: 'filter-select',
    onchange: (e) => { pf.visibility = e.target.value; renderProjectsTab(document.getElementById('admin-panel')); }
  });
  visSel.appendChild(h('option', { value: '' }, '全部显示状态'));
  ['显示','不显示','待关联'].forEach(v => {
    const opt = h('option', { value: v }, v);
    if (pf.visibility === v) opt.selected = true;
    visSel.appendChild(opt);
  });
  toolbar.appendChild(visSel);

  toolbar.appendChild(h('button', {
    className: 'btn btn-primary btn-sm',
    onclick: () => showProjectForm(null)
  }, '+ 新建项目'));

  panel.appendChild(toolbar);

  // Filter projects
  let filtered = [...db.yiliProjects];
  if (pf.year) filtered = filtered.filter(p => String(p.year) === pf.year);
  if (pf.quarter) filtered = filtered.filter(p => {
    if (!p.month) return false;
    const q = 'Q' + Math.ceil(p.month / 3);
    return q === pf.quarter;
  });
  if (pf.visibility === '显示') filtered = filtered.filter(p => p.visible && p.expertId);
  else if (pf.visibility === '不显示') filtered = filtered.filter(p => !p.visible);
  else if (pf.visibility === '待关联') filtered = filtered.filter(p => !p.expertId);
  if (pf.search) {
    const q = pf.search.toLowerCase();
    filtered = filtered.filter(p => (p.title || '').toLowerCase().includes(q));
  }
  // Sort by year desc, then by id
  filtered.sort((a,b) => b.year - a.year || a.id.localeCompare(b.id));

  // Table
  const tableWrapper = h('div', { style: { overflowX:'auto', marginTop:'12px' } });
  const table = h('table', { className: 'admin-table' });
  const thead = h('thead');
  const headerRow = h('tr');
  ['项目名称', '关联讲师', '年份', '月份', '满意度', '显示', '操作'].forEach(hdr => {
    headerRow.appendChild(h('th', {}, hdr));
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = h('tbody');

  filtered.forEach(proj => {
    const row = h('tr', {
      style: !proj.expertId ? 'background:#fef9c3' : '' // pending highlight
    });

    // Title
    const titleTd = h('td', { style: 'max-width:200px;word-break:break-all' });
    titleTd.appendChild(h('strong', {}, proj.title || '-'));
    if (!proj.expertId && proj.pendingExpertName) {
      titleTd.appendChild(h('span', {
        style: 'display:inline-block;margin-left:6px;padding:1px 6px;background:#f59e0b;color:white;border-radius:3px;font-size:10px'
      }, '待关联: ' + proj.pendingExpertName));
    }
    row.appendChild(titleTd);

    // Expert
    const nameTd = h('td', {});
    const expName = proj.expertId ? getProjectExpertName(proj.expertId) : null;
    if (expName) {
      nameTd.appendChild(h('span', {}, expName));
    } else if (!proj.expertId && proj.pendingExpertName) {
      nameTd.appendChild(h('span', { style: 'color:var(--text-muted);font-style:italic' }, '待关联'));
    } else {
      nameTd.appendChild(h('span', { style: 'color:var(--text-muted)' }, '-'));
    }
    row.appendChild(nameTd);

    // Year
    row.appendChild(h('td', {}, String(proj.year || '-')));

    // Month
    const monthStr = proj.month ? proj.month + '月' : '-';
    row.appendChild(h('td', {}, monthStr));

    // Satisfaction
    const satStr = proj.satisfaction && proj.satisfaction.value
      ? formatSatisfactionDisplay(proj.satisfaction) + '/10'
      : '-';
    row.appendChild(h('td', {}, satStr));

    // Visible toggle
    const visTd = h('td', {});
    if (proj.expertId) {
      visTd.appendChild(h('span', {
        style: 'display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;cursor:pointer;' +
               (proj.visible ? 'background:#dcfce7;color:#166534' : 'background:#fef2f2;color:#991b1b'),
        title: '点击切换显示状态',
        onclick: () => {
          proj.visible = !proj.visible;
          saveDB(db);
          renderProjectsTab(document.getElementById('admin-panel'));
        }
      }, proj.visible ? '显示' : '隐藏'));
    } else {
      visTd.appendChild(h('span', { style: 'color:var(--text-muted);font-size:11px' }, '-'));
    }
    row.appendChild(visTd);

    // Actions
    const actTd = h('td', {});
    actTd.appendChild(h('button', {
      className: 'btn btn-secondary btn-sm',
      style: 'margin-right:4px',
      onclick: () => showProjectForm(proj)
    }, '编辑'));

    // Delete — only if creator matches or is master
    const isMaster = isMasterAdmin();
    actTd.appendChild(h('button', {
      className: 'btn btn-sm',
      style: 'background:#fef2f2;color:#ef4444;border:1px solid #fecaca',
      onclick: () => {
        if (!confirm('确定删除项目「' + proj.title + '」？')) return;
        db.yiliProjects = db.yiliProjects.filter(p => p.id !== proj.id);
        saveDB(db);
        renderProjectsTab(document.getElementById('admin-panel'));
        toast('项目已删除', 'success');
      }
    }, '删除'));
    row.appendChild(actTd);

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  tableWrapper.appendChild(table);
  panel.appendChild(tableWrapper);

  // Stats bar
  const total = db.yiliProjects.length;
  const visibleCount = db.yiliProjects.filter(p => p.visible && p.expertId).length;
  const hiddenCount = db.yiliProjects.filter(p => !p.visible && p.expertId).length;
  const pendingCount = db.yiliProjects.filter(p => !p.expertId).length;
  const statsBar = h('div', {
    style: 'margin-top:12px;padding:8px 12px;background:var(--bg);border-radius:8px;border:1px solid var(--border);font-size:12px;color:var(--text-secondary);display:flex;gap:16px;flex-wrap:wrap'
  });
  statsBar.appendChild(h('span', {}, '总计 ' + total + ' 项目'));
  statsBar.appendChild(h('span', { style: 'color:#166534' }, '显示中 ' + visibleCount));
  if (hiddenCount > 0) statsBar.appendChild(h('span', { style: 'color:#991b1b' }, '已隐藏 ' + hiddenCount));
  if (pendingCount > 0) statsBar.appendChild(h('span', { style: 'color:#b45309' }, '待关联 ' + pendingCount));
  panel.appendChild(statsBar);
}

// 项目表单弹窗 — 新建/编辑
function showProjectForm(project) {
  const db = appState.db;
  // If opened from expert edit page with pre-filled expert
  const prefill = window.__prefillProjectExpert;
  if (prefill && !project) {
    project = { expertId: prefill.id, title: '', year: new Date().getFullYear(), month: null, satisfaction: null, desc: '', visible: prefill.isTemp ? false : true };
    // v3.5: 临时关联（新增专家），标记以便后续更新
    if (prefill.isTemp) {
      window.__prefillProjectName = prefill.name;
    }
    window.__prefillProjectExpert = null;
  }
  const isEdit = !!project && !!project.id;

  const overlay = h('div', { className: 'modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const content = h('div', { className: 'modal-content', style: 'max-width:520px' });

  const header = h('div', { className: 'modal-header' });
  header.appendChild(h('div', { className: 'modal-title' }, isEdit ? '编辑合作项目' : '新建合作项目'));
  header.appendChild(h('button', { className: 'modal-close', onclick: () => overlay.remove() }, '✕'));
  content.appendChild(header);

  const body = h('div', { className: 'modal-body' });

  // Expert search
  const expGroup = h('div', { className: 'form-group' });
  expGroup.appendChild(h('label', {}, '关联讲师 *'));
  const expSearchWrap = h('div', { style: 'position:relative' });
  const expInput = h('input', {
    type: 'text',
    placeholder: '输入姓名搜索已录入讲师...',
    value: project && project.expertId ? (getProjectExpertName(project.expertId) || window.__prefillProjectName || '') : '',
    style: 'width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px',
    oninput: function() { /* handled below */ }
  });
  // v3.5: Clear temp prefill name after use
  delete window.__prefillProjectName;
  // Track selected expert
  let selectedExpertId = project ? project.expertId : null;
  let pendingNameValue = project ? project.pendingExpertName || '' : '';

  // Dropdown for search results
  const dropdown = h('div', {
    style: 'display:none;position:absolute;top:100%;left:0;right:0;max-height:180px;overflow-y:auto;background:white;border:1px solid var(--border);border-top:none;border-radius:0 0 6px 6px;z-index:10;box-shadow:0 4px 12px rgba(0,0,0,0.1)'
  });

  function rebuildDropdown(query) {
    dropdown.innerHTML = '';
    if (!query) { dropdown.style.display = 'none'; return; }
    const q = query.toLowerCase();
    const matches = db.experts.filter(e => e.name.toLowerCase().includes(q)).slice(0, 8);
    if (matches.length === 0) {
      dropdown.style.display = 'block';
      const noResult = h('div', {
        style: 'padding:8px 12px;font-size:12px;color:var(--text-muted)'
      }, '未找到匹配讲师，点击此处处理');
      noResult.style.cursor = 'pointer';
      noResult.onclick = () => {
        dropdown.style.display = 'none';
        handleNoExpertFound(query);
      };
      dropdown.appendChild(noResult);
    } else {
      dropdown.style.display = 'block';
      matches.forEach(e => {
        const item = h('div', {
          style: 'padding:8px 12px;font-size:13px;cursor:pointer;border-bottom:1px solid #f0f0f0',
          onmouseenter: function() { this.style.background = '#f0f7ff'; },
          onmouseleave: function() { this.style.background = 'transparent'; },
          onclick: () => {
            selectedExpertId = e.id;
            expInput.value = e.name;
            dropdown.style.display = 'none';
            pendingNameInput.style.display = 'none';
          }
        }, e.name);
        dropdown.appendChild(item);
      });
    }
  }

  expInput.oninput = function() {
    selectedExpertId = null;
    rebuildDropdown(this.value);
  };
  expInput.onfocus = function() { rebuildDropdown(this.value); };
  expInput.onblur = function() { setTimeout(() => { dropdown.style.display = 'none'; }, 200); };

  expSearchWrap.appendChild(expInput);
  expSearchWrap.appendChild(dropdown);
  expGroup.appendChild(expSearchWrap);

  // Pending expert name input (hidden by default)
  const pendingNameInput = h('input', {
    type: 'text',
    placeholder: '待关联讲师姓名（暂不录入库中）',
    value: pendingNameValue,
    style: 'display:none;margin-top:6px;width:100%;padding:8px 10px;border:1px solid #f59e0b;border-radius:6px;font-size:13px;background:#fffbeb',
    oninput: function() { pendingNameValue = this.value; }
  });
  expGroup.appendChild(pendingNameInput);
  body.appendChild(expGroup);

  // Handle no expert found
  function handleNoExpertFound(name) {
    // Show a mini dialog
    const chooseOverlay = h('div', {
      style: 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:2000;display:flex;align-items:center;justify-content:center',
      onclick: function(e) { if (e.target === chooseOverlay) chooseOverlay.remove(); }
    });
    const chooseBox = h('div', {
      style: 'background:white;border-radius:12px;padding:24px;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,0.2)'
    });
    chooseBox.appendChild(h('div', { style: 'font-size:15px;font-weight:600;margin-bottom:8px' }, '⚠️ 讲师"' + name + '"尚未录入资源库'));
    chooseBox.appendChild(h('div', { style: 'fontSize:13px;color:var(--text-secondary);marginBottom:16px' }, '请确认此讲师是否存在于库中：'));

    const btnStyle = 'display:block;width:100%;padding:10px;margin-bottom:8px;border-radius:8px;font-size:13px;cursor:pointer;border:1px solid var(--border);background:white;text-align:left';
    chooseBox.appendChild(h('button', {
      style: btnStyle,
      onclick: () => {
        chooseOverlay.remove();
        expInput.value = '';
        expInput.focus();
      }
    }, '○ 在库中，我换个名字搜索'));

    chooseBox.appendChild(h('button', {
      style: btnStyle + ';background:#eff6ff;border-color:#93c5fd',
      onclick: () => {
        chooseOverlay.remove();
        expInput.value = name;
        selectedExpertId = null;
        pendingNameInput.value = name;
        pendingNameInput.style.display = 'block';
        pendingNameValue = name;
      }
    }, '○ 不在库中，现在录入'));

    chooseBox.appendChild(h('button', {
      style: btnStyle,
      onclick: () => {
        chooseOverlay.remove();
        expInput.value = '';
        selectedExpertId = null;
        pendingNameInput.value = name;
        pendingNameInput.style.display = 'block';
        pendingNameValue = name;
      }
    }, '○ 先不录入，仅记录项目（前端不显示）'));

    chooseBox.appendChild(h('button', {
      style: 'width:100%;padding:8px;margin-top:4px;border:none;background:#f3f4f6;border-radius:8px;font-size:12px;cursor:pointer;color:var(--text-muted)',
      onclick: () => chooseOverlay.remove()
    }, '取消'));
    chooseOverlay.appendChild(chooseBox);
    document.body.appendChild(chooseOverlay);
  }

  // Title
  const titleGroup = h('div', { className: 'form-group' });
  titleGroup.appendChild(h('label', {}, '项目名称 *'));
  titleGroup.appendChild(h('input', {
    type: 'text',
    id: 'proj-form-title',
    placeholder: '如：数字化转型专题培训',
    value: project ? project.title || '' : ''
  }));
  body.appendChild(titleGroup);

  // Year
  const yearGroup = h('div', { className: 'form-group' });
  yearGroup.appendChild(h('label', {}, '合作年份 *'));
  const yearSelect = h('select', { id: 'proj-form-year' });
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= 2020; y--) {
    const opt = h('option', { value: String(y) }, String(y));
    if (project && project.year === y) opt.selected = true;
    if (!project && y === currentYear) opt.selected = true;
    yearSelect.appendChild(opt);
  }
  yearGroup.appendChild(yearSelect);
  body.appendChild(yearGroup);

  // Month (optional)
  const monthGroup = h('div', { className: 'form-group' });
  monthGroup.appendChild(h('label', {}, '合作月份（可选，仅选到月度）'));
  const monthSelect = h('select', { id: 'proj-form-month' });
  monthSelect.appendChild(h('option', { value: '' }, '不指定'));
  for (let m = 1; m <= 12; m++) {
    const opt = h('option', { value: String(m) }, m + '月');
    if (project && project.month === m) opt.selected = true;
    monthSelect.appendChild(opt);
  }
  monthGroup.appendChild(monthSelect);
  body.appendChild(monthGroup);

  // Satisfaction
  const satGroup = h('div', { className: 'form-group' });
  satGroup.appendChild(h('label', {}, '项目满意度（可选）'));
  const satRow = h('div', { style: 'display:flex;gap:8px;align-items:center' });
  const satInput = h('input', {
    type: 'number',
    id: 'proj-form-sat-value',
    placeholder: '如 8.5',
    step: '0.1',
    min: '0',
    max: '10',
    value: project && project.satisfaction && project.satisfaction.value
      ? (project.satisfaction.scale === 5 ? project.satisfaction.value * 2 : project.satisfaction.value)
      : '',
    style: 'width:100px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px'
  });
  satRow.appendChild(satInput);
  const satScaleSel = h('select', {
    id: 'proj-form-sat-scale',
    style: 'width:90px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px'
  });
  ['10分制','5分制'].forEach(s => {
    const v = s === '5分制' ? '5' : '10';
    const opt = h('option', { value: v }, s);
    if (project && project.satisfaction && project.satisfaction.scale === parseInt(v)) opt.selected = true;
    if (!project && v === '10') opt.selected = true;
    satScaleSel.appendChild(opt);
  });
  satRow.appendChild(satScaleSel);
  satGroup.appendChild(satRow);
  satGroup.appendChild(h('div', { style: 'font-size:11px;color:var(--text-muted);margin-top:4px' }, '前端统一显示为10分制'));
  body.appendChild(satGroup);

  // Description
  const descGroup = h('div', { className: 'form-group' });
  descGroup.appendChild(h('label', {}, '项目描述（可选，建议不超过100字）'));
  descGroup.appendChild(h('textarea', {
    id: 'proj-form-desc',
    placeholder: '简述培训内容、规模等...',
    value: project ? project.desc || '' : '',
    style: 'min-height:60px',
    maxlength: 150,
    oninput: function() {
      counter.textContent = this.value.length + '/150';
    }
  }));
  const counter = h('div', {
    style: 'font-size:11px;color:var(--text-muted);text-align:right;margin-top:2px'
  });
  counter.textContent = (project && project.desc ? project.desc.length : 0) + '/150';
  descGroup.appendChild(counter);
  body.appendChild(descGroup);

  // Visible toggle
  const visGroup = h('div', { className: 'form-group' });
  visGroup.appendChild(h('label', {}, '前端显示'));
  const visSelect = h('select', { id: 'proj-form-visible' });
  [
    { value: 'true', text: '显示 — 在前端卡片和详情中展示' },
    { value: 'false', text: '不显示 — 仅管理后台可见' }
  ].forEach(o => {
    const opt = h('option', { value: o.value }, o.text);
    if (project && project.visible === (o.value === 'true')) opt.selected = true;
    if (!project && o.value === 'true') opt.selected = true;
    visSelect.appendChild(opt);
  });
  visGroup.appendChild(visSelect);
  visGroup.appendChild(h('div', {
    style: 'fontSize:11px;color:var(--text-muted);marginTop:4px'
  }, '待关联讲师的项目暂不显示'));
  body.appendChild(visGroup);

  // Save
  body.appendChild(h('button', {
    className: 'btn btn-primary',
    style: 'width:100%;margin-top:12px',
    onclick: () => {
      const titleVal = (document.getElementById('proj-form-title') || {}).value || '';
      const title = titleVal.trim();
      if (!title) { toast('请输入项目名称', 'error'); return; }

      if (!selectedExpertId && !pendingNameValue.trim()) {
        toast('请选择关联讲师', 'error'); return;
      }

      const year = parseInt(document.getElementById('proj-form-year').value) || currentYear;
      const monthVal = document.getElementById('proj-form-month').value;
      const month = monthVal ? parseInt(monthVal) : null;

      const satVal = parseFloat(document.getElementById('proj-form-sat-value').value);
      const satScale = parseInt(document.getElementById('proj-form-sat-scale').value);
      const satisfaction = (!isNaN(satVal) && satVal > 0)
        ? { value: satScale === 5 ? satVal / 2 : satVal, scale: satScale }
        : null;

      const desc = (document.getElementById('proj-form-desc') || {}).value || '';
      const visible = (document.getElementById('proj-form-visible') || {}).value === 'true';

      if (isEdit) {
        project.title = title;
        project.expertId = selectedExpertId;
        project.pendingExpertName = selectedExpertId ? '' : pendingNameValue.trim();
        project.year = year;
        project.month = month;
        project.satisfaction = satisfaction;
        project.desc = desc;
        project.visible = visible;
        project.updatedAt = new Date().toISOString();
      } else {
        const newProj = {
          id: 'proj_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6),
          title: title,
          expertId: selectedExpertId,
          pendingExpertName: selectedExpertId ? '' : pendingNameValue.trim(),
          year: year,
          month: month,
          satisfaction: satisfaction,
          desc: desc,
          visible: selectedExpertId ? visible : false,
          createdBy: '主管理员',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        if (!db.yiliProjects || !Array.isArray(db.yiliProjects)) db.yiliProjects = [];
        db.yiliProjects.push(newProj);
      }

      saveDB(db);
      overlay.remove();
      // Refresh whichever tab is active
      const adminPanel = document.getElementById('admin-panel');
      if (adminPanel && appState.adminTab === 'experts') {
        renderExpertsTab(adminPanel);
      } else if (adminPanel) {
        renderProjectsTab(adminPanel);
      }
      toast(isEdit ? '项目已更新' : '项目已添加', 'success');
    }
  }, isEdit ? '保存修改' : '添加项目'));

  content.appendChild(body);
  overlay.appendChild(content);
  document.body.appendChild(overlay);
}

// 从专家编辑页打开项目表单 — 预填讲师
function showProjectFormForExpert(expert) {
  if (!expert) return;
  window.__prefillProjectExpert = { id: expert.id, name: expert.name };
  showProjectForm(null);
  setTimeout(() => { window.__prefillProjectExpert = null; }, 200);
}

function showExpertForm(expert) {
  const db = appState.db;
  const isEdit = !!expert;
  
  // v3.5: 为新增专家生成临时ID，用于前置添加合作项目
  const tempExpertId = isEdit ? null : ('_temp_expert_' + Date.now());
  if (!isEdit) {
    window.__newExpertTempId = tempExpertId;
  }
  const overlay = h('div', { className: 'modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const content = h('div', { className: 'modal-content' });
  
  const header = h('div', { className: 'modal-header' });
  header.appendChild(h('div', { className: 'modal-title' }, isEdit ? '编辑专家：' + expert.name : '新增专家'));
  header.appendChild(h('button', { className: 'modal-close', onclick: () => overlay.remove() }, '✕'));
  content.appendChild(header);
  
  const body = h('div', { className: 'modal-body' });
  const cfg = db.ratingConfig;
  
  // ===== Helper: parse 【subtitle】content pairs from text =====
  function parseQualPairs(text) {
    if (!text) return [];
    const pairs = [];
    const parts = text.split(/【([^】]+)】/);
    for (let i = 1; i < parts.length; i += 2) {
      pairs.push({ subtitle: parts[i].trim(), content: (parts[i+1] || '').trim() });
    }
    if (pairs.length === 0 && text.trim()) {
      pairs.push({ subtitle: '', content: text.trim() });
    }
    return pairs;
  }
  
  // ===== Basic fields =====
  // Name
  const nameGroup = h('div', { className: 'form-group' });
  nameGroup.appendChild(h('label', {}, '姓名 *'));
  nameGroup.appendChild(h('input', { type:'text', id:'form-name', value: expert ? expert.name : '' }));
  body.appendChild(nameGroup);
  
  // Fields - multi-select checkboxes
  const fieldsGroup = h('div', { className: 'form-group' });
  fieldsGroup.appendChild(h('label', {}, '适用领域（多选）'));
  const fieldsBox = h('div', { style:{ display:'flex', flexWrap:'wrap', gap:'6px', padding:'8px 12px', border:'1px solid var(--border)', borderRadius:'8px', maxHeight:'180px', overflowY:'auto', background:'white' } });
  const selectedFields = expert ? new Set(expert.fields) : new Set();
  db.fields.forEach(f => {
    const cbLabel = h('label', { style:{ display:'flex', alignItems:'center', gap:'4px', fontSize:'13px', padding:'4px 8px', borderRadius:'6px', cursor:'pointer', background: selectedFields.has(f.name) ? (f.color + '22') : 'transparent' } });
    const cb = h('input', { type:'checkbox', value: f.name, checked: selectedFields.has(f.name), style:{ accentColor: f.color } });
    cbLabel.appendChild(cb);
    cbLabel.appendChild(h('span', { style:{ color: f.color, fontWeight: selectedFields.has(f.name) ? '600' : '400' } }, f.name));
    fieldsBox.appendChild(cbLabel);
  });
  fieldsGroup.appendChild(fieldsBox);
  body.appendChild(fieldsGroup);
  
  // Education
  const eduGroup = h('div', { className: 'form-group' });
  eduGroup.appendChild(h('label', {}, '学历'));
  eduGroup.appendChild(h('input', { type:'text', id:'form-education', value: expert ? expert.education : '' }));
  body.appendChild(eduGroup);
  
  // 是否为库内供应商
  const supplierGroup = h('div', { className: 'form-group' });
  supplierGroup.appendChild(h('label', {}, '是否为库内供应商'));
  const supplierSelect = h('select', {
    id: 'form-supplier',
    style: { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', background: 'white' }
  });
  ['是', '否'].forEach(opt => {
    const o = h('option', { value: opt }, opt);
    if (expert && ((opt === '是' && expert.isSupplier) || (opt === '否' && !expert.isSupplier))) o.selected = true;
    if (!expert && opt === '否') o.selected = true; // 新增默认选"否"
    supplierSelect.appendChild(o);
  });
  supplierGroup.appendChild(supplierSelect);
  body.appendChild(supplierGroup);
  
  // Advantages
  const advGroup = h('div', { className: 'form-group' });
  advGroup.appendChild(h('label', {}, '突出优势（每行一条，用■开头，如：■行业经验：20年乳业咨询经验）'));
  const advVal = expert ? expert.advantages.map(a => a.title ? '■' + a.title + '：' + a.desc : '■' + a.desc).join('\n') : '';
  advGroup.appendChild(h('textarea', { id:'form-advantages', style:{ minHeight:'80px' } }, advVal));
  body.appendChild(advGroup);
  
  // v3.2: 专家卡优势概括（1-3条）
  const cardAdvGroup = h('div', { className: 'form-group' });
  cardAdvGroup.appendChild(h('label', {}, '🃏 专家卡优势概括（1-3条，每行一条，显示在专家卡片上）'));
  cardAdvGroup.appendChild(h('textarea', {
    id: 'form-advDisplay',
    placeholder: '例：供应链管理专家，10年供应链管理经历',
    style: { minHeight: '60px' }
  }, expert ? (expert.advDisplay || '') : ''));
  body.appendChild(cardAdvGroup);
  
  // v3.2: 专家卡资历概括（1-3条）
  const cardQualGroup = h('div', { className: 'form-group' });
  cardQualGroup.appendChild(h('label', {}, '🃏 专家卡资历概括（1-3条，每行一条，显示在专家卡片上）'));
  cardQualGroup.appendChild(h('textarea', {
    id: 'form-qualDisplay',
    placeholder: '例：智篆商业智库专家\n逗宠网络科技联合创始人及供应链副总',
    style: { minHeight: '60px' }
  }, expert ? (expert.qualDisplay || '') : ''));
  body.appendChild(cardQualGroup);
  
  // ===== Qualifications - sub-title dropdown fields =====
  const qualGroup = h('div', { className: 'form-group' });
  qualGroup.appendChild(h('label', {}, '资历资质（选择子标题类型，填写对应内容）'));
  const qualSubtitleOptions = ['职称/荣誉头衔', '社会职务', '履历资历'];
  const qualPairs = parseQualPairs(expert ? expert.qualifications : '');
  if (qualPairs.length === 0) qualPairs.push({ subtitle: '职称/荣誉头衔', content: '' });
  const qualContainer = h('div', { id:'qual-pairs' });
  function renderQualPairs() {
    qualContainer.innerHTML = '';
    qualPairs.forEach((pair, idx) => {
      const row = h('div', { style:{ display:'flex', gap:'6px', marginBottom:'6px', alignItems:'flex-start' } });
      // Reorder buttons
      const reorderBtns = h('div', { style:{ display:'flex', flexDirection:'column', gap:'2px' } });
      const upBtn = h('button', {
        style:{ padding:'2px 6px', border:'1px solid var(--border)', borderRadius:'4px', background:'white', cursor: idx > 0 ? 'pointer' : 'not-allowed', fontSize:'10px', color: idx > 0 ? 'var(--text)' : 'var(--text-muted)', lineHeight:'1' },
        disabled: idx === 0,
        onclick: () => {
          if (idx > 0) {
            [qualPairs[idx-1], qualPairs[idx]] = [qualPairs[idx], qualPairs[idx-1]];
            renderQualPairs();
          }
        }
      }, '▲');
      const downBtn = h('button', {
        style:{ padding:'2px 6px', border:'1px solid var(--border)', borderRadius:'4px', background:'white', cursor: idx < qualPairs.length-1 ? 'pointer' : 'not-allowed', fontSize:'10px', color: idx < qualPairs.length-1 ? 'var(--text)' : 'var(--text-muted)', lineHeight:'1' },
        disabled: idx === qualPairs.length - 1,
        onclick: () => {
          if (idx < qualPairs.length - 1) {
            [qualPairs[idx], qualPairs[idx+1]] = [qualPairs[idx+1], qualPairs[idx]];
            renderQualPairs();
          }
        }
      }, '▼');
      reorderBtns.appendChild(upBtn);
      reorderBtns.appendChild(downBtn);
      row.appendChild(reorderBtns);
      // Dropdown select for sub-title
      const sel = h('select', {
        style:{ flex:1, padding:'6px 10px', border:'1px solid var(--border)', borderRadius:'6px', fontSize:'12px', background:'white' },
        onchange: (e) => { qualPairs[idx].subtitle = e.target.value; }
      });
      qualSubtitleOptions.forEach(opt => {
        const o = h('option', { value: opt }, opt);
        if (pair.subtitle === opt) o.selected = true;
        sel.appendChild(o);
      });
      // Add custom option if subtitle doesn't match predefined options
      if (pair.subtitle && !qualSubtitleOptions.includes(pair.subtitle)) {
        const customO = h('option', { value: pair.subtitle, selected: true }, pair.subtitle);
        sel.appendChild(customO);
      }
      row.appendChild(sel);
      const delBtn = h('button', {
        style:{ padding:'6px 10px', border:'1px solid #fca5a5', borderRadius:'6px', background:'#fef2f2', color:'#dc2626', cursor:'pointer', fontSize:'12px' },
        onclick: () => {
          qualPairs.splice(idx, 1);
          if (qualPairs.length === 0) qualPairs.push({ subtitle: '职称/荣誉头衔', content: '' });
          renderQualPairs();
        }
      }, '×');
      row.appendChild(delBtn);
      qualContainer.appendChild(row);
      // Content textarea with grey hint placeholder
      const cta = h('textarea', {
        placeholder: pair.subtitle ? '请填写' + pair.subtitle + '相关内容…' : '内容描述',
        value: pair.content,
        style:{ width:'100%', minHeight:'48px', padding:'6px 10px', border:'1px solid var(--border)', borderRadius:'6px', fontSize:'12px', marginBottom:'8px' },
        oninput: (e) => { qualPairs[idx].content = e.target.value; }
      });
      qualContainer.appendChild(cta);
    });
    const addRow = h('div', { style:{ marginTop:'4px' } });
    addRow.appendChild(h('button', {
      className: 'btn btn-secondary btn-sm',
      style: { fontSize:'11px' },
      onclick: () => { qualPairs.push({ subtitle: '职称/荣誉头衔', content: '' }); renderQualPairs(); }
    }, '+ 添加资历项'));
    qualContainer.appendChild(addRow);
  }
  renderQualPairs();
  qualGroup.appendChild(qualContainer);
  body.appendChild(qualGroup);
  
  // ===== Reference Cases - fixed sub-title fields =====
  const caseGroup = h('div', { className: 'form-group' });
  caseGroup.appendChild(h('label', {}, '参考案例'));
  const casePairs = parseQualPairs(expert ? expert.courses : '');
  // Ensure we have at least the two fixed entries
  const fixedCaseTypes = ['核心课程', '服务经历'];
  const mergedPairs = [];
  fixedCaseTypes.forEach(type => {
    const existing = casePairs.find(p => p.subtitle === type);
    if (existing) {
      mergedPairs.push(existing);
    } else {
      mergedPairs.push({ subtitle: type, content: '' });
    }
  });
  // Also add any extra pairs from the original data
  casePairs.forEach(p => {
    if (!fixedCaseTypes.includes(p.subtitle) && p.subtitle) {
      mergedPairs.push(p);
    }
  });
  const caseContainer = h('div', { id:'case-pairs' });
  function renderCasePairs() {
    caseContainer.innerHTML = '';
    mergedPairs.forEach((pair, idx) => {
      // Sub-title is fixed as label, no input needed
      const labelDiv = h('div', {
        style: { fontSize:'12px', fontWeight:'600', color:'var(--text)', marginBottom:'4px', padding:'4px 8px', background:'var(--bg)', borderRadius:'4px', borderLeft:'3px solid var(--primary)' }
      }, pair.subtitle);
      caseContainer.appendChild(labelDiv);
      caseContainer.appendChild(h('textarea', {
        placeholder: '请填写' + pair.subtitle + '相关内容…',
        value: pair.content,
        style:{ width:'100%', minHeight:'60px', padding:'6px 10px', border:'1px solid var(--border)', borderRadius:'6px', fontSize:'12px', marginBottom:'12px' },
        oninput: (e) => { mergedPairs[idx].content = e.target.value; }
      }));
    });
  }
  renderCasePairs();
  caseGroup.appendChild(caseContainer);
  body.appendChild(caseGroup);
  
  // Contact fields (v3.1: 支持多联系人)
  body.appendChild(h('div', { className: 'detail-section-title', style: { marginTop: '16px' } }, '📋 联系方式'));
  
  const contactsContainer = h('div', { id: 'contacts-container', style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
  
  // 获取现有多联系人数据
  const existingContacts = expert ? getContactsList(expert) : [];
  if (existingContacts.length === 0) existingContacts.push({ person: '', info: '', type: 'phone' });
  
  let contactIndex = 0; // track for unique IDs
  
  function addContactRow(personVal, infoVal, typeVal) {
    const idx = contactIndex++;
    const rowId = 'contact-' + idx;
    const row = h('div', { id: rowId, style: { display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 10px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' } });
    
    // Person input
    row.appendChild(h('input', {
      type: 'text',
      placeholder: '联系人姓名',
      value: personVal || '',
      'data-idx': idx,
      'data-field': 'person',
      style: { flex: '1', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', minWidth: '100px' }
    }));
    
    // Type select
    const typeSel = h('select', {
      'data-idx': idx,
      'data-field': 'type',
      style: { padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', background: 'white', width: '80px' }
    });
    ['phone', 'wechat', 'email'].forEach(t => {
      const opt = h('option', { value: t }, t === 'phone' ? '电话' : t === 'wechat' ? '微信' : '邮箱');
      if (typeVal === t) opt.selected = true;
      typeSel.appendChild(opt);
    });
    row.appendChild(typeSel);
    
    // Info input
    row.appendChild(h('input', {
      type: 'text',
      placeholder: '电话/微信/邮箱',
      value: infoVal || '',
      'data-idx': idx,
      'data-field': 'info',
      style: { flex: '1.5', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }
    }));
    
    // Remove button (hide if only one row)
    const removeBtn = h('button', {
      className: 'btn btn-sm',
      style: { background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer', flexShrink: '0' },
      onclick: () => {
        const allRows = contactsContainer.querySelectorAll('[id^="contact-"]');
        if (allRows.length <= 1) {
          toast('至少保留一个联系人', 'error');
          return;
        }
        row.remove();
      }
    }, '✕');
    row.appendChild(removeBtn);
    
    contactsContainer.appendChild(row);
  }
  
  existingContacts.forEach(c => addContactRow(c.person, c.info, c.type));
  
  body.appendChild(contactsContainer);
  
  // Add contact button
  const addContactBtn = h('button', {
    className: 'btn btn-secondary btn-sm',
    style: { marginTop: '6px' },
    onclick: () => addContactRow('', '', 'phone')
  }, '+ 新增联系人');
  body.appendChild(addContactBtn);
  
  // Legacy fields (hidden, for backward compatibility)
  body.appendChild(h('input', { type: 'hidden', id: 'form-contactPerson' }));
  body.appendChild(h('input', { type: 'hidden', id: 'form-contactInfo' }));
  body.appendChild(h('input', { type: 'hidden', id: 'form-contactType' }));
  
  const refGroup = h('div', { className: 'form-group' });
  refGroup.appendChild(h('label', {}, '内部推荐人'));
  refGroup.appendChild(h('input', { type:'text', id:'form-referrer', value: expert ? expert.referrer : '' }));
  body.appendChild(refGroup);
  
  // 合作项目 — 可折叠区域（v3.4）
  const expertProjects = expert ? getProjectsForExpert(expert.id) : [];
  const projSection = h('div', { style: 'margin-top:16px;border:1px solid var(--border);border-radius:8px;overflow:hidden' });
  const projHeader = h('div', {
    style: 'padding:10px 14px;background:var(--bg);cursor:pointer;display:flex;align-items:center;justify-content:space-between;user-select:none',
    onclick: function() {
      const body = document.getElementById('expert-projects-body');
      const arrow = document.getElementById('expert-projects-arrow');
      if (body.style.display === 'none') {
        body.style.display = 'block';
        arrow.textContent = '▼';
      } else {
        body.style.display = 'none';
        arrow.textContent = '▶';
      }
    }
  });
  projHeader.appendChild(h('span', { style: 'font-weight:600;font-size:13px' },
    '📋 合作项目（' + expertProjects.length + '）'));
  projHeader.appendChild(h('span', { id: 'expert-projects-arrow', style: 'font-size:11px;color:var(--text-muted)' }, '▶'));
  projSection.appendChild(projHeader);

  const projBody = h('div', { id: 'expert-projects-body', style: 'display:none;padding:10px 14px 14px' });
  // List existing projects
  expertProjects.forEach(proj => {
    const row = h('div', {
      style: 'padding:8px 10px;margin-bottom:6px;background:#f0f7ff;border:1px solid #bfdbfe;border-radius:6px;font-size:12px;display:flex;align-items:center;justify-content:space-between'
    });
    let rowText = proj.title + ' · ' + proj.year;
    if (proj.month) rowText += ' ' + proj.month + '月';
    if (proj.satisfaction && proj.satisfaction.value) rowText += ' · ' + formatSatisfactionDisplay(proj.satisfaction) + '/10';
    if (!proj.visible) rowText += ' [已隐藏]';
    row.appendChild(h('span', {}, rowText));
    const rowActions = h('div', { style: 'display:flex;gap:4px;flex-shrink:0;margin-left:8px' });
    rowActions.appendChild(h('button', {
      className: 'btn btn-sm',
      style: 'padding:2px 8px;font-size:11px;background:white;border:1px solid var(--border);border-radius:4px;cursor:pointer',
      onclick: (e) => { e.stopPropagation(); showProjectForm(proj); }
    }, '编辑'));
    rowActions.appendChild(h('button', {
      className: 'btn btn-sm',
      style: 'padding:2px 8px;font-size:11px;color:#ef4444;background:white;border:1px solid #fecaca;border-radius:4px;cursor:pointer',
      onclick: (e) => {
        e.stopPropagation();
        if (!confirm('删除项目「' + proj.title + '」？')) return;
        db.yiliProjects = db.yiliProjects.filter(p => p.id !== proj.id);
        saveDB(db);
        overlay.remove();
        showExpertForm(expert);
        toast('项目已删除', 'success');
      }
    }, '删除'));
    row.appendChild(rowActions);
    projBody.appendChild(row);
  });
  // Add project button
  projBody.appendChild(h('button', {
    className: 'btn btn-secondary btn-sm',
    style: 'width:100%;margin-top:4px',
      onclick: (e) => {
      e.stopPropagation();
      if (!expert) {
        // v3.5: 新增专家时支持同时添加合作项目
        const formName = (document.getElementById('form-name') || {}).value || '';
        const formNameTrim = formName.trim();
        if (!formNameTrim) {
          toast('请先填写专家姓名，再添加合作项目', 'warning');
          return;
        }
        window.__prefillProjectExpert = { id: tempExpertId, name: formNameTrim, isTemp: true };
        showProjectForm(null);
        setTimeout(() => { window.__prefillProjectExpert = null; }, 200);
        return;
      }
      showProjectFormForExpert(expert);
    }
  }, '+ 新增合作项目'));
  projSection.appendChild(projBody);
  body.appendChild(projSection);

  // 评分
  const scoreSep = h('div', { style: 'margin-top:16px;border-top:1px solid var(--border);padding-top:12px' });
  scoreSep.appendChild(h('label', { style: 'fontSize:13px;color:var(--text-muted);fontStyle:italic' }, '以下「评分」功能暂未启用，后续版本将单独讨论'));
  body.appendChild(scoreSep);
  // Sub-dimension scores
  const scoreLabel = h('div', { style:{ marginTop:'16px', marginBottom:'8px' } });
  scoreLabel.appendChild(h('label', {}, '评分（系统会根据学历、资历等信息自动计算初始分值，如有异议可手动调整）'));
  body.appendChild(scoreLabel);
  
  const subScoreGrid = h('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' } });
  cfg.dimensions.forEach(dim => {
    const block = h('div', { style:{ padding:'12px', background:'var(--bg)', borderRadius:'8px', border:'1px solid var(--border)' } });
    block.appendChild(h('div', { style:{ fontSize:'13px', fontWeight:'600', marginBottom:'8px', color: dim.id === 'professional' ? '#3B82F6' : '#F59E0B' } }, dim.name));
    (dim.subDimensions || []).forEach(sd => {
      const key = dim.id + '_' + sd.name;
      let val = '5';
      if (expert && expert.subScores && expert.subScores[dim.id] && expert.subScores[dim.id][sd.name] !== undefined) {
        val = String(expert.subScores[dim.id][sd.name]);
      }
      const sr = h('div', { style:{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 0' } });
      sr.appendChild(h('span', { style:{ fontSize:'12px', color:'var(--text-secondary)' } }, sd.name));
      sr.appendChild(h('input', {
        type:'number', value: val, min:1, max:10, placeholder:'5',
        style:{ width:'54px', padding:'3px 6px', border:'1px solid var(--border)', borderRadius:'4px', fontSize:'12px', textAlign:'center' },
        id: 'form-' + key
      }));
      block.appendChild(sr);
    });
    subScoreGrid.appendChild(block);
  });
  body.appendChild(subScoreGrid);
  
  // Entry info display (for existing experts)
  if (isEdit) {
    const entryDiv = h('div', { style:{ marginTop:'16px', padding:'10px 14px', background:'#f8fafc', borderRadius:'8px', border:'1px solid var(--border)' } });
    entryDiv.appendChild(h('div', { style:{ fontSize:'12px', color:'var(--text-muted)' } }, '录入时间：' + (expert.createdAt ? formatDate(expert.createdAt) : '未知')));
    entryDiv.appendChild(h('div', { style:{ fontSize:'12px', color:'var(--text-muted)' } }, '录入者：' + (expert.createdBy || '主管理员')));
    body.appendChild(entryDiv);
  }
  
  // Save button
  body.appendChild(h('button', {
    className: 'btn btn-primary',
    style: { width: '100%', marginTop: '12px' },
    onclick: () => {
      const nameVal = document.getElementById('form-name').value.trim();
      if (!nameVal) { toast('请输入姓名', 'error'); return; }
      
      // Get selected fields
      const fieldCbs = fieldsBox.querySelectorAll('input[type=checkbox]:checked');
      const fieldsArr = Array.from(fieldCbs).map(cb => cb.value);
      if (fieldsArr.length === 0) { toast('请选择适用领域', 'error'); return; }
      
      // Build qualifications text
      const qualText = qualPairs.filter(p => p.subtitle || p.content).map(p => '【' + (p.subtitle || '未分类') + '】' + (p.content || '')).join('\n');
      
      // Build cases text
      const caseText = mergedPairs.filter(p => p.subtitle || p.content).map(p => '【' + (p.subtitle || '未分类') + '】' + (p.content || '')).join('\n');
      
      // Collect sub-scores
      const subScores = {};
      cfg.dimensions.forEach(dim => {
        subScores[dim.id] = {};
        (dim.subDimensions || []).forEach(sd => {
          const key = dim.id + '_' + sd.name;
          subScores[dim.id][sd.name] = parseInt(document.getElementById('form-' + key)?.value) || 5;
        });
      });
      
      // Calculate dimension scores from sub-scores
      const profDim = cfg.dimensions.find(d => d.id === 'professional');
      const inflDim = cfg.dimensions.find(d => d.id === 'influence');
      let profScore = 0, inflScore = 0;
      if (profDim) profDim.subDimensions.forEach(sd => { profScore += (subScores.professional[sd.name] || 5) * sd.weight; });
      if (inflDim) inflDim.subDimensions.forEach(sd => { inflScore += (subScores.influence[sd.name] || 5) * sd.weight; });
      profScore = Math.round(profScore * 10) / 10;
      inflScore = Math.round(inflScore * 10) / 10;
      const overallScore = Math.round((profScore * profDim.weight + inflScore * inflDim.weight) * 10) / 10;
      
      // v3.1: collect all contacts from dynamic form
      const contactsArr = [];
      const contactRows = document.querySelectorAll('#contacts-container [id^="contact-"]');
      contactRows.forEach(row => {
        const person = (row.querySelector('[data-field="person"]') || {}).value || '';
        const info = (row.querySelector('[data-field="info"]') || {}).value || '';
        const type = (row.querySelector('[data-field="type"]') || {}).value || 'phone';
        if (person || info) {
          contactsArr.push({ person: person, info: info, type: type });
        }
      });
      if (contactsArr.length === 0) {
        contactsArr.push({ person: '', info: '', type: 'phone' });
      }
      
      const newExpert = {
        id: isEdit ? expert.id : Math.max(0, ...db.experts.map(e => e.id)) + 1,
        name: nameVal,
        fields: fieldsArr,
        advantages: parseAdvantages(document.getElementById('form-advantages').value),
        education: document.getElementById('form-education').value,
        qualifications: qualText,
        courses: caseText,
        // v3.2: 卡片级展示字段（不会被"突出优势"和"资历资质"覆盖）
        advDisplay: (document.getElementById('form-advDisplay').value || '').trim(),
        qualDisplay: (document.getElementById('form-qualDisplay').value || '').trim(),
        contactPerson: contactsArr[0].person,
        contactInfo: contactsArr[0].info,
        contactType: contactsArr[0].type,
        contacts: contactsArr,
        referrer: document.getElementById('form-referrer').value || '',
        isSupplier: document.getElementById('form-supplier').value === '是',
        scores: { professional: profScore, influence: inflScore, overall: overallScore },
        subScores: subScores,
        status: overallScore >= 7 ? 'active' : 'observation',
        observationStatus: (expert && expert.observationStatus) || null,
        observationDate: (expert && expert.observationDate) || null,
        createdAt: (expert && expert.createdAt) || new Date().toISOString(),
        createdBy: (expert && expert.createdBy) || '主管理员'
      };
      
      if (isEdit) {
        const idx = db.experts.findIndex(e => e.id === expert.id);
        db.experts[idx] = newExpert;
      } else {
        db.experts.push(newExpert);
        // v3.5: 更新新增专家时前置创建的合作项目（临时ID → 正式ID，设为可见）
        if (tempExpertId && db.yiliProjects && Array.isArray(db.yiliProjects)) {
          db.yiliProjects.forEach(p => {
            if (p.expertId === tempExpertId) {
              p.expertId = newExpert.id;
              p.visible = true;
              p.pendingExpertName = '';
            }
          });
        }
      }
      
      updateFieldsList(db);
      saveDB(db);
      overlay.remove();
      renderAdmin();
      toast(isEdit ? '专家信息已更新' : '专家已添加', 'success');
    }
  }, isEdit ? '保存修改' : '添加专家'));
  
  content.appendChild(body);
  overlay.appendChild(content);
  document.body.appendChild(overlay);
}

function parseAdvantages(text) {
  if (!text) return [];
  const items = [];
  const parts = text.split(/\n(?=■)/);
  parts.forEach(part => {
    part = part.trim();
    if (!part) return;
    if (part.startsWith('■')) {
      const content = part.substring(1).trim();
      if (content.includes('：')) {
        const [title, desc] = content.split('：', 2);
        items.push({ title: title.trim(), desc: desc.trim() });
      } else {
        items.push({ title: '', desc: content });
      }
    }
  });
  return items;
}

function detectContactType(info) {
  if (!info) return 'other';
  if (info.includes('@') && info.match(/[\w.-]+@[\w.-]+/)) return 'email';
  if (info.includes('微信')) return 'wechat';
  if (info.match(/^[\d\-\s]+$/)) return 'phone';
  return 'other';
}

// ===== v3.1: 多联系人支持 =====
// 获取专家的联系人列表（兼容旧版 contactPerson/contactInfo/contactType）
function getContactsList(expert) {
  if (expert.contacts && expert.contacts.length > 0) {
    return expert.contacts;
  }
  // 向后兼容旧版单联系人格式
  if (expert.contactPerson || expert.contactInfo) {
    return [{
      person: expert.contactPerson || '',
      info: expert.contactInfo || '',
      type: expert.contactType || 'phone'
    }];
  }
  return [];
}

// 迁移旧版单联系人格式 → contacts 数组
function migrateContactsForExpert(e) {
  if (!e.contacts || e.contacts.length === 0) {
    if (e.contactPerson || e.contactInfo) {
      e.contacts = [{
        person: e.contactPerson || '',
        info: e.contactInfo || '',
        type: e.contactType || 'phone'
      }];
    } else {
      e.contacts = [];
    }
  }
  // 确保向后兼容字段与 contacts[0] 同步
  if (e.contacts.length > 0) {
    e.contactPerson = e.contacts[0].person;
    e.contactInfo = e.contacts[0].info;
    e.contactType = e.contacts[0].type;
  }
  return e;
}

function roundScore(s) { return Math.round(s * 10) / 10; }

// ===== AI SCORING =====
function aiScoreExpert(expert) {
  const cfg = appState.db.ratingConfig;
  
  // Generate sub-scores if not present
  if (!expert.subScores) {
    expert.subScores = {};
    
    // Build combined text for keyword analysis
    const qual = expert.qualifications || '';
    const adv = (expert.advantages || []).map(a => (a.title||'') + ' ' + a.desc).join(' ');
    const combinedText = qual + ' ' + adv + ' ' + (expert.education || '');
    const txt = combinedText.toLowerCase();
    
    // Generic keyword scoring for professional sub-dimensions
    const profDims = cfg.dimensions.find(d => d.id === 'professional');
    if (profDims && profDims.subDimensions) {
      expert.subScores.professional = {};
      profDims.subDimensions.forEach(sd => {
        const nameTxt = sd.name.toLowerCase();
        let score = 5;
        // High-score keywords (9+)
        if (/学历|学术|博士|博士后|phd|硕士|研究生|master|本科|学士|学位|教育|professor/i.test(nameTxt)) {
          if (/博士|博士后|phd|教授/i.test(txt)) score = 9;
          else if (/硕士|研究生|master|mba/i.test(txt)) score = 8;
          else if (/本科|学士|bachelor/i.test(txt)) score = 7;
          else score = 6;
        } else if (/资质|认证|资格|certif|注[册会]|cpa|cfa|acca|license/i.test(nameTxt)) {
          if (/认证|certif|注[册会]|cpa|cfa|acca/i.test(txt)) score = 9;
          else if (/资质|资格|license/i.test(txt)) score = 8;
          else score = Math.min(8, Math.round(expert.scores.professional || 7));
        } else if (/成果|经验|著作|出版|论文|研究|课题|专利|项目|经历|实践/i.test(nameTxt)) {
          if (/著作|出版|论文|研究|课题|专利|发明/i.test(txt)) score = 9;
          else if (/讲师|培训|课程|开发|项目|服务/i.test(txt)) score = 8;
          else if (/年|企业|集团|公司/i.test(txt)) score = 7;
          else score = Math.min(7, Math.round(expert.scores.professional || 7));
        } else {
          score = Math.min(8, Math.round(expert.scores.professional || 7));
        }
        expert.subScores.professional[sd.name] = Math.min(10, Math.max(1, score));
      });
    }
    
    // Generic keyword scoring for influence sub-dimensions
    const inflDims = cfg.dimensions.find(d => d.id === 'influence');
    if (inflDims && inflDims.subDimensions) {
      expert.subScores.influence = {};
      inflDims.subDimensions.forEach(sd => {
        const nameTxt = sd.name.toLowerCase();
        let score = 5;
        if (/荣誉|奖项|奖|称号|表彰|殊荣|十大|百强|社会/i.test(nameTxt)) {
          if (/奖|荣誉|称号|表彰|十大|百强/i.test(txt)) score = 9;
          else if (/协会|学会|理事|委员|专家/i.test(txt)) score = 8;
          else score = Math.min(7, Math.round(expert.scores.influence || 7));
        } else if (/职称|头衔|教授|研究员|工程师|院士|首席|高级|技术/i.test(nameTxt)) {
          if (/教授|研究员|高级工程师|院士|首席/i.test(txt)) score = 9;
          else if (/总监|副总裁|合伙人|创始人/i.test(txt)) score = 8;
          else score = Math.min(7, Math.round(expert.scores.influence || 7));
        } else if (/管理|履历|行业|地位|领导|职[位务]|ceo|总裁|总[经監]|董事|创始人/i.test(nameTxt)) {
          if (/ceo|总裁|总经理|董事长|创始人|首席/i.test(txt)) score = 9;
          else if (/总监|副总裁|vp|director/i.test(txt)) score = 8;
          else if (/经理|主管|lead/i.test(txt)) score = 7;
          else score = Math.min(6, Math.round(expert.scores.influence || 7));
        } else {
          score = Math.min(7, Math.round(expert.scores.influence || 7));
        }
        expert.subScores.influence[sd.name] = Math.min(10, Math.max(1, score));
      });
    }
  }
}

function initAIScoring() {
  if (!appState.db.ratingConfig.aiScoringEnabled) return;
  appState.db.experts.forEach(e => aiScoreExpert(e));
  saveDB(appState.db);
}

function updateFieldsList(db) {
  const allFields = new Set();
  db.experts.forEach(e => e.fields.forEach(f => allFields.add(f)));
  const existingNames = new Set(db.fields.map(f => f.name));
  
  // Add new fields with default colors
  const colorPool = ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#84CC16','#F97316','#6366F1','#14B8A6','#E11D48','#7C3AED','#0EA5E9','#22C55E','#A855F7','#EAB308','#0891B2','#DC2626'];
  let colorIdx = db.fields.length;
  allFields.forEach(f => {
    if (!existingNames.has(f)) {
      db.fields.push({ name: f, color: colorPool[colorIdx % colorPool.length] });
      colorIdx++;
    }
  });
  
  db.totalFields = allFields.size;
}

function deleteExpert(id) {
  if (!confirm('确认删除该专家信息？此操作不可恢复。')) return;
  const db = appState.db;
  db.experts = db.experts.filter(e => e.id !== id);
  updateFieldsList(db);
  saveDB(db);
  renderAdmin();
  toast('专家已删除', 'success');
}

// ===== EXPORT / IMPORT =====
function showExportOptions() {
  const overlay = h('div', { className: 'modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const content = h('div', { className: 'modal-content', style: { maxWidth: '500px' } });
  
  const header = h('div', { className: 'modal-header' });
  header.appendChild(h('div', { className: 'modal-title' }, '导出数据'));
  header.appendChild(h('button', { className: 'modal-close', onclick: () => overlay.remove() }, '✕'));
  content.appendChild(header);
  
  const body = h('div', { className: 'modal-body' });
  const options = h('div', { className: 'export-options' });
  
  // Excel
  const excelOpt = h('div', {
    className: 'export-option',
    onclick: () => {
      exportToCSV();
      overlay.remove();
    }
  });
  excelOpt.appendChild(h('div', { className: 'icon' }, '📊'));
  excelOpt.appendChild(h('div', { className: 'label' }, '导出 Excel / CSV'));
  options.appendChild(excelOpt);
  
  // Copy JSON
  const jsonOpt = h('div', {
    className: 'export-option',
    onclick: () => {
      exportToJSON();
      overlay.remove();
    }
  });
  jsonOpt.appendChild(h('div', { className: 'icon' }, '📋'));
  jsonOpt.appendChild(h('div', { className: 'label' }, '复制 JSON 数据'));
  options.appendChild(jsonOpt);
  
  // Print
  const printOpt = h('div', {
    className: 'export-option',
    onclick: () => {
      window.print();
      overlay.remove();
    }
  });
  printOpt.appendChild(h('div', { className: 'icon' }, '🖨️'));
  printOpt.appendChild(h('div', { className: 'label' }, '打印 / PDF'));
  options.appendChild(printOpt);
  
  body.appendChild(options);
  content.appendChild(body);
  overlay.appendChild(content);
  document.body.appendChild(overlay);
}

function exportToCSV() {
  const db = appState.db;
  const headers = ['姓名','适用领域','突出优势','学历','资历资质','参考案例','联系人','联系方式','内部推荐人','专业度','影响力','综合评分'];
  const rows = [headers.join(',')];
  
  db.experts.forEach(e => {
    const advText = e.advantages.map(a => a.title ? '■' + a.title + '：' + a.desc : '■' + a.desc).join('\n');
    const csvContacts = getContactsList(e);
    const contactPersons = csvContacts.map(c => c.person).filter(Boolean).join(' | ');
    const contactInfos = csvContacts.map(c => (c.type === 'email' ? '📧' : c.type === 'wechat' ? '💬' : '📞') + c.info).filter(Boolean).join(' | ');
    const row = [
      e.name, e.fields.join('/'), advText, e.education, e.qualifications, e.courses,
      contactPersons, contactInfos, e.referrer,
      e.scores.professional, e.scores.influence, e.scores.overall
    ].map(v => '"' + (v || '').replace(/"/g,'""') + '"');
    rows.push(row.join(','));
  });
  
  const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, '专家资源库_' + new Date().toISOString().slice(0,10) + '.csv');
  toast('导出成功', 'success');
}

function exportToJSON() {
  const db = appState.db;
  const clean = JSON.parse(JSON.stringify(db));
  delete clean.permissions;
  const text = JSON.stringify(clean, null, 2);
  navigator.clipboard.writeText(text).then(() => {
    toast('JSON 数据已复制到剪贴板', 'success');
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadImportTemplate() {
  const db = appState.db;
  const sample = db.experts.length > 1 ? db.experts[1] : (db.experts.length > 0 ? db.experts[0] : null);
  
  const headers = ['姓名', '适用领域', '突出优势', '学历', '资历资质', '课程/案例', '联系人', '联系方式', '内部推荐人', '是否库内供应商'];
  
  // Generate CSV with BOM for Excel/WPS compatibility
  const rows = [headers.join(',')];
  
  if (sample) {
    // Escape CSV values: wrap in quotes, double internal quotes
    const csvEscape = (v) => {
      const s = String(v || '').replace(/"/g, '""');
      return '"' + s + '"';
    };
    
    const advText = sample.advantages ? sample.advantages.map(a => a.title ? '■' + a.title + '：' + a.desc : '■' + a.desc).join('\n') : '';
    const row = [
      sample.name,
      (sample.fields || []).join(', '),
      advText,
      sample.education || '',
      sample.qualifications || '',
      sample.courses || '',
      sample.contactPerson || '',
      sample.contactInfo || '',
      sample.referrer || '',
      sample.isSupplier ? '是' : '否'
    ].map(csvEscape);
    rows.push(row.join(','));
  }
  
  // UTF-8 BOM for Excel recognition
  const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, '专家导入模版_参照示例.csv');
  toast('模版已下载，请用 Excel/WPS 打开编辑后导入', 'success');
}

function showImportDialog() {
  const db = appState.db;
  const overlay = h('div', { className: 'modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const content = h('div', { className: 'modal-content', style: { maxWidth: '600px' } });
  
  const header = h('div', { className: 'modal-header' });
  header.appendChild(h('div', { className: 'modal-title' }, '批量导入专家数据'));
  header.appendChild(h('button', { className: 'modal-close', onclick: () => overlay.remove() }, '✕'));
  content.appendChild(header);
  
  const body = h('div', { className: 'modal-body' });
  body.appendChild(h('p', { style: { marginBottom:'16px', fontSize:'13px', color:'var(--text-secondary)' } }, '导入不会覆盖已有数据。系统会自动检测重复专家，由管理员确认后处理。'));
  
  // ===== Import Template Download =====
  body.appendChild(h('h4', { style: { fontSize:'14px', marginBottom:'8px' } }, '导入模版'));
  body.appendChild(h('div', { style: { fontSize:'12px', color:'var(--text-muted)', marginBottom:'8px' } }, '下载标准模版查看格式要求，参照模版填写专家数据后导入。'));
  body.appendChild(h('button', {
    className: 'btn btn-secondary btn-sm',
    style: { marginBottom:'20px' },
    onclick: () => downloadImportTemplate()
  }, '📥 下载导入模版（Excel）'));
  
  // ===== File Import =====
  body.appendChild(h('h4', { style: { fontSize:'14px', marginBottom:'8px' } }, '文件导入'));
  body.appendChild(h('div', { style: { fontSize:'12px', color:'var(--text-muted)', marginBottom:'8px' } }, '支持格式：Excel (.xlsx/.xls)、CSV（UTF-8）、JSON'));
  
  const fileInput = h('input', { type: 'file', accept: '.csv,.json,.xlsx,.xls', id: 'import-file', style: { marginBottom:'12px' } });
  body.appendChild(fileInput);
  
  body.appendChild(h('button', {
    className: 'btn btn-primary btn-sm',
    style: { marginBottom:'20px' },
    onclick: () => {
      const file = document.getElementById('import-file').files[0];
      if (!file) { toast('请选择文件', 'error'); return; }
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const result = e.target.result;
          const ext = file.name.split('.').pop().toLowerCase();
          
          if (ext === 'json') {
            const data = JSON.parse(result);
            if (data.experts) {
              processImport(data.experts);
            } else if (Array.isArray(data)) {
              processImport(data);
            } else {
              toast('JSON格式不正确，需要experts数组', 'error');
            }
          } else if (ext === 'csv') {
            const experts = parseCSVToExperts(result);
            if (experts.length > 0) processImport(experts);
            else toast('CSV中未找到有效数据', 'error');
          } else {
            toast('不支持的文件格式：' + ext, 'error');
          }
        } catch(err) {
          toast('文件解析失败：' + err.message, 'error');
        }
      };
      if (file.name.endsWith('.json') || file.name.endsWith('.csv')) {
        reader.readAsText(file, 'utf-8');
      } else {
        toast('请将Excel文件转为CSV格式后再导入，或使用JSON格式', 'error');
      }
    }
  }, '上传并导入'));
  
  // ===== Tencent Docs Import =====
  body.appendChild(h('h4', { style: { fontSize:'14px', marginBottom:'8px' } }, '腾讯文档导入'));
  body.appendChild(h('div', { style: { fontSize:'12px', color:'var(--text-muted)', marginBottom:'8px' } }, '粘贴腾讯文档导出的CSV内容，或输入腾讯文档公开链接。'));
  
  const docTextarea = h('textarea', {
    placeholder: '在此粘贴腾讯文档导出的CSV内容（每行一条专家数据，列格式与导出格式一致）...',
    style: { width:'100%', minHeight:'100px', padding:'10px', border:'1px solid var(--border)', borderRadius:'8px', fontSize:'12px', fontFamily:'monospace' },
    id: 'import-text'
  });
  body.appendChild(docTextarea);
  
  body.appendChild(h('button', {
    className: 'btn btn-primary btn-sm',
    style: { marginTop:'8px' },
    onclick: () => {
      const text = document.getElementById('import-text').value.trim();
      if (!text) { toast('请粘贴CSV数据', 'error'); return; }
      const experts = parseCSVToExperts(text);
      if (experts.length > 0) processImport(experts);
      else toast('未能从数据中解析出有效专家记录', 'error');
    }
  }, '解析并导入'));
  
  // ===== Duplicate handling function =====
  function processImport(newExperts) {
    const existing = db.experts;
    const duplicates = [];
    const newEntries = [];
    
    newExperts.forEach(ne => {
      // Check for duplicate by name (case-insensitive)
      const match = existing.find(ee => ee.name.toLowerCase() === (ne.name || '').toLowerCase());
      if (match) {
        duplicates.push({ existing: match, incoming: ne });
      } else {
        newEntries.push(ne);
      }
    });
    
    if (duplicates.length > 0) {
      // Show duplicate confirmation dialog
      showDuplicateConfirm(duplicates, newEntries, overlay);
    } else if (newEntries.length > 0) {
      // No duplicates, directly import
      addNewExperts(newEntries);
      overlay.remove();
      toast('成功导入 ' + newEntries.length + ' 位新专家', 'success');
    } else {
      toast('所有导入数据均与现有专家重复，未添加新记录', 'warning');
    }
  }
  
  function showDuplicateConfirm(duplicates, newEntries, parentOverlay) {
    // Close current overlay to show confirm dialog
    parentOverlay.remove();
    
    const confirmOverlay = h('div', { className: 'modal-overlay', onclick: (e) => { if (e.target === confirmOverlay) confirmOverlay.remove(); } });
    const confirmContent = h('div', { className: 'modal-content', style: { maxWidth: '650px' } });
    
    const ch = h('div', { className: 'modal-header' });
    ch.appendChild(h('div', { className: 'modal-title' }, '重复数据检测'));
    ch.appendChild(h('button', { className: 'modal-close', onclick: () => confirmOverlay.remove() }, '✕'));
    confirmContent.appendChild(ch);
    
    const cb = h('div', { className: 'modal-body' });
    cb.appendChild(h('p', { style: { fontSize:'13px', color:'#d97706', marginBottom:'12px' } }, '发现 ' + duplicates.length + ' 条重复数据（基于姓名匹配），请逐条确认操作：'));
    
    const dupActions = [];
    
    duplicates.forEach((dup, idx) => {
      const row = h('div', { style: { padding:'10px 12px', background: idx % 2 === 0 ? '#fffbeb' : '#fef3c7', borderRadius:'8px', marginBottom:'8px', border:'1px solid #fde68a' } });
      row.appendChild(h('div', { style: { fontSize:'13px', fontWeight:'600', marginBottom:'4px' } }, '#' + (idx+1) + ' ' + dup.incoming.name));
      row.appendChild(h('div', { style: { fontSize:'12px', color:'var(--text-secondary)' } }, '已有记录：' + dup.existing.name + (dup.existing.createdAt ? '（录入于 ' + formatDate(dup.existing.createdAt) + '）' : '')));
      
      const btnRow = h('div', { style: { display:'flex', gap:'6px', marginTop:'6px' } });
      const keepBtn = h('button', { className: 'btn btn-secondary btn-sm', style: { fontSize:'11px' }, onclick: () => {
        dupActions[idx] = 'skip';
        keepBtn.style.background = '#e5e7eb';
        replaceBtn.style.background = 'transparent';
        replaceBtn.style.border = '1px solid var(--border)';
      } }, '保留原有');
      const replaceBtn = h('button', { className: 'btn btn-sm', style: { fontSize:'11px', background:'#d97706', color:'white' }, onclick: () => {
        dupActions[idx] = 'replace';
        replaceBtn.style.background = '#92400e';
        keepBtn.style.background = 'transparent';
        keepBtn.style.border = '1px solid var(--border)';
      } }, '覆盖为导入数据');
      
      // Default: keep existing
      dupActions[idx] = 'skip';
      
      btnRow.appendChild(keepBtn);
      btnRow.appendChild(replaceBtn);
      row.appendChild(btnRow);
      cb.appendChild(row);
    });
    
    // Summary
    cb.appendChild(h('div', { style: { marginTop:'12px', padding:'10px', background:'#f0fdf4', borderRadius:'8px', fontSize:'12px', color:'#059669' } }, '新专家 ' + newEntries.length + ' 位将直接导入（无重复）。重复项默认保留原有数据。'));
    
    // Qualification check reminder
    const importHasQual = newEntries.some(ne => ne.qualifications && ne.qualifications.length > 0);
    if (importHasQual) {
      cb.appendChild(h('div', { style: { marginTop:'8px', padding:'10px', background:'#fffbeb', borderRadius:'8px', fontSize:'12px', color:'#92400e', border:'1px solid #fde68a' } }, '⚠️ 导入的专家包含"资历资质"信息。系统已自动提取，请在导入后进入每位专家详情页确认资历资质内容的完整性和顺序是否正确。'));
    }
    
    cb.appendChild(h('button', {
      className: 'btn btn-primary',
      style: { width: '100%', marginTop: '12px' },
      onclick: () => {
        const toAdd = [...newEntries];
        duplicates.forEach((dup, idx) => {
          if (dupActions[idx] === 'replace') {
            const existingIdx = db.experts.findIndex(e => e.id === dup.existing.id);
            if (existingIdx >= 0) {
              // Preserve original ID and metadata
              const updated = { ...dup.incoming, id: dup.existing.id, createdAt: dup.existing.createdAt, createdBy: dup.existing.createdBy };
              db.experts[existingIdx] = updated;
            }
          }
          // If skip, do nothing
        });
        addNewExperts(toAdd);
        confirmOverlay.remove();
        renderAdmin();
        let msg = '导入完成：新增 ' + toAdd.length + ' 位';
        const replaced = duplicates.filter((_, i) => dupActions[i] === 'replace').length;
        if (replaced > 0) msg += '，覆盖 ' + replaced + ' 位';
        toast(msg, 'success');
      }
    }, '确认导入'));
    
    confirmContent.appendChild(cb);
    confirmOverlay.appendChild(confirmContent);
    document.body.appendChild(confirmOverlay);
  }
  
  function addNewExperts(experts) {
    const maxId = db.experts.reduce((m, e) => Math.max(m, e.id), 0);
    experts.forEach((ne, i) => {
      // Ensure expert has required fields
      const newE = {
        id: maxId + i + 1,
        name: ne.name || '未命名' + (i+1),
        fields: Array.isArray(ne.fields) ? ne.fields : (ne.fields ? ne.fields.split(/[,，]/).map(f => f.trim()).filter(Boolean) : []),
        education: ne.education || '',
        advantages: Array.isArray(ne.advantages) ? ne.advantages : parseAdvantages(ne.advantages || ''),
        qualifications: ne.qualifications || '',
        courses: ne.courses || '',
        contactPerson: ne.contactPerson || '',
        contactInfo: ne.contactInfo || '',
        contactType: detectContactType(ne.contactInfo || ''),
        referrer: ne.referrer || '',
        isSupplier: ne.isSupplier || false,
        scores: ne.scores || { professional: 5, influence: 5, overall: 5 },
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy: '批量导入'
      };
      // AI score on new import
      newE.subScores = null;
      aiScoreExpert(newE);
      // Recalculate from sub-scores
      const cfg = db.ratingConfig;
      const profDim = cfg.dimensions.find(d => d.id === 'professional');
      const inflDim = cfg.dimensions.find(d => d.id === 'influence');
      let p = 0, inf = 0;
      if (profDim && profDim.subDimensions) profDim.subDimensions.forEach(sd => { p += (newE.subScores.professional[sd.name] || 5) * sd.weight; });
      if (inflDim && inflDim.subDimensions) inflDim.subDimensions.forEach(sd => { inf += (newE.subScores.influence[sd.name] || 5) * sd.weight; });
      newE.scores.professional = Math.round(p * 10) / 10;
      newE.scores.influence = Math.round(inf * 10) / 10;
      newE.scores.overall = Math.round((newE.scores.professional * profDim.weight + newE.scores.influence * inflDim.weight) * 10) / 10;
      newE.status = 'active';
      db.experts.push(newE);
    });
    updateFieldsList(db);
    saveDB(db);
  }
  
  function parseCSVToExperts(csvText) {
    const lines = csvText.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    
    // Parse header
    const header = lines[0].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(h => h.replace(/^"|"$/g, '').trim());
    const nameIdx = header.findIndex(h => h === '姓名' || h.toLowerCase() === 'name');
    if (nameIdx < 0) return [];
    
    const experts = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(v => v.replace(/^"|"$/g, '').trim());
      if (!vals[nameIdx]) continue;
      
      const expert = {
        name: vals[nameIdx],
        fields: [],
        education: '',
        qualifications: '',
        courses: '',
        contactPerson: '',
        contactInfo: '',
        referrer: '',
        advantages: ''
      };
      
      header.forEach((h, idx) => {
        const val = vals[idx] || '';
        if (h === '适用领域') expert.fields = val.split(/[,，、]/).map(f => f.trim()).filter(Boolean);
        else if (h === '学历') expert.education = val;
        else if (h === '资历资质') expert.qualifications = val;
        else if (h === '参考案例' || h === '课程/案例') expert.courses = val;
        else if (h === '联系人') expert.contactPerson = val;
        else if (h === '联系方式') expert.contactInfo = val;
        else if (h === '内部推荐人') expert.referrer = val;
        else if (h === '突出优势') expert.advantages = val;
        else if (h === '姓名' || h === 'name') { /* already set */ }
      });
      
      experts.push(expert);
    }
    return experts;
  }
  
  content.appendChild(body);
  overlay.appendChild(content);
  document.body.appendChild(overlay);
}

// ===== Other Admin Tabs =====
function renderRatingsTab(panel) {
  const db = appState.db;
  panel.innerHTML = '';
  panel.appendChild(h('h3', {}, '评分管理'));
  panel.appendChild(h('p', { style: { fontSize:'13px', color:'var(--text-secondary)', marginBottom:'16px' } }, '管理评分的维度配置、子维度权重及所有专家的各项分值。调整后自动重新计算综合评分。'));
  
  const cfg = db.ratingConfig;

  function recalcAllExperts() {
    db.experts.forEach(e => {
      if (!e.subScores) { e.subScores = null; aiScoreExpert(e); }
      recalcExpertFromSubscores(e);
    });
    saveDB(db);
  }

  // ===== Frontend Score Display Toggle =====
  const toggleSec = h('div', { style: { background:'var(--bg)', padding:'16px', borderRadius:'var(--radius-sm)', marginBottom:'16px', border:'1px solid var(--border)' } });
  toggleSec.appendChild(h('h4', { style: { marginBottom:'8px', fontSize:'14px' } }, '前端展示控制'));
  const toggleRow = h('div', { style:{ display:'flex', gap:'12px', alignItems:'center' } });
  toggleRow.appendChild(h('span', { style:{ fontSize:'13px' } }, '在前端展示评分信息（专家卡片 & 详情页）：'));
  toggleRow.appendChild(h('input', { type:'checkbox', checked: cfg.showScores !== false, onchange: (e) => {
    cfg.showScores = e.target.checked;
    saveDB(db);
    renderRatingsTab(panel);
    toast(e.target.checked ? '评分信息将在前端展示' : '评分信息已在前端隐藏', 'success');
  }}));
  toggleSec.appendChild(toggleRow);
  toggleSec.appendChild(h('p', { style:{ fontSize:'12px', color:'var(--text-muted)', marginTop:'6px' } }, '关闭后，专家卡片和详情页将不再显示任何评分数字及子维度信息，仅管理员在后台可见评分。'));
  panel.appendChild(toggleSec);

  // ===== Scoring System Configuration =====
  panel.appendChild(h('h4', { style: { margin:'16px 0 8px', fontSize:'15px', color:'var(--primary)' } }, '评分体系配置'));
  
  cfg.dimensions.forEach((dim, dimIdx) => {
    const dimCard = h('div', { style: { background:'var(--bg)', padding:'18px', borderRadius:'var(--radius-sm)', marginBottom:'14px', border:'2px solid ' + (dimIdx === 0 ? '#dbeafe' : '#fef3c7') } });
    
    const dimHeader = h('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' } });
    dimHeader.appendChild(h('div', { style: { fontWeight:'700', fontSize:'15px', color: dimIdx === 0 ? '#1e40af' : '#92400e' } }, dim.name));
    
    const weightCtrl = h('div', { style: { display:'flex', gap:'8px', alignItems:'center' } });
    weightCtrl.appendChild(h('span', { style:{ fontSize:'13px', color:'var(--text-muted)' } }, '权重：'));
    const weightInput = h('input', {
      type: 'number', value: String(Math.round(dim.weight * 100)), min: 10, max: 90, step: 5,
      style: { width:'70px', padding:'4px 8px', border:'1px solid var(--border)', borderRadius:'6px', fontSize:'13px', textAlign:'center' },
      onchange: (e) => {
        const newW = parseInt(e.target.value) / 100;
        if (isNaN(newW) || newW < 0.1 || newW > 0.9) { toast('权重需在10%-90%之间', 'error'); return; }
        dim.weight = newW;
        cfg.dimensions[1 - dimIdx].weight = 1 - newW;
        recalcAllExperts();
        saveDB(db);
        renderRatingsTab(panel);
        toast('权重已更新并重算所有专家评分', 'success');
      }
    });
    weightCtrl.appendChild(weightInput);
    weightCtrl.appendChild(h('span', { style:{ fontSize:'13px', color:'var(--text-muted)' } }, '%'));
    dimHeader.appendChild(weightCtrl);
    dimCard.appendChild(dimHeader);
    dimCard.appendChild(h('div', { style:{ fontSize:'12px', color:'var(--text-secondary)', marginBottom:'12px' } }, dim.desc));
    
    // Sub-dimensions with editable names, add/delete, no maxScore column
    if (!dim.subDimensions) dim.subDimensions = [];
    const subTable = h('table', { style:{ width:'100%', borderCollapse:'collapse', fontSize:'13px' } });
    const subThead = h('thead');
    const sr = h('tr', { style:{ borderBottom:'1px solid var(--border)' } });
    ['子维度名称', '权重 (%)', ''].forEach((hdr, hi) => {
      sr.appendChild(h('th', { style:{ padding:'6px 10px', textAlign: hi === 2 ? 'center' : 'left', fontSize:'12px', color:'var(--text-muted)', fontWeight:'600', width: hi === 1 ? '80px' : hi === 2 ? '40px' : 'auto' } }, hdr));
    });
    subThead.appendChild(sr); subTable.appendChild(subThead);
    
    const subTbody = h('tbody');
    function renderSubRow(sd, sdIdx) {
      const row = h('tr');
      // Editable name
      const nameTd = h('td', { style:{ padding:'4px 10px' } });
      const nameInp = h('input', {
        type: 'text', value: sd.name,
        style: { width:'100%', padding:'4px 8px', border:'1px solid var(--border)', borderRadius:'4px', fontSize:'12px' },
        placeholder: '输入子维度名称...',
        onchange: (ev) => {
          const newName = ev.target.value.trim();
          if (!newName) { toast('名称不能为空', 'error'); ev.target.value = sd.name; return; }
          const oldName = sd.name;
          sd.name = newName;
          // Rename sub-score keys for all experts
          db.experts.forEach(e => {
            if (e.subScores && e.subScores[dim.id] && e.subScores[dim.id][oldName] !== undefined) {
              e.subScores[dim.id][newName] = e.subScores[dim.id][oldName];
              delete e.subScores[dim.id][oldName];
            }
          });
          recalcAllExperts();
          saveDB(db);
          renderRatingsTab(panel);
          toast('子维度名称已更新，专家分数已同步', 'success');
        }
      });
      nameTd.appendChild(nameInp); row.appendChild(nameTd);
      
      // Weight
      const wTd = h('td', { style:{ padding:'4px 10px' } });
      const wInp = h('input', {
        type: 'number', value: String(Math.round(sd.weight * 100)), min: 5, max: 80, step: 5,
        style: { width:'55px', padding:'3px 6px', border:'1px solid var(--border)', borderRadius:'4px', fontSize:'12px', textAlign:'center' },
        onchange: (ev) => {
          const newSW = parseInt(ev.target.value) / 100;
          if (isNaN(newSW) || newSW < 0.05 || newSW > 0.8) { toast('子维度权重需在5%-80%之间', 'error'); return; }
          sd.weight = newSW;
          const total = dim.subDimensions.reduce((s, d) => s + d.weight, 0);
          if (Math.abs(total - 1) > 0.001) {
            const others = dim.subDimensions.filter((_, i) => i !== sdIdx);
            const rem = others.reduce((s, d) => s + d.weight, 0);
            if (rem > 0) others.forEach(d => { d.weight = Math.round(d.weight / rem * (1 - newSW) * 100) / 100; });
            dim.subDimensions[dim.subDimensions.length - 1].weight += parseFloat((1 - dim.subDimensions.reduce((s, d) => s + d.weight, 0)).toFixed(2));
          }
          recalcAllExperts();
          saveDB(db);
          renderRatingsTab(panel);
          toast('子维度权重已更新', 'success');
        }
      });
      wTd.appendChild(wInp); row.appendChild(wTd);
      
      // Delete button
      const delTd = h('td', { style:{ padding:'4px 10px', textAlign:'center' } });
      if (dim.subDimensions.length > 1) {
        const delBtn = h('button', {
          style: { background:'none', border:'1px solid #fca5a5', color:'#dc2626', borderRadius:'4px', cursor:'pointer', fontSize:'16px', padding:'2px 8px', lineHeight:'1' },
          title: '删除此子维度',
          onclick: () => {
            const sdName = sd.name;
            dim.subDimensions.splice(sdIdx, 1);
            // Normalize remaining weights
            const rem = dim.subDimensions.reduce((s, d) => s + d.weight, 0);
            if (rem > 0) dim.subDimensions.forEach(d => { d.weight = Math.round(d.weight / rem * 100) / 100; });
            // Remove sub-score keys for all experts
            db.experts.forEach(e => {
              if (e.subScores && e.subScores[dim.id] && e.subScores[dim.id][sdName] !== undefined) {
                delete e.subScores[dim.id][sdName];
              }
            });
            recalcAllExperts();
            saveDB(db);
            renderRatingsTab(panel);
            toast('已删除子维度「' + sdName + '」', 'success');
          }
        }, '×');
        delTd.appendChild(delBtn);
      }
      row.appendChild(delTd);
      subTbody.appendChild(row);
    }
    
    dim.subDimensions.forEach((sd, sdIdx) => { renderSubRow(sd, sdIdx); });
    subTable.appendChild(subTbody);
    
    // Add sub-dimension button
    if (dim.subDimensions.length < 3) {
      const addRow = h('tr');
      const addTd = h('td', { colspan: 3, style:{ padding:'6px 10px' } });
      const addBtn = h('button', {
        style: { background:'none', border:'1px dashed var(--border)', color:'var(--primary)', borderRadius:'6px', cursor:'pointer', fontSize:'12px', padding:'4px 14px' },
        onclick: () => {
          const newSD = { name: '新子维度', weight: 0.33, maxScore: 10 };
          dim.subDimensions.push(newSD);
          // Evenly distribute weights
          const eq = Math.round(100 / dim.subDimensions.length) / 100;
          dim.subDimensions.forEach(d => { d.weight = eq; });
          dim.subDimensions[dim.subDimensions.length - 1].weight += parseFloat((1 - eq * dim.subDimensions.length).toFixed(2));
          saveDB(db);
          renderRatingsTab(panel);
          toast('已添加新子维度（最多3条）', 'success');
        }
      }, '+ 添加子维度');
      addTd.appendChild(addBtn);
      addRow.appendChild(addTd);
      subTable.appendChild(addRow);
    } else {
      const hintRow = h('tr');
      const hintTd = h('td', { colspan: 3, style:{ padding:'4px 10px', fontSize:'11px', color:'#9ca3af' } }, '已到达上限（最多3条子维度）');
      hintRow.appendChild(hintTd);
      subTable.appendChild(hintRow);
    }
    
    dimCard.appendChild(subTable);
    panel.appendChild(dimCard);
  });
  
  // AI Scoring
  const aiSec = h('div', { style: { background:'var(--bg)', padding:'16px', borderRadius:'var(--radius-sm)', marginBottom:'16px', border:'1px solid var(--border)' } });
  aiSec.appendChild(h('h4', { style: { marginBottom:'8px', fontSize:'14px' } }, 'AI 自主评分'));
  const aiRow = h('div', { style:{ display:'flex', gap:'12px', alignItems:'center' } });
  aiRow.appendChild(h('span', { style:{ fontSize:'13px' } }, '启用AI自动评分：'));
  aiRow.appendChild(h('input', { type:'checkbox', checked: cfg.aiScoringEnabled, onchange: (e) => {
    cfg.aiScoringEnabled = e.target.checked;
    if (e.target.checked) { db.experts.forEach(ex => { ex.subScores = null; aiScoreExpert(ex); }); recalcAllExperts(); }
    saveDB(db);
    renderRatingsTab(panel);
    toast(e.target.checked ? 'AI评分已启用' : 'AI评分已关闭', 'success');
  }}));
  aiSec.appendChild(aiRow);
  aiSec.appendChild(h('p', { style:{ fontSize:'12px', color:'var(--text-muted)', marginTop:'6px' } }, 'AI根据专家学历、资历、履历等信息自动生成子维度评分。关闭后可手动调整每位专家的评分。'));
  panel.appendChild(aiSec);
  
  // Expert Score Adjustment Table
  panel.appendChild(h('h4', { style: { margin:'16px 0 8px', fontSize:'15px', color:'var(--primary)' } }, '专家评分调整'));
  
  const quickRow = h('div', { style: { display:'flex', gap:'8px', marginBottom:'12px' } });
  quickRow.appendChild(h('input', { placeholder:'搜索专家姓名...', style:{ padding:'6px 12px', border:'1px solid var(--border)', borderRadius:'6px', fontSize:'12px', flex:1, maxWidth:'200px' }, id:'rating-search', oninput: () => renderRatingTable() }));
  panel.appendChild(quickRow);
  
  const tableDiv = h('div', { id:'rating-table', style:{ overflow:'auto', maxHeight:'45vh', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)' } });
  panel.appendChild(tableDiv);
  
  function renderRatingTable() {
    const q = (document.getElementById('rating-search')?.value || '').toLowerCase();
    let experts = db.experts.filter(e => e.status !== 'eliminated');
    if (q) experts = experts.filter(e => e.name.toLowerCase().includes(q));
    const profDim = cfg.dimensions.find(d => d.id === 'professional');
    const inflDim = cfg.dimensions.find(d => d.id === 'influence');
    
    tableDiv.innerHTML = '';
    const table = h('table', { className: 'data-table', style: { minWidth:'700px' } });
    const thead = h('thead'); const hr = h('tr');
    ['姓名', '专业度', '影响力', '综合'].forEach(hdr => { hr.appendChild(h('th', { style:{ whiteSpace:'nowrap' } }, hdr)); });
    (profDim?.subDimensions || []).forEach(sd => { hr.appendChild(h('th', { style:{ whiteSpace:'nowrap', fontSize:'11px', color:'#3B82F6' } }, sd.name)); });
    (inflDim?.subDimensions || []).forEach(sd => { hr.appendChild(h('th', { style:{ whiteSpace:'nowrap', fontSize:'11px', color:'#F59E0B' } }, sd.name)); });
    hr.appendChild(h('th', { style:{ whiteSpace:'nowrap' } }, '操作'));
    thead.appendChild(hr); table.appendChild(thead);
    
    const tbody = h('tbody');
    experts.forEach(e => {
      const row = h('tr');
      row.appendChild(h('td', { style:{ fontWeight:'600' } }, e.name));
      row.appendChild(h('td', { style:{ color:'#3B82F6', fontWeight:'600' } }, String(e.scores.professional)));
      row.appendChild(h('td', { style:{ color:'#F59E0B', fontWeight:'600' } }, String(e.scores.influence)));
      row.appendChild(h('td', { style:{ fontWeight:'bold', color: e.scores.overall >= 8 ? '#059669' : '#d97706' } }, e.scores.overall.toFixed(1)));
      
      const allSubs = [
        ...(profDim?.subDimensions || []).map(sd => ({ dim:'professional', ...sd })),
        ...(inflDim?.subDimensions || []).map(sd => ({ dim:'influence', ...sd }))
      ];
      allSubs.forEach(sd => {
        const val = (e.subScores && e.subScores[sd.dim] && e.subScores[sd.dim][sd.name] !== undefined) ? e.subScores[sd.dim][sd.name] : 5;
        const td = h('td', { style:{ padding:'4px 6px' } });
        const inp = h('input', {
          type:'number', value: String(val), min:1, max:10,
          style:{ width:'48px', padding:'3px 4px', border:'1px solid var(--border)', borderRadius:'4px', fontSize:'11px', textAlign:'center' },
          onchange: (ev) => {
            const ns = parseInt(ev.target.value);
            if (isNaN(ns) || ns < 1 || ns > 10) { toast('分值1-10', 'error'); return; }
            if (!e.subScores) e.subScores = {};
            if (!e.subScores[sd.dim]) e.subScores[sd.dim] = {};
            e.subScores[sd.dim][sd.name] = ns;
            recalcExpertFromSubscores(e);
            saveDB(db);
            renderRatingsTab(panel);
            toast(e.name + ' 子维度已更新', 'success');
          }
        });
        td.appendChild(inp); row.appendChild(td);
      });
      
      const act = h('td', {});
      act.appendChild(h('button', { className:'btn btn-secondary btn-sm', style:{ fontSize:'11px' }, onclick: () => {
        e.subScores = null; aiScoreExpert(e); recalcExpertFromSubscores(e); saveDB(db);
        renderRatingsTab(panel); toast(e.name + ' 已重置为AI评分', 'success');
      } }, '重置AI'));
      row.appendChild(act);
      tbody.appendChild(row);
    });
    table.appendChild(tbody); tableDiv.appendChild(table);
  }
  setTimeout(() => renderRatingTable(), 50);
  
  // ===== Warning Zone =====
  panel.appendChild(h('h4', { style: { margin:'20px 0 8px', fontSize:'15px', color:'#dc2626' } }, '评分预警区'));
  const lowExperts = db.experts.filter(e => e.status !== 'eliminated' && e.scores.overall < 7);
  if (lowExperts.length === 0) {
    const ok = h('div', { style:{ padding:'16px', background:'#f0fdf4', borderRadius:'8px', border:'1px solid #bbf7d0' } });
    ok.appendChild(h('div', { style:{ fontSize:'14px', fontWeight:'600', color:'#059669' } }, '无预警 · 所有专家评分正常'));
    panel.appendChild(ok);
  } else {
    lowExperts.forEach(e => {
      const item = h('div', { style:{ background:'#fffbeb', padding:'14px', borderRadius:'8px', marginBottom:'8px', border:'1px solid #fde68a' } });
      item.appendChild(h('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' } },
        h('strong', {}, e.name + '  综合：' + e.scores.overall.toFixed(1)),
        h('div', { style:{ display:'flex', gap:'6px' } },
          h('button', { className:'btn btn-sm', style:{ background:'#059669', color:'white', fontSize:'11px' }, onclick: () => {
            e.scores.professional = Math.max(e.scores.professional, 7);
            e.scores.overall = 7.0;
            if (!e.subScores) { e.subScores = null; aiScoreExpert(e); }
            recalcExpertFromSubscores(e); saveDB(db); renderRatingsTab(panel);
            toast(e.name + ' 已调整至7分', 'success');
          } }, '调整至7分'),
          h('button', { className:'btn btn-sm', style:{ background:'#d97706', color:'white', fontSize:'11px' }, onclick: () => {
            e.status = 'observation'; e.observationStatus = 'evaluating'; e.observationDate = new Date().toISOString();
            saveDB(db); renderRatingsTab(panel); toast(e.name + ' 已移入观察库', 'success');
          } }, '移入观察库')
        )
      ));
      item.appendChild(h('div', { style:{ fontSize:'12px', color:'var(--text-secondary)', marginTop:'6px' } }, '专业度：' + e.scores.professional + ' | 影响力：' + e.scores.influence));
      const reasons = [];
      if (e.scores.professional < 7) reasons.push('专业度评分偏低（' + e.scores.professional + '），建议核查学历、资质等维度');
      if (e.scores.influence < 7) reasons.push('影响力评分偏低（' + e.scores.influence + '），建议核查荣誉、履历等维度');
      if (reasons.length) {
        const box = h('div', { style:{ marginTop:'8px', padding:'10px', background:'white', borderRadius:'6px' } });
        reasons.forEach(r => { box.appendChild(h('div', { style:{ fontSize:'11px', color:'#92400e', padding:'2px 0' } }, '• ' + r)); });
        item.appendChild(box);
      }
      panel.appendChild(item);
    });
  }
}

function renderSortTab(panel) {
  const db = appState.db;
  panel.innerHTML = '';
  panel.appendChild(h('h3', {}, '排序标签管理'));
  panel.appendChild(h('p', { style: { fontSize:'13px', color:'var(--text-secondary)', marginBottom:'16px' } }, '管理前端展示的排序选项，可新增、编辑或删除排序项。'));
  
  db.sortOptions.forEach((opt, idx) => {
    const item = h('div', { style: { display:'flex', gap:'12px', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)' } });
    item.appendChild(h('span', { style: { fontWeight:'600', minWidth:'80px' } }, opt.name));
    item.appendChild(h('span', { style: { fontSize:'12px', color:'var(--text-muted)' } }, 'ID: ' + opt.id));
    if (idx > 0) {
      item.appendChild(h('button', { className: 'btn btn-danger btn-sm', onclick: () => {
        db.sortOptions.splice(idx, 1);
        saveDB(db);
        renderSortTab(panel);
        toast('已删除排序项', 'success');
      } }, '删除'));
    }
    panel.appendChild(item);
  });
  
  // Add new sort option
  const addDiv = h('div', { style: { marginTop:'16px', display:'flex', gap:'8px', alignItems:'center' } });
  const nameInput = h('input', { placeholder: '排序名称', style: { padding:'8px 12px', border:'1px solid var(--border)', borderRadius:'8px', fontSize:'13px', flex:1 }, id: 'new-sort-name' });
  const idInput = h('input', { placeholder: '排序ID（英文）', style: { padding:'8px 12px', border:'1px solid var(--border)', borderRadius:'8px', fontSize:'13px', flex:1 }, id: 'new-sort-id' });
  addDiv.appendChild(nameInput);
  addDiv.appendChild(idInput);
  addDiv.appendChild(h('button', {
    className: 'btn btn-primary btn-sm',
    onclick: () => {
      const name = document.getElementById('new-sort-name').value.trim();
      const id = document.getElementById('new-sort-id').value.trim();
      if (!name || !id) { toast('请填写完整', 'error'); return; }
      db.sortOptions.push({ id, name });
      saveDB(db);
      renderSortTab(panel);
      toast('排序项已添加', 'success');
    }
  }, '添加'));
  panel.appendChild(addDiv);
}

function renderDashboardTab(panel) {
  const db = appState.db;
  panel.innerHTML = '';
  panel.appendChild(h('h3', {}, '仪表盘管理'));
  panel.appendChild(h('p', { style:{ fontSize:'13px', color:'var(--text-secondary)', marginBottom:'16px' } }, '配置前端仪表盘的展示内容和图表形式，点击图表区域可跳转至对应的管理页面。'));
  
  // Chart config
  const dc = db.dashboardConfig;
  panel.appendChild(h('h4', { style:{ margin:'16px 0 8px', fontSize:'14px' } }, '展示模块设置'));
  
  const moduleSettings = [
    { id: 'fields', name: '领域分布情况', desc: '柱状图展示各适用领域的专家数量分布' },
    { id: 'scoreNumeric', name: '各项评分平均分', desc: '数值卡片展示专业度、影响力、综合评分的加权平均分' },
    { id: 'scoreDist', name: '综合评分专家数量占比', desc: '环形图展示7分及以上专家在各分值区间的数量占比' }
  ];
  
  moduleSettings.forEach(ms => {
    const row = h('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', background:'var(--bg)', borderRadius:'8px', marginBottom:'8px', border:'1px solid var(--border)' } });
    const infoDiv = h('div', {});
    infoDiv.appendChild(h('div', { style:{ fontSize:'13px', fontWeight:'600' } }, ms.name));
    infoDiv.appendChild(h('div', { style:{ fontSize:'11px', color:'var(--text-muted)' } }, ms.desc));
    row.appendChild(infoDiv);
    const showCheckbox = h('input', {
      type: 'checkbox',
      checked: dc.showCharts.includes(ms.id),
      onchange: (e) => {
        if (e.target.checked) {
          if (!dc.showCharts.includes(ms.id)) dc.showCharts.push(ms.id);
        } else {
          dc.showCharts = dc.showCharts.filter(c => c !== ms.id);
        }
        saveDB(db);
        toast(ms.name + '已' + (e.target.checked ? '显示' : '隐藏'), 'success');
      }
    });
    row.appendChild(showCheckbox);
    panel.appendChild(row);
  });
  
  // Bar chart type selector for fields distribution
  panel.appendChild(h('h4', { style:{ margin:'16px 0 8px', fontSize:'14px' } }, '领域分布图表形式'));
  const chartTypeRow = h('div', { style:{ display:'flex', gap:'8px', flexWrap:'wrap' } });
  ['bar', 'horizontalBar'].forEach(type => {
    const btn = h('button', {
      className: 'btn ' + (dc.barChartType === type ? 'btn-primary' : 'btn-secondary') + ' btn-sm',
      onclick: () => {
        dc.barChartType = type;
        saveDB(db);
        renderDashboardTab(panel);
        toast('图表形式已更新', 'success');
      }
    }, type === 'bar' ? '📊 柱状图' : '📊 条状图');
    chartTypeRow.appendChild(btn);
  });
  panel.appendChild(chartTypeRow);
  
  panel.appendChild(h('div', { style:{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px' } }, '环形图和数值展示为固定形式，无需切换。'));
  
  // Data export
  panel.appendChild(h('h4', { style:{ margin:'20px 0 8px', fontSize:'14px' } }, '数据统计导出'));
  const exportRow = h('div', { style:{ display:'flex', gap:'8px', flexWrap:'wrap' } });
  exportRow.appendChild(h('button', { className:'btn btn-primary btn-sm', onclick: () => {
    toast('请使用浏览器截图工具（Ctrl+Shift+S / Cmd+Shift+4）导出图表为图片', '');
  } }, '📸 导出为图片'));
  exportRow.appendChild(h('button', { className:'btn btn-secondary btn-sm', onclick: () => {
    window.print();
  } }, '📄 导出为PDF'));
  exportRow.appendChild(h('button', { className:'btn btn-secondary btn-sm', onclick: () => {
    exportDashboardCSV();
  } }, '📥 导出统计数据CSV'));
  panel.appendChild(exportRow);
  
  // Live preview
  panel.appendChild(h('h4', { style:{ margin:'20px 0 12px', fontSize:'14px' } }, '实时预览'));
  
  const experts = db.experts.filter(e => e.status !== 'eliminated');
  
  const previewGrid = h('div', { className: 'dashboard-grid' });
  
  if (dc.showCharts.includes('fields')) {
    const fc = h('div', { className: 'dashboard-card full' });
    fc.appendChild(h('h4', {}, '领域分布'));
    const fd = h('div', { className: 'chart-container tall', id: 'admin-chart-fields' });
    fc.appendChild(fd);
    previewGrid.appendChild(fc);
  }
  
  if (dc.showCharts.includes('scoreNumeric')) {
    const sc = h('div', { className: 'dashboard-card' });
    sc.appendChild(h('h4', {}, '各项评分平均分'));
    const sd = h('div', { id: 'admin-chart-numeric' });
    sc.appendChild(sd);
    previewGrid.appendChild(sc);
  }
  
  if (dc.showCharts.includes('scoreDist')) {
    const dc2 = h('div', { className: 'dashboard-card' });
    dc2.appendChild(h('h4', {}, '综合评分占比'));
    const dd = h('div', { className: 'chart-container', id: 'admin-chart-dist' });
    dc2.appendChild(dd);
    previewGrid.appendChild(dc2);
  }
  
  panel.appendChild(previewGrid);
  
  setTimeout(() => {
    const fieldChartContainer = document.getElementById('admin-chart-fields');
    if (fieldChartContainer) {
      const fieldCount = {};
      db.fields.forEach(f => { fieldCount[f.name] = 0; });
      experts.forEach(e => { e.fields.forEach(f => { if (fieldCount[f] !== undefined) fieldCount[f]++; }); });
      renderBarChart('admin-chart-fields', Object.keys(fieldCount), Object.values(fieldCount), db.fields.map(f => f.color));
    }
    
    const numericContainer = document.getElementById('admin-chart-numeric');
    if (numericContainer) {
      const profAvg = experts.length ? (experts.reduce((s,e) => s + e.scores.professional, 0) / experts.length).toFixed(1) : '0';
      const inflAvg = experts.length ? (experts.reduce((s,e) => s + e.scores.influence, 0) / experts.length).toFixed(1) : '0';
      const overallAvg = experts.length ? (experts.reduce((s,e) => s + e.scores.overall, 0) / experts.length).toFixed(1) : '0';
      numericContainer.innerHTML = '<div class="score-numeric-grid" style="padding:8px">' +
        '<div class="score-numeric-item"><div class="label">专业度</div><div class="value blue">' + profAvg + '</div></div>' +
        '<div class="score-numeric-item"><div class="label">影响力</div><div class="value amber">' + inflAvg + '</div></div>' +
        '<div class="score-numeric-item"><div class="label">综合评分</div><div class="value green">' + overallAvg + '</div></div>' +
        '</div>';
    }
    
    const distContainer = document.getElementById('admin-chart-dist');
    if (distContainer) {
      const ranges = ['7.0-7.5分', '7.5-8.0分', '8.0-8.5分', '8.5-9.0分', '9.0分以上'];
      const rangeCount = [0,0,0,0,0];
      experts.forEach(e => {
        const s = e.scores.overall;
        if (s < 7.5) rangeCount[0]++;
        else if (s < 8.0) rangeCount[1]++;
        else if (s < 8.5) rangeCount[2]++;
        else if (s < 9.0) rangeCount[3]++;
        else rangeCount[4]++;
      });
      renderDoughnutChart('admin-chart-dist', ranges, rangeCount);
    }
  }, 100);
}

function exportDashboardCSV() {
  const db = appState.db;
  const experts = db.experts.filter(e => e.status !== 'eliminated');
  
  // Field distribution
  const fieldCount = {};
  db.fields.forEach(f => { fieldCount[f.name] = 0; });
  experts.forEach(e => { e.fields.forEach(f => { if (fieldCount[f] !== undefined) fieldCount[f]++; }); });
  
  let csv = '类别,数值\n';
  csv += '--- 领域分布 ---\n';
  Object.entries(fieldCount).forEach(([k,v]) => { csv += k + ',' + v + '\n'; });
  
  const profAvg = (experts.reduce((s,e) => s + e.scores.professional, 0) / experts.length).toFixed(1);
  const inflAvg = (experts.reduce((s,e) => s + e.scores.influence, 0) / experts.length).toFixed(1);
  const overallAvg = (experts.reduce((s,e) => s + e.scores.overall, 0) / experts.length).toFixed(1);
  csv += '\n--- 评分平均分 ---\n';
  csv += '专业度平均分,' + profAvg + '\n';
  csv += '影响力平均分,' + inflAvg + '\n';
  csv += '综合评分平均分,' + overallAvg + '\n';
  
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, '仪表盘统计数据_' + new Date().toISOString().slice(0,10) + '.csv');
  toast('统计CSV已下载', 'success');
}

function renderCategoriesTab(panel) {
  const db = appState.db;
  panel.innerHTML = '';
  panel.appendChild(h('h3', {}, '分类管理'));
  panel.appendChild(h('p', { style: { fontSize:'13px', color:'var(--text-secondary)', marginBottom:'16px' } }, '管理"适用领域"标签的名称、颜色。'));
  
  db.fields.forEach((f, idx) => {
    const item = h('div', { style: { display:'flex', gap:'12px', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--border)', flexWrap:'wrap' } });
    
    // Name
    const nameInput = h('input', { 
      value: f.name, 
      style: { padding:'6px 10px', border:'1px solid var(--border)', borderRadius:'6px', fontSize:'13px', minWidth:'150px', flex:1 },
      onchange: (e) => {
        const oldName = f.name;
        const newName = e.target.value.trim();
        if (!newName) return;
        // Update all experts using this field
        db.experts.forEach(ex => {
          const fi = ex.fields.indexOf(oldName);
          if (fi >= 0) ex.fields[fi] = newName;
        });
        f.name = newName;
        saveDB(db);
      }
    });
    item.appendChild(nameInput);
    
    // Color picker
    const colorInput = h('input', { 
      type: 'color', 
      value: f.color,
      onchange: (e) => {
        f.color = e.target.value;
        saveDB(db);
      }
    });
    item.appendChild(colorInput);
    
    // Preview
    const preview = h('span', { 
      style: { 
        background: f.color, color:'white', padding:'4px 12px', borderRadius:'12px', fontSize:'12px', fontWeight:'500' 
      } 
    }, f.name);
    item.appendChild(preview);
    
    // Delete with batch management
    const deleteBtn = h('button', {
      className: 'btn btn-danger btn-sm',
      onclick: () => {
        const affectedExperts = db.experts.filter(e => e.fields.includes(f.name));
        if (affectedExperts.length > 0) {
          const msg = '有 ' + affectedExperts.length + ' 位专家使用此标签（' + affectedExperts.map(e=>e.name).join('、') + '），确认删除？';
          if (!confirm(msg)) return;
          affectedExperts.forEach(e => {
            e.fields = e.fields.filter(fn => fn !== f.name);
          });
        }
        db.fields.splice(idx, 1);
        updateFieldsList(db);
        saveDB(db);
        renderCategoriesTab(panel);
        toast('标签已删除', 'success');
      }
    }, '删除');
    item.appendChild(deleteBtn);
    
    panel.appendChild(item);
  });
  
  // Add new category
  const addDiv = h('div', { style: { marginTop:'16px', display:'flex', gap:'8px', alignItems:'center' } });
  addDiv.appendChild(h('input', { placeholder:'标签名称', style:{ padding:'8px 12px', border:'1px solid var(--border)', borderRadius:'8px', fontSize:'13px', flex:1 }, id:'new-cat-name' }));
  addDiv.appendChild(h('input', { type:'color', value:'#3B82F6', id:'new-cat-color' }));
  addDiv.appendChild(h('button', { className:'btn btn-primary btn-sm', onclick: () => {
    const name = document.getElementById('new-cat-name').value.trim();
    const color = document.getElementById('new-cat-color').value;
    if (!name) { toast('请输入标签名称', 'error'); return; }
    if (db.fields.some(f => f.name === name)) { toast('标签已存在', 'error'); return; }
    db.fields.push({ name, color });
    db.totalFields = db.fields.length;
    saveDB(db);
    renderCategoriesTab(panel);
    toast('标签已添加', 'success');
  } }, '添加'));
  panel.appendChild(addDiv);
}

function renderObservationTab(panel) {
  const db = appState.db;
  panel.innerHTML = '';
  panel.appendChild(h('h3', {}, '观察库'));
  panel.appendChild(h('p', { style:{ fontSize:'13px', color:'var(--text-secondary)', marginBottom:'16px' } }, '综合评分7分以下或不适合在前端展示的专家。'));
  
  const obsExperts = db.experts.filter(e => e.status === 'observation' || e.observationStatus);
  
  if (obsExperts.length === 0) {
    panel.appendChild(h('p', { style:{ fontSize:'13px', color:'var(--text-muted)' } }, '观察库为空'));
    return;
  }
  
  obsExperts.forEach(expert => {
    const card = h('div', { className: 'observation-card' + (expert.observationStatus === 'eliminated' ? ' eliminated' : '') });
    
    // Status select
    const statusSelect = h('select', {
      style:{ padding:'4px 8px', border:'1px solid var(--border)', borderRadius:'6px', fontSize:'12px' },
      onchange: (ev) => {
        expert.observationStatus = ev.target.value;
        if (ev.target.value === 'eliminated') {
          expert.status = 'eliminated';
          expert.observationDate = new Date().toISOString();
        }
        saveDB(db);
        renderObservationTab(panel);
      }
    });
    const opt1 = h('option', { value:'evaluating' }, '持续评估');
    if (expert.observationStatus === 'evaluating') opt1.selected = true;
    const opt2 = h('option', { value:'eliminated' }, '淘汰');
    if (expert.observationStatus === 'eliminated') opt2.selected = true;
    statusSelect.appendChild(opt1);
    statusSelect.appendChild(opt2);
    
    card.appendChild(h('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' } },
      h('strong', {}, expert.name + '（综合评分：' + expert.scores.overall.toFixed(1) + '）'),
      h('div', { style:{ display:'flex', gap:'6px' } },
        statusSelect,
        h('button', { className:'btn btn-danger btn-sm', onclick: () => {
          if (confirm('确认永久删除' + expert.name + '？')) {
            db.experts = db.experts.filter(ex => ex.id !== expert.id);
            saveDB(db);
            renderObservationTab(panel);
            toast('已删除', 'success');
          }
        } }, '删除')
      )
    ));
    
    card.appendChild(h('div', { style:{ fontSize:'12px', color:'var(--text-secondary)', marginTop:'4px' } },
      '专业度：' + expert.scores.professional + ' | 影响力：' + expert.scores.influence + 
      (expert.observationDate ? ' | 录入日期：' + formatDate(expert.observationDate) : '') +
      (expert.observationStatus === 'eliminated' ? ' | ⚠️ 状态：已淘汰' : ' | 状态：持续评估')
    ));
    
    // 1 year elimination check
    if (expert.observationStatus === 'eliminated' && expert.observationDate) {
      const oneYear = new Date(expert.observationDate);
      oneYear.setFullYear(oneYear.getFullYear() + 1);
      if (new Date() >= oneYear) {
        card.appendChild(h('div', { style:{ marginTop:'8px', padding:'8px', background:'#fef2f2', borderRadius:'6px', fontSize:'12px', color:'#dc2626' } },
          '⏰ 该专家已淘汰超过一年，建议确认是否永久删除。'
        ));
      }
    }
    
    panel.appendChild(card);
  });
}

function renderPermissionsTab(panel) {
  const db = appState.db;
  panel.innerHTML = '';
  panel.appendChild(h('h3', {}, '权限管理'));
  
  // Master admin
  panel.appendChild(h('h4', { style:{ margin:'16px 0 8px', fontSize:'14px' } }, '主管理员'));
  panel.appendChild(h('div', { style:{ padding:'12px', background:'var(--bg)', borderRadius:'8px', marginBottom:'16px' } },
    h('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'center' } },
      h('div', {},
        h('div', { style:{ fontWeight:'600' } }, '主管理员'),
        h('div', { style:{ fontSize:'12px', color:'var(--text-muted)' } }, '全部功能权限（专家管理、合作项目管理、评分管理、排序标签、仪表盘、分类管理、观察库、权限管理、系统设置）')
      ),
      h('button', { className:'btn btn-secondary btn-sm', onclick: () => {
        const newPwd = prompt('请输入新密码（至少6位）：');
        if (newPwd && newPwd.length >= 6) {
          db.permissions.adminPassword = newPwd;
          saveDB(db);
          toast('主管理员密码已更新', 'success');
        } else if (newPwd) {
          toast('密码至少需要6位', 'error');
        }
      } }, '修改密码')
    )
  ));
  
  // Sub admins
  panel.appendChild(h('h4', { style:{ margin:'16px 0 8px', fontSize:'14px' } }, '子管理员'));
  panel.appendChild(h('p', { style:{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'8px' } },
    '子管理员默认拥有：专家导入/导出/新增/编辑、分类标签新增、具体专家评分调整。可以在此调整各权限开关。'));
  
  // Permission descriptions
  const permDefs = [
    { key: 'expertView', name: '专家查看', desc: '查看专家列表和详情' },
    { key: 'expertAdd', name: '新增专家', desc: '创建新的专家记录' },
    { key: 'expertEdit', name: '编辑专家', desc: '修改已有专家信息' },
    { key: 'expertDelete', name: '删除专家', desc: '删除专家记录' },
    { key: 'expertImport', name: '导入专家', desc: '批量导入专家数据' },
    { key: 'expertExport', name: '导出专家', desc: '导出专家数据为文件' },
    { key: 'expertScore', name: '评分调整', desc: '手动调整专家评分' },
    { key: 'categoryManage', name: '分类管理', desc: '新增/编辑/删除适用领域' },
    { key: 'dashboardManage', name: '仪表盘', desc: '查看和管理仪表盘' },
    { key: 'projectsManage', name: '合作项目管理', desc: '新增/编辑/删除合作项目记录' },
    { key: 'observationManage', name: '观察库', desc: '管理观察中的专家' },
    { key: 'sortManage', name: '排序标签', desc: '管理排序选项（通常关闭）' },
    { key: 'ratingManage', name: '评分管理', desc: '修改评分体系和权重（仅主管理员）' },
    { key: 'permissionManage', name: '权限管理', desc: '管理子管理员和权限（仅主管理员）' },
    { key: 'systemSettings', name: '系统设置', desc: '系统配置和数据重置（仅主管理员）' }
  ];
  
  const userList = h('div', { style:{ marginTop:'12px' } });
  
  if (db.permissions.users.length === 0) {
    userList.appendChild(h('p', { style:{ fontSize:'13px', color:'var(--text-muted)', padding:'12px' } }, '暂无子管理员'));
  }
  
  db.permissions.users.forEach((user, idx) => {
    // Ensure user has permissions
    if (!user.permissions) user.permissions = getDefaultSubPermissions();
    
    const item = h('div', { style:{ padding:'16px', background:'var(--bg)', borderRadius:'8px', marginBottom:'12px', border:'1px solid var(--border)' } });
    
    // User header
    const userHeader = h('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' } });
    userHeader.appendChild(h('div', {},
      h('div', { style:{ fontWeight:'600', fontSize:'14px' } }, user.name || '未命名'),
      h('div', { style:{ fontSize:'12px', color:'var(--text-muted)' } }, '账号：' + user.account + (user.binding ? ' | 已绑定：' + user.binding : ' | 未绑定'))
    ));
    userHeader.appendChild(h('button', { className:'btn btn-danger btn-sm', onclick: () => {
      if (confirm('确认删除子管理员「' + (user.name || user.account) + '」？')) {
        db.permissions.users.splice(idx, 1);
        saveDB(db);
        renderPermissionsTab(panel);
        toast('已删除子管理员', 'success');
      }
    } }, '删除'));
    item.appendChild(userHeader);
    
    // Permissions grid
    const permGrid = h('div', { style:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px' } });
    permDefs.forEach(pd => {
      const row = h('label', { style:{ display:'flex', alignItems:'center', gap:'6px', padding:'4px 6px', fontSize:'12px', borderRadius:'4px', cursor:'pointer' } });
      const cb = h('input', {
        type: 'checkbox',
        checked: !!user.permissions[pd.key],
        onchange: (e) => {
          user.permissions[pd.key] = e.target.checked;
          saveDB(db);
        }
      });
      row.appendChild(cb);
      row.appendChild(h('span', { style:{ color:'var(--text)' } }, pd.name));
      row.appendChild(h('span', { style:{ color:'var(--text-muted)', fontSize:'10px', flex:'1', textAlign:'right' } }, pd.desc));
      permGrid.appendChild(row);
    });
    item.appendChild(permGrid);
    userList.appendChild(item);
  });
  
  panel.appendChild(userList);
  
  // Generate new sub admin
  const genDiv = h('div', { style:{ marginTop:'16px', padding:'12px', background:'var(--bg)', borderRadius:'8px' } });
  genDiv.appendChild(h('button', {
    className: 'btn btn-primary btn-sm',
    onclick: () => {
      const name = prompt('请输入子管理员名称（可选）：') || '';
      const account = 'sub' + Math.random().toString(36).substring(2, 8);
      const password = Math.random().toString(36).substring(2, 10);
      const user = { account, password, name, binding: '', createdAt: new Date().toISOString(), permissions: getDefaultSubPermissions() };
      db.permissions.users.push(user);
      saveDB(db);
      renderPermissionsTab(panel);
      alert('子管理员账号已生成：\n账号：' + account + '\n密码：' + password + '\n\n请妥善保管，分享给对应子管理员。');
    }
  }, '+ 生成子管理员账号'));
  genDiv.appendChild(h('span', { style:{ fontSize:'12px', color:'var(--text-muted)', marginLeft:'8px' } }, '生成账号和随机密码，默认赋予基础编辑权限'));
  panel.appendChild(genDiv);
  
  // Share settings
  panel.appendChild(h('h4', { style:{ margin:'16px 0 8px', fontSize:'14px' } }, '链接分享设置'));
  panel.appendChild(h('div', { style:{ display:'flex', gap:'12px', alignItems:'center' } },
    h('span', { style:{ fontSize:'13px' } }, '允许分享链接：'),
    h('input', { type:'checkbox', checked: db.permissions.shareSettings.linkActive, onchange: (e) => {
      db.permissions.shareSettings.linkActive = e.target.checked;
      saveDB(db);
    } }),
    h('span', { style:{ fontSize:'13px', marginLeft:'12px' } }, '需要登录验证：'),
    h('input', { type:'checkbox', checked: db.permissions.shareSettings.requireLogin, onchange: (e) => {
      db.permissions.shareSettings.requireLogin = e.target.checked;
      saveDB(db);
    } })
  ));
}

function renderSettingsTab(panel) {
  panel.innerHTML = '';
  panel.appendChild(h('h3', {}, '系统设置'));
  const db = appState.db;
  
  // ===== Data Sync from Tencent Docs =====
  panel.appendChild(h('h4', { style:{ margin:'16px 0 8px', fontSize:'14px' } }, '数据源管理'));
  panel.appendChild(h('p', { style:{ fontSize:'13px', color:'var(--text-secondary)', marginBottom:'12px' } }, '从腾讯文档源数据更新专家库。更新不会覆盖已有数据，重复项将由管理员确认处理。'));
  
  // Tencent Docs link input
  const linkRow = h('div', { style:{ display:'flex', gap:'8px', alignItems:'center', marginBottom:'12px' } });
  const linkInput = h('input', {
    type: 'text',
    placeholder: '粘贴腾讯文档分享链接...',
    value: db.sourceDocLink || '',
    style: { flex:1, padding:'8px 12px', border:'1px solid var(--border)', borderRadius:'8px', fontSize:'13px' },
    id: 'settings-source-link'
  });
  linkRow.appendChild(h('span', { style:{ fontSize:'13px', color:'var(--text-secondary)', whiteSpace:'nowrap' } }, '源文档链接：'));
  linkRow.appendChild(linkInput);
  panel.appendChild(linkRow);

  // Save link button
  panel.appendChild(h('button', {
    className: 'btn btn-secondary btn-sm',
    style: { marginBottom:'12px' },
    onclick: () => {
      const link = document.getElementById('settings-source-link').value.trim();
      db.sourceDocLink = link;
      saveDB(db);
      toast('源文档链接已保存', 'success');
    }
  }, '保存链接'));

  // ===== Current data source link display (read-only, shows latest link) =====
  const currentLinkRow = h('div', { style:{ background:'var(--primary-light)', padding:'12px 16px', borderRadius:'8px', marginBottom:'16px', border:'1px solid #93c5fd' } });
  currentLinkRow.appendChild(h('div', { style:{ fontSize:'13px', fontWeight:'600', color:'var(--primary)', marginBottom:'6px' } }, '📎 当前数据源链接'));
  currentLinkRow.appendChild(h('a', {
    href: 'https://docs.qq.com/sheet/DTUROVmZod2FxSGFO?tab=BB08J2',
    target: '_blank',
    style: { fontSize:'12px', color:'var(--primary)', wordBreak:'break-all', lineHeight:'1.6', textDecoration:'underline' }
  }, 'https://docs.qq.com/sheet/DTUROVmZod2FxSGFO?tab=BB08J2'));
  currentLinkRow.appendChild(h('div', { style:{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px' } }, '主管理员最新更新的线上文档链接，点击可在新窗口打开'));
  panel.appendChild(currentLinkRow);
  
  // Manual data update via CSV paste
  panel.appendChild(h('h5', { style:{ margin:'16px 0 6px', fontSize:'13px' } }, '手动同步数据'));
  panel.appendChild(h('p', { style:{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'8px' } }, '从腾讯文档导出为CSV，粘贴到下方进行更新。更新不覆盖已有数据，自动检测重复并提示。'));
  
  const syncTextarea = h('textarea', {
    placeholder: '粘贴腾讯文档导出的CSV数据...\n\n格式要求：第一行为列名（姓名、适用领域、学历、资历资质、课程/案例、联系人、联系方式、内部推荐人），后续每行为一条专家数据。',
    style: { width:'100%', minHeight:'120px', padding:'10px', border:'1px solid var(--border)', borderRadius:'8px', fontSize:'12px', fontFamily:'monospace' },
    id: 'settings-sync-csv'
  });
  panel.appendChild(syncTextarea);
  
  const syncBtns = h('div', { style:{ display:'flex', gap:'8px', marginTop:'8px' } });
  syncBtns.appendChild(h('button', {
    className: 'btn btn-primary btn-sm',
    onclick: () => {
      const csv = document.getElementById('settings-sync-csv').value.trim();
      if (!csv) { toast('请粘贴CSV数据', 'error'); return; }
      const newExperts = parseCSVToExperts(csv);
      if (newExperts.length === 0) { toast('未解析到有效数据', 'error'); return; }
      
      // Check for duplicates
      const duplicates = [];
      const newOnes = [];
      newExperts.forEach(ne => {
        const match = db.experts.find(ee => ee.name.toLowerCase() === (ne.name || '').toLowerCase());
        if (match) duplicates.push({ existing: match, incoming: ne });
        else newOnes.push(ne);
      });
      
      if (duplicates.length > 0) {
        // Confirm with admin
        let dupMsg = '发现 ' + duplicates.length + ' 条重复数据：\n';
        duplicates.forEach((d, i) => {
          dupMsg += '\n#' + (i+1) + ' ' + d.incoming.name + '（已有记录）';
        });
        dupMsg += '\n\n新数据 ' + newOnes.length + ' 条将直接导入。\n重复项处理方式：\n• 输入 "yes" = 覆盖所有重复项\n• 输入 "no" = 跳过所有重复项\n• 直接取消 = 不执行任何操作';
        
        const action = prompt(dupMsg, 'no');
        if (action === null) { toast('已取消同步', ''); return; }
        if (action.toLowerCase() === 'yes') {
          duplicates.forEach(d => {
            const idx = db.experts.findIndex(e => e.id === d.existing.id);
            if (idx >= 0) {
              const updated = { ...d.incoming, id: d.existing.id, createdAt: d.existing.createdAt, createdBy: d.existing.createdBy };
              db.experts[idx] = updated;
            }
          });
        }
        // Add new ones
        addNewExpertsSimple(newOnes, db);
        db.updateTime = new Date().toISOString();
        saveDB(db);
        renderSettingsTab(panel);
        toast('同步完成：新增 ' + newOnes.length + ' 位' + (action.toLowerCase() === 'yes' ? '，覆盖 ' + duplicates.length + ' 位' : ''), 'success');
      } else {
        addNewExpertsSimple(newOnes, db);
        db.updateTime = new Date().toISOString();
        saveDB(db);
        renderSettingsTab(panel);
        toast('同步完成：新增 ' + newOnes.length + ' 位专家', 'success');
      }
    }
  }, '同步数据（不覆盖已有）'));
  
  syncBtns.appendChild(h('button', {
    className: 'btn btn-sm',
    style: { background:'#fef3c7', color:'#92400e', border:'1px solid #fbbf24' },
    onclick: () => {
      const csv = document.getElementById('settings-sync-csv').value.trim();
      if (!csv) { toast('请粘贴CSV数据', 'error'); return; }
      const newExperts = parseCSVToExperts(csv);
      if (newExperts.length === 0) { toast('未解析到有效数据', 'error'); return; }
      if (!confirm('将导入全部 ' + newExperts.length + ' 条数据到观察库（不查重），确认？')) return;
      newExperts.forEach(ne => {
        const maxId = db.experts.reduce((m, e) => Math.max(m, e.id), 0);
        db.experts.push({
          id: maxId + 1, name: ne.name || '未命名', fields: ne.fields || [],
          education: ne.education || '', qualifications: ne.qualifications || '',
          courses: ne.courses || '', contactPerson: ne.contactPerson || '',
          contactInfo: ne.contactInfo || '', referrer: ne.referrer || '',
          advantages: [], scores: { professional: 5, influence: 5, overall: 5 },
          status: 'observation', observationStatus: 'evaluating',
          observationDate: new Date().toISOString(),
          createdAt: new Date().toISOString(), createdBy: '系统同步'
        });
        maxId++;
      });
      updateFieldsList(db);
      db.updateTime = new Date().toISOString();
      saveDB(db);
      renderSettingsTab(panel);
      toast('已导入 ' + newExperts.length + ' 条至观察库', 'success');
    }
  }, '导入至观察库（不查重）'));
  panel.appendChild(syncBtns);
  
  function addNewExpertsSimple(experts, db) {
    const maxId = db.experts.reduce((m, e) => Math.max(m, e.id), 0);
    experts.forEach((ne, i) => {
      const e = {
        id: maxId + i + 1, name: ne.name || '未命名',
        fields: Array.isArray(ne.fields) ? ne.fields : (ne.fields ? ne.fields.split(/[,，]/).map(f => f.trim()).filter(Boolean) : []),
        education: ne.education || '', qualifications: ne.qualifications || '',
        courses: ne.courses || '', contactPerson: ne.contactPerson || '',
        contactInfo: ne.contactInfo || '', contactType: detectContactType(ne.contactInfo || ''),
        referrer: ne.referrer || '', advantages: [],
        scores: { professional: 5, influence: 5, overall: 5 },
        status: 'active', createdAt: new Date().toISOString(), createdBy: '数据同步'
      };
      e.subScores = null; aiScoreExpert(e);
      const cfg = db.ratingConfig;
      const profDim = cfg.dimensions.find(d => d.id === 'professional');
      const inflDim = cfg.dimensions.find(d => d.id === 'influence');
      let p = 0, inf = 0;
      if (profDim && profDim.subDimensions) profDim.subDimensions.forEach(sd => { p += (e.subScores.professional[sd.name] || 5) * sd.weight; });
      if (inflDim && inflDim.subDimensions) inflDim.subDimensions.forEach(sd => { inf += (e.subScores.influence[sd.name] || 5) * sd.weight; });
      e.scores.professional = Math.round(p * 10) / 10;
      e.scores.influence = Math.round(inf * 10) / 10;
      e.scores.overall = Math.round((e.scores.professional * profDim.weight + e.scores.influence * inflDim.weight) * 10) / 10;
      e.status = 'active';
      db.experts.push(e);
    });
    updateFieldsList(db);
  }
  
  function parseCSVToExperts(csvText) {
    const lines = csvText.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const header = lines[0].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(h => h.replace(/^"|"$/g, '').trim());
    const nameIdx = header.findIndex(h => h === '姓名' || h.toLowerCase() === 'name');
    if (nameIdx < 0) return [];
    const experts = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(v => v.replace(/^"|"$/g, '').trim());
      if (!vals[nameIdx]) continue;
      const expert = { name: vals[nameIdx], fields: [], education: '', qualifications: '', courses: '', contactPerson: '', contactInfo: '', contactType: 'phone', contacts: [], referrer: '' };
      header.forEach((h, idx) => {
        const val = vals[idx] || '';
        if (h === '适用领域') expert.fields = val.split(/[,，、]/).map(f => f.trim()).filter(Boolean);
        else if (h === '学历') expert.education = val;
        else if (h === '资历资质') expert.qualifications = val;
        else if (h === '参考案例' || h === '课程/案例') expert.courses = val;
        else if (h === '联系人') expert.contactPerson = val;
        else if (h === '联系方式') expert.contactInfo = val;
        else if (h === '内部推荐人') expert.referrer = val;
      });
      experts.push(expert);
    }
    return experts;
  }
  
  // ===== UI Settings =====
  panel.appendChild(h('h4', { style:{ margin:'20px 0 8px', fontSize:'14px' } }, '界面设置'));
  panel.appendChild(h('p', { style:{ fontSize:'13px', color:'var(--text-secondary)', marginBottom:'12px' } }, '调整前端界面的标题名称与配色方案，修改后即时预览。'));
  
  const uiCard = h('div', { style:{ background:'var(--bg)', padding:'16px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' } });
  
  // Main title
  const titleRow = h('div', { style:{ marginBottom:'14px' } });
  titleRow.appendChild(h('div', { style:{ fontSize:'13px', fontWeight:'600', marginBottom:'4px' } }, '主标题名称'));
  const titleInput = h('input', {
    type: 'text',
    value: (db.uiConfig && db.uiConfig.mainTitle) || DEFAULT_UI_CONFIG.mainTitle,
    style: { width:'100%', padding:'8px 12px', border:'1px solid var(--border)', borderRadius:'8px', fontSize:'14px', fontFamily:'inherit' },
    placeholder: '输入主标题...',
    id: 'ui-title-input'
  });
  titleRow.appendChild(titleInput);
  uiCard.appendChild(titleRow);
  
  // Color scheme selector
  const colorRow = h('div', { style:{ marginBottom:'14px' } });
  colorRow.appendChild(h('div', { style:{ fontSize:'13px', fontWeight:'600', marginBottom:'8px' } }, '配色方案'));
  const schemeGrid = h('div', { style:{ display:'flex', gap:'10px', flexWrap:'wrap' } });
  
  const currentScheme = (db.uiConfig && db.uiConfig.colorScheme) || 'default';
  Object.entries(COLOR_SCHEMES).forEach(([key, scheme]) => {
    const schemeBtn = h('div', {
      style: {
        display:'flex', flexDirection:'column', alignItems:'center', gap:'6px',
        padding:'10px 16px', borderRadius:'10px', cursor:'pointer',
        border: (currentScheme === key ? '2px solid var(--primary)' : '2px solid var(--border)'),
        background: currentScheme === key ? 'var(--primary-light)' : '#fff',
        transition:'all 0.2s'
      },
      onclick: () => {
        if (!db.uiConfig) db.uiConfig = JSON.parse(JSON.stringify(DEFAULT_UI_CONFIG));
        db.uiConfig.colorScheme = key;
        saveDB(db);
        applyUiConfig(db.uiConfig);
        renderSettingsTab(panel);
        toast('配色方案已更新为「' + scheme.name + '」', 'success');
      }
    });
    // Color preview dots
    const preview = h('div', { style:{ display:'flex', gap:'4px' } });
    [scheme.primary, scheme.accent, scheme.primaryLight].forEach(c => {
      preview.appendChild(h('span', {
        style: { display:'inline-block', width:'16px', height:'16px', borderRadius:'50%', background:c, border:'1px solid rgba(0,0,0,0.1)' }
      }));
    });
    schemeBtn.appendChild(preview);
    schemeBtn.appendChild(h('span', { style:{ fontSize:'12px', fontWeight: currentScheme === key ? '700' : '400', color:'var(--text)' } }, scheme.name));
    schemeGrid.appendChild(schemeBtn);
  });
  colorRow.appendChild(schemeGrid);
  uiCard.appendChild(colorRow);
  
  // Save & preview button
  const uiBtns = h('div', { style:{ display:'flex', gap:'8px' } });
  uiBtns.appendChild(h('button', {
    className: 'btn btn-primary btn-sm',
    onclick: () => {
      const newTitle = document.getElementById('ui-title-input').value.trim();
      if (!newTitle) { toast('主标题不能为空', 'error'); return; }
      if (!db.uiConfig) db.uiConfig = JSON.parse(JSON.stringify(DEFAULT_UI_CONFIG));
      db.uiConfig.mainTitle = newTitle;
      saveDB(db);
      applyUiConfig(db.uiConfig);
      toast('主标题已更新', 'success');
    }
  }, '保存并应用'));
  uiBtns.appendChild(h('button', {
    className: 'btn btn-sm',
    style:{ background:'#f3f4f6', color:'var(--text-secondary)' },
    onclick: () => {
      db.uiConfig = JSON.parse(JSON.stringify(DEFAULT_UI_CONFIG));
      saveDB(db);
      applyUiConfig(db.uiConfig);
      renderSettingsTab(panel);
      toast('界面设置已恢复默认', 'success');
    }
  }, '恢复默认'));
  uiCard.appendChild(uiBtns);
  panel.appendChild(uiCard);
  
  // ===== Update time ====="
  panel.appendChild(h('h4', { style:{ margin:'20px 0 8px', fontSize:'14px' } }, '数据更新时间'));
  const timeDiv = h('div', { style:{ display:'flex', gap:'8px', alignItems:'center' } });
  timeDiv.appendChild(h('span', { style:{ fontSize:'13px', color:'var(--text-secondary)' } }, '当前：' + formatDate(db.updateTime)));
  timeDiv.appendChild(h('button', { className:'btn btn-secondary btn-sm', onclick: () => {
    db.updateTime = new Date().toISOString();
    saveDB(db);
    renderSettingsTab(panel);
    toast('更新时间已刷新', 'success');
  } }, '刷新'));
  panel.appendChild(timeDiv);
  
  // ===== Dangerous operations =====
  panel.appendChild(h('h4', { style:{ margin:'20px 0 8px', fontSize:'14px', color:'var(--danger)' } }, '危险操作'));
  panel.appendChild(h('button', { className:'btn btn-danger', onclick: () => {
    if (confirm('确认重置所有数据到初始状态？此操作不可恢复！')) {
      if (confirm('再次确认：所有修改将丢失！')) {
        localStorage.removeItem(isTestMode() ? TEST_STORAGE_KEY : STORAGE_KEY);
        initState();
        renderAdmin();
        toast('数据已重置', 'success');
      }
    }
  } }, '重置所有数据'));
  
  // Share info
  panel.appendChild(h('h4', { style:{ margin:'20px 0 8px', fontSize:'14px' } }, '分享与部署'));
  panel.appendChild(h('p', { style:{ fontSize:'13px', color:'var(--text-secondary)', marginBottom:'8px' } }, '本系统为纯前端应用。分享方式：'));
  panel.appendChild(h('div', { style:{ fontSize:'13px', color:'var(--text)', lineHeight:'2' } },
    h('div', {}, '1. 将项目文件夹压缩发送给其他用户'),
    h('div', {}, '2. 部署到静态服务器（Nginx、GitHub Pages 等）'),
    h('div', {}, '3. 通过局域网文件共享访问 index.html')
  ));
}
// ===== 系统文档 (v4.11 — 主管理员可见) =====
function renderDocsTab(panel) {
  panel.innerHTML = '';
  panel.appendChild(h('h3', {}, '📋 系统文档'));

  const docs = [
    {
      icon: '📊',
      title: '版本更新进度管理表',
      desc: '所有功能需求的优先级、排期、完成状态追踪',
      url: 'https://docs.qq.com/smartsheet/DTVJIWmh2ZXdBUE14?tab=t00i2h&_fid=DTVJIWmh2ZXdBUE14',
      label: '打开进度表'
    },
    {
      icon: '📁',
      title: '初始化源数据表',
      desc: '专家资源库初始数据来源（腾讯文档）',
      url: 'https://docs.qq.com/sheet/DTUROVmZod2FxSGFO?tab=n99xou&_fid=DTUROVmZod2FxSGFO',
      label: '打开源数据表'
    }
  ];

  docs.forEach(function(doc) {
    var card = h('div', {
      style: {
        background: '#fff',
        borderRadius: '10px',
        padding: '20px 24px',
        marginBottom: '12px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        border: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }
    });

    var icon = h('div', {
      style: {
        fontSize: '28px',
        width: '48px',
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f7ff',
        borderRadius: '10px',
        flexShrink: 0
      }
    }, doc.icon);

    var body = h('div', { style: { flex: 1 } },
      h('div', { style: { fontSize: '15px', fontWeight: 600, marginBottom: '4px', color: '#1e293b' } }, doc.title),
      h('div', { style: { fontSize: '13px', color: '#94a3b8', marginBottom: '8px' } }, doc.desc),
      h('a', {
        href: doc.url,
        target: '_blank',
        rel: 'noopener',
        style: {
          display: 'inline-block',
          fontSize: '13px',
          color: doc.disabled ? '#cbd5e1' : '#2563EB',
          textDecoration: 'none',
          cursor: doc.disabled ? 'not-allowed' : 'pointer',
          padding: '4px 12px',
          border: '1px solid ' + (doc.disabled ? '#e2e8f0' : '#2563EB'),
          borderRadius: '6px'
        },
        onclick: doc.disabled ? function(e) { e.preventDefault(); } : null
      }, doc.label)
    );

    card.appendChild(icon);
    card.appendChild(body);
    panel.appendChild(card);
  });

  // 底部提示
  panel.appendChild(h('p', {
    style: {
      fontSize: '12px',
      color: '#94a3b8',
      marginTop: '20px',
      padding: '12px 16px',
      background: '#f8fafc',
      borderRadius: '8px',
      border: '1px dashed #e2e8f0',
      lineHeight: 1.8
    }
  },
    h('span', { style: { fontWeight: 600, color: '#64748b' } }, '💡 提示：'),
    ' 此面板仅主管理员可见。如需补充源数据链接，请联系系统负责人更新。未来可扩展添加部署SOP、功能说明文档等。'
  ));
}

// ===== INIT (v4.0 — async Supabase load with timeout) =====
async function boot() {
  var app = document.getElementById('app');
  function showError(msg, detail) {
    app.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-size:14px;color:#ef4444;flex-direction:column;padding:20px;text-align:center;"><div style="font-size:48px;margin-bottom:16px;">⚠️</div><div style="margin-bottom:8px;font-weight:bold;">' + msg + '</div><div style="font-size:11px;color:#94a3b8;margin-bottom:8px;max-width:500px;word-break:break-all;">' + detail + '</div><div style="font-size:10px;color:#cbd5e1;margin-bottom:16px;">DEBUG: supabase=' + (typeof supabase === 'undefined' ? 'undefined' : (supabase === null ? 'null' : 'ok')) + ' | EXPERT_DATA=' + (typeof EXPERT_DATA === 'undefined' ? 'undefined' : 'ok') + '</div><button onclick="location.reload()" style="padding:8px 20px;background:#2563EB;color:#fff;border:none;border-radius:6px;cursor:pointer;">重新加载</button></div>';
  }
  
  try {
    // Step 1: init state
    initState();
    
    // Step 2: show loading
    app.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-size:16px;color:#64748b;"><div style="text-align:center;"><div style="font-size:40px;margin-bottom:12px;">⏳</div><div>正在加载专家资源库...</div></div></div>';
    
    // Step 3: load data with timeout
    try {
      appState.db = await Promise.race([
        getDB(),
        new Promise(function(resolve) {
          setTimeout(function() {
            console.warn('Supabase timeout, falling back');
            resolve(loadFromLocalOrFallback());
          }, 5000);
        })
      ]);
    } catch(dbErr) {
      // getDB() and timeout both failed - force fallback
      console.error('DB load failed:', dbErr);
      appState.db = loadFromLocalOrFallback();
    }
    
    if (!appState.db || !appState.db.experts) {
      throw new Error('DB object invalid after load');
    }
    
    // Step 4: render
    renderFrontend();
  } catch(e) {
    console.error('Boot failed:', e, e.stack);
    showError('页面加载失败', (e && e.message) || '未知错误');
  }
}

document.addEventListener('DOMContentLoaded', boot);
