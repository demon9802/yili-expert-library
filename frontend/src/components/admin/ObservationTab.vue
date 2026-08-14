<template>
  <section class="admin-tab observation-tab">
    <div class="tab-header">
      <h3>观察库</h3>
    </div>
    <p class="tab-desc">
      综合评分 &lt; 3★ 的专家自动列入观察库，手动移入请至评分管理操作。观察库专家不在前端展示。观察期为移入观察库后 18 个月，期满未做调整的，将自动淘汰。操作分数调整，完成后点击“确认调分”并填写意见；确认不符合标准，点击“淘汰”并填写意见。观察期截止前，点击“延后观察”，可为该专家在当前观察截止日基础上往后顺延 6 个月。
    </p>

    <!-- 统计 -->
    <div class="obs-stats">
      <span class="stat-tag auto">低分自动入库（&lt;3★）：{{ autoCount }} 位</span>
      <span class="stat-tag manual">手动移入：{{ manualCount }} 位</span>
      <span class="stat-tag eliminated">已淘汰：{{ eliminatedCount }} 位</span>
    </div>

    <!-- 空状态 -->
    <div v-if="obsExperts.length === 0" class="empty-box">观察库为空</div>

    <!-- 专家卡片 -->
    <div
      v-for="expert in pagedObsExperts"
      :key="expert.id"
      class="obs-card"
      :class="{ eliminated: expert.status === 'eliminated' }"
    >
      <!-- 第一行：姓名 + 分数 + 操作 -->
      <div class="obs-head">
        <div class="obs-title">
          <strong class="name">{{ expert.name }}</strong>
          <span class="score-tag overall">综合 {{ overallText(expert) }}★</span>
          <span class="score-tag prof">专业 {{ profText(expert) }}★</span>
          <span class="score-tag infl">影响 {{ inflText(expert) }}★</span>
        </div>
        <div class="obs-actions">
          <button
            class="btn btn-extend"
            type="button"
            :disabled="expert.status === 'eliminated'"
            @click="openExtend(expert)"
          >延后观察</button>
          <button
            class="btn btn-danger"
            type="button"
            :disabled="expert.status === 'eliminated'"
            @click="openEliminate(expert)"
          >淘汰</button>
          <button class="btn btn-default" type="button" @click="remove(expert)">删除</button>
        </div>
      </div>

      <!-- 第二行：状态/日期 -->
      <div class="obs-meta">
        <span>{{ entryTypeText(expert) }}</span>
        <span class="dot">·</span>
        <span>{{ statusText(expert) }}</span>
        <span class="dot">·</span>
        <span>观察截止：{{ fmtDate(deadline(expert)) }}</span>
        <span class="dot">·</span>
        <span>已入库 {{ entryDaysText(expert) }} 天</span>
      </div>

      <!-- 第三行：低分原因 -->
      <div class="reason-box">
        <ul>
          <li v-for="r in reasonsFor(expert)" :key="r">{{ r }}</li>
        </ul>
      </div>

      <!-- 第四行：评分项调整 -->
      <div class="score-edit-section">
        <div class="edit-hint">评分项（可连续修改多项，完成后点“确认调分”并填写意见）</div>
        <div class="score-rows">
          <div class="score-group">
            <div class="score-group-title">专业度</div>
            <div v-for="it in professionalItems" :key="'p-' + it" class="score-row">
              <span class="row-label">{{ it }}</span>
              <div class="row-input">
                <input
                  type="number"
                  min="1"
                  max="5"
                  step="1"
                  :value="draftScores[expert.id]?.professional[it] ?? subScoreVal(expert, 'professional', it) ?? 2"
                  @change="onScoreChange(expert, 'professional', it, $event)"
                />
                <span class="unit">/ 5★</span>
              </div>
            </div>
          </div>
          <div class="score-group">
            <div class="score-group-title">影响力</div>
            <div v-for="it in influenceItems" :key="'i-' + it" class="score-row">
              <span class="row-label">{{ it }}</span>
              <div class="row-input">
                <input
                  type="number"
                  min="1"
                  max="5"
                  step="1"
                  :value="draftScores[expert.id]?.influence[it] ?? subScoreVal(expert, 'influence', it) ?? 2"
                  @change="onScoreChange(expert, 'influence', it, $event)"
                />
                <span class="unit">/ 5★</span>
              </div>
            </div>
          </div>
        </div>
        <div class="edit-actions">
          <button class="btn btn-primary" type="button" @click="openConfirmScore(expert)">确认调分</button>
          <button class="btn btn-default" type="button" @click="resetToAuto(expert)">重置为自动评分</button>
          <button
            class="btn btn-text"
            type="button"
            @click="toggleExpertLog(expert.id)"
          >
            {{ expertLogOpen.has(expert.id) ? '收起' : '历次调分记录' }}
          </button>
        </div>
      </div>

      <!-- 单人历次记录 -->
      <div v-if="expertLogOpen.has(expert.id)" class="expert-log">
        <div v-if="visibleLogs(expert).length === 0" class="log-empty">暂无操作记录</div>
        <table v-else class="log-table small">
          <thead>
            <tr>
              <th>时间</th>
              <th>类型</th>
              <th>综合分变化</th>
              <th>操作意见</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in visibleLogs(expert)" :key="log.id">
              <td>{{ formatDateTime(log.createdAt) }}</td>
              <td>{{ log.operation }}</td>
              <td>{{ scoreChangeText(log) }}</td>
              <td>{{ log.note || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 专家列表分页 -->
    <div v-if="obsExpertTotalPages > 1" class="log-pagination">
      <button class="page-btn" :disabled="obsExpertPage === 1" @click="obsExpertPage--">上一页</button>
      <span class="page-info">{{ obsExpertPage }} / {{ obsExpertTotalPages }}</span>
      <button class="page-btn" :disabled="obsExpertPage === obsExpertTotalPages" @click="obsExpertPage++">下一页</button>
    </div>

    <!-- 底部：观察库操作记录 -->
    <div v-if="allVisibleLogs.length > 0 || obsExperts.length > 0" class="global-log-section">
      <div class="global-log-head">
        <h4>观察库操作记录</h4>
        <span v-if="!isMaster" class="log-scope-tip">仅显示本人操作</span>
        <span v-else class="log-scope-tip">主管理员可见全部操作记录</span>
      </div>
      <table class="log-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>专家</th>
            <th>操作者</th>
            <th>类型</th>
            <th>综合分变化</th>
            <th>调整内容</th>
            <th>操作意见</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in pagedGlobalLogs" :key="log.id">
            <td>{{ formatDateTime(log.createdAt) }}</td>
            <td>{{ log.expertName }}</td>
            <td>{{ log.operatorName }}（{{ roleText(log.operatorRole) }}）</td>
            <td>
              <span class="log-type" :class="'type-' + typeClass(log.operation)">{{ log.operation }}</span>
            </td>
            <td>{{ scoreChangeText(log) }}</td>
            <td>{{ adjustContentText(log) }}</td>
            <td>{{ log.note || '-' }}</td>
          </tr>
          <tr v-if="pagedGlobalLogs.length === 0">
            <td colspan="7" class="empty-cell">暂无操作记录</td>
          </tr>
        </tbody>
      </table>
      <div v-if="globalLogTotalPages > 1" class="log-pagination">
        <button class="page-btn" :disabled="globalLogPage === 1" @click="globalLogPage--">上一页</button>
        <span class="page-info">{{ globalLogPage }} / {{ globalLogTotalPages }}</span>
        <button class="page-btn" :disabled="globalLogPage === globalLogTotalPages" @click="globalLogPage++">下一页</button>
      </div>
    </div>

    <!-- 调分确认弹窗（必填意见） -->
    <div v-if="confirmScoreModal.open" class="modal-mask" @click.self="closeConfirmScore">
      <div class="modal">
        <h4 class="modal-title">确认调分 · {{ confirmScoreModal.expert?.name }}</h4>
        <p class="modal-hint">本次调分将重新计算专业度、影响力与综合评分。请填写操作意见。</p>
        <div class="score-preview">
          专业度 <b>{{ confirmPreview.professional.toFixed(1) }}★</b>｜
          影响力 <b>{{ confirmPreview.influence.toFixed(1) }}★</b>｜
          综合 <b>{{ confirmPreview.overall.toFixed(1) }}★</b>
          <span class="flow-text">{{ confirmPreview.overall >= 3 ? '（将自动退出观察库）' : '（仍保留在观察库）' }}</span>
        </div>
        <label class="opinion-label">操作意见（必填）</label>
        <textarea v-model="confirmScoreModal.opinion" class="opinion-input" rows="3" placeholder="请填写调分依据"></textarea>
        <p v-if="confirmScoreModal.err" class="modal-err">{{ confirmScoreModal.err }}</p>
        <div class="modal-actions">
          <button class="btn btn-default" type="button" @click="closeConfirmScore">取消</button>
          <button class="btn btn-primary" type="button" @click="submitScoreAdjust">确认提交</button>
        </div>
      </div>
    </div>

    <!-- 淘汰/延期确认弹窗 -->
    <div v-if="opinionModal.open" class="modal-mask" @click.self="closeOpinionModal">
      <div class="modal">
        <h4 class="modal-title">
          {{ opinionModal.action === 'eliminated' ? '确认淘汰' : '确认延后观察' }} · {{ opinionModal.expert?.name }}
        </h4>
        <p class="modal-hint">
          {{ opinionModal.action === 'eliminated'
            ? '淘汰后该专家将从前端移除，且操作不可逆转。'
            : '延后观察将在当前观察截止日基础上顺延 6 个月。' }}
          请填写操作意见（必填）。
        </p>
        <label class="opinion-label">操作意见（必填）</label>
        <textarea v-model="opinionModal.opinion" class="opinion-input" rows="3" :placeholder="opinionModal.action === 'eliminated' ? '请说明淘汰原因' : '请说明延后原因'"></textarea>
        <p v-if="opinionModal.err" class="modal-err">{{ opinionModal.err }}</p>
        <div class="modal-actions">
          <button class="btn btn-default" type="button" @click="closeOpinionModal">取消</button>
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
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { expertApi } from '@/api/expert'
import { observationApi } from '@/api/observation'
import { useAppStore } from '@/store/appStore'
import { autoScoreExpert, OBSERVATION_THRESHOLD } from '@/utils/scoring'
import {
  formatDateYMD,
  formatDateTime as fmtDateTime,
  addMonthsToDateYMD,
  daysBetweenDates,
  computeObservationDeadline,
} from '@/utils/helpers'
import type { Expert } from '@/types'

const store = useAppStore()

const professionalItems = ['学历与学术背景', '行业资质与认证', '专业成果与经验'] as const
const influenceItems = ['社会荣誉与奖项', '职称/管理履历与行业地位'] as const
const allItems = [...professionalItems, ...influenceItems]

type FiveMap = Record<string, number>

function clampInput(v: number): number {
  if (!Number.isFinite(v)) return 2
  return Math.min(5, Math.max(1, Math.round(v)))
}
function clampScore(v: number): number {
  if (!Number.isFinite(v)) return 2
  return Math.min(5, Math.max(1, Math.round(v * 10) / 10))
}
function computeFromSubs(profMap: FiveMap, inflMap: FiveMap) {
  const profWeights: Record<string, number> = {
    学历与学术背景: 0.35,
    行业资质与认证: 0.30,
    专业成果与经验: 0.35,
  }
  const inflWeights: Record<string, number> = {
    社会荣誉与奖项: 0.35,
    '职称/管理履历与行业地位': 0.65,
  }
  const professional = clampScore(
    professionalItems.reduce((s, it) => s + Number(profMap[it] ?? 2) * profWeights[it], 0)
  )
  const influence = clampScore(
    influenceItems.reduce((s, it) => s + Number(inflMap[it] ?? 2) * inflWeights[it], 0)
  )
  const overall = clampScore(professional * 0.6 + influence * 0.4)
  return { professional, influence, overall }
}
function statusForOverall(overall: number | null, e: Expert): string {
  if (e.status === 'eliminated') return 'eliminated'
  return overall != null && overall >= OBSERVATION_THRESHOLD ? 'active' : 'observation'
}

const today = formatDateYMD(new Date())
function overallText(e: Expert): string {
  return e.scores?.overall != null ? e.scores.overall.toFixed(1) : '-'
}
function profText(e: Expert): string {
  return e.scores?.professional != null ? e.scores.professional.toFixed(1) : '-'
}
function inflText(e: Expert): string {
  return e.scores?.influence != null ? e.scores.influence.toFixed(1) : '-'
}
function fmtDate(value: string | null | undefined): string {
  return value ? String(value) : '-'
}
function deadline(e: Expert): string {
  return computeObservationDeadline(e.observationDate, e.scores)
}
function entryDaysText(e: Expert): string {
  const d = daysBetweenDates(e.observationDate, today)
  return d == null ? '-' : String(d)
}
function subScoreVal(expert: Expert, dim: 'professional' | 'influence', item: string): number | null {
  const m = expert.subScores?.[dim] as Record<string, number> | undefined
  if (m && typeof m === 'object' && item in m) return m[item]
  return null
}

// 列表
const obsExperts = computed(() =>
  store.experts
    .filter(e => e.status === 'observation' || e.status === 'eliminated' || e.observationStatus)
    .sort((a, b) => {
      if (a.status === 'eliminated' && b.status !== 'eliminated') return 1
      if (a.status !== 'eliminated' && b.status === 'eliminated') return -1
      return new Date(b.observationDate || 0).getTime() - new Date(a.observationDate || 0).getTime()
    })
)

const autoCount = computed(() => obsExperts.value.filter(e => e.status === 'observation' && !e.observationStatus?.startsWith('manual')).length)
const manualCount = computed(() => obsExperts.value.filter(e => e.observationStatus?.startsWith('manual')).length)
const eliminatedCount = computed(() => obsExperts.value.filter(e => e.status === 'eliminated').length)

function entryTypeText(e: Expert): string {
  if (e.status === 'eliminated') return '已淘汰'
  if (e.observationStatus?.startsWith('manual')) return '手动入库'
  return '自动入库'
}
function statusText(e: Expert): string {
  if (e.status === 'eliminated') return '已淘汰'
  if (e.observationStatus === 'extended') return '延后观察'
  return '观察中'
}
function reasonsFor(e: Expert): string[] {
  const reasons: string[] = []
  const profItems = e.subScores?.professional || {}
  const inflItems = e.subScores?.influence || {}
  const profLow = professionalItems.filter(it => Number(profItems[it] ?? 2) < 3)
  const inflLow = influenceItems.filter(it => Number(inflItems[it] ?? 2) < 3)
  if (profLow.length) reasons.push(`专业度偏低：${profLow.join('、')} 分偏低`)
  if (inflLow.length) reasons.push(`影响力偏低：${inflLow.join('、')} 分偏低`)
  if (!reasons.length) reasons.push('评分项均在达标线以上，建议复核是否保留在观察库')
  return reasons
}

// 草稿分数（每个专家独立的内联编辑）
const draftScores = reactive<Record<number, { professional: FiveMap; influence: FiveMap }>>({})

function ensureDraft(e: Expert) {
  if (draftScores[e.id]) return
  const auto = autoScoreExpert(e, store.yiliProjects)
  const prof: FiveMap = {}
  const infl: FiveMap = {}
  professionalItems.forEach(it => {
    prof[it] = clampInput(Number(e.subScores?.professional?.[it] ?? auto.professionalItems[it] ?? 2))
  })
  influenceItems.forEach(it => {
    infl[it] = clampInput(Number(e.subScores?.influence?.[it] ?? auto.influenceItems[it] ?? 2))
  })
  draftScores[e.id] = { professional: prof, influence: infl }
}

function onScoreChange(e: Expert, dim: 'professional' | 'influence', item: string, ev: Event) {
  ensureDraft(e)
  const v = clampInput(parseFloat((ev.target as HTMLInputElement).value))
  draftScores[e.id][dim][item] = v
}

// 内联调分确认
const confirmScoreModal = reactive({
  open: false,
  expert: null as Expert | null,
  opinion: '',
  err: '',
})
const confirmPreview = computed(() => {
  if (!confirmScoreModal.expert) return { professional: 0, influence: 0, overall: 0 }
  const d = draftScores[confirmScoreModal.expert.id]
  if (!d) return { professional: 0, influence: 0, overall: 0 }
  return computeFromSubs(d.professional, d.influence)
})
function openConfirmScore(e: Expert) {
  ensureDraft(e)
  confirmScoreModal.expert = e
  confirmScoreModal.opinion = ''
  confirmScoreModal.err = ''
  confirmScoreModal.open = true
}
function closeConfirmScore() {
  confirmScoreModal.open = false
  confirmScoreModal.expert = null
  confirmScoreModal.opinion = ''
  confirmScoreModal.err = ''
}
async function submitScoreAdjust() {
  const expert = confirmScoreModal.expert
  if (!expert) return
  if (!confirmScoreModal.opinion.trim()) {
    confirmScoreModal.err = '操作意见不能为空'
    return
  }
  const d = draftScores[expert.id]
  if (!d) {
    closeConfirmScore()
    return
  }
  const scores = computeFromSubs(d.professional, d.influence)
  const status = statusForOverall(scores.overall, expert)
  const wasObserving = expert.status === 'observation' || !!expert.observationStatus
  const payload: any = {
    scores: {
      professional: scores.professional,
      influence: scores.influence,
      overall: scores.overall,
      observationDeadline:
        expert.scores?.observationDeadline || computeObservationDeadline(expert.observationDate, expert.scores),
    },
    subScores: { professional: { ...d.professional }, influence: { ...d.influence } },
  }
  if (expert.status !== 'eliminated') {
    payload.status = status
    if (status === 'observation') {
      payload.observationStatus = wasObserving ? (expert.observationStatus || 'evaluating') : 'evaluating'
      if (!wasObserving) payload.observationDate = formatDateYMD(new Date())
    } else {
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
    note: confirmScoreModal.opinion.trim(),
    tags: ['score'],
  })
  closeConfirmScore()
  await loadLogs()
}

async function resetToAuto(e: Expert) {
  if (!confirm(`确认将「${e.name}」的 5 个评分项重置为系统自动评分？`)) return
  const auto = autoScoreExpert(e, store.yiliProjects)
  const prof: FiveMap = {}
  const infl: FiveMap = {}
  professionalItems.forEach(it => {
    prof[it] = clampInput(Number(auto.professionalItems[it] ?? 2))
  })
  influenceItems.forEach(it => {
    infl[it] = clampInput(Number(auto.influenceItems[it] ?? 2))
  })
  draftScores[e.id] = { professional: prof, influence: infl }
  const scores = computeFromSubs(prof, infl)
  const status = statusForOverall(scores.overall, e)
  const payload: any = {
    scores: {
      professional: scores.professional,
      influence: scores.influence,
      overall: scores.overall,
      observationDeadline: e.scores?.observationDeadline || computeObservationDeadline(e.observationDate, e.scores),
    },
    subScores: { professional: prof, influence: infl },
  }
  if (e.status !== 'eliminated') {
    payload.status = status
    payload.observationStatus = status === 'observation' ? (e.observationStatus || 'evaluating') : null
  }
  const updated = await expertApi.update(e.id, payload)
  syncExpert(updated)
  store.recordObservationOperation({
    expertId: e.id,
    expertName: e.name,
    operation: '重置为自动评分',
    before: { scores: e.scores, subScores: e.subScores },
    after: { scores, subScores: payload.subScores },
    note: '从观察库重置为自动评分',
    tags: ['score', 'auto'],
  })
  await loadLogs()
}

// 操作记录
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
const expertLogOpen = reactive(new Set<number>())
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
  } catch (e: any) {
    console.warn('加载观察库操作记录失败', e)
  }
}

