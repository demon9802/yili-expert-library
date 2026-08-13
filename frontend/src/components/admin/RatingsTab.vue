<template>
  <section class="admin-tab ratings-tab">
    <div class="tab-header"><h3>评分管理</h3></div>
    <p class="tab-desc">管理评分的展示、规则文档及所有专家的 5 个评分项分值。调整后自动重新计算专业度、影响力与综合得分。</p>

    <!-- 前端展示控制 -->
    <div class="config-card">
      <h4>前端展示控制</h4>
      <div class="toggle-row">
        <span>在前端展示评分信息（专家卡片 &amp; 详情页）：</span>
        <label class="checkbox-toggle">
          <input type="checkbox" :checked="store.showScores" @change="onToggleShow($event)" />
        </label>
        <span class="toggle-state">{{ store.showScores ? '展示中' : '已隐藏' }}</span>
      </div>
      <p class="hint">关闭后，专家卡片和详情页将不再显示任何评分数字及评分项信息，仅管理员在后台可见评分。</p>
    </div>

    <!-- 评分配置（规则及文档） -->
    <div class="config-card">
      <h4>评分配置（规则及文档）</h4>

      <div class="doc-card">
        <div>
          <div class="doc-title">评分规则</div>
          <div class="doc-name">五星制完整文档（v5.9.3）</div>
        </div>
        <button class="doc-link" type="button" @click="showRuleDoc = true">打开完整文档 →</button>
      </div>

      <div class="rule-table-wrap">
        <table class="rule-table">
          <thead>
            <tr>
              <th>维度</th>
              <th>评分项</th>
              <th>评分项构成</th>
            </tr>
          </thead>
          <tbody>
            <tr class="prof-row">
              <td class="dimension" :rowspan="professionalItems.length">专业度</td>
              <td>{{ professionalItems[0] }}</td>
              <td>学历层次、院校背景、学术经历、研究背景等。</td>
            </tr>
            <tr class="prof-row">
              <td>{{ professionalItems[1] }}</td>
              <td>行业证书、执业资格、权威认证、专业资质等。</td>
            </tr>
            <tr class="prof-row">
              <td>{{ professionalItems[2] }}</td>
              <td>项目经验、研究成果、方法论沉淀、服务案例等。</td>
            </tr>
            <tr class="infl-row">
              <td class="dimension" :rowspan="influenceItems.length">影响力</td>
              <td>{{ influenceItems[0] }}</td>
              <td>社会荣誉、专业奖项、行业表彰、学会/协会角色等。</td>
            </tr>
            <tr class="infl-row">
              <td>{{ influenceItems[1] }}</td>
              <td>职称头衔、管理履历、行业身份、组织职位与影响范围等。</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="missing-tip">信息缺失（未填/未公开/无法核实）的评分项，默认按 2★ 计。</p>
      <div class="toggle-row auto-row">
        <label class="inline-check">
          <input type="checkbox" :checked="aiEnabled" @change="onAiToggle($event)" />
          <span>启用自动评分</span>
        </label>
        <span class="hint inline-hint">系统根据专家学历、资历、履历等信息自动生成评分项分值。</span>
      </div>
    </div>

    <!-- 专家评分调整 -->
    <div class="config-card">
      <h4>专家评分调整</h4>
      <p class="hint adjust-hint">直接修改表格中 5 个评分项的整数分值（1-5，最高 5★）；专业度、影响力、综合得分由系统自动计算，不可直接编辑。</p>
      <div class="quick-row">
        <input v-model="searchQuery" type="search" placeholder="搜索专家姓名..." class="search-input" />
        <button class="btn btn-secondary" type="button" :disabled="batchRunning" @click="runBatchScoring">
          {{ batchRunning ? '重置中...' : '整体重置为自动评分' }}
        </button>
      </div>
      <p v-if="batchMessage" class="batch-message" :class="{ error: !batchSuccess }">{{ batchMessage }}</p>

      <div class="table-scroll-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>姓名</th>
              <th>专业度</th>
              <th>影响力</th>
              <th v-for="it in professionalItems" :key="it" class="sub-head prof">{{ it }}</th>
              <th v-for="it in influenceItems" :key="it" class="sub-head infl">{{ it }}</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in filteredExperts" :key="e.id">
              <td class="cell-name">{{ e.name }}</td>
              <td class="score-cell prof-score">{{ num(e.scores?.professional) }}</td>
              <td class="score-cell infl-score">{{ num(e.scores?.influence) }}</td>
              <td v-for="it in professionalItems" :key="it" class="sub-cell">
                <input
                  class="sub-input"
                  type="number"
                  min="1"
                  max="5"
                  step="1"
                  :value="subsFor(e).professional[it]"
                  @change="onSubChange(e, 'professional', it, $event)"
                />
              </td>
              <td v-for="it in influenceItems" :key="it" class="sub-cell">
                <input
                  class="sub-input infl"
                  type="number"
                  min="1"
                  max="5"
                  step="1"
                  :value="subsFor(e).influence[it]"
                  @change="onSubChange(e, 'influence', it, $event)"
                />
              </td>
              <td class="actions">
                <button class="btn btn-ai btn-sm" type="button" :disabled="runningId === e.id" @click="autoScoreOne(e)">
                  {{ runningId === e.id ? '识别中' : '重置为自动评分' }}
                </button>
                <button class="btn btn-secondary btn-sm" type="button" @click="openEdit(e)">编辑</button>
              </td>
            </tr>
            <tr v-if="filteredExperts.length === 0">
              <td colspan="9" class="empty">暂无专家</td>
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
      <div v-else>
        <div v-for="e in lowExperts" :key="e.id" class="warn-item">
          <div class="warn-main">
            <div>
              <strong>{{ e.name }}</strong>
              <span class="warn-score">综合评分：{{ num(e.scores?.overall) }}</span>
              <span class="warn-sub">专业度：{{ num(e.scores?.professional) }} / 影响力：{{ num(e.scores?.influence) }}</span>
            </div>
            <div class="warn-actions">
              <button class="btn btn-sm btn-ai" type="button" @click="autoScoreOne(e)">重新识别评分</button>
              <button class="btn btn-sm btn-ok" type="button" @click="adjustToThreshold(e)">调整至 3.5★</button>
              <button class="btn btn-sm btn-warn" type="button" @click="moveToObservation(e)">移入观察库</button>
            </div>
          </div>
          <div class="warn-reasons">
            <span class="reason-label">原因：</span>
            <span>{{ lowReasons(e).join('；') }}</span>
          </div>
        </div>
        <div class="warn-footer">
          <span>共 {{ lowExperts.length }} 位专家综合评分低于 3★，已自动同步至观察库，可前往查看和处理。</span>
          <button class="doc-link" type="button" @click="goObservation">前往观察库 →</button>
        </div>
      </div>
    </div>

    <!-- 编辑评分弹窗 -->
    <div v-if="editing" class="modal-mask" @click.self="closeEdit">
      <form class="modal-card" @submit.prevent="saveScores">
        <h3>编辑评分 - {{ editing.name }}</h3>
        <p class="hint">此处仅用于快速修正汇总分；推荐优先编辑表格中的 5 个评分项。</p>
        <label>专业度（1-5★）<input v-model.number="scores.professional" type="number" min="1" max="5" step="0.1" /></label>
        <label>影响力（1-5★）<input v-model.number="scores.influence" type="number" min="1" max="5" step="0.1" /></label>
        <label>综合评分（1-5★）<input v-model.number="scores.overall" type="number" min="1" max="5" step="0.1" /></label>
        <div class="modal-actions">
          <button class="btn primary" type="submit">保存</button>
          <button class="btn" type="button" @click="closeEdit">取消</button>
        </div>
      </form>
    </div>

    <ScoringHelpModal v-if="showRuleDoc" @close="showRuleDoc = false" />
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import ScoringHelpModal from '@/components/ScoringHelpModal.vue'
import { expertApi } from '@/api/expert'
import { settingApi } from '@/api/setting'
import { useAppStore } from '@/store/appStore'
import { autoScoreExpert } from '@/utils/scoring'
import type { Expert, Scores, SubScores } from '@/types'

