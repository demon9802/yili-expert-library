<template>
  <section class="admin-tab ratings-tab">
    <div class="tab-header"><h3>评分管理</h3></div>
    <p class="tab-desc">管理评分的维度配置、子维度权重及所有专家的各项分值。调整后自动重新计算综合评分。</p>

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
      <p class="hint">关闭后，专家卡片和详情页将不再显示任何评分数字及子维度信息，仅管理员在后台可见评分。</p>
    </div>

    <!-- 评分体系配置 -->
    <div class="config-card">
      <h4>评分体系配置</h4>
      <p class="hint">权重与评分项由系统统一锁定（专业度 60% / 影响力 40%），综合评分 = 专业度 × 60% + 影响力 × 40%。子维度按等权平均计入对应维度。</p>
      <div
        v-for="dim in ratingDimensions"
        :key="dim.id"
        class="dim-card"
        :style="{ borderColor: dim.border }"
      >
        <div class="dim-head">
          <strong :style="{ color: dim.color }">{{ dim.name }}</strong>
          <span class="dim-weight">权重 {{ dim.weight }}%</span>
        </div>
        <div class="dim-desc">{{ dim.desc }}</div>
        <ul class="dim-items">
          <li v-for="it in dim.items" :key="it">{{ it }}</li>
        </ul>
      </div>
    </div>

    <!-- AI 自主评分 -->
    <div class="config-card">
      <h4>AI 自主评分</h4>
      <div class="toggle-row">
        <span>启用AI自动评分：</span>
        <label class="switch">
          <input type="checkbox" :checked="aiEnabled" @change="onAiToggle($event)" />
          <span class="slider"></span>
        </label>
        <span class="toggle-state">{{ aiEnabled ? '已启用' : '已关闭' }}</span>
      </div>
      <p class="hint">AI 根据专家学历、资历、履历等信息自动生成各子维度评分。关闭后可手动在下方调整每位专家的评分。</p>
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
              <th rowspan="2">姓名</th>
              <th rowspan="2">专业度</th>
              <th rowspan="2">影响力</th>
              <th rowspan="2">综合</th>
              <th v-for="it in ratingDimensions[0].items" :key="it" class="sub-head prof">{{ it }}</th>
              <th v-for="it in ratingDimensions[1].items" :key="it" class="sub-head infl">{{ it }}</th>
              <th rowspan="2">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in filteredExperts" :key="e.id">
              <td class="cell-name">{{ e.name }}</td>
              <td class="cell-prof">{{ num(e.scores?.professional) }}</td>
              <td class="cell-infl">{{ num(e.scores?.influence) }}</td>
              <td class="cell-overall" :style="{ color: overallColor(e.scores?.overall), fontWeight: '700' }">
                {{ num(e.scores?.overall) }}
              </td>
              <td v-for="it in ratingDimensions[0].items" :key="it" class="sub-cell">
                <input
                  class="sub-input"
                  type="number" min="0" max="5" step="0.1"
                  :value="subsFor(e).professional[it]"
                  @change="onSubChange(e, 'professional', it, $event)"
                />
              </td>
              <td v-for="it in ratingDimensions[1].items" :key="it" class="sub-cell">
                <input
                  class="sub-input infl"
                  type="number" min="0" max="5" step="0.1"
                  :value="subsFor(e).influence[it]"
                  @change="onSubChange(e, 'influence', it, $event)"
                />
              </td>
              <td class="actions">
                <button class="btn btn-ai btn-sm" :disabled="runningId === e.id" @click="autoScoreOne(e)">
                  {{ runningId === e.id ? '计算中' : '重置AI' }}
                </button>
                <button class="btn btn-secondary btn-sm" @click="openEdit(e)">编辑评分</button>
              </td>
            </tr>
            <tr v-if="filteredExperts.length === 0">
              <td colspan="12" class="empty">暂无专家</td>
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
          <strong>{{ e.name }}　综合：{{ num(e.scores?.overall) }}</strong>
          <div class="warn-actions">
            <button class="btn btn-sm btn-ai" @click="autoScoreOne(e)">重新识别评分</button>
            <button class="btn btn-sm btn-ok" @click="adjustToThreshold(e)">调整至 3.5★</button>
            <button class="btn btn-sm btn-warn" @click="moveToObservation(e)">移入观察库</button>
          </div>
        </div>
        <div class="warn-sub">专业度：{{ num(e.scores?.professional) }} ｜ 影响力：{{ num(e.scores?.influence) }}</div>
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
import { ref, reactive, computed, onMounted } from 'vue'
import { expertApi } from '@/api/expert'
import { settingApi } from '@/api/setting'
import { useAppStore } from '@/store/appStore'
import { autoScoreExpert } from '@/utils/scoring'
import type { Expert, Scores } from '@/types'