function visibleLogs(expert: Expert): OpLog[] {
  const list = logsMap.value.get(expert.id) || []
  if (isMaster.value) return list
  if (isSubAdmin.value) return list.filter(l => l.operatorId === currentUserId.value)
  return []
}
function allVisibleLogsForExpertIds(ids: number[]): OpLog[] {
  const result: OpLog[] = []
  ids.forEach(id => {
    const list = logsMap.value.get(id) || []
    const visible = isMaster.value
      ? list
      : list.filter(l => l.operatorId === currentUserId.value)
    result.push(...visible)
  })
  return result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
}
const allVisibleLogs = computed(() => allVisibleLogsForExpertIds(obsExperts.value.map(e => e.id)))

const obsExpertPage = ref(1)
const obsExpertPageSize = 5
const pagedObsExperts = computed(() => {
  const start = (obsExpertPage.value - 1) * obsExpertPageSize
  return obsExperts.value.slice(start, start + obsExpertPageSize)
})
const obsExpertTotalPages = computed(() => Math.max(1, Math.ceil(obsExperts.value.length / obsExpertPageSize)))
watch(obsExperts, () => { obsExpertPage.value = 1 })

const globalLogPage = ref(1)
const globalLogPageSize = 5
const pagedGlobalLogs = computed(() => {
  const start = (globalLogPage.value - 1) * globalLogPageSize
  return allVisibleLogs.value.slice(start, start + globalLogPageSize)
})
const globalLogTotalPages = computed(() => Math.max(1, Math.ceil(allVisibleLogs.value.length / globalLogPageSize)))
watch(allVisibleLogs, () => { globalLogPage.value = 1 })

