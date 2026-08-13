<template>
  <section class="admin-tab">
    <!-- Toolbar -->
    <div class="admin-toolbar">
      <input
        v-model="store.adminSearchQuery"
        type="search"
        placeholder="搜索专家姓名..."
        class="search-input"
      />
      <button class="btn primary" @click="openCreate">+ 新增专家</button>
      <button class="btn secondary" @click="exportExperts">📥 导出</button>
      <button class="btn secondary" @click="triggerImport">📤 导入</button>
      <input
        ref="importFileInput"
        type="file"
        accept="application/json,.json"
        style="display: none"
        @change="onImportFile"
      />
    </div>

    <!-- Filter row -->
    <div class="admin-filter-row">
      <span class="filter-label">领域：</span>
      <select v-model="filterField" class="filter-select">
        <option value="">全部领域</option>
        <option v-for="f in store.fields" :key="f.name" :value="f.name">{{ f.name }}</option>
      </select>

      <span class="filter-label">评分：</span>
      <select v-model="filterScore" class="filter-select">
        <option value="">全部评分</option>
        <option value="4.5">4.5★及以上</option>
        <option value="4.0">4.0★及以上</option>
        <option value="3.5">3.5★及以上</option>
        <option value="3.0">3.0★及以上</option>
      </select>

      <span class="filter-label">状态：</span>
      <select v-model="filterStatus" class="filter-select">
        <option value="">全部状态</option>
        <option value="active">正常</option>
        <option value="observation">观察中</option>
        <option value="eliminated">已淘汰</option>
      </select>

      <button class="btn clear-btn" @click="clearFilters">清除筛选</button>
    </div>

    <!-- Table -->
    <div class="table-scroll-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>姓名</th>
            <th>适用领域</th>
            <th>学历</th>
            <th>核心优势</th>
            <th>专业度</th>
            <th>影响力</th>
            <th>综合评分</th>
            <th>联系人</th>
            <th>联系方式</th>
            <th>状态</th>
            <th>录入时间</th>
            <th>录入者</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in filteredExperts" :key="e.id">
            <td class="cell-name">{{ e.name }}</td>
            <td :title="(e.fields || []).join('、')">{{ (e.fields || []).join('、') || '-' }}</td>
            <td :title="e.education || ''" class="cell-clamp">{{ e.education || '-' }}</td>
            <td :title="advText(e)" class="cell-clamp">{{ advText(e) }}</td>
            <td>{{ e.scores?.professional ?? '-' }}</td>
            <td>{{ e.scores?.influence ?? '-' }}</td>
            <td
              class="cell-overall"
              :style="{ color: overallColor(e.scores?.overall), fontWeight: '700' }"
            >
              {{ e.scores?.overall != null ? e.scores.overall.toFixed(1) : '-' }}
            </td>
            <td>{{ firstContact(e).person || '-' }}</td>
            <td :title="contactTitle(e)" class="cell-clamp">
              {{ contactDisplay(e) }}
            </td>
            <td :style="{ color: statusInfo(e).color, fontWeight: '600' }">
              {{ statusInfo(e).label }}
            </td>
            <td class="cell-date">{{ e.createdAt ? formatDate(e.createdAt).slice(0, 10) : '-' }}</td>
            <td class="cell-date">{{ e.createdBy || '主管理员' }}</td>
            <td class="actions">
              <button class="btn btn-secondary btn-sm" @click="openEdit(e)">编辑</button>
              <button class="btn btn-danger btn-sm" @click="removeExpert(e)">删除</button>
            </td>
          </tr>
          <tr v-if="filteredExperts.length === 0">
            <td colspan="13" class="empty">暂无专家</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="record-count">共 {{ filteredExperts.length }} 条记录</div>

    <!-- Create / Edit Modal -->
    <div v-if="showModal" class="modal-mask" @click.self="closeModal">
      <form class="modal-card" @submit.prevent="submitForm">
        <h3>{{ form.id ? '编辑专家' : '新增专家' }}</h3>

        <label>姓名<input v-model.trim="form.name" required /></label>
        <label>适用领域</label>
        <div class="checkbox-list">
          <label v-for="field in store.fields" :key="field.name" class="inline-check">
            <input v-model="form.fields" type="checkbox" :value="field.name" /> {{ field.name }}
          </label>
        </div>
        <label>学历<textarea v-model="form.education" rows="2" /></label>
        <label>核心优势（每行一项）<textarea v-model="advantagesText" rows="4" /></label>
        <label>资质<textarea v-model="form.qualifications" rows="2" /></label>
        <label>课程<textarea v-model="form.courses" rows="2" /></label>

        <div class="form-row">
          <label>专业度（0-5）<input v-model.number="form.scores.professional" type="number" step="0.1" min="0" max="5" /></label>
          <label>影响力（0-5）<input v-model.number="form.scores.influence" type="number" step="0.1" min="0" max="5" /></label>
          <label>综合评分（0-5）<input v-model.number="form.scores.overall" type="number" step="0.1" min="0" max="5" /></label>
        </div>

        <div class="form-row">
          <label>联系人<input v-model="form.contactPerson" /></label>
          <label>联系方式<input v-model="form.contactInfo" /></label>
          <label>联系类型<input v-model="form.contactType" /></label>
        </div>

        <label>推荐人<input v-model="form.referrer" /></label>
        <label>状态
          <select v-model="form.status">
            <option value="active">正常</option>
            <option value="observation">观察中</option>
            <option value="eliminated">已淘汰</option>
          </select>
        </label>
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
import type { Expert, Scores } from '@/types'
import { formatDate } from '@/utils/helpers'

