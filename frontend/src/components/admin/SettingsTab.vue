<template>
  <section class="admin-tab settings-tab">
    <div class="admin-toolbar">
      <h3>系统设置</h3>
    </div>

    <!-- 数据源管理 -->
    <div class="setting-card">
      <h4>数据源管理</h4>
      <p class="setting-hint">从腾讯文档源数据更新专家库。更新不会覆盖已有数据，重复项由管理员确认处理。</p>

      <div class="setting-row">
        <input v-model="sourceDocLink" class="setting-input" placeholder="粘贴腾讯文档分享链接..." />
        <button class="btn primary" :disabled="savingLink" @click="saveSourceLink">保存链接</button>
      </div>

      <div class="src-links">
        <div class="src-link-item">
          <div class="src-link-title">📎 核心源数据表（初始专家数据）</div>
          <a class="src-link-url" :href="CORE_SOURCE_URL" target="_blank" rel="noopener">{{ CORE_SOURCE_URL }}</a>
          <div class="src-link-sub">主管理员维护的线上文档，点击可在新窗口打开</div>
        </div>
        <div class="src-link-item">
          <div class="src-link-title">📎 进度更新表（合作项目 / 评分进度）</div>
          <a class="src-link-url" :href="PROGRESS_SOURCE_URL" target="_blank" rel="noopener">{{ PROGRESS_SOURCE_URL }}</a>
          <div class="src-link-sub">进度与评分维护表，点击可在新窗口打开</div>
        </div>
      </div>
    </div>

    <!-- 主标题名称 -->
    <div class="setting-card">
      <h4>主标题名称</h4>
      <p class="setting-hint">将作为前台顶部标题、后台标题与浏览器标签名称。</p>
      <div class="setting-row">
        <input v-model="titleInput" class="setting-input" placeholder="输入主标题..." />
        <button class="btn primary" :disabled="saving || !titleInput.trim()" @click="saveTitle">保存并应用</button>
        <button class="btn" @click="resetTitle">恢复默认</button>
      </div>
    </div>

    <!-- 配色方案 -->
    <div class="setting-card">
      <h4>配色方案</h4>
      <p class="setting-hint">选择后即时生效，应用于全站主色。</p>
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

    <!-- 应用描述 -->
    <div class="setting-card">
      <h4>应用描述</h4>
      <textarea v-model="descInput" class="setting-textarea" rows="3" placeholder="用于前台副标题/分享说明（可选）" />
      <button class="btn primary" :disabled="saving" @click="saveDesc">保存描述</button>
    </div>

    <!-- 数据更新时间 -->
    <div class="setting-card">
      <h4>数据更新时间</h4>
      <div class="setting-row">
        <span class="update-text">当前：{{ updateTimeText }}</span>
        <button class="btn" @click="refreshTime">刷新</button>
      </div>
    </div>

    <!-- 危险操作 -->
    <div class="setting-card danger">
      <h4>危险操作</h4>
      <p class="setting-hint">
        清除本地缓存会移除浏览器中保存的收藏等本地数据，并重新从服务器加载。不会删除服务器上的专家数据。
      </p>
      <button class="btn danger" @click="clearCache">清除本地缓存并重载</button>
    </div>

    <p v-if="message" class="message">{{ message }}</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useAppStore } from '@/store/appStore'
import { settingApi } from '@/api/setting'

const store = useAppStore()
const DEFAULT_TITLE = 'DACC·数智化赋能优质专家资源库'

// 两个腾讯文档嵌套表格（数据源）
const CORE_SOURCE_URL = 'https://docs.qq.com/sheet/DTUROVmZod2FxSGFO?tab=n99xou'
const PROGRESS_SOURCE_URL = 'https://docs.qq.com/smartsheet/DTVJIWmh2ZXdBUE14?tab=t00i2h'

const titleInput = ref(store.platformTitle || DEFAULT_TITLE)
const descInput = ref(store.appDescription || '')
const saving = ref(false)
const message = ref('')

const sourceDocLink = ref('')
const savingLink = ref(false)

const schemes = computed(() => store.COLOR_SCHEMES)

const updateTimeText = computed(() => {
  const t = store.updateTime
  if (!t) return '尚未设置'
  const d = new Date(t)
  if (isNaN(d.getTime())) return t
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
})

onMounted(async () => {
  titleInput.value = store.platformTitle || DEFAULT_TITLE
  descInput.value = store.appDescription || ''
  try {
    const link = await settingApi.get('sourceDocLink')
    if (link) sourceDocLink.value = link
  } catch {
    /* 忽略：数据源链接为可选项 */
  }
})

async function saveSourceLink() {
  savingLink.value = true
  try {
    await settingApi.save('sourceDocLink', sourceDocLink.value.trim())
    message.value = '源文档链接已保存'
  } catch {
    message.value = '源文档链接保存失败'
  } finally {
    savingLink.value = false
  }
}

async function saveTitle() {
  const t = titleInput.value.trim()
  if (!t) {
    message.value = '主标题不能为空'
    return
  }
  saving.value = true
  try {
    await store.setPlatformTitle(t)
    message.value = '主标题已更新'
  } finally {
    saving.value = false
  }
}

function resetTitle() {
  titleInput.value = DEFAULT_TITLE
  store.setPlatformTitle(DEFAULT_TITLE)
  message.value = '已恢复默认主标题'
}

function pickScheme(key: string) {
  store.setColorScheme(key)
  message.value = '配色方案已更新：' + (schemes.value[key]?.name || key)
}

async function saveDesc() {
  saving.value = true
  try {
    await store.setAppDescription(descInput.value)
    message.value = '应用描述已保存'
  } finally {
    saving.value = false
  }
}

async function refreshTime() {
  await store.refreshUpdateTime()
  message.value = '更新时间已刷新'
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
.setting-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 16px;
  background: var(--surface);
}

.src-links {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}
.src-link-item {
  background: var(--primary-light, #eff6ff);
  border: 1px solid #93c5fd;
  border-radius: var(--radius-sm);
  padding: 10px 12px;
}
.src-link-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary, #2563eb);
  margin-bottom: 4px;
}
.src-link-url {
  display: block;
  font-size: 12px;
  color: var(--primary, #2563eb);
  word-break: break-all;
  line-height: 1.6;
  text-decoration: underline;
}
.src-link-sub {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
}
.setting-card h4 {
  margin: 0 0 4px;
  font-size: 14px;
}
.setting-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0 0 12px;
}
.setting-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.setting-input {
  flex: 1;
  min-width: 220px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-family: inherit;
}
.setting-textarea {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 12px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
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
.update-text {
  font-size: 13px;
  color: var(--text-secondary);
}
.setting-card.danger {
  border-color: var(--danger, #dc2626);
}
.message {
  color: var(--success, #059669);
  font-size: 13px;
}
.btn {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: #fff;
  cursor: pointer;
  font-size: 13px;
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
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
