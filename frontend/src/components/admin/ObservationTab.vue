<template>
  <section class="admin-tab observation-tab">
    <div class="tab-header">
      <h3>观察库</h3>
      <span class="count-badge">{{ obsExperts.length }} 位</span>
    </div>
    <p class="tab-desc">
      综合评分 3.5★ 以下或不适合在前端展示的专家自动归入此处。可在此持续评估、淘汰、延期或调分。
      评分变化由系统自动同步进出（低于 3.5★ 进入，调高至 3.5★ 以上自动退出）。
    </p>

    <div v-if="obsExperts.length === 0" class="empty-box">观察库为空</div>

    <div
      v-for="expert in obsExperts"
      :key="expert.id"
      class="obs-card"
      :class="{ eliminated: expert.status === 'eliminated', extended: expert.observationStatus === 'extended' }"
    >
      <div class="obs-head">
        <div class="obs-title">
          <strong>{{ expert.name }}</strong>
          <span class="obs-score">综合：{{ expert.scores?.overall != null ? expert.scores.overall.toFixed(1) : '-' }}★</span>
          <span class="status-tag" :class="statusClass(expert)">{{ statusText(expert) }}</span>
        </div>
        <div class="obs-actions">
          <select
            class="status-select"
            :value="displayStatus(expert)"
            @change="onStatusSelect(expert, ($event.target as HTMLSelectElement).value)"
          >
            <option value="evaluating">持续评估</option>
            <option value="eliminated">淘汰</option>
          </select>
          <button class="btn btn-sm btn-extend" type="button" @click="openExtend(expert)">延期</button>
          <button class="btn btn-sm btn-adjust" type="button" @click="openScoreModal(expert)">调整评分</button>
          <button class="btn btn-danger btn-sm" type="button" @click="remove(expert)">删除</button>
        </div>
      </div>

      <div class="obs-meta">
        专业度：{{ expert.scores?.professional != null ? expert.scores.professional.toFixed(1) : '-' }}★
        ｜ 影响力：{{ expert.scores?.influence != null ? expert.scores.influence.toFixed(1) : '-' }}★
        <span v-if="expert.observationDate">｜ 录入/延期日期：{{ formatDate(expert.observationDate) }}</span>
      </div>

      <div v-if="isOverOneYear(expert)" class="year-warning">
        ⏰ 该专家已淘汰超过一年，建议确认是否永久删除。
      </div>

      <!-- 操作记录 -->
      <div class="log-block">
        <button class="log-toggle" type="button" @click="toggleLogs(expert.id)">
          {{ logsOpen.has(expert.id) ? '▾' : '▸' }} 操作记录（{{ visibleLogs(expert).length }}）
          <span v-if="!isMaster" class="log-scope">仅显示本人操作</span>
        </button>
        <div v-if="logsOpen.has(expert.id)" class="log-list">
          <div v-if="visibleLogs(expert).length === 0" class="log-empty">暂无操作记录</div>
          <div v-for="log in visibleLogs(expert)" :key="log.id" class="log-item">
            <div class="log-line1">
              <span class="log-op" :class="'op-' + log.operation">{{ log.operation }}</span>
              <span class="log-operator">{{ log.operatorName }}（{{ roleText(log.operatorRole) }}）</span>
              <span class="log-time">{{ formatDateTime(log.createdAt) }}</span>
            </div>
            <div v-if="log.note" class="log-note">意见：{{ log.note }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 调整评分弹窗 -->
    <div v-if="scoreModal.open" class="modal-mask" @click.self="closeScoreModal">
      <div class="modal">
        <h4 class="modal-title">调整评分 · {{ scoreModal.expert?.name }}</h4>
        <p class="modal-hint">直接修改 5 个评分项（1-5★），专业度/影响力/综合分自动计算。完成后需填写操作意见。</p>
        <table class="score-edit-table">
          <tbody>
            <tr v-for="it in professionalItems" :key="it">
              <td class="se-label prof">{{ it }}</td>
              <td class="se-input">
                <input type="number" min="1" max="5" step="1" v-model.number="scoreModal.prof[it]" />
              </td>
            </tr>
            <tr v-for="it in influenceItems" :key="it">
              <td class="se-label infl">{{ it }}</td>
              <td class="se-input">
                <input type="number" min="1" max="5" step="1" v-model.number="scoreModal.infl[it]" />
              </td>
            </tr>
          </tbody>
        </table>
        <div class="score-preview">
          专业度 <b>{{ scorePreview.professional.toFixed(1) }}</b>★ ｜
          影响力 <b>{{ scorePreview.influence.toFixed(1) }}</b>★ ｜
          综合 <b>{{ scorePreview.overall.toFixed(1) }}</b>★
          <span class="score-flow">{{ scorePreview.overall >= 3.5 ? '（调高后将退出观察库）' : '（仍保留在观察库）' }}</span>
        </div>
        <label class="opinion-label">操作意见（必填）</label>
        <textarea
          v-model="scoreModal.opinion"
          class="opinion-input"
          rows="3"
          placeholder="请填写本次调分依据，意见可简写但不能为空"
        ></textarea>
        <p v-if="scoreModal.err" class="modal-err">{{ scoreModal.err }}</p>
        <div class="modal-actions">
          <button class="btn" type="button" @click="closeScoreModal">取消</button>
          <button class="btn btn-primary" type="button" @click="confirmScoreModal">确认提交</button>
        </div>
      </div>
    </div>

    <!-- 操作意见弹窗（淘汰 / 延期） -->
    <div v-if="opinionModal.open" class="modal-mask" @click.self="closeOpinionModal">
      <div class="modal">
        <h4 class="modal-title">{{ opinionModal.action === 'eliminated' ? '确认淘汰' : '确认延期观察' }} · {{ opinionModal.expert?.name }}</h4>
        <p class="modal-hint">
          {{ opinionModal.action === 'eliminated'
            ? '淘汰后该专家将从前端移除，且操作不可逆转。'
            : '延期将重置观察期计时，继续留在观察库。' }}
          请填写操作意见（必填）。
        </p>
        <label class="opinion-label">操作意见（必填）</label>
        <textarea
          v-model="opinionModal.opinion"
          class="opinion-input"
          rows="3"
          :placeholder="opinionModal.action === 'eliminated' ? '请说明淘汰原因' : '请说明延期原因'"
        ></textarea>
        <p v-if="opinionModal.err" class="modal-err">{{ opinionModal.err }}</p>
        <div class="modal-actions">
          <button class="btn" type="button" @click="closeOpinionModal">取消</button>
          <button
            class="btn"
            :class="opinionModal.action === 'eliminated' ? 'btn-danger' : 'btn-extend'"
            type="button"
            @click="confirmOpinionModal"
          >确认提交</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { expertApi } from '@/api/expert'
import { observationApi } from '@/api/observation'
import { useAppStore } from '@/store/appStore'
import { autoScoreExpert } from '@/utils/scoring'
import type { Expert } from '@/types'

const store = useAppStore()

const professionalItems = ['学历与学术背景', '行业资质与认证', '专业成果与经验'] as const
const influenceItems = ['社会荣誉与奖项', '职称/管理履历与行业地位'] as const

type FiveMap = Record<string, number>

function clampInput(v: number): number {
  if (!Number.isFinite(v)) return 2
  return Math.min(5, Math.max(1, Math.round(v)))
}
function avg(vals: number[]) {
  return vals.length ? vals.reduce((s, n) => s + n, 0) / vals.length : 2
}
function clampScore(v: number): number {
  if (!Number.isFinite(v)) return 2
  return Math.min(5, Math.max(1, Math.round(v * 10) / 10))
}
function computeFromSubs(profMap: FiveMap, inflMap: FiveMap) {
  const professional = clampScore(avg(professionalItems.map(it => Number(profMap[it] ?? 2))))
  const influence = clampScore(avg(influenceItems.map(it => Number(inflMap[it] ?? 2))))
  const overall = clampScore(professional * 0.6 + influence * 0.4)
  return { professional, influence, overall }
}
function statusForOverall(overall: number | null, e: Expert): string {
  if (e.status === 'eliminated') return 'eliminated'
  return overall != null && overall >= 3.5 ? 'active' : 'observation'
}

// ===== 观察库列表 =====
const obsExperts = computed(() =>
  store.experts
    .filter(e => e.status === 'observation' || e.status === 'eliminated' || e.observationStatus)
    .sort((a, b) => {
      if (a.status === 'eliminated' && b.status !== 'eliminated') return 1
      if (a.status !== 'eliminated' && b.status === 'eliminated') return -1
      return new Date(b.observationDate || 0).getTime() - new Date(a.observationDate || 0).getTime()
    })
)

function displayStatus(e: Expert): string {
  if (e.status === 'eliminated') return 'eliminated'
  return e.observationStatus || 'evaluating'
}
function statusText(e: Expert): string {
  if (e.status === 'eliminated') return '已淘汰'
  if (e.observationStatus === 'extended') return '延期观察'
  return '持续评估'
}
function statusClass(e: Expert): string {
  if (e.status === 'eliminated') return 'tag-eliminated'
  if (e.observationStatus === 'extended') return 'tag-extended'
  return 'tag-evaluating'
}
function formatDate(value: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  return isNaN(d.getTime()) ? value : d.toLocaleDateString('zh-CN')
}
function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return d.toLocaleString('zh-CN', { hour12: false })
}
function isOverOneYear(expert: Expert): boolean {
  if (expert.status !== 'eliminated' || !expert.observationDate) return false
  const date = new Date(expert.observationDate)
  if (isNaN(date.getTime())) return false
  const oneYear = new Date(date)
  oneYear.setFullYear(oneYear.getFullYear() + 1)
  return new Date() >= oneYear
}