const store = useAppStore()
const searchQuery = ref('')
const runningId = ref<number | null>(null)
const aiEnabled = ref(true)
const batchRunning = ref(false)
const batchMessage = ref('')
const batchSuccess = ref(true)
const showRuleDoc = ref(false)

const professionalItems = ['学历与学术背景', '行业资质与认证', '专业成果与经验'] as const
const influenceItems = ['社会荣誉与奖项', '职称/管理履历与行业地位'] as const

type RatingDim = 'professional' | 'influence'
type FiveItemScores = { professional: Record<string, number>; influence: Record<string, number> }

type AutoScorePayload = { scores: Scores; subScores: FiveItemScores }

function round1(v: number) {
  return Math.round(v * 10) / 10
}

function clampInput(v: number): number {
  if (!Number.isFinite(v)) return 2
  return Math.min(5, Math.max(1, Math.round(v)))
}

function clampScore(v: number): number {
  if (!Number.isFinite(v)) return 2
  return Math.min(5, Math.max(1, round1(v)))
}

function avg(values: number[]) {
  return values.length ? values.reduce((s, n) => s + n, 0) / values.length : 2
}

function buildAutoScores(e: Expert): AutoScorePayload {
  const result = autoScoreExpert(e, store.yiliProjects)
  const titleScore = result.influenceItems['职称与专业头衔'] ?? 2
  const managementScore = result.influenceItems['管理履历与行业地位'] ?? 2
  const subScores: FiveItemScores = {
    professional: {
      学历与学术背景: clampInput(result.professionalItems['学历与学术背景'] ?? 2),
      行业资质与认证: clampInput(result.professionalItems['行业资质与认证'] ?? 2),
      专业成果与经验: clampInput(result.professionalItems['专业成果与经验'] ?? 2),
    },
    influence: {
      社会荣誉与奖项: clampInput(result.influenceItems['社会荣誉与奖项'] ?? 2),
      '职称/管理履历与行业地位': clampInput(avg([titleScore, managementScore])),
    },
  }
  return { scores: computeFromSubs(subScores.professional, subScores.influence), subScores }
}

