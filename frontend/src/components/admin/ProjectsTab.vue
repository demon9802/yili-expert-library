<template>
  <div class="admin-tab projects-tab">
    <div class="tab-header">
      <h2>合作项目管理</h2>
      <button class="btn btn-primary" @click="openCreate">+ 新建项目</button>
    </div>

    <!-- Toolbar / Filters -->
    <div class="admin-toolbar">
      <input v-model="searchQuery" type="search" placeholder="搜索项目名称..." class="search-input" />
      <select v-model="filterYear" class="filter-select">
        <option value="">全部年度</option>
        <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
      </select>
      <select v-model="filterQuarter" class="filter-select">
        <option value="">全部季度</option>
        <option value="Q1">Q1</option>
        <option value="Q2">Q2</option>
        <option value="Q3">Q3</option>
        <option value="Q4">Q4</option>
      </select>
      <select v-model="filterVisibility" class="filter-select">
        <option value="">全部显示状态</option>
        <option value="show">显示</option>
        <option value="hidden">不显示</option>
        <option value="pending">待关联</option>
      </select>
    </div>

    <!-- Table -->
    <div class="table-scroll-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>项目名称</th>
            <th>关联讲师</th>
            <th>年份</th>
            <th>月份</th>
            <th>满意度</th>
            <th>显示</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="project in filteredProjects" :key="project.id" :class="{ 'row-pending': !project.expertId }">
            <td class="cell-title">
              <strong>{{ project.title || '-' }}</strong>
              <span v-if="!project.expertId && project.pendingExpertName" class="pending-badge">待关联: {{ project.pendingExpertName }}</span>
            </td>
            <td>
              <span v-if="getExpertName(project.expertId)">{{ getExpertName(project.expertId) }}</span>
              <span v-else-if="!project.expertId && project.pendingExpertName" class="muted italic">待关联</span>
              <span v-else class="muted">-</span>
            </td>
            <td>{{ project.year || '-' }}</td>
            <td>{{ project.month ? project.month + '月' : '-' }}</td>
            <td>{{ project.satisfaction || '—' }}</td>
            <td>
              <span
                v-if="project.expertId"
                class="visibility-badge"
                :class="project.visible ? 'on' : 'off'"
                @click="toggleVisible(project)"
              >{{ project.visible ? '显示' : '隐藏' }}</span>
              <span v-else class="muted">-</span>
            </td>
            <td class="actions">
              <button class="btn-link" @click="editProject(project)">编辑</button>
              <button class="btn-link danger" @click="handleDelete(project)">删除</button>
            </td>
          </tr>
          <tr v-if="filteredProjects.length === 0">
            <td colspan="7" class="empty">暂无项目</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Stats bar -->
    <div class="stats-bar">
      <span>总计 {{ projects.length }} 项目</span>
      <span class="ok">显示中 {{ stats.visible }}</span>
      <span v-if="stats.hidden > 0" class="bad">已隐藏 {{ stats.hidden }}</span>
      <span v-if="stats.pending > 0" class="warn">待关联 {{ stats.pending }}</span>
    </div>

    <!-- Form modal -->
    <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
      <div class="form-modal">
        <h3>{{ editing ? '编辑项目' : '新建项目' }}</h3>
        <div class="form-grid">
          <div class="form-group"><label>项目标题 *</label><input v-model="formData.title" type="text" /></div>
          <div class="form-group"><label>关联讲师</label>
            <select v-model="formData.expertId"><option :value="null">请选择</option>
              <option v-for="e in store.experts" :key="e.id" :value="e.id">{{ e.name }}</option></select></div>
          <div class="form-group"><label>待定讲师姓名（未录入库中时）</label><input v-model="formData.pendingExpertName" type="text" /></div>
          <div class="form-group"><label>年份 *</label><input v-model.number="formData.year" type="number" /></div>
          <div class="form-group"><label>月份</label><input v-model.number="formData.month" type="number" min="1" max="12" /></div>
          <div class="form-group"><label>满意度</label><input v-model="formData.satisfaction" type="text" placeholder="如 8.6" /></div>
          <div class="form-group"><label>项目描述</label><textarea v-model="formData.desc" rows="3" /></div>
          <div class="form-group"><label>是否可见</label><input v-model="formData.visible" type="checkbox" /></div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" @click="handleSave">保存</button>
          <button class="btn btn-text" @click="showForm = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useAppStore } from '@/store/appStore'
import type { Project } from '@/types'

const store = useAppStore()
const showForm = ref(false)
const editing = ref<Project | null>(null)

// Filters
const searchQuery = ref('')
const filterYear = ref('')
const filterQuarter = ref('')
const filterVisibility = ref('')

const projects = computed(() => store.yiliProjects)

const yearOptions = computed(() => {
  const years = [...new Set(projects.value.map(p => p.year).filter(Boolean))] as number[]
  return years.sort((a, b) => b - a)
})

