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

    <!-- 评分体系配置（规则说明，V6 采用 5 星制简化模型） -->
    <div class="config-card">
      <h4>评分体系配置</h4>
      <div class="rules-grid">
        <div class="rule-item"><span class="rule-label">维度权重</span><span class="rule-value">专业度 60% · 影响力 40%</span></div>
        <div class="rule-item"><span class="rule-label">综合评分</span><span class="rule-value">专业度×0.6 + 影响力×0.4（满分 5★）</span></div>
        <div class="rule-item"><span class="rule-label">缺失固定</span><span class="rule-value">未评分维度固定 2★</span></div>
        <div class="rule-item"><span class="rule-label">子维度封顶</span><span class="rule-value">单子维度最高 5★</span></div>
        <div class="rule-item"><span class="rule-label">前端展示阈值</span><span class="rule-value">综合 &lt; 3★ 不展示</span></div>
      </div>
      <p class="hint">说明：V6 采用五星制简化评分模型，子维度自动重算与 AI 自主评分属独立评分引擎模块，后续作为单独任务接入。</p>
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
import type { Expert, Scores } from '@/types'

const store = useAppStore()
const searchQuery = ref('')

// ===== 前端展示控制 =====
function onToggleShow(e: Event) {
  store.setShowScores((e.target as HTMLInputElement).checked)
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
  const reasons: string[] = []
  if ((e.scores?.professional ?? 0) < WARN_THRESHOLD)
    reasons.push(`专业度评分偏低（${e.scores?.professional?.toFixed(1) ?? '-'}），建议核查学历、资质等维度`)
  if ((e.scores?.influence ?? 0) < WARN_THRESHOLD)
    reasons.push(`影响力评分偏低（${e.scores?.influence?.toFixed(1) ?? '-'}），建议核查荣誉、履历等维度`)
  return reasons
}

async function adjustToThreshold(e: Expert) {
  const updated = await expertApi.update(e.id, {
    scores: { ...(e.scores || {}), professional: Math.max(e.scores?.professional ?? 0, WARN_THRESHOLD), overall: WARN_THRESHOLD },
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

/* Rules */
.rules-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; }
.rule-item { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; }
.rule-label { font-size: 12px; color: var(--text-muted); }
.rule-value { font-size: 13px; font-weight: 600; color: var(--text); }

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
.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.empty { text-align: center; color: #888; padding: 24px; }

/* Warning zone */
.warn-zone { border-color: #fde68a; background: #fffbeb; }
.warn-zone h4 { color: #b45309; }
.ok-box { padding: 16px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0; }
.ok-title { font-size: 14px; font-weight: 600; color: #059669; }
.warn-item { background: #fff; padding: 14px; border-radius: 8px; margin-bottom: 8px; border: 1px solid #fde68a; }
.warn-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.warn-actions { display: flex; gap: 6px; }
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