function toggleExpertLog(id: number) {
  if (expertLogOpen.has(id)) expertLogOpen.delete(id)
  else expertLogOpen.add(id)
}
function formatDateTime(value: string | null | undefined) {
  return fmtDateTime(value as any)
}
function roleText(role?: string) {
  if (role === 'master') return '主管理员'
  if (role === 'sub') return '子管理员'
  return role || '未知'
}
function typeClass(op?: string): string {
  if (op?.includes('淘汰')) return 'eliminated'
  if (op?.includes('延期') || op?.includes('延后')) return 'extended'
  if (op?.includes('评分')) return 'score'
  if (op?.includes('删除')) return 'delete'
  return 'other'
}
function scoreChangeText(log: OpLog): string {
  try {
    const before = JSON.parse(log.beforeState || '{}')
    const after = JSON.parse(log.afterState || '{}')
    const b = before.scores?.overall
    const a = after.scores?.overall
    if (b == null || a == null) return '-'
    return `${Number(b).toFixed(1)} → ${Number(a).toFixed(1)}`
  } catch {
    return '-'
  }
}
function adjustContentText(log: OpLog): string {
  try {
    const after = JSON.parse(log.afterState || '{}')
    if (after.status === 'eliminated') return '淘汰'
    if (log.operation?.includes('延期') || log.operation?.includes('延后')) return '延后观察'
    if (log.operation?.includes('自动')) return '覆盖人工调分'
    if (log.operation?.includes('调分')) return '覆盖人工调分'
    return log.operation || '-'
  } catch {
    return log.operation || '-'
  }
}

