<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="expert-detail-modal">
      <button class="modal-close" @click="$emit('close')">×</button>

      <!-- Header -->
      <div class="detail-header">
        <h2>{{ expert.name }}</h2>
        <div class="detail-fields">
          <span
            v-for="field in expert.fields"
            :key="field"
            class="field-tag"
            :style="getFieldStyle(field)"
          >
            {{ field }}
          </span>
        </div>
      </div>

      <!-- Score Section -->
      <div v-if="expert.scores?.overall" class="detail-scores">
        <div class="score-item">
          <span class="score-label">专业能力</span>
          <ScoreBar :score="expert.scores.professional" />
        </div>
        <div class="score-item">
          <span class="score-label">行业影响力</span>
          <ScoreBar :score="expert.scores.influence" />
        </div>
        <div class="score-item">
          <span class="score-label">综合评分</span>
          <ScoreBar :score="expert.scores.overall" />
        </div>
      </div>

      <!-- Body -->
      <div class="detail-body">
        <section v-if="expert.advantages?.length">
          <h3>核心优势</h3>
          <ul>
            <li v-for="(adv, i) in expert.advantages" :key="i">{{ adv }}</li>
          </ul>
        </section>

        <section v-if="expert.education">
          <h3>教育背景</h3>
          <p>{{ expert.education }}</p>
        </section>

        <section v-if="expert.qualifications || expert.qualDisplay">
          <h3>资质认证</h3>
          <p>{{ expert.qualDisplay || expert.qualifications }}</p>
        </section>

        <section v-if="expert.courses">
          <h3>主讲课程</h3>
          <p>{{ expert.courses }}</p>
        </section>

        <section v-if="expert.advDisplay">
          <h3>优势展示</h3>
          <p>{{ expert.advDisplay }}</p>
        </section>

        <!-- Contact Info -->
        <section v-if="expert.contactPerson || expert.contactInfo" class="contact-section">
          <h3>联系方式</h3>
          <p v-if="expert.contactPerson">联系人: {{ expert.contactPerson }}</p>
          <p v-if="expert.contactInfo">{{ contactLabel }}: {{ expert.contactInfo }}</p>
        </section>

        <!-- Cooperation Projects -->
        <section v-if="cooperationProjects.length">
          <h3>合作项目</h3>
          <div v-for="project in cooperationProjects" :key="project.id" class="project-item">
            <span class="project-year">{{ project.year }}{{ project.month ? '.' + project.month : '' }}</span>
            <span class="project-title">{{ project.title }}</span>
            <span v-if="project.satisfaction" class="project-satisfaction">满意度: {{ project.satisfaction }}</span>
          </div>
        </section>
      </div>

      <!-- Footer -->
      <div class="detail-footer">
        <span v-if="expert.referrer" class="referrer">推荐人: {{ expert.referrer }}</span>
        <span class="created-by">维护人: {{ expert.createdBy }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/store/appStore'
import type { Expert } from '@/types'
import ScoreBar from '@/components/ScoreBar.vue'

const props = defineProps<{
  expert: Expert
}>()

defineEmits<{
  close: []
}>()

const store = useAppStore()

const cooperationProjects = computed(() =>
  store.yiliProjects.filter(p => p.expertId === props.expert.id)
)

const contactLabel = computed(() => {
  switch (props.expert.contactType) {
    case 'wechat': return '微信'
    case 'email': return '邮箱'
    default: return '电话'
  }
})

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
</script>
