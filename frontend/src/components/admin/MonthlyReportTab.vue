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

    <div ref="reportExportRef" class="report-body">
      <p class="report-note">
        统计范围：全量库内资源（含未在前台展示的观察库专家、已淘汰专家，以及不可见 / 未关联专家的合作项目）。
      </p>

      <!-- 资源总览 -->
      <h4 class="report-h4">资源总览</h4>
      <div class="stats-grid">
        <div class="stat-card">
          <span>专家总数（全量）</span>
          <strong>{{ expertStats.total }}</strong>
        </div>
        <div class="stat-card">
          <span>前台展示专家</span>
          <strong class="ok">{{ expertStats.active }}</strong>
        </div>
        <div class="stat-card">
          <span>观察库专家（不展示）</span>
          <strong class="warn">{{ expertStats.observing }}</strong>
        </div>
        <div class="stat-card">
          <span>已淘汰专家</span>
          <strong class="danger">{{ expertStats.eliminated }}</strong>
        </div>
        <div class="stat-card">
          <span>合作项目总数（全量）</span>
          <strong>{{ projectStats.total }}</strong>
        </div>
        <div class="stat-card">
          <span>可见项目</span>
          <strong class="ok">{{ projectStats.visible }}</strong>
        </div>
        <div class="stat-card">
          <span>不可见项目</span>
          <strong class="warn">{{ projectStats.invisible }}</strong>
        </div>
        <div class="stat-card">
          <span>未关联专家项目</span>
          <strong class="warn">{{ projectStats.unlinked }}</strong>
        </div>
      </div>

      <!-- 评分分布 -->
      <h4 class="report-h4">专家评分分布（全量）</h4>
      <div class="dist-row" v-for="b in scoreBuckets" :key="b.label">
        <span class="dist-label">{{ b.label }}</span>
        <div class="dist-bar-track">
          <div class="dist-bar" :style="{ width: barPct(b.count) + '%' }"></div>
        </div>
        <span class="dist-count">{{ b.count }} 人</span>
      </div>

      <!-- 访问统计 -->
      <h4 class="report-h4">访问统计</h4>
      <div class="stats-grid sm">
        <div class="stat-card">
          <span>总访问量</span>
          <strong>{{ pageStats.totalViews ?? 0 }}</strong>
        </div>
        <div class="stat-card">
          <span>本月新增专家</span>
          <strong>{{ pageStats.newExperts ?? 0 }}</strong>
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
      <p v-if="loading">加载中...</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { pageViewApi } from '@/api/pageView'
import { useAppStore } from '@/store/appStore'

interface MonthlyStats {
  totalExperts?: number
  newExperts?: number
  totalViews?: number
  month?: string
  rows?: MonthlyStats[]
  [key: string]: any
}

const store = useAppStore()
const stats = ref<MonthlyStats>({})
const loading = ref(false)
const reportExportRef = ref<HTMLElement | null>(null)

const monthlyRows = computed(() => Array.isArray(stats.value.rows) ? stats.value.rows : [])

// ===== 专家统计（全量库内资源） =====
const expertStats = computed(() => {
  const list = store.experts || []
  const total = list.length
  const active = list.filter(e => e.status === 'active').length
  const observing = list.filter(e => e.status === 'observation' || (!!e.observationStatus && e.status !== 'eliminated')).length
  const eliminated = list.filter(e => e.status === 'eliminated').length
  return { total, active, observing, eliminated }
})

// ===== 项目统计（全量库内资源） =====
const projectStats = computed(() => {
  const list = store.yiliProjects || []
  const total = list.length
  const visible = list.filter(p => p.visible !== false).length
  const invisible = list.filter(p => p.visible === false).length
  const expertIds = new Set((store.experts || []).map(e => e.id))
  const unlinked = list.filter(p => p.expertId == null || !expertIds.has(p.expertId)).length
  return { total, visible, invisible, unlinked }
})

// ===== 评分分布 =====
const scoreBuckets = computed(() => {
  const list = store.experts || []
  const buckets: Record<string, number> = { '1★': 0, '2★': 0, '3★': 0, '4★': 0, '5★': 0 }
  list.forEach(e => {
    const o = e.scores?.overall
    if (o == null || !Number.isFinite(o)) return
    const star = Math.min(5, Math.max(1, Math.round(o)))
    buckets[star + '★'] += 1
  })
  return [
    { label: '1★', count: buckets['1★'] },
    { label: '2★', count: buckets['2★'] },
    { label: '3★', count: buckets['3★'] },
    { label: '4★', count: buckets['4★'] },
    { label: '5★', count: buckets['5★'] },
  ]
})
function barPct(count: number): number {
  const max = Math.max(1, ...scoreBuckets.value.map(b => b.count))
  return Math.round((count / max) * 100)
}

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

async function captureReport() {
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
  const canvas = await captureReport()
  if (!canvas) return
  downloadCanvasAsPNG(canvas, `月度系统数据报告_${new Date().toISOString().slice(0, 10)}.png`)
}

async function exportPDF() {
  const canvas = await captureReport()
  if (!canvas) return
  downloadCanvasAsPDF(canvas, '月度系统数据报告', `月度系统数据报告_${new Date().toISOString().slice(0, 10)}.pdf`)
}

onMounted(loadStats)
</script>

<style scoped>
.admin-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.toolbar-actions { display: flex; gap: 8px; align-items: center; }
.report-body { background: #fff; padding: 4px; }
.report-note { font-size: 12px; color: #6b7280; margin: 0 0 16px; line-height: 1.6; }
.report-h4 { font-size: 15px; margin: 20px 0 10px; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 8px; }
.stats-grid.sm { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
.stat-card { padding: 18px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; }
.stat-card span { display: block; color: #6b7280; font-size: 13px; }
.stat-card strong { display: block; margin-top: 8px; font-size: 32px; color: #111827; }
.stat-card strong.ok { color: #059669; }
.stat-card strong.warn { color: #d97706; }
.stat-card strong.danger { color: #dc2626; }

.dist-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.dist-label { width: 36px; font-size: 13px; color: #374151; text-align: right; }
.dist-bar-track { flex: 1; background: #f3f4f6; border-radius: 6px; height: 18px; overflow: hidden; }
.dist-bar { height: 100%; background: linear-gradient(90deg, #60a5fa, #2563eb); border-radius: 6px; transition: width 0.3s; }
.dist-count { width: 64px; font-size: 13px; color: #6b7280; }

.admin-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
th, td { padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: left; font-size: 13px; }
.btn { padding: 6px 12px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; }
</style>
