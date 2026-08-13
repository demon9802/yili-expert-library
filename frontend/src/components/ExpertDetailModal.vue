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
        <div v-if="store.showScores && expert.scores" class="detail-section">
          <div class="detail-section-title score-title-row">
            评分信息
            <button class="score-help-btn" type="button" title="评分规则说明（点击查看）" @click="showHelp = true">?</button>
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

          <!-- 子维度评分 -->
          <div v-if="hasSubScores && subScores" class="detail-score-sub-area">
            <div v-if="subScores.professional" class="detail-score-sub-block">
              <div class="detail-score-sub-title prof">专业度 · 细分标准</div>
              <div class="score-bar-list">
                <div v-for="(val, label) in subScores.professional" :key="label" class="score-bar-item">
                  <div class="score-bar-info">
                    <span class="score-bar-label">{{ label }}</span>
                    <span class="score-bar-value blue">{{ (val || 0).toFixed(1) }}★</span>
                  </div>
                  <div class="score-bar-track">
                    <div class="score-bar-fill blue" :style="{ width: Math.min(100, ((val || 0) / 5) * 100) + '%' }"></div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="subScores.influence" class="detail-score-sub-block">
              <div class="detail-score-sub-title infl">影响力 · 细分标准</div>
              <div class="score-bar-list">
                <div v-for="(val, label) in subScores.influence" :key="label" class="score-bar-item">
                  <div class="score-bar-info">
                    <span class="score-bar-label">{{ label }}</span>
                    <span class="score-bar-value amber">{{ (val || 0).toFixed(1) }}★</span>
                  </div>
                  <div class="score-bar-track">
                    <div class="score-bar-fill amber" :style="{ width: Math.min(100, ((val || 0) / 5) * 100) + '%' }"></div>
                  </div>
                </div>
              </div>
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

        <!-- 资历资质（优先使用结构化 qualDisplay，fallback 到 qualifications） -->
        <div v-if="qualDisplayText" class="detail-section">
          <div class="detail-section-title">资历资质</div>
          <div class="detail-text" v-html="formatRichText(qualDisplayText)"></div>
        </div>

        <!-- 参考案例 -->
        <div v-if="expert.courses" class="detail-section">
          <div class="detail-section-title">参考案例</div>
          <div class="detail-text" v-html="formatRichText(expert.courses)"></div>
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
            <div v-if="satisfactionValue(proj.satisfaction) != null" style="font-size:13px;color:#f59e0b">
              <span style="letter-spacing:2px">{{ satisfactionStars(proj.satisfaction) }}</span>
              <span style="color:#166534;margin-left:6px;font-size:12px">{{ satisfactionDisplay(proj.satisfaction) }}/10</span>
            </div>
            <div v-if="proj.desc" style="font-size:13px;color:#15803d;margin-top:4px;line-height:1.6">{{ proj.desc }}</div>
          </div>
        </div>

        <!-- 联系方式 (V5: 多联系人依次显示为纯文本行) -->
        <div v-if="contacts.length > 0 || expert.referrer" class="detail-section">
          <div class="detail-section-title">联系方式</div>
          <div
            v-for="(c, idx) in contacts"
            :key="idx"
            class="detail-text"
            :style="{ marginBottom: contacts.length > 1 ? '6px' : '0' }"
          >
            {{ contacts.length === 1 ? '联系人' : ('联系人' + (idx + 1)) }}：{{ c.person || '' }}<span v-if="c.info">，{{ typeLabel(c.type) }}：{{ c.info }}</span>
          </div>
          <div v-if="expert.referrer" class="detail-text" style="margin-top: 8px;">
            内部推荐人：{{ expert.referrer }}
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 评分规则弹窗 -->
  <ScoringHelpModal v-if="showHelp" @close="showHelp = false" />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppStore } from '@/store/appStore'
import type { Expert, ContactInfo, SubScores } from '@/types'
import { formatRichText, copyText } from '@/utils/helpers'
import StarRating from '@/components/StarRating.vue'
import ScoringHelpModal from '@/components/ScoringHelpModal.vue'

const props = defineProps<{
  expert: Expert
}>()

defineEmits<{
  close: []
}>()

const store = useAppStore()
const showHelp = ref(false)

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

const qualDisplayText = computed(() => {
  // 对齐 V5：资历资质读取 qualifications 字段（旧数据/迁移数据均以此为准）
  const q = (props.expert.qualifications || '').trim()
  return q && q !== '未公开' ? q : ''
})

const subScores = computed(() => {
  const raw: SubScores | null | undefined = props.expert.subScores
    || (props.expert.scores as any)?.subScores
  if (!raw) return null
  return {
    professional: raw.professional || null,
    influence: raw.influence || null,
  }
})

const hasSubScores = computed(() => {
  return subScores.value && (subScores.value.professional || subScores.value.influence)
})

const cooperationProjects = computed(() =>
  store.yiliProjects
    .filter(p => p.expertId === props.expert.id && p.visible !== false)
    .sort((a, b) => b.year - a.year || (b.month || 0) - (a.month || 0))
)

const contacts = computed(() => {
  const list: ContactInfo[] = (props.expert.contacts || []).map(c => ({
    ...c,
    value: c.value || c.info || '',
    info: c.info || c.value || '',
  }))
  if (!list.length && props.expert.contactInfo) {
    list.push({
      type: props.expert.contactType || 'phone',
      label: typeLabel(props.expert.contactType || 'phone'),
      value: props.expert.contactInfo,
      info: props.expert.contactInfo,
      person: props.expert.contactPerson,
    } as ContactInfo)
  }
  return list
})

function typeLabel(type?: string): string {
  switch (type) {
    case 'email': return '邮箱'
    case 'wechat': return '微信'
    case 'phone':
    case 'mobile': return '电话'
    default: return '联系方式'
  }
}

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

function satisfactionValue(s: any): number | null {
  if (s == null) return null
  const v = typeof s === 'object' ? (s.value ?? s.raw) : s
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

function satisfactionStars(s: any): string {
  const val = satisfactionValue(s)
  if (val == null) return ''
  const full = Math.round(val / 2)
  return '★'.repeat(full) + '☆'.repeat(5 - full)
}

function satisfactionDisplay(s: any): string {
  const val = satisfactionValue(s)
  return val != null ? val.toFixed(1) : ''
}

function copyContact(info?: string) {
  if (!info) return
  copyText(info).then(() => {
    alert('已复制：' + info)
  }).catch(() => {
    alert('复制失败')
  })
}

function callPhone(info?: string) {
  if (!info) return
  const num = info.replace(/[^0-9\-]/g, '').replace(/-/g, '')
  window.location.href = 'tel:' + num
}

function sendEmail(info?: string) {
  if (!info) return
  window.location.href = 'mailto:' + info
}
</script>

<style scoped>
.detail-contact-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-bottom: 6px;
}
.contact-person {
  font-weight: 600;
}
.contact-info {
  color: var(--text-secondary);
}
.contact-type-label {
  color: var(--text-secondary);
}
.contact-actions {
  display: inline-flex;
  gap: 6px;
  margin-left: auto;
}
.contact-action-btn {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s;
}
.contact-action-btn:hover {
  background: var(--primary-light);
  border-color: var(--primary);
  color: var(--primary);
}
.detail-referrer {
  margin-top: 8px;
}
</style>