const store = useAppStore()
const searchQuery = ref('')
const runningId = ref<number | null>(null)
const aiEnabled = ref(true)

const ratingDimensions = [
  {
    id: 'professional',
    name: '专业度',
    weight: 60,
    color: '#1d4ed8',
    border: '#dbeafe',
    desc: '由学历与学术背景、行业资质与认证、专业成果与经验、课程与培训体系四项等权平均得出。',
    items: ['学历与学术背景', '行业资质与认证', '专业成果与经验', '课程与培训体系'],
  },
  {
    id: 'influence',
    name: '影响力',
    weight: 40,
    color: '#b45309',
    border: '#fef3c7',
    desc: '由社会荣誉与奖项、职称与专业头衔、管理履历与行业地位三项等权平均得出。',
    items: ['社会荣誉与奖项', '职称与专业头衔', '管理履历与行业地位'],
  },
]

// ===== 子维度评分（用于表格展示/编辑）=====
const expertBreakdowns = computed(() => {
  const map = new Map<number, { professional: Record<string, number>; influence: Record<string, number> }>()
  store.experts.forEach(e => {
    if (e.subScores?.professional && e.subScores?.influence) {
      map.set(e.id, {
        professional: e.subScores.professional as Record<string, number>,
        influence: e.subScores.influence as Record<string, number>,
      })
    } else {
      const bd = autoScoreExpert(e, store.yiliProjects)
      map.set(e.id, { professional: bd.professionalItems, influence: bd.influenceItems })
    }
  })
  return map
})

function subsFor(e: Expert) {
  return expertBreakdowns.value.get(e.id) || { professional: {} as Record<string, number>, influence: {} as Record<string, number> }
}

function clampInput(v: number): number {
  if (isNaN(v)) return 0
  return Math.min(5, Math.max(0, Math.round(v * 10) / 10))
}

function computeFromSubs(profMap: Record<string, number>, inflMap: Record<string, number>) {
  const pVals = Object.values(profMap).map(Number).filter(n => Number.isFinite(n))
  const iVals = Object.values(inflMap).map(Number).filter(n => Number.isFinite(n))
  const professional = pVals.length ? clampInput(pVals.reduce((s, n) => s + n, 0) / pVals.length) : 0
  const influence = iVals.length ? clampInput(iVals.reduce((s, n) => s + n, 0) / iVals.length) : 0
  const overall = clampInput(professional * 0.6 + influence * 0.4)
  return { professional, influence, overall }
}

async function onSubChange(e: Expert, dim: 'professional' | 'influence', item: string, ev: Event) {
  const raw = parseFloat((ev.target as HTMLInputElement).value)
  const v = clampInput(raw)
  const cur = subsFor(e)
  const profMap = { ...cur.professional }
  const inflMap = { ...cur.influence }
  if (dim === 'professional') profMap[item] = v
  else inflMap[item] = v
  const { professional, influence, overall } = computeFromSubs(profMap, inflMap)
  const updated = await expertApi.update(e.id, {
    scores: { professional, influence, overall },
    subScores: { professional: profMap, influence: inflMap },
  })
  syncExpert(updated)
}

// ===== 前端展示控制 =====
function onToggleShow(e: Event) {
  store.setShowScores((e.target as HTMLInputElement).checked)
}

// ===== AI 自主评分 =====
onMounted(async () => {
  try {
    const v = await settingApi.get('aiScoringEnabled')
    if (v != null) aiEnabled.value = v !== 'false'
  } catch { /* 忽略 */ }
})

