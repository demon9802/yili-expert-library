<template>
  <section class="admin-tab monthly-report-tab">
    <div class="admin-toolbar">
      <h3>月度报告</h3>
      <div class="toolbar-actions">
        <button class="btn" @click="exportPNG">导出PNG</button>
        <button class="btn" @click="exportPDF">导出PDF</button>
        <button class="btn" @click="loadStats">刷新</button>
      </div>
    </div>

    <div ref="reportExportRef" class="report-body" :class="{ exporting: isExporting }">
      <div class="report-header">
        <h2>月度系统数据报告</h2>
        <p class="report-date">统计日期：{{ todayText }}</p>
      </div>

      <p class="report-note">
        统计范围：全量库内资源（含未在前台展示的观察库专家、已淘汰专家，以及不可见 / 未关联专家的合作项目）。
      </p>

      <!-- ① 本月专家变动 -->
      <h4 class="report-section-title">① 本月专家变动</h4>
      <div class="detail-section">
        <div class="detail-summary">
          <span>本月新增 <strong>{{ newExperts.length }}</strong> 位专家，修改 <strong>{{ modifiedExperts.length }}</strong> 位专家。</span>
          <button class="btn btn-sm" @click="expertDetailExpanded = !expertDetailExpanded">
            {{ expertDetailExpanded ? '收起明细' : '展开明细' }}
          </button>
        </div>
        <div v-if="expertDetailExpanded || isExporting" class="detail-body">
          <table class="admin-table">
            <thead>
              <tr>
                <th>专家姓名</th>
                <th>操作类型</th>
                <th>时间</th>
                <th>状态</th>
                <th>综合评分</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in paginatedExpertChanges" :key="item.expert.id + '-' + item.type">
                <td>{{ item.expert.name }}</td>
                <td>
                  <span class="tag" :class="item.type">{{ item.type === 'new' ? '新增' : '修改' }}</span>
                </td>
                <td>{{ formatDateTime(item.time) }}</td>
                <td>{{ statusLabel(item.expert.status) }}</td>
                <td>{{ item.expert.scores?.overall?.toFixed(1) ?? '-' }}</td>
              </tr>
              <tr v-if="allExpertChanges.length === 0">
                <td colspan="5" class="empty-cell">本月暂无专家变动</td>
              </tr>
            </tbody>
          </table>
          <div v-if="!isExporting && expertTotalPages > 1" class="pagination">
            <button class="btn btn-sm" :disabled="expertPage === 1" @click="expertPage--">上一页</button>
            <span>第 {{ expertPage }} / {{ expertTotalPages }} 页</span>
            <button class="btn btn-sm" :disabled="expertPage === expertTotalPages" @click="expertPage++">下一页</button>
          </div>
        </div>
      </div>

      <!-- ② 本月合作项目变动 -->
      <h4 class="report-section-title">② 本月合作项目变动</h4>
      <div class="detail-section">
        <div class="detail-summary">
          <span>本月新增 <strong>{{ newProjects.length }}</strong> 个项目，修改 <strong>{{ modifiedProjects.length }}</strong> 个项目。</span>
          <button class="btn btn-sm" @click="projectDetailExpanded = !projectDetailExpanded">
            {{ projectDetailExpanded ? '收起明细' : '展开明细' }}
          </button>
        </div>
        <div v-if="projectDetailExpanded || isExporting" class="detail-body">
          <table class="admin-table">
            <thead>
              <tr>
                <th>项目名称</th>
                <th>操作类型</th>
                <th>时间</th>
                <th>关联专家</th>
                <th>年份</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in paginatedProjectChanges" :key="item.project.id + '-' + item.type">
                <td>{{ item.project.title }}</td>
                <td>
                  <span class="tag" :class="item.type">{{ item.type === 'new' ? '新增' : '修改' }}</span>
                </td>
                <td>{{ formatDateTime(item.time) }}</td>
                <td>{{ relatedExpertName(item.project) }}</td>
                <td>{{ item.project.year }}</td>
              </tr>
              <tr v-if="allProjectChanges.length === 0">
                <td colspan="5" class="empty-cell">本月暂无合作项目变动</td>
              </tr>
            </tbody>
          </table>
          <div v-if="!isExporting && projectTotalPages > 1" class="pagination">
            <button class="btn btn-sm" :disabled="projectPage === 1" @click="projectPage--">上一页</button>
            <span>第 {{ projectPage }} / {{ projectTotalPages }} 页</span>
            <button class="btn btn-sm" :disabled="projectPage === projectTotalPages" @click="projectPage++">下一页</button>
          </div>
        </div>
      </div>

      <!-- ③ 当前仪表盘快照 -->
      <h4 class="report-section-title">③ 当前仪表盘快照（{{ todayText }}）</h4>
      <div class="dashboard-grid">
        <div class="dashboard-card full">
          <h4>领域分布情况</h4>
          <div class="chart-container tall">
            <FieldChartInline />
          </div>
        </div>

        <div class="dashboard-card">
          <h4>分值分布</h4>
          <div ref="chartContainer" class="chart-container dist-chart-wrap">
            <svg class="dist-chart" :viewBox="`0 0 ${distChartWidth} ${distChartHeight}`" role="img" aria-label="分值分布圆环图">
              <g v-if="scoreDistTotal > 0">
                <path
                  v-for="(slice, i) in scoreDistSlices"
                  :key="i"
                  :d="slice.path"
                  :fill="slice.color"
                  stroke="#ffffff"
                  stroke-width="2"
                  opacity="0.9"
                />
                <text
                  v-for="(slice, i) in scoreDistSlices.filter(s => s.percent >= 3)"
                  :key="'t' + i"
                  :x="slice.labelX" :y="slice.labelY + 4"
                  text-anchor="middle" font-size="12" font-weight="600" fill="#ffffff"
                >{{ slice.percent.toFixed(1) }}%</text>
              </g>
              <circle v-else :cx="distCx" :cy="distCy" :r="distR" fill="#e2e8f0" />
              <circle :cx="distCx" :cy="distCy" :r="innerR" fill="#fff" />
              <text :x="distCx" :y="distCy - 4" text-anchor="middle" font-size="24" font-weight="600" fill="#1e293b">{{ scoreDistTotal }}</text>
              <text :x="distCx" :y="distCy + 16" text-anchor="middle" font-size="12" fill="#64748b">位专家</text>

              <g v-for="(item, i) in scoreDistItems" :key="'legend-' + i">
                <rect :x="legendX" :y="legendY + i * 34" width="12" height="12" rx="3" :fill="item.color" />
                <text :x="legendX + 18" :y="legendY + i * 34 + 10" font-size="13" font-weight="600" fill="#334155">{{ item.range }}</text>
                <text :x="legendX + 18" :y="legendY + i * 34 + 26" font-size="12" fill="#64748b">{{ item.count }}人 ({{ item.percent.toFixed(1) }}%)</text>
              </g>
            </svg>
          </div>
        </div>

        <div class="dashboard-card">
          <h4>各项评分平均分</h4>
          <div class="score-numeric-grid">
            <div class="score-numeric-item">
              <div class="label">专业度</div>
              <div class="value blue">{{ avgProfessional }}</div>
              <div class="sub">满分 10 分</div>
            </div>
            <div class="score-numeric-item">
              <div class="label">影响力</div>
              <div class="value amber">{{ avgInfluence }}</div>
              <div class="sub">满分 10 分</div>
            </div>
            <div class="score-numeric-item">
              <div class="label">综合评分</div>
              <div class="value green">{{ avgOverall }}</div>
              <div class="sub">加权平均</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ④ 系统使用情况 -->
      <h4 class="report-section-title">④ 系统使用情况</h4>
      <div class="stats-grid sm">
        <div class="stat-card">
          <span>总访问量</span>
          <strong>{{ pageStats.totalViews ?? 0 }}</strong>
        </div>
        <div class="stat-card">
          <span>本月新增专家</span>
          <strong>{{ newExperts.length }}</strong>
        </div>
      </div>
      <table v-if="monthlyRows.length" class="admin-table">
        <thead>
          <tr>
            <th>月份</th>
            <th>专家总数</th>
            <th>新增专家</th>
            <th>访问量</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in monthlyRows" :key="row.month">
            <td>{{ row.month }}</td>
            <td>{{ row.totalExperts }}</td>
            <td>{{ row.newExperts }}</td>
            <td>{{ row.totalViews }}</td>
          </tr>
        </tbody>
      </table>

      <!-- ⑤ 观察库操作明细 -->
      <h4 class="report-section-title">⑤ 观察库操作明细</h4>
      <div class="detail-section">
        <div class="detail-summary">
          <span>共 <strong>{{ allObsLogs.length }}</strong> 条观察库操作记录。</span>
          <button class="btn btn-sm" @click="obsLogExpanded = !obsLogExpanded">
            {{ obsLogExpanded ? '收起明细' : '展开明细' }}
          </button>
        </div>
        <div v-if="obsLogExpanded || isExporting" class="detail-body">
          <table class="admin-table obs-log-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>专家</th>
                <th>操作者</th>
                <th>类型</th>
                <th>综合分变化</th>
                <th>操作意见</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in paginatedObsLogs" :key="log.id">
                <td>{{ formatDateTime(log.createdAt) }}</td>
                <td>{{ log.expertName }}</td>
                <td>{{ log.operatorName }}（{{ roleText(log.operatorRole) }}）</td>
                <td>
                  <span class="log-type" :class="'type-' + typeClass(log.operation)">{{ log.operation }}</span>
                </td>
                <td>{{ scoreChangeText(log) }}</td>
                <td>{{ log.note || '-' }}</td>
              </tr>
              <tr v-if="paginatedObsLogs.length === 0">
                <td colspan="6" class="empty-cell">暂无操作记录</td>
              </tr>
            </tbody>
          </table>
          <div v-if="!isExporting && obsLogTotalPages > 1" class="pagination">
            <button class="btn btn-sm" :disabled="obsLogPage === 1" @click="obsLogPage--">上一页</button>
            <span>第 {{ obsLogPage }} / {{ obsLogTotalPages }} 页</span>
            <button class="btn btn-sm" :disabled="obsLogPage === obsLogTotalPages" @click="obsLogPage++">下一页</button>
          </div>
        </div>
      </div>

      <!-- ⑥ 系统更新日志概要 -->
      <h4 class="report-section-title">⑥ 系统更新日志概要</h4>
      <div class="changelog-section">
        <div v-for="entry in changelog" :key="entry.version" class="changelog-item">
          <div class="changelog-head">
            <span class="changelog-version">v{{ entry.version }}</span>
            <span class="changelog-date">{{ entry.date }}</span>
            <span class="changelog-title">{{ entry.title }}</span>
          </div>
          <ul class="changelog-list">
            <li v-for="(c, i) in entry.changes" :key="i">{{ c }}</li>
          </ul>
        </div>
        <div v-if="changelog.length === 0" class="empty-cell">暂无系统更新日志</div>
      </div>

      <p v-if="loading" class="loading-text">加载中...</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, nextTick, watch } from 'vue'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { pageViewApi } from '@/api/pageView'
