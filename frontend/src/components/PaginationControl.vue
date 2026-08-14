<template>
  <div class="page-navigation-inline">
    <button
      class="page-nav-inline-btn"
      :class="{ disabled: currentPage === 1 }"
      @click="gotoPage(currentPage - 1)"
    >
      上一页
    </button>

    <template v-if="totalPages > 1">
      <button
        v-if="startPage > 1"
        class="page-nav-inline-num"
        @click="gotoPage(1)"
      >
        1
      </button>
      <span v-if="startPage > 2" class="page-nav-inline-ellipsis">…</span>

      <button
        v-for="p in visiblePages"
        :key="p"
        class="page-nav-inline-num"
        :class="{ active: p === currentPage }"
        @click="gotoPage(p)"
      >
        {{ p }}
      </button>

      <span v-if="endPage < totalPages - 1" class="page-nav-inline-ellipsis">…</span>
      <button
        v-if="endPage < totalPages"
        class="page-nav-inline-num"
        @click="gotoPage(totalPages)"
      >
        {{ totalPages }}
      </button>
    </template>
    <button v-else class="page-nav-inline-num active">1</button>

    <button
      class="page-nav-inline-btn"
      :class="{ disabled: currentPage === totalPages }"
      @click="gotoPage(currentPage + 1)"
    >
      下一页
    </button>

    <span class="page-nav-inline-info">{{ currentPage }} / {{ totalPages }} 页</span>
    <button class="page-nav-inline-btn" @click="scrollToTop">
      返回顶部
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  currentPage: number
  totalPages: number
}>()

const emit = defineEmits<{
  change: [page: number]
}>()

const maxButtons = 7

const startPage = computed(() => {
  let start = Math.max(1, props.currentPage - Math.floor(maxButtons / 2))
  let end = Math.min(props.totalPages, start + maxButtons - 1)
  if (end - start < maxButtons - 1) {
    start = Math.max(1, end - maxButtons + 1)
  }
  return start
})

const endPage = computed(() => {
  return Math.min(props.totalPages, startPage.value + maxButtons - 1)
})

const visiblePages = computed(() => {
  const pages: number[] = []
  for (let p = startPage.value; p <= endPage.value; p++) {
    pages.push(p)
  }
  return pages
})

function gotoPage(p: number) {
  if (p < 1 || p > props.totalPages || p === props.currentPage) return
  emit('change', p)
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>
