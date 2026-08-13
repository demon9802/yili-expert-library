<template>
  <div class="admin-tab dashboard-tab">
    <div class="tab-header">
      <h2>仪表盘管理</h2>
      <p>配置前端仪表盘的展示内容和图表形式，点击图表区域可跳转至对应的管理页面。</p>
    </div>

    <section class="dashboard-section">
      <h4>展示模块设置</h4>
      <div class="module-settings">
        <label
          v-for="item in moduleSettings"
          :key="item.id"
          class="module-setting-row"
        >
          <span>
            <span class="module-name">{{ item.name }}</span>
            <span class="module-desc">{{ item.desc }}</span>
          </span>
          <input v-model="visibleModules[item.id]" type="checkbox" />
        </label>
      </div>
    </section>

    <section class="dashboard-section">
      <h4>数据统计导出</h4>
      <div class="export-actions">
        <button class="btn btn-primary btn-sm" @click="exportImage">导出为图片</button>
        <button class="btn btn-secondary btn-sm" @click="exportPDF">导出为PDF</button>
        <button class="btn btn-secondary btn-sm" @click="exportCSV">导出统计数据CSV</button>
      </div>
    </section>

    <section class="dashboard-section">
      <h4>实时预览</h4>
      <div class="dashboard-grid">
        <div v-if="visibleModules.fields" class="dashboard-card full">
          <h4>领域分布情况</h4>
          <div class="chart-container tall">
            <FieldChartInline />
          </div>
        </div>

        <div v-if="visibleModules.scoreDist" class="dashboard-card">
          <h4>分值分布</h4>
          <div ref="chartContainer" class="chart-container dist-chart-wrap">
            <svg class="dist-chart" :viewBox="`0 0 ${distChartWidth} ${distChartHeight}`" role="img" aria-label="分值分布圆环图">
              <g v-if="scoreDistTotal > 0">
                <path
                  v-for="(slice, i) in scoreDistSlices"
                  :key="i"
                  :d="slice.path"
                  :fill="slice.color"
                  opacity="0.9"
                />
              </g>
              <circle v-else :cx="distCx" :cy="distCy" :r="distR" fill="#e2e8f0" />
              <circle :cx="distCx" :cy="distCy" :r="innerR" fill="#fff" />
              <text :x="distCx" :y="distCy - 6" text-anchor="middle" font-size="22" font-weight="700" fill="#1e293b">{{ scoreDistTotal }}</text>
              <text :x="distCx" :y="distCy + 16" text-anchor="middle" font-size="12" fill="#64748b">位专家</text>

              <g v-for="(item, i) in scoreDistItems" :key="'legend-' + i">
                <rect :x="legendX" :y="legendY + i * 30" width="12" height="12" rx="3" :fill="item.color" />
                <text :x="legendX + 18" :y="legendY + i * 30 + 10" font-size="12" fill="#475569">{{ item.range }}</text>
                <text :x="legendValueX" :y="legendY + i * 30 + 10" font-size="12" font-weight="600" fill="#1e293b" text-anchor="end">
                  {{ item.count }}人 {{ item.percent.toFixed(1) }}%
                </text>
              </g>
            </svg>
          </div>
        </div>

        <div v-if="visibleModules.scoreNumeric" class="dashboard-card">
          <h4>各项评分平均分</h4>
          <div class="score-numeric-grid">
            <div class="score-numeric-item">
              <div class="label">专业度</div>
              <div class="value blue">{{ avgProfessional }}</div>
              <div class="sub">满分5分</div>
            </div>
            <div class="score-numeric-item">
              <div class="label">影响力</div>
              <div class="value amber">{{ avgInfluence }}</div>
              <div class="sub">满分5分</div>
            </div>
            <div class="score-numeric-item">
              <div class="label">综合评分</div>
              <div class="value green">{{ avgOverall }}</div>
              <div class="sub">加权平均</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/store/appStore'
import FieldChartInline from '@/components/FieldChartInline.vue'

const store = useAppStore()

type ModuleId = 'fields' | 'scoreDist' | 'scoreNumeric'

const moduleSettings: { id: ModuleId; name: string; desc: string }[] = [
  { id: 'fields', name: '领域分布情况', desc: '柱状图展示各适用领域的专家数量分布' },
  { id: 'scoreDist', name: '分值分布', desc: '圆环图展示有效专家在各分值区间的数量占比' },
  { id: 'scoreNumeric', name: '各项评分平均分', desc: '数值卡片展示专业度、影响力、综合评分的平均分' },
]

