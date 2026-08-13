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
            <div class="doc-embed-title">评分规则·五星制完整文档（v5.9.3）</div>
            <div class="doc-embed-sub">覆盖专业度、影响力 2 个维度，共 5 个评分项，含计算公式、赋分标准与测试案例。</div>
          </div>
          <button class="doc-link" type="button" @click="showRuleDoc = true">查看完整文档 →</button>
        </div>

        <div class="rule-detail-wrap">
          <table class="rule-detail-table">
            <thead>
              <tr><th>维度</th><th>评分项</th><th>评分项构成</th></tr>
            </thead>
            <tbody>
              <tr class="prof-row">
                <td class="dimension" rowspan="3">专业度</td>
                <td>① 学历与学术背景</td>
                <td rowspan="3">共 3 项评分</td>
              </tr>
              <tr class="prof-row">
                <td>② 行业资质与认证</td>
              </tr>
              <tr class="prof-row">
                <td>③ 专业成果与经验</td>
              </tr>
              <tr class="infl-row">
                <td class="dimension" rowspan="2">影响力</td>
                <td>④ 社会荣誉与奖项</td>
                <td rowspan="2">共 2 项评分</td>
              </tr>
              <tr class="infl-row">
                <td>⑤ 职称、管理履历与行业地位</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="rule-detail-wrap">
          <table class="rule-detail-table matrix">
            <thead>
              <tr>
                <th>评分项</th>
                <th>1★</th>
                <th>2★</th>
                <th>3★</th>
                <th>4★</th>
                <th>5★</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="item-name">① 学历与学术背景</td>
                <td>大专 / 中专及以下</td>
                <td>普通本科（一般院校）</td>
                <td>较好本科（211 / 双一流）或普通硕士（授课型 / 一般院校）</td>
                <td>名校硕士（985 / 双一流 / 海外知名）或普通博士</td>
                <td>博士 + 顶尖院校（清北 / C9 / QS 前 50 等）</td>
              </tr>
              <tr>
                <td class="item-name">② 行业资质与认证</td>
                <td>无相关认证</td>
                <td>培训 / 通用认证</td>
                <td>行业厂商认证（华为 / 微软等）或国家级执业资格（单一）</td>
                <td>国家级执业 / 行业权威认证（多重领域）</td>
                <td>国际权威认证（CFA / CPA / ACCA 等）或多项国家级</td>
              </tr>
              <tr>
                <td class="item-name">③ 专业成果与经验</td>
                <td>一般服务经验 / 仅公开演讲</td>
                <td>参与级项目 / 普通论文</td>
                <td>省级 / 行业级项目 · SCI/EI 论文</td>
                <td>战略级 / 国家级项目 · 顶刊论文</td>
                <td>标杆级（牵头国标行标 / 高被引 / 重大成果转化）</td>
              </tr>
              <tr>
                <td class="item-name">④ 社会荣誉与奖项</td>
                <td>无荣誉 / 一般协会成员</td>
                <td>地市级荣誉 / 国家级学会成员</td>
                <td>省部级荣誉或称号</td>
                <td>国家级荣誉或称号</td>
                <td>顶尖人才（两院院士 / 国家级人才计划）</td>
              </tr>
              <tr>
                <td class="item-name">⑤ 职称、管理履历与行业地位</td>
                <td>无职称 / 基层岗位</td>
                <td>经理 / 高工 / 主管（普通企业）</td>
                <td>副教授 / 总监 / VP / 合伙人（或同级别 · 普通企业）</td>
                <td>教授 / CEO / 创始人（行业百强 / 大厂）</td>
                <td>教授 / CEO / 创始人（世界 500 强 / 央企 / 上市公司）</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="missing-tip">信息缺失（未填 / 未公开 / 无法核实）的评分项，默认按 2★ 计。</p>

        <div class="calc-wrap">
          <div class="calc-title">关键测算结果</div>
          <table class="calc-table">
            <thead><tr><th>情形</th><th>①</th><th>②</th><th>③</th><th>④</th><th>⑤</th><th>综合得分</th><th>是否进观察库</th></tr></thead>
            <tbody>
              <tr><td>全部缺失（默认 2★）</td><td>2</td><td>2</td><td>2</td><td>2</td><td>2</td><td>2.0</td><td class="hide">是</td></tr>
              <tr><td>1 项信息缺失，其余中等</td><td>2</td><td>3</td><td>3</td><td>3</td><td>3</td><td>2.8</td><td class="hide">是</td></tr>
              <tr><td>2 项信息缺失，其余中等</td><td>2</td><td>2</td><td>3</td><td>3</td><td>3</td><td>2.6</td><td class="hide">是</td></tr>
              <tr><td>中等水平（各项 3★）</td><td>3</td><td>3</td><td>3</td><td>3</td><td>3</td><td>3.0</td><td class="show">否（达标线）</td></tr>
              <tr><td>良好水平（各项 4★）</td><td>4</td><td>4</td><td>4</td><td>4</td><td>4</td><td>4.0</td><td class="show">否</td></tr>
              <tr><td>专业度强、影响力弱</td><td>5</td><td>5</td><td>5</td><td>2</td><td>2</td><td>3.8</td><td class="show">否</td></tr>
              <tr><td>专业度弱、影响力强</td><td>2</td><td>2</td><td>2</td><td>5</td><td>5</td><td>3.2</td><td class="show">否</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="toggle-row auto-row">
        <label class="inline-check">
          <input type="checkbox" :checked="aiEnabled" @change="onAiToggle($event)" />
          <span>启用自动评分</span>
        </label>
        <span class="hint inline-hint">系统根据专家学历、资历、履历等信息自动生成评分项分值。</span>
      </div>
    </div>

    <!-- ③ 专家评分调整 -->
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
                <div class="action-dropdown" v-click-outside="() => closeDropdown(e.id)">
                  <button
                    class="btn btn-sm btn-action"
                    type="button"
                    @click="toggleDropdown(e.id)"
                  >
                    操作 ▼
                  </button>
                  <div v-if="openDropdownId === e.id" class="action-menu">
                    <button type="button" :disabled="runningId === e.id" @click="autoScoreOne(e)">
                      {{ runningId === e.id ? '识别中...' : '重置为自动评分' }}
                    </button>
                    <button type="button" @click="moveToObservation(e)">移入观察库</button>
                    <button v-if="hasCloudBackup" type="button" @click="restoreFromCloud(e)">从云端恢复</button>
                  </div>
                </div>
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
        <div class="warn-banner">
          <span class="warn-icon">⚠</span>
          <span>共 {{ lowExperts.length }} 位专家综合评分低于 3★，已自动同步至观察库，可前往查看和处理。</span>
          <button class="doc-link" type="button" @click="goObservation">前往观察库 →</button>
        </div>
      </div>
    </div>

    <ScoringRulesDocModal v-if="showRuleDoc" @close="showRuleDoc = false" />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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
