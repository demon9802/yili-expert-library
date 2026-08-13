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
      <button class="btn btn-secondary" @click="exportProjects">📥 导出Excel</button>
      <button class="btn btn-secondary" @click="triggerImport">📤 导入Excel</button>
      <input ref="importFileInput" type="file" accept=".xlsx,.xls,.csv" style="display:none" @change="onImportFile" />
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
            <td>{{ satisfactionDisplay(project.satisfaction) || '—' }}</td>
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
          <div class="form-group">
            <label>关联讲师</label>
            <select v-model="formData.expertId">
              <option :value="null">请选择</option>
              <option v-for="e in store.experts" :key="e.id" :value="e.id">{{ e.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>项目名称 *</label>
            <input v-model="formData.title" type="text" />
          </div>
          <div class="form-group">
            <label>待定讲师姓名（未录入库中时）</label>
            <input v-model="formData.pendingExpertName" type="text" />
          </div>
          <div class="form-group">
            <label>合作年份 *</label>
            <select v-model.number="formData.year">
              <option :value="0">请选择</option>
              <option v-for="y in yearSelectOptions" :key="y" :value="y">{{ y }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>合作月份</label>
            <select v-model.number="formData.month">
              <option :value="null">请选择</option>
              <option v-for="m in 12" :key="m" :value="m">{{ m }}月</option>
            </select>
          </div>
          <div class="form-group satisfaction-group">
            <label>满意度</label>
            <div class="satisfaction-inputs">
              <input v-model.number="formData.satisfactionValue" type="number" min="0" step="0.01" placeholder="分值" />
              <select v-model.number="formData.satisfactionScale">
                <option :value="10">10分制</option>
                <option :value="5">5分制</option>
              </select>
            </div>
          </div>
          <div class="form-group form-group-full">
            <label>项目描述</label>
            <textarea v-model="formData.desc" rows="3" />
          </div>
          <div class="form-group form-group-full">
            <label class="inline-check">
              <input v-model="formData.visible" type="checkbox" />
              前端显示
            </label>
          </div>
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
import { satisfactionDisplay, parseSatisfaction } from '@/utils/satisfaction'
import * as XLSX from 'xlsx'

const store = useAppStore()
const showForm = ref(false)
const editing = ref<Project | null>(null)
const importFileInput = ref<HTMLInputElement | null>(null)

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

interface ProjectForm extends Partial<Project> {
  satisfactionValue: number | null
  satisfactionScale: 5 | 10
}

const formData = reactive<ProjectForm>({
  title: '', expertId: null, pendingExpertName: '', year: new Date().getFullYear(),
  month: null, satisfaction: '', satisfactionValue: null, satisfactionScale: 10,
  desc: '', visible: true,
})

const yearSelectOptions = computed(() => {
  const current = new Date().getFullYear()
  const arr: number[] = []
  for (let y = current + 1; y >= current - 8; y--) arr.push(y)
  return arr
})

function openCreate() { editing.value = null; resetForm(); showForm.value = true }
function editProject(p: Project) { editing.value = p; resetForm(p); showForm.value = true }
function resetForm(data: Partial<Project> = {}) {
  const parsed = parseSatisfaction(data.satisfaction)
  Object.assign(formData, {
    id: undefined, title: '', expertId: null, pendingExpertName: '', year: new Date().getFullYear(),
    month: null, satisfaction: '', satisfactionValue: null, satisfactionScale: 10,
    desc: '', visible: true,
  }, data, {
    satisfactionValue: parsed ? parsed.raw : null,
    satisfactionScale: parsed ? parsed.scale : 10,
  })
}
async function handleSave() {
  if (!formData.title?.trim()) { alert('请填写项目名称'); return }
  if (!formData.year) { alert('请选择合作年份'); return }

  const payload: Partial<Project> = {
    id: formData.id,
    title: formData.title,
    expertId: formData.expertId,
    pendingExpertName: formData.pendingExpertName,
    year: formData.year,
    month: formData.month,
    desc: formData.desc,
    visible: formData.visible,
  }

  if (formData.satisfactionValue != null && Number.isFinite(formData.satisfactionValue) && formData.satisfactionValue > 0) {
    payload.satisfaction = JSON.stringify({
      value: formData.satisfactionValue,
      scale: formData.satisfactionScale,
    })
  } else {
    payload.satisfaction = null
  }

  await store.saveProject(payload)
  showForm.value = false
}
async function handleDelete(p: Project) { if (confirm(`确认删除「${p.title}」？`)) await store.deleteProject(p.id) }

// ===== Excel 导出 / 导入 =====
function exportProjects() {
  const rows = projects.value.map(p => ({
    项目名称: p.title || '',
    关联讲师: getExpertName(p.expertId) || p.pendingExpertName || '',
    合作年份: p.year || '',
    合作月份: p.month || '',
    满意度分值: parseSatisfaction(p.satisfaction)?.raw ?? '',
    满意度量程: parseSatisfaction(p.satisfaction)?.scale ?? '',
    项目描述: p.desc || '',
    前端显示: p.visible ? '是' : '否',
    创建时间: p.createdAt || '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '合作项目')
  XLSX.writeFile(wb, `合作项目导出-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function triggerImport() { importFileInput.value?.click() }

function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const wb = XLSX.read(reader.result as ArrayBuffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })
      let ok = 0
      for (const r of rows) {
        const title = String(r['项目名称'] || r['title'] || '').trim()
        if (!title) continue
        const lecturer = String(r['关联讲师'] || r['lecturer'] || '').trim()
        const matched = store.experts.find(ex => ex.name === lecturer)
        const value = parseFloat(r['满意度分值'] ?? r['satisfactionValue'])
        const scale = parseInt(r['满意度量程'] ?? r['satisfactionScale']) || 10
        const satisfaction = Number.isFinite(value) && value > 0
          ? JSON.stringify({ value, scale }) : null
        const payload: Partial<Project> = {
          title,
          expertId: matched ? matched.id : null,
          pendingExpertName: matched ? '' : lecturer,
          year: parseInt(r['合作年份'] ?? r['year']) || new Date().getFullYear(),
          month: parseInt(r['合作月份'] ?? r['month']) || null,
          desc: String((r['项目描述'] ?? r['desc']) || ''),
          visible: String((r['前端显示'] ?? r['visible']) || '').includes('是'),
          satisfaction,
        }
        try {
          await store.saveProject(payload)
        } catch {
          store.yiliProjects.push({ ...payload, id: -Date.now() - ok } as Project)
          store.persistLocal()
        }
        ok++
      }
      window.alert(`成功导入 ${ok} 个合作项目`)
    } catch (err) {
      window.alert('导入失败：' + (err as Error).message)
    } finally {
      input.value = ''
    }
  }
  reader.readAsArrayBuffer(file)
}
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
.form-group-full { grid-column: 1 / -1; }
.satisfaction-group .satisfaction-inputs { display: flex; gap: 8px; }
.satisfaction-group .satisfaction-inputs input { flex: 1; }
.satisfaction-group .satisfaction-inputs select { width: 100px; flex-shrink: 0; }
.inline-check { display: flex !important; align-items: center; gap: 6px; font-weight: 500 !important; cursor: pointer; }
.inline-check input { margin: 0; }
.form-actions { margin-top: 16px; display: flex; gap: 10px; justify-content: flex-end; }
.btn-text { background: none; border: 1px solid var(--border); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; color: var(--text-secondary); }
</style>
