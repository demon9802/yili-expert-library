<template>
  <div class="pagination-control">
    <button
      v-if="currentPage > 1"
      class="page-btn"
      @click="$emit('change', currentPage - 1)"
    >
      上一页
    </button>
    <button
      v-for="page in pages"
      :key="page"
      class="page-btn"
      :class="{ active: page === currentPage }"
      @click="$emit('change', page)"
    >
      {{ page }}
    </button>
    <button
      v-if="currentPage < totalPages"
      class="page-btn"
      @click="$emit('change', currentPage + 1)"
    >
      下一页
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  currentPage: number
  totalPages: number
}>()

defineEmits<{
  change: [page: number]
}>()

const pages = computed(() => {
  const result: number[] = []
  const max = 7
  let start = Math.max(1, props.currentPage - 3)
  let end = Math.min(props.totalPages, start + max - 1)
  if (end - start < max - 1) {
    start = Math.max(1, end - max + 1)
  }
  for (let i = start; i <= end; i++) {
    result.push(i)
  }
  return result
})
</script>
