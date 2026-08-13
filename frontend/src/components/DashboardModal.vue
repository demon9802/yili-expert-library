<template>
  <div class="modal-overlay dashboard-modal" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-title">📊 数据仪表盘</div>
        <button class="modal-close" @click="$emit('close')">✕</button>
      </div>
      <div class="modal-body">
        <div class="dashboard-grid">
          <!-- 领域分布 -->
          <div class="dashboard-card full">
            <h4>领域分布情况</h4>
            <div class="chart-container tall">
              <svg v-if="fieldStats.length" width="100%" height="100%" viewBox="0 0 800 300" preserveAspectRatio="xMidYMid meet">
                <g transform="translate(0,10)">
                  <line x1="90" y1="0" x2="90" y2="250" stroke="#e2e8f0" stroke-width="1"/>
                  <line x1="90" y1="250" x2="780" y2="250" stroke="#e2e8f0" stroke-width="1"/>
                  <g v-for="i in 5" :key="i">
                    <line
                      :x1="90" :y1="250 - (250 * (i - 1) / 4)"
                      :x2="780" :y2="250 - (250 * (i - 1) / 4)"
                      stroke="#f1f5f9" stroke-width="1" stroke-dasharray="3,3"
                    />
                    <text :x="85" :y="250 - (250 * (i - 1) / 4) + 4" text-anchor="end" font-size="11" fill="#94a3b8">
                      {{ Math.round(maxFieldCount * (i - 1) / 4) }}
                    </text>
                  </g>
                </g>
                <g v-for="(f, idx) in fieldStats" :key="f.name" :transform="`translate(${100 + idx * barSlotWidth},0)`">
                  <rect
                    :x="0" :y="250 - barHeight(f.count)"
                    :width="barWidth" :height="barHeight(f.count)"
                    rx="4" :fill="f.color" opacity="0.85"
                  />
                  <text
                    :x="barWidth / 2" :y="250 - barHeight(f.count) - 6"
                    text-anchor="middle" font-size="11" font-weight="600" fill="#475569"
                  >{{ f.count }}</text>
                  <text
                    :x="barWidth / 2" :y="270"
                    text-anchor="middle" font-size="10" fill="#64748b"
                    :transform="`rotate(-20, ${barWidth / 2}, 270)`"
                  >{{ shortFieldName(f.name) }}</text>
                </g>
              </svg>
              <div v-else class="empty-chart">暂无领域分布数据</div>
            </div>
          </div>

          <!-- 分值分布 -->
          <div class="dashboard-card">
            <h4>分值分布</h4>
            <div class="chart-container">
              <svg v-if="scoreTotal > 0" width="100%" height="100%" viewBox="0 0 360 250" preserveAspectRatio="xMidYMid meet">
                <g v-for="(slice, idx) in scoreSlices" :key="idx">
                  <path
                    :d="slice.path"
                    :fill="slice.color"
                    stroke="#ffffff"
                    stroke-width="3"
                    opacity="0.95"
                  />
                  <text
                    v-if="slice.percent >= 3"
                    :x="slice.labelX" :y="slice.labelY"
                    text-anchor="middle" font-size="14" font-weight="900" fill="white"
                    style="text-shadow:0 1px 3px rgba(0,0,0,0.45); paint-order:stroke; stroke:#00000055; stroke-width:2.5px"
                  >{{ slice.percent.toFixed(1) }}%</text>
                </g>
                <text :x="cx" :y="cy - 8" text-anchor="middle" font-size="26" font-weight="800" fill="#1e293b">{{ scoreTotal }}</text>
                <text :x="cx" :y="cy + 18" text-anchor="middle" font-size="13" fill="#64748b">位专家</text>

                <g v-for="(item, idx) in scoreLegend" :key="'l'+idx" :transform="`translate(220, ${legendStartY + idx * 40})`">
                  <rect x="0" y="2" width="14" height="14" rx="3" :fill="item.color"/>
                  <text x="22" y="14" font-size="13" font-weight="600" fill="#334155">{{ item.label }}</text>
                  <text x="22" y="30" font-size="12" fill="#64748b">{{ item.count }}人 ({{ item.percent.toFixed(1) }}%)</text>
                </g>
              </svg>
              <div v-else class="empty-chart">暂无可评分数据</div>
            </div>
          </div>

          <!-- 各项评分平均分 -->
          <div class="dashboard-card">
            <h4>各项评分平均分</h4>
            <div class="score-numeric-grid">
              <div class="score-numeric-item">
                <div class="label">专业度</div>
                <div class="value blue">{{ avgScores.professional }}</div>
                <div class="sub">满分5分</div>
              </div>
              <div class="score-numeric-item">
                <div class="label">影响力</div>
                <div class="value amber">{{ avgScores.influence }}</div>
                <div class="sub">满分5分</div>
              </div>
              <div class="score-numeric-item">
                <div class="label">综合评分</div>
                <div class="value green">{{ avgScores.overall }}</div>
                <div class="sub">加权平均</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/store/appStore'

const emit = defineEmits<{ close: [] }>()
const store = useAppStore()