const openDropdownId = ref<number | null>(null)
const hasCloudBackup = ref(false)

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
  const subScores: FiveItemScores = {
    professional: {
      学历与学术背景: clampInput(result.professionalItems['学历与学术背景'] ?? 2),
      行业资质与认证: clampInput(result.professionalItems['行业资质与认证'] ?? 2),
      专业成果与经验: clampInput(result.professionalItems['专业成果与经验'] ?? 2),
    },
    influence: {
      社会荣誉与奖项: clampInput(result.influenceItems['社会荣誉与奖项'] ?? 2),
      '职称/管理履历与行业地位': clampInput(result.influenceItems['职称/管理履历与行业地位'] ?? 2),
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
    map.set(e.id, {
      professional: {
        学历与学术背景: clampInput(Number(existingProf['学历与学术背景'] ?? auto.professional['学历与学术背景'])),
        行业资质与认证: clampInput(Number(existingProf['行业资质与认证'] ?? auto.professional['行业资质与认证'])),
        专业成果与经验: clampInput(Number(existingProf['专业成果与经验'] ?? auto.professional['专业成果与经验'])),
      },
      influence: {
        社会荣誉与奖项: clampInput(Number(existingInfl['社会荣誉与奖项'] ?? auto.influence['社会荣誉与奖项'])),
        '职称/管理履历与行业地位': clampInput(Number(existingInfl['职称/管理履历与行业地位'] ?? auto.influence['职称/管理履历与行业地位'])),
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
    openDropdownId.value = null
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

function toggleDropdown(id: number) {
  openDropdownId.value = openDropdownId.value === id ? null : id
}
function closeDropdown(id: number) {
  if (openDropdownId.value === id) openDropdownId.value = null
}

async function restoreFromCloud(e: Expert) {
  // 占位：迁移后无本地缓存差异时无需实现，保留接口以兼容 V5 交互习惯
  alert('当前系统未启用云端恢复功能')
  openDropdownId.value = null
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
const lowExperts = computed(() =>
  store.experts.filter(e => e.status !== 'eliminated' && (e.scores?.overall ?? 0) < WARN_THRESHOLD)
)

async function moveToObservation(e: Expert) {
  const updated = await expertApi.update(e.id, {
    status: 'observation',
    observationStatus: 'evaluating',
    observationDate: new Date().toISOString(),
  })
  syncExpert(updated)
  openDropdownId.value = null
}

function goObservation() {
  store.setAdminTab('observation')
}

function syncExpert(updated: Expert) {
  const idx = store.experts.findIndex(x => x.id === updated.id)
  if (idx >= 0) store.experts[idx] = updated
}

// 简单的 click-outside 指令（本组件内用）
const vClickOutside = {
  mounted(el: HTMLElement, binding: any) {
    (el as any).__clickOutside = (event: Event) => {
      if (!el.contains(event.target as Node)) binding.value()
    }
    document.addEventListener('click', (el as any).__clickOutside)
  },
  unmounted(el: HTMLElement) {
    document.removeEventListener('click', (el as any).__clickOutside)
  },
}
</script>

<style scoped>
.tab-header { margin-bottom: 4px; }
.tab-header h3 { font-size: 18px; font-weight: 600; margin: 0; }

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
.rule-detail-table { width: 100%; border-collapse: collapse; font-size: 12.5px; min-width: 600px; }
.rule-detail-table th, .rule-detail-table td { padding: 9px 10px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
.rule-detail-table th { background: var(--surface); color: var(--text-secondary); font-weight: 600; white-space: nowrap; }
.rule-detail-table tr:last-child td { border-bottom: none; }
.rule-detail-table .dimension { width: 72px; font-weight: 700; text-align: center; vertical-align: middle; }
.rule-detail-table .prof-row { background: #eff6ff; }
.rule-detail-table .prof-row .dimension { color: #1e40af; background: #dbeafe; }
.rule-detail-table .infl-row { background: #fffbeb; }
.rule-detail-table .infl-row .dimension { color: #b45309; background: #fef3c7; }
.rule-detail-table .item-name { font-weight: 600; white-space: nowrap; }
.rule-detail-table.matrix { min-width: 900px; }
.rule-detail-table.matrix td { font-size: 12px; line-height: 1.45; }

.calc-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 10px; }
.calc-title { padding: 8px 10px; font-size: 12px; font-weight: 700; color: var(--text); background: var(--bg); border-bottom: 1px solid var(--border); }
.calc-table { width: 100%; border-collapse: collapse; font-size: 12.5px; min-width: 600px; }
.calc-table th, .calc-table td { padding: 8px 10px; border-bottom: 1px solid var(--border); text-align: center; }
.calc-table th { color: var(--text-secondary); font-weight: 600; }
.calc-table td:first-child { text-align: left; }
.calc-table tr:last-child td { border-bottom: none; }
.calc-table .show { color: #059669; font-weight: 600; }
.calc-table .hide { color: #dc2626; font-weight: 600; }

.missing-tip { margin: 0 0 12px; padding: 8px 10px; border-radius: 6px; background: #fefce8; color: #854d0e; font-size: 12px; }
.auto-row { margin-top: 4px; }

.quick-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
.search-input { width: 100%; max-width: 280px; padding: 8px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; }
.search-input:focus { outline: none; border-color: var(--primary); }
.batch-message { margin: 6px 0 10px; font-size: 12px; color: #059669; }
.batch-message.error { color: #dc2626; }
.table-scroll-wrapper { overflow: auto; max-height: 45vh; border: 1px solid var(--border); border-radius: var(--radius-sm); }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 900px; }
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
.actions { position: relative; }

.action-dropdown { position: relative; display: inline-block; }
.btn-action { padding: 5px 10px; font-size: 12px; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; }
.action-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 100;
  min-width: 130px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15,23,42,0.12);
  overflow: hidden;
}
.action-menu button {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: #fff;
  text-align: left;
  font-size: 12px;
  color: var(--text);
  cursor: pointer;
}
.action-menu button:hover { background: #f8fafc; }
.action-menu button:disabled { color: var(--text-muted); cursor: not-allowed; }

.btn { padding: 6px 12px; border: 1px solid var(--border); border-radius: 4px; background: #fff; cursor: pointer; font-size: 13px; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.btn-secondary { background: var(--bg); color: var(--text-secondary); }
.empty { text-align: center; color: #888; padding: 24px; }

.warn-zone { border-color: #fde68a; background: #fffbeb; }
.warn-zone h4 { color: #dc2626; }
.ok-box { padding: 16px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0; }
.ok-title { font-size: 14px; font-weight: 600; color: #059669; }
.warn-banner { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: #fff; border-radius: 8px; border: 1px solid #fde68a; color: #92400e; font-size: 13px; flex-wrap: wrap; }
.warn-icon { font-size: 16px; }
</style>
