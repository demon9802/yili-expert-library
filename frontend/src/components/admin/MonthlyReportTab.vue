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

    <div ref="reportExportRef">
      <div class="stats-grid">
        <div class="stat-card">
          <span>专家总数</span>
          <strong>{{ stats.totalExperts ?? store.experts.length }}</strong>
        </div>
        <div class="stat-card">
          <span>新增专家</span>
          <strong>{{ stats.newExperts ?? 0 }}</strong>
        </div>
        <div class="stat-card">
          <span>总访问量</span>
          <strong>{{ stats.totalViews ?? 0 }}</strong>
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

async function loadStats() {
  loading.value = true
  try {
    stats.value = await pageViewApi.getMonthlyStats()
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
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 20px; }
.stat-card { padding: 18px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; }
.stat-card span { display: block; color: #6b7280; }
.stat-card strong { display: block; margin-top: 8px; font-size: 32px; }
.admin-table { width: 100%; border-collapse: collapse; }
th, td { padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: left; }
.btn { padding: 6px 12px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; }
</style>