// ===== 操作记录 =====
interface OpLog {
  id?: number
  expertId?: number
  expertName?: string
  operation?: string
  operatorId?: string
  operatorName?: string
  operatorRole?: string
  beforeState?: string
  afterState?: string
  note?: string
  tags?: string[]
  createdAt?: string
}

const logsMap = ref<Map<number, OpLog[]>>(new Map())
const logError = ref('')
const logsOpen = reactive(new Set<number>())

const isMaster = computed(() => store.isMaster)
const isSubAdmin = computed(() => store.isSubAdmin)
const currentUserId = computed(() => (store.currentUser ? String(store.currentUser.id) : ''))

async function loadLogs() {
  try {
    const all = (await observationApi.findByExpertId()) as OpLog[]
    const map = new Map<number, OpLog[]>()
    all.forEach(l => {
      const id = l.expertId
      if (id == null) return
      if (!map.has(id)) map.set(id, [])
      map.get(id)!.push(l)
    })
    logsMap.value = map
    logError.value = ''
  } catch (e: any) {
    logError.value = '操作记录加载失败：' + (e?.message || String(e))
  }
}

function visibleLogs(expert: Expert): OpLog[] {
  const list = logsMap.value.get(expert.id) || []
  if (isMaster.value) return list
  // 子管理员仅可见本人操作
  if (isSubAdmin.value) return list.filter(l => l.operatorId === currentUserId.value)
  return []
}
function roleText(role?: string) {
  if (role === 'master') return '主管理员'
  if (role === 'sub') return '子管理员'
  return role || '未知'
}
function toggleLogs(id: number) {
  if (logsOpen.has(id)) logsOpen.delete(id)
  else logsOpen.add(id)
}

