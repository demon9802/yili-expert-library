<template>
  <section class="admin-tab">
    <div class="admin-toolbar">
      <h3>评分管理</h3>
    </div>

    <table class="admin-table">
      <thead>
        <tr>
          <th>专家</th>
          <th>专业度</th>
          <th>影响力</th>
          <th>综合评分</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="expert in store.experts" :key="expert.id">
          <td>{{ expert.name }}</td>
          <td>{{ expert.scores?.professional ?? '-' }}</td>
          <td>{{ expert.scores?.influence ?? '-' }}</td>
          <td>{{ expert.scores?.overall ?? '-' }}</td>
          <td><button class="btn" @click="openEdit(expert)">编辑评分</button></td>
        </tr>
      </tbody>
    </table>

    <div v-if="editing" class="modal-mask">
      <form class="modal-card" @submit.prevent="saveScores">
        <h3>编辑评分 - {{ editing.name }}</h3>
        <label>专业度<input v-model.number="scores.professional" type="number" min="0" max="100" /></label>
        <label>影响力<input v-model.number="scores.influence" type="number" min="0" max="100" /></label>
        <label>综合评分<input v-model.number="scores.overall" type="number" min="0" max="100" /></label>
        <div class="modal-actions">
          <button class="btn primary" type="submit">保存</button>
          <button class="btn" type="button" @click="editing = null">取消</button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { expertApi } from '@/api/expert'
import { useAppStore } from '@/store/appStore'
import type { Expert, Scores } from '@/types'

const store = useAppStore()
const editing = ref<Expert | null>(null)
const scores = reactive<Scores>({ professional: null, influence: null, overall: null })

function openEdit(expert: Expert) {
  editing.value = expert
  Object.assign(scores, expert.scores || { professional: null, influence: null, overall: null })
}

async function saveScores() {
  if (!editing.value) return
  const updated = await expertApi.update(editing.value.id, { scores: { ...scores } })
  const index = store.experts.findIndex(expert => expert.id === updated.id)
  if (index >= 0) store.experts[index] = updated
  editing.value = null
}
</script>

<style scoped>
.admin-toolbar { margin-bottom: 16px; }
.admin-table { width: 100%; border-collapse: collapse; }
th, td { padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: left; }
.btn { margin-right: 8px; padding: 6px 12px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; }
.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.modal-mask { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; background: rgb(0 0 0 / 35%); }
.modal-card { width: min(420px, 92vw); padding: 20px; border-radius: 8px; background: #fff; }
.modal-card label { display: block; margin: 10px 0; }
.modal-card input { width: 100%; box-sizing: border-box; margin-top: 4px; padding: 8px; }
.modal-actions { margin-top: 16px; text-align: right; }
</style>
