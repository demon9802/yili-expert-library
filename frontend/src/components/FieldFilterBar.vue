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
        style="margin-left:8px;display:inline-flex;align-items:center;gap:4px"
        @click="store.fieldsCollapsed = !store.fieldsCollapsed"
      >
        <span
          style="display:inline-block;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;transition:transform .2s"
          :style="store.fieldsCollapsed ? 'border-top:4px solid currentColor' : 'border-bottom:4px solid currentColor'"
        ></span>
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
  // 与 V5 一致：未选中时半透明背景 + 领域色边框，选中时领域色背景
  const active = store.fieldFilter.has(field.name)
  return {
    backgroundColor: active ? field.color : hexToRgba(field.color, 0.13),
    color: active ? field.textColor : '#4A4A4A',
    borderColor: field.color,
    transform: active ? 'scale(1.05)' : undefined,
    boxShadow: active ? '0 2px 8px rgba(0,0,0,0.15)' : undefined
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function displayName(name: string) {
  if (isNarrowScreen() && name.length > 4) {
    return name.slice(0, 2) + '…'
  }
  return name
}
</script>
