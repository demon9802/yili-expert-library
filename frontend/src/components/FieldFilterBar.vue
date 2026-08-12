<template>
  <div class="field-filter-bar" :class="{ collapsed: store.fieldsCollapsed }">
    <button class="field-toggle" @click="store.fieldsCollapsed = !store.fieldsCollapsed">
      {{ store.fieldsCollapsed ? '展开' : '收起' }}
    </button>
    <div v-show="!store.fieldsCollapsed" class="field-chips">
      <button
        v-for="field in visibleFields"
        :key="field.name"
        class="field-chip"
        :class="{ active: store.fieldFilter.has(field.name) }"
        :style="{ backgroundColor: store.fieldFilter.has(field.name) ? field.color : '', color: store.fieldFilter.has(field.name) ? field.textColor : '' }"
        @click="store.toggleFieldFilter(field.name)"
      >
        {{ field.name }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/store/appStore'

const store = useAppStore()

const visibleFields = computed(() => {
  return store.fields.filter(f => {
    if (f.hideWhenEmpty) {
      const hasExperts = store.experts.some(e => e.fields?.includes(f.name))
      if (!hasExperts) return false
    }
    return true
  })
})
</script>