// 淘汰 / 延后弹窗
const opinionModal = reactive({
  open: false,
  expert: null as Expert | null,
  action: 'eliminated' as 'eliminated' | 'extended',
  opinion: '',
  err: '',
})
function openEliminate(e: Expert) {
  opinionModal.expert = e
  opinionModal.action = 'eliminated'
  opinionModal.opinion = ''
  opinionModal.err = ''
  opinionModal.open = true
}
function openExtend(e: Expert) {
  opinionModal.expert = e
  opinionModal.action = 'extended'
  opinionModal.opinion = ''
  opinionModal.err = ''
  opinionModal.open = true
}
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
      observationDate: formatDateYMD(new Date()),
      scores: { ...(expert.scores || {}) },
      subScores: expert.subScores,
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
    const currentDeadline = computeObservationDeadline(expert.observationDate, expert.scores)
    const newDeadline = addMonthsToDateYMD(currentDeadline, 6)
    const entry = expert.observationDate ? formatDateYMD(expert.observationDate) : formatDateYMD(new Date())
    const updated = await expertApi.update(expert.id, {
      status: 'observation',
      observationStatus: 'extended',
      observationDate: entry,
      scores: { ...(expert.scores || {}), observationDeadline: newDeadline },
      subScores: expert.subScores,
    })
    syncExpert(updated)
    store.recordObservationOperation({
      expertId: expert.id,
      expertName: expert.name,
      operation: '延后观察',
      before: { status: expert.status, observationStatus: expert.observationStatus, deadline: currentDeadline },
      after: { status: 'observation', observationStatus: 'extended', deadline: newDeadline },
      note: opinionModal.opinion.trim(),
      tags: ['extended'],
    })
  }
  closeOpinionModal()
  await loadLogs()
}

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
  await loadLogs()
}

