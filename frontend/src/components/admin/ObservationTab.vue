<template>
  <section class="admin-tab observation-tab">
    <div class="tab-header">
      <h3>观察库</h3>
    </div>
    <p class="tab-desc">综合评分 3.5★ 以下或不适合在前端展示的专家。可在此持续评估、淘汰或恢复。</p>

    <div v-if="obsExperts.length === 0" class="empty-box">
      观察库为空
    </div>

    <div
      v-for="expert in obsExperts"
      :key="expert.id"
      class="obs-card"
      :class="{ eliminated: expert.observationStatus === 'eliminated' }"
    >
      <div class="obs-head">
        <div class="obs-title">
          <strong>{{ expert.name }}</strong>
          <span class="obs-score">综合评分：{{ expert.scores?.overall != null ? expert.scores.overall.toFixed(1) : '-' }}</span>
        </div>
        <div class="obs-actions">
          <select v-model="expert.observationStatus" class="status-select" @change="onStatusChange(expert)">
            <option value="evaluating">持续评估</option>
            <option value="eliminated">淘汰</option>
          </select>
          <button class="btn btn-danger btn-sm" @click="remove(expert)">删除</button>
        </div>
      </div>

      <div class="obs-meta">
        专业度：{{ expert.scores?.professional != null ? expert.scores.professional.toFixed(1) : '-' }}
        ｜ 影响力：{{ expert.scores?.influence != null ? expert.scores.influence.toFixed(1) : '-' }}
        <span v-if="expert.observationDate">｜ 录入日期：{{ formatDate(expert.observationDate) }}</span>
        <span v-if="expert.observationStatus === 'eliminated'" class="elim-tag">｜ ⚠️ 状态：已淘汰</span>
        <span v-else class="eval-tag">｜ 状态：持续评估</span>
      </div>

      <div v-if="isOverOneYear(expert)" class="year-warning">
        ⏰ 该专家已淘汰超过一年，建议确认是否永久删除。
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { expertApi } from '@/api/expert'
import { useAppStore } from '@/store/appStore'
import type { Expert } from '@/types'

const store = useAppStore()

const obsExperts = computed(() =>
  store.experts
    .filter(e => e.status === 'observation' || e.status === 'eliminated' || e.observationStatus)
    .sort((a, b) => {
      // 已淘汰放最后；其余按观察日期倒序
      if (a.observationStatus === 'eliminated' && b.observationStatus !== 'eliminated') return 1
      if (a.observationStatus !== 'eliminated' && b.observationStatus === 'eliminated') return -1
      return new Date(b.observationDate || 0).getTime() - new Date(a.observationDate || 0).getTime()
    })
)

function formatDate(value: string) {
  if (!value) return '-'
  const d = new Date(value)
  return isNaN(d.getTime()) ? value : d.toLocaleDateString('zh-CN')
}

function isOverOneYear(expert: Expert): boolean {
  if (expert.observationStatus !== 'eliminated' || !expert.observationDate) return false
  const date = new Date(expert.observationDate)
  if (isNaN(date.getTime())) return false
  const oneYear = new Date(date)
  oneYear.setFullYear(oneYear.getFullYear() + 1)
  return new Date() >= oneYear
}

async function onStatusChange(expert: Expert) {
  const payload: Partial<Expert> = {
    observationStatus: expert.observationStatus,
  }
  if (expert.observationStatus === 'eliminated') {
    payload.status = 'eliminated'
    payload.observationDate = new Date().toISOString()
  } else {
    // 持续评估 = 恢复展示
    payload.status = 'observation'
  }
  const updated = await expertApi.update(expert.id, payload)
  syncExpert(updated)
}

async function remove(expert: Expert) {
  if (!confirm(`确认永久删除 ${expert.name}？此操作不可恢复。`)) return
  await expertApi.delete(expert.id)
  store.experts = store.experts.filter(e => e.id !== expert.id)
}

function syncExpert(updated: Expert) {
  const idx = store.experts.findIndex(e => e.id === updated.id)
  if (idx >= 0) store.experts[idx] = updated
}
</script>

<style scoped>
.tab-header { margin-bottom: 4px; }
.tab-header h3 { font-size: 18px; font-weight: 600; margin: 0; }
.tab-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; }

.empty-box {
  padding: 40px;
  text-align: center;
  color: var(--text-muted);
  background: var(--bg);
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  font-size: 14px;
}

.obs-card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 16px;
  margin-bottom: 12px;
}
.obs-card.eliminated {
  background: #fef2f2;
  border-color: #fecaca;
}

.obs-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 8px;
}
.obs-title {
  display: flex;
  align-items: center;
  gap: 12px;
}
.obs-title strong { font-size: 15px; }
.obs-score {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--surface);
  padding: 2px 8px;
  border-radius: 12px;
  border: 1px solid var(--border);
}

.obs-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.status-select {
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 12px;
  background: #fff;
}
.btn {
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
}
.btn-danger { background: #fef2f2; color: #dc2626; border-color: #fecaca; }

.obs-meta {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
.elim-tag { color: #dc2626; font-weight: 600; }
.eval-tag { color: #d97706; }

.year-warning {
  margin-top: 8px;
  padding: 8px 12px;
  background: #fff1f2;
  border-radius: 6px;
  font-size: 12px;
  color: #be123c;
}
</style>
