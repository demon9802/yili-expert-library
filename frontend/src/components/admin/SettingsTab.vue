<template>
  <section class="admin-tab settings-tab">
    <div class="admin-toolbar">
      <h3>系统设置</h3>
    </div>

    <!-- ① 界面设置 -->
    <div class="setting-card">
      <h4 class="section-title">① 界面设置</h4>
      <p class="section-desc">调整前端界面的标题名称与配色方案，修改后即时预览。</p>

      <!-- 主标题名称 -->
      <div class="form-block">
        <label class="form-label">主标题名称</label>
        <input v-model="titleInput" class="setting-input" placeholder="输入主标题..." />
      </div>

      <!-- 配色方案 -->
      <div class="form-block">
        <label class="form-label">配色方案</label>
        <div class="scheme-grid">
          <button
            v-for="(scheme, key) in schemes"
            :key="key"
            class="scheme-btn"
            :class="{ active: store.colorScheme === key }"
            @click="pickScheme(key)"
          >
            <span class="scheme-dots">
              <i :style="{ background: scheme.primary }"></i>
              <i :style="{ background: scheme.light }"></i>
              <i :style="{ background: scheme.dark }"></i>
            </span>
            <span class="scheme-name">{{ scheme.name }}</span>
          </button>
        </div>
      </div>

      <!-- 手机端视图 -->
      <div class="form-block">
        <label class="form-label">手机端视图</label>
        <label class="checkbox-row">
          <input v-model="mobileAdaptationInput" type="checkbox" />
          <span>启用手机端适配（关闭后所有设备强制显示桌面版）</span>
        </label>
        <p class="input-hint">手机端适配仍在细化中，建议确认后再开启。</p>
        <div class="form-actions">
          <button class="btn primary" :disabled="saving" @click="saveInterface">保存并应用</button>
          <button class="btn" @click="resetInterface">恢复默认</button>
        </div>
      </div>

      <!-- 排序标签 -->
      <div class="form-block">
        <label class="form-label">排序标签</label>
        <p class="input-hint">管理前端展示的排序选项，可新增或删除。</p>
        <div class="sort-list">
          <div v-for="(opt, idx) in sortOptionsInput" :key="opt.id" class="sort-item">
            <span class="sort-name">{{ opt.name }}</span>
            <span class="sort-id">ID: {{ opt.id }}</span>
            <button
              v-if="!isDefaultSort(opt.id)"
              class="btn btn-danger btn-sm"
              @click="removeSortOption(idx)"
            >删除</button>
          </div>
        </div>
        <div class="sort-add-row">
          <input v-model="newSortName" class="setting-input" placeholder="排序名称" />
          <input v-model="newSortId" class="setting-input" placeholder="排序ID（英文）" />
          <button class="btn primary" :disabled="!canAddSort" @click="addSortOption">添加</button>
        </div>
      </div>
    </div>

    <!-- 测试模式 -->
    <div class="setting-card test-mode-card">
      <div class="test-mode-header">
        <span class="test-mode-icon">⚡</span>
        <span class="test-mode-title">测试模式</span>
      </div>
      <p class="section-desc">使用独立数据空间模拟不同角色视角，修改不会影响真实生产数据。支持切换主管理员、子管理员、普通用户三种角色。</p>
      <button class="btn btn-warning" @click="enterTestMode">进入测试模式</button>
    </div>

    <!-- ② 系统更新时间 -->
    <div class="setting-card">
      <h4 class="section-title">② 系统更新时间</h4>
      <p class="section-desc">记录系统配置与部署的最近更新日期（非专家数据更新时间）。</p>
      <div class="time-row">
        <span>最近更新：{{ updateTimeText }}</span>
        <button class="btn" @click="refreshTime">刷新</button>
      </div>
    </div>

    <!-- ③ 数据源 -->
    <div class="setting-card">
      <h4 class="section-title">③ 数据源</h4>
      <p class="section-desc">核心数据来源及版本管理文档，仅供查看。批量导入请通过专家管理页的模板导入进行。</p>
      <div class="doc-list">
        <div class="doc-card">
          <div class="doc-icon folder">📁</div>
          <div class="doc-body">
            <div class="doc-title">初始源数据表</div>
            <div class="doc-desc">专家资源库初始数据来源（腾讯文档，n99xou 工作表）</div>
            <a class="doc-link" :href="CORE_SOURCE_URL" target="_blank" rel="noopener">打开源数据表</a>
          </div>
        </div>
        <div class="doc-card">
          <div class="doc-icon sheet">📊</div>
          <div class="doc-body">
            <div class="doc-title">版本更新进度管理表</div>
            <div class="doc-desc">所有功能需求的优先级、排期、完成状态追踪</div>
            <a class="doc-link" :href="PROGRESS_SOURCE_URL" target="_blank" rel="noopener">打开进度表</a>
          </div>
        </div>
      </div>
    </div>

    <!-- ④ 系统文档 -->
    <div class="setting-card">
      <h4 class="section-title">④ 系统文档</h4>
      <p class="section-desc">系统运维、权限规范及部署操作指引，持续补充中。</p>
      <div class="doc-list">
        <div class="doc-card">
          <div class="doc-icon lock">🔒</div>
          <div class="doc-body">
            <div class="doc-title">权限说明文档</div>
            <div class="doc-desc">三角色权限体系说明（主管理员/子管理员/前端用户），含RLS策略及Supabase数据访问规则</div>
          </div>
          <span class="doc-status">待补充</span>
        </div>
        <div class="doc-card">
          <div class="doc-icon rocket">🚀</div>
          <div class="doc-body">
            <div class="doc-title">部署操作SOP</div>
            <div class="doc-desc">EdgeOne Pages 静态托管部署流程、GitHub 同步操作、自定义域名与ICP备案指南</div>
          </div>
          <span class="doc-status">待补充</span>
        </div>
      </div>
    </div>

    <!-- ⑤ 部署信息 -->
    <div class="setting-card">
      <h4 class="section-title">⑤ 部署信息</h4>
      <p class="section-desc">前端托管于 EdgeOne Pages（腾讯 CDN），数据库使用 Supabase（新加坡节点）。</p>
      <div class="deploy-info">
        <div class="deploy-row">
          <span class="deploy-label">正式链接</span>
          <a class="deploy-value" :href="DEPLOY_URL" target="_blank" rel="noopener">{{ DEPLOY_URL }}</a>
        </div>
        <div class="deploy-row">
          <span class="deploy-label">代码仓库</span>
          <a class="deploy-value" :href="REPO_URL" target="_blank" rel="noopener">{{ REPO_URL }}</a>
        </div>
        <div class="deploy-row">
          <span class="deploy-label">数据库</span>
          <span class="deploy-value">Supabase（新加坡）</span>
        </div>
      </div>
    </div>

    <!-- ⑥ 危险操作 -->
    <div class="setting-card danger">
      <h4 class="section-title">⑥ 危险操作</h4>
      <p class="section-desc">清除本地缓存会移除浏览器中保存的收藏等本地数据，并重新从服务器加载。不会删除服务器上的专家数据。</p>
      <button class="btn danger" @click="clearCache">重置所有数据</button>
    </div>

    <p v-if="message" class="message">{{ message }}</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useAppStore } from '@/store/appStore'

