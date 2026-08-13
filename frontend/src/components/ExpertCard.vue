<template>
  <div class="expert-card" @click="$emit('click')">
    <!-- Card Header -->
    <div class="card-header">
      <div class="card-avatar">{{ surname }}</div>
      <div class="card-header-info">
        <div class="card-name-row">
          <div class="card-name" v-html="highlightText(cardDisplayName)"></div>
          <span
            class="card-fav-star"
            :class="{ active: isFavorite }"
            :title="isFavorite ? '取消收藏' : '收藏专家'"
            @click.stop="toggleFav"
          >
            {{ isFavorite ? '♥' : '♡' }}
          </span>
        </div>
        <div class="card-fields-row">
          <span
            v-for="field in expert.fields"
            :key="field"
            class="card-field-tag"
            :style="fieldStyle(field)"
            v-html="highlightText(displayFieldName(field))"
          ></span>
        </div>
      </div>
      <div v-if="store.showScores && expert.scores?.overall != null" class="card-score-box">
        <span class="card-score-main">
          <span class="score-star">★</span> {{ expert.scores.overall.toFixed(1) }}
        </span>
        <div class="card-score-subs">
          <span class="card-score-sub">
            专业 {{ expert.scores.professional?.toFixed(1) }}<span class="score-star">★</span>
          </span>
          <span class="card-score-divider">·</span>
          <span class="card-score-sub">
            影响 {{ expert.scores.influence?.toFixed(1) }}<span class="score-star">★</span>
          </span>
        </div>
      </div>
    </div>

    <!-- Qual Highlights -->
    <div v-if="qualItems.length > 0" class="card-qual-highlights">
      <div v-for="(q, i) in qualItems" :key="i" class="card-qual-line">
        <span class="card-qual-bullet">▸</span>
        <span class="card-qual-text" v-html="highlightText(q)"></span>
      </div>
    </div>

    <!-- Yili Projects -->
    <div v-if="latestProject" class="card-yili-project">
      <template v-if="visibleProjects.length === 1">
        <div class="proj-count-line">📋 最近合作：{{ latestProject.title }}</div>
        <div class="proj-detail-line">{{ projectMeta(latestProject) }}</div>
        <div v-if="satisfactionHasValue(latestProject.satisfaction)" class="proj-detail-line">
          <span style="color:#eab308;letter-spacing:1px">{{ satisfactionStars(latestProject.satisfaction) }}</span>
          <span style="color:#166534;margin-left:6px;font-size:11px">{{ satisfactionDisplay(latestProject.satisfaction) }}/10</span>
        </div>
      </template>
      <template v-else>
        <div class="proj-count-line">📋 已合作 {{ visibleProjects.length }} 次</div>
        <div class="proj-detail-line" style="font-weight:600">最近合作：{{ latestProject.title }}</div>
        <div class="proj-detail-line">{{ projectMeta(latestProject) }}</div>
        <div v-if="satisfactionHasValue(latestProject.satisfaction)" class="proj-detail-line">
          <span style="color:#eab308;letter-spacing:1px">{{ satisfactionStars(latestProject.satisfaction) }}</span>
          <span style="color:#166534;margin-left:6px;font-size:11px">{{ satisfactionDisplay(latestProject.satisfaction) }}/10</span>
        </div>
      </template>
    </div>

    <!-- Advantages -->
    <div v-if="advItems.length > 0" class="card-advantages-new">
      <div v-for="(item, idx) in advItems" :key="idx" class="card-advantage-title-item">
        <span class="card-adv-num">{{ idx + 1 }}</span>
        <span v-if="item.includes('：')">
          <span class="card-adv-title-bold">{{ item.split('：')[0] }}：</span>
          <span>{{ item.split('：').slice(1).join('：') }}</span>
        </span>
        <span v-else class="card-adv-title-bold">{{ item }}</span>
      </div>
    </div>

    <!-- Education -->
    <div v-if="expert.education && expert.education !== '未公开'" class="card-edu card-edu-bottom">
      🎓 {{ truncatedEducation }}
    </div>

    <!-- Contact (V5: 卡片只显示第一位联系人) -->
    <div v-if="contacts.length > 0 && (contacts[0].person || contacts[0].info)" class="card-contact">
      <span v-if="contacts[0].person">👤 {{ contacts[0].person }}</span>
      <span v-if="contacts[0].info">
        <span>{{ typeIcon(contacts[0].type) }}</span>
        <span>{{ displayContactInfo(contacts[0].info) }}</span>
      </span>
    </div>

    <!-- Supplier bookmark -->
    <div v-if="expert.isSupplier" class="card-supplier-bookmark">库内供应商</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/store/appStore'