function syncExpert(updated: Expert) {
  const idx = store.experts.findIndex(e => e.id === updated.id)
  if (idx >= 0) store.experts[idx] = updated
}

watch(obsExperts, () => {
  // 专家列表变化时，确保草稿存在
  obsExperts.value.forEach(e => ensureDraft(e))
})

onMounted(() => {
  obsExperts.value.forEach(e => ensureDraft(e))
  loadLogs()
})
</script>

<style scoped>
.tab-header { margin-bottom: 4px; }
.tab-header h3 { font-size: 18px; font-weight: 600; margin: 0; }
.tab-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.7; }

.obs-stats { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
.stat-tag { font-size: 12px; padding: 5px 12px; border-radius: 16px; border: 1px solid var(--border); background: var(--surface); }
.stat-tag.auto { color: #b45309; background: #fef3c7; border-color: #fde68a; }
.stat-tag.manual { color: #1d4ed8; background: #eff6ff; border-color: #bfdbfe; }
.stat-tag.eliminated { color: #991b1b; background: #fef2f2; border-color: #fecaca; }

.empty-box { padding: 40px; text-align: center; color: var(--text-muted); background: var(--bg); border: 1px dashed var(--border); border-radius: var(--radius-sm); font-size: 14px; }

.obs-card { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 16px; margin-bottom: 14px; }
.obs-card.eliminated { background: #fef2f2; border-color: #fecaca; }

.obs-head { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 10px; }
.obs-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.obs-title .name { font-size: 15px; color: var(--text); }
.score-tag { font-size: 12px; padding: 2px 8px; border-radius: 10px; font-weight: 500; }
.score-tag.overall { background: #fee2e2; color: #991b1b; }
.score-tag.prof { background: #eff6ff; color: #1e40af; }
.score-tag.infl { background: #fef3c7; color: #b45309; }

.obs-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.btn { padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; line-height: 1.4; border: 1px solid var(--border); background: #fff; color: var(--text); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--primary); color: #fff; border-color: var(--primary); }
.btn-danger { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
.btn-extend { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.btn-default { background: #fff; color: var(--text-secondary); }
.btn-text { background: transparent; border: none; color: var(--primary); padding: 5px 8px; }

.obs-meta { font-size: 12px; color: var(--text-secondary); margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.obs-meta .dot { color: var(--text-muted); margin: 0 4px; }

.reason-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; }
.reason-box ul { margin: 0; padding-left: 16px; color: #92400e; font-size: 13px; line-height: 1.8; }
.reason-box li { list-style: disc; }

.score-edit-section { margin-bottom: 8px; }
.edit-hint { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; }
.score-rows { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-bottom: 12px; }
.score-group { display: flex; flex-direction: column; gap: 8px; }
.score-group-title { font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 2px; padding-bottom: 4px; border-bottom: 1px dashed var(--border); }
.score-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.row-label { font-size: 13px; color: var(--text); }
.row-input { display: flex; align-items: center; gap: 6px; }
.row-input input { width: 56px; padding: 4px 6px; border: 1px solid var(--border); border-radius: 4px; text-align: center; font-size: 13px; }
.row-input input:focus { outline: none; border-color: var(--primary); }
.unit { font-size: 12px; color: var(--text-muted); }

.edit-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

.expert-log { margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--border); }

/* 底部操作记录 */
.global-log-section { margin-top: 24px; }
.global-log-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.global-log-head h4 { margin: 0; font-size: 15px; color: var(--text); }
.log-scope-tip { font-size: 12px; color: var(--text-muted); margin-left: auto; }

.log-table { width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
.log-table th, .log-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; }
.log-table th { background: var(--surface); font-weight: 600; color: var(--text-secondary); }
.log-table tr:last-child td { border-bottom: none; }
.log-table.small { font-size: 12px; }
.log-table .empty-cell { text-align: center; color: var(--text-muted); padding: 20px; }
.log-type { display: inline-block; padding: 1px 6px; border-radius: 10px; font-size: 11px; }
.log-type.type-eliminated { background: #fee2e2; color: #991b1b; }
.log-type.type-extended { background: #dbeafe; color: #1d4ed8; }
.log-type.type-score { background: #dcfce7; color: #15803d; }
.log-type.type-delete { background: #f3e8ff; color: #7c3aed; }
.log-type.type-other { background: #f1f5f9; color: #475569; }
.log-empty { font-size: 12px; color: var(--text-muted); padding: 8px 0; }

.log-pagination { display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 8px; }
.page-btn { padding: 4px 10px; border: 1px solid var(--border); background: #fff; border-radius: 4px; cursor: pointer; font-size: 12px; color: var(--text-secondary); }
.page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.page-info { font-size: 12px; color: var(--text-secondary); }

/* 弹窗 */
.modal-mask { position: fixed; inset: 0; background: rgba(15,23,42,0.45); display: flex; align-items: center; justify-content: center; z-index: 1300; padding: 16px; }
.modal { background: #fff; border-radius: 12px; padding: 20px; width: 100%; max-width: 460px; box-shadow: 0 20px 60px rgba(15,23,42,0.25); }
.modal-title { margin: 0 0 6px; font-size: 16px; }
.modal-hint { font-size: 12px; color: var(--text-muted); margin: 0 0 12px; line-height: 1.5; }
.score-preview { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }
.score-preview b { color: var(--text); }
.flow-text { color: var(--text-muted); margin-left: 6px; }
.opinion-label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
.opinion-input { width: 100%; border: 1px solid var(--border); border-radius: 6px; padding: 8px; font-size: 13px; resize: vertical; box-sizing: border-box; }
.opinion-input:focus { outline: none; border-color: var(--primary); }
.modal-err { color: #dc2626; font-size: 12px; margin: 6px 0 0; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }

@media (max-width: 640px) {
  .obs-head { flex-direction: column; }
  .score-rows { grid-template-columns: 1fr; }
  .log-table th, .log-table td { padding: 6px 8px; }
}
</style>
