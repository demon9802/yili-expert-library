<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <span class="modal-title-group">
          <span class="modal-title">{{ expert.name }}</span>
          <span
            class="card-fav-star detail-fav-star"
            :class="{ active: isFav }"
            :title="isFav ? '取消收藏' : '收藏专家'"
            @click.stop="toggleFav"
          >{{ isFav ? '♥' : '♡' }}</span>
          <span v-if="expert.isSupplier" class="detail-supplier-ribbon">库内供应商</span>
        </span>
        <button class="modal-close" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <!-- 评分信息 -->
        <div v-if="expert.scores" class="detail-section">
          <div class="detail-section-title score-title-row">
            评分信息
            <button class="score-help-btn" type="button" title="评分规则说明（点击查看）" @click="openScoringHelp">?</button>
          </div>
          <div class="detail-score-row">
            <div class="detail-score-card">
              <div class="detail-score-card-val overall">
                <StarRating :score="expert.scores.overall || 0" :max="5" size="lg" />
                <span class="detail-score-num">{{ (expert.scores.overall || 0).toFixed(1) }}</span>
              </div>
              <div class="detail-score-card-label">综合评分</div>
            </div>
            <div class="detail-score-card">
              <div class="detail-score-card-val prof">
                <StarRating :score="expert.scores.professional || 0" :max="5" size="lg" />
                <span class="detail-score-num">{{ (expert.scores.professional || 0).toFixed(1) }}</span>
              </div>
              <div class="detail-score-card-label">专业度</div>
            </div>
            <div class="detail-score-card">
              <div class="detail-score-card-val infl">
                <StarRating :score="expert.scores.influence || 0" :max="5" size="lg" />
                <span class="detail-score-num">{{ (expert.scores.influence || 0).toFixed(1) }}</span>
              </div>
              <div class="detail-score-card-label">影响力</div>
            </div>
          </div>
        </div>

        <!-- 适用领域 -->
        <div class="detail-section">
          <div class="detail-section-title">适用领域</div>
          <div class="detail-field-tags">
            <span
              v-for="field in expert.fields"
              :key="field"
              class="card-field-tag"
              :style="getFieldStyle(field)"
            >{{ field }}</span>
          </div>
        </div>

        <!-- 学历 -->
        <div v-if="expert.education && expert.education !== '未公开'" class="detail-section">
          <div class="detail-section-title">学历</div>
          <div class="detail-text">{{ expert.education }}</div>
        </div>

        <!-- 专家简介 -->
        <div v-if="advantageItems.length > 0" class="detail-section">
          <div class="detail-section-title">专家简介</div>
          <div class="detail-advantages">
            <div v-for="(adv, i) in advantageItems" :key="i" class="detail-advantage-item">■ {{ adv }}</div>
          </div>
        </div>

        <!-- 资历资质 -->
        <div v-if="expert.qualifications && expert.qualifications !== '未公开'" class="detail-section">
          <div class="detail-section-title">资历资质</div>
          <div class="detail-text">{{ expert.qualifications }}</div>
        </div>

        <!-- 参考案例 -->
        <div v-if="expert.courses" class="detail-section">
          <div class="detail-section-title">参考案例</div>
          <div class="detail-text">{{ expert.courses }}</div>
        </div>

        <!-- 优势展示 -->
        <div v-if="expert.advDisplay" class="detail-section">
          <div class="detail-section-title">优势展示</div>
          <div class="detail-text">{{ expert.advDisplay }}</div>
        </div>

        <!-- 合作项目 -->
        <div v-if="cooperationProjects.length > 0" class="detail-section">
          <div class="detail-section-title">伊利合作项目（{{ cooperationProjects.length }}）</div>
          <div
            v-for="(proj, idx) in cooperationProjects"
            :key="proj.id"
            class="project-item"
            style="padding:12px 16px;margin-bottom:8px;background:linear-gradient(135deg, #f0fdf4, #dcfce7);border:1px solid #bbf7d0;border-radius:8px;font-size:14px;color:#166534"
          >
            <div style="font-weight:600;margin-bottom:4px">{{ proj.title }}</div>
            <div style="font-size:12px;color:#15803d">{{ proj.year }}年{{ proj.month ? proj.month + '月' : '' }}</div>
            <div v-if="proj.satisfaction" style="font-size:13px;color:#f59e0b">
              <span style="letter-spacing:2px">{{ satisfactionStars(proj.satisfaction) }}</span>
              <span style="color:#166534;margin-left:6px;font-size:12px">{{ satisfactionDisplay(proj.satisfaction) }}/10</span>
            </div>
            <div v-if="proj.desc" style="font-size:13px;color:#15803d;margin-top:4px;line-height:1.6">{{ proj.desc }}</div>
          </div>
        </div>

        <!-- 联系方式 -->
        <div v-if="expert.contactPerson || expert.contactInfo || expert.referrer" class="detail-section">
          <div class="detail-section-title">联系方式</div>
          <div v-if="expert.contactPerson || expert.contactInfo" class="detail-text detail-contact-line">
            联系人：{{ expert.contactPerson || '-' }} {{ contactLabel }}: {{ expert.contactInfo || '-' }}
          </div>
          <div v-if="expert.referrer" class="detail-text detail-contact-line">
            推荐人：{{ expert.referrer }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/store/appStore'
import type { Expert } from '@/types'
import StarRating from '@/components/StarRating.vue'

const props = defineProps<{
  expert: Expert
}>()

defineEmits<{
  close: []
}>()

const store = useAppStore()

const isFav = computed(() => store.favorites.includes(props.expert.id))

const advantageItems = computed(() => {
  const raw = props.expert.advantages
  if (!raw || !raw.length) return []
  return raw.map((a: any) => {
    if (typeof a === 'string') return a
    if (a.title && a.desc) return a.title + '：' + a.desc
    return a.title || a.desc || String(a)
  })
})

const cooperationProjects = computed(() =>
  store.yiliProjects
    .filter(p => p.expertId === props.expert.id && p.visible !== false)
    .sort((a, b) => b.year - a.year || (b.month || 0) - (a.month || 0))
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
      padding: '6px 14px',
      fontSize: '13px'
    }
  }
  return {}
}

async function toggleFav() {
  await store.toggleFavorite(props.expert.id)
}

function satisfactionStars(s: any): string {
  const val = typeof s === 'object' ? (s.value || 0) : (Number(s) || 0)
  const rounded = Math.round(val)
  let stars = ''
  for (let i = 0; i < 5; i++) {
    stars += i < rounded ? '★' : '☆'
  }
  return stars
}

function satisfactionDisplay(s: any): string {
  const val = typeof s === 'object' ? (s.value || 0) : (Number(s) || 0)
  return val.toFixed(1)
}

function openScoringHelp() {
  // TODO: 打开评分规则说明弹窗或文档
  alert('评分规则说明：信息缺失统一记为 2★，子维度封顶 5★，综合评分 = 专业度 60% + 影响力 40%。')
}
</script>