import type { Expert, Project, ContactInfo } from '@/types'
import { isNarrowScreen } from '@/utils/helpers'
import { satisfactionDisplay, satisfactionStars, satisfactionHasValue } from '@/utils/satisfaction'

const props = defineProps<{
  expert: Expert
  searchQuery?: string
}>()

const emit = defineEmits<{
  click: []
}>()

const store = useAppStore()

const searchQuery = computed(() => props.searchQuery || '')

const surname = computed(() => props.expert.name.charAt(0))

const cardDisplayName = computed(() => {
  const name = props.expert.name
  if (name.length <= 6) return name
  if (window.innerWidth <= 480) return name.slice(0, 4) + '…'
  return name
})

const isFavorite = computed(() => store.isFavorited(props.expert.id))

function toggleFav(e: MouseEvent) {
  e.stopPropagation()
  store.toggleFavorite(props.expert.id)
}

function fieldStyle(fieldName: string) {
  const field = store.fields.find(f => f.name === fieldName)
  if (field) {
    return {
      background: field.color,
      color: field.textColor || '#ffffff'
    }
  }
  return { background: '#64748b', color: '#ffffff' }
}

function displayFieldName(name: string) {
  if (isNarrowScreen() && name.length > 4) {
    return name.slice(0, 2) + '…'
  }
  return name
}

function highlightText(text: string) {
  const q = searchQuery.value.trim()
  if (!q) return text
  const regex = new RegExp('(' + escapeRegExp(q) + ')', 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const visibleProjects = computed(() => {
  return store.yiliProjects
    .filter(p => p.expertId === props.expert.id && p.visible)
    .sort((a, b) => b.year - a.year || (b.month || 0) - (a.month || 0))
})

const latestProject = computed(() => visibleProjects.value[0] as Project | undefined)

function projectMeta(p: Project) {
  let s = p.year + '年'
  if (p.month) s += (p.month < 10 ? '0' : '') + p.month + '月'
  return s
}

// V5 卡片资历高亮：优先 qualDisplay，fallback 解析 qualifications
const qualItems = computed(() => {
  const raw = String(props.expert.qualDisplay || props.expert.qualifications || '').trim()
  if (!raw) return []
  let items: string[] = []
  if (raw.includes('\n')) {
    items = raw.split('\n').map(s => s.trim()).filter(Boolean)
  } else if (raw.includes('■')) {
    items = raw.split('■').map(s => s.trim()).filter(Boolean)
    items = items.map(it => {
      const m = it.match(/】\s*(.+)/)
      return m ? m[1].trim() : it
    })
  } else {
    items = raw.split(/[;；]/).map(s => s.trim()).filter(Boolean)
  }
  return items.slice(0, 3)
})

// V5 卡片优势：优先 advDisplay，fallback 解析 advantages
const advItems = computed(() => {
  const raw = String(props.expert.advDisplay || '').trim()
  if (raw) {
    return raw.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 4)
      .map(item => item.replace(/^\d+[、，．.\s]*/, ''))
  }
  if (!props.expert.advantages?.length) return []
  return props.expert.advantages.slice(0, 3).map(a => {
    if (typeof a === 'string') return a.replace(/^\d+[、，．.\s]*/, '')
    const title = (a as any).title || ''
    const desc = (a as any).desc || ''
    return title && desc ? `${title}：${desc}` : (desc || title)
  })
})

const truncatedEducation = computed(() => {
  const edu = props.expert.education || ''
  return edu.length > 50 ? edu.substring(0, 50) + '...' : edu
})

const contacts = computed(() => {
  const list: ContactInfo[] = (props.expert.contacts || []).map(c => ({
    ...c,
    value: c.value || c.info || '',
    info: c.info || c.value || '',
  }))
  if (!list.length && props.expert.contactInfo) {
    list.push({
      type: props.expert.contactType || 'other',
      label: typeLabel(props.expert.contactType || 'other'),
      value: props.expert.contactInfo,
      info: props.expert.contactInfo,
      person: props.expert.contactPerson,
    })
  }
  return list
})

function typeLabel(type: string): string {
  switch (type) {
    case 'email': return '邮箱'
    case 'wechat': return '微信'
    case 'phone': return '电话'
    default: return '联系方式'
  }
}

function typeIcon(type: string): string {
  switch (type) {
    case 'email': return '📧'
    case 'wechat': return '💬'
    case 'phone':
    case 'mobile': return '📞'
    default: return '📞'
  }
}

function displayContactInfo(info: string): string {
  return info.length > 25 ? info.substring(0, 25) + '...' : info
}
</script>
