<template>
  <span class="star-rating" :class="sizeClass">
    <span class="star-empty">★★★★★</span>
    <span class="star-fill" :style="{ width: pct + '%' }">★★★★★</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  score: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
}>(), {
  max: 5,
  size: 'md'
})

const pct = computed(() => {
  const s = typeof props.score === 'number' ? props.score : 0
  return Math.min(100, Math.max(0, (s / props.max) * 100))
})

const sizeClass = computed(() => {
  return props.size ? `star-${props.size}` : ''
})
</script>