const store = useAppStore()
const importFileInput = ref<HTMLInputElement | null>(null)

// ===== Filters (local, reset on tab switch) =====
const filterField = ref('')
const filterScore = ref('')
const filterStatus = ref('')

function clearFilters() {
  filterField.value = ''
  filterScore.value = ''
  filterStatus.value = ''
}

const filteredExperts = computed(() => {
  let list = store.experts
  const q = store.adminSearchQuery.trim().toLowerCase()
  if (q) list = list.filter(e => e.name?.toLowerCase().includes(q))
  if (filterField.value) list = list.filter(e => (e.fields || []).includes(filterField.value))
  if (filterScore.value) {
    const min = parseFloat(filterScore.value)
    list = list.filter(e => e.scores?.overall != null && e.scores.overall >= min)
  }
  if (filterStatus.value) {
    list = list.filter(
      e =>
        e.status === filterStatus.value ||
        (filterStatus.value === 'observation' && (e.status === 'observation' || e.observationStatus))
    )
  }
  return list
})

// ===== Display helpers =====
function getContactList(e: Expert): { person: string; info: string }[] {
  const list: { person: string; info: string }[] = []
  if (e.contacts && e.contacts.length) {
    e.contacts.forEach(c => list.push({ person: c.person || '', info: c.info || c.value || '' }))
  } else if (e.contactInfo) {
    list.push({ person: e.contactPerson || '', info: e.contactInfo })
  }
  return list
}

function firstContact(e: Expert): { person: string; info: string } {
  const list = getContactList(e)
  return list.length > 0 ? list[0] : { person: '-', info: '-' }
}

function contactTitle(e: Expert): string {
  return getContactList(e)
    .map(c => (c.person ? c.person + ': ' : '') + c.info)
    .join(' | ')
}

function contactDisplay(e: Expert): string {
  const list = getContactList(e)
  if (!list.length) return '-'
  const info = list[0].info || '-'
  const truncated = info.length > 15 ? info.substring(0, 15) + '...' : info
  return truncated + (list.length > 1 ? ' +' + (list.length - 1) : '')
}

function advText(e: Expert): string {
  const arr = (e.advantages || [])
    .slice(0, 2)
    .map(a => {
      if (typeof a === 'string') return a
      return (a.title || '') + (a.title ? '：' : '') + (a.desc || '')
    })
    .join('；')
  return arr || '-'
}

function overallColor(v: number | null | undefined): string {
  if (v == null) return 'inherit'
  if (v >= 4.0) return '#059669'
  if (v >= 3.5) return '#d97706'
  return '#dc2626'
}

function statusInfo(e: Expert): { label: string; color: string } {
  if (e.status === 'eliminated') return { label: '已淘汰', color: '#dc2626' }
  if (e.status === 'observation' || e.observationStatus)
    return { label: '观察中', color: '#d97706' }
  return { label: '正常', color: '#059669' }
}

