<template>
  <div class="filter-bar field-bar-wrapper" style="margin-top:8px">
    <div class="filter-group field-filter-group">
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
        <button
          class="field-toggle-btn field-toggle-inline"
          :title="store.fieldsCollapsed ? '展开更多领域' : '收起领域标签'"
          @click="store.fieldsCollapsed = !store.fieldsCollapsed"
        >
          <span class="field-toggle-text">{{ store.fieldsCollapsed ? '展开' : '收起' }}</span>
          <span class="field-toggle-icon" :class="{ collapsed: store.fieldsCollapsed }">▲</span>
        </button>
      </div>
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
  if (isNarrowScreen()) {
    if (name.startsWith('通用')) return '通用…'
    if (name.startsWith('战略') || name.includes('战略规划') || name.includes('战略解码') || name.includes('战略落地')) return '战略…'
    if (name.length > 4) return name.slice(0, 2) + '…'
  }
  return name
}
</script>

<style scoped>
.field-filter-group {
  flex: 1;
  min-width: 0;
}
.field-toggle-inline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 28px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  transition: all 0.2s ease;
  line-height: 1;
  vertical-align: middle;
}
.field-toggle-inline:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-light);
}
.field-toggle-icon {
  font-size: 9px;
  transform: rotate(0deg);
  transition: transform 0.2s ease;
}
.field-toggle-icon.collapsed {
  transform: rotate(180deg);
}
@media (max-width: 400px) {
  .field-toggle-inline {
    min-height: 24px;
    padding: 3px 8px;
    font-size: 11px;
  }
}
</style>