const expertBreakdowns = computed(() => {
  const map = new Map<number, FiveItemScores>()
  store.experts.forEach(e => {
    const auto = buildAutoScores(e).subScores as FiveItemScores
    const existingProf = e.subScores?.professional || {}
    const existingInfl = e.subScores?.influence || {}
    const combinedInfluence = existingInfl['职称/管理履历与行业地位']
      ?? (existingInfl['职称与专业头衔'] != null || existingInfl['管理履历与行业地位'] != null
        ? avg([Number(existingInfl['职称与专业头衔'] ?? 2), Number(existingInfl['管理履历与行业地位'] ?? 2)])
        : undefined)
    map.set(e.id, {
      professional: {
        学历与学术背景: clampInput(Number(existingProf['学历与学术背景'] ?? auto.professional['学历与学术背景'])),
        行业资质与认证: clampInput(Number(existingProf['行业资质与认证'] ?? auto.professional['行业资质与认证'])),
        专业成果与经验: clampInput(Number(existingProf['专业成果与经验'] ?? auto.professional['专业成果与经验'])),
      },
      influence: {
        社会荣誉与奖项: clampInput(Number(existingInfl['社会荣誉与奖项'] ?? auto.influence['社会荣誉与奖项'])),
        '职称/管理履历与行业地位': clampInput(Number(combinedInfluence ?? auto.influence['职称/管理履历与行业地位'])),
      },
    })
  })
  return map
})

function subsFor(e: Expert): FiveItemScores {
  return expertBreakdowns.value.get(e.id) || (buildAutoScores(e).subScores as FiveItemScores)
}

function computeFromSubs(profMap: Record<string, number>, inflMap: Record<string, number>): Scores {
  const professional = clampScore(avg(professionalItems.map(it => Number(profMap[it] ?? 2))))
  const influence = clampScore(avg(influenceItems.map(it => Number(inflMap[it] ?? 2))))
  const overall = clampScore(professional * 0.6 + influence * 0.4)
  return { professional, influence, overall }
}

