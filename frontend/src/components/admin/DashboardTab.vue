<template>
  <div class="admin-tab dashboard-tab">
    <div class="tab-header"><h2>数据看板</h2></div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ activeExperts.length }}</div>
        <div class="stat-label">有效专家</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ store.yiliProjects.length }}</div>
        <div class="stat-label">合作项目</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ store.fields.length }}</div>
        <div class="stat-label">领域分类</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ store.favorites.length }}</div>
        <div class="stat-label">收藏数</div>
      </div>
    </div>

    <div class="dashboard-grid">
      <!-- 领域分布 -->
      <div class="dashboard-card full">
        <h4>领域分布情况</h4>
        <div class="chart-container tall">
          <FieldChartInline />
        </div>
      </div>

      <!-- 分值分布（圆环图） -->
      <div class="dashboard-card">
        <h4>分值分布</h4>
        <div ref="chartContainer" class="chart-container">
          <svg :width="distChartWidth" :height="distChartHeight" :viewBox="`0 0 ${distChartWidth} ${distChartHeight}`">
            <g v-for="(slice, i) in scoreDistSlices" :key="i">
              <path
                :d="slice.path"
                :fill="slice.color"
                opacity="0.9"
              />
              <text
                v-if="slice.percent > 5"
                :x="slice.labelX"
                :y="slice.labelY"
                text-anchor="middle"
                font-size="11"
                font-weight="700"
                fill="white"
              >{{ slice.percent.toFixed(1) }}%</text>
            </g>
            <text :x="distCx" :y="distCy - 6" text-anchor="middle" font-size="22" font-weight="700" fill="#1e293b">{{ scoreDistTotal }}</text>
            <text :x="distCx" :y="distCy + 16" text-anchor="middle" font-size="12" fill="#64748b">位专家</text>

            <!-- 图例 -->
            <g v-for="(item, i) in scoreDistItems" :key="'legend-' + i">
              <rect :x="legendX" :y="16 + i * 32" width="14" height="14" rx="3" :fill="item.color" />
              <text :x="legendX + 20" :y="16 + i * 32 + 12" font-size="12" fill="#475569">{{ item.range }}</text>
              <text :x="legendX + 145" :y="16 + i * 32 + 12" font-size="12" font-weight="600" fill="#1e293b" text-anchor="end">{{ item.count }}人 ({{ item.percent.toFixed(1) }}%)</text>
            </g>
          </svg>
        </div>
      </div>

      <!-- 各项评分平均分 -->
      <div class="dashboard-card">
        <h4>各项评分平均分</h4>
        <div class="score-numeric-grid">
          <div class="score-numeric-item">
            <div class="label">专业度</div>
            <div class="value blue">{{ avgProfessional }}</div>
            <div class="sub">满分10分</div>
          </div>
          <div class="score-numeric-item">
            <div class="label">影响力</div>
            <div class="value amber">{{ avgInfluence }}</div>
            <div class="sub">满分10分</div>
          </div>
          <div class="score-numeric-item">
            <div class="label">综合评分</div>
            <div class="value green">{{ avgOverall }}</div>
            <div class="sub">加权平均</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/store/appStore'
import FieldChartInline from '@/components/FieldChartInline.vue'

const store = useAppStore()

const activeExperts = computed(() =>
  store.experts.filter(e => e.status !== 'eliminated' && (e.scores?.overall ?? 0) >= 3)
)

// 各项评分平均分（对齐 V5 展示：保留 1 位小数）
const avgProfessional = computed(() => {
  const list = activeExperts.value.filter(e => e.scores?.professional != null)
  if (!list.length) return '0.0'
  return (list.reduce((s, e) => s + (e.scores?.professional || 0), 0) / list.length).toFixed(1)
})
const avgInfluence = computed(() => {
  const list = activeExperts.value.filter(e => e.scores?.influence != null)
  if (!list.length) return '0.0'
  return (list.reduce((s, e) => s + (e.scores?.influence || 0), 0) / list.length).toFixed(1)
})
const avgOverall = computed(() => {
  const list = activeExperts.value.filter(e => e.scores?.overall != null)
  if (!list.length) return '0.0'
  return (list.reduce((s, e) => s + (e.scores?.overall || 0), 0) / list.length).toFixed(1)
})

// 分值分布（对齐 V5 截图：4 个 5★ 区间）
const scoreRanges = [
  { range: '4.5-5.0★', min: 4.5, max: 5.0, color: '#22c55e' },
  { range: '4.0-4.5★（不含4.5）', min: 4.0, max: 4.5, color: '#86efac' },
  { range: '3.5-4.0★（不含4.0）', min: 3.5, max: 4.0, color: '#f59e0b' },
  { range: '3.0-3.5★（不含3.5）', min: 3.0, max: 3.5, color: '#f97316' },
]

const scoreDistItems = computed(() => {
  const items = scoreRanges.map(r => ({ ...r, count: 0, percent: 0 }))
  activeExperts.value.forEach(e => {
    const s = e.scores?.overall
    if (s == null) return
    for (const item of items) {
      if (s >= item.min && s < item.max) {
        item.count++
        break
      }
      // 最高区间包含上限
      if (item.max === 5.0 && s >= item.min && s <= item.max) {
        item.count++
        break
      }
    }
  })
  const total = activeExperts.value.length || 1
  items.forEach(item => {
    item.percent = total > 0 ? (item.count / total) * 100 : 0
  })
  return items
})

const scoreDistTotal = computed(() => activeExperts.value.length)

// 圆环图尺寸（响应式）
const chartContainer = ref<HTMLElement | null>(null)
const containerWidth = ref(400)

function updateWidth() {
  const el = chartContainer.value
  if (el) containerWidth.value = el.clientWidth || 400
  else containerWidth.value = 400
}

onMounted(() => {
  updateWidth()
  window.addEventListener('resize', updateWidth)
})
onUnmounted(() => {
  window.removeEventListener('resize', updateWidth)
})

const distChartWidth = computed(() => Math.max(containerWidth.value, 360))
const distChartHeight = computed(() => 280)
const distCx = computed(() => distChartWidth.value * 0.38)
const distCy = computed(() => distChartHeight.value * 0.48)
const distR = computed(() => Math.min(distChartWidth.value * 0.22, 90))
const innerR = computed(() => distR.value * 0.55)
const legendX = computed(() => distChartWidth.value * 0.62)

const scoreDistSlices = computed(() => {
  const total = scoreDistTotal.value || 1
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

    const midAngle = startAngle + angle / 2
    const labelR = (distR.value + innerR.value) / 2
    const labelX = distCx.value + labelR * Math.cos(midAngle)
    const labelY = distCy.value + labelR * Math.sin(midAngle) + 4

    startAngle = endAngle
    return {
      path,
      color: item.color,
      percent: item.percent,
      labelX,
      labelY,
    }
  })
})
</script>

<style scoped>
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-top: 20px;
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
  margin: 0 0 12px 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text, #1e293b);
}

.chart-container {
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart-container.tall {
  min-height: 200px;
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
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
</style>