const activeExperts = computed(() =>
  store.experts.filter(e => e.status !== 'eliminated' && (e.scores?.overall ?? 0) >= 3)
)

// 领域分布
const fieldStats = computed(() => {
  const used = new Set(activeExperts.value.flatMap(e => e.fields || []))
  const visible = store.fields.filter(f => {
    if (f.hideWhenEmpty && !used.has(f.name)) return false
    return true
  })
  const counts: Record<string, number> = {}
  visible.forEach(f => { counts[f.name] = 0 })
  activeExperts.value.forEach(e => {
    (e.fields || []).forEach(name => {
      if (counts[name] !== undefined) counts[name]++
    })
  })
  return visible
    .map(f => ({ name: f.name, count: counts[f.name], color: f.color }))
    .filter(f => f.count > 0)
    .sort((a, b) => b.count - a.count)
})

const maxFieldCount = computed(() => Math.max(...fieldStats.value.map(f => f.count), 1))
const chartInnerWidth = 700
const barSlotWidth = computed(() => fieldStats.value.length ? chartInnerWidth / fieldStats.value.length : 0)
const barWidth = computed(() => Math.min(60, barSlotWidth.value - 10))

function barHeight(count: number) {
  return Math.max(2, (count / maxFieldCount.value) * 240)
}

function shortFieldName(name: string) {
  return name.length > 6 ? name.slice(0, 6) + '…' : name
}

// 分值分布（V5.9.5 五星制：按综合评分区间统计活跃专家）
const buckets = [
  { label: '4.5-5.0★', min: 4.5, max: 5.0, includeMax: true },
  { label: '4.0-4.5★（不含4.5）', min: 4.0, max: 4.5 },
  { label: '3.5-4.0★（不含4.0）', min: 3.5, max: 4.0 },
  { label: '3.0-3.5★（不含3.5）', min: 3.0, max: 3.5 }
]
const colors = ['#22c55e', '#86efac', '#f59e0b', '#f97316']

const scoredExperts = computed(() => activeExperts.value.filter(e => e.scores?.overall && e.scores.overall > 0))
const scoreCounts = computed(() => buckets.map(b => {
  if (b.includeMax) {
    return scoredExperts.value.filter(e => (e.scores!.overall! >= b.min && e.scores!.overall! <= b.max)).length
  }
  return scoredExperts.value.filter(e => (e.scores!.overall! >= b.min && e.scores!.overall! < b.max)).length
}))
const scoreTotal = computed(() => scoreCounts.value.reduce((a, b) => a + b, 0))

const cx = 95
const cy = 125
const r = 90
const innerR = 55

const scoreSlices = computed(() => {
  let start = -Math.PI / 2
  return scoreCounts.value.map((count, i) => {
    const angle = scoreTotal.value ? (count / scoreTotal.value) * 2 * Math.PI : 0
    const end = start + angle
    const path = angle > 0 ? describeDonutSlice(cx, cy, r, innerR, start, end) : ''
    const mid = start + angle / 2
    const labelR = (r + innerR) / 2
    const labelX = cx + labelR * Math.cos(mid)
    const labelY = cy + labelR * Math.sin(mid)
    const percent = scoreTotal.value ? (count / scoreTotal.value) * 100 : 0
    start = end
    return { path, color: colors[i], percent, labelX, labelY }
  })
})

function describeDonutSlice(cx: number, cy: number, r: number, ir: number, start: number, end: number) {
  const x1o = cx + r * Math.cos(start)
  const y1o = cy + r * Math.sin(start)
  const x2o = cx + r * Math.cos(end)
  const y2o = cy + r * Math.sin(end)
  const x1i = cx + ir * Math.cos(start)
  const y1i = cy + ir * Math.sin(start)
  const x2i = cx + ir * Math.cos(end)
  const y2i = cy + ir * Math.sin(end)
  const large = end - start > Math.PI ? 1 : 0
  return `M${x1o.toFixed(1)},${y1o.toFixed(1)} A${r},${r} 0 ${large} 1 ${x2o.toFixed(1)},${y2o.toFixed(1)} L${x2i.toFixed(1)},${y2i.toFixed(1)} A${ir},${ir} 0 ${large} 0 ${x1i.toFixed(1)},${y1i.toFixed(1)} Z`
}

const scoreLegend = computed(() => {
  return buckets.map((b, i) => ({
    label: b.label,
    count: scoreCounts.value[i],
    color: colors[i],
    percent: scoreTotal.value ? (scoreCounts.value[i] / scoreTotal.value) * 100 : 0
  })).filter(item => item.count > 0)
})
const legendStartY = computed(() => (250 - scoreLegend.value.length * 44) / 2)

// 平均分
const avgScores = computed(() => {
  const list = scoredExperts.value
  if (!list.length) return { professional: '0.0', influence: '0.0', overall: '0.0' }
  const avg = (key: 'professional' | 'influence' | 'overall') =>
    (list.reduce((s, e) => s + ((e.scores?.[key] as number) || 0), 0) / list.length).toFixed(1)
  return {
    professional: avg('professional'),
    influence: avg('influence'),
    overall: avg('overall')
  }
})
</script>

<style scoped>
.empty-chart {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 14px;
}
</style>