async function onAiToggle(ev: Event) {
  const checked = (ev.target as HTMLInputElement).checked
  aiEnabled.value = checked
  try {
    await settingApi.save('aiScoringEnabled', checked ? 'true' : 'false')
  } catch { /* 忽略 */ }
  if (checked) await runBatchScoring()
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

const batchRunning = ref(false)
const batchProgress = ref('')
const batchMessage = ref('')
const batchSuccess = ref(true)

async function runBatchScoring() {
  batchRunning.value = true
  batchProgress.value = '0%'
  batchMessage.value = ''
  try {
    const total = store.experts.length
    for (let i = 0; i <= total; i += Math.max(1, Math.floor(total / 10))) {
      batchProgress.value = Math.round((i / total) * 100) + '%'
      await new Promise(r => setTimeout(r, 20))
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

function num(v: number | null | undefined): string {
  return v == null ? '-' : v.toFixed(1)
}

function overallColor(v: number | null | undefined): string {
  if (v == null) return 'inherit'
  if (v >= 4.0) return '#059669'
  if (v >= 3.5) return '#d97706'
  return '#dc2626'
}

// ===== 评分预警区（阈值 3.5★）=====
const WARN_THRESHOLD = 3.5
const lowExperts = computed(() =>
  store.experts.filter(e => e.status !== 'eliminated' && (e.scores?.overall ?? 0) < WARN_THRESHOLD)
)

function lowReasons(e: Expert): string[] {
  const result = autoScoreExpert(e, store.yiliProjects)
  return result.reasons.length ? result.reasons : [
    `专业度（${num(e.scores?.professional)}）或影响力（${num(e.scores?.influence)}）偏低，建议补充材料后重新识别评分。`
  ]
}

async function adjustToThreshold(e: Expert) {
  const updated = await expertApi.update(e.id, {
    scores: {
      ...(e.scores || {}),
      professional: Math.max(e.scores?.professional ?? 0, WARN_THRESHOLD),
      influence: Math.max(e.scores?.influence ?? 0, WARN_THRESHOLD),
      overall: WARN_THRESHOLD,
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

/* 评分体系配置 */
.dim-card { background: var(--surface); border: 2px solid var(--border); border-radius: var(--radius-sm); padding: 14px 16px; margin-bottom: 12px; }
.dim-head { display: flex; align-items: baseline; gap: 10px; }
.dim-head strong { font-size: 15px; }
.dim-weight { font-size: 13px; color: var(--text-muted); }
.dim-desc { font-size: 12px; color: var(--text-secondary); margin: 6px 0 8px; }
.dim-items { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 0; padding: 0; list-style: none; }
.dim-items li { font-size: 12px; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 2px 10px; }

/* Tables */
.quick-row { margin-bottom: 12px; }
.search-input { width: 100%; max-width: 280px; padding: 8px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; }
.search-input:focus { outline: none; border-color: var(--primary); }
.table-scroll-wrapper { overflow: auto; max-height: 45vh; border: 1px solid var(--border); border-radius: var(--radius-sm); }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 1080px; }
.data-table th, .data-table td { padding: 8px 10px; text-align: center; border-bottom: 1px solid var(--border); white-space: nowrap; }
.data-table th { background: var(--surface); font-weight: 600; color: var(--text-secondary); font-size: 12px; }
.data-table tr:hover { background: #f8fafc; }
.sub-head.prof { color: #1d4ed8; }
.sub-head.infl { color: #b45309; }
.cell-name { font-weight: 600; text-align: left; }
.cell-prof { color: #3B82F6; font-weight: 600; }
.cell-infl { color: #F59E0B; font-weight: 600; }
.cell-overall { font-weight: 700; }
.sub-cell { padding: 4px 6px; }
.sub-input { width: 52px; padding: 3px 4px; border: 1px solid var(--border); border-radius: 4px; font-size: 11px; text-align: center; }
.sub-input:focus { outline: none; border-color: var(--primary); }
.sub-input.infl { border-color: #fde68a; }
.actions { display: flex; gap: 6px; justify-content: center; }
.btn { padding: 6px 12px; border: 1px solid var(--border); border-radius: 4px; background: #fff; cursor: pointer; font-size: 13px; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.btn-secondary { background: var(--bg); color: var(--text-secondary); }
.btn-ai { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.btn-ai:disabled { opacity: 0.6; cursor: not-allowed; }
.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
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
