<template>
  <section class="admin-tab">
    <div class="admin-toolbar">
      <input v-model="store.adminSearchQuery" type="search" placeholder="搜索专家姓名、领域、优势" class="search-input" />
      <button class="btn primary" @click="openCreate">新增专家</button>
    </div>

    <table class="admin-table">
      <thead>
        <tr>
          <th>姓名</th>
          <th>领域</th>
          <th>状态</th>
          <th>评分</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="expert in filteredExperts" :key="expert.id">
          <td>{{ expert.name }}</td>
          <td>{{ expert.fields?.join('、') }}</td>
          <td>{{ expert.status || '-' }}</td>
          <td>{{ expert.scores?.overall ?? '-' }}</td>
          <td>
            <button class="btn" @click="openEdit(expert)">编辑</button>
            <button class="btn danger" @click="removeExpert(expert)">删除</button>
          </td>
        </tr>
        <tr v-if="filteredExperts.length === 0">
          <td colspan="5" class="empty">暂无专家</td>
        </tr>
      </tbody>
    </table>

    <div v-if="showModal" class="modal-mask">
      <form class="modal-card" @submit.prevent="submitForm">
        <h3>{{ form.id ? '编辑专家' : '新增专家' }}</h3>

        <label>姓名<input v-model.trim="form.name" required /></label>
        <label>领域</label>
        <div class="checkbox-list">
          <label v-for="field in store.fields" :key="field.name">
            <input v-model="form.fields" type="checkbox" :value="field.name" /> {{ field.name }}
          </label>
        </div>
        <label>优势（每行一项）<textarea v-model="advantagesText" rows="4" /></label>
        <label>教育背景<textarea v-model="form.education" rows="3" /></label>
        <label>资质<textarea v-model="form.qualifications" rows="3" /></label>
        <label>课程<textarea v-model="form.courses" rows="3" /></label>
        <label>联系人<input v-model="form.contactPerson" /></label>
        <label>联系方式<input v-model="form.contactInfo" /></label>
        <label>联系类型<input v-model="form.contactType" /></label>
        <label>推荐人<input v-model="form.referrer" /></label>
        <label class="inline"><input v-model="form.isSupplier" type="checkbox" /> 供应商</label>

        <div class="modal-actions">
          <button class="btn primary" type="submit">保存</button>
          <button class="btn" type="button" @click="closeModal">取消</button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useAppStore } from '@/store/appStore'
import type { Expert } from '@/types'

const store = useAppStore()
const showModal = ref(false)
const advantagesText = ref('')

const emptyForm = (): Partial<Expert> => ({
  name: '',
  fields: [],
  advantages: [],
  education: '',
  qualifications: '',
  courses: '',
  contactPerson: '',
  contactInfo: '',
  contactType: '',
  referrer: '',
  isSupplier: false,
  status: 'active',
  scores: { professional: null, influence: null, overall: null },
})

const form = reactive<Partial<Expert>>(emptyForm())

const filteredExperts = computed(() => {
  const query = store.adminSearchQuery.trim().toLowerCase()
  if (!query) return store.experts
  return store.experts.filter(expert =>
    expert.name?.toLowerCase().includes(query) ||
    expert.fields?.some(field => field.toLowerCase().includes(query)) ||
    expert.advantages?.some(item => item.toLowerCase().includes(query))
  )
})

function resetForm(data: Partial<Expert> = emptyForm()) {
  Object.assign(form, emptyForm(), data, { fields: [...(data.fields || [])] })
  advantagesText.value = (data.advantages || []).join('\n')
}

function openCreate() {
  resetForm()
  showModal.value = true
}

function openEdit(expert: Expert) {
  resetForm(expert)
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

async function submitForm() {
  form.advantages = advantagesText.value.split('\n').map(item => item.trim()).filter(Boolean)
  await store.saveExpert({ ...form })
  closeModal()
}

async function removeExpert(expert: Expert) {
  if (window.confirm(`确定删除专家「${expert.name}」吗？`)) {
    await store.deleteExpert(expert.id)
  }
}
</script>

<style scoped>
.admin-toolbar { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.search-input { flex: 1; max-width: 360px; }
.admin-table { width: 100%; border-collapse: collapse; }
th, td { padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: left; }
.empty { text-align: center; color: #888; }
.btn { margin-right: 8px; padding: 6px 12px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; }
.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.danger { color: #dc2626; }
.modal-mask { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; background: rgb(0 0 0 / 35%); }
.modal-card { width: min(720px, 92vw); max-height: 88vh; overflow: auto; padding: 20px; border-radius: 8px; background: #fff; }
.modal-card label { display: block; margin: 10px 0; }
.modal-card input:not([type='checkbox']), .modal-card textarea { width: 100%; box-sizing: border-box; margin-top: 4px; padding: 8px; }
.checkbox-list { display: flex; flex-wrap: wrap; gap: 8px 16px; }
.inline { display: flex !important; align-items: center; gap: 6px; }
.modal-actions { margin-top: 16px; text-align: right; }
</style>