async function onSubChange(e: Expert, dim: RatingDim, item: string, ev: Event) {
  const v = clampInput(parseFloat((ev.target as HTMLInputElement).value))
  const cur = subsFor(e)
  const profMap = { ...cur.professional }
  const inflMap = { ...cur.influence }
  if (dim === 'professional') profMap[item] = v
  else inflMap[item] = v
  const updated = await expertApi.update(e.id, {
    scores: computeFromSubs(profMap, inflMap),
    subScores: { professional: profMap, influence: inflMap },
  })
  syncExpert(updated)
}

function onToggleShow(e: Event) {
  store.setShowScores((e.target as HTMLInputElement).checked)
}

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

async function autoScoreOne(e: Expert) {
  runningId.value = e.id
  try {
    const auto = buildAutoScores(e)
    const updated = await expertApi.update(e.id, auto)
    syncExpert(updated)
  } finally {
    runningId.value = null
  }
}

async function runBatchScoring() {
  batchRunning.value = true
  batchMessage.value = ''
  try {
    let count = 0
    for (const e of store.experts.filter(item => item.status !== 'eliminated')) {
      const auto = buildAutoScores(e)
      const updated = await expertApi.update(e.id, auto)
      syncExpert(updated)
      count += 1
    }
    batchSuccess.value = true
    batchMessage.value = `已完成 ${count} 位专家的自动评分更新`
  } catch (err: any) {
    batchSuccess.value = false
    batchMessage.value = '批量评分失败：' + (err?.message || String(err))
  } finally {
    batchRunning.value = false
  }
}

const filteredExperts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return store.experts
    .filter(e => e.status !== 'eliminated')
    .filter(e => !q || e.name.toLowerCase().includes(q))
})

function num(v: number | null | undefined): string {
  return v == null ? '-' : `${v.toFixed(1)}★`
}

const WARN_THRESHOLD = 3
const ADJUST_THRESHOLD = 3.5
const lowExperts = computed(() =>
  store.experts.filter(e => e.status !== 'eliminated' && (e.scores?.overall ?? 0) < WARN_THRESHOLD)
)

function lowReasons(e: Expert): string[] {
  const reasons: string[] = []
  const subs = subsFor(e)
  professionalItems.forEach(it => {
    if ((subs.professional[it] ?? 2) < 3) reasons.push(`${it}偏低`)
  })
  influenceItems.forEach(it => {
    if ((subs.influence[it] ?? 2) < 3) reasons.push(`${it}偏低`)
  })
  if (!reasons.length) reasons.push('综合评分低于 3★，建议补充材料后重新识别评分')
  return reasons
}