const store = useAppStore()
const DEFAULT_TITLE = 'DACC·数智化赋能优质专家资源库'

const CORE_SOURCE_URL = 'https://docs.qq.com/sheet/DTUROVmZod2FxSGFO?tab=n99xou'
const PROGRESS_SOURCE_URL = 'https://docs.qq.com/smartsheet/DTVJIWmh2ZXdBUE14?tab=t00i2h'
const DEPLOY_URL = 'https://yili-expert-library-bvw2itdk.zh-cn.edgeone.cool/'
const REPO_URL = 'https://github.com/demon9802/yili-expert-library'

const titleInput = ref(store.platformTitle || DEFAULT_TITLE)
const mobileAdaptationInput = ref(store.mobileAdaptation)
const saving = ref(false)
const message = ref('')

const schemes = computed(() => store.COLOR_SCHEMES)

const defaultSortIds = ['default', 'overall', 'professional', 'influence']
const sortOptionsInput = ref<{ id: string; name: string }[]>([])
const newSortName = ref('')
const newSortId = ref('')

const updateTimeText = computed(() => {
  const t = store.updateTime
  if (!t) return '尚未设置'
  const d = new Date(t)
  if (isNaN(d.getTime())) return t
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
})

const canAddSort = computed(() => {
  const name = newSortName.value.trim()
  const id = newSortId.value.trim()
  return name && id && /^[a-zA-Z0-9_-]+$/.test(id) && !sortOptionsInput.value.some(o => o.id === id)
})

onMounted(() => {
  titleInput.value = store.platformTitle || DEFAULT_TITLE
  mobileAdaptationInput.value = store.mobileAdaptation
  sortOptionsInput.value = store.sortOptions.map(o => ({ ...o }))
})

function isDefaultSort(id: string) {
  return defaultSortIds.includes(id)
}

function addSortOption() {
  if (!canAddSort.value) return
  sortOptionsInput.value.push({ id: newSortId.value.trim(), name: newSortName.value.trim() })
  newSortName.value = ''
  newSortId.value = ''
}

function removeSortOption(idx: number) {
  sortOptionsInput.value.splice(idx, 1)
}

