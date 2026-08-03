/* ===== 伊利集团·数智化赋能优质专家资源库 - 主应用 ===== */
/* Version 5.7.0 | 2026-07-24 | 修复fields数据丢失bug(并集合并)+子管理员密码管理+主管理员重置密码 */

// 前端版本标记 - 打开控制台（F12）可查看当前加载版本
console.log('%c[专家资源库 v5.7.0] 加载时间: ' + new Date().toLocaleString() + ' | Supabase Cloud | EdgeOne Pages', 'color:#059669;font-weight:700;font-size:13px;');

// v4.0 兜底声明 — 确保 supabase.js 的全局变量在任何情况下都可用
if (typeof currentUser === 'undefined') var currentUser = null;
if (typeof isAdmin === 'undefined') var isAdmin = false;

// ===== DATA STORE =====
const STORAGE_KEY = 'yili_expert_db';
const ADMIN_KEY = 'yili_admin_config';
const FAVORITES_KEY = 'yili_expert_favorites';

// ===== v4.19: 搜索历史 =====
const SEARCH_HISTORY_KEY = 'yili_search_history';
const MAX_SEARCH_HISTORY = 5;

function getSearchHistory() {
  try {
    return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveSearchHistory(query) {
  if (!query || !query.trim()) return;
  var q = query.trim();
  var history = getSearchHistory();
  // Remove duplicate if exists
  history = history.filter(function(h) { return h.toLowerCase() !== q.toLowerCase(); });
  // Add to front
  history.unshift(q);
  // Keep max
  if (history.length > MAX_SEARCH_HISTORY) history = history.slice(0, MAX_SEARCH_HISTORY);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

function removeSearchHistoryItem(query) {
  var history = getSearchHistory();
  history = history.filter(function(h) { return h !== query; });
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

function clearSearchHistory() {
  localStorage.removeItem(SEARCH_HISTORY_KEY);
}

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
        return ensureMinimalConfig(parsed);
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
  seedDb.dashboardConfig = seedDb.dashboardConfig || { chartType: 'doughnut', showCharts: ['fields', 'scoreNumeric'], barChartType: 'bar' };
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
  configVersion: 3, // v5.8.9: 评分规则10分制重构（缺失5.0/硬封顶10/权重60-40/五子维度新标准）
  missingScore: 5, // 信息缺失(为空/未公开/模糊)统一默认分，五维度一致
  cap: 10,         // 子维度得分硬封顶
  dimensions: [
    {
      id: 'professional', name: '专业度', weight: 0.6,
      desc: '评估专家的学历背景、行业资质及专业成果',
      subDimensions: [
        {
          name: '学历与学术背景', weight: 0.35, maxScore: 10, missingScore: 5, cap: 10,
          criteria: '维度1主锚=学历层次×院校T0-T4矩阵定base；维度2=院校实力+院系权威±0.3(封顶±0.5)；维度3=多学位/跨学科复合+0.3~1.0(封顶+1.0)。缺失固定5.0。1-10全覆盖。',
          scoring: {
            type: 'matrix',
            dimension1: { label: '学历层次（主锚·行）', levels: { '博士': 9.5, '硕士': 8.5, '本科': 8.0, '专升本': 5.0, '专科': 4.0, '高中/中专': 2.5, '初中': 2.0, '小学及以下': 1.0, '信息缺失': 5.0 } },
            dimension2: {
              label: '院校实力（主锚·列 T0-T4）+ 院系权威微调',
              tiers: { 'T0 全球顶尖(含清北/QS·THE·ARWU前50等)': 0.0, 'T1 国内顶尖(985/双一流)': -0.5, 'T2 国内重点(211/双一流学科)': -1.0, 'T3 普通院校': -1.5, 'T4 其他/无法核实': -2.5 },
              deptAuthority: '院系权威微调 ±0.3，封顶 ±0.5（A+学科+0.3 / 继续教育学院-0.3）'
            },
            dimension3: {
              label: '学位权威性（额外加分·封顶+1.0）',
              rules: [
                { cond: '第二有效学位（院校层级≥第一学位）', add: 0.3 },
                { cond: '第二学位为跨学科/复合型', add: 0.3 },
                { cond: '第三有效学位（同条件）', add: 0.2 }
              ],
              cap: 1.0, dynamicCapNote: '动态封顶 = 10 - base - 维度2'
            },
            note: 'base=学历基线+院校tier偏移；专升本上限5.0（T0-T1=5.0，T2-T4=4.5）；水硕T4-0.5；自考本科=本科T4=6.0；专科3.0-4.0（优质4.0/普通3.5/成人自考3.0）。博士后不计入学历（归专业成果·科研经历）。'
          }
        },
        {
          name: '行业资质与认证', weight: 0.30, maxScore: 10, missingScore: 5, cap: 10,
          criteria: '维度1主锚=认证层级 A0国际顶级9 / A1国家级执业8 / A2行业厂商6 / A3培训通用4；维度2=跨领域广度+0.3~0.5(封顶+0.5)；维度3=稀缺/强相关加分+0.5~1.0(封顶+1.0，PMP等国际管理认证归此)。缺失固定5.0。',
          scoring: {
            type: 'tier',
            lowTierPending: true,
            dimension1: { label: '认证层级（主锚）', tiers: { 'A0 国际权威认证(如CFA/CPA/ACCA/国家级执业资格)': 9.0, 'A1 国家级执业/行业权威认证': 8.0, 'A2 行业厂商认证(华为/微软等)': 6.0, 'A3 培训/通用认证': 4.0, '信息缺失': 5.0 } },
            dimension2: { label: '跨领域广度', rules: [ { cond: '≥2个不相关领域有效认证', add: 0.3 }, { cond: '≥3个不相关领域有效认证', add: 0.5 } ], cap: 0.5 },
            dimension3: { label: '稀缺/强相关（额外加分·封顶+1.0）', rules: [ { cond: '双A0/A1级认证', add: 0.5 }, { cond: 'PMP等国际管理认证(授课技能项)', add: 0.5 }, { cond: '与主领域强相关且稀缺', add: 0.5 } ], cap: 1.0, dynamicCapNote: '动态封顶 = 10 - base - 维度2' },
            note: '主锚取最高不累计；成就类维度1-3档位待定（当前地面4.0）。'
          }
        },
        {
          name: '专业成果与经验', weight: 0.35, maxScore: 10, missingScore: 5, cap: 10,
          criteria: '维度1主锚=学术路径(A0顶刊9/A1 SCI 8/A2普通6/A3仅演讲4) 与 企业路径(B0战略9/B1省级8/B2参与6/B3一般4) 取高不累计；维度2=持续性/数量+0.3~0.5(封顶+0.5)；维度3=高影响力+0.5~1.0(封顶+1.0，含正规博士后科研经历+0.5)。缺失固定5.0。',
          scoring: {
            type: 'dual-path',
            lowTierPending: true,
            dimension1: {
              label: '学术路径 vs 企业路径（取高不累计）',
              academic: { 'A0 顶刊/高被引/著作专利': 9.0, 'A1 SCI/EI/核心论文': 8.0, 'A2 普通论文/课题': 6.0, 'A3 仅公开演讲': 4.0 },
              enterprise: { 'B0 战略级主持/国家级项目': 9.0, 'B1 省级/行业级项目': 8.0, 'B2 参与级项目': 6.0, 'B3 一般服务': 4.0 }
            },
            dimension2: { label: '持续性/数量', rules: [ { cond: 'H-index≥15 或 授课≥50场', add: 0.3 }, { cond: 'H-index≥25 或 授课≥100场', add: 0.5 } ], cap: 0.5 },
            dimension3: { label: '高影响力（额外加分·封顶+1.0）', rules: [ { cond: '顶刊/高被引论文', add: 0.5 }, { cond: '牵头国标/行标', add: 0.5 }, { cond: '正规博士后科研经历', add: 0.5 } ], cap: 1.0, dynamicCapNote: '动态封顶 = 10 - base - 维度2' },
            note: 'base取整数(9/8/6/4)；学术A0与企业B0同9.0；博士后科研经历归此维度(重量参照院士)。'
          }
        }
      ]
    },
    {
      id: 'influence', name: '影响力', weight: 0.4,
      desc: '评估专家的社会荣誉、职称头衔、管理履历及任职机构权威性',
      subDimensions: [
        {
          name: '社会荣誉与奖项', weight: 0.35, maxScore: 10, missingScore: 5, cap: 10,
          criteria: '维度1主锚=行政级别 H0国家级9 / H1省部级7.5 / H2地市或国家级学会6 / H3县级4，取最高不累计；维度2=同级别广度+0.3~0.5(封顶+0.5)；维度3=顶尖人才+0.5~1.0(封顶+1.0，院士+1.0，行业榜单按发布方权威性归H2/可上调H1)。缺失固定5.0。',
          scoring: {
            type: 'tier',
            lowTierPending: true,
            dimension1: { label: '行政级别（主锚·取最高不累计）', tiers: { 'H0 国家级荣誉/称号': 9.0, 'H1 省部级荣誉/称号': 7.5, 'H2 地市级/国家级学会': 6.0, 'H3 县级/一般协会': 4.0, '信息缺失': 5.0 } },
            dimension2: { label: '同级别广度', rules: [ { cond: '同级别荣誉≥2项', add: 0.3 }, { cond: '同级别荣誉≥3项', add: 0.5 } ], cap: 0.5 },
            dimension3: { label: '顶尖人才（额外加分·封顶+1.0）', rules: [ { cond: '两院院士', add: 1.0 }, { cond: '国家级人才计划/国际权威榜单(按发布方权威性可上调H1)', add: 0.5 } ], cap: 1.0, dynamicCapNote: '动态封顶 = 10 - base - 维度2' },
            note: '沿用上海落户"同一项符合多种条件按最高分不累计"原则；行业榜单水分较大，按发布方权威性定档。'
          }
        },
        {
          name: '职称、管理履历与行业地位', weight: 0.65, maxScore: 10, missingScore: 5, cap: 10,
          criteria: '维度1主锚=职级J0-J3 × 机构C0-C2矩阵(顶点J0×C0=9.5)；维度2=履历厚度+0.3~0.5(封顶+0.5)；维度3=标志性职位/变革主导+0.5~1.0(封顶+1.0，早期创始团队定A轮前)。缺失固定5.0。',
          scoring: {
            type: 'matrix',
            lowTierPending: true,
            dimension1: {
              label: '职级（行 J0-J3）× 机构（列 C0-C2）',
              jobLevels: { 'J0 教授/院士/首席/CEO总裁创始人董事长': 9.5, 'J1 副教授/总监/VP/合伙人': 8.5, 'J2 经理/高工/主管': 7.0, 'J3 无职称/基层': 5.5 },
              orgs: { 'C0 世界500强/央企/上市公司': 0.0, 'C1 行业百强/大厂': -0.5, 'C2 普通企业': -1.0 }
            },
            dimension2: { label: '履历厚度', rules: [ { cond: '从业≥10年', add: 0.3 }, { cond: '从业≥15年 或 跨行业经历', add: 0.5 } ], cap: 0.5 },
            dimension3: { label: '标志性职位/变革主导（额外加分·封顶+1.0）', rules: [ { cond: '国标委/一级学会常务理事/早期创始团队(A轮前)', add: 0.5 }, { cond: '主导企业变革/变革落地', add: 0.3 } ], cap: 1.0, dynamicCapNote: '动态封顶 = 10 - base - 维度2' },
            note: '顶点J0×C0=9.5保留封顶余量（更强者可在维度3继续加成）；C0暂含规模较小上市公司；初创界定为A轮前。'
          }
        }
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

const CURRENT_DB_VERSION = 14;

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

  // v5.6.4: Update criteria based on configVersion
  const needUpdateCriteria = !cfg.configVersion || cfg.configVersion < DEFAULT_RATING_CONFIG.configVersion;
  if (needUpdateCriteria) {
    // Update criteria from DEFAULT_RATING_CONFIG
    cfg.dimensions.forEach((dim, idx) => {
      const defaultDim = DEFAULT_RATING_CONFIG.dimensions.find(d => d.id === dim.id) || DEFAULT_RATING_CONFIG.dimensions[0];
      if (defaultDim && defaultDim.subDimensions) {
        // Update existing subDimensions' criteria
        if (dim.subDimensions && dim.subDimensions.length > 0) {
          dim.subDimensions.forEach(sd => {
            const defaultSD = defaultDim.subDimensions.find(ds => ds.name === sd.name);
            if (defaultSD) {
              if (defaultSD.criteria) sd.criteria = defaultSD.criteria;
              if (defaultSD.scoring) sd.scoring = JSON.parse(JSON.stringify(defaultSD.scoring));
              if (defaultSD.missingScore !== undefined) sd.missingScore = defaultSD.missingScore;
              if (defaultSD.cap !== undefined) sd.cap = defaultSD.cap;
            }
          });
        } else {
          // If no subDimensions, copy from default
          dim.subDimensions = JSON.parse(JSON.stringify(defaultDim.subDimensions));
        }
      }
    });
    cfg.configVersion = DEFAULT_RATING_CONFIG.configVersion;
  }

  // Ensure each dimension has subDimensions + criteria
  cfg.dimensions.forEach((dim, idx) => {
    const defaultDim = DEFAULT_RATING_CONFIG.dimensions.find(d => d.id === dim.id) || DEFAULT_RATING_CONFIG.dimensions[0];
    if (!dim.subDimensions || dim.subDimensions.length === 0) {
      if (defaultDim && defaultDim.subDimensions) {
        dim.subDimensions = JSON.parse(JSON.stringify(defaultDim.subDimensions));
      }
    } else {
      dim.subDimensions.forEach(sd => {
        if (!sd.criteria) {
          const defaultSD = defaultDim && defaultDim.subDimensions ? defaultDim.subDimensions.find(ds => ds.name === sd.name) : null;
          if (defaultSD) {
            sd.criteria = defaultSD.criteria;
            if (defaultSD.scoring) sd.scoring = JSON.parse(JSON.stringify(defaultSD.scoring));
            if (defaultSD.missingScore !== undefined) sd.missingScore = defaultSD.missingScore;
            if (defaultSD.cap !== undefined) sd.cap = defaultSD.cap;
          } else {
            sd.criteria = '6-9分：按资质等级评定 | 5分：信息缺失/模糊（默认中值）';
          }
        }
      });
    }
  });
  // v5.6.4: Migrate influence sub-dimensions - merge 职称 and 管理履历 into 职称、管理履历与行业地位
  const inflDim = cfg.dimensions.find(d => d.id === 'influence');
  if (inflDim && inflDim.subDimensions) {
    const hasMerged = inflDim.subDimensions.some(sd => sd.name === '职称、管理履历与行业地位');
    const hasSeparate = inflDim.subDimensions.some(sd => sd.name === '职称与专业头衔') || inflDim.subDimensions.some(sd => sd.name === '管理履历与行业地位');
    if (hasSeparate && !hasMerged) {
      // Merge: combine the two sub-dimensions into one
      const merged = { name: '职称、管理履历与行业地位', weight: 0.65, maxScore: 10,
        criteria: '9分：教授/研究员/院士/首席/CEO/总裁/创始人/董事长（世界500强/央企/上市公司） | 8分：总监/VP/合伙人/副教授（行业百强/大厂） | 7分：经理/高级工程师/主管（普通企业） | 6分：信息缺失/模糊 | 注：任职机构权威性加权——世界500强/央企/上市公司+1分，行业百强/大厂+0.5分'
      };
      // Remove the two old ones, keep 社会荣誉与奖项, add merged
      inflDim.subDimensions = inflDim.subDimensions.filter(sd => sd.name !== '职称与专业头衔' && sd.name !== '管理履历与行业地位');
      // Ensure 社会荣誉与奖项 exists with correct weight
      const honorSD = inflDim.subDimensions.find(sd => sd.name === '社会荣誉与奖项');
      if (honorSD) honorSD.weight = 0.35;
      inflDim.subDimensions.push(merged);
    }
  }
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
      // v5.8.6-refactor: 扩散法 — 以 localStorage 全量为基底，Supabase 仅覆盖核心数据
      // 新增任何 db 属性自动保留，无需维护白名单。派生属性（version/updateTime 等）显式覆盖
      let localDB = {};
      if (raw) {
        try { localDB = JSON.parse(raw) || {}; } catch(e) {}
      }
      
      // 合并字段：Supabase 提供字段列表，localStorage 提供颜色覆盖
      // 修复 v4.0 初始阶段管理员修改未同步到 Supabase 导致刷新后颜色丢失
      // V5.7.0-hotfix: 改为并集合并 —— localStorage 独有字段不再被丢弃
      let fields = [];
      if (localDB.fields && localDB.fields.length > 0) {
        const supabaseFieldMap = {};
        appData.fields.forEach(function(f) { if (f && f.name) supabaseFieldMap[f.name] = true; });
        const localFieldMap = {};
        localDB.fields.forEach(function(f) { if (f && f.name) localFieldMap[f.name] = f; });
        // 1. 以 Supabase 为基准，合并 localStorage 的颜色覆盖
        fields = appData.fields.map(function(f) {
          const local = localFieldMap[f.name];
          if (local && local.color) {
            return {
              name: f.name,
              color: local.color,
              textColor: local.textColor || '#ffffff',
              hideWhenEmpty: local.hideWhenEmpty !== undefined ? local.hideWhenEmpty : f.hideWhenEmpty,
              sortOrder: local.sortOrder !== undefined ? local.sortOrder : f.sortOrder,
              creator: local.creator !== undefined ? local.creator : f.creator
            };
          }
          return f;
        });
        // 2. 追加 localStorage 中独有的字段（防止同步失败导致新增字段丢失）
        localDB.fields.forEach(function(f) {
          if (f && f.name && !supabaseFieldMap[f.name]) {
            fields.push(f);
            console.log('[getDB] 保留 localStorage 独有字段:', f.name);
          }
        });
      } else {
        fields = appData.fields;
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
      
      // v5.8.4-fix: 专家数据 UNION 合并（Supabase ∪ localStorage），localStorage 为权威
      let finalExperts = appData.experts.slice();
      if (raw) {
        try {
          const localDB = JSON.parse(raw);
          if (localDB.experts && localDB.experts.length > 0) {
            // 1. 建立 Supabase 专家索引
            const supabaseExpertMap = {};
            appData.experts.forEach(function(se) { supabaseExpertMap[se.id || se.name] = se; });
            // 2. 合并共同专家：localStorage 数据覆盖（保留手动评分调整）
            finalExperts = appData.experts.map(function(se) {
              const local = localDB.experts.find(function(le) { return (le.id || le.name) === (se.id || se.name); });
              if (local) {
                return Object.assign({}, se, { subScores: local.subScores, scores: local.scores });
              }
              return se;
            });
            // 3. 追加 localStorage 中独有的专家（防止同步失败导致数据丢失）
            var addedCount = 0;
            localDB.experts.forEach(function(le) {
              if (le && le.name && !supabaseExpertMap[le.id || le.name]) {
                finalExperts.push(le);
                addedCount++;
              }
            });
            if (addedCount > 0) {
              console.warn('[getDB] ⚠️ Supabase 缺失 ' + addedCount + ' 位专家，已从 localStorage 恢复');
            }
          }
        } catch(e) { console.warn('[getDB] 专家合并异常:', e.message); }
      }
      
      // v5.8.4-fix: 合作项目 UNION 合并（Supabase ∪ localStorage），localStorage 为权威
      var finalProjects = appData.yiliProjects.slice();
      if (raw) {
        try {
          var localPdb = JSON.parse(raw);
          if (localPdb.yiliProjects && localPdb.yiliProjects.length > 0) {
            var supabaseProjMap = {};
            appData.yiliProjects.forEach(function(sp) { if (sp.id) supabaseProjMap[sp.id] = sp; });
            var projAdded = 0;
            // 合并共同项目：localStorage 覆盖
            finalProjects = appData.yiliProjects.map(function(sp) {
              var lp = localPdb.yiliProjects.find(function(p) { return p.id === sp.id || (p.title === sp.title && p.expertId === sp.expertId); });
              return lp ? Object.assign({}, sp, lp) : sp;
            });
            // 追加 localStorage 独有项目
            localPdb.yiliProjects.forEach(function(lp) {
              if (lp && lp.id && !supabaseProjMap[lp.id]) {
                finalProjects.push(lp);
                projAdded++;
              }
            });
            if (projAdded > 0) {
              console.warn('[getDB] ⚠️ Supabase 缺失 ' + projAdded + ' 个合作项目，已从 localStorage 恢复');
            }
          }
        } catch(e) { console.warn('[getDB] 项目合并异常:', e.message); }
      }

      // v5.8.6-refactor: 扩散法 — ...localDB 保留所有配置，Supabase 仅覆盖核心数据
      const db = {
        ...localDB,
        experts: finalExperts,
        fields: fields,
        yiliProjects: finalProjects,
        favorites: mergedFavorites,
        // 配置类：localDB 优先（已有默认值兜底，migrateRatingConfig 处理评分迁移）
        ratingConfig: migrateRatingConfig(localDB.ratingConfig || JSON.parse(JSON.stringify(DEFAULT_RATING_CONFIG))),
        sortOptions: localDB.sortOptions || DEFAULT_SORT_OPTIONS,
        uiConfig: localDB.uiConfig || JSON.parse(JSON.stringify(DEFAULT_UI_CONFIG)),
        dashboardConfig: localDB.dashboardConfig || { chartType: 'doughnut', showCharts: ['fields', 'scoreNumeric'], barChartType: 'bar' },
        observationLibrary: localDB.observationLibrary || [],
        permissions: localDB.permissions || await fetchPermissions() || { adminPassword: 'yili2026', users: [], shareSettings: { linkActive: true, requireLogin: true } },
        mobileViewEnabled: localDB.mobileViewEnabled !== undefined ? localDB.mobileViewEnabled : undefined,
        defaultAreaCode: localDB.defaultAreaCode || '',
        // 派生属性（必须显式覆盖，防止携带 localStorage 旧值）
        categoryConfig: fields,
        totalExperts: finalExperts.length,
        totalFields: fields.length,
        version: CURRENT_DB_VERSION,
        updateTime: new Date().toISOString()
      };
      
      // v5.8.8.2-migration: 自动清理 qualifications / courses 尾部全角分号（兼容旧导入数据）
      finalExperts.forEach(function(e) {
        if (e.qualifications && /[;；]\s*$/.test(e.qualifications)) {
          e.qualifications = e.qualifications.replace(/[;；]\s*$/gm, '');
        }
        if (e.courses && /[;；]\s*$/.test(e.courses)) {
          e.courses = e.courses.replace(/[;；]\s*$/gm, '');
        }
      });

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
  db.dashboardConfig = { chartType: 'doughnut', showCharts: ['fields', 'scoreNumeric'], barChartType: 'bar' };
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
  if (!db.dashboardConfig) db.dashboardConfig = { chartType: 'doughnut', showCharts: ['fields', 'scoreNumeric'], barChartType: 'bar' };
  if (!db.observationLibrary) db.observationLibrary = [];
  if (!db.permissions) db.permissions = { adminPassword: 'yili2026', users: [], shareSettings: { linkActive: true, requireLogin: true } };
  // v5.6.7: 确保现有领域的 creator 字段初始化
  if (db.fields) {
    db.fields.forEach(function(f) { if (!f.creator) f.creator = 'master'; });
  }
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
  // Sync experts — 使用 upsert，避免 update 静默失败导致新数据丢失
  if (db.experts) {
    for (const expert of db.experts) {
      try {
        await upsertExpert(expert);
      } catch(e) { console.warn('Expert sync error:', expert.name, e.message); }
    }
  }
  // Sync projects — 使用 upsert，避免新增项目无法写入 Supabase
  if (db.yiliProjects && db.yiliProjects.length > 0) {
    for (const proj of db.yiliProjects) {
      try {
        await upsertProject(proj);
      } catch(e) { console.warn('Project sync error:', proj.title, e.message); }
    }
  }
  // Sync fields — V5.7.0-hotfix: 先查后写，避免 update 对不存在的行静默成功导致 create 永不触发
  if (db.fields) {
    let supabaseFieldNames = new Set();
    try {
      const sf = await fetchFields();
      supabaseFieldNames = new Set(sf.map(function(f) { return f.name; }));
    } catch(e) { console.warn('[sync] fetchFields failed:', e.message); }
    for (const field of db.fields) {
      try {
        if (supabaseFieldNames.has(field.name)) {
          await updateField(field.name, field);
        } else {
          await createField(field);
          supabaseFieldNames.add(field.name);
        }
      } catch(e) { console.warn('Field sync error:', field.name, e.message); }
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
  adminSearchQuery: '',
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
  const cap = cfg.cap || 10;
  const profDim = cfg.dimensions.find(d => d.id === 'professional');
  const inflDim = cfg.dimensions.find(d => d.id === 'influence');
  let prof = 0, infl = 0;
  const getSub = (sd, val) => {
    let v = val;
    if (v === undefined || v === null) v = sd.missingScore !== undefined ? sd.missingScore : (cfg.missingScore !== undefined ? cfg.missingScore : 6);
    return Math.min(cap, Math.max(0, v));
  };
  if (e.subScores && e.subScores.professional && profDim && profDim.subDimensions) {
    profDim.subDimensions.forEach(sd => {
      prof += getSub(sd, e.subScores.professional[sd.name]) * sd.weight;
    });
  }
  if (e.subScores && e.subScores.influence && inflDim && inflDim.subDimensions) {
    inflDim.subDimensions.forEach(sd => {
      infl += getSub(sd, e.subScores.influence[sd.name]) * sd.weight;
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

// v5.6.9: 手机端切换
function toggleMobileMode() {
  var isMobile = document.body.classList.toggle('mobile-mode');
  try { localStorage.setItem('yili_mobile_mode', isMobile ? '1' : '0'); } catch(e) {}
  toast(isMobile ? '已切换到手机版' : '已切换到桌面版', 'success');
  // 重新渲染当前页面以更新按钮文字
  if (appState.mode === 'admin') {
    renderAdmin();
  } else {
    renderFrontend();
  }
}

function initMobileMode() {
  // v5.8.3: 管理员可在系统设置中关闭手机端视图
  var db = appState.db;
  if (db && db.mobileViewEnabled === false) return; // 管理员关闭了手机端
  var saved = null;
  try { saved = localStorage.getItem('yili_mobile_mode'); } catch(e) {}
  if (saved === '1') {
    document.body.classList.add('mobile-mode');
  } else if (saved === null) {
    // 首次访问：自动检测屏幕宽度（仅当管理员未显式关闭时）
    if (window.innerWidth < 768) {
      document.body.classList.add('mobile-mode');
      try { localStorage.setItem('yili_mobile_mode', '1'); } catch(e) {}
    }
  }
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

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// v4.18: 搜索高亮 — 纯文本（先转义再标记）
function highlightText(text, query) {
  if (!query || !text) return escapeHtml(String(text));
  var escaped = escapeHtml(String(text));
  var re = new RegExp('(' + escapeRegex(query) + ')', 'gi');
  return escaped.replace(re, '<mark>$1</mark>');
}

// v5.7.1: 卡片展示名 — 去掉括号内容，避免过长换行
function getCardDisplayName(name) {
  if (!name) return '';
  return name.replace(/[（(][^）)]*[）)]/g, '').trim() || name;
}

// v4.18: 搜索高亮 — 含HTML的富文本（只替换标签外的文本内容）
function highlightHtml(html, query) {
  if (!query || !html) return html;
  var q = escapeRegex(query);
  var re = new RegExp('(' + q + ')', 'gi');
  // 替换标签外的文本内容：处理 >text< 之间的文本，以及开头和结尾的文本
  // 1. 处理开头到第一个 < 之前的文本（如果有）
  html = html.replace(/^([^<]+)/, function(match, text) {
    return text.replace(re, '<mark>$1</mark>');
  });
  // 2. 处理 > 和 < 之间的文本内容
  html = html.replace(/>([^<]+)</g, function(match, text) {
    return '>' + text.replace(re, '<mark>$1</mark>') + '<';
  });
  return html;
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

// ===== v5.8.9 评分规则说明浮窗（前端"?"，简洁版 = 版本④） =====
// 文案以 评分规则-④前端展示评分细则-v5.8.9.md 为准；权重从 ratingConfig 读取，确保与计算逻辑同步。
function openScoringHelp() {
  const cfg = (appState && appState.db && appState.db.ratingConfig) || DEFAULT_RATING_CONFIG;
  const profDim = cfg.dimensions.find(d => d.id === 'professional') || {};
  const inflDim = cfg.dimensions.find(d => d.id === 'influence') || {};
  const profW = Math.round((profDim.weight || 0.6) * 100);
  const inflW = Math.round((inflDim.weight || 0.4) * 100);
  const html = `
    <div class="sh-head">
      <div class="sh-title">评分规则说明</div>
      <div class="sh-ver">v5.8.9 · 10分制</div>
    </div>
    <div class="sh-body">
      <h4 class="sh-h">综合评分怎么算？</h4>
      <p class="sh-formula">综合分 = <b>专业度 × ${profW}%</b> + <b>影响力 × ${inflW}%</b></p>
      <ul class="sh-list">
        <li><b>专业度</b>：学历与学术背景 · 行业资质与认证 · 专业成果与经验</li>
        <li><b>影响力</b>：社会荣誉与奖项 · 职称 / 管理履历与行业地位</li>
      </ul>
      <p class="sh-note">每个子项均为 <b>0–10 分</b>，由 ①主锚点（定基础分）+ ②次要角度（封顶 +0.5）+ ③额外加分（封顶 +1.0）相加而成。</p>

      <h4 class="sh-h">分数含义（速览）</h4>
      <table class="sh-table">
        <tr><td class="sh-range r-top">9–10</td><td>顶尖（清北博士、两院院士、世界500强掌舵人）</td></tr>
        <tr><td class="sh-range r-hi">8–8.9</td><td>优秀（985硕士、省部级荣誉、行业百强高管）</td></tr>
        <tr><td class="sh-range r-mid">6–7.9</td><td>良好 / 中等</td></tr>
        <tr><td class="sh-range r-miss">5</td><td>信息不足（未公开 / 模糊，统一计 5 分）</td></tr>
        <tr><td class="sh-range r-low">&lt;5</td><td>相对较弱</td></tr>
      </table>

      <h4 class="sh-h">两点说明</h4>
      <ul class="sh-list">
        <li>信息缺失<b>统一计 5 分</b>，不空置、不占优。</li>
        <li>综合分 <b>低于 7 分不进入"观察库"</b>——只展示信息较完整、实力较明确的专家。</li>
      </ul>
    </div>
    <div class="sh-foot">具体打分标准请联系对应管理员</div>
  `;
  const overlay = h('div', { className: 'scoring-help-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  overlay.appendChild(h('div', { className: 'scoring-help-modal', innerHTML: html }));
  document.body.appendChild(overlay);
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
  
  // v4.20: 用户信息 + 下拉菜单
  if (currentUser && appState.mode !== 'admin') {
    // 登录用户的头像 + 邮箱
    var userMenuWrap = h('div', { className: 'user-menu-wrap', style: { position: 'relative' } });
    var userBtn = h('button', {
      className: 'btn btn-sm user-menu-btn',
      style: { background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '12px', border: '1px solid rgba(255,255,255,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' },
      onclick: function(e) {
        e.stopPropagation();
        var dropdown = document.getElementById('user-dropdown');
        if (dropdown) {
          dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        }
      }
    });
    userBtn.appendChild(h('span', {}, '👤'));
    userBtn.appendChild(h('span', { style: { maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, currentUser.email));
    userBtn.appendChild(h('span', { style: { fontSize: '10px' } }, '▾'));
    userMenuWrap.appendChild(userBtn);
    
    // 下拉菜单
    var dropdown = h('div', {
      id: 'user-dropdown',
      style: { display: 'none', position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: '#fff', borderRadius: '8px', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', zIndex: 1000, minWidth: '160px', overflow: 'hidden' }
    });
    var menuItem = function(text, icon, onclick) {
      return h('div', {
        style: { padding: '10px 14px', fontSize: '13px', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #F3F4F6' },
        onmouseenter: function() { this.style.background = '#F9FAFB'; },
        onmouseleave: function() { this.style.background = ''; },
        onclick: function() { dropdown.style.display = 'none'; onclick(); }
      }, h('span', {}, icon), h('span', {}, text));
    };
    dropdown.appendChild(menuItem('修改密码', '🔑', function() { showChangePasswordModal(); }));
    dropdown.appendChild(menuItem('退出登录', '🚪', async function() {
      await signOut();
      appState.currentUser = null;
      renderFrontend();
    }));
    userMenuWrap.appendChild(dropdown);
    headerActions.appendChild(userMenuWrap);
    
    // 点击外部关闭下拉
    setTimeout(function() {
      document.addEventListener('click', function closeDropdown(e) {
        var d = document.getElementById('user-dropdown');
        if (d && !d.contains(e.target) && !userBtn.contains(e.target)) {
          d.style.display = 'none';
        }
      });
    }, 0);
  }
  
  // 数据仪表盘按钮（所有用户可见）
  headerActions.appendChild(h('button', {
    className: 'btn btn-sm',
    style: { background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '12px', border: '1px solid rgba(255,255,255,0.2)', marginRight: '4px' },
    onclick: () => showDashboard()
  }, '📊 数据仪表盘'));

  // v5.6.9: 手机版切换按钮（v5.8.3: 仅当管理员启用手机端视图时显示）
  var mobileEnabled = !(appState.db && appState.db.mobileViewEnabled === false);
  if (mobileEnabled) {
    var isMobile = document.body.classList.contains('mobile-mode');
    headerActions.appendChild(h('button', {
      className: 'btn btn-sm mobile-toggle-btn' + (isMobile ? ' active' : ''),
      onclick: function() { toggleMobileMode(); }
    }, isMobile ? '💻 桌面版' : '📱 手机版'));
  }

  // 管理员入口按钮
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
  }, isAdmin ? '退出后台' : '管理员入口'));
  headerInner.appendChild(headerActions);
  
  header.appendChild(headerInner);
  app.appendChild(header);
  
  // Stats bar
  const activeExperts = db.experts.filter(e => e.status !== 'eliminated' && e.status !== 'observation');
  
  // 前端可见领域数（不含 hideWhenEmpty 且无讲师的标签）
  const frontendFieldSet = new Set(activeExperts.flatMap(e => e.fields || []));
  const statsVisibleFields = db.fields.filter(f => {
    if (f.hideWhenEmpty && !frontendFieldSet.has(f.name)) return false;
    return true;
  });
  
  const statsBar = h('div', { className: 'stats-bar' });
  
  // 领域人数分布：受管理后台 dashboardConfig.showCharts 控制
  const dc = db.dashboardConfig || { showCharts: ['fields', 'scoreNumeric'] };
  if (dc.showCharts.includes('fields')) {
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
  } // if dc.showCharts.includes('fields')
  
  app.appendChild(statsBar);
  
  // Search bar
  var searchBar = h('div', { className: 'search-bar' });
  var searchWrapper = h('div', { className: 'search-input-wrapper' });
  searchWrapper.appendChild(h('span', { className: 'search-icon' }, '\uD83D\uDD0D'));
  var searchInput = h('input', {
    className: 'search-input',
    placeholder: '搜索专家姓名或关键词（如：AI、产品、清华...）',
    value: appState.searchQuery
  });
  
  // v4.19: 实时防抖搜索 + 搜索历史下拉 + X清除按钮
  var searchDebounceTimer = null;
  searchInput.oninput = function(e) {
    var val = e.target.value;
    appState.searchQuery = val;
    // Show/hide inline clear button
    var inlineClear = document.querySelector('.search-inline-clear');
    if (inlineClear) {
      inlineClear.style.display = val ? 'flex' : 'none';
    }
    // Show search history dropdown when typing/focusing
    if (document.activeElement === searchInput) {
      showSearchHistoryDropdown(searchInput);
    }
    // Debounce search
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(function() {
      doSearch();
      searchDebounceTimer = null;
    }, 350);
  };
  
  searchInput.onfocus = function() {
    // On focus, show inline clear if has content
    var inlineClear = document.querySelector('.search-inline-clear');
    if (inlineClear) {
      inlineClear.style.display = appState.searchQuery ? 'flex' : 'none';
    }
    showSearchHistoryDropdown(searchInput);
  };
  
  searchInput.onblur = function() {
    // Delay hide to allow click on dropdown items
    setTimeout(function() {
      var dd = document.querySelector('.search-history-dropdown');
      if (dd) dd.remove();
    }, 200);
  };
  
  // Inline X clear button inside wrapper
  var inlineClear = h('span', {
    className: 'search-inline-clear',
    style: 'display:' + (appState.searchQuery ? 'flex' : 'none'),
    onclick: function(e) {
      e.stopPropagation();
      appState.searchQuery = '';
      searchInput.value = '';
      inlineClear.style.display = 'none';
      appState.currentPage = 1;
      syncFilterUI();
      renderExpertGrid();
      var dd = document.querySelector('.search-history-dropdown');
      if (dd) dd.remove();
    }
  }, '\u2715');
  
  searchWrapper.appendChild(searchInput);
  searchWrapper.appendChild(inlineClear);
  searchBar.appendChild(searchWrapper);
  
  // 搜索按钮（保留作为显式触发入口）
  searchBar.appendChild(h('button', {
    className: 'search-btn',
    onclick: function() { doSearch(); saveSearchHistory(appState.searchQuery); }
  }, '\u641C\u7D22'));
  
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
  
  // v5.7.1: Field filter — extracted to reusable function for collapse button
  renderFieldFilterBar();
  
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
  
  // Render main page field chart — 受管理后台 showCharts 控制
  if (dc.showCharts.includes('fields')) {
    setTimeout(() => renderMainFieldChart(), 200);
  }
}

// ===== v5.7.1: 字段筛选栏独立渲染（用于收起/展开按钮） =====
function renderFieldFilterBar() {
  var db = appState.db;
  var app = document.getElementById('app');
  if (!app) return;
  
  // Remove existing field bar
  var oldBar = document.querySelector('.field-bar-wrapper');
  if (oldBar) oldBar.remove();
  
  var fieldBar = h('div', { className: 'filter-bar field-bar-wrapper', style: { marginTop: '8px' } });
  var fieldGroup = h('div', { className: 'filter-group' });
  fieldGroup.appendChild(h('span', { className: 'filter-label' }, '适用领域：'));
  var fieldFilters = h('div', { className: 'field-filters', id: 'field-filters' });
  
  // "全部" tag
  var allTag = h('span', {
    className: 'field-tag field-tag-all' + (appState.fieldFilter.size === 0 ? ' active' : ''),
    onclick: function() {
      appState.fieldFilter = new Set();
      appState.currentPage = 1;
      syncFilterUI();
      renderExpertGrid();
    }
  }, '全部');
  fieldFilters.appendChild(allTag);
  
  // 前端过滤：hideWhenEmpty=true 的标签，在前端可见专家中无对应讲师时不展示
  var frontendExperts = db.experts.filter(function(e) { return e.status !== 'eliminated' && e.status !== 'observation'; });
  var usedFieldNames = new Set(frontendExperts.flatMap(function(e) { return e.fields || []; }));
  // V5.7.3: 所有0人领域均不显示（与仪表盘动态显示规则一致）
  var visibleFields = db.fields.filter(function(f) {
    if (!usedFieldNames.has(f.name)) return false;
    return true;
  });

  var maxVisible = 8;
  var showAll = !appState.fieldsCollapsed;
  var fieldsToShow = showAll ? visibleFields : visibleFields.slice(0, maxVisible);
  
  fieldsToShow.forEach(function(f) {
    var isActive = appState.fieldFilter.has(f.name);
    var activeBgColor = f.color;
    var activeTextColor = '#4A4A4A';
    var inactiveBgColor = f.color + '22';
    var inactiveTextColor = '#4A4A4A';
    
    var tag = h('span', {
      className: 'field-tag' + (isActive ? ' active' : ''),
      style: {
        background: isActive ? activeBgColor : inactiveBgColor,
        color: isActive ? activeTextColor : inactiveTextColor,
        borderColor: f.color
      },
      onclick: function() {
        var newFilter = new Set(appState.fieldFilter);
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
    var toggleBtn = h('button', {
      className: 'field-toggle-btn',
      onclick: function() {
        appState.fieldsCollapsed = !appState.fieldsCollapsed;
        appState.currentPage = 1;
        renderFieldFilterBar();
        renderExpertGrid();
      }
    }, showAll ? '收起 ▲' : '更多 ▼');
    fieldFilters.appendChild(toggleBtn);
  }
  
  fieldGroup.appendChild(fieldFilters);
  fieldBar.appendChild(fieldGroup);
  
  // Insert before merged bar or append
  var mergedBar = document.querySelector('.merged-bar-wrapper');
  if (mergedBar) {
    app.insertBefore(fieldBar, mergedBar);
  } else {
    app.appendChild(fieldBar);
  }
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
  var input = document.querySelector('.search-input');
  if (input) {
    var val = input.value.trim();
    appState.searchQuery = val;
    appState.currentPage = 1;
    // v4.19: 保存到搜索历史（非空时）
    if (val) saveSearchHistory(val);
    renderExpertGrid();
  }
}

// v4.19: 搜索历史下拉
function showSearchHistoryDropdown(inputEl) {
  // Remove existing dropdown
  var existing = document.querySelector('.search-history-dropdown');
  if (existing) existing.remove();
  
  var history = getSearchHistory();
  var currentVal = (inputEl && inputEl.value && inputEl.value.trim()) || '';
  
  // Filter: show matching history items if typing, otherwise show all
  var filtered = currentVal
    ? history.filter(function(h) { return h.toLowerCase().indexOf(currentVal.toLowerCase()) !== -1; })
    : history.slice();
  
  // Don't show if no history or all items filtered out
  if (filtered.length === 0 && !currentVal) return;
  
  var wrapper = inputEl.parentElement;
  var dropdown = document.createElement('div');
  dropdown.className = 'search-history-dropdown';
  
  // Header
  var header = document.createElement('div');
  header.className = 'search-history-header';
  header.innerHTML = '<span>搜索历史</span>';
  var clearAll = document.createElement('span');
  clearAll.className = 'search-history-clear-all';
  clearAll.textContent = '清空';
  clearAll.onclick = function(e) {
    e.stopPropagation();
    clearSearchHistory();
    dropdown.remove();
  };
  header.appendChild(clearAll);
  dropdown.appendChild(header);
  
  // Items
  if (filtered.length > 0) {
    filtered.forEach(function(item) {
      var row = document.createElement('div');
      row.className = 'search-history-item';
      
      var text = document.createElement('span');
      text.className = 'search-history-text';
      text.textContent = item;
      text.title = item;
      text.onclick = function() {
        inputEl.value = item;
        appState.searchQuery = item;
        saveSearchHistory(item);
        appState.currentPage = 1;
        doSearch();
        dropdown.remove();
      };
      row.appendChild(text);
      
      var delBtn = document.createElement('span');
      delBtn.className = 'search-history-delete';
      delBtn.textContent = '\u2715';
      delBtn.title = '删除此条';
      delBtn.onclick = function(e) {
        e.stopPropagation();
        removeSearchHistoryItem(item);
        dropdown.remove();
        // Re-show updated dropdown
        showSearchHistoryDropdown(inputEl);
      };
      row.appendChild(delBtn);
      
      dropdown.appendChild(row);
    });
  }
  
  // Position: below the wrapper
  wrapper.appendChild(dropdown);
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
  
  // 9. v4.18: 合作项目匹配
  var db = appState.db;
  if (db.yiliProjects && Array.isArray(db.yiliProjects)) {
    var projMatches = db.yiliProjects.filter(function(p) {
      return p.expertId === expert.id && p.visible;
    });
    projMatches.forEach(function(p) {
      if (p.title && p.title.toLowerCase().includes(q)) score += 20;
      if (p.desc && p.desc.toLowerCase().includes(q)) score += 12;
    });
  }
  
  // 10. Bonus for multi-word queries: count how many words match
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
  let experts = db.experts.filter(e => e.status !== 'eliminated' && e.status !== 'observation');
  
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
  
  // Search - broad match across ALL expert information
  if (appState.searchQuery) {
    var q = appState.searchQuery.toLowerCase();
    // Build project text index once (shared across all experts)
    var projectTextByExpert = {};
    if (db.yiliProjects && Array.isArray(db.yiliProjects)) {
      db.yiliProjects.forEach(function(p) {
        if (!p.expertId) return;
        if (!projectTextByExpert[p.expertId]) projectTextByExpert[p.expertId] = [];
        projectTextByExpert[p.expertId].push((p.title || '') + ' ' + (p.desc || ''));
      });
    }
    experts = experts.filter(function(e) {
      // Check if any field matches
      var allContacts = getContactsList(e);
      var allText = [
        e.name.toLowerCase(),
        ...e.fields.map(function(f) { return f.toLowerCase(); }),
        ...(e.advantages || []).map(function(a) { return (a.title + ' ' + a.desc).toLowerCase(); }),
        (e.qualifications || '').toLowerCase(),
        (e.courses || '').toLowerCase(),
        (e.education || '').toLowerCase(),
        ...allContacts.map(function(c) { return (c.person + ' ' + c.info).toLowerCase(); }),
        (e.referrer || '').toLowerCase(),
        // v4.18: 合作项目信息加入搜索
        (projectTextByExpert[e.id] || []).join(' ').toLowerCase()
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
  var sq = appState.searchQuery; // v4.18: search query for highlighting

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
    
    // Row 1: name + fav star + scores (v4.18: name with search highlight)
    const nameRow = h('div', { className: 'card-name-row' });
    const cardDisplayName = getCardDisplayName(expert.name);
    const nameEl = h('div', { className: 'card-name', innerHTML: highlightText(cardDisplayName, sq) });
    if (cardDisplayName !== expert.name) nameEl.title = expert.name;
    nameRow.appendChild(nameEl);
    
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
    
    // Row 2: fields (v4.18: with search highlight)
    const fieldsRow = h('div', { className: 'card-fields-row' });
    expert.fields.forEach(fName => {
      const fieldMeta = db.fields.find(f => f.name === fName);
      const color = fieldMeta ? fieldMeta.color : '#64748b';
      const textColor = fieldMeta ? (fieldMeta.textColor || getTextColorForBg(color)) : '#ffffff';
      fieldsRow.appendChild(h('span', {
        className: 'card-field-tag',
        style: { background: color, color: textColor },
        innerHTML: highlightText(fName, sq)
      }));
    });
    headerInfo.appendChild(fieldsRow);
    
    cardHeader.appendChild(headerInfo);
    card.appendChild(cardHeader);
    
    // ===== 资历资质（简化：▸符号，每条1行，最多3条）- 统一浅色 v4.18: with search highlight =====
    const qualItems = getQualSimpleItems(expert);
    if (qualItems.length > 0) {
      const qualDiv = h('div', { className: 'card-qual-highlights' });
      qualItems.forEach((q, qi) => {
        const line = h('div', { className: 'card-qual-line' });
        line.appendChild(h('span', {
          className: 'card-qual-bullet'
        }, '▸'));
        line.appendChild(h('span', {
          className: 'card-qual-text',
          innerHTML: highlightText(q, sq)
        }));
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
        // 仅1次：不显示次数，直接显示项目信息 (v4.18: title with highlight)
        projBox.appendChild(h('div', { className: 'proj-count-line', innerHTML: '📋 最近合作：' + highlightText(latest.title, sq) }));
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
        projBox.appendChild(h('div', { className: 'proj-detail-line', style: 'font-weight:600', innerHTML: '最近合作：' + highlightText(latest.title, sq) }));
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
    
    // Advantages（突出优势 - 数字标号1、2、3，蓝色加粗内容）v4.18: with search highlight
    const advItems = getAdvItems(expert);
    if (advItems.length > 0) {
      const advList = h('div', { className: 'card-advantages-new' });
      advItems.forEach((item, idx) => {
        const advItemDiv = h('div', { className: 'card-advantage-title-item' });
        advItemDiv.appendChild(h('span', { className: 'card-adv-num' }, String(idx + 1)));
        // Process highlight: text before ：is blue bold; v4.18: search highlight on both parts
        const colonIdx = item.indexOf('：');
        if (colonIdx > 0) {
          advItemDiv.appendChild(h('span', { className: 'card-adv-title-bold', innerHTML: highlightText(item.substring(0, colonIdx) + '：', sq) }));
          advItemDiv.appendChild(h('span', { innerHTML: highlightText(item.substring(colonIdx + 1), sq) }));
        } else {
          advItemDiv.appendChild(h('span', { className: 'card-adv-title-bold', innerHTML: highlightText(item, sq) }));
        }
        advList.appendChild(advItemDiv);
      });
      card.appendChild(advList);
    }
    
    // Education（下移）v4.18: with search highlight
    if (expert.education && expert.education !== '未公开') {
      var eduText = expert.education.length > 50 ? expert.education.substring(0,50)+'...' : expert.education;
      card.appendChild(h('div', { className: 'card-edu card-edu-bottom', innerHTML: '🎓 ' + highlightText(eduText, sq) }));
    }
    
    // Contact (v3.1: 卡片只显示第一个联系人) v4.18: with search highlight
    const contacts = getContactsList(expert);
    if (contacts.length > 0 && (contacts[0].person || contacts[0].info)) {
      const contactDiv = h('div', { className: 'card-contact' });
      if (contacts[0].person) {
        contactDiv.appendChild(h('span', { innerHTML: '👤 ' + highlightText(contacts[0].person, sq) }));
      }
      if (contacts[0].info) {
        const typeLabel = contacts[0].type === 'email' ? '📧 ' : contacts[0].type === 'wechat' ? '💬 ' : '📞 ';
        const displayInfo = contacts[0].info.length > 25 ? contacts[0].info.substring(0,25)+'...' : contacts[0].info;
        contactDiv.appendChild(h('span', { innerHTML: typeLabel + highlightText(displayInfo, sq) }));
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
  var sq = appState.searchQuery; // v4.18: search query for highlighting
  const overlay = h('div', { className: 'modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const content = h('div', { className: 'modal-content' });
  
  // Header
  const modalHeader = h('div', { className: 'modal-header' });
  // Group name + fav star + supplier ribbon together (v4.18: name with search highlight)
  const nameGroup = h('span', { className: 'modal-title-group' });
  const nameSpan = h('span', { className: 'modal-title', innerHTML: highlightText(expert.name, sq) });
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
  scoreSection.appendChild(h('div', { className: 'detail-section-title score-title-row' },
    '评分信息',
    h('button', { className: 'score-help-btn', type: 'button', title: '评分规则说明（点击查看）', onclick: openScoringHelp }, '?')
  ));
  
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
  // 确保subScores存在（启动时initAIScoring未调用的情况，按需生成）
  if (!expert.subScores) {
    aiScoreExpert(expert);
  }
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
          const val = expert.subScores.professional[sd.name] !== undefined ? expert.subScores.professional[sd.name] : 6;
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
          const val = expert.subScores.influence[sd.name] !== undefined ? expert.subScores.influence[sd.name] : 6;
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
  
  // Fields (v4.18: with search highlight)
  const fieldsSection = h('div', { className: 'detail-section' });
  fieldsSection.appendChild(h('div', { className: 'detail-section-title' }, '适用领域'));
  const fieldTags = h('div', { className: 'detail-field-tags' });
  expert.fields.forEach(fName => {
    const fMeta = db.fields.find(f => f.name === fName);
    const color = fMeta ? fMeta.color : '#64748b';
    const textColor = fMeta ? (fMeta.textColor || getTextColorForBg(color)) : '#ffffff';
    fieldTags.appendChild(h('span', { className: 'card-field-tag', style: { background: color, color: textColor, padding:'6px 14px', fontSize:'13px' }, innerHTML: highlightText(fName, sq) }));
  });
  fieldsSection.appendChild(fieldTags);
  body.appendChild(fieldsSection);
  
  // Education (v4.18: with search highlight)
  if (expert.education && expert.education !== '未公开') {
    const eduSection = h('div', { className: 'detail-section' });
    eduSection.appendChild(h('div', { className: 'detail-section-title' }, '学历'));
    eduSection.appendChild(h('div', { className: 'detail-text', innerHTML: highlightText(expert.education, sq) }));
    body.appendChild(eduSection);
  }
  
  // Advantages (as intro with ■ format, preserving original data source style) v4.18: with search highlight
  if (expert.advantages && expert.advantages.length > 0) {
    const advSection = h('div', { className: 'detail-section' });
    advSection.appendChild(h('div', { className: 'detail-section-title' }, '专家简介'));
    const advBox = h('div', { className: 'detail-advantages' });
    expert.advantages.forEach(adv => {
      const item = h('div', { className: 'detail-advantage-item' });
      const content = adv.title ? '■' + adv.title + '：' + adv.desc : '■' + adv.desc;
      item.innerHTML = highlightText(content, sq);
      advBox.appendChild(item);
    });
    advSection.appendChild(advBox);
    body.appendChild(advSection);
  }
  
  // Qualifications (v4.18: with search highlight on rich text)
  if (expert.qualifications && expert.qualifications !== '未公开') {
    const qualSection = h('div', { className: 'detail-section' });
    qualSection.appendChild(h('div', { className: 'detail-section-title' }, '资历资质'));
    const qualText = h('div', { className: 'detail-text' });
    qualText.innerHTML = highlightHtml(formatRichText(expert.qualifications), sq);
    qualSection.appendChild(qualText);
    body.appendChild(qualSection);
  }
  
  // Reference Cases (formerly 课程/案例) v4.18: with search highlight on rich text
  if (expert.courses) {
    const courseSection = h('div', { className: 'detail-section' });
    courseSection.appendChild(h('div', { className: 'detail-section-title' }, '参考案例'));
    const courseText = h('div', { className: 'detail-text' });
    courseText.innerHTML = highlightHtml(formatRichText(expert.courses), sq);
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
      // 1. 项目名称 (v4.18: with search highlight)
      projCard.appendChild(h('div', { style: 'font-weight:600;margin-bottom:4px;font-size:14px', innerHTML: highlightText(proj.title, sq) }));
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
      // 4. 项目描述（为空不显示）(v4.18: with search highlight)
      if (proj.desc) {
        projCard.appendChild(h('div', { style: 'font-size:13px;color:#15803d;margin-top:4px;line-height:1.6', innerHTML: highlightText(proj.desc, sq) }));
      }
      projList.appendChild(projCard);
    });
    yiliSection.appendChild(projList);
    body.appendChild(yiliSection);
  }
  
  // Contact (v3.1: 支持多联系人依次显示) v4.18: with search highlight
  const detailContacts = getContactsList(expert);
  if (detailContacts.length > 0 || expert.referrer) {
    const contactSection = h('div', { className: 'detail-section' });
    contactSection.appendChild(h('div', { className: 'detail-section-title' }, '联系方式'));
    const typeMap = { email: '邮箱', wechat: '微信', phone: '电话' };
    
    detailContacts.forEach((c, idx) => {
      if (c.person || c.info) {
        const label = detailContacts.length === 1 ? '联系人' : ('联系人' + (idx + 1));
        var line = label + '：' + (c.person ? highlightText(c.person, sq) : '');
        if (c.info) {
          line += '，' + (typeMap[c.type] || '联系方式') + '：' + highlightText(c.info, sq);
        }
        contactSection.appendChild(h('div', { className: 'detail-text', style: { marginBottom: detailContacts.length > 1 ? '6px' : '0' }, innerHTML: line }));
      }
    });
    
    if (expert.referrer) {
      contactSection.appendChild(h('div', { className: 'detail-text', style: { marginTop: '8px' }, innerHTML: '内部推荐人：' + highlightText(expert.referrer, sq) }));
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
      // v5.8.8.2: 清理【】内容块尾部的全角分号（兼容旧数据）
      var cleanPart = part.replace(/[;；]\s*$/, '');
      result += '<div class="detail-sub-content">' + cleanContent(cleanPart) + '</div>';
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
// v5.7.2: 统一领域分布计算 — 只返回有专家的领域，空领域不显示不统计
function getFieldDistribution(experts) {
  const db = appState.db;
  const usedFieldNames = new Set(experts.flatMap(e => e.fields || []));
  const visibleFields = db.fields.filter(f => {
    if (f.hideWhenEmpty && !usedFieldNames.has(f.name)) return false;
    return true;
  });
  const fieldCount = {};
  visibleFields.forEach(f => { fieldCount[f.name] = 0; });
  experts.forEach(e => {
    (e.fields || []).forEach(f => { if (fieldCount[f] !== undefined) fieldCount[f]++; });
  });
  // 过滤掉 0 人领域
  const names = [], values = [], colors = [];
  visibleFields.forEach(f => {
    if (fieldCount[f.name] > 0) {
      names.push(f.name);
      values.push(fieldCount[f.name]);
      colors.push(f.color);
    }
  });
  return { names, values, colors };
}

function renderMainFieldChart() {
  const db = appState.db;
  const experts = db.experts.filter(e => e.status !== 'eliminated' && e.status !== 'observation');
  
  const { names: fieldNames, values: fieldValues, colors: fieldColors } = getFieldDistribution(experts);
  
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
  const dc = db.dashboardConfig || { showCharts: ['fields', 'scoreNumeric'], barChartType: 'bar' };
  const experts = db.experts.filter(e => e.status !== 'eliminated' && e.status !== 'observation');
  
  const overlay = h('div', { className: 'modal-overlay dashboard-modal', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const content = h('div', { className: 'modal-content' });
  
  const modalHeader = h('div', { className: 'modal-header' });
  modalHeader.appendChild(h('div', { className: 'modal-title' }, '📊 数据仪表盘'));
  modalHeader.appendChild(h('button', { className: 'modal-close', onclick: () => overlay.remove() }, '✕'));
  content.appendChild(modalHeader);
  
  const body = h('div', { className: 'modal-body' });
  const grid = h('div', { className: 'dashboard-grid' });
  
  // Field distribution chart — 受管理后台 showCharts 控制
  if (dc.showCharts.includes('fields')) {
    const fieldCard = h('div', { className: 'dashboard-card full' });
    fieldCard.appendChild(h('h4', {}, '领域分布情况'));
    const fieldChart = h('div', { className: 'chart-container tall' });
    fieldChart.id = 'chart-fields';
    fieldCard.appendChild(fieldChart);
    grid.appendChild(fieldCard);
  }
  
  // Score distribution doughnut chart
  if (db.ratingConfig.showScores !== false && dc.showCharts.includes('scoreDist')) {
    const distCard = h('div', { className: 'dashboard-card' });
    distCard.appendChild(h('h4', {}, '分值分布'));
    const distChart = h('div', { className: 'chart-container', style: 'height:220px' });
    distChart.id = 'chart-score-dist';
    distCard.appendChild(distChart);
    grid.appendChild(distCard);
  }
  
  // Score charts — 受 showCharts + showScores 双重控制
  if (db.ratingConfig.showScores !== false) {
    // Average scores numeric display
    if (dc.showCharts.includes('scoreNumeric')) {
      const avgCard = h('div', { className: 'dashboard-card' });
      avgCard.appendChild(h('h4', {}, '各项评分平均分'));
      const avgDisplay = h('div', { id: 'chart-avg-display' });
      avgCard.appendChild(avgDisplay);
      grid.appendChild(avgCard);
    }
  }
  
  // 如果所有图表都被关闭，显示提示
  if (!dc.showCharts.includes('fields') && !dc.showCharts.includes('scoreDist') && !dc.showCharts.includes('scoreNumeric')) {
    grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:14px">📋 当前未启用任何图表模块<br><small style="font-size:12px">请联系管理员在后台「仪表盘」中开启展示模块</small></div>';
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
  
  // v5.7.2: 领域分布只显示有专家的领域
  const { names: fieldNames, values: fieldValues, colors: fieldColors } = getFieldDistribution(experts);
  
  renderBarChart('chart-fields', fieldNames, fieldValues, fieldColors, '领域分布');
  
  // Score distribution doughnut
  const dc = db.dashboardConfig || {};
  if (dc.showCharts && dc.showCharts.includes('scoreDist')) {
    renderScoreDistChart('chart-score-dist', experts);
  }
  
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
}

function renderBarChart(containerId, labels, data, colors, title) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // v5.8.4: 读取 barChartType，支持柱状图(bar)和条状图(horizontalBar)
  var db = appState.db || {};
  var dashboardConfig = db.dashboardConfig || {};
  var isHorizontal = dashboardConfig.barChartType === 'horizontalBar';
  
  const maxVal = Math.max(...data, 1);
  const chartWidth = Math.max(container.clientWidth, 500);
  const chartHeight = Math.max(container.clientHeight - 50, 200);
  
  let svg;
  
  if (isHorizontal) {
    // ===== 横版条状图 =====
    var barH = Math.min(30, (chartHeight - 40) / labels.length - 8);
    var leftPad = 80;
    var svgH = Math.max(chartHeight + 40, labels.length * (barH + 8) + 60);
    
    svg = '<svg width="100%" height="' + svgH + '" viewBox="0 0 ' + chartWidth + ' ' + svgH + '" style="overflow:visible">';
    // grid lines
    for (var gi = 0; gi <= 4; gi++) {
      var gx = leftPad + (chartWidth - leftPad - 20) * gi / 4;
      svg += '<line x1="' + gx + '" y1="20" x2="' + gx + '" y2="' + (svgH - 30) + '" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="3,3"/>';
      svg += '<text x="' + gx + '" y="16" text-anchor="middle" font-size="10" fill="#94a3b8">' + Math.round(maxVal * gi / 4) + '</text>';
    }
    
    labels.forEach(function(label, i) {
      var by = 28 + i * (barH + 8);
      var bw = (data[i] / maxVal) * (chartWidth - leftPad - 30);
      var shortLabel = label.length > 8 ? label.substring(0,8)+'…' : label;
      
      svg += '<text x="' + (leftPad - 8) + '" y="' + (by + barH/2 + 4) + '" text-anchor="end" font-size="11" fill="#64748b">' + shortLabel + '</text>';
      svg += '<rect x="' + leftPad + '" y="' + by + '" width="' + Math.max(bw, 2) + '" height="' + barH + '" rx="4" fill="' + (colors[i] || '#3B82F6') + '" opacity="0.85"/>';
      svg += '<text x="' + (leftPad + Math.max(bw, 2) + 6) + '" y="' + (by + barH/2 + 4) + '" font-size="12" font-weight="600" fill="#475569">' + data[i] + '</text>';
    });
    
    svg += '</svg>';
  } else {
    // ===== 竖版柱状图 =====
    var barWidth = Math.min(60, (chartWidth - 80) / labels.length - 10);
    var svgHeight = chartHeight + 40;
    
    svg = '<svg width="100%" height="' + svgHeight + '" viewBox="0 0 ' + chartWidth + ' ' + svgHeight + '" style="overflow:visible">';
    
    // Y axis
    svg += '<line x1="50" y1="10" x2="50" y2="' + (chartHeight + 10) + '" stroke="#e2e8f0" stroke-width="1"/>';
    svg += '<line x1="50" y1="' + (chartHeight + 10) + '" x2="' + (chartWidth - 10) + '" y2="' + (chartHeight + 10) + '" stroke="#e2e8f0" stroke-width="1"/>';
    
    for (var yi = 0; yi <= 4; yi++) {
      var vy = chartHeight + 10 - (chartHeight * yi / 4);
      var vval = Math.round(maxVal * yi / 4);
      svg += '<text x="45" y="' + (vy + 4) + '" text-anchor="end" font-size="11" fill="#94a3b8">' + vval + '</text>';
      svg += '<line x1="50" y1="' + vy + '" x2="' + (chartWidth - 10) + '" y2="' + vy + '" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="3,3"/>';
    }
    
    labels.forEach(function(label, i) {
      var bx = 60 + i * (chartWidth - 70) / labels.length;
      var bh = Math.max(2, (data[i] / maxVal) * chartHeight);
      var by = chartHeight + 10 - bh;
      
      svg += '<rect x="' + bx + '" y="' + by + '" width="' + barWidth + '" height="' + bh + '" rx="4" fill="' + (colors[i] || '#3B82F6') + '" opacity="0.85"/>';
      svg += '<text x="' + (bx + barWidth/2) + '" y="' + Math.max(12, by - 6) + '" text-anchor="middle" font-size="11" font-weight="600" fill="#475569">' + data[i] + '</text>';
      
      var labelText = label.length > 6 ? label.substring(0,6)+'…' : label;
      svg += '<text x="' + (bx + barWidth/2) + '" y="' + (chartHeight + 30) + '" text-anchor="middle" font-size="10" fill="#64748b" transform="rotate(-20,' + (bx + barWidth/2) + ',' + (chartHeight + 30) + ')">' + labelText + '</text>';
    });
    
    svg += '</svg>';
  }

  container.innerHTML = svg;
}

function renderBarChartForExport(containerId, labels, data, colors, isHorizontal) {
  // v5.8.4: 导出专用柱状图渲染，显式传入水平/竖版模式
  var container = document.getElementById(containerId);
  if (!container) return;
  
  var maxVal = Math.max.apply(null, data.concat([1]));
  var chartWidth = Math.max(container.clientWidth, 500);
  var chartHeight = Math.max(container.clientHeight - 50, 200);
  
  var svg;
  
  if (isHorizontal) {
    var barH = Math.min(30, (chartHeight - 40) / labels.length - 8);
    var leftPad = 80;
    var svgH = Math.max(chartHeight + 40, labels.length * (barH + 8) + 60);
    
    svg = '<svg width="100%" height="' + svgH + '" viewBox="0 0 ' + chartWidth + ' ' + svgH + '">';
    for (var gi = 0; gi <= 4; gi++) {
      var gx = leftPad + (chartWidth - leftPad - 20) * gi / 4;
      svg += '<line x1="' + gx + '" y1="20" x2="' + gx + '" y2="' + (svgH - 30) + '" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="3,3"/>';
      svg += '<text x="' + gx + '" y="16" text-anchor="middle" font-size="10" fill="#94a3b8">' + Math.round(maxVal * gi / 4) + '</text>';
    }
    labels.forEach(function(label, i) {
      var by = 28 + i * (barH + 8);
      var bw = (data[i] / maxVal) * (chartWidth - leftPad - 30);
      var shortLabel = label.length > 8 ? label.substring(0,8)+'…' : label;
      svg += '<text x="' + (leftPad - 8) + '" y="' + (by + barH/2 + 4) + '" text-anchor="end" font-size="11" fill="#64748b">' + shortLabel + '</text>';
      svg += '<rect x="' + leftPad + '" y="' + by + '" width="' + Math.max(bw, 2) + '" height="' + barH + '" rx="4" fill="' + (colors[i] || '#3B82F6') + '" opacity="0.85"/>';
      svg += '<text x="' + (leftPad + Math.max(bw, 2) + 6) + '" y="' + (by + barH/2 + 4) + '" font-size="12" font-weight="600" fill="#475569">' + data[i] + '</text>';
    });
    svg += '</svg>';
  } else {
    var barWidth = Math.min(60, (chartWidth - 80) / labels.length - 10);
    var svgHeight = chartHeight + 40;
    
    svg = '<svg width="100%" height="' + svgHeight + '" viewBox="0 0 ' + chartWidth + ' ' + svgHeight + '">';
    svg += '<line x1="50" y1="10" x2="50" y2="' + (chartHeight + 10) + '" stroke="#e2e8f0" stroke-width="1"/>';
    svg += '<line x1="50" y1="' + (chartHeight + 10) + '" x2="' + (chartWidth - 10) + '" y2="' + (chartHeight + 10) + '" stroke="#e2e8f0" stroke-width="1"/>';
    
    for (var yi = 0; yi <= 4; yi++) {
      var vy = chartHeight + 10 - (chartHeight * yi / 4);
      var vval = Math.round(maxVal * yi / 4);
      svg += '<text x="45" y="' + (vy + 4) + '" text-anchor="end" font-size="11" fill="#94a3b8">' + vval + '</text>';
      svg += '<line x1="50" y1="' + vy + '" x2="' + (chartWidth - 10) + '" y2="' + vy + '" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="3,3"/>';
    }
    labels.forEach(function(label, i) {
      var bx = 60 + i * (chartWidth - 70) / labels.length;
      var bh = Math.max(2, (data[i] / maxVal) * chartHeight);
      var by = chartHeight + 10 - bh;
      svg += '<rect x="' + bx + '" y="' + by + '" width="' + barWidth + '" height="' + bh + '" rx="4" fill="' + (colors[i] || '#3B82F6') + '" opacity="0.85"/>';
      svg += '<text x="' + (bx + barWidth/2) + '" y="' + Math.max(12, by - 6) + '" text-anchor="middle" font-size="11" font-weight="600" fill="#475569">' + data[i] + '</text>';
      var labelText = label.length > 6 ? label.substring(0,6)+'…' : label;
      svg += '<text x="' + (bx + barWidth/2) + '" y="' + (chartHeight + 30) + '" text-anchor="middle" font-size="10" fill="#64748b" transform="rotate(-20,' + (bx + barWidth/2) + ',' + (chartHeight + 30) + ')">' + labelText + '</text>';
    });
    svg += '</svg>';
  }
  
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
  
  const cx = w * 0.33, cy = h * 0.48, r = Math.min(w * 0.21, 85);
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
  
  // Legend (two-line layout per item to prevent text overlap)
  const legendX = w * 0.55;
  const itemH = 44;
  const legendStartY = (h - data.filter(v => v > 0).length * itemH) / 2;
  let li = 0;
  data.forEach((val, i) => {
    if (val === 0) return;
    const ly = legendStartY + li * itemH;
    const pct = total > 0 ? (val/total*100).toFixed(1) : 0;
    svg += '<rect x="' + legendX + '" y="' + (ly + 1) + '" width="14" height="14" rx="3" fill="' + colors[i] + '"/>';
    svg += '<text x="' + (legendX + 20) + '" y="' + (ly + 12) + '" font-size="13" fill="#334155">' + labels[i] + '</text>';
    svg += '<text x="' + (legendX + 20) + '" y="' + (ly + 32) + '" font-size="12" font-weight="600" fill="#1e293b">' + val + '人 (' + pct + '%)</text>';
    li++;
  });
  
  svg += '</svg>';
  container.innerHTML = svg;
}

function renderScoreDistChart(containerId, experts) {
  const scored = experts.filter(e => e.scores && e.scores.overall > 0);
  const buckets = [
    { label: '9-10分（优秀）', min: 9, max: 10 },
    { label: '8-9分（良好）', min: 8, max: 9 },
    { label: '7-8分（合格）', min: 7, max: 8 },
    { label: '<7分（待提升）', min: 0, max: 7 }
  ];
  const counts = buckets.map(b => scored.filter(e => e.scores.overall >= b.min && e.scores.overall < b.max).length);
  // 处理满10分的情况（max=10时包含等于）
  counts[0] = scored.filter(e => e.scores.overall >= 9).length;
  const labels = buckets.map(b => b.label);
  renderDoughnutChart(containerId, labels, counts);
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
          postLoginChecks();
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
                postLoginChecks();
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

  // v4.21: 忘记密码 → 双通道选择
  var forgotRow = h('div', { style: { textAlign: 'center', marginTop: '14px' } });
  var forgotLink = h('a', {
    href: '#',
    style: { fontSize: '12px', color: '#6B7280', textDecoration: 'underline', cursor: 'pointer' },
    onclick: function(e) {
      e.preventDefault();
      showForgotPasswordModal();
    }
  }, '忘记密码？');
  forgotRow.appendChild(forgotLink);
  modal.appendChild(forgotRow);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  setTimeout(function() { document.getElementById('user-email').focus(); }, 100);
}

// ===== v4.21: 登录后安全检查（强制改密 + 密保引导）=====
async function postLoginChecks() {
  if (!currentUser) return;

  // 1. 检查是否需要强制改密
  try {
    var forceChange = await checkForcePasswordChange();
    if (forceChange) {
      showChangePasswordModalForce();
      return; // 先处理改密，不继续执行密保引导
    }
  } catch(e) { /* 非关键检查，失败继续 */ }

  // 2. 检查是否已设置密保
  try {
    var info = await getSecurityQuestionTexts(currentUser.id);
    if (!info || !info.questions) {
      // 延迟显示，避免和登录弹窗冲突
      setTimeout(function() {
        showSecuritySetupModal();
      }, 1200);
    }
  } catch(e) { /* 非关键检查 */ }
}

// 强制改密弹窗（管理员重置后触发）
function showChangePasswordModalForce() {
  var overlay = h('div', {
    style: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center' }
  });

  var modal = h('div', { style: { background: '#fff', borderRadius: '12px', padding: '28px 24px', width: '400px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' } });
  modal.appendChild(h('h3', { style: { margin: '0 0 4px 0', fontSize: '18px', color: '#DC2626' } }, '⚠️ 管理员已重置您的密码'));
  modal.appendChild(h('p', { style: { fontSize: '13px', color: '#64748B', margin: '0 0 20px 0' } }, '为保障账号安全，请立即设置一个新密码'));

  var msgDiv = h('div', { style: { fontSize: '13px', minHeight: '20px', marginBottom: '12px' } });
  modal.appendChild(msgDiv);

  var newPwd = h('input', { type: 'password', placeholder: '请输入新密码（至少6位）', style: {
    width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '12px'
  }});
  modal.appendChild(newPwd);

  var confirmPwd = h('input', { type: 'password', placeholder: '请再次输入新密码', style: {
    width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '12px'
  }});
  modal.appendChild(confirmPwd);

  modal.appendChild(h('button', {
    style: { padding: '12px 20px', background: '#DC2626', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, width: '100%' },
    onclick: async function() {
      var np = newPwd.value, cp = confirmPwd.value;
      if (np.length < 6) { msgDiv.textContent = '新密码至少 6 位'; msgDiv.style.color = '#991B1B'; return; }
      if (np !== cp) { msgDiv.textContent = '两次密码不一致'; msgDiv.style.color = '#991B1B'; return; }
      msgDiv.textContent = '正在修改密码...'; msgDiv.style.color = '#2563EB';
      try {
        await changePassword(np);
        await clearForcePasswordChange();
        msgDiv.textContent = '✅ 密码修改成功！'; msgDiv.style.color = '#059669';
        setTimeout(function() {
          overlay.remove();
          postLoginChecks(); // 改完密码后继续执行密保引导
        }, 1000);
      } catch(e) {
        msgDiv.textContent = '❌ ' + (e.message || '修改失败'); msgDiv.style.color = '#DC2626';
      }
    }
  }, '设置新密码并继续'));

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// ===== v4.21: 忘记密码弹窗（邮箱 + 密保双通道）=====
function showForgotPasswordModal() {
  var overlay = h('div', {
    style: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.4)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    onclick: function(e) { if (e.target === overlay) overlay.remove(); }
  });

  var modal = h('div', { style: { background: '#fff', borderRadius: '12px', padding: '28px 24px', width: '400px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' } });
  modal.appendChild(h('h3', { style: { margin: '0 0 8px 0', fontSize: '18px', color: '#1E293B' } }, '忘记密码'));
  modal.appendChild(h('p', { style: { fontSize: '13px', color: '#64748B', margin: '0 0 20px 0' } }, '请选择一种方式重置密码'));

  var msgDiv = h('div', { style: { fontSize: '13px', minHeight: '20px', marginBottom: '12px' } });
  modal.appendChild(msgDiv);

  var emailInput = h('input', {
    type: 'email', placeholder: '请输入您的邮箱地址',
    style: { width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '16px' }
  });
  modal.appendChild(emailInput);

  var btnRow = h('div', { style: { display: 'flex', gap: '8px', marginBottom: '12px' } });

  btnRow.appendChild(h('button', {
    style: { flex: 1, padding: '10px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 },
    onclick: async function() {
      var email = emailInput.value.trim();
      if (!email) { msgDiv.textContent = '请输入邮箱地址'; msgDiv.style.color = '#DC2626'; return; }
      msgDiv.textContent = '正在发送重置邮件...'; msgDiv.style.color = '#2563EB';
      try {
        await resetPassword(email);
        msgDiv.textContent = '✅ 重置邮件已发送，请检查收件箱（含垃圾箱）'; msgDiv.style.color = '#059669';
      } catch(e) {
        msgDiv.textContent = '❌ ' + (e.message || '发送失败'); msgDiv.style.color = '#DC2626';
      }
    }
  }, '📧 发送重置邮件'));

  btnRow.appendChild(h('button', {
    style: { flex: 1, padding: '10px', background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 },
    onclick: function() {
      var email = emailInput.value.trim();
      if (!email) { msgDiv.textContent = '请先输入邮箱地址以查找您的密保'; msgDiv.style.color = '#DC2626'; return; }
      overlay.remove();
      showSecurityResetFlow(email);
    }
  }, '🔐 密保验证重置'));

  modal.appendChild(btnRow);

  var hintDiv = h('div', { style: { fontSize: '12px', color: '#94A3B8', textAlign: 'center' } },
    '邮箱和密保都无法解决？请联系管理员协助重置');
  modal.appendChild(hintDiv);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  setTimeout(function() { emailInput.focus(); }, 100);
}

// ===== v4.21: 密保验证重置密码流程 =====
function showSecurityResetFlow(email) {
  var overlay = h('div', {
    style: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.4)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    onclick: function(e) { if (e.target === overlay) overlay.remove(); }
  });

  var modal = h('div', { style: { background: '#fff', borderRadius: '12px', padding: '28px 24px', width: '420px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' } });
  modal.appendChild(h('h3', { style: { margin: '0 0 4px 0', fontSize: '18px', color: '#1E293B' } }, '密保验证'));
  var msgDiv = h('div', { id: 'sec-msg', style: { fontSize: '13px', minHeight: '20px', marginBottom: '16px', color: '#64748B' } });
  modal.appendChild(msgDiv);

  var stepDiv = h('div', { id: 'sec-step' });
  modal.appendChild(stepDiv);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  renderSecurityQuestionStep(stepDiv, msgDiv, email, overlay);
}

var SECURITY_QUESTIONS_PRESET = [
  '您的出生地是？',
  '您的小学名称是？',
  '您的母亲名字是？',
  '您最喜欢的食物是？',
  '您的第一份工作是什么？',
  '您的宠物的名字是？',
  '您最要好的朋友名字是？'
];

function renderSecurityQuestionStep(stepDiv, msgDiv, email, overlay) {
  stepDiv.innerHTML = '';
  msgDiv.textContent = '正在查找密保信息...'; msgDiv.style.color = '#64748B';

  // 通过 email 找到 userId
  supabase.rpc('find_user_by_email', { p_email: email }).then(function(r) {
    if (r.error || !r.data) {
      msgDiv.textContent = '该邮箱未注册或未设置密保问题，请使用邮箱重置';
      msgDiv.style.color = '#DC2626';
      stepDiv.appendChild(h('button', {
        style: { marginTop: '12px', padding: '10px 20px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', width: '100%' },
        onclick: function() { overlay.remove(); showForgotPasswordModal(); }
      }, '返回选择其他方式'));
      return;
    }

    var userId = r.data.id;
    getSecurityQuestionTexts(userId).then(function(info) {
      if (!info || !info.questions) {
        msgDiv.textContent = '该账号未设置密保问题，请使用邮箱重置';
        msgDiv.style.color = '#DC2626';
        return;
      }

      if (info.locked) {
        var remainMin = Math.ceil((new Date(info.lockUntil) - new Date()) / 60000);
        msgDiv.textContent = '密保已锁定，请 ' + remainMin + ' 分钟后重试';
        msgDiv.style.color = '#DC2626';
        return;
      }

      msgDiv.textContent = '请回答以下 3 道密保问题（剩余机会：' + info.attemptsRemaining + ' 次）';
      msgDiv.style.color = '#64748B';

      var questions = info.questions;
      var inputs = [];

      questions.forEach(function(qHash, idx) {
        stepDiv.appendChild(h('label', { style: { display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginTop: idx === 0 ? '4px' : '16px', marginBottom: '4px' } },
          '问题 ' + (idx + 1) + '：您自己设置的密保问题'));

        // 尝试匹配预设库的问题文本
        var matchedQ = SECURITY_QUESTIONS_PRESET.find(function(pq) {
          return sha256(pq) === qHash;
        });
        stepDiv.appendChild(h('div', { style: { fontSize: '12px', color: '#94A3B8', marginBottom: '4px' } },
          matchedQ ? ('（' + matchedQ + '）') : '（自定义问题，请输入您最初设置的答案）'));

        var inp = h('input', {
          type: 'text',
          placeholder: '请输入答案',
          style: { width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '4px' }
        });
        inputs.push(inp);
        stepDiv.appendChild(inp);
      });

      var verifyBtn = h('button', {
        style: { marginTop: '20px', padding: '12px 20px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, width: '100%' },
        onclick: function() {
          var answers = inputs.map(function(inp) { return inp.value.trim(); });
          if (answers.some(function(a) { return !a; })) {
            msgDiv.textContent = '请回答所有密保问题'; msgDiv.style.color = '#DC2626'; return;
          }

          verifyBtn.disabled = true;
          verifyBtn.textContent = '验证中...';
          msgDiv.textContent = '正在验证...'; msgDiv.style.color = '#2563EB';

          verifySecurityAnswers(userId, answers).then(function(result) {
            if (result.success) {
              showNewPasswordStep(stepDiv, msgDiv, userId, overlay);
            } else {
              verifyBtn.disabled = false;
              verifyBtn.textContent = '重新验证';
              msgDiv.textContent = '❌ ' + (result.error || '验证失败'); msgDiv.style.color = '#DC2626';

              if (result.error && result.error.includes('锁定')) {
                verifyBtn.style.display = 'none';
                stepDiv.appendChild(h('button', {
                  style: { marginTop: '12px', padding: '12px 20px', background: '#E2E8F0', color: '#475569', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', width: '100%' },
                  onclick: function() { overlay.remove(); showForgotPasswordModal(); }
                }, '返回选择其他方式'));
              }
            }
          });
        }
      });
      stepDiv.appendChild(verifyBtn);
    });
  }).catch(function() {
    msgDiv.textContent = '查找账号失败，请确认邮箱是否正确';
    msgDiv.style.color = '#DC2626';
  });
}

function showNewPasswordStep(stepDiv, msgDiv, userId, overlay) {
  stepDiv.innerHTML = '';
  msgDiv.textContent = '✅ 密保验证通过！请设置新密码';
  msgDiv.style.color = '#059669';

  var newPwd = h('input', {
    type: 'password', placeholder: '请输入新密码（至少6位）',
    style: { width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '12px', marginTop: '12px' }
  });
  stepDiv.appendChild(newPwd);

  var confirmPwd = h('input', {
    type: 'password', placeholder: '请再次输入新密码',
    style: { width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '12px' }
  });
  stepDiv.appendChild(confirmPwd);

  stepDiv.appendChild(h('button', {
    style: { marginTop: '8px', padding: '12px 20px', background: '#059669', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, width: '100%' },
    onclick: async function() {
      var np = newPwd.value;
      var cp = confirmPwd.value;
      if (np.length < 6) { msgDiv.textContent = '新密码至少 6 位'; msgDiv.style.color = '#DC2626'; return; }
      if (np !== cp) { msgDiv.textContent = '两次密码输入不一致'; msgDiv.style.color = '#DC2626'; return; }
      msgDiv.textContent = '正在重置密码...'; msgDiv.style.color = '#2563EB';
      try {
        await changePasswordAfterSecurityVerification(userId, np);
        msgDiv.textContent = '✅ 密码重置成功！请使用新密码登录';
        msgDiv.style.color = '#059669';
        stepDiv.appendChild(h('button', {
          style: { marginTop: '12px', padding: '12px 20px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', width: '100%' },
          onclick: function() { overlay.remove(); }
        }, '返回登录'));
      } catch(e) {
        msgDiv.textContent = '❌ ' + (e.message || '重置失败'); msgDiv.style.color = '#DC2626';
      }
    }
  }));
}

// ===== v4.21: 密保问题设置引导弹窗 =====
var SECURITY_QUESTIONS_PRESET_LABELS = SECURITY_QUESTIONS_PRESET.map(function(q) {
  return { label: q, value: q };
});

function showSecuritySetupModal() {
  var overlay = h('div', {
    style: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center' }
  });

  var modal = h('div', { style: { background: '#fff', borderRadius: '12px', padding: '28px 24px', width: '480px', maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' } });
  modal.appendChild(h('h3', { style: { margin: '0 0 4px 0', fontSize: '18px', color: '#1E293B' } }, '🔐 设置密保问题'));
  modal.appendChild(h('p', { style: { fontSize: '13px', color: '#64748B', margin: '0 0 16px 0' } }, '设置后可绕过邮箱直接重置密码。建议使用只有您自己知道的答案。'));

  var msgDiv = h('div', { style: { fontSize: '13px', minHeight: '20px', marginBottom: '12px' } });
  modal.appendChild(msgDiv);

  var questionRows = [];
  for (var i = 0; i < 3; i++) {
    var label = h('label', {
      style: { display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginTop: i === 0 ? '0' : '16px', marginBottom: '6px' }
    }, '密保问题 ' + (i + 1) + '（从预设库选择或自定义）');
    modal.appendChild(label);

    var select = h('select', {
      style: { width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '6px', color: '#374151' }
    });
    select.appendChild(h('option', { value: '' }, '— 选择一个预设问题 —'));
    SECURITY_QUESTIONS_PRESET.forEach(function(q) { select.appendChild(h('option', { value: q }, q)); });
    select.appendChild(h('option', { value: '__custom__' }, '自定义问题...'));

    var customInput = h('input', {
      type: 'text', placeholder: '请输入您的自定义问题',
      style: { width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '6px', display: 'none' }
    });

    var answerInput = h('input', {
      type: 'text', placeholder: '请输入答案',
      style: { width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }
    });

    select.onchange = function() {
      customInput.style.display = select.value === '__custom__' ? 'block' : 'none';
    };

    modal.appendChild(select);
    modal.appendChild(customInput);
    modal.appendChild(answerInput);
    questionRows.push({ select: select, customInput: customInput, answerInput: answerInput });
  }

  var btnRow = h('div', { style: { display: 'flex', gap: '8px', marginTop: '20px' } });

  btnRow.appendChild(h('button', {
    style: { flex: 1, padding: '11px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 },
    onclick: async function() {
      var questions = [];
      var allValid = true;
      questionRows.forEach(function(row, idx) {
        var qText = row.select.value;
        if (qText === '__custom__') {
          qText = row.customInput.value.trim();
          if (!qText) { allValid = false; msgDiv.textContent = '请填写第 ' + (idx + 1) + ' 道自定义问题'; msgDiv.style.color = '#DC2626'; return; }
        }
        if (!qText) { allValid = false; msgDiv.textContent = '请选择或填写第 ' + (idx + 1) + ' 道密保问题'; msgDiv.style.color = '#DC2626'; return; }
        var answer = row.answerInput.value.trim();
        if (!answer) { allValid = false; msgDiv.textContent = '请填写第 ' + (idx + 1) + ' 道密保问题的答案'; msgDiv.style.color = '#DC2626'; return; }
        questions.push(qText);
      });

      if (!allValid) return;

      // 保存：答案以问题文本的哈希形式存储
      // 实际存储的是答案哈希数组（服务端验证用），问题文本用于后续展示
      var answersForHash = questions.map(function(q, idx) {
        return questionRows[idx].answerInput.value.trim();
      });

      msgDiv.textContent = '正在保存...'; msgDiv.style.color = '#2563EB';
      try {
        // 使用问题文本的SHA256作为"问题key"，答案做服务端验证
        await saveSecurityQuestions(answersForHash);
        msgDiv.textContent = '✅ 密保问题设置成功！'; msgDiv.style.color = '#059669';
        setTimeout(function() { overlay.remove(); }, 1500);
      } catch(e) {
        msgDiv.textContent = '❌ 保存失败：' + (e.message || '未知错误'); msgDiv.style.color = '#DC2626';
      }
    }
  }, '保存密保'));

  btnRow.appendChild(h('button', {
    style: { flex: 1, padding: '11px 16px', background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
    onclick: function() { overlay.remove(); }
  }, '暂不设置'));

  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// ===== v4.20: 修改密码弹窗 =====
function showChangePasswordModal() {
  var overlay = h('div', {
    style: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.4)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    onclick: function(e) { if (e.target === overlay) overlay.remove(); }
  });

  var modal = h('div', { style: { background: '#fff', borderRadius: '12px', padding: '28px 24px', width: '380px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', position: 'relative' } });
  
  modal.appendChild(h('button', {
    style: { position: 'absolute', top: '12px', right: '14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#94A3B8', lineHeight: 1, padding: '4px' },
    onclick: function() { overlay.remove(); }
  }, '✕'));

  modal.appendChild(h('h3', { style: { margin: '0 0 4px 0', fontSize: '18px', color: '#1E293B' } }, '修改密码'));
  modal.appendChild(h('p', { style: { fontSize: '13px', color: '#64748B', margin: '0 0 20px 0' } },
    '当前账号：' + (currentUser ? currentUser.email : '未登录')
  ));

  var oldPwdInput = h('input', { type: 'password', placeholder: '请输入旧密码', style: {
    width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '12px'
  }});
  modal.appendChild(oldPwdInput);

  var newPwdInput = h('input', { type: 'password', placeholder: '请输入新密码（至少6位）', style: {
    width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '12px'
  }});
  modal.appendChild(newPwdInput);

  var confirmPwdInput = h('input', { type: 'password', placeholder: '请再次输入新密码', style: {
    width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '8px'
  }});
  modal.appendChild(confirmPwdInput);

  var msgDiv = h('div', { style: { fontSize: '13px', minHeight: '20px', marginBottom: '8px' } });
  modal.appendChild(msgDiv);

  var btnRow = h('div', { style: { display: 'flex', gap: '8px', marginTop: '4px' } });
  btnRow.appendChild(h('button', {
    style: { flex: 1, padding: '10px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
    onclick: async function() {
      var oldPwd = oldPwdInput.value;
      var newPwd = newPwdInput.value;
      var confirmPwd = confirmPwdInput.value;
      if (!oldPwd) { msgDiv.textContent = '请输入旧密码'; msgDiv.style.color = '#DC2626'; return; }
      if (newPwd.length < 6) { msgDiv.textContent = '新密码至少6位'; msgDiv.style.color = '#DC2626'; return; }
      if (newPwd !== confirmPwd) { msgDiv.textContent = '两次输入的密码不一致'; msgDiv.style.color = '#DC2626'; return; }
      if (oldPwd === newPwd) { msgDiv.textContent = '新密码不能与旧密码相同'; msgDiv.style.color = '#DC2626'; return; }
      
      msgDiv.textContent = '正在验证身份...'; msgDiv.style.color = '#2563EB';
      try {
        await reauthenticate(oldPwd);
        msgDiv.textContent = '正在修改密码...'; msgDiv.style.color = '#2563EB';
        await changePassword(newPwd);
        msgDiv.textContent = '✅ 密码修改成功！请重新登录'; msgDiv.style.color = '#059669';
        setTimeout(async function() {
          await signOut();
          appState.currentUser = null;
          overlay.remove();
          renderFrontend();
          showUserLoginModal();
        }, 1500);
      } catch(err) {
        msgDiv.textContent = err.message || '修改失败，请重试';
        msgDiv.style.color = '#DC2626';
      }
    }
  }, '确认修改'));

  btnRow.appendChild(h('button', {
    style: { flex: 1, padding: '10px', background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
    onclick: function() { overlay.remove(); }
  }, '取消'));

  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  setTimeout(function() { oldPwdInput.focus(); }, 100);
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
    categoryManage: false, // v5.8.3: 子管理员默认关闭分类管理
    ratingManage: true, dashboardManage: true, observationManage: true,
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
  
  // v5.6.9: 手机版切换按钮（管理后台，v5.8.3: 仅当管理员启用手机端视图时显示）
  var mobileEnabled = !(appState.db && appState.db.mobileViewEnabled === false);
  if (mobileEnabled) {
    var isMobileAdmin = document.body.classList.contains('mobile-mode');
    headerActions.appendChild(h('button', {
      className: 'btn btn-sm mobile-toggle-btn' + (isMobileAdmin ? ' active' : ''),
      onclick: function() { toggleMobileMode(); }
    }, isMobileAdmin ? '💻 桌面版' : '📱 手机版'));
  }
  
  // 子管理员可修改自己的密码
  if (!isMaster) {
    headerActions.appendChild(h('button', {
      className: 'btn btn-sm',
      style: { background:'rgba(255,255,255,0.15)', color:'white', fontSize:'12px', border:'1px solid rgba(255,255,255,0.2)', marginRight:'4px' },
      onclick: function() { showSubAdminChangePasswordModal(); }
    }, '🔑 修改密码'));
  }

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
    { id: 'observation', name: '观察库', perm: 'observationManage' },
    { id: 'dashboard', name: '仪表盘', perm: 'dashboardManage' },
    { id: 'categories', name: '分类管理', perm: 'categoryManage' },
    { id: 'permissions', name: '权限管理', perm: 'permissionManage' },
    { id: 'users', name: '👥 用户管理', perm: 'systemSettings' },
    { id: 'settings', name: '系统设置', perm: 'systemSettings' },
    { id: 'monthlyReport', name: '📊 月度报告', perm: 'systemSettings' }
  ];
  
  const visibleTabs = isMaster ? allTabs : allTabs.filter(t => hasPermission(t.perm));
  
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
    case 'dashboard': renderDashboardTab(panel); break;
    case 'categories': renderCategoriesTab(panel); break;
    case 'observation': renderObservationTab(panel); break;
    case 'permissions': renderPermissionsTab(panel); break;
    case 'users': renderUsersTab(panel); break;
    case 'settings': renderSettingsTab(panel); break;
    case 'monthlyReport': renderMonthlyReportTab(panel); break;
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
    value: appState.adminSearchQuery,
    oninput: (e) => {
      appState.adminSearchQuery = e.target.value;
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
    onclick: () => exportToExcel()
  }, '📥 导出Excel'));
  
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
  
  // v5.8.4: 排序控件
  if (!appState._adminExpertSort) appState._adminExpertSort = 'default';
  var sortRow = h('div', { style: { display:'flex', gap:'8px', alignItems:'center', padding:'4px 0 8px', flexWrap:'wrap' } });
  sortRow.appendChild(h('span', { style:{ fontSize:'12px', color:'var(--text-secondary)', fontWeight:'600' } }, '排序：'));
  var expertSortOpts = [
    { id: 'default', name: '默认（姓名）' },
    { id: 'rating', name: '综合评分 ▼' },
    { id: 'time', name: '录入时间 ▼' },
    { id: 'name', name: '姓名 A-Z' }
  ];
  expertSortOpts.forEach(function(opt) {
    var btn = h('button', {
      className: 'btn btn-sm ' + (appState._adminExpertSort === opt.id ? 'btn-primary' : 'btn-secondary'),
      style: { fontSize:'11px' },
      onclick: function() {
        appState._adminExpertSort = opt.id;
        renderExpertsTab(document.getElementById('admin-panel'));
      }
    }, opt.name);
    sortRow.appendChild(btn);
  });
  panel.appendChild(sortRow);
  
  // Filter data
  let experts = db.experts;
  if (appState.adminSearchQuery) {
    const q = appState.adminSearchQuery.toLowerCase();
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
  
  // v5.8.4: 排序
  var es = appState._adminExpertSort || 'default';
  if (es === 'rating') {
    experts.sort(function(a,b) { return (b.scores.overall||0) - (a.scores.overall||0); });
  } else if (es === 'time') {
    experts.sort(function(a,b) { return new Date(b.createdAt||0) - new Date(a.createdAt||0); });
  } else if (es === 'name') {
    experts.sort(function(a,b) { return (a.name||'').localeCompare(b.name||'', 'zh'); });
  } // default: no sort, keep original order
  
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

  // v5.2: Import/Export buttons
  toolbar.appendChild(h('button', {
    className: 'btn btn-secondary btn-sm',
    title: '导出合作项目为Excel',
    onclick: () => exportProjectsXlsx()
  }, '📥 导出'));

  toolbar.appendChild(h('button', {
    className: 'btn btn-secondary btn-sm',
    title: '批量导入合作项目',
    onclick: () => showProjectImportDialog()
  }, '📤 导入'));

  toolbar.appendChild(h('button', {
    className: 'btn btn-primary btn-sm',
    onclick: () => showProjectForm(null)
  }, '+ 新建项目'));

  panel.appendChild(toolbar);

  // v5.8.4: 排序控件
  if (!appState._adminProjectSort) appState._adminProjectSort = 'default';
  var projSortRow = h('div', { style: { display:'flex', gap:'8px', alignItems:'center', padding:'4px 0 8px', flexWrap:'wrap' } });
  projSortRow.appendChild(h('span', { style:{ fontSize:'12px', color:'var(--text-secondary)', fontWeight:'600' } }, '排序：'));
  var projSortOpts = [
    { id: 'default', name: '默认（年份▼）' },
    { id: 'name', name: '项目名称 A-Z' },
    { id: 'year', name: '年份 ▼' },
    { id: 'month', name: '月份（年分组）' }
  ];
  projSortOpts.forEach(function(opt) {
    var btn = h('button', {
      className: 'btn btn-sm ' + (appState._adminProjectSort === opt.id ? 'btn-primary' : 'btn-secondary'),
      style: { fontSize:'11px' },
      onclick: function() {
        appState._adminProjectSort = opt.id;
        renderProjectsTab(document.getElementById('admin-panel'));
      }
    }, opt.name);
    projSortRow.appendChild(btn);
  });
  panel.appendChild(projSortRow);

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
  // v5.8.4: 动态排序
  var ps = appState._adminProjectSort || 'default';
  if (ps === 'name') {
    filtered.sort(function(a,b) { return (a.title||'').localeCompare(b.title||'', 'zh'); });
  } else if (ps === 'year') {
    filtered.sort(function(a,b) { return b.year - a.year || a.id.localeCompare(b.id); });
  } else if (ps === 'month') {
    // 年分组（不跨年排序），每年内按月份升序，未关联月份的前置
    filtered.sort(function(a,b) {
      if (a.year !== b.year) return b.year - a.year;
      var ma = a.month || 0, mb = b.month || 0;
      if (ma === 0 && mb === 0) return (a.title||'').localeCompare(b.title||'', 'zh');
      if (ma === 0) return -1;
      if (mb === 0) return 1;
      return ma - mb;
    });
  } else {
    // default: year desc, then id
    filtered.sort(function(a,b) { return b.year - a.year || a.id.localeCompare(b.id); });
  }

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

// ===== v5.2: 合作项目导入/导出功能 =====

// v5.8.2: 导出合作项目为 Excel (.xlsx)
function exportProjectsXlsx() {
  if (typeof XLSX === 'undefined') { toast('Excel组件未加载，请刷新页面后重试', 'error'); return; }
  var db = appState.db;
  var projects = db.yiliProjects || [];
  var headers = ['项目名称', '关联讲师', '合作年份', '合作月份', '满意度分值', '满意度量程', '项目描述', '前端显示', '创建时间'];
  var rows = [headers];
  projects.forEach(function(p) {
    var expName = p.expertId ? getProjectExpertName(p.expertId) : (p.pendingExpertName || '\u5F85\u5173\u8054');
    var satVal = p.satisfaction && p.satisfaction.value != null ? p.satisfaction.value : '';
    var satScale = p.satisfaction && p.satisfaction.scale ? p.satisfaction.scale : '';
    rows.push([p.title || '', expName, p.year || '', p.month || '', satVal, satScale, p.desc || '', p.visible ? '\u662F' : '\u5426', p.createdAt || '']);
  });
  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:25},{wch:15},{wch:10},{wch:10},{wch:10},{wch:10},{wch:35},{wch:10},{wch:20}];
  XLSX.utils.book_append_sheet(wb, ws, '\u5408\u4F5C\u9879\u76EE');
  XLSX.writeFile(wb, '\u5408\u4F5C\u9879\u76EE_' + new Date().toISOString().slice(0,10) + '.xlsx');
  toast('\u9879\u76EE\u6570\u636E\u5BFC\u51FA\u6210\u529F', 'success');
}

// 保留旧 CSV 导出作为备用（v5.8.2）
function exportProjectsCSV() {
  try { exportProjectsXlsx(); } catch(err) {}
}

// 下载合作项目导入模板
function downloadProjectTemplate() {
  var headers = ['项目名称', '关联讲师姓名', '合作年份', '合作月份', '满意度分值', '满意度量程', '项目描述', '前端显示'];
  var descRow = [
    '必填，项目名称或培训主题',
    '填写已入库专家姓名，系统自动匹配；未入库人员填「待入库讲师」',
    '合作年份，如 2025',
    '合作月份（1-12），可不填',
    '满意度原始分值，如 8.5（不填则留空）',
    '满意度量程，填 5 或 10（不填则留空）',
    '项目简要描述（可选）',
    '前端是否可见，填「是」或「否」'
  ];
  var exampleRows = [
    ['数字化转型专题培训', '张三', 2025, 6, 8.5, 10, '面向中高层的数字化转型培训，约50人参与', '是'],
    ['精益生产工作坊', '李四', 2024, 3, 4.2, 5, '生产现场改善专题，为期2天', '是'],
    ['待关联示例', '待入库讲师', 2026, '', '', '', '此项目关联讲师尚未入库', '否']
  ];

  // v5.8.2: 生成 .xlsx 模板
  if (typeof XLSX !== 'undefined') {
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet([headers, descRow].concat(exampleRows));
    ws['!cols'] = [{wch:25},{wch:15},{wch:10},{wch:10},{wch:10},{wch:10},{wch:35},{wch:10}];
    XLSX.utils.book_append_sheet(wb, ws, '合作项目导入模板');
    XLSX.writeFile(wb, '合作项目导入模板.xlsx');
    toast('模板已下载（.xlsx），请直接填写后上传导入', 'success');
    return;
  }
  // fallback: CSV
  function csvEscape(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
  var rows = [headers.join(',')];
  rows.push('"' + descRow.map(function(d) { return (d || '').replace(/"/g, '""'); }).join('","') + '"');
  exampleRows.forEach(function(r) { rows.push(r.map(csvEscape).join(',')); });
  var blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, '合作项目导入模板.csv');
  toast('模板已下载（.csv），建议用 Excel/WPS 编辑后保存为 .xlsx 再导入', 'success');
}

// 合作项目批量导入对话框
function showProjectImportDialog() {
  var db = appState.db;
  var overlay = h('div', { className: 'modal-overlay', onclick: function(e) { if (e.target === overlay) overlay.remove(); } });
  var content = h('div', { className: 'modal-content', style: { maxWidth: '540px' } });

  var header = h('div', { className: 'modal-header' });
  header.appendChild(h('div', { className: 'modal-title' }, '批量导入合作项目'));
  header.appendChild(h('button', { className: 'modal-close', onclick: function() { overlay.remove(); } }, '\u2715'));
  content.appendChild(header);

  var body = h('div', { className: 'modal-body' });
  body.appendChild(h('p', { style: { marginBottom:'16px', fontSize:'13px', color:'var(--text-secondary)' } }, '系统会自动匹配讲师姓名，未匹配到则标记为「待关联」。模板中已包含填写说明和示例。'));

  // 模板下载
  body.appendChild(h('h4', { style: 'font-size:14px;margin-bottom:8px' }, '\u2460 下载导入模板'));
  body.appendChild(h('div', { style: 'font-size:12px;color:var(--text-muted);margin-bottom:8px' }, '模板包含填写说明和示例数据，参照格式填写后导入。'));
  body.appendChild(h('button', {
    className: 'btn btn-secondary btn-sm',
    style: { marginBottom: '20px' },
    onclick: function() { downloadProjectTemplate(); }
  }, '\uD83D\uDCE5 下载导入模板'));

  // 文件上传
  body.appendChild(h('h4', { style: 'font-size:14px;margin-bottom:8px' }, '\u2461 选择文件并导入'));
  body.appendChild(h('div', { style: 'font-size:12px;color:var(--text-muted);margin-bottom:8px' }, '\u63A8\u8350 .xlsx \u683C\u5F0F\uFF0C\u4E5F\u652F\u6301 CSV\u3002\u4E0B\u8F7D\u6A21\u677F\u540E\u76F4\u63A5\u4FDD\u5B58\u4E3A .xlsx \u4E0A\u4F20\u3002'));
  var fileInput = h('input', { type: 'file', accept: '.xlsx,.xls,.csv', id: 'project-import-file', style: { marginBottom: '12px' } });
  body.appendChild(fileInput);

  body.appendChild(h('button', {
    className: 'btn btn-primary btn-sm',
    style: { marginBottom: '10px' },
    onclick: function() {
      var file = document.getElementById('project-import-file').files[0];
      if (!file) { toast('\u8BF7\u9009\u62E9\u6587\u4EF6', 'error'); return; }
      var ext = file.name.split('.').pop().toLowerCase();

      if (ext === 'xlsx' || ext === 'xls') {
        var reader = new FileReader();
        reader.onload = function(e) {
          try {
            var projects = parseXlsxToProjects(new Uint8Array(e.target.result));
            if (projects.length > 0) processProjectImport(projects, overlay);
            else toast('Excel\u4E2D\u672A\u627E\u5230\u6709\u6548\u9879\u76EE\u6570\u636E\uFF0C\u8BF7\u786E\u8BA4\u7B2C\u4E00\u5217\u4E3A\u300C\u9879\u76EE\u540D\u79F0\u300D', 'error');
          } catch(err) { toast('\u6587\u4EF6\u89E3\u6790\u5931\u8D25\uFF1A' + err.message, 'error'); }
        };
        reader.readAsArrayBuffer(file);
        return;
      }

      var csvReader = new FileReader();
      csvReader.onload = function(e) {
        try {
          var projects = parseCSVToProjects(e.target.result);
          if (projects.length > 0) { processProjectImport(projects, overlay); }
          else { tryProjectGBK(file, e.target.result); }
        } catch(err) { tryProjectGBK(file, e.target.result); }
      };
      csvReader.readAsText(file, 'utf-8');

      function tryProjectGBK(file, utf8Result) {
        var hasGarbled = (utf8Result.indexOf('\uFFFD') > -1);
        if (!hasGarbled) { toast('CSV\u4E2D\u672A\u627E\u5230\u6709\u6548\u9879\u76EE\u6570\u636E\uFF0C\u8BF7\u4F7F\u7528 Excel \u683C\u5F0F\u5BFC\u5165\u3002', 'error'); return; }
        var gbkReader = new FileReader();
        gbkReader.onload = function(ev) {
          var projects = parseCSVToProjects(ev.target.result);
          if (projects.length > 0) { processProjectImport(projects, overlay); toast('\u5DF2\u81EA\u52A8\u8BC6\u522B GBK \u7F16\u7801\u5E76\u5BFC\u5165', 'success'); }
          else toast('\u672A\u627E\u5230\u6709\u6548\u9879\u76EE\u6570\u636E\uFF0C\u8BF7\u4F7F\u7528 Excel \u683C\u5F0F\u5BFC\u5165\u3002', 'error');
        };
        gbkReader.readAsText(file, 'gbk');
      }
    }
  }, '\u4E0A\u4F20\u5E76\u5BFC\u5165'));

  // === 处理导入逻辑 ===
  function processProjectImport(newProjects, importOverlay) {
    if (!db.yiliProjects) db.yiliProjects = [];
    var imported = 0;
    var pendingCount = 0;
    var now = new Date().toISOString();

    newProjects.forEach(function(np) {
      // 按姓名匹配已有讲师
      var expertId = null;
      var pendingExpertName = '';
      if (np.expertName && np.expertName !== '待入库讲师') {
        var searchName = np.expertName.trim();
        var match = db.experts.find(function(e) { return e.name === searchName || e.name.indexOf(searchName) === 0; });
        if (match) {
          expertId = match.id;
        } else {
          pendingExpertName = np.expertName;
          pendingCount++;
        }
      } else if (np.expertName === '待入库讲师') {
        pendingExpertName = np.expertName;
        pendingCount++;
      }

      var id = 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6) + '_' + imported;

      db.yiliProjects.push({
        id: id,
        title: np.title || '',
        expertId: expertId,
        pendingExpertName: pendingExpertName,
        year: np.year || new Date().getFullYear(),
        month: np.month || null,
        satisfaction: np.satisfaction,
        desc: np.desc || '',
        visible: np.visible !== false,
        createdAt: now,
        createdBy: appState.currentUser ? appState.currentUser.email : ''
      });
      imported++;
    });

    saveDB(db);
    renderProjectsTab(document.getElementById('admin-panel'));

    var msg = '成功导入 ' + imported + ' 条项目';
    if (pendingCount > 0) msg += '（其中 ' + pendingCount + ' 条待关联讲师）';
    toast(msg, 'success');
    importOverlay.remove();
  }

  content.appendChild(body);
  overlay.appendChild(content);
  document.body.appendChild(overlay);
}

// v5.8.2: 解析 Excel (.xlsx/.xls) 为合作项目对象数组
function parseXlsxToProjects(data) {
  if (typeof XLSX === 'undefined') { toast('Excel组件未加载，请刷新后重试', 'error'); return []; }
  var wb, projects = [];
  try { wb = XLSX.read(data, { type: 'array' }); } catch(e) { toast('Excel文件解析失败', 'error'); return []; }
  var sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  var ws = wb.Sheets[sheetName];
  var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (rows.length < 2) return [];
  var header = rows[0].map(function(h) { return String(h).trim(); });
  var col = {};
  header.forEach(function(h, i) {
    var n = h.toLowerCase();
    if (!col.title && (n.indexOf('\u9879\u76EE\u540D\u79F0') !== -1 || n === 'title')) col.title = i;
    else if (!col.expertName && (n.indexOf('\u8BB2\u5E08') !== -1 || n.indexOf('\u59D3\u540D') !== -1)) col.expertName = i;
    else if (!col.year && (n.indexOf('\u5E74\u4EFD') !== -1 || n === 'year')) col.year = i;
    else if (!col.month && (n.indexOf('\u6708\u4EFD') !== -1 || n === 'month')) col.month = i;
    else if (!col.scale && (n.indexOf('\u91CF\u7A0B') !== -1 || n.indexOf('\u5236') !== -1)) col.scale = i;
    else if (!col.satValue && (n.indexOf('\u5206\u503C') !== -1)) col.satValue = i;
    else if (!col.desc && (n.indexOf('\u63CF\u8FF0') !== -1 || n === 'desc')) col.desc = i;
    else if (!col.visible && (n.indexOf('\u663E\u793A') !== -1 || n.indexOf('\u53EF\u89C1') !== -1)) col.visible = i;
  });
  if (col.satValue == null) {
    header.forEach(function(h, i) { if (col.satValue == null && h.indexOf('\u6EE1\u610F\u5EA6') !== -1 && h.indexOf('\u91CF\u7A0B') === -1) col.satValue = i; });
  }
  for (var i = 1; i < rows.length; i++) {
    var vals = rows[i].map(function(v) { return String(v).trim(); });
    var title = col.title != null ? (vals[col.title] || '') : '';
    if (title && /^(必填|填写已入库|合作年份|合作月份|满意度原始|满意度量程|项目简要|前端)/.test(title)) continue;
    if (!title) continue;
    var expertName = col.expertName != null ? (vals[col.expertName] || '') : '';
    var year = col.year != null ? (parseInt(vals[col.year]) || new Date().getFullYear()) : new Date().getFullYear();
    var month = col.month != null ? (parseInt(vals[col.month]) || null) : null;
    var satisfaction = null;
    if (col.satValue != null) {
      var satVal = parseFloat(vals[col.satValue]);
      if (!isNaN(satVal) && satVal > 0) {
        var scale = col.scale != null ? (parseInt(vals[col.scale]) || 10) : 10;
        satisfaction = { value: satVal, scale: scale };
      }
    }
    var desc = col.desc != null ? (vals[col.desc] || '') : '';
    var visible = col.visible != null ? !(vals[col.visible] === '\u5426' || vals[col.visible] === 'false' || vals[col.visible] === '0') : true;
    projects.push({ title: title, expertName: expertName, year: year, month: month, satisfaction: satisfaction, desc: desc, visible: visible });
  }
  return projects;
}

// 解析 CSV 文本为合作项目对象数组
function parseCSVToProjects(csvText) {
  var lines = csvText.split(/\r?\n/).filter(function(l) { return l.trim(); });
  if (lines.length < 2) return [];

  // 解析表头
  var header = lines[0].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(function(h) { return h.replace(/^"|"$/g, '').trim(); });

  // 列索引映射
  var col = {};
  header.forEach(function(h, i) {
    var n = h.toLowerCase();
    if (!col.title && (n.indexOf('项目名称') !== -1 || n === 'title')) col.title = i;
    else if (!col.expertName && (n.indexOf('讲师') !== -1 || n.indexOf('姓名') !== -1)) col.expertName = i;
    else if (!col.year && (n.indexOf('年份') !== -1 || n === 'year')) col.year = i;
    else if (!col.month && (n.indexOf('月份') !== -1 || n === 'month')) col.month = i;
    else if (!col.scale && (n.indexOf('量程') !== -1 || n.indexOf('制') !== -1)) col.scale = i;
    else if (!col.satValue && (n.indexOf('分值') !== -1)) col.satValue = i;
    else if (!col.desc && (n.indexOf('描述') !== -1 || n === 'desc')) col.desc = i;
    else if (!col.visible && (n.indexOf('显示') !== -1 || n.indexOf('可见') !== -1)) col.visible = i;
  });

  // 兜底: 如果分值和量程尚未分开匹配，把满意度列同时用于两者
  if (col.satValue == null) {
    header.forEach(function(h, i) {
      if (col.satValue == null && h.indexOf('满意度') !== -1 && h.indexOf('量程') === -1) col.satValue = i;
    });
  }

  var projects = [];
  for (var i = 1; i < lines.length; i++) {
    var vals = lines[i].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(function(v) { return v.replace(/^"|"$/g, '').trim(); });

    var title = col.title != null ? (vals[col.title] || '') : '';
    // 跳过模板说明行（第一列包含"必填"等填写说明）
    if (title && /^(必填|填写已入库|合作年份|合作月份|满意度原始|满意度量程|项目简要|前端)/.test(title)) continue;
    if (!title) continue;

    var expertName = col.expertName != null ? (vals[col.expertName] || '') : '';
    var year = col.year != null ? (parseInt(vals[col.year]) || new Date().getFullYear()) : new Date().getFullYear();
    var month = col.month != null ? (parseInt(vals[col.month]) || null) : null;

    // 解析满意度 — 存储原始值+量程，不做换算
    var satisfaction = null;
    if (col.satValue != null) {
      var satVal = parseFloat(vals[col.satValue]);
      if (!isNaN(satVal) && satVal > 0) {
        var scale = col.scale != null ? (parseInt(vals[col.scale]) || 10) : 10;
        satisfaction = { value: satVal, scale: scale };
      }
    }

    var desc = col.desc != null ? (vals[col.desc] || '') : '';
    var visible = col.visible != null ? !(vals[col.visible] === '\u5426' || vals[col.visible] === 'false' || vals[col.visible] === '0') : true;

    projects.push({
      title: title,
      expertName: expertName,
      year: year,
      month: month,
      satisfaction: satisfaction,
      desc: desc,
      visible: visible
    });
  }
  return projects;
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

  // v4.25 fix: track last input value for auto-match on blur
  let lastInputValue = expInput.value || '';

  expInput.oninput = function() {
    lastInputValue = this.value;
    // Only clear selection if user actually changed the text (not from dropdown click)
    if (selectedExpertId) {
      const matchedExpert = db.experts.find(e => e.id === selectedExpertId);
      if (!matchedExpert || this.value !== matchedExpert.name) {
        selectedExpertId = null;
      }
    }
    rebuildDropdown(this.value);
  };
  expInput.onfocus = function() { rebuildDropdown(this.value); };
  // v4.25 fix: onblur auto-match by exact name
  expInput.onblur = function() {
    const val = (this.value || '').trim();
    // Auto-select expert if name exactly matches
    if (!selectedExpertId && val) {
      const exactMatch = db.experts.find(e => e.name === val);
      if (exactMatch) {
        selectedExpertId = exactMatch.id;
      }
    }
    setTimeout(() => { dropdown.style.display = 'none'; }, 200);
  };
  // v4.25: Enter key selects first match
  expInput.onkeydown = function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const firstItem = dropdown.querySelector('div[style*="cursor:pointer"]');
      if (firstItem && firstItem.onclick) {
        firstItem.click();
      } else if (this.value.trim()) {
        // Fallback: try to find exact match
        const match = db.experts.find(e => e.name === this.value.trim());
        if (match) {
          selectedExpertId = match.id;
          this.value = match.name;
          dropdown.style.display = 'none';
          pendingNameInput.style.display = 'none';
        }
      }
    }
  };

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
  const currentScale = (project && project.satisfaction && project.satisfaction.scale) || 10;
  const satInput = h('input', {
    type: 'number',
    id: 'proj-form-sat-value',
    placeholder: currentScale === 5 ? '如 4.5' : '如 8.5',
    step: '0.01',
    min: '0',
    max: String(currentScale),
    value: project && project.satisfaction && project.satisfaction.value
      ? project.satisfaction.value  // v4.26 fix: 存储的就是原始值，直接回显
      : '',
    style: 'width:100px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px'
  });
  satRow.appendChild(satInput);
  const satScaleSel = h('select', {
    id: 'proj-form-sat-scale',
    style: 'width:90px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px',
    // v4.26: 切换量程时同步更新 max 和 placeholder
    onchange: function() {
      const scale = parseInt(this.value);
      satInput.max = String(scale);
      satInput.placeholder = scale === 5 ? '如 4.5' : '如 8.5';
    }
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
  const saveBtnEl = h('button', {
    id: 'proj-save-btn',
    className: 'btn btn-primary',
    style: 'width:100%;margin-top:12px',
    onclick: async () => {
      const titleVal = (document.getElementById('proj-form-title') || {}).value || '';
      const title = titleVal.trim();
      if (!title) { toast('请输入项目名称', 'error'); return; }

      // v4.25 fix: 兜底匹配——用户输入了名称但未点下拉项时，按名称查找
      if (!selectedExpertId && !pendingNameValue.trim()) {
        const expInputVal = (expInput.value || '').trim();
        if (expInputVal) {
          const nameMatch = db.experts.find(e => e.name === expInputVal);
          if (nameMatch) {
            selectedExpertId = nameMatch.id;
          } else {
            toast('请选择关联讲师（从下拉列表中选择或使用"待关联讲师"）', 'error');
            return;
          }
        } else {
          toast('请选择关联讲师', 'error'); return;
        }
      }

      const year = parseInt(document.getElementById('proj-form-year').value) || currentYear;
      const monthVal = document.getElementById('proj-form-month').value;
      const month = monthVal ? parseInt(monthVal) : null;

      const satVal = parseFloat(document.getElementById('proj-form-sat-value').value);
      const satScale = parseInt(document.getElementById('proj-form-sat-scale').value);
      // v4.26 fix: 存储原始值+量程，不做/2换算；显示时统一由 formatSatisfactionDisplay 换算为10分制
      const satisfaction = (!isNaN(satVal) && satVal > 0)
        ? { value: satVal, scale: satScale }
        : null;

      const desc = (document.getElementById('proj-form-desc') || {}).value || '';
      const visible = (document.getElementById('proj-form-visible') || {}).value === 'true';

    // v4.26: 改为 async onclick 以便 await Supabase 写入结果
    const saveBtn = document.getElementById('proj-save-btn') || this;
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';

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
        // v4.26: await 写入，失败时给用户提示；使用 appState.currentUser（本地登录状态）而非 supabase.js currentUser
        if (appState.currentUser && isAdmin) {
          try {
            await upsertProject(project);
          } catch(e) {
            console.error('[Supabase] Project update failed:', e);
            toast('云端写入失败：' + e.message + '（已保存到本地）', 'warning');
          }
        }
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
          createdBy: currentUser?.email || '主管理员',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        if (!db.yiliProjects || !Array.isArray(db.yiliProjects)) db.yiliProjects = [];
        db.yiliProjects.push(newProj);
        // v4.26: await 写入并明确反馈结果；使用 appState.currentUser（本地登录状态）
        if (appState.currentUser && isAdmin) {
          try {
            const saved = await upsertProject(newProj);
            console.log('[Supabase] Project saved:', saved?.id);
          } catch(e) {
            console.error('[Supabase] Project create failed:', e);
            toast('云端写入失败：' + e.message + '（已保存到本地）', 'warning');
          }
        }
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
  }, isEdit ? '保存修改' : '添加项目');
  body.appendChild(saveBtnEl);

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
      pairs.push({ subtitle: parts[i].trim(), content: (parts[i+1] || '').replace(/[;；]\s*$/, '').trim() });
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
        updatedAt: isEdit ? new Date().toISOString() : ((expert && expert.createdAt) || new Date().toISOString()),
        createdBy: (expert && expert.createdBy) || '主管理员'
      };
      
      if (isEdit) {
        const idx = db.experts.findIndex(e => e.id === expert.id);
        db.experts[idx] = newExpert;
        // v4.26 fix: 使用 appState.currentUser（本地登录状态），await 写入
        if (appState.currentUser && isAdmin) {
          upsertExpert(newExpert).catch(e => console.warn('[Supabase] Expert update failed:', e.message));
        }
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
        // v4.26 fix: 使用 appState.currentUser（本地登录状态），await 写入
        if (appState.currentUser && isAdmin) {
          upsertExpert(newExpert).catch(e => console.warn('[Supabase] Expert create failed:', e.message));
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
    const combinedText = qual + ' ' + adv + ' ' + (expert.education || '') + ' ' + (expert.background || '');
    const txt = combinedText.toLowerCase();
    
    // 辅助函数：判断任职机构权威性
    function getCompanyAuthorityBonus(text) {
      // 世界500强/央企/上市公司
      if (/世界500强|财富500|央企|国企|上市公司|股份|集团|有限责任公司|有限公司| co\.? ltd|inc\.|corp/i.test(text)) return 1;
      // 行业百强/大厂
      if (/百强|大厂|头部|领军|龙头|行业前五|top\s?\d/i.test(text)) return 0.5;
      return 0;
    }
    
    // Generic keyword scoring for professional sub-dimensions
    const profDims = cfg.dimensions.find(d => d.id === 'professional');
    if (profDims && profDims.subDimensions) {
      expert.subScores.professional = {};
      profDims.subDimensions.forEach(sd => {
        const nameTxt = sd.name.toLowerCase();
        let score = 5; // 信息缺失/模糊默认5分（v5.8.9起统一为5）
        // High-score keywords (9+)
        if (/学历|学术|博士|博士后|phd|硕士|研究生|master|本科|学士|学位|教育|professor/i.test(nameTxt)) {
          if (/博士|博士后|phd|教授|研究员/i.test(txt)) score = 9;
          else if (/硕士|研究生|master|mba/i.test(txt)) score = 8;
          else if (/本科|学士|bachelor/i.test(txt)) score = 7;
          else if (/专科|大专|高职|中专/i.test(txt)) score = 4;
          else score = 6;
        } else if (/资质|认证|资格|certif|注[册会]|cpa|cfa|acca|license|头衔|社会/i.test(nameTxt)) {
          if (/认证|certif|注[册会]|cpa|cfa|acca|权威/i.test(txt)) score = 9;
          else if (/资质|资格|license|行业头衔|社会头衔/i.test(txt)) score = 7;
          else if (/培训|进修|学习|课程/i.test(txt)) score = 6;
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
      const authorityBonus = getCompanyAuthorityBonus(txt);
      inflDims.subDimensions.forEach(sd => {
        const nameTxt = sd.name.toLowerCase();
        let score = 5; // 信息缺失/模糊默认5分（v5.8.9起统一为5）
        if (/荣誉|奖项|奖|称号|表彰|殊荣|十大|百强|社会/i.test(nameTxt)) {
          if (/奖|荣誉|称号|表彰|十大|百强/i.test(txt)) score = 9;
          else if (/协会|学会|理事|委员|专家/i.test(txt)) score = 8;
          else score = Math.min(7, Math.round(expert.scores.influence || 7));
        } else if (/职称|头衔|教授|研究员|工程师|院士|首席|高级|技术|管理|履历|行业|地位|领导|职[位务]|ceo|总裁|总[经監]|董事|创始人/i.test(nameTxt)) {
          // 合并后的子维度：职称、管理履历与行业地位
          if (/教授|研究员|高级工程师|院士|首席|ceo|总裁|总经理|董事长|创始人|首席/i.test(txt)) {
            score = Math.min(10, 9 + authorityBonus);
          } else if (/总监|副总裁|合伙人|创始人|副教授|vp|director/i.test(txt)) {
            score = Math.min(10, 8 + authorityBonus);
          } else if (/经理|主管|lead|高级/i.test(txt)) {
            score = 7;
          } else {
            score = Math.min(7, Math.round(expert.scores.influence || 7));
          }
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
  const cfg = appState.db.ratingConfig;
  let changed = false;
  appState.db.experts.forEach(e => {
    if (!e.subScores) {
      aiScoreExpert(e);
      recalcExpertFromSubscores(e);
      changed = true;
    } else {
      // 检查 subScores key 是否匹配当前 config 子维度名称
      const profDim = cfg.dimensions.find(d => d.id === 'professional');
      const inflDim = cfg.dimensions.find(d => d.id === 'influence');
      let needRecalc = false;
      if (profDim && profDim.subDimensions) {
        profDim.subDimensions.forEach(sd => {
          if (e.subScores.professional && e.subScores.professional[sd.name] === undefined) needRecalc = true;
        });
      }
      if (inflDim && inflDim.subDimensions) {
        inflDim.subDimensions.forEach(sd => {
          if (e.subScores.influence && e.subScores.influence[sd.name] === undefined) needRecalc = true;
        });
      }
      if (needRecalc) {
        e.subScores = null; // 清除旧 subScores，强制重算
        aiScoreExpert(e);
        recalcExpertFromSubscores(e); // 重算综合评分
        changed = true;
      }
    }
  });
  if (changed) saveDB(appState.db);
}

// Global autoSyncObservation function
function autoSyncObservationGlobal() {
  const db = appState.db;
  const obsThreshold = 7;
  let changed = false;
  db.experts.forEach(e => {
    if (e.status === 'eliminated') return;
    if (e.scores.overall < obsThreshold && e.status !== 'observation') {
      e.status = 'observation'; e.observationStatus = 'evaluating';
      e.observationDate = new Date().toISOString(); changed = true;
    }
    if (e.scores.overall >= obsThreshold && e.status === 'observation' && e.observationStatus !== 'eliminated') {
      e.status = 'active'; e.observationStatus = ''; changed = true;
    }
  });
  if (changed) saveDB(db);
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

// v5.8.2: 专家导出为 Excel (.xlsx) —— 推荐格式
function exportToExcel() {
  try {
    if (typeof XLSX === 'undefined') { toast('Excel组件未加载，请刷新页面后重试', 'error'); return; }
    var db = appState.db;
    if (!db || !db.experts || db.experts.length === 0) {
      toast('��有可导出的专家数据', 'warning');
      return;
    }
    var headers = ['姓名','适用领域','突出优势','专家卡优势概括','学历','资历资质','专家卡资历概括','课程/案例','联系人','联系方式','内部推荐人','是否库内供应商'];
    var rows = [headers];
    db.experts.forEach(function(e) {
      var advText = '';
      if (Array.isArray(e.advantages)) {
        advText = e.advantages.map(function(a) { return a.title ? '\u25a0' + a.title + '\uff1a' + a.desc : '\u25a0' + a.desc; }).join('\n');
      } else if (typeof e.advantages === 'string') {
        advText = e.advantages;
      }
      var contactsList = getContactsList(e);
      var contactPersons = contactsList.map(function(c) { return c.person; }).filter(Boolean).join(' | ');
      var contactInfos = contactsList.map(function(c) { return (c.type === 'email' ? '\uD83D\uDCE7' : c.type === 'wechat' ? '\uD83D\uDCAC' : '\uD83D\uDCDE') + c.info; }).filter(Boolean).join(' | ');
      rows.push([
        e.name, (e.fields || []).join(', '), advText, e.advDisplay || '',
        e.education || '', e.qualifications || '', e.qualDisplay || '', e.courses || '',
        contactPersons, contactInfos, e.referrer || '', e.isSupplier ? '\u662F' : '\u5426'
      ]);
    });
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(rows);
    // 列宽自适应中文
    ws['!cols'] = [
      {wch:12},{wch:20},{wch:40},{wch:25},{wch:10},{wch:40},{wch:25},{wch:40},
      {wch:15},{wch:25},{wch:12},{wch:10}
    ];
    XLSX.utils.book_append_sheet(wb, ws, '\u4E13\u5BB6\u8D44\u6E90\u5E93');
    XLSX.writeFile(wb, '\u4E13\u5BB6\u8D44\u6E90\u5E93_' + new Date().toISOString().slice(0,10) + '.xlsx');
    toast('\u5BFC\u51FA\u6210\u529F\uFF08' + db.experts.length + ' \u4F4D\u4E13\u5BB6\uFF09', 'success');
  } catch(err) {
    toast('\u5BFC\u51FA\u5931\u8D25\uFF1A' + err.message, 'error');
    console.error('[exportToExcel]', err);
  }
}

// v5.8.2 保留 CSV 导出作为备用
function exportToCSV() {
  try {
    exportToExcel(); // 直接走 Excel 导出
  } catch(err) {
    // fallback 到 CSV
    try {
      var db = appState.db;
      if (!db || !db.experts || db.experts.length === 0) { toast('没有可导出的专家数据', 'warning'); return; }
      var headers = ['姓名','适用领域','突出优势','专家卡优势概括','学历','资历资质','专家卡资历概括','课程/案例','联系人','联系方式','内部推荐人','是否库内供应商'];
      var rows = [headers.join(',')];
      var csvEscape = function(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      db.experts.forEach(function(e) {
        var advText = ''; if (Array.isArray(e.advantages)) { advText = e.advantages.map(function(a) { return a.title ? '\u25a0' + a.title + '\uff1a' + a.desc : '\u25a0' + a.desc; }).join('\n'); } else if (typeof e.advantages === 'string') { advText = e.advantages; }
        var cl = getContactsList(e); var cp = cl.map(function(c){return c.person;}).filter(Boolean).join(' | '); var ci = cl.map(function(c){return (c.type==='email'?'\uD83D\uDCE7':c.type==='wechat'?'\uD83D\uDCAC':'\uD83D\uDCDE')+c.info;}).filter(Boolean).join(' | ');
        rows.push([e.name,(e.fields||[]).join(', '),advText,e.advDisplay||'',e.education||'',e.qualifications||'',e.qualDisplay||'',e.courses||'',cp,ci,e.referrer||'',e.isSupplier?'\u662F':'\u5426'].map(csvEscape).join(','));
      });
      var blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
      downloadBlob(blob, '\u4E13\u5BB6\u8D44\u6E90\u5E93_' + new Date().toISOString().slice(0,10) + '.csv');
      toast('\u5BFC\u51FA\u6210\u529F\uFF08' + db.experts.length + ' \u4F4D\u4E13\u5BB6\uFF09', 'success');
    } catch(err2) { toast('\u5BFC\u51FA\u5931\u8D25\uFF1A' + err2.message, 'error'); }
  }
}

// 保留 JSON 导出入口（小工具栏用）
function exportToJSON() {
  try {
    const db = appState.db;
    const clean = JSON.parse(JSON.stringify(db));
    delete clean.permissions;
    const text = JSON.stringify(clean, null, 2);
    navigator.clipboard.writeText(text).then(function() {
      toast('JSON 数据已复制到剪贴板', 'success');
    }, function() {
      toast('复制失败，请手动复制', 'error');
    });
  } catch(err) {
    toast('导出失败：' + err.message, 'error');
  }
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
  var db = appState.db;
  var fieldNames = (db.fields || []).map(function(f) { return f.name; });
  var fieldList = fieldNames.length > 0 ? fieldNames.join('/') : 'AI/产品/战略规划/技术/数据/数智化营销/组织人才';

  var headers = ['姓名', '适用领域', '突出优势', '专家卡优势概括', '学历', '资历资质', '专家卡资历概括', '课程/案例', '联系人', '联系方式', '内部推荐人', '是否库内供应商'];
  var descRow = [
    '必填，专家中文姓名',
    '可选多领域，用英文逗号分隔。当前可选：' + fieldList,
    '用 ■标题：描述 格式分行填写，详细介绍专家优势',
    '可选，1-3条，每行一条；显示在专家卡片上的简要优势亮点（如：供应链管理专家，10年从业经历）',
    '最高学历或学位信息',
    '请填写：【职称/荣誉头衔】xxx【社会职务】yyy【履职资历】zzz —— 用【小标题】分节，靠【】系统自动切分；不需要加分号',
    '可选，1-3条，每行一条；显示在专家卡片上的简要资历说明（如：智篆商业智库专家）',
    '请填写：【核心课程】xxx【服务经历】yyy —— 用【小标题】分节，靠【】系统自动切分；不需要加分号',
    '主要联系人或对接人姓名',
    '手机/邮箱/微信等联系方式',
    '内部推荐该专家的人员姓名',
    '填「是」或「否」'
  ];
  var exampleRow = [
    '张教授', 'AI, 战略规划',
    '■数字化转型：曾主导多个大型企业数字化转型项目\n■行业研究：在智能制造领域有深入研究\n■方法论：擅长将理论框架与实战结合',
    '数字化转型领域专家\n15年企业管理实战经验', '博士',
    '【职称/荣誉头衔】教授、博导【社会职务】中国人工智能学会理事【履职资历】曾任某集团首席数字官',
    '智篆商业智库专家\n某集团前首席数字官',
    '【核心课程】数字化转型战略与实践、AI赋能企业创新【服务经历】曾为伊利、华为等企业提供培训咨询',
    '李经理', '📞13800138000', '王主任', '是'
  ];

  // v5.8.2: 生成 .xlsx 模板
  if (typeof XLSX !== 'undefined') {
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet([headers, descRow, exampleRow]);
    ws['!cols'] = [
      {wch:12},{wch:20},{wch:40},{wch:25},{wch:10},{wch:40},{wch:25},{wch:40},
      {wch:15},{wch:25},{wch:12},{wch:10}
    ];
    XLSX.utils.book_append_sheet(wb, ws, '专家导入模板');
    XLSX.writeFile(wb, '专家导入模板.xlsx');
    toast('模板已下载（.xlsx），请直接填写后上传导入', 'success');
    return;
  }
  // fallback: CSV
  function csvEscape(v) { return '"' + String(v || '').replace(/"/g, '""') + '"'; }
  var rows = [headers.join(','), descRow.map(csvEscape).join(','), exampleRow.map(csvEscape).join(',')];
  var blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, '专家导入模板.csv');
  toast('模板已下载（.csv），建议用 Excel/WPS 编辑后保存为 .xlsx 再导入', 'success');
}

function showImportDialog() {
  const db = appState.db;
  const overlay = h('div', { className: 'modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const content = h('div', { className: 'modal-content', style: { maxWidth: '540px' } });
  
  const header = h('div', { className: 'modal-header' });
  header.appendChild(h('div', { className: 'modal-title' }, '批量导入专家数据'));
  header.appendChild(h('button', { className: 'modal-close', onclick: () => overlay.remove() }, '✕'));
  content.appendChild(header);
  
  const body = h('div', { className: 'modal-body' });
  body.appendChild(h('p', { style: { marginBottom:'16px', fontSize:'13px', color:'var(--text-secondary)' } }, '系统会自动检测重复专家（基于姓名），由管理员确认后处理。导入不会覆盖已有数据。'));
  
  // ===== Step 1: Download Template =====
  body.appendChild(h('h4', { style: { fontSize:'14px', marginBottom:'8px' } }, '① 下载导入模板'));
  body.appendChild(h('div', { style: { fontSize:'12px', color:'var(--text-muted)', marginBottom:'8px', lineHeight:'1.6' } }, '模板包含填写说明和示例数据，请参照模板格式填写后导入。'));
  body.appendChild(h('button', {
    className: 'btn btn-secondary btn-sm',
    style: { marginBottom:'20px' },
    onclick: () => downloadImportTemplate()
  }, '📥 下载导入模板'));
  
  // ===== Step 2: Select File & Import =====
  body.appendChild(h('h4', { style: { fontSize:'14px', marginBottom:'8px' } }, '\u2461 \u9009\u62E9\u6587\u4EF6\u5E76\u5BFC\u5165'));
  body.appendChild(h('div', { style: { fontSize:'12px', color:'var(--text-muted)', marginBottom:'8px', lineHeight:'1.6' } }, '\u63A8\u8350\u4F7F\u7528 Excel (.xlsx) \u683C\u5F0F\uFF0C\u652F\u6301 CSV\u3001JSON\u3002\u4E0B\u8F7D\u6A21\u677F\u540E\u76F4\u63A5\u586B\u5199\u5E76\u4FDD\u5B58\u4E3A .xlsx \u4E0A\u4F20\u5373\u53EF\u3002'));
  
  const fileInput = h('input', { type: 'file', accept: '.xlsx,.xls,.csv,.json', id: 'import-file', style: { marginBottom:'10px' } });
  body.appendChild(fileInput);
  
  body.appendChild(h('button', {
    className: 'btn btn-primary btn-sm',
    style: { marginBottom:'12px' },
    onclick: () => {
      const file = document.getElementById('import-file').files[0];
      if (!file) { toast('\u8BF7\u9009\u62E9\u6587\u4EF6', 'error'); return; }
      const ext = file.name.split('.').pop().toLowerCase();

      if (ext === 'xlsx' || ext === 'xls') {
        // Excel: 二进制读取
        const reader = new FileReader();
        reader.onload = function(e) {
          try {
            const experts = parseXlsxToExperts(new Uint8Array(e.target.result));
            if (experts.length > 0) processImport(experts);
            else toast('Excel\u4E2D\u672A\u627E\u5230\u6709\u6548\u4E13\u5BB6\u6570\u636E\uFF0C\u8BF7\u786E\u8BA4\u7B2C\u4E00\u5217\u4E3A\u300C\u59D3\u540D\u300D', 'error');
          } catch(err) { toast('\u6587\u4EF6\u89E3\u6790\u5931\u8D25\uFF1A' + err.message, 'error'); }
        };
        reader.readAsArrayBuffer(file);
        return;
      }

      if (ext === 'json') {
        const reader = new FileReader();
        reader.onload = function(e) {
          try { const data = JSON.parse(e.target.result); if (data.experts) processImport(data.experts); else if (Array.isArray(data)) processImport(data); else toast('JSON\u683C\u5F0F\u4E0D\u6B63\u786E\uFF0C\u9700\u8981experts\u6570\u7EC4', 'error'); } catch(err) { toast('\u6587\u4EF6\u89E3\u6790\u5931\u8D25\uFF1A' + err.message, 'error'); }
        };
        reader.readAsText(file, 'utf-8');
        return;
      }

      // CSV: 先试用 UTF-8，乱码则回退到 GBK
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          var result = e.target.result;
          var experts = parseCSVToExperts(result);
          if (experts.length > 0) { processImport(experts); return; }
          // UTF-8 解析失败（可能是 GBK 编码），用 GBK 再试
          tryUTF8Fallback(file, result);
        } catch(err) { tryUTF8Fallback(file, e.target.result); }
      };
      reader.readAsText(file, 'utf-8');

      function tryUTF8Fallback(file, utf8Result) {
        // 检测是否有乱码特征（大量替换字符）
        var hasGarbled = (utf8Result.indexOf('\uFFFD') > -1) || (utf8Result.indexOf('\u00C3\u00A5') > -1);
        if (!hasGarbled) {
          // 没有明显乱码但也没解析出数据，直接提示
          toast('CSV\u4E2D\u672A\u627E\u5230\u6709\u6548\u4E13\u5BB6\u6570\u636E\u3002\u63D0\u793A\uFF1A\u8BF7\u786E\u8BA4\u6587\u4EF6\u5305\u542B\u300C\u59D3\u540D\u300D\u5217\uFF0C\u6216\u5C1D\u8BD5\u4F7F\u7528 Excel \u683C\u5F0F (.xlsx) \u5BFC\u5165\u3002', 'error');
          return;
        }
        // 尝试 GBK 解码
        var gbkReader = new FileReader();
        gbkReader.onload = function(ev) {
          var gbkResult = ev.target.result;
          if (gbkResult === utf8Result) {
            toast('CSV\u4E2D\u672A\u627E\u5230\u6709\u6548\u4E13\u5BB6\u6570\u636E\u3002\u8BF7\u786E\u8BA4\u6587\u4EF6\u5305\u542B\u300C\u59D3\u540D\u300D\u5217\uFF0C\u6216\u4F7F\u7528 Excel \u683C\u5F0F\u5BFC\u5165\u3002', 'error');
            return;
          }
          var experts = parseCSVToExperts(gbkResult);
          if (experts.length > 0) { processImport(experts); toast('\u5DF2\u81EA\u52A8\u8BC6\u522B GBK \u7F16\u7801\u5E76\u5BFC\u5165', 'success'); }
          else toast('CSV\u4E2D\u672A\u627E\u5230\u6709\u6548\u4E13\u5BB6\u6570\u636E\u3002\u5EFA\u8BAE\u4E0B\u8F7D\u6A21\u677F\u540E\u4FDD\u5B58\u4E3A Excel (.xlsx) \u683C\u5F0F\u5BFC\u5165\u3002', 'error');
        };
        gbkReader.readAsText(file, 'gbk');
      }
    }
  }, '\u4E0A\u4F20\u5E76\u5BFC\u5165'));
  
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
        qualifications: (ne.qualifications || '').replace(/[;；]\s*$/gm, ''), // v5.8.8: 批量导入清除行尾分号
        courses: (ne.courses || '').replace(/[;；]\s*$/gm, ''), // v5.8.8: 批量导入清除行尾分号
        contactPerson: ne.contactPerson || '',
        contactInfo: ne.contactInfo || '',
        contactType: detectContactType(ne.contactInfo || ''),
        referrer: ne.referrer || '',
        isSupplier: ne.isSupplier || false,
        advDisplay: ne.advDisplay || '',
        qualDisplay: ne.qualDisplay || '',
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
  
  // v5.8.2: 从 XLSX/CSV 文本中提取专家数据（统一入口）
  function parseFileToExperts(fileName, content, rawBytes) {
    var ext = fileName.split('.').pop().toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      return parseXlsxToExperts(rawBytes || content);
    }
    return parseCSVToExperts(content);
  }

  // v5.8.2: 解析 Excel (.xlsx/.xls) 为专家数组
  function parseXlsxToExperts(data) {
    if (typeof XLSX === 'undefined') { toast('Excel组件未加载，请刷新后重试', 'error'); return []; }
    var wb, experts = [];
    try {
      wb = XLSX.read(data, { type: 'array' });
    } catch(e) { toast('Excel文件解析失败，请确认格式正确', 'error'); return []; }
    var sheetName = wb.SheetNames[0];
    if (!sheetName) return [];
    var ws = wb.Sheets[sheetName];
    var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (rows.length < 2) return [];
    // 第一行是表头
    var header = rows[0].map(function(h) { return String(h).trim(); });
    var nameIdx = header.findIndex(function(h) { return h === '\u59D3\u540D' || h.toLowerCase() === 'name'; });
    if (nameIdx < 0) return [];
    for (var i = 1; i < rows.length; i++) {
      var vals = rows[i].map(function(v) { return String(v).trim(); });
      // 跳过模板说明行
      if (vals[nameIdx] && /^(必填|可选多领域|用|请|支持|主要|内部|填「|填写)/.test(vals[nameIdx])) continue;
      if (!vals[nameIdx]) continue;
      var expert = { name: vals[nameIdx], fields: [], education: '', qualifications: '', courses: '', contactPerson: '', contactInfo: '', referrer: '', advantages: '', advDisplay: '', qualDisplay: '', isSupplier: false };
      header.forEach(function(h, idx) {
        var val = vals[idx] || '';
        if (h === '\u9002\u7528\u9886\u57DF') expert.fields = val.split(/[,，、]/).map(function(f){return f.trim();}).filter(Boolean);
        else if (h === '\u5B66\u5386') expert.education = val;
        else if (h === '\u8D44\u5386\u8D44\u8D28') expert.qualifications = val;
        else if (h === '\u53C2\u8003\u6848\u4F8B' || h === '\u8BFE\u7A0B/\u6848\u4F8B') expert.courses = val;
        else if (h === '\u8054\u7CFB\u4EBA') expert.contactPerson = val;
        else if (h === '\u8054\u7CFB\u65B9\u5F0F') expert.contactInfo = val;
        else if (h === '\u5185\u90E8\u63A8\u8350\u4EBA') expert.referrer = val;
        else if (h === '\u7A81\u51FA\u4F18\u52BF') expert.advantages = val;
        else if (h === '\u4E13\u5BB6\u5361\u4F18\u52BF\u6982\u62EC') expert.advDisplay = val;
        else if (h === '\u4E13\u5BB6\u5361\u8D44\u5386\u6982\u62EC') expert.qualDisplay = val;
        else if (h === '\u662F\u5426\u5E93\u5185\u4F9B\u5E94\u5546') expert.isSupplier = (val === '\u662F' || val.toLowerCase() === 'yes' || val === 'true');
      });
      experts.push(expert);
    }
    return experts;
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
      
      // 跳过模板说明行（第二行以填写说明开头，如"必填"、"可选多领域"等）
      if (vals[nameIdx] && /^(必填|可选多领域|用|请|支持|主要|内部|填「)/.test(vals[nameIdx])) {
        continue;
      }
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
        advantages: '',
        advDisplay: '',
        qualDisplay: '',
        isSupplier: false
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
        else if (h === '专家卡优势概括') expert.advDisplay = val;
        else if (h === '专家卡资历概括') expert.qualDisplay = val;
        else if (h === '是否库内供应商') expert.isSupplier = (val === '是' || val.toLowerCase() === 'yes' || val === 'true');
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

// ===== V5.6 评分管理重构：合并评分细则+体系配置 + 级联锁定 + 预警区整合 =====
// 5768-6169: 完整重写
function renderRatingsTab(panel) {
  const db = appState.db;
  panel.innerHTML = '';
  panel.appendChild(h('h3', {}, '评分管理'));
  const cfg = db.ratingConfig;
  const isMaster = isMasterAdmin();
  const showScores = cfg.showScores !== false;

  panel.appendChild(h('p', { style: { fontSize:'13px', color:'var(--text-secondary)', marginBottom:'16px' } },
    isMaster ? '管理评分的维度配置、子维度权重及所有专家的各项分值。调整后自动重新计算综合评分。'
             : '查看评分细则、调整各专家分值。维度配置和权重调整仅主管理员可操作。'
  ));

  // ===== 辅助函数 =====
  function recalcAllExperts() {
    db.experts.forEach(e => {
      if (!e.subScores) { e.subScores = null; aiScoreExpert(e); }
      recalcExpertFromSubscores(e);
    });
    saveDB(db);
  }

  // ===== ① 前端展示控制（主管理员）=====
  if (isMaster) {
    const toggleSec = h('div', { style: { background:'var(--bg)', padding:'16px', borderRadius:'var(--radius-sm)', marginBottom:'16px', border:'1px solid var(--border)' } });
    toggleSec.appendChild(h('h4', { style: { marginBottom:'8px', fontSize:'14px' } }, '① 前端展示控制'));
    const toggleRow = h('div', { style:{ display:'flex', gap:'12px', alignItems:'center' } });
    toggleRow.appendChild(h('span', { style:{ fontSize:'13px' } }, '在前端展示评分信息（专家卡片 & 详情页）：'));
    toggleRow.appendChild(h('input', { type:'checkbox', checked: showScores, onchange: (e) => {
      cfg.showScores = e.target.checked;
      saveDB(db);
      renderRatingsTab(panel);
      toast(e.target.checked ? '评分信息将在前端展示' : '评分信息已在前端隐藏', 'success');
    }}));
    toggleSec.appendChild(toggleRow);
    toggleSec.appendChild(h('p', { style:{ fontSize:'12px', color:'var(--text-muted)', marginTop:'6px' } }, '关闭后，专家卡片和详情页将不再显示任何评分数字及子维度信息，仅管理员在后台可见评分。'));
    panel.appendChild(toggleSec);
  }

  // ===== 子管理员：showScores=false 时的锁定提示 =====
  if (!isMaster && !showScores) {
    const lockSec = h('div', { style: { background:'#fef2f2', padding:'20px', borderRadius:'var(--radius-sm)', marginBottom:'16px', border:'1px solid #fecaca', textAlign:'center' } });
    lockSec.appendChild(h('div', { style:{ fontSize:'32px', marginBottom:'8px' } }, '🔒'));
    lockSec.appendChild(h('div', { style:{ fontSize:'15px', fontWeight:'600', color:'#dc2626', marginBottom:'4px' } }, '主管理员已关闭评分显示'));
    lockSec.appendChild(h('div', { style:{ fontSize:'13px', color:'#92400e' } }, '功能尚在调试中，当前无法使用评分管理'));
    panel.appendChild(lockSec);
    return;
  }

  // ===== ② 评分体系配置（合并评分细则 + 赋分标准可编辑）=====
  // 主管理员：完整编辑界面 | 子管理员：只读细则说明
  const configSec = h('div', { style: { background:'var(--bg)', padding:'16px', borderRadius:'var(--radius-sm)', marginBottom:'16px', border:'1px solid var(--border)' } });
  const configTitle = isMaster ? '② 评分体系配置（维度 & 赋分标准）' : '① 评分细则说明';
  configSec.appendChild(h('h4', { style: { marginBottom:'12px', fontSize:'14px', color:'var(--primary)' } }, configTitle));

  if (!isMaster) {
    configSec.appendChild(h('p', { style:{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'12px', padding:'8px 12px', background:'#f0f7ff', borderRadius:'6px' } },
      '评分细则仅主管理员可编辑。以下为当前生效的评分标准，子管理员可据此为专家调整分值。'
    ));
  }

  // 评分说明提示（用 innerHTML 支持加粗标记）
  const hintDiv = h('div', { style:{ marginBottom:'14px', padding:'8px 12px', background:'#f0f7ff', borderRadius:'6px', fontSize:'11px', color:'var(--primary)', lineHeight:'1.6' } });
  hintDiv.innerHTML = '💡 信息缺失统一默认 <b>5 分</b>（未公开/模糊/不明确），五维度一致；子维度硬封顶 10 分；综合分低于 7 分不进入观察库。自动评分仅供参考，管理员可手动调整每个子维度的分值。';
  configSec.appendChild(hintDiv);

  // 遍历每个主维度
  cfg.dimensions.forEach((dim, dimIdx) => {
    const dimCard = h('div', { style: { background:'var(--bg)', padding:'16px', borderRadius:'10px', marginBottom:'12px', border:'2px solid ' + (dimIdx === 0 ? '#bfdbfe' : '#fde68a') } });
    const dimColor = dimIdx === 0 ? '#1e40af' : '#92400e';
    const dimBgColor = dimIdx === 0 ? '#dbeafe' : '#fef3c7';

    // --- 主维度头部：名称 + 权重 ---
    const dimHeader = h('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px', marginBottom:'8px' } });
    const dimNameCol = h('div', { style:{ flex:1, minWidth:'200px' } });

    if (isMaster) {
      // 可编辑的主维度名称
      const nameInp = h('input', {
        type: 'text', value: dim.name,
        style: { width:'160px', padding:'4px 8px', border:'1px solid var(--border)', borderRadius:'6px', fontSize:'14px', fontWeight:'700', color: dimColor },
        onchange: (e) => {
          const v = e.target.value.trim();
          if (!v) { toast('名称不能为空', 'error'); e.target.value = dim.name; return; }
          dim.name = v; saveDB(db); renderRatingsTab(panel);
          toast('主维度名称已更新', 'success');
        }
      });
      dimNameCol.appendChild(nameInp);
      // [v5.8.8.3] 评估方向(desc)输入框已移除，不再显示/编辑
    } else {
      dimNameCol.appendChild(h('div', { style:{ fontWeight:'700', fontSize:'14px', color: dimColor } }, dim.name));
      // [v5.8.8.3] 子管理员也不再显示评估方向(desc)
    }
    dimHeader.appendChild(dimNameCol);

    // 权重控制
    if (isMaster) {
      const weightCtrl = h('div', { style: { display:'flex', gap:'6px', alignItems:'center' } });
      weightCtrl.appendChild(h('span', { style:{ fontSize:'12px', color:'var(--text-muted)' } }, '权重：'));
      const weightInput = h('input', {
        type: 'number', value: String(Math.round(dim.weight * 100)), min: 10, max: 90, step: 5,
        style: { width:'60px', padding:'4px 6px', border:'1px solid var(--border)', borderRadius:'6px', fontSize:'13px', textAlign:'center' },
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
      weightCtrl.appendChild(h('span', { style:{ fontSize:'12px', color:'var(--text-muted)' } }, '%'));
      dimHeader.appendChild(weightCtrl);
    } else {
      dimHeader.appendChild(h('span', { style:{ fontSize:'13px', color: dimColor, fontWeight:'600', background: dimBgColor, padding:'3px 10px', borderRadius:'12px' } }, '权重 ' + Math.round(dim.weight * 100) + '%'));
    }
    dimCard.appendChild(dimHeader);

    // --- 子维度表格：名称 + 权重 + 赋分标准 ---
    if (!dim.subDimensions) dim.subDimensions = [];
    const subTable = h('table', { style:{ width:'100%', borderCollapse:'collapse', fontSize:'12px' } });
    const subThead = h('thead');
    const sr = h('tr', { style:{ borderBottom:'1px solid var(--border)' } });
    ['子维度', '权重', '赋分标准'].forEach((hdr, hi) => {
      sr.appendChild(h('th', { style:{ padding:'6px 8px', textAlign: hi === 1 ? 'center' : 'left', fontSize:'11px', color:'var(--text-muted)', fontWeight:'600', width: hi === 1 ? '60px' : hi === 2 ? '60%' : 'auto' } }, hdr));
    });
    subThead.appendChild(sr); subTable.appendChild(subThead);
    const subTbody = h('tbody');

    dim.subDimensions.forEach((sd, sdIdx) => {
      const row = h('tr', { style:{ borderBottom:'1px solid #f3f4f6' } });

      // 子维度名称
      const nameTd = h('td', { style:{ padding:'6px 8px' } });
      if (isMaster) {
        const nameInp = h('input', {
          type: 'text', value: sd.name,
          style: { width:'100%', padding:'4px 8px', border:'1px solid var(--border)', borderRadius:'4px', fontSize:'12px' },
          placeholder: '子维度名称...',
          onchange: (ev) => {
            const newName = ev.target.value.trim();
            if (!newName) { toast('名称不能为空', 'error'); ev.target.value = sd.name; return; }
            const oldName = sd.name;
            sd.name = newName;
            db.experts.forEach(e => {
              if (e.subScores && e.subScores[dim.id] && e.subScores[dim.id][oldName] !== undefined) {
                e.subScores[dim.id][newName] = e.subScores[dim.id][oldName];
                delete e.subScores[dim.id][oldName];
              }
            });
            recalcAllExperts(); saveDB(db); renderRatingsTab(panel);
            toast('子维度名称已更新', 'success');
          }
        });
        nameTd.appendChild(nameInp);
      } else {
        nameTd.appendChild(h('span', { style:{ fontWeight:'500' } }, sd.name));
      }
      row.appendChild(nameTd);

      // 权重
      const wTd = h('td', { style:{ padding:'6px 8px', textAlign:'center' } });
      if (isMaster) {
        const wInp = h('input', {
          type: 'number', value: String(Math.round(sd.weight * 100)), min: 5, max: 80, step: 5,
          style: { width:'50px', padding:'3px 5px', border:'1px solid var(--border)', borderRadius:'4px', fontSize:'12px', textAlign:'center' },
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
            recalcAllExperts(); saveDB(db); renderRatingsTab(panel);
            toast('子维度权重已更新', 'success');
          }
        });
        wTd.appendChild(wInp);
        wTd.appendChild(h('span', { style:{ fontSize:'11px', color:'var(--text-muted)' } }, '%'));
      } else {
        wTd.appendChild(h('span', { style:{ color:'var(--text-secondary)' } }, Math.round(sd.weight * 100) + '%'));
      }
      row.appendChild(wTd);

      // 赋分标准
      const critTd = h('td', { style:{ padding:'6px 8px' } });
      if (isMaster) {
        const critInp = h('textarea', {
          value: sd.criteria || '',
          placeholder: '输入赋分标准（如：9分：... | 8分：... | 6分：信息缺失/模糊）',
          style: { width:'100%', padding:'4px 8px', border:'1px solid var(--border)', borderRadius:'4px', fontSize:'11px', lineHeight:'1.5', resize:'vertical', minHeight:'36px' },
          onchange: (ev) => {
            sd.criteria = ev.target.value.trim();
            saveDB(db);
            toast('赋分标准已保存', 'success');
          }
        });
        critTd.appendChild(critInp);
      } else {
        critTd.appendChild(h('span', { style:{ fontSize:'11px', color:'var(--text-muted)', lineHeight:'1.5', whiteSpace:'pre-wrap' } }, sd.criteria || '暂无赋分标准'));
      }
      row.appendChild(critTd);

      // 删除按钮（仅主管理）
      if (isMaster && dim.subDimensions.length > 1) {
        const delTd = h('td', { style:{ padding:'6px 8px', textAlign:'center' } });
        const delBtn = h('button', {
          style: { background:'none', border:'1px solid #fca5a5', color:'#dc2626', borderRadius:'4px', cursor:'pointer', fontSize:'14px', padding:'2px 7px', lineHeight:'1' },
          title: '删除此子维度',
          onclick: () => {
            const sdName = sd.name;
            dim.subDimensions.splice(sdIdx, 1);
            const rem = dim.subDimensions.reduce((s, d) => s + d.weight, 0);
            if (rem > 0) dim.subDimensions.forEach(d => { d.weight = Math.round(d.weight / rem * 100) / 100; });
            db.experts.forEach(e => {
              if (e.subScores && e.subScores[dim.id] && e.subScores[dim.id][sdName] !== undefined) {
                delete e.subScores[dim.id][sdName];
              }
            });
            recalcAllExperts(); saveDB(db); renderRatingsTab(panel);
            toast('已删除子维度「' + sdName + '」', 'success');
          }
        }, '×');
        delTd.appendChild(delBtn);
        row.appendChild(delTd);
      } else if (isMaster) {
        row.appendChild(h('td', { style:{ padding:'6px 8px' } }));
      }
      subTbody.appendChild(row);
    });
    subTable.appendChild(subTbody);

    // 添加子维度按钮（仅主管理）
    if (isMaster && dim.subDimensions.length < 4) {
      const addRow = h('tr');
      const addTd = h('td', { colspan: 4, style:{ padding:'6px 8px' } });
      const addBtn = h('button', {
        style: { background:'none', border:'1px dashed var(--border)', color:'var(--primary)', borderRadius:'6px', cursor:'pointer', fontSize:'12px', padding:'4px 14px' },
        onclick: () => {
          const newSD = { name: '新子维度', weight: Math.round((1 / (dim.subDimensions.length + 1)) * 100) / 100, maxScore: 10, criteria: '6-9分：按资质等级评定 | 6分：信息缺失/模糊' };
          dim.subDimensions.push(newSD);
          const eq = Math.round(100 / dim.subDimensions.length) / 100;
          dim.subDimensions.forEach(d => { d.weight = eq; });
          dim.subDimensions[dim.subDimensions.length - 1].weight += parseFloat((1 - eq * dim.subDimensions.length).toFixed(2));
          saveDB(db); renderRatingsTab(panel);
          toast('已添加新子维度', 'success');
        }
      }, '+ 添加子维度（最多4条）');
      addTd.appendChild(addBtn); addRow.appendChild(addTd); subTable.appendChild(addRow);
    }
    dimCard.appendChild(subTable);
    configSec.appendChild(dimCard);
  });
  panel.appendChild(configSec);

  // ===== 自动评分开关（仅主管理）=====
  if (isMaster) {
    const aiSec = h('div', { style: { background:'var(--bg)', padding:'16px', borderRadius:'var(--radius-sm)', marginBottom:'16px', border:'1px solid var(--border)' } });
    aiSec.appendChild(h('h4', { style: { marginBottom:'8px', fontSize:'14px' } }, '自动评分'));
    const aiRow = h('div', { style:{ display:'flex', gap:'12px', alignItems:'center' } });
    aiRow.appendChild(h('span', { style:{ fontSize:'13px' } }, '启用自动评分：'));
    aiRow.appendChild(h('input', { type:'checkbox', checked: cfg.aiScoringEnabled, onchange: (e) => {
      cfg.aiScoringEnabled = e.target.checked;
      if (e.target.checked) { db.experts.forEach(ex => { ex.subScores = null; aiScoreExpert(ex); }); recalcAllExperts(); }
      saveDB(db); renderRatingsTab(panel);
      toast(e.target.checked ? '自动评分已启用' : '自动评分已关闭', 'success');
    }}));
    aiSec.appendChild(aiRow);
    aiSec.appendChild(h('p', { style:{ fontSize:'12px', color:'var(--text-muted)', marginTop:'6px' } }, '系统根据专家学历、资历、履历等信息自动生成子维度评分。关闭后可手动调整每位专家的评分。'));
    panel.appendChild(aiSec);
  }

  // ===== 专家评分调整（所有管理员）=====
  const scoreIdx = isMaster ? '③' : '②';
  panel.appendChild(h('h4', { style: { margin:'16px 0 8px', fontSize:'15px', color:'var(--primary)' } }, scoreIdx + ' 专家评分调整'));

  const quickRow = h('div', { style: { display:'flex', gap:'8px', marginBottom:'12px', flexWrap:'wrap' } });
  quickRow.appendChild(h('input', { placeholder:'搜索专家姓名...', style:{ padding:'6px 12px', border:'1px solid var(--border)', borderRadius:'6px', fontSize:'12px', flex:1, maxWidth:'200px' }, id:'rating-search', oninput: () => renderRatingTable() }));
  // 整体重置自动评分按钮
  quickRow.appendChild(h('button', {
    className: 'btn btn-secondary btn-sm',
    style: { fontSize:'12px', whiteSpace:'nowrap' },
    onclick: () => {
      if (!confirm('确认对所有专家重新执行自动评分？当前手动调整的分值将被覆盖。')) return;
      db.experts.forEach(e => { e.subScores = null; aiScoreExpert(e); recalcExpertFromSubscores(e); });
      saveDB(db);
      renderRatingTable();
      toast('已对所有专家重新执行自动评分', 'success');
    }
  }, '🔄 整体重置为自动评分'));
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
        const val = (e.subScores && e.subScores[sd.dim] && e.subScores[sd.dim][sd.name] !== undefined) ? e.subScores[sd.dim][sd.name] : 6;
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
        renderRatingsTab(panel); toast(e.name + ' 已重置为自动评分', 'success');
      } }, '重置为自动评分'));
      row.appendChild(act);
      tbody.appendChild(row);
    });
    table.appendChild(tbody); tableDiv.appendChild(table);
  }
  setTimeout(() => renderRatingTable(), 50);

  // ===== 评分预警区（所有管理员，已整合观察库）=====
  const warnIdx = isMaster ? '④' : '③';
  panel.appendChild(h('h4', { style: { margin:'20px 0 8px', fontSize:'15px', color:'#dc2626' } }, warnIdx + ' 评分预警'));

  // Use global autoSyncObservation
  autoSyncObservationGlobal();

  const obsThreshold = 7;
  const lowExperts = db.experts.filter(ex => ex.status !== 'eliminated' && ex.scores.overall < obsThreshold);

  // 简化：只保留高亮跳转框，统计和处理统一在观察库Tab
  if (lowExperts.length === 0) {
    panel.appendChild(h('div', { style:{ padding:'16px', background:'#f0fdf4', borderRadius:'8px', border:'1px solid #bbf7d0', fontSize:'14px', fontWeight:'600', color:'#059669' } }, '✅ 无预警 · 所有专家评分正常（≥ 7分）'));
  } else {
    const warnBox = h('div', { style:{ padding:'20px', background:'#fffbeb', borderRadius:'8px', border:'1px solid #fde68a', textAlign:'center' } });
    warnBox.appendChild(h('div', { style:{ fontSize:'16px', fontWeight:'700', color:'#92400e', marginBottom:'8px' } }, '⚠️ 共 ' + lowExperts.length + ' 位专家综合评分低于7分'));
    warnBox.appendChild(h('div', { style:{ fontSize:'13px', color:'var(--text-secondary)', marginBottom:'14px' } }, '以上专家已自动同步至观察库，请前往观察库Tab进行查看和处理'));
    warnBox.appendChild(h('button', {
      className: 'btn btn-primary',
      style: { background:'#d97706', color:'white', fontSize:'13px', padding:'8px 24px' },
      onclick: () => { appState.adminTab = 'observation'; renderAdmin(); }
    }, '🔍 前往观察库处理'));
    panel.appendChild(warnBox);
  }

  // ===== ⑤ 测算验证文档（仅主管理员：详细赋分细则 + 计算逻辑 + 测试案例）=====
  if (isMaster) {
    const _profDim = cfg.dimensions.find(d => d.id === 'professional');
    const _inflDim = cfg.dimensions.find(d => d.id === 'influence');
    const profW = Math.round((_profDim?.weight || 0.6) * 100);
    const inflW = Math.round((_inflDim?.weight || 0.4) * 100);

    const docSec = h('div', { style: { background:'var(--bg)', padding:'16px', borderRadius:'var(--radius-sm)', marginBottom:'16px', border:'2px solid #6366F1' } });
    docSec.appendChild(h('h4', { style: { margin:'0 0 12px', fontSize:'15px', color:'#4338CA', borderBottom:'2px solid #E0E7FF', paddingBottom:'8px' } }, '⑤ 评分测算验证文档（v5.8.9 · 赋分细则与计算逻辑）'));

    const docBody = h('div', { className:'scoring-doc-body', style:{ fontSize:'12px', lineHeight:'1.7', color:'var(--text)' } });

    docBody.innerHTML = `
      <!-- ===== 第一部分：计算公式与逻辑 ===== -->
      <div style="margin-bottom:16px; padding:12px 14px; background:linear-gradient(135deg,#EEF2FF,#E0E7FF); border-radius:8px; border-left:4px solid #4338CA;">
        <strong style="font-size:14px; color:#312E81;">📐 核心计算公式（代码 recalcExpertFromSubscores 逻辑）</strong>
        <div style="margin-top:8px; font-family:monospace; font-size:11.5px; background:#fff; padding:10px; border-radius:6px; line-height:1.9;">
          <b>Step 1</b> — 子维度分值获取：<br>
          &nbsp;&nbsp;score = (用户输入值 === undefined/null) ? <b style="color:#DC2626">missingScore(5)</b> : 用户输入值<br>
          &nbsp;&nbsp;score = <b>Math.max(0, Math.min(score, cap=10))</b> — 硬截断 [0, 10]<br><br>
          <b>Step 2</b> — 大维度加权求和：<br>
          &nbsp;&nbsp;<b>专业度</b> = 学历×0.35 + 资质×0.30 + 成果×0.35 &nbsp;(权重之和=1.0)<br>
          &nbsp;&nbsp;<b>影响力</b> = 荣誉×0.35 + 职称×0.65 &nbsp;(权重之和=1.0)<br><br>
          <b>Step 3</b> — 综合分：<br>
          &nbsp;&nbsp;<b>综合</b> = 专业度 × ${profW}% + 影响力 × ${inflW}%<br><br>
          <b>Step 4</b> — 全部保留1位小数：Math.round(x × 10) / 10
        </div>
      </div>

      <!-- ===== 第二部分：五子维度完整赋分矩阵 ===== -->
      <h5 style="color:#312E81; margin:14px 0 8px; font-size:13px; border-bottom:1px solid #E0E7FF; paddingBottom:4px;">📊 五子维度完整赋分矩阵（来自 DEFAULT_RATING_CONFIG.scoring）</h5>

      <!-- 学历 -->
      <div style="margin-bottom:12px; padding:10px; background:#F8FAFC; border-radius:6px; border-left:3px solid #3B82F6;">
        <b style="color:#1D4ED8;">① 学历与学术背景</b> <span style="color:#6B7280;font-size:11px;">（权重35% | 封顶10 | 缺失5.0）</span>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:6px;">
          <tr style="background:#DBEAFE;"><th style="padding:4px 6px;border:1px solid #93C5FD;text-align:left;">维度1·主锚（学历层次）</th><th style="padding:4px 6px;border:1px solid #93C5FD;text-align:center;width:50px;">base</th><th style="padding:4px 6px;border:1px solid #93C5FD;text-align:left;">维度2·院校T矩阵偏移</th></tr>
          <tr><td style="padding:4px 6px;border:1px solid #E2E8F0;">博士</td><td style="padding:4px 6px;border:1px solid #E2E8F0;text-align:center;font-weight:600;color:#1D4ED8;">9.5</td><td rowspan="5" style="padding:4px 6px;border:1px solid #E2E8F0;font-size:10.5px;">
            T0 全球顶尖(清北/QS前50): <b>+0</b><br>
            T1 国内985/双一流: <b>-0.5</b><br>
            T2 国内211/双一流学科: <b>-1.0</b><br>
            T3 普通院校: <b>-1.5</b><br>
            T4 其他/无法核实: <b>-2.5</b><br>
            <span style="color:#6B7280">院系微调 ±0.3,封顶±0.5</span>
          </td></tr>
          <tr><td style="padding:4px 6px;border:1px solid #E2E8F0;">硕士</td><td style="padding:4px 6px;border:1px solid #E2E8F0;text-align:center;font-weight:600;">8.5</td></tr>
          <tr><td style="padding:4px 6px;border:1px solid #E2E8F0;">本科</td><td style="padding:4px 6px;border:1px solid #E2E8F0;text-align:center;font-weight:600;">8.0</td></tr>
          <tr><td style="padding:4px 6px;border:1px solid #E2E8F0;">专升本</td><td style="padding:4px 6px;border:1px solid #E2E8F0;text-align:center;color:#DC2626;">≤5.0</td></tr>
          <tr><td style="padding:4px 6px;border:1px solid #E2E8F0;">专科</td><td style="padding:4px 6px;border:1px solid #E2E8F0;text-align:center;">3~4</td></tr>
        </table>
        <div style="margin-top:4px;font-size:10.5px;color:#6B7280;">
          维度3加分(封顶+1.0): 第二学位≥第一院校+0.3 | 跨学科+0.3 | 第三学位+0.2 | 动态封顶=10−base−维2
        </div>
      </div>

      <!-- 行业资质 -->
      <div style="margin-bottom:12px; padding:10px; background:#F8FAFC; border-radius:6px; border-left:3px solid #10B981;">
        <b style="color:#059669;">② 行业资质与认证</b> <span style="color:#6B7280;font-size:11px;">（权重30% | 封顶10 | 缺失5.0）</span>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:6px;">
          <tr style="background:#D1FAE5;"><th style="padding:4px 6px;border:1px solid #6EE7B7;text-align:left;">维度1·主锚（认证层级，取最高不累计）</th><th style="padding:4px 6px;border:1px solid #6EE7B7;text-align:center;width:50px;">base</th></tr>
          <tr><td style="padding:4px 6px;border:1px solid #E2E8F0;">A0 国际权威(CFA/CPA/ACCA/国家级执业)</td><td style="padding:4px 6px;border:1px solid #E2E8F0;text-align:center;font-weight:600;color:#059669;">9.0</td></tr>
          <tr><td style="padding:4px 6px;border:1px solid #E2E8F0;">A1 国家级执业/行业权威</td><td style="padding:4px 6px;border:1px solid #E2E8F0;text-align:center;font-weight:600;">8.0</td></tr>
          <tr><td style="padding:4px 6px;border:1px solid #E2E8F0;">A2 行业厂商(华为/微软等)</td><td style="padding:4px 6px;border:1px solid #E2E8F0;text-align:center;">6.0</td></tr>
          <tr><td style="padding:4px 6px;border:1px solid #E2E8F0;">A3 培训/通用认证</td><td style="padding:4px 6px;border:1px solid #E2E8F0;text-align:center;">4.0</td></tr>
        </table>
        <div style="margin-top:4px;font-size:10.5px;color:#6B7280;">
          维度2广度(封顶+0.5): ≥2领域+0.3 | ≥3领域+0.5 | 
          维度3稀缺(封顶+1.0): 双A0/A1+0.5 | PMP国际管理+0.5 | 强相关稀缺+0.5
        </div>
      </div>

      <!-- 专业成果 -->
      <div style="margin-bottom:12px; padding:10px; background:#F8FAFC; border-radius:6px; border-left:3px solid #F59E0B;">
        <b style="color:#D97706;">③ 专业成果与经验</b> <span style="color:#6B7280;font-size:11px;">（权重35% | 封顶10 | 缺失5.0）</span>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:6px;">
          <tr style="background:#FEF3C7;"><th style="padding:4px 6px;border:1px solid #FCD34D;text-align:left;">维度1·双路径取高</th><th style="padding:4px 6px;border:1px solid #FCD34D;text-align:center;width:50px;">base</th></tr>
          <tr><td style="padding:4px 6px;border:1px solid #E2E8F0;"><b>学术路径:</b> A0顶刊/著作专利 | A1 SCI/EI核心 | A2普通论文 | A3仅演讲</td><td style="padding:4px 6px;border:1px solid #E2E8F0;text-align:center;"><b>9.0 / 8.0 / 6.0 / 4.0</b></td></tr>
          <tr><td style="padding:4px 6px;border:1px solid #E2E8F0;"><b>企业路径:</b> B0战略级/国家级 | B1省级/行业级 | B2参与级 | B3一般服务</td><td style="padding:4px 6px;border:1px solid #E2E8F0;text-align:center;"><b>9.0 / 8.0 / 6.0 / 4.0</b></td></tr>
        </table>
        <div style="margin-top:4px;font-size:10.5px;color:#6B7280;">
          维度2持续性(封顶+0.5): H-index≥15或授课≥50场+0.3 | H-index≥25或授课≥100场+0.5 |
          维度3影响力(封顶+1.0): 顶刊高被引+0.5 | 牵头国标行标+0.5 | 博士后科研+0.5
        </div>
      </div>

      <!-- 社会荣誉 -->
      <div style="margin-bottom:12px; padding:10px; background:#F8FAFC; border-radius:6px; border-left:3px solid #EF4444;">
        <b style="color:#DC2626;">④ 社会荣誉与奖项</b> <span style="color:#6B7280;font-size:11px;">（权重35% | 封顶10 | 缺失5.0）</span>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:6px;">
          <tr style="background:#FEE2E2;"><th style="padding:4px 6px;border:1px solid #FECACA;text-align:left;">维度1·主锚（行政级别，取最高不累计）</th><th style="padding:4px 6px;border:1px solid #FECACA;text-align:center;width:50px;">base</th></tr>
          <tr><td style="padding:4px 6px;border:1px solid #E2E8F0;">H0 国家级荣誉/称号</td><td style="padding:4px 6px;border:1px solid #E2E8F0;text-align:center;font-weight:600;color:#DC2626;">9.0</td></tr>
          <tr><td style="padding:4px 6px;border:1px solid #E2E8F0;">H1 省部级荣誉/称号</td><td style="padding:4px 6px;border:1px solid #E2E8F0;text-align:center;font-weight:600;">7.5</td></tr>
          <tr><td style="padding:4px 6px;border:1px solid #E2E8F0;">H2 地市级/国家级学会</td><td style="padding:4px 6px;border:1px solid #E2E8F0;text-align:center;">6.0</td></tr>
          <tr><td style="padding:4px 6px;border:1px solid #E2E8F0;">H3 县级/一般协会</td><td style="padding:4px 6px;border:1px solid #E2E8F0;text-align:center;">4.0</td></tr>
        </table>
        <div style="margin-top:4px;font-size:10.5px;color:#6B7280;">
          维度2同级别广度(封顶+0.5): ≥2项+0.3 | ≥3项+0.5 |
          维度3顶尖人才(封顶+1.0): 两院院士<b>+1.0</b> | 国家级人才计划/国际榜单+0.5
        </div>
      </div>

      <!-- 职称行业地位 -->
      <div style="margin-bottom:12px; padding:10px; background:#F8FAFC; border-radius:6px; border-left:3px solid #8B5CF6;">
        <b style="color:#7C3AED;">⑤ 职称、管理履历与行业地位</b> <span style="color:#6B7280;font-size:11px;">（权重65% | 封顶10 | 缺失5.0）</span>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:6px;">
          <tr style="background:#EDE9FE;"><th style="padding:4px 6px;border:1px solid #C4B5FD;text-align:left;" colspan="3">维度1·J×C 矩阵（职级 × 机构）</th></tr>
          <tr style="background:#F5F3FF;"><th style="padding:3px 6px;border:1px solid #DDD6FE;text-align:right;">职级 \\ 机构</th><th style="padding:3px 6px;border:1px solid #DDD6FE;text-align:center;">C0 世界500强/央企/上市</th><th style="padding:3px 6px;border:1px solid #DDD6FE;text-align:center;">C1 行业百强/大厂</th><th style="padding:3px 6px;border:1px solid #DDD6FE;text-align:center;">C2 普通企业</th></tr>
          <tr><td style="padding:3px 6px;border:1px solid #E2E8F0;font-weight:600;background:#FAFAFA;">J0 教授/CEO/创始人</td><td style="padding:3px 6px;border:1px solid #E2E8F0;text-align:center;font-weight:700;color:#7C3AED;">9.5</td><td style="padding:3px 6px;border:1px solid #E2E8F0;text-align:center;">9.0</td><td style="padding:3px 6px;border:1px solid #E2E8F0;text-align:center;">8.5</td></tr>
          <tr><td style="padding:3px 6px;border:1px solid #E2E8F0;font-weight:600;background:#FAFAFA;">J1 副教授/VP/合伙人</td><td style="padding:3px 6px;border:1px solid #E2E8F0;text-align:center;font-weight:600;">8.5</td><td style="padding:3px 6px;border:1px solid #E2E8F0;text-align:center;">8.0</td><td style="padding:3px 6px;border:1px solid #E2E8F0;text-align:center;">7.5</td></tr>
          <tr><td style="padding:3px 6px;border:1px solid #E2E8F0;font-weight:600;background:#FAFAFA;">J2 经理/高工/主管</td><td style="padding:3px 6px;border:1px solid #E2E8F0;text-align:center;">7.0</td><td style="padding:3px 6px;border:1px solid #E2E8F0;text-align:center;">6.5</td><td style="padding:3px 6px;border:1px solid #E2E8F0;text-align:center;">6.0</td></tr>
          <tr><td style="padding:3px 6px;border:1px solid #E2E8F0;font-weight:600;background:#FAFAFA;">J3 无职称/基层</td><td style="padding:3px 6px;border:1px solid #E2E8F0;text-align:center;">5.5</td><td style="padding:3px 6px;border:1px solid #E2E8F0;text-align:center;">5.0</td><td style="padding:3px 6px;border:1px solid #E2E8F0;text-align:center;">4.5</td></tr>
        </table>
        <div style="margin-top:4px;font-size:10.5px;color:#6B7280;">
          维度2履历厚度(封顶+0.5): 从业≥10年+0.3 | ≥15年或跨行业+0.5 |
          维度3标志性职位(封顶+1.0): 一级学会常务理事/早期创始团队(A轮前)+0.5 | 主导企业变革+0.3
        </div>
      </div>

      <!-- ===== 第三部分：关键测试案例 ===== -->
      <h5 style="color:#312E81; margin:16px 0 8px; font-size:13px; border-bottom:1px solid #E0E7FF; paddingBottom:4px;">🧪 关键测试案例（验算赋分逻辑正确性）</h5>

      <div style="padding:10px; background:#FEF2F2; border-radius:6px; border:1px solid #FECACA; margin-bottom:10px;">
        <b style="color:#991B1B;">案例A：全缺失专家（所有子维度均为空）</b>
        <div style="font-family:monospace;font-size:11px;margin-top:4px;line-height:1.8;">
          输入：5个维度全部 undefined → 每个子维度 → missingScore=<b>5.0</b><br>
          专业度 = 5×0.35 + 5×0.30 + 5×0.35 = <b>5.0</b><br>
          影响力 = 5×0.35 + 5×0.65 = <b>5.0</b><br>
          综合 = 5.0×${profW}% + 5.0×${inflW}% = <b>5.0</b><br>
          <span style="color:#991B1B;">✅ 验证：缺失统一5分，不占优不拉低。综合=5.0 &lt; 7 → 不进观察库。</span>
        </div>
      </div>

      <div style="padding:10px; background:#F0FDF4; border-radius:6px; border:1px solid #BBF7D0; margin-bottom:10px;">
        <b style="color:#166534;">案例B：顶级专家（各维度接近满分）</b>
        <div style="font-family:monospace;font-size:11px;margin-top:4px;line-height:1.8;">
          输入：学历=9.5(博士T0) | 资质=9.0(A0) | 成果=9.0(A0) | 荣誉=9.0(H0+院士+1=10封顶) | 职称=9.5(J0×C0)<br>
          专业度 = 9.5×0.35 + 9.0×0.30 + 9.0×0.35 = 3.325 + 2.7 + 3.15 = <b>9.175→9.2</b><br>
          影响力 = 10×0.35 + 9.5×0.65 = 3.5 + 6.175 = <b>9.675→9.7</b><br>
          综合 = 9.2×${profW}% + 9.7×${inflW}% = <b style="color:#166534;">≈9.4</b><br>
          <span style="color:#166534;">✅ 验证：院士荣誉封顶10后影响力更高；综合接近满分。</span>
        </div>
      </div>

      <div style="padding:10px; background:#EFF6FF; border-radius:6px; border:1px solid #BFDBFE; margin-bottom:10px;">
        <b style="color:#1E40AF;">案例C：混合缺失（部分维度有值、部分缺失）</b>
        <div style="font-family:monospace;font-size:11px;margin-top:4px;line-height:1.8;">
          输入：学历=8.5(硕士T1) | 资质=<b>缺失→5.0</b> | 成果=6.0(A2) | 荣誉=<b>缺失→5.0</b> | 职称=7.0(J2×C0)<br>
          专业度 = 8.5×0.35 + 5.0×0.30 + 6.0×0.35 = 2.975 + 1.5 + 2.1 = <b>6.575→6.6</b><br>
          影响力 = 5.0×0.35 + 7.0×0.65 = 1.75 + 4.55 = <b>6.3</b><br>
          综合 = 6.6×${profW}% + 6.3×${inflW}% = <b style="color:#1E40AF;">≈6.45→6.5</b><br>
          <span style="color:#1E40AF;">⚠️ 验证：综合=6.5 &lt; 7 → 不进入观察库。缺失项拉低整体但未过度惩罚。</span>
        </div>
      </div>

      <div style="padding:10px; background:#FFFbeb; border-radius:6px; border:1px solid #FDE68A; margin-bottom:10px;">
        <b style="color:#92400E;">案例D：边界值——子维度超10分硬截断</b>
        <div style="font-family:monospace;font-size:11px;margin-top:4px;line-height:1.8;">
          输入：某子维度手动输入 12 → Math.min(12, 10) = <b style="color:#92400E;">10.0（硬截断）</b><br>
          输入：某子维度手动输入 -2 → Math.max(-2, 0) = <b style="color:#92400E;">0.0（硬截断）</b><br>
          <span style="color:#92400E;">✅ 验证：cap=10 硬截断生效，不会出现异常分数。</span>
        </div>
      </div>

      <!-- ===== 第四部分：全局规则速查 ===== -->
      <h5 style="color:#312E81; margin:16px 0 8px; font-size:13px; border-bottom:1px solid #E0E7FF; paddingBottom:4px;">⚙️ 全局规则汇总</h5>
      <ul style="margin:0;padding-left:18px;font-size:11.5px;line-height:1.9;">
        <li><b>信息缺失统一 5 分</b>（五维度一致），通过 missingScore 配置项控制</li>
        <li><b>子维度硬封顶 10 分</b>（Math.max(0, Math.min(val, cap))），cap 可配置</li>
        <li><b>综合分 &lt; 7 不进入观察库</b>——前端只展示信息完整、实力明确的专家</li>
        <li><b>主锚点原则</b>：同一子维度的多个条件取最高档（不累计），上海落户同款逻辑</li>
        <li><b>动态封顶</b>：维度3加分上限 = 10 − base − 维度2得分，防止溢出</li>
        <li><b>成就类1-3分档位</b>：资质/成果/荣誉/职称的低分段（1-3分）<b>待定</b>（方案X vs 方案Y）</li>
        <li><b>configVersion: 3</b>（v5.8.9 重构版本号，用于 migrateRatingConfig 自动升级检测）</li>
      </ul>
    `;
    docSec.appendChild(docBody);
    panel.appendChild(docSec);
  }

  // ===== 子管理员：实操调分指南（面向不了解评分体系的人）=====
  if (!isMaster) {
    const guide = h('div', { style:{ background:'linear-gradient(135deg,#F0FDF4,#ECFDF5)', padding:'16px', borderRadius:'var(--radius-sm)', marginBottom:'16px', border:'1px solid #BBF7D0' } });
    guide.appendChild(h('h4', { style:{ margin:'0 0 10px', fontSize:'14px', color:'#166534' } }, '📋 调分操作指南'));

    // ✅ 能做的
    const canDo = h('div', { style:{ marginBottom:'12px' } });
    canDo.appendChild(h('div', { style:{ fontWeight:'600', fontSize:'12px', color:'#166534', marginBottom:'6px' } }, '✅ 你可以直接做的'));
    const canList = h('ul', { style:{ margin:0, paddingLeft:'18px', fontSize:'12px', lineHeight:'1.8', color:'var(--text)' } });
    ['在下方专家列表中，直接修改每个子维度的分数输入框（0–10 分）','修改后综合分自动重新计算，无需手动改综合分','点击「重置为自动评分」可恢复系统自动算出的分值'].forEach(t => {
      canList.appendChild(h('li', {}, t));
    });
    canDo.appendChild(canList);
    guide.appendChild(canDo);

    // ⚠️ 注意
    const note = h('div', { style:{ marginBottom:'12px' } });
    note.appendChild(h('div', { style:{ fontWeight:'600', fontSize:'12px', color:'#B45309', marginBottom:'6px' } }, '⚠️ 注意事项'));
    const noteList = h('ul', { style:{ margin:0, paddingLeft:'18px', fontSize:'12px', lineHeight:'1.8', color:'var(--text)' } });
    noteList.appendChild(h('li', {}, '某个维度信息缺失时，该维度默认 5 分（中性值，不拉高也不压低）'));
    noteList.appendChild(h('li', {}, '综合分低于 7 分的专家会自动进入观察库，不会在前端展示'));
    noteList.appendChild(h('li', {}, '每个子维度最高 10 分，超过会自动截断'));
    note.appendChild(noteList);
    guide.appendChild(note);

    // 💡 调分建议
    const tip = h('div', {});
    tip.appendChild(h('div', { style:{ fontWeight:'600', fontSize:'12px', color:'#1D4ED8', marginBottom:'6px' } }, '💡 什么时候需要手动调分？'));
    const tipList = h('ul', { style:{ margin:0, paddingLeft:'18px', fontSize:'12px', lineHeight:'1.8', color:'var(--text)' } });
    tipList.appendChild(h('li', {}, '自动评分偏高或偏低，与实际能力不符 → 直接改对应维度的数字即可'));
    tipList.appendChild(h('li', {}, '有新的资质/成果信息未录入 → 先补充信息再重置为自动评分'));
    tipList.appendChild(h('li', {}, '不确定怎么打分 → 保持自动评分不变，或联系主管理员确认'));
    tip.appendChild(tipList);
    guide.appendChild(tip);

    panel.appendChild(guide);
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
  const isMaster = isMasterAdmin();
  
  panel.appendChild(h('h4', { style:{ margin:'16px 0 8px', fontSize:'14px' } }, '展示模块设置'));
  
  const moduleSettings = [
    { id: 'fields', name: '领域分布情况', desc: '柱状图展示各适用领域的专家数量分布' },
    { id: 'scoreDist', name: '分值分布', desc: '环形图展示专家综合评分的分布情况' },
    { id: 'scoreNumeric', name: '各项评分平均分', desc: '数值卡片展示专业度、影响力、综合评分的加权平均分' }
  ];
  
  if (isMaster) {
    // 主管理员：可勾选开关控制展示模块
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
          renderDashboardTab(panel); // 即时刷新预览
          toast(ms.name + '已' + (e.target.checked ? '显示' : '隐藏'), 'success');
        }
      });
      row.appendChild(showCheckbox);
      panel.appendChild(row);
    });
  } else {
    // 子管理员：只读查看已启用的模块
    moduleSettings.forEach(ms => {
      const enabled = dc.showCharts.includes(ms.id);
      const row = h('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', background:'var(--bg)', borderRadius:'8px', marginBottom:'8px', border:'1px solid var(--border)', opacity: enabled ? '1' : '0.5' } });
      const infoDiv = h('div', {});
      infoDiv.appendChild(h('div', { style:{ fontSize:'13px', fontWeight:'600' } }, ms.name));
      infoDiv.appendChild(h('div', { style:{ fontSize:'11px', color:'var(--text-muted)' } }, ms.desc));
      row.appendChild(infoDiv);
      row.appendChild(h('span', { style:{ fontSize:'12px', fontWeight:'600', padding:'2px 10px', borderRadius:'4px', background: enabled ? '#D1FAE5' : '#FEE2E2', color: enabled ? '#065F46' : '#991B1B' } }, enabled ? '✓ 已启用' : '✗ 未启用'));
      panel.appendChild(row);
    });
    panel.appendChild(h('div', { style:{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px', textAlign:'right' } }, '展示模块开关仅主管理员可修改'));
  }
  
  // Data export
  panel.appendChild(h('h4', { style:{ margin:'20px 0 8px', fontSize:'14px' } }, '数据统计导出'));
  const exportRow = h('div', { style:{ display:'flex', gap:'8px', flexWrap:'wrap' } });
  exportRow.appendChild(h('button', { className:'btn btn-primary btn-sm', onclick: () => {
    exportDashboardImage();
  } }, '📸 导出为图片'));
  exportRow.appendChild(h('button', { className:'btn btn-secondary btn-sm', onclick: () => {
    exportDashboardPDF();
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
  
  if (dc.showCharts.includes('scoreDist')) {
    const sdc = h('div', { className: 'dashboard-card' });
    sdc.appendChild(h('h4', {}, '分值分布'));
    const sdd = h('div', { className: 'chart-container', style: 'height:280px', id: 'admin-chart-score-dist' });
    sdc.appendChild(sdd);
    previewGrid.appendChild(sdc);
  }
  
  if (dc.showCharts.includes('scoreNumeric')) {
    const sc = h('div', { className: 'dashboard-card' });
    sc.appendChild(h('h4', {}, '各项评分平均分'));
    const sd = h('div', { id: 'admin-chart-numeric' });
    sc.appendChild(sd);
    previewGrid.appendChild(sc);
  }
  
  panel.appendChild(previewGrid);
  
  setTimeout(() => {
    const fieldChartContainer = document.getElementById('admin-chart-fields');
    if (fieldChartContainer) {
      var dist = getFieldDistribution(experts);
      renderBarChart('admin-chart-fields', dist.names, dist.values, dist.colors);
    }
    
    const scoreDistContainer = document.getElementById('admin-chart-score-dist');
    if (scoreDistContainer) {
      renderScoreDistChart('admin-chart-score-dist', experts);
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
  }, 100);
}

// ===== 仪表盘导出为图片（Canvas 渲染 → PNG 直接下载） =====
function exportDashboardImage() {
  var db = appState.db;
  var dc = db.dashboardConfig || { showCharts: ['fields', 'scoreNumeric'], barChartType: 'bar' };
  var experts = db.experts.filter(function(e) { return e.status !== 'eliminated'; });
  
  var enabledCharts = dc.showCharts.filter(function(c) { return c === 'fields' || c === 'scoreNumeric' || c === 'scoreDist'; });
  if (enabledCharts.length === 0) {
    toast('当前未启用任何图表模块，请先在仪表盘「展示模块设置」中开启', 'warning');
    return;
  }
  
  // Calculate canvas height — side-by-side layout for score charts (matching frontend 2-column grid)
  var hasFields = enabledCharts.indexOf('fields') >= 0;
  var hasScoreDist = enabledCharts.indexOf('scoreDist') >= 0;
  var hasNumeric = enabledCharts.indexOf('scoreNumeric') >= 0;
  
  var titleH = 60;
  var barChartH = hasFields ? 340 : 0;
  // Score row: doughnut + numeric side by side, use the taller height
  var doughnutH = hasScoreDist ? 280 : 0;
  var numericH = hasNumeric ? 180 : 0;
  var scoreRowH = Math.max(doughnutH, numericH);
  var gap = 20;
  var canvasW = 800;
  var canvasH = titleH + barChartH + scoreRowH + gap * 3;
  
  var canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  var ctx = canvas.getContext('2d');
  
  // ---- White background ----
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasW, canvasH);
  
  var currentY = 20;
  
  // ---- Title ----
  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 22px -apple-system, "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('伊利集团 · 数智化赋能优质专家资源库 — 数据仪表盘', canvasW / 2, currentY + 25);
  ctx.fillStyle = '#94A3B8';
  ctx.font = '13px -apple-system, "Microsoft YaHei", sans-serif';
  ctx.fillText('导出时间：' + new Date().toLocaleString('zh-CN'), canvasW / 2, currentY + 48);
  currentY += titleH;
  
  // ---- Fields bar chart ----
  if (hasFields) {
    var dist = getFieldDistribution(experts);
    var labels = dist.names;
    var data = dist.values;
    var colorsArr = dist.colors;
    
    // Section title
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 16px -apple-system, "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('领域分布情况', 40, currentY + 20);
    currentY += 30;
    
    drawBarChartOnCanvas(ctx, labels, data, colorsArr, 40, currentY, canvasW - 80, barChartH - 40);
    currentY += barChartH;
  }
  
  // ---- Score distribution doughnut + Score numeric cards (side by side, matching frontend 2-col grid) ----
  if (hasScoreDist || hasNumeric) {
    var scoredExperts = experts.filter(function(e) { return e.scores && e.scores.overall > 0; });
    var distLabels = ['9-10分（优秀）', '8-9分（良好）', '7-8分（合格）', '<7分（待提升）'];
    var distData = [
      scoredExperts.filter(function(e) { return e.scores.overall >= 9; }).length,
      scoredExperts.filter(function(e) { return e.scores.overall >= 8 && e.scores.overall < 9; }).length,
      scoredExperts.filter(function(e) { return e.scores.overall >= 7 && e.scores.overall < 8; }).length,
      scoredExperts.filter(function(e) { return e.scores.overall < 7; }).length
    ];
    
    var halfW = (canvasW - 80 - 24) / 2; // two columns with gap
    var leftX = 40;
    var rightX = 40 + halfW + 24;
    
    if (hasScoreDist) {
      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 16px -apple-system, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('分值分布', leftX, currentY + 20);
      drawDoughnutChartOnCanvas(ctx, distLabels, distData, leftX, currentY + 30, halfW, scoreRowH - 40);
    }
    
    if (hasNumeric) {
      var profAvg = experts.length ? (experts.reduce(function(s,e) { return s + e.scores.professional; }, 0) / experts.length).toFixed(1) : '0';
      var inflAvg = experts.length ? (experts.reduce(function(s,e) { return s + e.scores.influence; }, 0) / experts.length).toFixed(1) : '0';
      var overallAvg = experts.length ? (experts.reduce(function(s,e) { return s + e.scores.overall; }, 0) / experts.length).toFixed(1) : '0';
      
      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 16px -apple-system, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('各项评分平均分', rightX, currentY + 20);
      drawScoreCardsOnCanvas(ctx, profAvg, inflAvg, overallAvg, rightX, currentY + 40, halfW, scoreRowH - 60);
    }
    
    currentY += scoreRowH;
  }
  
  // Download as PNG
  canvas.toBlob(function(blob) {
    downloadBlob(blob, '仪表盘_' + new Date().toISOString().slice(0,10) + '.png');
    toast('仪表盘图片已下载', 'success');
  }, 'image/png');
}

// ===== Canvas 柱状图绘制 =====
function drawBarChartOnCanvas(ctx, labels, data, colors, x, y, w, h) {
  var maxVal = Math.max.apply(null, data.concat([1]));
  var chartLeft = x + 60;
  var chartRight = x + w - 20;
  var chartTop = y + 10;
  var chartBottom = y + h - 40;
  var chartW = chartRight - chartLeft;
  var chartH = chartBottom - chartTop;
  
  // Grid lines
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  for (var i = 0; i <= 4; i++) {
    var gy = chartBottom - (chartH * i / 4);
    ctx.beginPath();
    ctx.moveTo(chartLeft, gy);
    ctx.lineTo(chartRight, gy);
    ctx.stroke();
    
    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px -apple-system, "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxVal * i / 4).toString(), chartLeft - 8, gy + 4);
  }
  
  // Axes
  ctx.strokeStyle = '#CBD5E1';
  ctx.beginPath();
  ctx.moveTo(chartLeft, chartTop);
  ctx.lineTo(chartLeft, chartBottom);
  ctx.lineTo(chartRight, chartBottom);
  ctx.stroke();
  
  // Bars
  var barCount = labels.length;
  var gap = Math.min(12, chartW / (barCount * 3));
  var barW = Math.min(50, (chartW - gap * (barCount + 1)) / barCount);
  var totalBarW = barW * barCount + gap * (barCount - 1);
  var startX = chartLeft + (chartW - totalBarW) / 2;
  
  for (var j = 0; j < barCount; j++) {
    var bx = startX + j * (barW + gap);
    var bh = Math.max(2, (data[j] / maxVal) * chartH);
    var by = chartBottom - bh;
    
    // Bar with rounded top
    var radius = Math.min(4, barW / 2);
    ctx.fillStyle = colors[j] || '#3B82F6';
    ctx.beginPath();
    ctx.moveTo(bx, chartBottom);
    ctx.lineTo(bx, by + radius);
    ctx.quadraticCurveTo(bx, by, bx + radius, by);
    ctx.lineTo(bx + barW - radius, by);
    ctx.quadraticCurveTo(bx + barW, by, bx + barW, by + radius);
    ctx.lineTo(bx + barW, chartBottom);
    ctx.closePath();
    ctx.fill();
    
    // Value on top
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 11px -apple-system, "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(data[j].toString(), bx + barW / 2, by - 6);
    
    // Label below
    ctx.fillStyle = '#64748B';
    ctx.font = '10px -apple-system, "Microsoft YaHei", sans-serif';
    var labelText = labels[j].length > 6 ? labels[j].substring(0,6) + '…' : labels[j];
    ctx.save();
    ctx.translate(bx + barW / 2, chartBottom + 14);
    ctx.rotate(-20 * Math.PI / 180);
    ctx.fillText(labelText, 0, 0);
    ctx.restore();
  }
}

// ===== Canvas 评分数值卡片绘制 =====
function drawScoreCardsOnCanvas(ctx, profAvg, inflAvg, overallAvg, x, y, w, h) {
  var cardW = (w - 40) / 3;
  var cardH = h - 10;
  var cards = [
    { label: '专业度', value: profAvg, color: '#3B82F6', bg: '#EFF6FF' },
    { label: '影响力', value: inflAvg, color: '#F59E0B', bg: '#FFFBEB' },
    { label: '综合评分', value: overallAvg, color: '#10B981', bg: '#ECFDF5' }
  ];
  
  for (var i = 0; i < 3; i++) {
    var cx = x + i * (cardW + 20);
    var cy = y + 5;
    
    // Card background with shadow
    ctx.fillStyle = cards[i].bg;
    ctx.strokeStyle = cards[i].color;
    ctx.lineWidth = 2;
    roundRect(ctx, cx, cy, cardW, cardH, 10, true, true);
    
    // Label
    ctx.fillStyle = '#64748B';
    ctx.font = '14px -apple-system, "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cards[i].label, cx + cardW / 2, cy + 30);
    
    // Value
    ctx.fillStyle = cards[i].color;
    ctx.font = 'bold 36px -apple-system, "Microsoft YaHei", sans-serif';
    ctx.fillText(cards[i].value, cx + cardW / 2, cy + 72);
  }
}

// ===== Canvas 环形图绘制 =====
function drawDoughnutChartOnCanvas(ctx, labels, data, x, y, w, h) {
  var colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
  var total = data.reduce(function(a,b) { return a+b; }, 0);
  if (total === 0) return;
  
  var cx = x + w * 0.33;
  var cy = y + h / 2;
  var r = Math.min(w * 0.20, 85);
  var innerR = r * 0.55;
  
  var startAngle = -Math.PI / 2;
  var legendX = x + w * 0.55;
  
  // Count non-zero items for vertical centering
  var nzCount = data.filter(function(d) { return d > 0; }).length;
  var itemH = 42;
  var legendStartY = cy - (nzCount * itemH) / 2;
  var li = 0;
  
  for (var i = 0; i < data.length; i++) {
    if (data[i] === 0) continue;
    var angle = (data[i] / total) * Math.PI * 2;
    var endAngle = startAngle + angle;
    
    // Arc
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fill();
    
    // Percentage label inside arc
    var midAngle = startAngle + angle / 2;
    var labelR = (r + innerR) / 2;
    var lx = cx + Math.cos(midAngle) * labelR;
    var ly = cy + Math.sin(midAngle) * labelR;
    var pct = Math.round(data[i] / total * 100);
    
    if (pct >= 8) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px -apple-system, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pct + '%', lx, ly);
    }
    
    // Center text
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 18px -apple-system, "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(total + '位', cx, cy - 6);
    ctx.fillStyle = '#64748B';
    ctx.font = '11px -apple-system, "Microsoft YaHei", sans-serif';
    ctx.fillText('专家总数', cx, cy + 14);
    
    // Legend (two-line per item)
    var ly2 = legendStartY + li * itemH;
    ctx.fillStyle = colors[i];
    ctx.fillRect(legendX, ly2 + 1, 14, 14);
    ctx.fillStyle = '#334155';
    ctx.font = '13px -apple-system, "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(labels[i], legendX + 20, ly2 + 1);
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 12px -apple-system, "Microsoft YaHei", sans-serif';
    ctx.fillText(data[i] + '人 (' + pct + '%)', legendX + 20, ly2 + 20);
    
    li++;
    startAngle = endAngle;
  }
}

// ===== 辅助：Canvas 圆角矩形 =====
function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

// ===== 仪表盘导出为PDF（Canvas → JPEG → PDF 直接下载） =====
function exportDashboardPDF() {
  var db = appState.db;
  var dc = db.dashboardConfig || { showCharts: ['fields', 'scoreNumeric'], barChartType: 'bar' };
  var experts = db.experts.filter(function(e) { return e.status !== 'eliminated'; });
  
  var enabledCharts = dc.showCharts.filter(function(c) { return c === 'fields' || c === 'scoreNumeric'; });
  if (enabledCharts.length === 0) {
    toast('当前未启用任何图表模块，请先在仪表盘「展示模块设置」中开启', 'warning');
    return;
  }
  
  var hasFields = enabledCharts.indexOf('fields') >= 0;
  var hasNumeric = enabledCharts.indexOf('scoreNumeric') >= 0;
  
  var chartSections = (hasFields ? 1 : 0) + (hasNumeric ? 1 : 0);
  var titleH = 60;
  var barChartH = hasFields ? 340 : 0;
  var numericH = hasNumeric ? 140 : 0;
  var gap = 20;
  var canvasW = 800;
  var canvasH = titleH + barChartH + numericH + (chartSections + 1) * gap;
  
  var canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  var ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasW, canvasH);
  
  var currentY = 20;
  
  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 22px -apple-system, "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('伊利集团 · 数智化赋能优质专家资源库 — 数据仪表盘', canvasW / 2, currentY + 25);
  ctx.fillStyle = '#94A3B8';
  ctx.font = '13px -apple-system, "Microsoft YaHei", sans-serif';
  ctx.fillText('导出时间：' + new Date().toLocaleString('zh-CN'), canvasW / 2, currentY + 48);
  currentY += titleH;
  
  if (hasFields) {
    var dist = getFieldDistribution(experts);
    var labels = dist.names;
    var data = dist.values;
    var colorsArr = dist.colors;
    
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 16px -apple-system, "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('领域分布情况', 40, currentY + 20);
    currentY += 30;
    drawBarChartOnCanvas(ctx, labels, data, colorsArr, 40, currentY, canvasW - 80, barChartH - 40);
    currentY += barChartH;
  }
  
  if (hasNumeric) {
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 16px -apple-system, "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('各项评分平均分', 40, currentY + 20);
    currentY += 30;
    var profAvg = experts.length ? (experts.reduce(function(s,e) { return s + e.scores.professional; }, 0) / experts.length).toFixed(1) : '0';
    var inflAvg = experts.length ? (experts.reduce(function(s,e) { return s + e.scores.influence; }, 0) / experts.length).toFixed(1) : '0';
    var overallAvg = experts.length ? (experts.reduce(function(s,e) { return s + e.scores.overall; }, 0) / experts.length).toFixed(1) : '0';
    drawScoreCardsOnCanvas(ctx, profAvg, inflAvg, overallAvg, 40, currentY, canvasW - 80, numericH - 40);
    currentY += numericH;
  }
  
  // Use JPEG for PDF (smaller, DCTDecode compatible)
  canvas.toBlob(function(jpegBlob) {
    var reader = new FileReader();
    reader.onload = function() {
      generatePDFFromJPEG(reader.result, canvasW, canvasH);
    };
    reader.readAsArrayBuffer(jpegBlob);
  }, 'image/jpeg', 0.92);
}

// ===== 从 JPEG ArrayBuffer 生成 PDF 并下载 =====
function generatePDFFromJPEG(jpegBuffer, imgW, imgH) {
  var pdfW = 595;  // A4 width in points
  var scale = pdfW / imgW;
  var pdfH = imgH * scale;
  var jpegBytes = new Uint8Array(jpegBuffer);
  
  var encoder = new TextEncoder();
  
  // Build PDF objects as byte arrays
  var header = encoder.encode('%PDF-1.4\n');
  
  var obj1 = encoder.encode('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  var obj2 = encoder.encode('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  var obj3 = encoder.encode('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pdfW + ' ' + pdfH + '] /Contents 4 0 R /Resources << /XObject << /Img0 5 0 R >> >> >>\nendobj\n');
  
  var contentStream = 'q\n' + pdfW + ' 0 0 ' + pdfH + ' 0 0 cm\n/Img0 Do\nQ\n';
  var obj4header = '4 0 obj\n<< /Length ' + contentStream.length + ' >>\nstream\n';
  var obj4footer = '\nendstream\nendobj\n';
  
  var obj5header = encoder.encode('5 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + imgW + ' /Height ' + imgH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpegBytes.length + ' >>\nstream\n');
  var obj5footer = encoder.encode('\nendstream\nendobj\n');
  
  // Calculate offsets
  var offset = 0;
  var offsets = [];
  
  offsets.push(offset); offset += header.length;                          // obj1
  offsets.push(offset); offset += obj1.length;                            // obj2
  offsets.push(offset); offset += obj2.length;                            // obj3
  offsets.push(offset); offset += obj3.length;                            // obj4 (header + stream + footer)
  
  var obj4Offset = offset;
  offset += encoder.encode(obj4header).length + contentStream.length + encoder.encode(obj4footer).length;
  
  offsets.push(offset);                                                   // obj5
  offset += obj5header.length + jpegBytes.length + obj5footer.length;
  
  // Cross-reference
  var xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (var k = 0; k < offsets.length; k++) {
    var offStr = offsets[k].toString();
    while (offStr.length < 10) offStr = '0' + offStr;
    xref += offStr + ' 00000 n \n';
  }
  
  var trailer = 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + offset + '\n%%EOF';
  
  // Combine all parts
  var parts = [
    header,
    obj1,
    obj2,
    obj3,
    encoder.encode(obj4header),
    encoder.encode(contentStream),
    encoder.encode(obj4footer),
    obj5header,
    jpegBytes,
    obj5footer,
    encoder.encode(xref),
    encoder.encode(trailer)
  ];
  
  var pdfBlob = new Blob(parts, { type: 'application/pdf' });
  downloadBlob(pdfBlob, '仪表盘_' + new Date().toISOString().slice(0,10) + '.pdf');
  toast('仪表盘PDF已下载', 'success');
}

function exportDashboardCSV() {
  const db = appState.db;
  const experts = db.experts.filter(e => e.status !== 'eliminated');
  
  // v5.7.2: 领域分布只导出有专家的领域
  var dist = getFieldDistribution(experts);
  
  let csv = '类别,数值\n';
  csv += '--- 领域分布 ---\n';
  dist.names.forEach((name, i) => { csv += name + ',' + dist.values[i] + '\n'; });
  
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
  const isMaster = isMasterAdmin();
  const subAccount = isMaster ? null : (appState.currentUser ? appState.currentUser.account : null);
  
  panel.innerHTML = '';
  panel.appendChild(h('h3', {}, '分类管理'));
  panel.appendChild(h('p', { style: { fontSize:'13px', color:'var(--text-secondary)', marginBottom:'16px' } }, isMaster ? '管理"适用领域"标签的名称、颜色。' : '查看和管理自己的"适用领域"标签，预设标签仅主管理员可修改。'));
  
  db.fields.forEach((f, idx) => {
    // 权限判断：主管理员可编辑所有，子管理员仅可编辑自己创建的标签
    const fieldCreator = f.creator || 'master'; // 无creator的旧标签默认属于主管理员
    const canEdit = isMaster || (fieldCreator === subAccount);
    
    const item = h('div', { style: { display:'flex', gap:'12px', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--border)', flexWrap:'wrap' } });
    
    // Creator badge (show who created the label)
    if (fieldCreator !== 'master' && isMaster) {
      const badge = h('span', { style:{ fontSize:'10px', padding:'2px 6px', borderRadius:'4px', background:'#DBEAFE', color:'#1E40AF', flexShrink:'0' } }, '子管理: ' + fieldCreator);
      item.appendChild(badge);
    }
    
    // Name
    const nameInput = h('input', { 
      value: f.name, 
      style: { padding:'6px 10px', border:'1px solid var(--border)', borderRadius:'6px', fontSize:'13px', minWidth:'150px', flex:1 },
      disabled: !canEdit,
      onchange: (e) => {
        if (!canEdit) return;
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
      disabled: !canEdit,
      onchange: (e) => {
        if (!canEdit) return;
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
    
    // Delete — only for editable fields
    if (canEdit) {
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
    } else {
      // Read-only indicator for sub-admins viewing preset labels
      const lockIcon = h('span', { style:{ fontSize:'11px', color:'var(--text-muted)', padding:'2px 8px', background:'#F3F4F6', borderRadius:'4px' } }, '🔒 预设');
      item.appendChild(lockIcon);
    }
    
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
    const newField = { name, color };
    // 标记创建者：主管理员为'master'，子管理员为账号名
    newField.creator = isMaster ? 'master' : subAccount;
    db.fields.push(newField);
    db.totalFields = db.fields.length;
    saveDB(db);
    renderCategoriesTab(panel);
    toast('标签已添加', 'success');
  } }, '添加'));
  panel.appendChild(addDiv);
}

function renderObservationTab(panel) {
  const db = appState.db;
  
  // Sync observation status with current scores
  autoSyncObservationGlobal();
  
  panel.innerHTML = '';
  panel.appendChild(h('h3', {}, '观察库'));
  panel.appendChild(h('p', { style:{ fontSize:'13px', color:'var(--text-secondary)', marginBottom:'8px' } }, '综合评分 < 7 分自动列入观察库（评分系统自动同步），或手动移入的待观察专家。'));
  panel.appendChild(h('div', { style:{ padding:'10px 14px', background:'#f5f5f5', borderRadius:'8px', border:'1px solid #e5e5e5', fontSize:'12px', color:'var(--text-muted)', lineHeight:'1.7', marginBottom:'16px' } },
    '📌 观察库中的专家将不在前端展示。此处可对专家评分进行复核与手动调整，判断分值是否准确，并决定是否持续评估或淘汰。'
  ));

  const cfg = db.ratingConfig;
  const profDim = cfg.dimensions.find(function(d) { return d.id === 'professional'; });
  const inflDim = cfg.dimensions.find(function(d) { return d.id === 'influence'; });

  // Only show experts with status === 'observation'
  var obsExperts = db.experts.filter(function(e) { return e.status === 'observation'; });

  if (obsExperts.length === 0) {
    panel.appendChild(h('div', { style:{ padding:'16px', background:'#f0fdf4', borderRadius:'8px', border:'1px solid #bbf7d0', fontSize:'13px', color:'#059669' } }, '观察库为空 · 所有专家评分正常'));
    return;
  }

  // Summary
  var autoCount = obsExperts.filter(function(e) { return e.scores.overall < 7; }).length;
  var manualCount = obsExperts.filter(function(e) { return e.scores.overall >= 7; }).length;
  var elimCount = obsExperts.filter(function(e) { return e.observationStatus === 'eliminated'; }).length;
  panel.appendChild(h('div', { style:{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap', fontSize:'12px' } },
    h('span', { style:{ padding:'4px 10px', background:'#fffbeb', borderRadius:'6px', border:'1px solid #fde68a' } }, '低分自动入库（<7分）: ' + autoCount + ' 位'),
    h('span', { style:{ padding:'4px 10px', background:'#eff6ff', borderRadius:'6px', border:'1px solid #bfdbfe' } }, '手动移入: ' + manualCount + ' 位'),
    h('span', { style:{ padding:'4px 10px', background: elimCount > 0 ? '#fef2f2' : '#f0fdf4', borderRadius:'6px', border:'1px solid ' + (elimCount > 0 ? '#fecaca' : '#bbf7d0') } }, '已淘汰: ' + elimCount + ' 位')
  ));

  obsExperts.forEach(function(expert) {
    var card = h('div', { className: 'observation-card' + (expert.observationStatus === 'eliminated' ? ' eliminated' : '') });

    // Ensure subScores exist
    if (!expert.subScores) { aiScoreExpert(expert); recalcExpertFromSubscores(expert); }

    // Entry reason badge
    var isAutoSync = expert.scores.overall < 7;
    var entryBadge = isAutoSync
      ? h('span', { style:{ fontSize:'11px', padding:'2px 8px', background:'#fffbeb', borderRadius:'4px', border:'1px solid #fde68a', color:'#92400e' } }, '自动入库')
      : h('span', { style:{ fontSize:'11px', padding:'2px 8px', background:'#eff6ff', borderRadius:'4px', border:'1px solid #bfdbfe', color:'#1e40af' } }, '手动移入');

    // Status buttons (toggle)
    var isEliminated = expert.observationStatus === 'eliminated';
    var evalBtn = h('button', {
      className: 'btn btn-sm',
      style: { fontSize:'11px', padding:'4px 12px', background: !isEliminated ? '#3B82F6' : 'white', color: !isEliminated ? 'white' : '#3B82F6', border:'1px solid #3B82F6', borderRadius:'6px', cursor:'pointer' },
      onclick: function() {
        expert.observationStatus = 'evaluating';
        expert.status = 'observation';
        saveDB(db);
        renderObservationTab(panel);
        toast(expert.name + ' 已设为持续评估', 'success');
      }
    }, '持续评估');

    var elimBtn = h('button', {
      className: 'btn btn-sm',
      style: { fontSize:'11px', padding:'4px 12px', background: isEliminated ? '#dc2626' : 'white', color: isEliminated ? 'white' : '#dc2626', border:'1px solid #dc2626', borderRadius:'6px', cursor:'pointer' },
      onclick: function() {
        expert.observationStatus = 'eliminated';
        expert.status = 'eliminated';
        expert.observationDate = new Date().toISOString();
        saveDB(db);
        renderObservationTab(panel);
        toast(expert.name + ' 已设为淘汰', 'success');
      }
    }, '淘汰');

    card.appendChild(h('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' } },
      h('div', { style:{ display:'flex', gap:'8px', alignItems:'center' } },
        h('strong', {}, expert.name + '（综合：' + expert.scores.overall.toFixed(1) + '）'),
        entryBadge
      ),
      h('div', { style:{ display:'flex', gap:'6px', alignItems:'center' } },
        evalBtn,
        elimBtn,
        h('button', { className:'btn btn-danger btn-sm', style:{ fontSize:'11px' }, onclick: function() {
          if (confirm('确认永久删除' + expert.name + '？此操作不可撤销。')) {
            db.experts = db.experts.filter(function(ex) { return ex.id !== expert.id; });
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
      (isEliminated ? ' | ⚠️ 状态：已淘汰' : ' | 状态：持续评估')
    ));

    // Sub-dimension score editing
    var scoreBox = h('div', { style:{ marginTop:'10px', padding:'10px', background:'white', borderRadius:'6px', border:'1px solid var(--border)' } });
    scoreBox.appendChild(h('div', { style:{ fontSize:'11px', fontWeight:'600', color:'var(--text-muted)', marginBottom:'6px' } }, '子维度评分（可编辑，修改后自动重算综合评分）'));

    function renderSubDimInputs(dim, dimId, color) {
      if (!dim || !dim.subDimensions) return;
      dim.subDimensions.forEach(function(sd) {
        var row = h('div', { style:{ display:'flex', alignItems:'center', gap:'8px', padding:'3px 0' } });
        row.appendChild(h('span', { style:{ fontSize:'11px', color: color, minWidth:'120px', flex:'1' } }, sd.name));
        var val = (expert.subScores && expert.subScores[dimId] && expert.subScores[dimId][sd.name] !== undefined) ? expert.subScores[dimId][sd.name] : 6;
        var inp = h('input', {
          type: 'number', value: String(val), min: 1, max: 10,
          style: { width:'50px', padding:'3px 4px', border:'1px solid var(--border)', borderRadius:'4px', fontSize:'11px', textAlign:'center' },
          onchange: function(ev) {
            var ns = parseInt(ev.target.value);
            if (isNaN(ns) || ns < 1 || ns > 10) { toast('分值1-10', 'error'); return; }
            if (!expert.subScores) expert.subScores = {};
            if (!expert.subScores[dimId]) expert.subScores[dimId] = {};
            expert.subScores[dimId][sd.name] = ns;
            recalcExpertFromSubscores(expert);
            // Auto-sync status based on new score
            if (expert.scores.overall >= 7 && expert.observationStatus !== 'eliminated') {
              expert.status = 'active';
              expert.observationStatus = '';
            }
            saveDB(db);
            renderObservationTab(panel);
            toast(expert.name + ' 评分已更新（综合：' + expert.scores.overall.toFixed(1) + '）', 'success');
          }
        });
        row.appendChild(inp);
        row.appendChild(h('span', { style:{ fontSize:'10px', color:'var(--text-muted)' } }, '/10'));
        scoreBox.appendChild(row);
      });
    }

    renderSubDimInputs(profDim, 'professional', '#3B82F6');
    renderSubDimInputs(inflDim, 'influence', '#F59E0B');

    // Reset AI button
    scoreBox.appendChild(h('div', { style:{ marginTop:'6px' } },
      h('button', { className:'btn btn-secondary btn-sm', style:{ fontSize:'10px', padding:'2px 10px' }, onclick: function() {
        expert.subScores = null;
        aiScoreExpert(expert);
        recalcExpertFromSubscores(expert);
        saveDB(db);
        renderObservationTab(panel);
        toast(expert.name + ' 已重置为自动评分', 'success');
      } }, '重置为自动评分')
    ));
    card.appendChild(scoreBox);

    // Show reasons based on sub-scores
    var reasons = [];
    if (expert.scores.professional < 7 && expert.subScores && expert.subScores.professional) {
      var lowSub = Object.entries(expert.subScores.professional).filter(function(e2) { return e2[1] < 7; }).map(function(e2) { return e2[0]; });
      if (lowSub.length) reasons.push('专业度偏低：' + lowSub.join('、') + ' 分偏低');
    }
    if (expert.scores.influence < 7 && expert.subScores && expert.subScores.influence) {
      var lowSub2 = Object.entries(expert.subScores.influence).filter(function(e2) { return e2[1] < 7; }).map(function(e2) { return e2[0]; });
      if (lowSub2.length) reasons.push('影响力偏低：' + lowSub2.join('、') + ' 分偏低');
    }
    if (reasons.length) {
      var box = h('div', { style:{ marginTop:'6px', padding:'8px', background:'#fffbeb', borderRadius:'6px', border:'1px solid #fde68a' } });
      reasons.forEach(function(r) { box.appendChild(h('div', { style:{ fontSize:'11px', color:'#92400e', padding:'2px 0' } }, '• ' + r)); });
      card.appendChild(box);
    }

    // 1 year elimination check
    if (expert.observationStatus === 'eliminated' && expert.observationDate) {
      var oneYear = new Date(expert.observationDate);
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
    const userHeader = h('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px', flexWrap:'wrap', gap:'8px' } });
    const infoDiv = h('div', {});
    infoDiv.appendChild(h('div', { style:{ fontWeight:'600', fontSize:'14px' } }, user.name || '未命名'));
    
    // Account row with copy buttons
    const accountRow = h('div', { style:{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap', marginTop:'4px' } });
    accountRow.appendChild(h('span', { style:{ fontSize:'12px', color:'var(--text-muted)' } }, '账号：'));
    accountRow.appendChild(h('code', { style:{ fontSize:'12px', padding:'2px 6px', background:'#F1F5F9', borderRadius:'4px', fontFamily:'monospace' } }, user.account));
    accountRow.appendChild(h('button', { 
      className:'btn btn-xs', 
      style:{ fontSize:'11px', padding:'2px 8px' },
      title:'复制账号',
      onclick: () => { copyToClipboard(user.account); toast('账号已复制', 'success'); }
    }, '📋'));
    accountRow.appendChild(h('span', { style:{ fontSize:'12px', color:'var(--text-muted)', marginLeft:'4px' } }, '密码：'));
    accountRow.appendChild(h('code', { style:{ fontSize:'12px', padding:'2px 6px', background:'#F1F5F9', borderRadius:'4px', fontFamily:'monospace' } }, user.password));
    accountRow.appendChild(h('button', { 
      className:'btn btn-xs', 
      style:{ fontSize:'11px', padding:'2px 8px' },
      title:'复制密码',
      onclick: () => { copyToClipboard(user.password); toast('密码已复制', 'success'); }
    }, '📋'));
    accountRow.appendChild(h('span', { style:{ fontSize:'11px', color:'var(--text-muted)', marginLeft:'4px' } }, user.binding ? '已绑定：' + user.binding : '未绑定'));
    infoDiv.appendChild(accountRow);
    userHeader.appendChild(infoDiv);
    
    const btnGroup = h('div', { style:{ display:'flex', gap:'6px' } });
    // 重置密码按钮
    btnGroup.appendChild(h('button', {
      className:'btn btn-sm',
      style:{ background:'#F59E0B', color:'white', border:'none', fontSize:'12px', padding:'4px 10px', borderRadius:'6px' },
      onclick: function() {
        var newPwd = Math.random().toString(36).substring(2, 10);
        user.password = newPwd;
        saveDB(db);
        renderPermissionsTab(panel);
        showResetPasswordModal(user.account, newPwd, user.name);
      }
    }, '重置密码'));
    btnGroup.appendChild(h('button', { className:'btn btn-danger btn-sm', onclick: () => {
      if (confirm('确认删除子管理员「' + (user.name || user.account) + '」？')) {
        db.permissions.users.splice(idx, 1);
        saveDB(db);
        renderPermissionsTab(panel);
        toast('已删除子管理员', 'success');
      }
    } }, '删除'));
    userHeader.appendChild(btnGroup);
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
      showAccountModal(account, password, name);
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

// ===== 子管理员修改密码弹窗 =====
function showSubAdminChangePasswordModal() {
  var overlay = h('div', {
    style: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    onclick: function(e) { if (e.target === overlay) overlay.remove(); }
  });
  var modal = h('div', { style: { background: '#fff', borderRadius: '12px', padding: '24px', width: '380px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' } });
  modal.appendChild(h('h3', { style: { margin: '0 0 16px', fontSize: '16px' } }, '🔑 修改密码'));

  var oldPwdIn = h('input', { type: 'password', placeholder: '当前密码', style: { width: '100%', padding: '10px 12px', marginBottom: '10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' } });
  var newPwdIn = h('input', { type: 'password', placeholder: '新密码', style: { width: '100%', padding: '10px 12px', marginBottom: '10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' } });
  var confirmPwdIn = h('input', { type: 'password', placeholder: '确认新密码', style: { width: '100%', padding: '10px 12px', marginBottom: '16px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' } });
  modal.appendChild(oldPwdIn);
  modal.appendChild(newPwdIn);
  modal.appendChild(confirmPwdIn);

  var btnRow = h('div', { style: { display: 'flex', gap: '10px' } });
  btnRow.appendChild(h('button', {
    className: 'btn btn-secondary',
    style: { flex: 1 },
    onclick: function() { overlay.remove(); }
  }, '取消'));
  btnRow.appendChild(h('button', {
    className: 'btn btn-primary',
    style: { flex: 1 },
    onclick: function() {
      var oldPwd = oldPwdIn.value.trim();
      var newPwd = newPwdIn.value.trim();
      var confirmPwd = confirmPwdIn.value.trim();
      if (!oldPwd || !newPwd || !confirmPwd) { toast('请填写所有字段', 'error'); return; }
      if (newPwd !== confirmPwd) { toast('两次输入的新密码不一致', 'error'); return; }
      if (newPwd.length < 4) { toast('新密码至少需要4位', 'error'); return; }
      var db = appState.db;
      var cu = appState.currentUser;
      var user = db.permissions.users.find(function(u) { return u.account === cu.account; });
      if (!user) { toast('账号信息异常', 'error'); return; }
      if (user.password !== oldPwd) { toast('当前密码不正确', 'error'); return; }
      user.password = newPwd;
      saveDB(db);
      overlay.remove();
      toast('密码修改成功，请牢记新密码', 'success');
    }
  }, '确认修改'));
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// ===== 主管理员重置密码后弹窗展示 =====
function showResetPasswordModal(account, password, name) {
  var overlay = h('div', {
    style: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    onclick: function(e) { if (e.target === overlay) overlay.remove(); }
  });
  var modal = h('div', { style: { background: '#fff', borderRadius: '12px', padding: '24px', width: '400px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' } });
  modal.appendChild(h('h3', { style: { margin: '0 0 16px', fontSize: '16px' } }, '🔑 密码已重置'));
  modal.appendChild(h('p', { style: { fontSize: '13px', color: '#64748B', marginBottom: '16px' } }, '子管理员「' + (name || account) + '」的密码已重置，请及时将新密码告知对方。'));

  var row1 = h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '10px 12px', background: '#F1F5F9', borderRadius: '8px' } });
  row1.appendChild(h('span', { style: { fontSize: '13px', color: '#64748B', whiteSpace: 'nowrap' } }, '账号'));
  row1.appendChild(h('code', { style: { flex: 1, fontSize: '14px', fontFamily: 'monospace' } }, account));
  row1.appendChild(h('button', { className: 'btn btn-xs', onclick: function() { copyToClipboard(account); toast('账号已复制', 'success'); } }, '📋'));
  modal.appendChild(row1);

  var row2 = h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '10px 12px', background: '#F1F5F9', borderRadius: '8px' } });
  row2.appendChild(h('span', { style: { fontSize: '13px', color: '#64748B', whiteSpace: 'nowrap' } }, '新密码'));
  row2.appendChild(h('code', { style: { flex: 1, fontSize: '14px', fontFamily: 'monospace' } }, password));
  row2.appendChild(h('button', { className: 'btn btn-xs', onclick: function() { copyToClipboard(password); toast('密码已复制', 'success'); } }, '📋'));
  modal.appendChild(row2);

  var allInfo = '账号：' + account + '\n新密码：' + password + '\n登录地址：' + window.location.origin;
  modal.appendChild(h('button', {
    className: 'btn btn-primary',
    style: { width: '100%', marginBottom: '12px' },
    onclick: function() { copyToClipboard(allInfo); toast('账号信息已复制', 'success'); }
  }, '📋 一键复制全部信息'));

  modal.appendChild(h('button', {
    className: 'btn btn-secondary',
    style: { width: '100%' },
    onclick: function() { overlay.remove(); }
  }, '关闭'));

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// 复制到剪贴板辅助函数
function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(function(){});
    return;
  }
  // Fallback for older browsers
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

// 子管理员账号生成成功弹窗（带复制按钮）
function showAccountModal(account, password, name) {
  var overlay = h('div', {
    style: 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;'
  });
  
  var modal = h('div', {
    style: 'background:white;border-radius:12px;padding:24px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);'
  });
  
  modal.appendChild(h('div', {
    style: 'font-size:18px;font-weight:700;margin-bottom:4px;color:#059669;'
  }, '子管理员账号已生成'));
  
  modal.appendChild(h('p', {
    style: 'font-size:13px;color:#64748B;margin-bottom:20px;'
  }, '请立即复制并妥善保管，关闭后无法再次查看密码'));
  
  if (name) {
    modal.appendChild(h('div', { style:'font-size:13px;color:#334155;margin-bottom:12px;' },
      '名称：' + h('strong', {}, name)
    ));
  }
  
  // Account row
  var acctDiv = h('div', { style:'display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:10px 14px;background:#F1F5F9;border-radius:8px;' });
  acctDiv.appendChild(h('span', { style:'font-size:13px;color:#64748B;whiteSpace:nowrap;' }, '账号：'));
  acctDiv.appendChild(h('code', { id:'modal-account', style:'flex:1;font-size:14px;font-weight:600;font-family:monospace;color:#1E293B;word-break:break-all;' }, account));
  acctDiv.appendChild(h('button', {
    className: 'btn btn-primary btn-sm',
    style: 'white-space:nowrap;',
    onclick: function() {
      copyToClipboard(account);
      toast('账号已复制', 'success');
    }
  }, '复制'));
  modal.appendChild(acctDiv);
  
  // Password row
  var pwdDiv = h('div', { style:'display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:10px 14px;background:#FEF3C7;border-radius:8px;' });
  pwdDiv.appendChild(h('span', { style:'font-size:13px;color:#64748B;whiteSpace:nowrap;' }, '密码：'));
  pwdDiv.appendChild(h('code', { id:'modal-password', style:'flex:1;font-size:14px;font-weight:600;font-family:monospace;color:#92400E;word-break:break-all;' }, password));
  pwdDiv.appendChild(h('button', {
    className: 'btn btn-primary btn-sm',
    style: 'white-space:nowrap;',
    onclick: function() {
      copyToClipboard(password);
      toast('密码已复制', 'success');
    }
  }, '复制'));
  modal.appendChild(pwdDiv);
  
  // One-click copy all
  var copyAll = h('button', {
    className: 'btn btn-secondary',
    style: 'width:100%;margin-bottom:12px;',
    onclick: function() {
      var text = '账号：' + account + '\n密码：' + password + (name ? '\n名称：' + name : '') + '\n\n登录链接：' + window.location.origin + window.location.pathname;
      copyToClipboard(text);
      toast('账号信息已全部复制', 'success');
    }
  }, '📋 一键复制全部（含登录链接）');
  modal.appendChild(copyAll);
  
  // Close button
  modal.appendChild(h('button', {
    className: 'btn btn-danger',
    style: 'width:100%;',
    onclick: function() { overlay.remove(); }
  }, '关闭（请确认已复制密码）'));
  
  overlay.appendChild(modal);
  
  // Click outside to close
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });
  
  document.body.appendChild(overlay);
}

function renderSettingsTab(panel) {
  panel.innerHTML = '';
  panel.appendChild(h('h3', {}, '系统设置'));
  const db = appState.db;
  // ===== ① 界面设置（放第一项，功能相对独立）=====
  panel.appendChild(h('h4', { style:{ margin:'16px 0 8px', fontSize:'14px' } }, '① 界面设置'));
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
  
  // v5.8.3: 手机端视图开关
  var mobileViewRow = h('div', { style:{ marginBottom:'14px' } });
  mobileViewRow.appendChild(h('div', { style:{ fontSize:'13px', fontWeight:'600', marginBottom:'8px' } }, '📱 手机端视图'));
  var mobileViewEnabled = db.mobileViewEnabled !== false; // 默认为 false（关闭）
  var mobileLabel = h('label', { style:{ display:'flex', alignItems:'center', gap:'10px', cursor:'pointer' } });
  var mobileCheckbox = h('input', {
    type: 'checkbox',
    checked: mobileViewEnabled,
    style: { width:'18px', height:'18px', cursor:'pointer' },
    onchange: function() {
      db.mobileViewEnabled = this.checked;
      saveDB(db);
      if (this.checked) {
        // 启用：允许 auto-detect，刷新页面后生效
        try { localStorage.removeItem('yili_mobile_mode'); } catch(e) {}
        toast('手机端视图已开启，刷新页面后生效（手机访问将自动适配）', 'success');
      } else {
        // 关闭：移除手机端 class，清除缓存
        document.body.classList.remove('mobile-mode');
        try { localStorage.setItem('yili_mobile_mode', '0'); } catch(e) {}
        toast('手机端视图已关闭，所有设备将显示桌面版界面', 'success');
      }
    }
  });
  mobileLabel.appendChild(mobileCheckbox);
  mobileLabel.appendChild(h('span', { style:{ fontSize:'13px', color:'var(--text)' } }, '启用手机端适配（关闭后所有设备强制显示桌面版）'));
  mobileViewRow.appendChild(mobileLabel);
  mobileViewRow.appendChild(h('div', { style:{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px', marginLeft:'28px' } }, '手机端适配仍在细化中，建议确认后再开启'));
  uiCard.appendChild(mobileViewRow);
  
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
  
  // ===== ①-2: 排序标签管理（原独立 Tab，v5.8 迁入界面设置）=====
  var sortCard = h('div', { style:{ background:'var(--bg)', padding:'16px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', marginTop:'12px' } });
  sortCard.appendChild(h('div', { style:{ fontSize:'13px', fontWeight:'600', marginBottom:'8px' } }, '排序标签'));
  sortCard.appendChild(h('p', { style:{ fontSize:'12px', color:'var(--text-secondary)', marginBottom:'10px' } }, '管理前端展示的排序选项，可新增或删除。'));
  db.sortOptions.forEach(function(opt, idx) {
    var item = h('div', { style: { display:'flex', gap:'12px', alignItems:'center', padding:'6px 0', borderBottom:'1px solid var(--border)' } });
    item.appendChild(h('span', { style: { fontWeight:'600', minWidth:'80px', fontSize:'13px' } }, opt.name));
    item.appendChild(h('span', { style: { fontSize:'11px', color:'var(--text-muted)' } }, 'ID: ' + opt.id));
    if (idx > 0) {
      item.appendChild(h('button', { className: 'btn btn-danger btn-sm', onclick: function() {
        db.sortOptions.splice(idx, 1);
        saveDB(db);
        renderSettingsTab(panel);
        toast('已删除排序项', 'success');
      } }, '删除'));
    }
    sortCard.appendChild(item);
  });
  var sortAdd = h('div', { style: { marginTop:'10px', display:'flex', gap:'8px', alignItems:'center' } });
  var sortNameInput = h('input', { placeholder: '排序名称', style: { padding:'6px 10px', border:'1px solid var(--border)', borderRadius:'6px', fontSize:'12px', flex:1 }, id: 'new-sort-name' });
  var sortIdInput = h('input', { placeholder: '排序ID（英文）', style: { padding:'6px 10px', border:'1px solid var(--border)', borderRadius:'6px', fontSize:'12px', flex:1 }, id: 'new-sort-id' });
  sortAdd.appendChild(sortNameInput);
  sortAdd.appendChild(sortIdInput);
  sortAdd.appendChild(h('button', {
    className: 'btn btn-primary btn-sm',
    onclick: function() {
      var name = document.getElementById('new-sort-name').value.trim();
      var id = document.getElementById('new-sort-id').value.trim();
      if (!name || !id) { toast('请填写完整', 'error'); return; }
      db.sortOptions.push({ id: id, name: name });
      saveDB(db);
      renderSettingsTab(panel);
      toast('排序项已添加', 'success');
    }
  }, '添加'));
  sortCard.appendChild(sortAdd);
  panel.appendChild(sortCard);
  
  // ===== ①-3: 测试模式（v5.8.1: 从登录页迁移至系统设置，仅主管理员可见）=====
  if (appState.currentUser && appState.currentUser.role === 'master') {
    var testCard = h('div', { style:{ background:'#FFFBEB', padding:'16px', borderRadius:'var(--radius-sm)', border:'1px solid #FCD34D', marginTop:'12px' } });
    testCard.appendChild(h('div', { style:{ fontSize:'13px', fontWeight:'600', marginBottom:'8px', color:'#92400E' } }, '🧪 测试模式'));
    testCard.appendChild(h('p', { style:{ fontSize:'12px', color:'#92400E', marginBottom:'10px', lineHeight:'1.5' } }, '使用独立数据空间模拟不同角色视角，修改不会影响真实生产数据。支持切换主管理员、子管理员、普通用户三种角色。'));
    
    var btnRow = h('div', { style:{ display:'flex', gap:'8px', flexWrap:'wrap' } });
    if (!isTestMode()) {
      btnRow.appendChild(h('button', {
        className: 'btn btn-sm',
        style: { background:'#F59E0B', color:'#fff', border:'none' },
        onclick: function() {
          if (confirm('进入测试模式？\n\n测试模式使用独立的数据空间，不会影响真实生产数据。\n\n支持切换三种角色视角：\n• 主管理员\n• 子管理员（testsub / test123）\n• 普通用户')) {
            enterTestMode();
          }
        }
      }, '进入测试模式'));
    } else {
      btnRow.appendChild(h('span', { style:{ fontSize:'12px', color:'#059669', fontWeight:'600', alignSelf:'center' } }, '✅ 当前处于测试模式'));
      btnRow.appendChild(h('button', {
        className: 'btn btn-sm',
        style: { background:'#EF4444', color:'#fff', border:'none' },
        onclick: function() {
          if (confirm('确定退出测试模式？测试数据将被清除。')) {
            exitTestMode();
          }
        }
      }, '退出测试模式'));
    }
    testCard.appendChild(btnRow);
    panel.appendChild(testCard);
  }
  
  // ===== ② 系统更新时间 =====
  panel.appendChild(h('h4', { style:{ margin:'20px 0 8px', fontSize:'14px' } }, '② 系统更新时间'));
  panel.appendChild(h('p', { style:{ fontSize:'13px', color:'var(--text-secondary)', marginBottom:'8px' } }, '记录系统配置与部署的最近更新日期（非专家数据更新时间）。'));
  const timeDiv = h('div', { style:{ display:'flex', gap:'8px', alignItems:'center' } });
  timeDiv.appendChild(h('span', { style:{ fontSize:'13px', color:'var(--text-secondary)' } }, '最近更新：' + formatDate(db.updateTime)));
  timeDiv.appendChild(h('button', { className:'btn btn-secondary btn-sm', onclick: () => {
    db.updateTime = new Date().toISOString();
    saveDB(db);
    renderSettingsTab(panel);
    toast('系统更新时间已刷新', 'success');
  } }, '刷新'));
  panel.appendChild(timeDiv);
  
  // ===== ③ 数据源（合并原"数据源管理"+"系统文档"，只读查看）=====
  panel.appendChild(h('h4', { style:{ margin:'20px 0 8px', fontSize:'14px' } }, '③ 数据源'));
  panel.appendChild(h('p', { style:{ fontSize:'13px', color:'var(--text-secondary)', marginBottom:'12px' } }, '核心数据来源及版本管理文档，仅供查看。批量导入请通过专家管理页的模板导入进行。'));
  
  // Doc cards
  var dataDocsList = [
    {
      icon: '📁',
      title: '初始源数据表',
      desc: '专家资源库初始数据来源（腾讯文档，n99xou 工作表）',
      url: 'https://docs.qq.com/sheet/DTUROVmZod2FxSGFO?tab=n99xou',
      label: '打开源数据表'
    },
    {
      icon: '📊',
      title: '版本更新进度管理表',
      desc: '所有功能需求的优先级、排期、完成状态追踪',
      url: 'https://docs.qq.com/smartsheet/DTVJIWmh2ZXdBUE14?tab=t00i2h',
      label: '打开进度表'
    },
    {
      icon: '📐',
      title: '评分规则·详细内部版（五子维度赋分与测算 v5.8.9）',
      desc: '内部留底：五个子维度完整赋分矩阵 + 计算引擎 + 4 个测算案例 + 代码字段映射；用于核对赋分逻辑、检验测算结果',
      url: 'https://yili-expert-library-bvw2itdk.zh-cn.edgeone.cool/docs/scoring-rules-internal-v5.8.9.md',
      label: '打开详细文档'
    }
  ];
  dataDocsList.forEach(function(doc) {
    var card = h('div', {
      style: {
        background:'var(--bg)', borderRadius:'var(--radius-sm)', padding:'14px 18px',
        marginBottom:'8px', border:'1px solid var(--border)',
        display:'flex', alignItems:'center', gap:'12px'
      }
    });
    card.appendChild(h('div', { style:{ fontSize:'22px', width:'36px', height:'36px', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--primary-light)', borderRadius:'8px', flexShrink:0 } }, doc.icon));
    card.appendChild(h('div', { style:{ flex:1 } },
      h('div', { style:{ fontSize:'13px', fontWeight:600, marginBottom:'2px', color:'var(--text)' } }, doc.title),
      h('div', { style:{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'6px' } }, doc.desc),
      h('a', { href:doc.url, target:'_blank', rel:'noopener', style:{ fontSize:'11px', color:'var(--primary)', textDecoration:'none', padding:'3px 8px', border:'1px solid var(--primary)', borderRadius:'5px', display:'inline-block' } }, doc.label)
    ));
    panel.appendChild(card);
  });
  
  // ===== ④ 系统文档（预留拓展区，供后续补充运维/权限/SOP等）=====
  panel.appendChild(h('h4', { style:{ margin:'20px 0 8px', fontSize:'14px' } }, '④ 系统文档'));
  panel.appendChild(h('p', { style:{ fontSize:'13px', color:'var(--text-secondary)', marginBottom:'12px' } }, '系统运维、权限规范及部署操作指引，持续补充中。'));
  
  var sysDocs = [
    {
      icon: '🔐',
      title: '权限说明文档',
      desc: '三角色权限体系说明（主管理员/管理员/前端用户），含RLS策略及Supabase数据访问规则',
      status: '待补充'
    },
    {
      icon: '🚀',
      title: '部署操作SOP',
      desc: 'EdgeOne Pages 静态托管部署流程、GitHub 同步操作、自定义域名与ICP备案指南',
      status: '待补充'
    }
  ];
  sysDocs.forEach(function(doc) {
    var card = h('div', {
      style: {
        background:'#fafafa', borderRadius:'var(--radius-sm)', padding:'14px 18px',
        marginBottom:'8px', border:'1px dashed var(--border)',
        display:'flex', alignItems:'center', gap:'12px'
      }
    });
    card.appendChild(h('div', { style:{ fontSize:'22px', width:'36px', height:'36px', display:'flex', alignItems:'center', justifyContent:'center', background:'#f0f0f0', borderRadius:'8px', flexShrink:0 } }, doc.icon));
    card.appendChild(h('div', { style:{ flex:1 } },
      h('div', { style:{ fontSize:'13px', fontWeight:600, marginBottom:'2px', color:'var(--text)' } }, doc.title),
      h('div', { style:{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'2px' } }, doc.desc)
    ));
    card.appendChild(h('span', { style:{ fontSize:'11px', color:'#94a3b8', background:'#f0f0f0', padding:'3px 10px', borderRadius:'10px', whiteSpace:'nowrap' } }, doc.status));
    panel.appendChild(card);
  });
  
  // ===== ⑤ 部署信息 =====
  panel.appendChild(h('h4', { style:{ margin:'20px 0 8px', fontSize:'14px' } }, '⑤ 部署信息'));
  panel.appendChild(h('p', { style:{ fontSize:'13px', color:'var(--text-secondary)', marginBottom:'8px' } }, '前端托管于 EdgeOne Pages（腾讯 CDN），数据库使用 Supabase（新加坡节点）。'));
  panel.appendChild(h('div', { style:{ fontSize:'13px', color:'var(--text)', lineHeight:'2' } },
    h('div', {}, '🔗 正式链接：yili-expert-library-bvw2itdk.zh-cn.edgeone.cool'),
    h('div', {}, '📦 代码仓库：GitHub demon9802/yili-expert-library'),
    h('div', {}, '☁️ 数据库：Supabase（新加坡）')
  ));
  
  // ===== ⑥ 危险操作 =====
  panel.appendChild(h('h4', { style:{ margin:'20px 0 8px', fontSize:'14px', color:'var(--danger)' } }, '⑥ 危险操作'));
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
}

// ===== v4.21: 用户管理 Tab（主管理员）=====
function renderUsersTab(panel) {
  panel.innerHTML = '';
  panel.appendChild(h('h3', { style: { marginBottom: '16px' } }, '👥 用户管理'));

  var hintDiv = h('div', { id: 'users-hint', style: { fontSize: '13px', color: '#64748B', marginBottom: '16px' } });
  panel.appendChild(hintDiv);

  var tableWrap = h('div', { id: 'users-table', style: { overflowX: 'auto' } });
  panel.appendChild(tableWrap);

  loadUserList(hintDiv, tableWrap);
}

async function loadUserList(hintDiv, tableWrap) {
  hintDiv.textContent = '正在加载用户列表...';
  try {
    var users = await fetchUserList();
    if (!users || users.length === 0) {
      hintDiv.textContent = '暂无用户数据（请确认 SQL 迁移已执行）';
      return;
    }
    hintDiv.textContent = '共 ' + users.length + ' 位用户 | 管理员可为用户重置临时密码';
    renderUserTable(tableWrap, users);
  } catch(e) {
    hintDiv.textContent = '加载失败：' + (e.message || '未知错误');
    hintDiv.style.color = '#DC2626';
  }
}

function renderUserTable(tableWrap, users) {
  var table = h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' } });

  var thead = h('thead');
  var headerRow = h('tr', { style: { background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' } });
  ['邮箱', '角色', '密保状态', '强制改密', '操作'].forEach(function(text) {
    headerRow.appendChild(h('th', { style: { padding: '10px 12px', textAlign: 'left', fontSize: '12px', color: '#475569', fontWeight: 600 } }, text));
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  var tbody = h('tbody');
  users.forEach(function(user) {
    var row = h('tr', { style: { borderBottom: '1px solid #F1F5F9' } });

    row.appendChild(h('td', { style: { padding: '10px 12px', color: '#1E293B' } },
      (user.email || '(未知)') + (user.force_password_change ? ' ⚠️' : '')
    ));

    row.appendChild(h('td', { style: { padding: '10px 12px' } },
      h('span', {
        style: {
          padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500,
          background: user.is_admin ? '#FEF3C7' : '#F1F5F9',
          color: user.is_admin ? '#92400E' : '#475569'
        }
      }, user.is_admin ? '主管理员' : '普通用户')
    ));

    row.appendChild(h('td', { style: { padding: '10px 12px' } },
      h('span', {
        style: {
          padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500,
          background: user.has_security_questions ? '#DCFCE7' : '#FEF2F2',
          color: user.has_security_questions ? '#166534' : '#991B1B'
        }
      }, user.has_security_questions ? '已设置' : '未设置')
    ));

    row.appendChild(h('td', { style: { padding: '10px 12px' } },
      user.force_password_change
        ? h('span', { style: { padding: '2px 8px', borderRadius: '4px', fontSize: '11px', background: '#FEF3C7', color: '#92400E' } }, '是')
        : h('span', { style: { color: '#94A3B8', fontSize: '12px' } }, '否')
    ));

    var actionCell = h('td', { style: { padding: '10px 12px' } });
    actionCell.appendChild(h('button', {
      style: { padding: '6px 12px', background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 500 },
      onclick: function() { adminResetPassword(user); }
    }, '重置密码'));
    actionCell.appendChild(h('span', { style: { fontSize: '11px', color: '#94A3B8', marginLeft: '8px' } }, '生成临时密码'));

    row.appendChild(actionCell);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  tableWrap.innerHTML = '';
  tableWrap.appendChild(table);
}

function adminResetPassword(user) {
  if (!confirm('确定要为用户 ' + (user.email || user.id.substring(0, 8) + '...') + ' 重置密码吗？\n\n将生成一个随机临时密码，用户登录后需立即修改。')) return;

  var tempPassword = generateTempPassword();
  adminResetUserPassword(user.id, tempPassword).then(function() {
    alert('密码已重置！\n\n临时密码：' + tempPassword + '\n\n请将此密码安全地告知用户，用户首次登录后将被强制修改密码。\n\n⚠️ 此密码仅显示一次，请立即复制保存。');

    loadUserList(
      document.getElementById('users-hint'),
      document.getElementById('users-table')
    );
  }).catch(function(e) {
    alert('重置失败：' + (e.message || '请确认 SQL 迁移已执行'));
  });
}

function generateTempPassword() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  var pwd = '';
  for (var i = 0; i < 8; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
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
      url: 'https://docs.qq.com/smartsheet/DTVJIWmh2ZXdBUE14?tab=t00i2h',
      label: '打开进度表'
    },
    {
      icon: '📁',
      title: '初始化源数据表',
      desc: '专家资源库初始数据来源（腾讯文档）',
      url: '#',
      label: '敬请期待（联系管理员补充链接）',
      disabled: true
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
  // v5.6.9: 初始化手机版模式（localStorage 记忆 + 首次自动检测）
  initMobileMode();
  
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
    
    // Step 4: init AI scoring (calculate sub-scores for all experts)
    initAIScoring();
    
    // Step 4.5: sync observation status with latest scores
    autoSyncObservationGlobal();
    
    // Step 4.55: v5.8.3 迁移——关闭所有已有子管理员的分类管理权限
    (function migrateSubAdminCategory() {
      try {
        var migrated = false;
        var users = appState.db.permissions && appState.db.permissions.users;
        if (users && users.length > 0) {
          users.forEach(function(u) {
            if (u.permissions && u.permissions.categoryManage === true) {
              u.permissions.categoryManage = false;
              migrated = true;
            }
          });
        }
        if (migrated) saveDB(appState.db);
      } catch(e) { console.warn('Sub-admin category migration skipped:', e.message); }
    })();
    
    // Step 4.6: increment page view counter (v5.8)
    incrementPageView();
    
    // Step 5: render
    renderFrontend();
  } catch(e) {
    console.error('Boot failed:', e, e.stack);
    showError('页面加载失败', (e && e.message) || '未知错误');
  }
}

// ===== v5.8: 月度系统数据报告 =====
// VERSION_CHANGELOG 已提取到 js/changelog.js（v5.8.1）

function renderMonthlyReportTab(panel) {
  var db = appState.db;
  panel.innerHTML = '';
  
  // Header
  panel.appendChild(h('h3', {}, '📊 月度系统数据报告'));
  panel.appendChild(h('p', { style: { fontSize:'13px', color:'var(--text-secondary)', marginBottom:'16px' } }, '按月汇总专家库变动、仪表盘数据、系统使用情况及更新日志。'));
  
  // Month selector
  var now = new Date();
  var defaultYear = now.getFullYear();
  var defaultMonth = now.getMonth() + 1;
  if (!appState.reportMonth) appState.reportMonth = { year: defaultYear, month: defaultMonth };
  
  var headerBar = h('div', { style: { display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px', flexWrap:'wrap' } });
  
  var prevBtn = h('button', { className: 'btn btn-sm', style: { background:'#f3f4f6' }, onclick: function() {
    var m = appState.reportMonth.month - 1;
    var y = appState.reportMonth.year;
    if (m < 1) { m = 12; y--; }
    appState.reportMonth = { year: y, month: m };
    renderMonthlyReportTab(panel);
  } }, '◀ 上月');
  
  var monthLabel = h('span', { style: { fontSize:'18px', fontWeight:'700', minWidth:'140px', textAlign:'center' } }, appState.reportMonth.year + '年' + appState.reportMonth.month + '月');
  
  var nextBtn = h('button', { className: 'btn btn-sm', style: { background:'#f3f4f6' }, onclick: function() {
    var m = appState.reportMonth.month + 1;
    var y = appState.reportMonth.year;
    if (m > 12) { m = 1; y++; }
    appState.reportMonth = { year: y, month: m };
    renderMonthlyReportTab(panel);
  } }, '下月 ▶');
  
  headerBar.appendChild(prevBtn);
  headerBar.appendChild(monthLabel);
  headerBar.appendChild(nextBtn);
  
  // Export buttons
  headerBar.appendChild(h('span', { style: { flex: 1 } }));
  headerBar.appendChild(h('button', {
    className: 'btn btn-sm',
    style: { background:'#eff6ff', color:'var(--primary)', fontSize:'12px', padding:'4px 10px', marginRight:'6px' },
    onclick: function() { exportMonthlyReportImage(); }
  }, '导出PNG'));
  headerBar.appendChild(h('button', {
    className: 'btn btn-sm',
    style: { background:'#fef2f2', color:'#dc2626', fontSize:'12px', padding:'4px 10px', marginRight:'6px' },
    onclick: function() { exportMonthlyReportPDF(); }
  }, '导出PDF'));
  headerBar.appendChild(h('a', {
    href: 'https://docs.qq.com/smartsheet/DTVJIWmh2ZXdBUE14?tab=t00i2h',
    target: '_blank',
    style: { fontSize:'12px', color:'var(--primary)', textDecoration:'none', padding:'4px 10px', border:'1px solid var(--primary)', borderRadius:'5px' }
  }, '查看完整进度表 →'));
  
  panel.appendChild(headerBar);
  
  // Calculate month range
  var ry = appState.reportMonth.year;
  var rm = appState.reportMonth.month;
  var monthStart = new Date(ry, rm - 1, 1);
  var monthEnd = new Date(ry, rm, 1);
  
  // ===== Section ①: 本月专家变动 =====
  var newExperts = db.experts.filter(function(e) {
    if (!e.createdAt) return false;
    var d = new Date(e.createdAt);
    return d >= monthStart && d < monthEnd;
  });
  var modifiedExperts = db.experts.filter(function(e) {
    if (!e.updatedAt) return false;
    var d = new Date(e.updatedAt);
    if (d < monthStart || d >= monthEnd) return false;
    // Exclude newly created (already counted above)
    if (e.createdAt && new Date(e.createdAt) >= monthStart && new Date(e.createdAt) < monthEnd) return false;
    return true;
  });
  var eliminatedExperts = db.experts.filter(function(e) {
    if (!e.observationDate) return false;
    var d = new Date(e.observationDate);
    return d >= monthStart && d < monthEnd && (e.status === 'eliminated' || e.status === 'observation');
  });
  
  panel.appendChild(renderReportSection('① 本月专家变动', [
    { label: '新增', count: newExperts.length, color: '#10b981', items: newExperts.map(function(e) { return { name: e.name, detail: (e.fields && e.fields.length ? e.fields.join('/') : '未分类') + ' · ' + (e.company || '未知单位') }; }) },
    { label: '调整', count: modifiedExperts.length, color: '#f59e0b', items: modifiedExperts.map(function(e) { return { name: e.name, detail: '信息已更新' }; }) },
    { label: '观察/淘汰', count: eliminatedExperts.length, color: '#ef4444', items: eliminatedExperts.map(function(e) { return { name: e.name, detail: e.status === 'eliminated' ? '已淘汰' : '观察库' }; }) }
  ]));
  
  // ===== Section ②: 本月合作项目变动 =====
  var newProjects = [];
  var modifiedProjects = [];
  if (db.yiliProjects && Array.isArray(db.yiliProjects)) {
    newProjects = db.yiliProjects.filter(function(p) {
      if (!p.createdAt) return false;
      var d = new Date(p.createdAt);
      return d >= monthStart && d < monthEnd;
    });
    modifiedProjects = db.yiliProjects.filter(function(p) {
      if (!p.updatedAt) return false;
      var d = new Date(p.updatedAt);
      if (d < monthStart || d >= monthEnd) return false;
      // 排除本月新创建的（只看 createdAt，缺失 createdAt 视为老项目）
      if (p.createdAt) {
        var cd = new Date(p.createdAt);
        if (cd >= monthStart && cd < monthEnd) return false;
      }
      return true;
    });
  }
  
  panel.appendChild(renderReportSection('② 本月合作项目变动', [
    { label: '新增', count: newProjects.length, color: '#10b981', items: newProjects.map(function(p) {
      var expertName = p.expertId ? (db.experts.find(function(e) { return e.id === p.expertId; }) || {}).name : (p.pendingExpertName || '待关联');
      return { name: p.title || '未命名项目', detail: expertName + (p.year ? ' · ' + p.year : '') };
    }) },
    { label: '修改', count: modifiedProjects.length, color: '#f59e0b', items: modifiedProjects.map(function(p) {
      var expertName = p.expertId ? (db.experts.find(function(e) { return e.id === p.expertId; }) || {}).name : (p.pendingExpertName || '待关联');
      return { name: p.title || '未命名项目', detail: expertName + ' · 信息已更新' };
    }) }
  ]));
  
  // ===== Section ③: 当前仪表盘快照 =====
  var experts = db.experts.filter(function(e) { return e.status !== 'eliminated' && e.status !== 'observation'; });
  var dist = getFieldDistribution(experts);
  var avgProf = 0, avgInfl = 0, avgOverall = 0;
  var scoredExperts = experts.filter(function(e) { return e.scores && e.scores.overall; });
  if (scoredExperts.length > 0) {
    avgProf = (scoredExperts.reduce(function(s, e) { return s + (e.scores.professional || 0); }, 0) / scoredExperts.length).toFixed(1);
    avgInfl = (scoredExperts.reduce(function(s, e) { return s + (e.scores.influence || 0); }, 0) / scoredExperts.length).toFixed(1);
    avgOverall = (scoredExperts.reduce(function(s, e) { return s + (e.scores.overall || 0); }, 0) / scoredExperts.length).toFixed(1);
  }
  
  var snapCard = h('div', { style: { background:'var(--bg)', borderRadius:'var(--radius-sm)', padding:'16px', border:'1px solid var(--border)', marginBottom:'16px' } });
  snapCard.appendChild(h('div', { style: { fontSize:'13px', fontWeight:'600', marginBottom:'12px' } }, '③ 当前仪表盘快照（' + formatDate(new Date().toISOString()).substring(0, 10) + '）'));
  
  // v5.8.8.2: 所有评分块移到下方与环形图并排横向分布
  
  // Field distribution bar chart (full width, matches frontend)
  if (dist.names.length > 0) {
    var fieldChartDiv = h('div', { style: { marginTop:'8px', height:'260px' } });
    fieldChartDiv.id = 'report-field-chart';
    snapCard.appendChild(fieldChartDiv);
    setTimeout(function() {
      renderBarChartForExport('report-field-chart', dist.names, dist.values, dist.colors, false);
    }, 50);
  } else {
    snapCard.appendChild(h('div', { style: { fontSize:'12px', color:'var(--text-muted)', padding:'12px 0' } }, '暂无专家数据'));
  }
  
  // Score distribution doughnut + numeric cards (side-by-side matching frontend dashboard-grid)
  var scoredExps = experts.filter(function(e) { return e.scores && e.scores.overall > 0; });
  if (scoredExps.length > 0) {
    var scoreAvgProf = (scoredExps.reduce(function(s,e) { return s + (e.scores.professional || 0); }, 0) / scoredExps.length).toFixed(1);
    var scoreAvgInfl = (scoredExps.reduce(function(s,e) { return s + (e.scores.influence || 0); }, 0) / scoredExps.length).toFixed(1);
    var scoreAvgOverall = (scoredExps.reduce(function(s,e) { return s + (e.scores.overall || 0); }, 0) / scoredExps.length).toFixed(1);

    var scoreRow = h('div', { style: { display:'flex', gap:'20px', marginTop:'16px', alignItems:'center', flexWrap:'wrap' } });

    // Left: doughnut chart
    var scoreDistDiv = h('div', { style: { flex:'1 1 380px', minWidth:'300px', height:'260px' } });
    scoreDistDiv.id = 'report-score-dist';
    scoreRow.appendChild(scoreDistDiv);

    // Right: 4 score cards horizontally (matching frontend side-by-side layout)
    // v5.8.8.2: 在职专家+3个评分方块全部移到环形图右侧，横向并排分布
    var scoreNumericDiv = h('div', { style: { flex:'0 0 auto', minWidth:'200px', display:'flex', flexDirection:'row', gap:'10px', alignItems:'center' } });
    function makeScoreCard(label, value, color, sub) {
      return '<div style="text-align:center;padding:10px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;flex:1;min-width:70px">' +
        '<div style="font-size:11px;color:#64748b;margin-bottom:4px">' + label + '</div>' +
        '<div style="font-size:22px;font-weight:700;color:' + color + '">' + value + '</div>' +
        (sub ? '<div style="font-size:10px;color:#94a3b8">' + sub + '</div>' : '') +
      '</div>';
    }
    scoreNumericDiv.innerHTML =
      makeScoreCard('在职专家', experts.length, '#3b82f6', '位专家') +
      makeScoreCard('专业度', scoreAvgProf, '#3B82F6', '满分10分') +
      makeScoreCard('影响力', scoreAvgInfl, '#F59E0B', '满分10分') +
      makeScoreCard('综合评分', scoreAvgOverall, '#10B981', '加权平均');
    scoreRow.appendChild(scoreNumericDiv);

    snapCard.appendChild(scoreRow);
    setTimeout(function() {
      renderScoreDistChart('report-score-dist', experts);
    }, 50);
  }
  panel.appendChild(snapCard);
  
  // ===== Section ④: 系统使用情况 =====
  var usageCard = h('div', { style: { background:'var(--bg)', borderRadius:'var(--radius-sm)', padding:'16px', border:'1px solid var(--border)', marginBottom:'16px' } });
  usageCard.appendChild(h('div', { style: { fontSize:'13px', fontWeight:'600', marginBottom:'12px' } }, '④ 系统使用情况'));
  
  var usageCols = h('div', { style: { display:'flex', gap:'20px', flexWrap:'wrap' } });
  
  // Admin info
  var adminCol = h('div', { style: { flex:'1', minWidth:'200px' } });
  adminCol.appendChild(h('div', { style: { fontSize:'12px', fontWeight:'600', marginBottom:'8px', color:'var(--text-secondary)' } }, '管理权限分布'));
  var masterCount = db.subAdmins ? db.subAdmins.filter(function(a) { return a.role === 'master'; }).length : 1;
  var subCount = db.subAdmins ? db.subAdmins.filter(function(a) { return a.role !== 'master'; }).length : 0;
  adminCol.appendChild(renderUsageRow('主管理员', masterCount));
  adminCol.appendChild(renderUsageRow('子管理员', subCount));
  adminCol.appendChild(renderUsageRow('专家总数', db.experts.length));
  adminCol.appendChild(renderUsageRow('合作项目总数', (db.yiliProjects || []).length));
  usageCols.appendChild(adminCol);
  
  // Page views (placeholder - will be populated when counter is implemented)
  var viewCol = h('div', { style: { flex:'1', minWidth:'200px' } });
  viewCol.appendChild(h('div', { style: { fontSize:'12px', fontWeight:'600', marginBottom:'8px', color:'var(--text-secondary)' } }, '前端访问情况'));
  var pageViews = loadPageViews(ry, rm);
  viewCol.appendChild(renderUsageRow('本月访问', pageViews.monthly));
  viewCol.appendChild(renderUsageRow('累计访问', pageViews.total));
  viewCol.appendChild(h('div', { style: { fontSize:'11px', color:'var(--text-muted)', marginTop:'6px' } }, '注：访问计数基于本地记录，完整统计需后续部署'));
  usageCols.appendChild(viewCol);
  
  usageCard.appendChild(usageCols);
  panel.appendChild(usageCard);
  
  // ===== Section ⑤: 系统更新日志概要 =====
  var logCard = h('div', { style: { background:'var(--bg)', borderRadius:'var(--radius-sm)', padding:'16px', border:'1px solid var(--border)', marginBottom:'16px' } });
  logCard.appendChild(h('div', { style: { fontSize:'13px', fontWeight:'600', marginBottom:'12px' } }, '⑤ 系统更新日志概要'));
  
  var monthLogs = VERSION_CHANGELOG.filter(function(entry) {
    var d = new Date(entry.date);
    return d >= monthStart && d < monthEnd;
  });
  
  if (monthLogs.length === 0) {
    logCard.appendChild(h('div', { style: { fontSize:'12px', color:'var(--text-muted)', padding:'8px 0' } }, '本月无更新记录'));
  } else {
    monthLogs.forEach(function(entry) {
      var row = h('div', { style: { display:'flex', gap:'10px', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)' } });
      row.appendChild(h('span', { style: { fontSize:'12px', fontWeight:'700', color:'var(--primary)', minWidth:'60px' } }, entry.version));
      row.appendChild(h('span', { style: { fontSize:'11px', color:'var(--text-muted)', minWidth:'60px' } }, entry.date.substring(5)));
      row.appendChild(h('span', { style: { fontSize:'12px', flex:1 } }, entry.summary));
      row.appendChild(h('span', { style: { fontSize:'10px', color:'#888', background:'#f0f0f0', padding:'2px 8px', borderRadius:'8px' } }, entry.module));
      logCard.appendChild(row);
    });
  }
  
  logCard.appendChild(h('a', {
    href: 'https://docs.qq.com/smartsheet/DTVJIWmh2ZXdBUE14?tab=t00i2h',
    target: '_blank',
    style: { display:'inline-block', marginTop:'10px', fontSize:'11px', color:'var(--primary)', textDecoration:'none' }
  }, '查看完整进度表 →'));
  panel.appendChild(logCard);
}

// ===== v5.8.1: 月度报告导出为图片（Canvas → PNG） =====
function exportMonthlyReportImage() {
  var canvas = buildMonthlyReportCanvas();
  if (!canvas) return;
  canvas.toBlob(function(blob) {
    downloadBlob(blob, '月度报告_' + appState.reportMonth.year + '-' + String(appState.reportMonth.month).padStart(2,'0') + '.png');
    toast('月度报告图片已下载', 'success');
  }, 'image/png');
}

// ===== v5.8.1: 月度报告导出为PDF（Canvas → JPEG → PDF） =====
function exportMonthlyReportPDF() {
  var canvas = buildMonthlyReportCanvas();
  if (!canvas) return;
  canvas.toBlob(function(jpegBlob) {
    var reader = new FileReader();
    reader.onload = function() {
      generateMonthlyPDFFromJPEG(reader.result, canvas.width, canvas.height);
    };
    reader.readAsArrayBuffer(jpegBlob);
  }, 'image/jpeg', 0.92);
}

function buildMonthlyReportCanvas() {
  var db = appState.db;
  var ry = appState.reportMonth.year;
  var rm = appState.reportMonth.month;
  var monthStart = new Date(ry, rm - 1, 1);
  var monthEnd = new Date(ry, rm, 1);
  
  // Gather data
  var newExperts = db.experts.filter(function(e) {
    if (!e.createdAt) return false;
    var d = new Date(e.createdAt);
    return d >= monthStart && d < monthEnd;
  });
  var modifiedExperts = db.experts.filter(function(e) {
    if (!e.updatedAt) return false;
    var d = new Date(e.updatedAt);
    if (d < monthStart || d >= monthEnd) return false;
    if (e.createdAt && new Date(e.createdAt) >= monthStart && new Date(e.createdAt) < monthEnd) return false;
    return true;
  });
  var eliminatedExperts = db.experts.filter(function(e) {
    if (!e.observationDate) return false;
    var d = new Date(e.observationDate);
    return d >= monthStart && d < monthEnd && (e.status === 'eliminated' || e.status === 'observation');
  });
  
  var newProjects = [], modifiedProjects = [];
  if (db.yiliProjects && Array.isArray(db.yiliProjects)) {
    newProjects = db.yiliProjects.filter(function(p) {
      if (!p.createdAt) return false;
      var d = new Date(p.createdAt);
      return d >= monthStart && d < monthEnd;
    });
    modifiedProjects = db.yiliProjects.filter(function(p) {
      if (!p.updatedAt) return false;
      var d = new Date(p.updatedAt);
      if (d < monthStart || d >= monthEnd) return false;
      // 排除本月新创建的（缺失 createdAt 视为老项目，归入修改）
      if (p.createdAt) {
        var cd = new Date(p.createdAt);
        if (cd >= monthStart && cd < monthEnd) return false;
      }
      return true;
    });
  }
  
  var experts = db.experts.filter(function(e) { return e.status !== 'eliminated' && e.status !== 'observation'; });
  var dist = getFieldDistribution(experts);
  var scoredExperts = experts.filter(function(e) { return e.scores && e.scores.overall; });
  var avgProf = 0, avgInfl = 0, avgOverall = 0;
  if (scoredExperts.length > 0) {
    avgProf = (scoredExperts.reduce(function(s, e) { return s + (e.scores.professional || 0); }, 0) / scoredExperts.length).toFixed(1);
    avgInfl = (scoredExperts.reduce(function(s, e) { return s + (e.scores.influence || 0); }, 0) / scoredExperts.length).toFixed(1);
    avgOverall = (scoredExperts.reduce(function(s, e) { return s + (e.scores.overall || 0); }, 0) / scoredExperts.length).toFixed(1);
  }
  
  var monthLogs = VERSION_CHANGELOG.filter(function(entry) {
    var d = new Date(entry.date);
    return d >= monthStart && d < monthEnd;
  });
  
  // Canvas dimensions
  var W = 800;
  var sectionGap = 16;
  var titleH = 50;
  var sec1H = 80 + Math.max(newExperts.length, modifiedExperts.length, eliminatedExperts.length, 1) * 22;
  var sec2H = 80 + Math.max(newProjects.length, modifiedProjects.length, 1) * 22;
  var barChartH = 280;
  var scoreDistH = scoredExperts.length > 0 ? 220 : 0;
  var sec3H = 60 + barChartH + scoreDistH;
  var sec4H = 120;
  var sec5H = 60 + monthLogs.length * 28;
  var H = titleH + sec1H + sec2H + sec3H + sec4H + sec5H + sectionGap * 6 + 40;
  
  var canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  var ctx = canvas.getContext('2d');
  
  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  
  var y = 20;
  var leftPad = 40;
  var rightEdge = W - 40;
  
  // ---- Title ----
  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 20px -apple-system, "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('伊利集团 · 数智化赋能优质专家资源库 — 月度报告', W/2, y + 22);
  ctx.fillStyle = '#64748B';
  ctx.font = '13px -apple-system, "Microsoft YaHei", sans-serif';
  ctx.fillText(ry + '年' + rm + '月  |  导出时间：' + new Date().toLocaleString('zh-CN'), W/2, y + 42);
  y += titleH + sectionGap;
  
  // Helper: draw section title
  function drawSectionTitle(text) {
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 14px -apple-system, "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(text, leftPad, y + 16);
    y += 28;
  }
  
  // Helper: draw stat box
  function drawStatBox(label, count, color, x) {
    var bw = 110, bh = 40;
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#E2E8F0';
    roundRect(ctx, x, y, bw, bh, 6, true, true);
    ctx.fillStyle = color;
    ctx.font = 'bold 18px -apple-system, "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(count), x + bw/2, y + 20);
    ctx.fillStyle = '#64748B';
    ctx.font = '11px -apple-system, "Microsoft YaHei", sans-serif';
    ctx.fillText(label, x + bw/2, y + 34);
  }
  
  // Helper: draw text row
  function drawTextRow(text, xPos, textY) {
    ctx.fillStyle = '#334155';
    ctx.font = '12px -apple-system, "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(text, xPos, textY);
  }
  
  // ---- Section 1: Expert changes ----
  drawSectionTitle('① 本月专家变动');
  drawStatBox('新增', newExperts.length, '#10b981', leftPad);
  drawStatBox('调整', modifiedExperts.length, '#f59e0b', leftPad + 125);
  drawStatBox('观察/淘汰', eliminatedExperts.length, '#ef4444', leftPad + 250);
  y += 50;
  
  // Detail lines
  if (newExperts.length > 0) {
    drawTextRow('新增明细：', leftPad, y + 14);
    y += 18;
    newExperts.forEach(function(e) {
      drawTextRow('  • ' + e.name + ' — ' + (e.fields && e.fields.length ? e.fields.join('/') : '未分类') + ' · ' + (e.company || '未知单位'), leftPad + 10, y + 14);
      y += 20;
    });
  }
  if (modifiedExperts.length > 0) {
    drawTextRow('调整明细：', leftPad, y + 14);
    y += 18;
    modifiedExperts.forEach(function(e) {
      drawTextRow('  • ' + e.name + ' — 信息已更新', leftPad + 10, y + 14);
      y += 20;
    });
  }
  if (eliminatedExperts.length > 0) {
    drawTextRow('观察/淘汰明细：', leftPad, y + 14);
    y += 18;
    eliminatedExperts.forEach(function(e) {
      drawTextRow('  • ' + e.name + ' — ' + (e.status === 'eliminated' ? '已淘汰' : '观察库'), leftPad + 10, y + 14);
      y += 20;
    });
  }
  y += 8;
  y += sectionGap;
  
  // ---- Section 2: Project changes ----
  drawSectionTitle('② 本月合作项目变动');
  drawStatBox('新增', newProjects.length, '#10b981', leftPad);
  drawStatBox('修改', modifiedProjects.length, '#f59e0b', leftPad + 125);
  y += 50;
  
  if (newProjects.length > 0) {
    drawTextRow('新增明细：', leftPad, y + 14);
    y += 18;
    newProjects.forEach(function(p) {
      var expertName = p.expertId ? (db.experts.find(function(e) { return e.id === p.expertId; }) || {}).name : (p.pendingExpertName || '待关联');
      drawTextRow('  • ' + (p.title || '未命名项目') + ' — ' + expertName + (p.year ? ' · ' + p.year : ''), leftPad + 10, y + 14);
      y += 20;
    });
  }
  if (modifiedProjects.length > 0) {
    drawTextRow('修改明细：', leftPad, y + 14);
    y += 18;
    modifiedProjects.forEach(function(p) {
      var expertName = p.expertId ? (db.experts.find(function(e) { return e.id === p.expertId; }) || {}).name : (p.pendingExpertName || '待关联');
      drawTextRow('  • ' + (p.title || '未命名项目') + ' — ' + expertName + ' · 信息已更新', leftPad + 10, y + 14);
      y += 20;
    });
  }
  y += 8;
  y += sectionGap;
  
  // ---- Section 3: Dashboard snapshot ----
  // v5.8.8.2: 所有评分块移到环形图右侧横向并排分布
  drawSectionTitle('③ 当前仪表盘快照（' + formatDate(new Date().toISOString()).substring(0, 10) + '）');

  // Vertical bar chart
  if (dist.names.length > 0) {
    drawTextRow('领域分布：', leftPad, y + 14);
    y += 22;
    drawBarChartOnCanvas(ctx, dist.names, dist.values, dist.colors, leftPad, y, W - leftPad * 2, barChartH - 40);
    y += barChartH - 30;
  }
  
  // Score distribution doughnut + numeric cards (side-by-side)
  if (scoredExperts.length > 0) {
    drawTextRow('专家评分分布：', leftPad, y + 14);
    y += 22;
    var sDistLabels = ['9-10分（优秀）', '8-9分（良好）', '7-8分（合格）', '<7分（待提升）'];
    var sDistData = [
      scoredExperts.filter(function(e) { return e.scores.overall >= 9; }).length,
      scoredExperts.filter(function(e) { return e.scores.overall >= 8 && e.scores.overall < 9; }).length,
      scoredExperts.filter(function(e) { return e.scores.overall >= 7 && e.scores.overall < 8; }).length,
      scoredExperts.filter(function(e) { return e.scores.overall < 7; }).length
    ];
    // Doughnut on left (60% width), score cards on right
    var doughnutW = (W - leftPad * 2) * 0.55;
    drawDoughnutChartOnCanvas(ctx, sDistLabels, sDistData, leftPad, y, doughnutW, scoreDistH - 30);
    
    // Score numeric cards on right (4 cards horizontally: 在职专家 + 3 averages)
    var cardX = leftPad + doughnutW + 15;
    var cardAreaW = W - leftPad - cardX;
    var cardCount = 4;
    var cardGap = 8;
    var cardW = (cardAreaW - (cardCount - 1) * cardGap) / cardCount;
    var cardH = scoreDistH - 30;
    var allCards = [
      { label: '在职专家', value: String(experts.length), color: '#3b82f6', sub: '位专家' },
      { label: '专业度', value: avgProf, color: '#3B82F6', sub: '满分10分' },
      { label: '影响力', value: avgInfl, color: '#F59E0B', sub: '满分10分' },
      { label: '综合评分', value: avgOverall, color: '#10B981', sub: '加权平均' }
    ];

    for (var ci = 0; ci < cardCount; ci++) {
      var cx = cardX + ci * (cardW + cardGap);
      var c = allCards[ci];
      // Card background
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      roundRect(ctx, cx, y, cardW, cardH, 4);
      ctx.fill();
      ctx.stroke();
      // Label
      ctx.fillStyle = '#64748b';
      ctx.font = '10px -apple-system, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(c.label, cx + cardW/2, y + 10);
      // Value
      ctx.fillStyle = c.color;
      ctx.font = 'bold 20px -apple-system, "Microsoft YaHei", sans-serif';
      ctx.fillText(c.value, cx + cardW/2, y + 30);
      // Sub
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px -apple-system, "Microsoft YaHei", sans-serif';
      ctx.fillText(c.sub, cx + cardW/2, y + 54);
    }
    
    y += scoreDistH;
  }
  y += sectionGap;
  
  // ---- Section 4: System usage ----
  drawSectionTitle('④ 系统使用情况');
  var masterCount = db.subAdmins ? db.subAdmins.filter(function(a) { return a.role === 'master'; }).length : 1;
  var subCount = db.subAdmins ? db.subAdmins.filter(function(a) { return a.role !== 'master'; }).length : 0;
  var pageViews = loadPageViews(ry, rm);
  
  drawTextRow('主管理员：' + masterCount + '人', leftPad, y + 14);
  drawTextRow('子管理员：' + subCount + '人', leftPad + 200, y + 14);
  y += 22;
  drawTextRow('专家总数：' + db.experts.length + '人', leftPad, y + 14);
  drawTextRow('合作项目总数：' + (db.yiliProjects || []).length + '个', leftPad + 200, y + 14);
  y += 22;
  drawTextRow('本月页面访问：' + pageViews.monthly + '次', leftPad, y + 14);
  drawTextRow('累计页面访问：' + pageViews.total + '次', leftPad + 200, y + 14);
  y += 30;
  y += sectionGap;
  
  // ---- Section 5: Changelog ----
  drawSectionTitle('⑤ 系统更新日志概要');
  if (monthLogs.length === 0) {
    drawTextRow('本月无更新记录', leftPad, y + 14);
    y += 22;
  } else {
    monthLogs.forEach(function(entry) {
      drawTextRow(entry.version + '  ' + entry.date.substring(5) + '  ' + entry.summary + '  [' + entry.module + ']', leftPad, y + 14);
      y += 24;
    });
  }
  
  return canvas;
}

function generateMonthlyPDFFromJPEG(jpegBuffer, imgW, imgH) {
  var pdfW = 595;
  var scale = pdfW / imgW;
  var pdfH = imgH * scale;
  var jpegBytes = new Uint8Array(jpegBuffer);
  var encoder = new TextEncoder();
  
  var header = encoder.encode('%PDF-1.4\n');
  var obj1 = encoder.encode('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  var obj2 = encoder.encode('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  var obj3 = encoder.encode('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pdfW + ' ' + pdfH + '] /Contents 4 0 R /Resources << /XObject << /Img0 5 0 R >> >> >>\nendobj\n');
  
  var contentStream = 'q\n' + pdfW + ' 0 0 ' + pdfH + ' 0 0 cm\n/Img0 Do\nQ\n';
  var obj4header = '4 0 obj\n<< /Length ' + contentStream.length + ' >>\nstream\n';
  var obj4footer = '\nendstream\nendobj\n';
  
  var obj5header = encoder.encode('5 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + imgW + ' /Height ' + imgH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpegBytes.length + ' >>\nstream\n');
  var obj5footer = encoder.encode('\nendstream\nendobj\n');
  
  var offset = 0;
  var offsets = [];
  offsets.push(offset); offset += header.length;
  offsets.push(offset); offset += obj1.length;
  offsets.push(offset); offset += obj2.length;
  offsets.push(offset); offset += obj3.length;
  var obj4Offset = offset;
  offset += encoder.encode(obj4header).length + contentStream.length + encoder.encode(obj4footer).length;
  offsets.push(offset);
  offset += obj5header.length + jpegBytes.length + obj5footer.length;
  
  var xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (var k = 0; k < offsets.length; k++) {
    var offStr = offsets[k].toString();
    while (offStr.length < 10) offStr = '0' + offStr;
    xref += offStr + ' 00000 n \n';
  }
  var trailer = 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + offset + '\n%%EOF';
  
  var parts = [
    header, obj1, obj2, obj3,
    encoder.encode(obj4header), encoder.encode(contentStream), encoder.encode(obj4footer),
    obj5header, jpegBytes, obj5footer,
    encoder.encode(xref), encoder.encode(trailer)
  ];
  
  var pdfBlob = new Blob(parts, { type: 'application/pdf' });
  downloadBlob(pdfBlob, '月度报告_' + appState.reportMonth.year + '-' + String(appState.reportMonth.month).padStart(2,'0') + '.pdf');
  toast('月度报告PDF已下载', 'success');
}

// Helper: render a report section with stat cards + collapsible detail
function renderReportSection(title, stats) {
  var card = h('div', { style: { background:'var(--bg)', borderRadius:'var(--radius-sm)', padding:'16px', border:'1px solid var(--border)', marginBottom:'16px' } });
  card.appendChild(h('div', { style: { fontSize:'13px', fontWeight:'600', marginBottom:'12px' } }, title));
  
  // Stat cards row
  var statRow = h('div', { style: { display:'flex', gap:'12px', flexWrap:'wrap', marginBottom: stats.some(function(s) { return s.items.length > 0; }) ? '10px' : '0' } });
  var hasDetail = false;
  
  stats.forEach(function(stat) {
    var statBox = h('div', { style: { flex:'1', minWidth:'100px', textAlign:'center', padding:'10px', borderRadius:'8px', background:'#fff', border:'1px solid var(--border)' } });
    statBox.appendChild(h('div', { style: { fontSize:'24px', fontWeight:'700', color: stat.color } }, String(stat.count)));
    statBox.appendChild(h('div', { style: { fontSize:'11px', color:'var(--text-secondary)', marginTop:'2px' } }, stat.label));
    statRow.appendChild(statBox);
    if (stat.items.length > 0) hasDetail = true;
  });
  card.appendChild(statRow);
  
  // Collapsible detail
  if (hasDetail) {
    var detailId = 'detail-' + Math.random().toString(36).substring(2, 8);
    var toggleBtn = h('button', {
      className: 'btn btn-sm',
      style: { background:'#f3f4f6', fontSize:'12px', width:'100%', marginTop:'4px' },
      onclick: function() {
        var detail = document.getElementById(detailId);
        if (detail) {
          if (detail.style.display === 'none') {
            detail.style.display = 'block';
            this.textContent = '收起明细 ▲';
          } else {
            detail.style.display = 'none';
            this.textContent = '展开明细 ▼';
          }
        }
      }
    }, '展开明细 ▼');
    card.appendChild(toggleBtn);
    
    var detail = h('div', { id: detailId, style: { display:'none', marginTop:'8px' } });
    stats.forEach(function(stat) {
      if (stat.items.length === 0) return;
      detail.appendChild(h('div', { style: { fontSize:'11px', fontWeight:'600', color: stat.color, marginTop:'8px', marginBottom:'4px' } }, stat.label + '：'));
      stat.items.forEach(function(item) {
        detail.appendChild(h('div', { style: { fontSize:'12px', padding:'3px 0 3px 12px', borderLeft:'2px solid ' + stat.color, marginBottom:'2px' } },
          h('span', { style: { fontWeight:'600' } }, item.name),
          h('span', { style: { color:'var(--text-muted)', marginLeft:'6px' } }, item.detail)
        ));
      });
    });
    card.appendChild(detail);
  }
  
  return card;
}

// Helper: render a stat box
function renderStatBox(label, value, color) {
  var box = h('div', { style: { textAlign:'center', padding:'12px 16px', borderRadius:'8px', background:'#fff', border:'1px solid var(--border)', minWidth:'100px' } });
  box.appendChild(h('div', { style: { fontSize:'22px', fontWeight:'700', color: color } }, String(value)));
  box.appendChild(h('div', { style: { fontSize:'11px', color:'var(--text-secondary)', marginTop:'2px' } }, label));
  return box;
}

// Helper: render a usage row
function renderUsageRow(label, value) {
  return h('div', { style: { display:'flex', justifyContent:'space-between', padding:'4px 0', fontSize:'12px' } },
    h('span', { style: { color:'var(--text-secondary)' } }, label),
    h('span', { style: { fontWeight:'600' } }, String(value))
  );
}

// Helper: load page views from localStorage (simple counter)
function loadPageViews(year, month) {
  try {
    var key = 'yili_page_views';
    var data = JSON.parse(localStorage.getItem(key) || '{}');
    var monthKey = year + '-' + String(month).padStart(2, '0');
    var monthly = data[monthKey] || 0;
    var total = Object.values(data).reduce(function(s, v) { return s + v; }, 0);
    return { monthly: monthly, total: total };
  } catch(e) {
    return { monthly: 0, total: 0 };
  }
}

// Helper: increment page view (called on boot)
function incrementPageView() {
  try {
    var key = 'yili_page_views';
    var data = JSON.parse(localStorage.getItem(key) || '{}');
    var now = new Date();
    var monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    data[monthKey] = (data[monthKey] || 0) + 1;
    localStorage.setItem(key, JSON.stringify(data));
  } catch(e) { /* silent */ }
}

document.addEventListener('DOMContentLoaded', boot);
