<template>
  <section class="admin-tab ratings-tab">
    <div class="tab-header"><h3>评分管理</h3></div>
    <p class="tab-desc">管理前端评分展示开关、执行自动评分、手动调整专家分值及处理评分预警。评分项与权重由系统统一锁定，主管理员可查看评分说明文档。</p>

    <!-- 前端展示控制 -->
    <div class="config-card">
      <h4>前端展示控制</h4>
      <div class="toggle-row">
        <span>在前端展示评分信息（专家卡片 &amp; 详情页）：</span>
        <label class="switch">
          <input type="checkbox" :checked="store.showScores" @change="onToggleShow($event)" />
          <span class="slider"></span>
        </label>
        <span class="toggle-state">{{ store.showScores ? '展示中' : '已隐藏' }}</span>
      </div>
      <p class="hint">关闭后，专家卡片和详情页将不再显示任何评分数字，仅管理员在后台可见评分。</p>
    </div>

    <!-- 自动评分引擎 -->
    <div class="config-card">
      <h4>自动评分引擎</h4>
      <p class="hint">系统根据专家的学历、履历、职务、资质、荣誉、合作项目等信息自动识别并计算五星制评分。识别规则经过多轮调优，对“资深行业实战派”等特殊履历做单独保护，避免分值失真。</p>
      <div class="engine-actions">
        <button class="btn primary" :disabled="batchRunning" @click="runBatchScoring">
          {{ batchRunning ? `正在重算 ${batchProgress}...` : '一键重算全部专家评分' }}
        </button>
      </div>
      <div v-if="batchMessage" class="batch-message" :class="batchSuccess ? 'success' : 'error'">{{ batchMessage }}</div>
    </div>

    <!-- 评分说明文档（V5 仅主管理员可见；当前 V6 暂未区分主/子管理员角色，待权限管理模块接入后按角色控制） -->
    <div class="config-card">
      <h4>评分说明文档</h4>
      <pre class="rules-doc">{{ rulesDoc }}</pre>
    </div>

    <!-- 专家评分调整 -->
    <div class="config-card">
      <h4>专家评分调整</h4>
      <div class="quick-row">
        <input v-model="searchQuery" type="search" placeholder="搜索专家姓名..." class="search-input" />
      </div>
      <div class="table-scroll-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>姓名</th>
              <th>专业度</th>
              <th>影响力</th>
              <th>综合</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in filteredExperts" :key="e.id">
              <td class="cell-name">{{ e.name }}</td>
              <td class="cell-prof">{{ e.scores?.professional != null ? e.scores.professional.toFixed(1) : '-' }}</td>
              <td class="cell-infl">{{ e.scores?.influence != null ? e.scores.influence.toFixed(1) : '-' }}</td>
              <td class="cell-overall" :style="{ color: overallColor(e.scores?.overall), fontWeight: '700' }">
                {{ e.scores?.overall != null ? e.scores.overall.toFixed(1) : '-' }}
              </td>
              <td class="actions">
                <button class="btn btn-ai btn-sm" :disabled="runningId === e.id" @click="autoScoreOne(e)">
                  {{ runningId === e.id ? '计算中' : '自动评分' }}
                </button>
                <button class="btn btn-secondary btn-sm" @click="openEdit(e)">编辑评分</button>
              </td>
            </tr>
            <tr v-if="filteredExperts.length === 0">
              <td colspan="5" class="empty">暂无专家</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 评分预警区 -->
    <div class="config-card warn-zone">
      <h4>评分预警区</h4>
      <div v-if="lowExperts.length === 0" class="ok-box">
        <div class="ok-title">无预警 · 所有专家评分正常</div>
      </div>
      <div v-for="e in lowExperts" :key="e.id" class="warn-item">
        <div class="warn-head">
          <strong>{{ e.name }}　综合：{{ e.scores?.overall != null ? e.scores.overall.toFixed(1) : '-' }}</strong>
          <div class="warn-actions">
            <button class="btn btn-sm btn-ai" @click="autoScoreOne(e)">重新识别评分</button>
            <button class="btn btn-sm btn-ok" @click="adjustToThreshold(e)">调整至 3.5★</button>
            <button class="btn btn-sm btn-warn" @click="moveToObservation(e)">移入观察库</button>
          </div>
        </div>
        <div class="warn-sub">专业度：{{ e.scores?.professional != null ? e.scores.professional.toFixed(1) : '-' }} ｜ 影响力：{{ e.scores?.influence != null ? e.scores.influence.toFixed(1) : '-' }}</div>
        <div v-if="lowReasons(e).length" class="warn-reasons">
          <div v-for="r in lowReasons(e)" :key="r" class="warn-reason">• {{ r }}</div>
        </div>
      </div>
    </div>

    <!-- 编辑评分弹窗 -->
    <div v-if="editing" class="modal-mask" @click.self="closeEdit">
      <form class="modal-card" @submit.prevent="saveScores">
        <h3>编辑评分 - {{ editing.name }}</h3>
        <label>专业度（0-5★）<input v-model.number="scores.professional" type="number" min="0" max="5" step="0.1" /></label>
        <label>影响力（0-5★）<input v-model.number="scores.influence" type="number" min="0" max="5" step="0.1" /></label>
        <label>综合评分（0-5★）<input v-model.number="scores.overall" type="number" min="0" max="5" step="0.1" /></label>
        <div class="modal-actions">
          <button class="btn primary" type="submit">保存</button>
          <button class="btn" type="button" @click="closeEdit">取消</button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { expertApi } from '@/api/expert'
