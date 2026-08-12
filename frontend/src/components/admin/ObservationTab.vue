<template>
  <section class="admin-tab">
    <div class="admin-toolbar">
      <h3>观察库</h3>
      <select v-model="selectedExpertId" @change="loadOperations">
        <option value="">全部专家</option>
        <option v-for="expert in store.experts" :key="expert.id" :value="expert.id">{{ expert.name }}</option>
      </select>
    </div>

    <table class="admin-table">
      <thead>
        <tr>
          <th>时间</th>
          <th>专家</th>
          <th>操作</th>
          <th>操作人</th>
          <th>备注</th>
          <th>标签</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in operations" :key="item.id">
          <td>{{ formatDate(item.createdAt) }}</td>
          <td>{{ item.expertName || expertName(item.expertId) || '-' }}</td>
          <td>{{ item.operation }}</td>
          <td>{{ item.operatorName || item.operatorId }}</td>
          <td>{{ item.note || '-' }}</td>
          <td>{{ item.tags?.join('、') || '-' }}</td>
        </tr>
        <tr v-if="operations.length === 0 && !loading">
          <td colspan="6" class="empty">暂无观察记录</td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading">加载中...</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { observationApi } from '@/api/observation'
import { useAppStore } from '@/store/appStore'
import type { ObservationOperation } from '@/types'

const store = useAppStore()
const selectedExpertId = ref<number | ''>('')
const operations = ref<ObservationOperation[]>([])
const loading = ref(false)

function expertName(id: number | null) {
  return id ? store.experts.find(expert => expert.id === id)?.name : ''
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString() : '-'
}

async function loadOperations() {
  loading.value = true
  try {
    operations.value = await observationApi.findByExpertId(selectedExpertId.value || undefined)
  } finally {
    loading.value = false
  }
}

onMounted(loadOperations)
</script>

<style scoped>
.admin-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.admin-toolbar select { min-width: 220px; padding: 8px; }
.admin-table { width: 100%; border-collapse: collapse; }
th, td { padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: left; vertical-align: top; }
.empty { text-align: center; color: #888; }
</style>
