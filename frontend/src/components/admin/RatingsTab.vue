<template>
  <section class="admin-tab ratings-tab">
    <div class="tab-header"><h3>评分管理</h3></div>

    <!-- ① 前端展示控制 -->
    <div class="config-card">
      <h4>① 前端展示控制</h4>
      <div class="toggle-row">
        <span>在前端展示评分信息（专家卡片 &amp; 详情页）：</span>
        <label class="checkbox-toggle">
          <input type="checkbox" :checked="store.showScores" @change="onToggleShow($event)" />
        </label>
        <span class="toggle-state">{{ store.showScores ? '展示中' : '已隐藏' }}</span>
      </div>
      <p class="hint">关闭后，专家卡片和详情页将不再显示任何评分数字及评分项信息，仅管理员在后台可见评分。</p>
    </div>

    <!-- ② 评分配置（规则及文档） -->
    <div class="config-card">
      <h4>② 评分配置（规则及文档）</h4>

      <div class="doc-embed">
        <div class="doc-embed-head">
          <div>
            <div class="doc-embed-title">评分规则与测算文档（10分制 · 主管理员口径）</div>
            <div class="doc-embed-sub">综合分 = 专业度×0.6 + 影响力×0.4；信息缺失统一 5.0；综合 &lt;7 不展示。</div>
          </div>
          <button class="doc-link" type="button" @click="showRuleDoc = true">查看完整文档 →</button>
        </div>

        <div class="rule-detail-wrap">
          <table class="rule-detail-table">
            <thead>
              <tr><th>一级维度</th><th>权重</th><th>子维度</th><th>子权重</th><th>评分主锚（档位要点）</th><th>缺失默认</th></tr>
            </thead>
            <tbody>
              <tr class="prof-row">
                <td class="dimension" :rowspan="3">专业度</td>
                <td class="weight" :rowspan="3">0.6</td>
                <td>学历与学术背景</td><td>0.35</td>
                <td>学历层次 × 院校实力(T0–T4) 矩阵：博士×顶尖 9.5 … 专科 3.0–4.0</td><td class="miss">5.0</td>
              </tr>
              <tr class="prof-row">
                <td>行业资质与认证</td><td>0.30</td>
                <td>认证层级：A0 国际权威 9.0 / A1 国家级 8.0 / A2 厂商 6.0 / A3 通用 4.0</td><td class="miss">5.0</td>
              </tr>
              <tr class="prof-row">
                <td>专业成果与经验</td><td>0.35</td>
                <td>学术/企业路径取高：顶刊·战略级 9.0 / 省级 8.0 / 参与 6.0 / 一般服务 4.0</td><td class="miss">5.0</td>
              </tr>
              <tr class="infl-row">
                <td class="dimension" :rowspan="2">影响力</td>
                <td class="weight" :rowspan="2">0.4</td>
                <td>社会荣誉与奖项</td><td>0.35</td>
                <td>行政级别：国家级 9.0 / 省部级 7.5 / 地市 6.0 / 县级 4.0</td><td class="miss">5.0</td>
              </tr>
              <tr class="infl-row">
                <td>职称·管理履历·行业地位</td><td>0.65</td>
                <td>职级(J0–J3) × 机构(C0–C2) 矩阵：J0×C0 = 9.5，基层 4.5–5.5</td><td class="miss">5.0</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="calc-wrap">
          <div class="calc-title">关键测算结果（权重 60/40 + 缺失 5.0）</div>
          <table class="calc-table">
            <thead><tr><th>专家类型</th><th>综合分</th><th>展示</th></tr></thead>
            <tbody>
              <tr><td>顶尖学者（清北博士+院士）</td><td>9.2</td><td class="show">展示</td></tr>
              <tr><td>行业高管（985硕士+世界500强CEO）</td><td>8.5</td><td class="show">展示</td></tr>
              <tr><td>普通高校讲师（博士+副教授）</td><td>6.8</td><td class="hide">不展示</td></tr>
              <tr><td>低学历实务专家（专科+多年经验）</td><td>5.3</td><td class="hide">不展示</td></tr>
              <tr><td>缺1项+其余强</td><td>8.3</td><td class="show">展示</td></tr>
              <tr><td>缺2项+其余中上</td><td>6.4</td><td class="hide">不展示</td></tr>
              <tr><td>全平庸（均6.5）</td><td>6.5</td><td class="hide">不展示</td></tr>
              <tr><td>1缺失+全平庸</td><td>6.2</td><td class="hide">不展示</td></tr>
              <tr><td>强者带2缺失</td><td>7.6</td><td class="show">展示</td></tr>
            </tbody>
          </table>
        </div>

        <p class="doc-note">说明：上述为 10 分制管理口径（主管理员汇报/对外说明用）。本系统前端实际以 5★ 制展示，缺失项默认 2★，综合 &lt;3★ 不展示；点「查看完整文档」可见全部矩阵与测算明细。</p>
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
      <h4>③ 专家评分调整</h4>
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
      <h4>④ 评分预警区</h4>
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

    <ScoringRulesDocModal v-if="showRuleDoc" @close="showRuleDoc = false" />
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import ScoringRulesDocModal from '@/components/admin/ScoringRulesDocModal.vue'
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