import { useAppStore } from '@/store/appStore'
import { autoScoreExpert, RATING_RULES_DOC } from '@/utils/scoring'
import type { Expert, Scores } from '@/types'

const store = useAppStore()
const searchQuery = ref('')
const runningId = ref<number | null>(null)
const batchRunning = ref(false)
const batchProgress = ref('')
const batchMessage = ref('')
const batchSuccess = ref(true)

const rulesDoc = RATING_RULES_DOC

// ===== 前端展示控制 =====
function onToggleShow(e: Event) {
  store.setShowScores((e.target as HTMLInputElement).checked)
}

// ===== 自动评分 =====
async function autoScoreOne(e: Expert) {
  runningId.value = e.id
  try {
    await store.autoScoreExpertById(e.id)
  } finally {
    runningId.value = null
  }
}

async function runBatchScoring() {
  batchRunning.value = true
  batchProgress.value = '0%'
  batchMessage.value = ''
  try {
    const total = store.experts.length
    // 前端先本地计算进度显示
    for (let i = 0; i <= total; i += Math.max(1, Math.floor(total / 10))) {
      batchProgress.value = Math.round((i / total) * 100) + '%'
      await new Promise(r => setTimeout(r, 30))
    }
    const updated = await store.autoScoreAllExperts()
    batchSuccess.value = true
    batchMessage.value = `已完成 ${updated} 位专家的自动评分更新`
  } catch (err: any) {
    batchSuccess.value = false
    batchMessage.value = '批量评分失败：' + (err?.message || String(err))
  } finally {
    batchRunning.value = false
    batchProgress.value = ''
  }
}

// ===== 专家评分调整 =====
const filteredExperts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return store.experts
    .filter(e => e.status !== 'eliminated')
    .filter(e => !q || e.name.toLowerCase().includes(q))
})

function overallColor(v: number | null | undefined): string {
  if (v == null) return 'inherit'
  if (v >= 4.0) return '#059669'
  if (v >= 3.5) return '#d97706'
  return '#dc2626'
}

// ===== 评分预警区（V5 阈值 7/10 映射为 5 星制 3.5）=====
const WARN_THRESHOLD = 3.5
const lowExperts = computed(() =>
  store.experts.filter(e => e.status !== 'eliminated' && (e.scores?.overall ?? 0) < WARN_THRESHOLD)
)

function lowReasons(e: Expert): string[] {
  const result = autoScoreExpert(e, store.yiliProjects)
  return result.reasons.length ? result.reasons : [
    `专业度（${e.scores?.professional?.toFixed(1) ?? '-'}）或影响力（${e.scores?.influence?.toFixed(1) ?? '-'}）偏低，建议补充材料后重新识别评分。`
  ]
}

async function adjustToThreshold(e: Expert) {
  const updated = await expertApi.update(e.id, {
    scores: {
      ...(e.scores || {}),
      professional: Math.max(e.scores?.professional ?? 0, WARN_THRESHOLD),
      influence: Math.max(e.scores?.influence ?? 0, WARN_THRESHOLD),
      overall: WARN_THRESHOLD
    },
  })
  syncExpert(updated)
}

async function moveToObservation(e: Expert) {
  const updated = await expertApi.update(e.id, {
    status: 'observation',
    observationStatus: 'evaluating',
    observationDate: new Date().toISOString(),
  })
  syncExpert(updated)
}

function syncExpert(updated: Expert) {
  const idx = store.experts.findIndex(x => x.id === updated.id)
  if (idx >= 0) store.experts[idx] = updated
}

// ===== 编辑评分 =====
const editing = ref<Expert | null>(null)
const scores = reactive<Scores>({ professional: null, influence: null, overall: null })

