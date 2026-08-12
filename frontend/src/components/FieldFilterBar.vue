<template>
  <div class="filter-bar field-bar-wrapper" style="margin-top:8px">
    <div class="filter-group">
      <span class="filter-label">适用领域：</span>
      <div id="field-filters" class="field-filters">
        <span
          class="field-tag field-tag-all"
          :class="{ active: store.fieldFilter.size === 0 }"
          @click="store.fieldFilter.clear(); store.currentPage = 1"
        >
          全部
        </span>
        <span
          v-for="field in visibleFields"
          :key="field.name"
          class="field-tag"
          :class="{ active: store.fieldFilter.has(field.name) }"
          :style="tagStyle(field)"
          @click="store.toggleFieldFilter(field.name)"
        >
          {{ displayName(field.name) }}
        </span>
      </div>
      <button
        class="field-toggle-btn"
        style="margin-left:8px"
        @click="store.fieldsCollapsed = !store.fieldsCollapsed"
      >
        {{ store.fieldsCollapsed ? '展开' : '收起' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/store/appStore'
import { isNarrowScreen } from '@/utils/helpers'
import type { Field } from '@/types'

const store = useAppStore()

const visibleFields = computed(() => {
  const fields = store.fields.filter(f => {
    if (f.hideWhenEmpty) {
      const hasExperts = store.experts.some(e => e.fields?.includes(f.name))
      if (!hasExperts) return false
    }
    return true
  })
  return store.fieldsCollapsed ? fields.slice(0, 8) : fields
})

function tagStyle(field: Field) {
  if (store.fieldFilter.has(field.name)) {
    return {
      backgroundColor: field.color,
      color: field.textColor,
      borderColor: field.color,
      transform: 'scale(1.05)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
    }
  }
  return {}
}

function displayName(name: string) {
  if (isNarrowScreen() && name.length > 4) {
    return name.slice(0, 2) + '…'
  }
  return name
}
</script>