.doc-embed {
  border: 1px solid #dbeafe;
  border-radius: 10px;
  background: #f8fbff;
  padding: 14px 16px;
  margin-bottom: 12px;
}
.doc-embed-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}
.doc-embed-title { font-size: 14px; font-weight: 700; color: #1d4ed8; }
.doc-embed-sub { font-size: 12px; color: var(--text-secondary); margin-top: 4px; line-height: 1.5; }
.doc-link { border: none; background: transparent; color: #2563eb; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; flex-shrink: 0; }

.rule-detail-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 12px; }
.rule-detail-table { width: 100%; border-collapse: collapse; font-size: 12.5px; min-width: 760px; }
.rule-detail-table th, .rule-detail-table td { padding: 9px 10px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
.rule-detail-table th { background: var(--surface); color: var(--text-secondary); font-weight: 600; white-space: nowrap; }
.rule-detail-table tr:last-child td { border-bottom: none; }
.rule-detail-table .dimension { width: 72px; font-weight: 700; text-align: center; vertical-align: middle; }
.rule-detail-table .weight { width: 52px; text-align: center; font-weight: 700; }
.rule-detail-table .miss { text-align: center; color: var(--text-muted); font-weight: 600; white-space: nowrap; }
.rule-detail-table .prof-row { background: #eff6ff; }
.rule-detail-table .prof-row .dimension { color: #1e40af; background: #dbeafe; }
.rule-detail-table .infl-row { background: #fffbeb; }
.rule-detail-table .infl-row .dimension { color: #b45309; background: #fef3c7; }

.calc-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 10px; }
.calc-title { padding: 8px 10px; font-size: 12px; font-weight: 700; color: var(--text); background: var(--bg); border-bottom: 1px solid var(--border); }
.calc-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.calc-table th, .calc-table td { padding: 8px 10px; border-bottom: 1px solid var(--border); text-align: left; }
.calc-table th { color: var(--text-secondary); font-weight: 600; }
.calc-table tr:last-child td { border-bottom: none; }
.calc-table .show { color: #059669; font-weight: 600; }
.calc-table .hide { color: #dc2626; font-weight: 600; }

.doc-note { margin: 0 0 12px; font-size: 12px; color: var(--text-muted); line-height: 1.6; }
.missing-tip { margin: 10px 0 12px; padding: 8px 10px; border-radius: 6px; background: #f8fafc; color: #64748b; font-size: 12px; }
.auto-row { margin-top: 4px; }

.quick-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
.search-input { width: 100%; max-width: 280px; padding: 8px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; }
.search-input:focus { outline: none; border-color: var(--primary); }
.batch-message { margin: 6px 0 10px; font-size: 12px; color: #059669; }
.batch-message.error { color: #dc2626; }
.table-scroll-wrapper { overflow: auto; max-height: 45vh; border: 1px solid var(--border); border-radius: var(--radius-sm); }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 1060px; }
.data-table th, .data-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; }
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
.warn-zone h4 { color: #dc2626; }
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