function openEdit(expert: Expert) {
  editing.value = expert
  Object.assign(scores, expert.scores || { professional: null, influence: null, overall: null })
}
function closeEdit() {
  editing.value = null
}
async function saveScores() {
  if (!editing.value) return
  const updated = await expertApi.update(editing.value.id, { scores: { ...scores } })
  syncExpert(updated)
  closeEdit()
}
</script>

<style scoped>
.tab-header { margin-bottom: 4px; }
.tab-header h3 { font-size: 18px; font-weight: 600; margin: 0; }
.tab-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; }

.config-card {
  background: var(--bg);
  padding: 16px;
  border-radius: var(--radius-sm);
  margin-bottom: 16px;
  border: 1px solid var(--border);
}
.config-card h4 { margin: 0 0 12px; font-size: 15px; color: var(--primary); }

/* Toggle */
.toggle-row { display: flex; gap: 12px; align-items: center; font-size: 13px; }
.toggle-state { font-size: 12px; color: var(--text-secondary); }
.switch { position: relative; display: inline-block; width: 44px; height: 24px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; inset: 0; background: #cbd5e1; border-radius: 24px; transition: 0.2s; }
.slider::before { content: ''; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.2s; }
.switch input:checked + .slider { background: #2563eb; }
.switch input:checked + .slider::before { transform: translateX(20px); }

.hint { font-size: 12px; color: var(--text-muted); margin: 8px 0 0; }

/* Engine */
.engine-actions { display: flex; gap: 10px; margin-top: 12px; }
.batch-message { margin-top: 10px; padding: 8px 12px; border-radius: 6px; font-size: 13px; }
.batch-message.success { background: #f0fdf4; color: #059669; border: 1px solid #bbf7d0; }
.batch-message.error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }

/* Rules doc */
.rules-doc {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px 14px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--text-secondary);
  white-space: pre-wrap;
  margin: 0;
}

/* Tables */
.quick-row { margin-bottom: 12px; }
.search-input { width: 100%; max-width: 280px; padding: 8px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; }
.search-input:focus { outline: none; border-color: var(--primary); }
.table-scroll-wrapper { overflow: auto; max-height: 45vh; border: 1px solid var(--border); border-radius: var(--radius-sm); }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 560px; }
.data-table th, .data-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; }
.data-table th { background: var(--surface); font-weight: 600; color: var(--text-secondary); font-size: 12px; }
.data-table tr:hover { background: #f8fafc; }
.cell-name { font-weight: 600; }
.cell-prof { color: #3B82F6; font-weight: 600; }
.cell-infl { color: #F59E0B; font-weight: 600; }
.cell-overall { font-weight: 700; }
.actions { display: flex; gap: 6px; }
.btn { padding: 6px 12px; border: 1px solid var(--border); border-radius: 4px; background: #fff; cursor: pointer; font-size: 13px; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.btn-secondary { background: var(--bg); color: var(--text-secondary); }
.btn-ai { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.btn-ai:disabled { opacity: 0.6; cursor: not-allowed; }
.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.primary:disabled { opacity: 0.7; cursor: not-allowed; }
.empty { text-align: center; color: #888; padding: 24px; }

/* Warning zone */
.warn-zone { border-color: #fde68a; background: #fffbeb; }
.warn-zone h4 { color: #b45309; }
.ok-box { padding: 16px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0; }
.ok-title { font-size: 14px; font-weight: 600; color: #059669; }
.warn-item { background: #fff; padding: 14px; border-radius: 8px; margin-bottom: 8px; border: 1px solid #fde68a; }
.warn-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.warn-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.btn-ok { background: #059669; color: #fff; border-color: #059669; }
.btn-warn { background: #d97706; color: #fff; border-color: #d97706; }
.warn-sub { font-size: 12px; color: var(--text-secondary); margin-top: 6px; }
.warn-reasons { margin-top: 8px; padding: 10px; background: #fffbeb; border-radius: 6px; }
.warn-reason { font-size: 11px; color: #92400e; padding: 2px 0; }

/* Modal */
.modal-mask { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; background: rgb(0 0 0 / 35%); }
.modal-card { width: min(420px, 92vw); padding: 20px; border-radius: 8px; background: #fff; }
.modal-card h3 { margin-top: 0; }
.modal-card label { display: block; margin: 10px 0; font-size: 13px; font-weight: 600; }
.modal-card input { width: 100%; box-sizing: border-box; margin-top: 4px; padding: 8px; border: 1px solid var(--border); border-radius: 6px; }
.modal-actions { margin-top: 16px; text-align: right; }
</style>
