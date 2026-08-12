<template>
  <div class="score-bar" :class="scoreClass">
    <div class="score-bar-fill" :style="{ width: fillPercent + '%' }"></div>
    <span class="score-value">{{ score ? score.toFixed(1) : '—' }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  score: number | null | undefined
}>()

const scoreClass = computed(() => {
  const s = props.score
  if (!s) return 'score-none'
  if (s >= 4) return 'score-high'
  if (s >= 3) return 'score-mid'
  return 'score-low'
})

const fillPercent = computed(() => {
  const s = props.score
  if (!s) return 0
  return Math.min(100, (s / 5) * 100)
})
</script>
