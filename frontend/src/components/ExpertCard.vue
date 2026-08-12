<template>
  <div class="expert-card" @click="$emit('click')">
    <!-- Score Badge -->
    <div v-if="overallScore" class="score-badge" :class="scoreClass">
      <span class="score-value">{{ overallScore.toFixed(1) }}</span>
      <span class="score-stars">{{ stars }}</span>
    </div>

    <!-- Favorite Button -->
    <button
      class="favorite-btn"
      :class="{ active: isFavorite }"
      @click.stop="$emit('toggle-favorite')"
    >
      {{ isFavorite ? '★' : '☆' }}
    </button>

    <!-- Card Content -->
    <div class="card-header">
      <h3 class="expert-name">{{ expert.name }}</h3>
      <div class="expert-fields">
        <span
          v-for="field in expert.fields"
          :key="field"
          class="field-tag"
          :style="getFieldStyle(field)"
        >
          {{ abbreviateField(field) }}
        </span>
      </div>
    </div>

    <div class="card-body">
      <div v-if="expert.advantages?.length" class="advantages">
        <span v-for="(adv, i) in expert.advantages.slice(0, 3)" :key="i" class="advantage-tag">
          {{ adv }}
        </span>
      </div>
      <p v-if="expert.education" class="education">{{ expert.education }}</p>
      <p v-if="expert.qualDisplay" class="qualifications">{{ expert.qualDisplay }}</p>
    </div>

    <div class="card-footer">
      <span v-if="expert.isSupplier" class="supplier-badge">供应商</span>
      <span v-if="hasCooperation" class="cooperation-badge">已合作</span>
      <span v-if="expert.observationStatus" class="observation-badge">{{ expert.observationStatus }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/store/appStore'
import type { Expert } from '@/types'
import { isNarrowScreen } from '@/utils/helpers'

const props = defineProps<{
  expert: Expert
  isFavorite: boolean
}>()

defineEmits<{
  click: []
  'toggle-favorite': []
}>()

const store = useAppStore()

const overallScore = computed(() => props.expert.scores?.overall)

const scoreClass = computed(() => {
  const s = overallScore.value
  if (!s) return ''
  if (s >= 4) return 'score-high'
  if (s >= 3) return 'score-mid'
  return 'score-low'
})

const stars = computed(() => {
  const s = overallScore.value
  if (!s) return ''
  return '★'.repeat(Math.round(s)) + '☆'.repeat(5 - Math.round(s))
})

const hasCooperation = computed(() =>
  store.yiliProjects.some(p => p.expertId === props.expert.id)
)

function getFieldStyle(fieldName: string) {
  const field = store.fields.find(f => f.name === fieldName)
  if (field) {
    return {
      backgroundColor: field.color,
      color: field.textColor,
    }
  }
  return {}
}

function abbreviateField(name: string): string {
  if (isNarrowScreen() && name.length > 4) {
    return name.slice(0, 2) + '…'
  }
  return name
}
</script>