// ===== Export / Import =====
function exportExperts() {
  const data = filteredExperts.value
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `experts-export-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function triggerImport() {
  importFileInput.value?.click()
}

function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(String(reader.result))
      if (!Array.isArray(parsed)) throw new Error('文件内容不是专家数组')
      for (const item of parsed) {
        const clean: Partial<Expert> = { ...item }
        delete (clean as any).id
        await store.saveExpert(clean)
      }
      window.alert(`成功导入 ${parsed.length} 条专家`)
    } catch (err) {
      window.alert('导入失败：' + (err as Error).message)
    } finally {
      input.value = ''
    }
  }
  reader.readAsText(file)
}

// ===== Create / Edit =====
const showModal = ref(false)
const advantagesText = ref('')

const emptyForm = (): Partial<Expert> & { scores: Scores } => ({
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

const form = reactive<Partial<Expert> & { scores: Scores }>(emptyForm())

function resetForm(data: Partial<Expert> = emptyForm()) {
  Object.assign(form, emptyForm(), data, { fields: [...(data.fields || [])] })
  advantagesText.value = (data.advantages || [])
    .map(a => (typeof a === 'string' ? a : a.title && a.desc ? `${a.title}：${a.desc}` : a.desc || a.title || ''))
    .join('\n')
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
  form.advantages = advantagesText.value
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
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
.admin-toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  align-items: center;
}
.search-input {
  flex: 1;
  max-width: 300px;
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
}
.search-input:focus {
  outline: none;
  border-color: var(--primary);
}
.btn {
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  transition: var(--transition);
}
.btn.primary {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}
.btn.primary:hover {
  background: #1d4ed8;
}
.btn.secondary {
  background: var(--bg);
  color: var(--text-secondary);
}
.btn.secondary:hover {
  color: var(--primary);
  border-color: var(--primary);
}

/* Filter row */
.admin-filter-row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.filter-label {
  font-size: 12px;
  color: var(--text-secondary);
}
.filter-select {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 12px;
  background: var(--surface);
  min-width: 120px;
}
.clear-btn {
  padding: 6px 12px;
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg);
}

/* Data table */
.table-scroll-wrapper {
  overflow: auto;
  max-height: 55vh;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  min-width: 1100px;
}
.data-table th,
.data-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
.data-table td {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.data-table th {
  background: var(--bg);
  font-weight: 600;
  color: var(--text-secondary);
  position: sticky;
  top: 0;
  font-size: 12px;
  letter-spacing: 0.3px;
  z-index: 1;
}
.data-table tr:hover {
  background: #f8fafc;
}
.cell-name {
  font-weight: 600;
}
.cell-clamp {
  max-width: 160px;
}
.cell-overall {
  font-weight: 700;
}
.cell-date {
  font-size: 11px;
}
.data-table .actions {
  display: flex;
  gap: 6px;
  white-space: nowrap;
}
.btn-sm {
  padding: 5px 10px;
  font-size: 12px;
}
.btn-secondary {
  background: var(--bg);
  color: var(--text-secondary);
}
.btn-danger {
  color: #dc2626;
  border-color: #fecaca;
}
.btn-danger:hover {
  background: #fef2f2;
}
.empty {
  text-align: center;
  color: #888;
  padding: 24px;
}
.record-count {
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-muted);
}

/* Modal */
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 35%);
}
.modal-card {
  width: min(720px, 92vw);
  max-height: 88vh;
  overflow: auto;
  padding: 20px;
  border-radius: 8px;
  background: #fff;
}
.modal-card h3 {
  margin-top: 0;
}
.modal-card label {
  display: block;
  margin: 10px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.modal-card input:not([type='checkbox']):not([type='number']),
.modal-card textarea,
.modal-card select {
  width: 100%;
  box-sizing: border-box;
  margin-top: 4px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
}
.modal-card input[type='number'] {
  width: 100%;
  box-sizing: border-box;
  margin-top: 4px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
}
.checkbox-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-bottom: 8px;
}
.inline-check {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 400;
  margin: 0;
}
.form-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.form-row label {
  flex: 1;
  min-width: 140px;
}
.inline {
  display: flex !important;
  align-items: center;
  gap: 6px;
  font-weight: 400;
}
.modal-actions {
  margin-top: 16px;
  text-align: right;
}
</style>
