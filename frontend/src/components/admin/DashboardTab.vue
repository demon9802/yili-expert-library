<template>
  <div class="admin-tab dashboard-tab">
    <div class="tab-header"><h2>数据看板</h2></div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-value">{{ store.experts.length }}</div><div class="stat-label">专家总数</div></div>
      <div class="stat-card"><div class="stat-value">{{ store.yiliProjects.length }}</div><div class="stat-label">合作项目</div></div>
      <div class="stat-card"><div class="stat-value">{{ store.fields.length }}</div><div class="stat-label">领域分类</div></div>
      <div class="stat-card"><div class="stat-value">{{ store.favorites.length }}</div><div class="stat-label">收藏数</div></div>
    </div>
    <div class="chart-section">
      <h3>领域分布</h3>
      <div class="bar-chart">
        <div v-for="field in fieldStats" :key="field.name" class="bar-row">
          <span class="bar-label">{{ field.name }}</span>
          <div class="bar-track"><div class="bar-fill" :style="{ width: field.percent + '%', background: field.color }"></div></div>
          <span class="bar-value">{{ field.count }}</span>
        </div>
      </div>
    </div>
    <div class="chart-section">
      <h3>评分分布</h3>
      <div class="bar-chart">
        <div v-for="item in scoreStats" :key="item.range" class="bar-row">
          <span class="bar-label">{{ item.range }}</span>
          <div class="bar-track"><div class="bar-fill" :style="{ width: item.percent + '%' }"></div></div>
          <span class="bar-value">{{ item.count }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/store/appStore'

const store = useAppStore()

const fieldStats = computed(() => {
  const counts: Record<string, number> = {}
  store.experts.forEach(e => e.fields?.forEach(f => { counts[f] = (counts[f] || 0) + 1 }))
  const max = Math.max(...Object.values(counts), 1)
  return Object.entries(counts).map(([name, count]) => {
    const field = store.fields.find(f => f.name === name)
    return { name, count, percent: (count / max) * 100, color: field?.color || '#2563EB' }
  }).sort((a, b) => b.count - a.count)
})

const scoreStats = computed(() => {
  const ranges = [{ range: '4-5★', min: 4, max: 5 }, { range: '3-4★', min: 3, max: 4 }, { range: '2-3★', min: 2, max: 3 }, { range: '未评分', min: -1, max: -1 }]
  const counts = ranges.map(r => ({ range: r.range, count: 0 }))
  store.experts.forEach(e => {
    const s = e.scores?.overall
    if (!s) { counts[3].count++; return }
    if (s >= 4) counts[0].count++
    else if (s >= 3) counts[1].count++
    else if (s >= 2) counts[2].count++
    else counts[3].count++
  })
  const max = Math.max(...counts.map(c => c.count), 1)
  return counts.map(c => ({ ...c, percent: (c.count / max) * 100 }))
})
</script>
