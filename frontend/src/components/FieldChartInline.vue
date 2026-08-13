<template>
  <div v-if="fieldStats.length > 0" class="field-chart-inline-wrapper">
    <div class="field-chart-inline-inner">
      <!-- Left Legend -->
      <div class="field-chart-legend field-chart-legend-left">
        <div
          v-for="f in leftLegend"
          :key="f.name"
          class="field-chart-legend-item"
        >
          <span class="field-chart-legend-dot" :style="{ background: f.color }"></span>
          <span class="field-chart-legend-text">{{ f.name }}</span>
        </div>
      </div>

      <!-- SVG Bar Chart -->
      <svg :width="svgWidth" :height="svgHeight" :viewBox="`0 0 ${svgWidth} ${svgHeight}`" style="overflow:visible;flex-shrink:0">
        <g v-for="(f, i) in fieldStats" :key="f.name">
          <rect
            :x="chartSidePad + i * (colW + gap)"
            :y="topPad + maxH - barHeight(f.count)"
            :width="colW"
            :height="barHeight(f.count)"
            rx="4"
            :fill="f.color"
            opacity="0.88"
          >
            <title>{{ f.name }}: {{ f.count }}人</title>
          </rect>
          <text
            :x="chartSidePad + i * (colW + gap) + colW / 2"
            :y="topPad + maxH - barHeight(f.count) - 4"
            text-anchor="middle"
            font-size="11"
            font-weight="600"
            :fill="f.color"
          >{{ f.count }}</text>
          <text
            :x="chartSidePad + i * (colW + gap) + colW / 2"
            :y="svgHeight - 8"
            text-anchor="middle"
            font-size="9"
            fill="#64748b"
          >{{ shortName(f.name) }}</text>
        </g>
      </svg>

      <!-- Right Legend -->
      <div class="field-chart-legend field-chart-legend-right">
        <div
          v-for="f in rightLegend"
          :key="f.name"
          class="field-chart-legend-item"
        >
          <span class="field-chart-legend-dot" :style="{ background: f.color }"></span>
          <span class="field-chart-legend-text">{{ f.name }}</span>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="field-chart-empty">暂无领域分布数据</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/store/appStore'

const store = useAppStore()

const activeExperts = computed(() =>
  store.experts.filter(e => e.status !== 'eliminated' && (e.scores?.overall ?? 0) >= 3)
)

const fieldStats = computed(() => {
  // 对齐 V5：按领域定义顺序（而非按数量排序）展示，图例左右分布更平衡
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
    .map(f => ({ name: f.name, count: counts[f.name], color: f.color || '#3B82F6' }))
    .filter(f => f.count > 0)
})

const maxVal = computed(() => Math.max(...fieldStats.value.map(f => f.count), 1))

// Chart dimensions (matching V5 renderVerticalBarChart)
const colW = 22
const gap = 22
const maxH = 110
const topPad = 22
const bottomPad = 32
const chartSidePad = 16
const legendWidth = 140

const svgWidth = computed(() =>
  fieldStats.value.length * (colW + gap) - gap + chartSidePad * 2
)
const svgHeight = maxH + topPad + bottomPad

function barHeight(count: number) {
  return Math.max(6, (count / maxVal.value) * maxH)
}

const abbrevMap: Record<string, string> = {
  'AI': 'AI',
  '产品': '产品',
  '产品创新': '产品创新',
  '内容营销': '内容营销',
  '商业模式': '商业模式',
  '战略规划/战略解码/战略落地': '战略规划',
  '技术': '技术',
  '数据': '数据',
  '数智化供应链': '数智供应链',
  '数智化营销': '数智营销',
  '流程管理': '流程管理',
  '电商': '电商',
  '组织人才': '组织人才',
  '通用（领导力/协同/执行力/目标管理）': '通用',
  '会员运营': '会员运营'
}

function shortName(name: string): string {
  return abbrevMap[name] || (name.length > 5 ? name.substring(0, 4) + '…' : name)
}

// Split legends into left and right halves
const halfIdx = computed(() => Math.ceil(fieldStats.value.length / 2))
const leftLegend = computed(() => fieldStats.value.slice(0, halfIdx.value))
const rightLegend = computed(() => fieldStats.value.slice(halfIdx.value))
</script>

<style scoped>
.field-chart-inline-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  overflow-x: auto;
}

.field-chart-inline-inner {
  display: flex;
  align-items: flex-start;
  flex-shrink: 0;
  gap: 24px;
}

.field-chart-legend {
  width: 140px;
  flex-shrink: 0;
  padding-top: 8px;
}

.field-chart-legend-left {
  padding-right: 16px;
}

.field-chart-legend-right {
  padding-left: 16px;
}

.field-chart-legend-item {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-bottom: 8px;
  font-size: 10px;
  line-height: 1.35;
}

.field-chart-legend-dot {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 2px;
  flex-shrink: 0;
  margin-top: 2px;
}

.field-chart-legend-text {
  color: #475569;
  white-space: normal;
  word-break: break-word;
  max-width: 118px;
}

.field-chart-empty {
  text-align: center;
  padding: 20px;
  color: var(--text-muted, #94a3b8);
  font-size: 14px;
}
</style>