// ===== 状态选择 =====
async function onStatusSelect(expert: Expert, val: string) {
  if (val === 'evaluating') {
    await applyEvaluating(expert)
  } else if (val === 'eliminated') {
    opinionModal.expert = expert
    opinionModal.action = 'eliminated'
    opinionModal.opinion = ''
    opinionModal.err = ''
    opinionModal.open = true
  }
}

async function applyEvaluating(expert: Expert) {
  const updated = await expertApi.update(expert.id, {
    status: 'observation',
    observationStatus: 'evaluating',
    observationDate: expert.observationDate || new Date().toISOString(),
  })
  syncExpert(updated)
  store.recordObservationOperation({
    expertId: expert.id,
    expertName: expert.name,
    operation: '持续评估',
    before: { status: expert.status, observationStatus: expert.observationStatus },
    after: { status: 'observation', observationStatus: 'evaluating' },
    note: '恢复/继续观察评估',
    tags: ['evaluating'],
  })
}

// ===== 延期 =====
function openExtend(expert: Expert) {
  opinionModal.expert = expert
  opinionModal.action = 'extended'
  opinionModal.opinion = ''
  opinionModal.err = ''
  opinionModal.open = true
}

// ===== 调整评分弹窗 =====
const scoreModal = reactive({
  open: false,
  expert: null as Expert | null,
  prof: {} as FiveMap,
  infl: {} as FiveMap,
  opinion: '',
  err: '',
})

const scorePreview = computed(() => {
  if (!scoreModal.expert) return { professional: 0, influence: 0, overall: 0 }
  return computeFromSubs(scoreModal.prof, scoreModal.infl)
})