const visibleModules = ref<Record<ModuleId, boolean>>({
  fields: true,
  scoreDist: true,
  scoreNumeric: true,
})

const activeExperts = computed(() =>
  store.experts.filter(e => e.status !== 'eliminated' && (e.scores?.overall ?? 0) >= 3)
)

function avgScore(key: 'professional' | 'influence' | 'overall') {
  const list = activeExperts.value.filter(e => e.scores?.[key] != null)
  if (!list.length) return '0.0'
  return (list.reduce((sum, e) => sum + (e.scores?.[key] || 0), 0) / list.length).toFixed(1)
}

const avgProfessional = computed(() => avgScore('professional'))
const avgInfluence = computed(() => avgScore('influence'))
const avgOverall = computed(() => avgScore('overall'))

const scoreRanges = [
  { range: '4.5-5.0分', min: 4.5, max: 5.0, color: '#22c55e' },
  { range: '4.0-4.5分', min: 4.0, max: 4.5, color: '#86efac' },
  { range: '3.5-4.0分', min: 3.5, max: 4.0, color: '#f59e0b' },
  { range: '3.0-3.5分', min: 3.0, max: 3.5, color: '#f97316' },
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

const chartContainer = ref<HTMLElement | null>(null)
const containerWidth = ref(400)

function updateWidth() {
  containerWidth.value = chartContainer.value?.clientWidth || 400
}

onMounted(() => {
  updateWidth()
  window.addEventListener('resize', updateWidth)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateWidth)
})

const distChartWidth = computed(() => Math.max(containerWidth.value, 360))
const distChartHeight = computed(() => distChartWidth.value < 520 ? 360 : 260)
const distCx = computed(() => distChartWidth.value < 520 ? distChartWidth.value / 2 : distChartWidth.value * 0.34)
const distCy = computed(() => distChartWidth.value < 520 ? 120 : distChartHeight.value / 2)
const distR = computed(() => Math.min(distChartWidth.value * 0.2, 82))
const innerR = computed(() => distR.value * 0.58)
const legendX = computed(() => distChartWidth.value < 520 ? 24 : distChartWidth.value * 0.58)
const legendY = computed(() => distChartWidth.value < 520 ? 235 : 64)
const legendValueX = computed(() => distChartWidth.value - 24)

const scoreDistSlices = computed(() => {
  const total = scoreDistTotal.value
  let startAngle = -Math.PI / 2
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
    startAngle = endAngle
    return { path, color: item.color }
  })
})

function exportImage() {
  console.log('导出为图片需要接入 html2canvas 后生成图片文件')
}

function exportPDF() {
  console.log('导出为PDF需要接入 html2canvas 与 jspdf 后生成 PDF 文件')
}

function exportCSV() {
  const fieldCount = new Map(store.fields.map(field => [field.name, 0]))
  activeExperts.value.forEach(expert => {
    expert.fields?.forEach(field => {
      if (fieldCount.has(field)) fieldCount.set(field, (fieldCount.get(field) || 0) + 1)
    })
  })

  const rows = [
    ['类别', '名称', '数值'],
    ...Array.from(fieldCount.entries()).map(([name, count]) => ['领域分布', name, String(count)]),
    ['评分平均分', '专业度平均分', avgProfessional.value],
    ['评分平均分', '影响力平均分', avgInfluence.value],
    ['评分平均分', '综合评分平均分', avgOverall.value],
    ...scoreDistItems.value.map(item => ['分值分布', item.range, String(item.count)]),
  ]
  const csv = rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `仪表盘统计数据_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.tab-header p {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--text-secondary, #64748b);
}

.dashboard-section {
  margin-top: 20px;
}

.dashboard-section > h4 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text, #1e293b);
}

.module-settings {
  display: grid;
  gap: 8px;
}

.module-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  background: var(--bg, #f8fafc);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 8px;
  cursor: pointer;
}

.module-name,
.module-desc {
  display: block;
}

.module-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text, #1e293b);
}

.module-desc {
  margin-top: 3px;
  font-size: 11px;
  color: var(--text-muted, #94a3b8);
}

.export-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.dashboard-card {
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #e2e8f0);
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
  color: var(--text, #1e293b);
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

@media (max-width: 900px) {
  .dashboard-grid,
  .score-numeric-grid {
    grid-template-columns: 1fr;
  }
}
</style>