import { observationApi } from '@/api/observation'
import { useAppStore } from '@/store/appStore'
import { getAllChanges } from '@/utils/changelog'
import FieldChartInline from '@/components/FieldChartInline.vue'
import type { Expert, Project, ObservationOperation } from '@/types'

interface MonthlyStats {
  totalExperts?: number
  newExperts?: number
  totalViews?: number
  month?: string
  rows?: MonthlyStats[]
  [key: string]: any
}

interface ChangeItem<T> {
  type: 'new' | 'modified'
  time: string
  entity: T
}

const store = useAppStore()
const stats = ref<MonthlyStats>({})
const loading = ref(false)
const reportExportRef = ref<HTMLElement | null>(null)
const chartContainer = ref<HTMLElement | null>(null)
const containerWidth = ref(400)
const isExporting = ref(false)

const expertDetailExpanded = ref(false)
const projectDetailExpanded = ref(false)
const obsLogExpanded = ref(false)
const expertPage = ref(1)
const projectPage = ref(1)
const obsLogPage = ref(1)
const PAGE_SIZE = 5

const monthlyRows = computed(() => Array.isArray(stats.value.rows) ? stats.value.rows : [])

const today = new Date()
const todayText = computed(() => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${today.getFullYear()}/${p(today.getMonth() + 1)}/${p(today.getDate())}`
})

const currentMonthStart = computed(() => {
  const d = new Date(today.getFullYear(), today.getMonth(), 1)
  return d.getTime()
})

const currentMonthEnd = computed(() => {
  const d = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999)
  return d.getTime()
})

function inCurrentMonth(iso: string | null | undefined): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return !isNaN(t) && t >= currentMonthStart.value && t <= currentMonthEnd.value
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function statusLabel(status: string | null | undefined): string {
  if (!status) return '-'
  const map: Record<string, string> = {
    active: '在库',
    observation: '观察库',
    eliminated: '已淘汰'
  }
  return map[status] || status
}

function relatedExpertName(project: Project): string {
  if (project.expertId) {
    const expert = store.experts.find(e => e.id === project.expertId)
    if (expert) return expert.name
  }
  return project.pendingExpertName || '未关联'
}

function roleText(role?: string): string {
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

function scoreChangeText(log: ObservationOperation): string {
  try {
    const raw = log as ObservationOperation & { beforeState?: string; afterState?: string }
    const before = JSON.parse(String(raw.beforeState || '{}'))
    const after = JSON.parse(String(raw.afterState || '{}'))
    const b = before.scores?.overall
    const a = after.scores?.overall
    if (b == null || a == null) return '-'
    return `${Number(b).toFixed(1)} → ${Number(a).toFixed(1)}`
  } catch {
    return '-'
  }
}

// ===== 活跃专家（与仪表盘保持一致：排除已淘汰且综合评分 ≥ 3） =====
const activeExperts = computed(() =>
  store.experts.filter(e => e.status !== 'eliminated' && (e.scores?.overall ?? 0) >= 3)
)

function avgScore(key: 'professional' | 'influence' | 'overall'): string {
  const list = activeExperts.value.filter(e => e.scores?.[key] != null)
  if (!list.length) return '0.0'
  return (list.reduce((sum, e) => sum + (e.scores?.[key] || 0), 0) / list.length).toFixed(1)
}

const avgProfessional = computed(() => avgScore('professional'))
const avgInfluence = computed(() => avgScore('influence'))
const avgOverall = computed(() => avgScore('overall'))

// ===== 专家变动 =====
const newExperts = computed(() =>
  store.experts.filter(e => inCurrentMonth(e.createdAt))
)

const modifiedExperts = computed(() =>
  store.experts.filter(e => {
    if (!inCurrentMonth(e.updatedAt)) return false
    return e.updatedAt !== e.createdAt
  })
)

const allExpertChanges = computed(() => {
  const list: { type: 'new' | 'modified'; time: string; expert: Expert }[] = []
  newExperts.value.forEach(e => list.push({ type: 'new', time: e.createdAt, expert: e }))
  modifiedExperts.value.forEach(e => list.push({ type: 'modified', time: e.updatedAt, expert: e }))
  return list.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
})

const expertTotalPages = computed(() => Math.max(1, Math.ceil(allExpertChanges.value.length / PAGE_SIZE)))
const paginatedExpertChanges = computed(() => {
  if (isExporting.value) return allExpertChanges.value
  const start = (expertPage.value - 1) * PAGE_SIZE
  return allExpertChanges.value.slice(start, start + PAGE_SIZE)
})

// ===== 合作项目变动 =====
const newProjects = computed(() =>
  store.yiliProjects.filter(p => inCurrentMonth(p.createdAt))
)

const modifiedProjects = computed(() =>
  store.yiliProjects.filter(p => {
    if (!inCurrentMonth(p.updatedAt)) return false
    return p.updatedAt !== p.createdAt
  })
)

const allProjectChanges = computed(() => {
  const list: { type: 'new' | 'modified'; time: string; project: Project }[] = []
  newProjects.value.forEach(p => list.push({ type: 'new', time: p.createdAt, project: p }))
  modifiedProjects.value.forEach(p => list.push({ type: 'modified', time: p.updatedAt, project: p }))
  return list.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
})

const projectTotalPages = computed(() => Math.max(1, Math.ceil(allProjectChanges.value.length / PAGE_SIZE)))
const paginatedProjectChanges = computed(() => {
  if (isExporting.value) return allProjectChanges.value
  const start = (projectPage.value - 1) * PAGE_SIZE
  return allProjectChanges.value.slice(start, start + PAGE_SIZE)
})

// ===== 观察库操作明细 =====
const allObsLogs = ref<ObservationOperation[]>([])

async function loadObsLogs() {
  try {
    const all = await observationApi.findByExpertId()
    allObsLogs.value = (all || []).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )
  } catch {
    allObsLogs.value = []
  }
}

const obsLogTotalPages = computed(() => Math.max(1, Math.ceil(allObsLogs.value.length / PAGE_SIZE)))
const paginatedObsLogs = computed(() => {
  if (isExporting.value) return allObsLogs.value
  const start = (obsLogPage.value - 1) * PAGE_SIZE
  return allObsLogs.value.slice(start, start + PAGE_SIZE)
})

// ===== 系统更新日志概要 =====
const changelog = computed(() => getAllChanges())

// ===== 分值分布（与后台仪表盘一致） =====
const scoreRanges = [
  { range: '4.5-5.0分', min: 4.5, max: 5.0, color: '#22c55e' },
  { range: '4.0-4.5分（不含4.5）', min: 4.0, max: 4.5, color: '#86efac' },
  { range: '3.5-4.0分（不含4.0）', min: 3.5, max: 4.0, color: '#f59e0b' },
  { range: '3.0-3.5分（不含3.5）', min: 3.0, max: 3.5, color: '#f97316' },
]

const scoreDistItems = computed(() => {
  const items = scoreRanges.map(r => ({ ...r, count: 0, percent: 0 }))
  activeExperts.value.forEach(expert => {
    const score = expert.scores?.overall
    if (score == null) return
    for (const item of items) {
      const inRange = item.max === 5.0
        ? score >= item.min && score <= item.max
        : score >= item.min && score < item.max
      if (inRange) {
        item.count++
        break
      }
    }
  })
  const total = activeExperts.value.length
  items.forEach(item => {
    item.percent = total > 0 ? (item.count / total) * 100 : 0
  })
  return items
})

const scoreDistTotal = computed(() => activeExperts.value.length)

function updateWidth() {
  containerWidth.value = chartContainer.value?.clientWidth || 400
}

onMounted(() => {
  loadStats()
  loadObsLogs()
  updateWidth()
  window.addEventListener('resize', updateWidth)
})

watch([allExpertChanges, allProjectChanges, allObsLogs], () => {
  expertPage.value = 1
  projectPage.value = 1
  obsLogPage.value = 1
})

const distChartWidth = computed(() => Math.max(containerWidth.value, 360))
const distChartHeight = computed(() => distChartWidth.value < 520 ? 360 : 260)
const distCx = computed(() => distChartWidth.value < 520 ? distChartWidth.value / 2 : distChartWidth.value * 0.34)
const distCy = computed(() => distChartWidth.value < 520 ? 120 : distChartHeight.value / 2)
const distR = computed(() => Math.min(distChartWidth.value * 0.2, 82))
const innerR = computed(() => distR.value * 0.58)
const legendX = computed(() => distChartWidth.value < 520 ? 24 : distChartWidth.value * 0.58)
const legendY = computed(() => distChartWidth.value < 520 ? 220 : 66)

const scoreDistSlices = computed(() => {
  const total = scoreDistTotal.value
  let startAngle = -Math.PI / 2
  const labelR = (distR.value + innerR.value) / 2
  return scoreDistItems.value.map(item => {
    const angle = total > 0 ? (item.count / total) * 2 * Math.PI : 0
    const endAngle = startAngle + angle
    const largeArc = angle > Math.PI ? 1 : 0

    const x1o = distCx.value + distR.value * Math.cos(startAngle)
    const y1o = distCy.value + distR.value * Math.sin(startAngle)
    const x2o = distCx.value + distR.value * Math.cos(endAngle)
    const y2o = distCy.value + distR.value * Math.sin(endAngle)
    const x1i = distCx.value + innerR.value * Math.cos(startAngle)
    const y1i = distCy.value + innerR.value * Math.sin(startAngle)
    const x2i = distCx.value + innerR.value * Math.cos(endAngle)
    const y2i = distCy.value + innerR.value * Math.sin(endAngle)

    const path = `M${x1o.toFixed(1)},${y1o.toFixed(1)} A${distR.value},${distR.value} 0 ${largeArc} 1 ${x2o.toFixed(1)},${y2o.toFixed(1)} L${x2i.toFixed(1)},${y2i.toFixed(1)} A${innerR.value},${innerR.value} 0 ${largeArc} 0 ${x1i.toFixed(1)},${y1i.toFixed(1)} Z`
    const mid = startAngle + angle / 2
    const percent = total > 0 ? (item.count / total) * 100 : 0
    const labelX = distCx.value + labelR * Math.cos(mid)
    const labelY = distCy.value + labelR * Math.sin(mid)
    startAngle = endAngle
    return { path, color: item.color, percent, labelX, labelY }
  })
})

// ===== 访问统计（后端，best-effort） =====
const pageStats = computed(() => ({
  totalViews: stats.value.totalViews,
  newExperts: stats.value.newExperts,
}))

async function loadStats() {
  loading.value = true
  try {
    stats.value = await pageViewApi.getMonthlyStats()
  } catch {
    stats.value = {}
  } finally {
    loading.value = false
  }
}

async function captureReport(): Promise<HTMLCanvasElement | null> {
  if (!reportExportRef.value) return null
  return html2canvas(reportExportRef.value, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
  })
}

function downloadCanvasAsPNG(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png')
  link.download = filename
  link.click()
}

function downloadCanvasAsPDF(canvas: HTMLCanvasElement, title: string, filename: string) {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 10
  const headerHeight = 12
  const contentWidth = pageWidth - margin * 2
  const contentHeight = pageHeight - margin * 2 - headerHeight
  const imgHeight = (canvas.height * contentWidth) / canvas.width
  const imgData = canvas.toDataURL('image/png')
  let renderedHeight = 0

  while (renderedHeight < imgHeight) {
    if (renderedHeight > 0) pdf.addPage()
    pdf.setFontSize(14)
    pdf.text(title, margin, margin + 4)
    pdf.addImage(imgData, 'PNG', margin, margin + headerHeight - renderedHeight, contentWidth, imgHeight)
    renderedHeight += contentHeight
  }

  pdf.save(filename)
}

async function exportPNG() {
  await runExport(async canvas => {
    if (!canvas) return
    downloadCanvasAsPNG(canvas, `月度系统数据报告_${new Date().toISOString().slice(0, 10)}.png`)
  })
}

async function exportPDF() {
  await runExport(async canvas => {
    if (!canvas) return
    downloadCanvasAsPDF(canvas, '月度系统数据报告', `月度系统数据报告_${new Date().toISOString().slice(0, 10)}.pdf`)
  })
}

async function runExport(callback: (canvas: HTMLCanvasElement | null) => Promise<void>) {
  const prevExpertPage = expertPage.value
  const prevProjectPage = projectPage.value
  const prevObsLogPage = obsLogPage.value
  const prevExpertExpanded = expertDetailExpanded.value
  const prevProjectExpanded = projectDetailExpanded.value
  const prevObsLogExpanded = obsLogExpanded.value
  isExporting.value = true
  expertDetailExpanded.value = true
  projectDetailExpanded.value = true
  obsLogExpanded.value = true
  expertPage.value = 1
  projectPage.value = 1
  obsLogPage.value = 1
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 300))
  const canvas = await captureReport()
  await callback(canvas)
  isExporting.value = false
  expertDetailExpanded.value = prevExpertExpanded
  projectDetailExpanded.value = prevProjectExpanded
  obsLogExpanded.value = prevObsLogExpanded
  expertPage.value = prevExpertPage
  projectPage.value = prevProjectPage
  obsLogPage.value = prevObsLogPage
}
</script>

<style scoped>
.admin-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.report-body {
  background: #fff;
  padding: 4px;
}

.report-header {
  margin-bottom: 16px;
}

.report-header h2 {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.report-date {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}

.report-note {
  font-size: 12px;
  color: #6b7280;
  margin: 0 0 16px;
  line-height: 1.6;
}

.report-section-title {
  font-size: 15px;
  margin: 24px 0 12px;
  font-weight: 600;
  color: #111827;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.dashboard-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
}

.dashboard-card.full {
  grid-column: 1 / -1;
}

.dashboard-card h4 {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.chart-container {
  min-height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart-container.tall {
  min-height: 200px;
}

.dist-chart-wrap {
  align-items: stretch;
}

.dist-chart {
  width: 100%;
  height: auto;
}

.score-numeric-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  text-align: center;
  padding: 20px 0;
}

.score-numeric-item .label {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 8px;
}

.score-numeric-item .value {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 4px;
}

.score-numeric-item .value.blue { color: #3b82f6; }
.score-numeric-item .value.amber { color: #f59e0b; }
.score-numeric-item .value.green { color: #22c55e; }

.score-numeric-item .sub {
  font-size: 12px;
  color: #94a3b8;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 8px;
}

.stats-grid.sm {
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.stat-card {
  padding: 18px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.stat-card span {
  display: block;
  color: #6b7280;
  font-size: 13px;
}

.stat-card strong {
  display: block;
  margin-top: 8px;
  font-size: 32px;
  color: #111827;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
  font-size: 13px;
}

.admin-table th,
.admin-table td {
  padding: 10px;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
}

.admin-table th {
  background: #f9fafb;
  font-weight: 600;
  color: #374151;
}

.admin-table.obs-log-table th,
.admin-table.obs-log-table td {
  padding: 8px 10px;
  font-size: 12px;
}

.empty-cell {
  text-align: center;
  color: #9ca3af;
  padding: 20px;
}

.detail-section {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 14px;
  background: #fff;
  margin-bottom: 16px;
}

.detail-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #374151;
}

.detail-summary strong {
  color: #111827;
}

.detail-body {
  margin-top: 12px;
}

.tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.tag.new {
  background: #dcfce7;
  color: #166534;
}

.tag.modified {
  background: #dbeafe;
  color: #1e40af;
}

.log-type {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 11px;
}

.log-type.type-eliminated { background: #fee2e2; color: #991b1b; }
.log-type.type-extended { background: #dbeafe; color: #1d4ed8; }
.log-type.type-score { background: #dcfce7; color: #15803d; }
.log-type.type-delete { background: #f3e8ff; color: #7c3aed; }
.log-type.type-other { background: #f1f5f9; color: #475569; }

.changelog-section {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 14px;
  background: #fff;
  margin-bottom: 16px;
}

.changelog-item {
  padding: 10px 0;
  border-bottom: 1px dashed #e5e7eb;
}

.changelog-item:last-child {
  border-bottom: none;
}

.changelog-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.changelog-version {
  font-size: 13px;
  font-weight: 700;
  color: #1e40af;
  background: #eff6ff;
  border-radius: 6px;
  padding: 2px 8px;
}

.changelog-date {
  font-size: 12px;
  color: #64748b;
}

.changelog-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.changelog-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: #475569;
  line-height: 1.9;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  font-size: 13px;
  color: #6b7280;
}

.loading-text {
  font-size: 13px;
  color: #6b7280;
}

.btn {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 900px) {
  .dashboard-grid,
  .score-numeric-grid {
    grid-template-columns: 1fr;
  }
}
</style>