function openScoreModal(expert: Expert) {
  const auto = autoScoreExpert(expert, store.yiliProjects)
  const prof: FiveMap = {}
  const infl: FiveMap = {}
  professionalItems.forEach(it => {
    const v = expert.subScores?.professional?.[it]
    prof[it] = clampInput(Number(v ?? auto.professionalItems[it] ?? 2))
  })
  influenceItems.forEach(it => {
    const v = expert.subScores?.influence?.[it]
    infl[it] = clampInput(Number(v ?? auto.influenceItems[it] ?? 2))
  })
  scoreModal.expert = expert
  scoreModal.prof = prof
  scoreModal.infl = infl
  scoreModal.opinion = ''
  scoreModal.err = ''
  scoreModal.open = true
}
function closeScoreModal() {
  scoreModal.open = false
  scoreModal.expert = null
  scoreModal.opinion = ''
  scoreModal.err = ''
}

async function confirmScoreModal() {
  const expert = scoreModal.expert
  if (!expert) return
  if (!scoreModal.opinion.trim()) {
    scoreModal.err = '操作意见不能为空'
    return
  }
  const scores = computeFromSubs(scoreModal.prof, scoreModal.infl)
  const status = statusForOverall(scores.overall, expert)
  const wasObserving = expert.status === 'observation' || !!expert.observationStatus
  const payload: any = {
    scores,
    subScores: { professional: { ...scoreModal.prof }, influence: { ...scoreModal.infl } },
  }
  if (expert.status !== 'eliminated') {
    payload.status = status
    if (status === 'observation') {
      payload.observationStatus = wasObserving ? (expert.observationStatus || 'evaluating') : 'evaluating'
      if (!wasObserving) payload.observationDate = new Date().toISOString()
    } else {
      // 调高至合格分：退出观察库
      payload.observationStatus = null
    }
  }
  const updated = await expertApi.update(expert.id, payload)
  syncExpert(updated)
  store.recordObservationOperation({
    expertId: expert.id,
    expertName: expert.name,
    operation: '调整评分',
    before: {
      scores: expert.scores,
      status: expert.status,
      observationStatus: expert.observationStatus,
    },
    after: { scores, status, observationStatus: payload.observationStatus || expert.observationStatus },
    note: scoreModal.opinion.trim(),
    tags: ['score'],
  })
  closeScoreModal()
}

// ===== 操作意见弹窗（淘汰 / 延期） =====
const opinionModal = reactive({
  open: false,
  expert: null as Expert | null,
  action: 'eliminated' as 'eliminated' | 'extended',
  opinion: '',
  err: '',
})
function closeOpinionModal() {
  opinionModal.open = false
  opinionModal.expert = null
  opinionModal.opinion = ''
  opinionModal.err = ''
}
async function confirmOpinionModal() {
  const expert = opinionModal.expert
  if (!expert) return
  if (!opinionModal.opinion.trim()) {
    opinionModal.err = '操作意见不能为空'
    return
  }
  if (opinionModal.action === 'eliminated') {
    const updated = await expertApi.update(expert.id, {
      status: 'eliminated',
      observationStatus: 'eliminated',
      observationDate: new Date().toISOString(),
    })
    syncExpert(updated)
    store.recordObservationOperation({
      expertId: expert.id,
      expertName: expert.name,
      operation: '淘汰',
      before: { status: expert.status, observationStatus: expert.observationStatus },
      after: { status: 'eliminated', observationStatus: 'eliminated' },
      note: opinionModal.opinion.trim(),
      tags: ['eliminated'],
    })
  } else {
    const updated = await expertApi.update(expert.id, {
      status: 'observation',
      observationStatus: 'extended',
      observationDate: new Date().toISOString(),
    })
    syncExpert(updated)
    store.recordObservationOperation({
      expertId: expert.id,
      expertName: expert.name,
      operation: '延期观察',
      before: { status: expert.status, observationStatus: expert.observationStatus },
      after: { status: 'observation', observationStatus: 'extended' },
      note: opinionModal.opinion.trim(),
      tags: ['extended'],
    })
  }
  closeOpinionModal()
}

// ===== 删除 =====
async function remove(expert: Expert) {
  if (!confirm(`确认永久删除 ${expert.name}？此操作不可恢复，且会记录操作日志。`)) return
  store.recordObservationOperation({
    expertId: expert.id,
    expertName: expert.name,
    operation: '删除',
    before: { status: expert.status, observationStatus: expert.observationStatus },
    after: { deleted: true },
    note: '永久删除专家',
    tags: ['delete'],
  })
  await expertApi.delete(expert.id)
  store.experts = store.experts.filter(e => e.id !== expert.id)
}

function syncExpert(updated: Expert) {
  const idx = store.experts.findIndex(e => e.id === updated.id)
  if (idx >= 0) store.experts[idx] = updated
}