async function adjustToThreshold(e: Expert) {
  const updated = await expertApi.update(e.id, {
    scores: {
      ...(e.scores || {}),
      professional: Math.max(e.scores?.professional ?? 0, ADJUST_THRESHOLD),
      influence: Math.max(e.scores?.influence ?? 0, ADJUST_THRESHOLD),
      overall: ADJUST_THRESHOLD,
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

function goObservation() {
  store.setAdminTab('observation')
}

function syncExpert(updated: Expert) {
  const idx = store.experts.findIndex(x => x.id === updated.id)
  if (idx >= 0) store.experts[idx] = updated
}

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

.toggle-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; font-size: 13px; }
.checkbox-toggle input { width: 16px; height: 16px; cursor: pointer; }
.toggle-state { font-size: 12px; color: var(--text-secondary); font-weight: 600; }
.inline-check { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; }
.inline-check input { width: 15px; height: 15px; }
.hint { font-size: 12px; color: var(--text-muted); margin: 8px 0 0; }
.inline-hint { margin: 0; }
.adjust-hint { margin-bottom: 12px; }

.doc-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #eff6ff;
}
.doc-title { color: #1d4ed8; font-size: 13px; font-weight: 700; margin-bottom: 2px; }
.doc-name { color: #334155; font-size: 13px; }
.doc-link { border: none; background: transparent; color: #2563eb; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }

.rule-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
.rule-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 720px; }
.rule-table th, .rule-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
.rule-table th { background: var(--surface); color: var(--text-secondary); font-size: 12px; font-weight: 600; }
.rule-table tr:last-child td { border-bottom: none; }
.rule-table .dimension { width: 90px; font-weight: 700; text-align: center; vertical-align: middle; }
.prof-row { background: #eff6ff; }
.prof-row .dimension { color: #1d4ed8; }
.infl-row { background: #fffbeb; }
.infl-row .dimension { color: #b45309; }
.missing-tip { margin: 10px 0 12px; padding: 8px 10px; border-radius: 6px; background: #f8fafc; color: #64748b; font-size: 12px; }
.auto-row { margin-top: 4px; }

.quick-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
.search-input { width: 100%; max-width: 280px; padding: 8px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; }
.search-input:focus { outline: none; border-color: var(--primary); }
.batch-message { margin: 6px 0 10px; font-size: 12px; color: #059669; }
.batch-message.error { color: #dc2626; }
.table-scroll-wrapper { overflow: auto; max-height: 45vh; border: 1px solid var(--border); border-radius: var(--radius-sm); }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 1060px; }
.data-table th, .data-table td { padding: 8px 10px; text-align: center; border-bottom: 1px solid var(--border); white-space: nowrap; }
.data-table th { background: var(--surface); font-weight: 600; color: var(--text-secondary); font-size: 12px; }
.data-table tr:hover { background: #f8fafc; }
.sub-head.prof { color: #1d4ed8; }
.sub-head.infl { color: #b45309; }
.cell-name { font-weight: 600; text-align: left; }
.score-cell { font-weight: 700; }
.prof-score { color: #3B82F6; }
.infl-score { color: #F59E0B; }
.sub-cell { padding: 4px 6px; }
.sub-input { width: 52px; padding: 3px 4px; border: 1px solid #bfdbfe; border-radius: 4px; font-size: 12px; text-align: center; }
.sub-input:focus { outline: none; border-color: var(--primary); }
.sub-input.infl { border-color: #fde68a; }
.actions { display: flex; gap: 6px; justify-content: center; }
.btn { padding: 6px 12px; border: 1px solid var(--border); border-radius: 4px; background: #fff; cursor: pointer; font-size: 13px; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.btn-secondary { background: var(--bg); color: var(--text-secondary); }
.btn-ai { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.empty { text-align: center; color: #888; padding: 24px; }

.warn-zone { border-color: #fde68a; background: #fffbeb; }
.warn-zone h4 { color: #b45309; }
.ok-box { padding: 16px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0; }
.ok-title { font-size: 14px; font-weight: 600; color: #059669; }
.warn-item { background: #fff; padding: 14px; border-radius: 8px; margin-bottom: 8px; border: 1px solid #fde68a; }
.warn-main { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.warn-score { margin-left: 10px; color: #dc2626; font-weight: 700; font-size: 12px; }
.warn-sub { display: inline-block; margin-left: 10px; color: var(--text-secondary); font-size: 12px; }
.warn-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.btn-ok { background: #059669; color: #fff; border-color: #059669; }
.btn-warn { background: #d97706; color: #fff; border-color: #d97706; }
.warn-reasons { margin-top: 8px; padding: 10px; background: #fffbeb; border-radius: 6px; font-size: 12px; color: #92400e; }
.reason-label { font-weight: 700; }
.warn-footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 12px; padding-top: 10px; border-top: 1px solid #fde68a; color: #92400e; font-size: 12px; }

.modal-mask { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; background: rgb(0 0 0 / 35%); }
.modal-card { width: min(420px, 92vw); padding: 20px; border-radius: 8px; background: #fff; }
.modal-card h3 { margin-top: 0; }
.modal-card label { display: block; margin: 10px 0; font-size: 13px; font-weight: 600; }
.modal-card input { width: 100%; box-sizing: border-box; margin-top: 4px; padding: 8px; border: 1px solid var(--border); border-radius: 6px; }
.modal-actions { margin-top: 16px; text-align: right; }
</style>