const filteredProjects = computed(() => {
  let list = [...projects.value]
  if (filterYear.value) list = list.filter(p => String(p.year) === filterYear.value)
  if (filterQuarter.value) list = list.filter(p => {
    if (!p.month) return false
    return 'Q' + Math.ceil(p.month / 3) === filterQuarter.value
  })
  if (filterVisibility.value === 'show') list = list.filter(p => p.visible && p.expertId)
  else if (filterVisibility.value === 'hidden') list = list.filter(p => !p.visible)
  else if (filterVisibility.value === 'pending') list = list.filter(p => !p.expertId)
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(p => (p.title || '').toLowerCase().includes(q))
  }
  return list.sort((a, b) => (b.year || 0) - (a.year || 0))
})

const stats = computed(() => {
  const list = projects.value
  return {
    visible: list.filter(p => p.visible && p.expertId).length,
    hidden: list.filter(p => !p.visible && p.expertId).length,
    pending: list.filter(p => !p.expertId).length,
  }
})

function getExpertName(id: number | null) {
  if (!id) return ''
  return store.experts.find(e => e.id === id)?.name || ''
}

async function toggleVisible(project: Project) {
  await store.saveProject({ id: project.id, visible: !project.visible })
}

const formData = reactive<Partial<Project>>({
  title: '', expertId: null, pendingExpertName: '', year: new Date().getFullYear(),
  month: null, satisfaction: '', desc: '', visible: true,
})

function openCreate() { editing.value = null; resetForm(); showForm.value = true }
function editProject(p: Project) { editing.value = p; resetForm(p); showForm.value = true }
function resetForm(data: Partial<Project> = {}) {
  Object.assign(formData, {
    id: undefined, title: '', expertId: null, pendingExpertName: '', year: new Date().getFullYear(),
    month: null, satisfaction: '', desc: '', visible: true,
  }, data)
}
async function handleSave() {
  if (!formData.title?.trim()) { alert('请填写项目标题'); return }
  if (!formData.year) { alert('请填写年份'); return }
  await store.saveProject(formData)
  showForm.value = false
}
async function handleDelete(p: Project) { if (confirm(`确认删除「${p.title}」？`)) await store.deleteProject(p.id) }
</script>

<style scoped>
.tab-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.tab-header h2 { font-size: 18px; font-weight: 600; margin: 0; }
.btn-primary { background: #2563eb; color: #fff; border: 1px solid #2563eb; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.btn-primary:hover { background: #1d4ed8; }
.admin-toolbar { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
.search-input { flex: 1; max-width: 280px; padding: 8px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; }
.search-input:focus { outline: none; border-color: var(--primary); }
.filter-select { padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; background: var(--surface); min-width: 120px; }

.table-scroll-wrapper { overflow: auto; max-height: 55vh; border: 1px solid var(--border); border-radius: var(--radius-sm); }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 900px; }
.data-table th, .data-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; }
.data-table th { background: var(--bg); font-weight: 600; color: var(--text-secondary); font-size: 12px; }
.data-table tr:hover { background: #f8fafc; }
.row-pending { background: #fef9c3; }
.row-pending:hover { background: #fef3c7; }
.cell-title { max-width: 240px; }
.pending-badge { display: inline-block; margin-left: 6px; padding: 1px 6px; background: #f59e0b; color: #fff; border-radius: 3px; font-size: 10px; font-weight: 500; }
.muted { color: var(--text-muted); }
.italic { font-style: italic; }
.visibility-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; cursor: pointer; user-select: none; }
.visibility-badge.on { background: #dcfce7; color: #166534; }
.visibility-badge.off { background: #fef2f2; color: #991b1b; }
.actions { display: flex; gap: 6px; }
.btn-link { background: none; border: none; color: var(--primary); cursor: pointer; font-size: 13px; padding: 0; }
.btn-link.danger { color: #dc2626; }
.empty { text-align: center; color: #888; padding: 24px; }

.stats-bar { margin-top: 12px; padding: 8px 12px; background: var(--bg); border-radius: 8px; border: 1px solid var(--border); font-size: 12px; color: var(--text-secondary); display: flex; gap: 16px; flex-wrap: wrap; }
.stats-bar .ok { color: #166534; }
.stats-bar .bad { color: #991b1b; }
.stats-bar .warn { color: #b45309; }

.modal-overlay { position: fixed; inset: 0; z-index: 1000; background: rgb(0 0 0 / 35%); display: flex; align-items: center; justify-content: center; }
.form-modal { width: min(560px, 92vw); max-height: 88vh; overflow: auto; padding: 20px; border-radius: 8px; background: #fff; }
.form-modal h3 { margin-top: 0; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-group { display: flex; flex-direction: column; gap: 4px; }
.form-group label { font-size: 13px; font-weight: 600; color: var(--text); }
.form-group input, .form-group select, .form-group textarea { padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; font-family: inherit; }
.form-group textarea { min-height: 70px; resize: vertical; }
.form-actions { margin-top: 16px; display: flex; gap: 10px; justify-content: flex-end; }
.btn-text { background: none; border: 1px solid var(--border); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; color: var(--text-secondary); }
</style>