onMounted(() => {
  loadLogs()
})
</script>

<style scoped>
.tab-header { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
.tab-header h3 { font-size: 18px; font-weight: 600; margin: 0; }
.count-badge { font-size: 12px; color: var(--text-secondary); background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 2px 8px; }
.tab-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.6; }

.empty-box {
  padding: 40px; text-align: center; color: var(--text-muted);
  background: var(--bg); border: 1px dashed var(--border); border-radius: var(--radius-sm); font-size: 14px;
}

.obs-card {
  background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 16px; margin-bottom: 12px;
}
.obs-card.eliminated { background: #fef2f2; border-color: #fecaca; }
.obs-card.extended { background: #eff6ff; border-color: #bfdbfe; }

.obs-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 8px; }
.obs-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.obs-title strong { font-size: 15px; }
.obs-score { font-size: 12px; color: var(--text-secondary); background: var(--surface); padding: 2px 8px; border-radius: 12px; border: 1px solid var(--border); }

.status-tag { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
.tag-evaluating { background: #fef3c7; color: #b45309; }
.tag-extended { background: #dbeafe; color: #1d4ed8; }
.tag-eliminated { background: #fee2e2; color: #dc2626; }

.obs-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.status-select { padding: 5px 8px; border: 1px solid var(--border); border-radius: 4px; font-size: 12px; background: #fff; }
.btn { padding: 5px 10px; border: 1px solid var(--border); border-radius: 4px; background: #fff; cursor: pointer; font-size: 12px; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.btn-primary { background: var(--primary); color: #fff; border-color: var(--primary); }
.btn-danger { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
.btn-extend { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.btn-adjust { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }

.obs-meta { font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }

.year-warning { margin-top: 8px; padding: 8px 12px; background: #fff1f2; border-radius: 6px; font-size: 12px; color: #be123c; }

.log-block { margin-top: 10px; border-top: 1px dashed var(--border); padding-top: 8px; }
.log-toggle { background: none; border: none; cursor: pointer; font-size: 12px; color: var(--text-secondary); font-weight: 600; padding: 2px 0; }
.log-scope { font-size: 11px; color: var(--text-muted); font-weight: 400; margin-left: 6px; }
.log-list { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
.log-empty { font-size: 12px; color: var(--text-muted); }
.log-item { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; }
.log-line1 { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 12px; }
.log-op { font-weight: 700; padding: 1px 7px; border-radius: 10px; background: #e5e7eb; color: #374151; }
.log-op.op-淘汰 { background: #fee2e2; color: #dc2626; }
.log-op.op-延期观察 { background: #dbeafe; color: #1d4ed8; }
.log-op.op-调整评分 { background: #dcfce7; color: #15803d; }
.log-op.op-移入观察库, .log-op.op-持续评估 { background: #fef3c7; color: #b45309; }
.log-op.op-删除 { background: #f3e8ff; color: #7c3aed; }
.log-operator { color: var(--text-secondary); }
.log-time { color: var(--text-muted); margin-left: auto; }
.log-note { font-size: 12px; color: var(--text); margin-top: 4px; background: #fff; border-radius: 4px; padding: 4px 8px; }

/* 弹窗 */
.modal-mask { position: fixed; inset: 0; background: rgba(15,23,42,0.45); display: flex; align-items: center; justify-content: center; z-index: 1300; padding: 16px; }
.modal { background: #fff; border-radius: 12px; padding: 20px; width: 100%; max-width: 460px; box-shadow: 0 20px 60px rgba(15,23,42,0.25); }
.modal-title { margin: 0 0 6px; font-size: 16px; }
.modal-hint { font-size: 12px; color: var(--text-muted); margin: 0 0 12px; line-height: 1.5; }
.score-edit-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
.score-edit-table td { padding: 5px 6px; border-bottom: 1px solid var(--border); font-size: 13px; }
.se-label.prof { color: #1d4ed8; }
.se-label.infl { color: #b45309; }
.se-input input { width: 64px; padding: 4px 6px; border: 1px solid var(--border); border-radius: 4px; text-align: center; }
.score-preview { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }
.score-preview b { color: var(--text); }
.score-flow { color: var(--text-muted); margin-left: 6px; }
.opinion-label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
.opinion-input { width: 100%; border: 1px solid var(--border); border-radius: 6px; padding: 8px; font-size: 13px; resize: vertical; box-sizing: border-box; }
.opinion-input:focus { outline: none; border-color: var(--primary); }
.modal-err { color: #dc2626; font-size: 12px; margin: 6px 0 0; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
</style>