async function saveInterface() {
  saving.value = true
  try {
    const t = titleInput.value.trim()
    if (!t) {
      message.value = '主标题不能为空'
      return
    }
    await store.setPlatformTitle(t)
    await store.setMobileAdaptation(mobileAdaptationInput.value)

    // 确保默认四项至少存在
    const ids = sortOptionsInput.value.map(o => o.id)
    const missing = defaultSortIds.filter(d => !ids.includes(d))
    if (missing.length) {
      message.value = '默认排序项（default/overall/professional/influence）不可删除'
      return
    }
    await store.saveSortOptions(sortOptionsInput.value.map(o => ({ id: o.id, name: o.name })))

    message.value = '界面设置已保存并应用'
  } finally {
    saving.value = false
  }
}

function resetInterface() {
  titleInput.value = DEFAULT_TITLE
  mobileAdaptationInput.value = true
  sortOptionsInput.value = [
    { id: 'default', name: '默认排序' },
    { id: 'overall', name: '按综合评分' },
    { id: 'professional', name: '按专业度' },
    { id: 'influence', name: '按影响力' }
  ]
  store.setPlatformTitle(DEFAULT_TITLE)
  store.setMobileAdaptation(true)
  store.saveSortOptions(sortOptionsInput.value.map(o => ({ id: o.id, name: o.name })))
  message.value = '已恢复默认界面设置'
}

function pickScheme(key: string) {
  store.setColorScheme(key)
  message.value = '配色方案已更新：' + (schemes.value[key]?.name || key)
}

async function refreshTime() {
  await store.refreshUpdateTime()
  message.value = '更新时间已刷新'
}

function enterTestMode() {
  alert('测试模式功能正在开发中，将在独立数据空间中模拟不同角色视角。')
}

function clearCache() {
  if (!confirm('确认清除本地缓存？将移除浏览器收藏等本地数据并重新加载。')) return
  localStorage.removeItem('yili_expert_db')
  localStorage.removeItem('yili_search_history')
  location.reload()
}
</script>

<style scoped>
.admin-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.settings-tab h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.setting-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 18px;
  margin-bottom: 16px;
  background: var(--surface);
}

.section-title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
}

.section-desc {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0 0 16px;
  line-height: 1.5;
}

.form-block {
  margin-bottom: 18px;
}

.form-block:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 8px;
}

.setting-input {
  flex: 1;
  min-width: 180px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-family: inherit;
}

.input-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 6px 0 0;
  line-height: 1.5;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
}

.checkbox-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--primary);
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}

.scheme-grid {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.scheme-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 10px;
  cursor: pointer;
  border: 2px solid var(--border);
  background: #fff;
  transition: all 0.2s;
}

.scheme-btn.active {
  border-color: var(--primary);
  background: var(--primary-light);
}

.scheme-dots {
  display: flex;
  gap: 4px;
}

.scheme-dots i {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.scheme-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}

.sort-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.sort-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.sort-name {
  flex: 1;
  font-weight: 500;
}

.sort-id {
  color: var(--text-muted);
  font-size: 12px;
}

.sort-add-row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.test-mode-card {
  background: #fffbeb;
  border-color: #fde68a;
}

.test-mode-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.test-mode-icon {
  font-size: 16px;
}

.test-mode-title {
  font-size: 14px;
  font-weight: 600;
  color: #92400e;
}

.test-mode-card .section-desc {
  color: #a16207;
}

.time-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--text);
}

.doc-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.doc-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.doc-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 20px;
  flex-shrink: 0;
}

.doc-icon.folder { background: #fef3c7; }
.doc-icon.sheet { background: #dbeafe; }
.doc-icon.lock { background: #fee2e2; }
.doc-icon.rocket { background: #e0e7ff; }

.doc-body {
  flex: 1;
}

.doc-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 2px;
}

.doc-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 8px;
  line-height: 1.5;
}

.doc-link {
  display: inline-block;
  padding: 4px 10px;
  border: 1px solid var(--primary);
  border-radius: var(--radius-sm);
  color: var(--primary);
  font-size: 12px;
  text-decoration: none;
  cursor: pointer;
}

.doc-status {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg);
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

.deploy-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.deploy-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.deploy-label {
  color: var(--text-muted);
  min-width: 70px;
}

.deploy-value {
  color: var(--primary);
  text-decoration: none;
  word-break: break-all;
}

.deploy-value:hover {
  text-decoration: underline;
}

.setting-card.danger {
  border-color: var(--danger, #dc2626);
}

.btn {
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn.primary {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

.btn.danger {
  background: #dc2626;
  color: #fff;
  border-color: #dc2626;
}

.btn-warning {
  background: #f59e0b;
  color: #fff;
  border-color: #f59e0b;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}

.btn-danger {
  background: #fef2f2;
  color: #dc2626;
  border-color: #fecaca;
}

.message {
  color: var(--success, #059669);
  font-size: 13px;
  margin-top: 8px;
}
</style>
