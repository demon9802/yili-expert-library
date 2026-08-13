<template>
  <div class="admin-tab projects-tab">
    <div class="tab-header">
      <h2>合作项目管理</h2>
    </div>

    <!-- Toolbar / Filters -->
    <div class="admin-toolbar">
      <div class="toolbar-main">
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
        <div class="toolbar-actions">
          <button class="btn btn-secondary btn-small" @click="exportProjects">导出Excel</button>
          <button class="btn btn-secondary btn-small" @click="exportProjectsCSV">导出CSV</button>
          <button class="btn btn-secondary btn-small" @click="showImportModal = true">导入Excel</button>
          <button class="btn btn-primary btn-small" @click="openCreate">+ 新建项目</button>
        </div>
      </div>
      <div class="sort-row">
        <span class="sort-label">排序</span>
        <div class="sort-buttons" role="group" aria-label="项目排序">
          <button
            v-for="option in sortOptions"
            :key="option.value"
            class="sort-btn"
            :class="{ active: sortMode === option.value }"
            @click="sortMode = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
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
          <tr v-for="project in paginatedProjects" :key="project.id" :class="{ 'row-pending': !project.expertId }">
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
      <div v-if="filteredProjects.length > 0" class="pagination">
        <button class="page-btn" :disabled="currentPage === 1" @click="currentPage--">上一页</button>
        <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
        <button class="page-btn" :disabled="currentPage === totalPages" @click="currentPage++">下一页</button>
      </div>
    </div>

    <!-- Form modal -->
    <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
      <div class="form-modal">
        <h3>{{ editing ? '编辑项目' : '新建项目' }}</h3>
        <div class="form-grid">
          <div class="form-group form-group-full lecturer-picker">
            <label>关联讲师 *</label>
            <input
              v-model="lecturerSearch"
              type="text"
              placeholder="输入姓名搜索已录入讲师…"
              @input="onLecturerInput"
              @focus="showLecturerDropdown = true"
              @keydown.enter.prevent="confirmLecturerInput"
              @blur="handleLecturerBlur"
            />
            <div v-if="showLecturerDropdown && lecturerMatches.length > 0" class="lecturer-dropdown">
              <button v-for="e in lecturerMatches" :key="e.id" type="button" @mousedown.prevent="selectLecturer(e.id, e.name)">
                {{ e.name }}
                <span v-if="e.fields?.length" class="muted">{{ e.fields.join('、') }}</span>
              </button>
            </div>
            <p v-if="formData.expertId" class="field-help">已关联：{{ getExpertName(formData.expertId) }}</p>
            <p v-else-if="formData.pendingExpertName" class="field-help warn">仅记录项目，讲师暂未录入资源库：{{ formData.pendingExpertName }}</p>
          </div>
          <div class="form-group form-group-full">
            <label>项目名称 *</label>
            <input v-model="formData.title" type="text" />
          </div>
          <div class="form-group">
            <label>合作年份 *</label>
            <select v-model.number="formData.year">
              <option :value="0">请选择</option>
              <option v-for="y in yearSelectOptions" :key="y" :value="y">{{ y }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>合作月份（可选）</label>
            <select v-model="formData.month">
              <option :value="null">不指定</option>
              <option v-for="m in 12" :key="m" :value="m">{{ m }}月</option>
            </select>
          </div>
          <div class="form-group satisfaction-group">
            <label>项目满意度（可选，10分制）</label>
            <div class="satisfaction-inputs">
              <input v-model.number="formData.satisfactionValue" type="number" min="0" step="0.01" placeholder="分值" />
              <select v-model.number="formData.satisfactionScale">
                <option :value="10">10分制</option>
                <option :value="5">5分制</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>前端显示</label>
            <select v-model="formData.visible">
              <option :value="true">显示</option>
              <option :value="false">不显示</option>
            </select>
          </div>
          <div class="form-group form-group-full">
            <label>项目描述（可选，建议不超过100字）</label>
            <textarea v-model="formData.desc" rows="3" maxlength="100" />
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary btn-small" @click="handleSave">保存</button>
          <button class="btn btn-text btn-small" @click="showForm = false">取消</button>
        </div>
      </div>
    </div>

    <!-- Unknown lecturer modal -->
    <div v-if="showUnknownLecturerModal" class="modal-overlay" @click.self="showUnknownLecturerModal = false">
      <div class="confirm-modal">
        <h3>讲师「{{ unknownLecturerName }}」尚未录入资源库</h3>
        <div class="confirm-actions">
          <button class="btn btn-secondary" @click="keepSearchingLecturer">在库中，我换个名字搜索</button>
          <button class="btn btn-primary" @click="openQuickExpertForm">不在库中，现在录入</button>
          <button class="btn btn-secondary" @click="recordPendingLecturer">先不录入，仅记录项目（前端不显示）</button>
          <button class="btn btn-text" @click="showUnknownLecturerModal = false">取消</button>
        </div>
      </div>
    </div>

    <!-- Quick expert modal -->
    <div v-if="showQuickExpertForm" class="modal-overlay" @click.self="showQuickExpertForm = false">
      <div class="confirm-modal">
        <h3>快速录入专家</h3>
        <div class="form-group quick-field">
          <label>姓名 *</label>
          <input v-model="quickExpert.name" type="text" />
        </div>
        <div class="form-group quick-field">
          <label>适用领域</label>
          <div class="field-checkboxes">
            <label v-for="field in store.fields" :key="field.name" class="field-check">
              <input v-model="quickExpert.fields" type="checkbox" :value="field.name" />
              {{ field.name }}
            </label>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary btn-small" @click="saveQuickExpert">保存并关联</button>
          <button class="btn btn-text btn-small" @click="showQuickExpertForm = false">取消</button>
        </div>
      </div>
    </div>

    <!-- Import modal -->
    <div v-if="showImportModal" class="modal-overlay" @click.self="closeImportModal">
      <div class="import-modal-card">
        <h3>批量导入合作项目</h3>
        <div class="import-step">
          <div class="step-index">①</div>
          <div class="step-content">
            <div class="step-title">下载导入模板</div>
            <p>按模板填写项目名称、关联讲师、合作年份、合作月份等信息。</p>
            <button type="button" class="btn btn-secondary btn-small" @click="downloadProjectImportTemplate">下载导入模板</button>
          </div>
        </div>
        <div class="import-step">
          <div class="step-index">②</div>
          <div class="step-content">
            <div class="step-title">选择文件并导入</div>
            <p>仅支持 .xlsx / .xls 文件。系统会按讲师姓名匹配专家，未匹配到的讲师将记为待关联。</p>
            <div class="import-file-row">
              <button type="button" class="btn btn-secondary btn-small" @click="importFileInput?.click()">选择文件</button>
              <span class="import-file-name">{{ importFileName || '未选择文件' }}</span>
            </div>
            <input ref="importFileInput" type="file" accept=".xlsx,.xls" style="display:none" @change="onImportFileSelected" />
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary btn-small" :disabled="!pendingImportFile" @click="uploadImportFile">上传并导入</button>
          <button type="button" class="btn btn-text btn-small" @click="closeImportModal">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useAppStore } from '@/store/appStore'
import type { Expert, Project } from '@/types'
import { satisfactionDisplay, parseSatisfaction } from '@/utils/satisfaction'
import * as XLSX from 'xlsx'

const store = useAppStore()
const showForm = ref(false)
const editing = ref<Project | null>(null)
const importFileInput = ref<HTMLInputElement | null>(null)
const showImportModal = ref(false)
const pendingImportFile = ref<File | null>(null)
const importFileName = ref('')

// Filters
const searchQuery = ref('')
const filterYear = ref('')
const filterQuarter = ref('')
const filterVisibility = ref('')
const sortMode = ref<'default' | 'name'>('default')
const currentPage = ref(1)
const pageSize = 10

const sortOptions = [
  { value: 'default' as const, label: '时间' },
  { value: 'name' as const, label: '项目名称 A-Z' },
]

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
  return sortProjects(list)
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredProjects.value.length / pageSize)))
const paginatedProjects = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredProjects.value.slice(start, start + pageSize)
})

watch([searchQuery, filterYear, filterQuarter, filterVisibility, sortMode], () => {
  currentPage.value = 1
})

watch(totalPages, pages => {
  if (currentPage.value > pages) currentPage.value = pages
})

function sortProjects(list: Project[]) {
  return [...list].sort((a, b) => {
    if (sortMode.value === 'name') return (a.title || '').localeCompare(b.title || '', 'zh-CN')
    const yearDiff = (b.year || 0) - (a.year || 0)
    if (yearDiff !== 0) return yearDiff
    return (b.month || 0) - (a.month || 0)
  })
}

const stats = computed(() => {
  const list = projects.value
  return {
    visible: list.filter(p => p.visible && p.expertId).length,
    hidden: list.filter(p => !p.visible && p.expertId).length,
    pending: list.filter(p => !p.expertId).length,
  }
})

function getExpertName(id: number | null | undefined) {
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

const lecturerSearch = ref('')
const showLecturerDropdown = ref(false)
const showUnknownLecturerModal = ref(false)
const unknownLecturerName = ref('')
const showQuickExpertForm = ref(false)
const quickExpert = reactive({ name: '', fields: [] as string[] })

const lecturerMatches = computed(() => {
  const q = lecturerSearch.value.trim().toLowerCase()
  if (!q) return []
  return store.experts
    .filter(e => e.name.toLowerCase().includes(q))
    .slice(0, 8)
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
  lecturerSearch.value = data.expertId ? getExpertName(data.expertId) : (data.pendingExpertName || '')
  showLecturerDropdown.value = false
  showUnknownLecturerModal.value = false
  showQuickExpertForm.value = false
}

function onLecturerInput() {
  formData.expertId = null
  formData.pendingExpertName = ''
  showLecturerDropdown.value = true
}

function selectLecturer(id: number, name: string) {
  formData.expertId = id
  formData.pendingExpertName = ''
  lecturerSearch.value = name
  showLecturerDropdown.value = false
}

function confirmLecturerInput() {
  const name = lecturerSearch.value.trim()
  if (!name) return
  const exact = store.experts.find(e => e.name === name)
  if (exact) {
    selectLecturer(exact.id, exact.name)
    return
  }
  if (formData.pendingExpertName === name) return
  unknownLecturerName.value = name
  showUnknownLecturerModal.value = true
  showLecturerDropdown.value = false
}

function handleLecturerBlur() {
  window.setTimeout(() => {
    showLecturerDropdown.value = false
    confirmLecturerInput()
  }, 120)
}

function keepSearchingLecturer() {
  showUnknownLecturerModal.value = false
  showQuickExpertForm.value = false
}

function openQuickExpertForm() {
  quickExpert.name = unknownLecturerName.value
  quickExpert.fields = []
  showUnknownLecturerModal.value = false
  showQuickExpertForm.value = true
}

function recordPendingLecturer() {
  formData.expertId = null
  formData.pendingExpertName = unknownLecturerName.value
  formData.visible = false
  lecturerSearch.value = unknownLecturerName.value
  showUnknownLecturerModal.value = false
}

async function saveQuickExpert() {
  const name = quickExpert.name.trim()
  if (!name) { alert('请填写专家姓名'); return }
  const created = await store.saveExpert({
    name,
    fields: [...quickExpert.fields],
    advantages: [],
    education: '',
    qualifications: '',
    courses: '',
    contactPerson: '',
    contactInfo: '',
    contactType: '',
    referrer: '',
    isSupplier: false,
    qualDisplay: '',
    advDisplay: '',
    scores: { professional: null, influence: null, overall: null },
    status: 'active',
    observationStatus: null,
    observationDate: null,
    contacts: [],
    createdBy: '',
    createdAt: '',
    updatedAt: '',
    subScores: null,
  }) as Expert
  selectLecturer(created.id, created.name)
  showQuickExpertForm.value = false
}

async function handleSave() {
  const lecturerName = lecturerSearch.value.trim()
  if (!formData.expertId && lecturerName && formData.pendingExpertName !== lecturerName) {
    confirmLecturerInput()
    return
  }
  if (!formData.expertId && !formData.pendingExpertName) { alert('请关联讲师或记录未录入讲师'); return }
  if (!formData.title?.trim()) { alert('请填写项目名称'); return }
  if (!formData.year) { alert('请选择合作年份'); return }

  const payload: Partial<Project> = {
    id: formData.id,
    title: formData.title,
    expertId: formData.expertId,
    pendingExpertName: formData.expertId ? '' : formData.pendingExpertName,
    year: formData.year,
    month: formData.month,
    desc: formData.desc,
    visible: formData.expertId ? formData.visible : false,
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

function exportProjectsCSV() {
  const headers = ['项目名称', '关联讲师', '合作年份', '合作月份', '满意度分值', '满意度量程', '项目描述', '前端显示', '创建时间']
  const rows = projects.value.map(p => [
    p.title || '',
    getExpertName(p.expertId) || p.pendingExpertName || '',
    p.year || '',
    p.month || '',
    parseSatisfaction(p.satisfaction)?.raw ?? '',
    parseSatisfaction(p.satisfaction)?.scale ?? '',
    p.desc || '',
    p.visible ? '是' : '否',
    p.createdAt || '',
  ])
  const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const csv = [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `合作项目导出-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function downloadProjectImportTemplate() {
  const rows = [
    {
      项目名称: '示例：2025领导力工作坊',
      关联讲师: '示例：张三（需与资源库姓名一致）',
      合作年份: '示例：2025',
      合作月份: '示例：6；不指定可留空',
      项目满意度: '示例：9.5',
      满意度量程: '10（可填5或10）',
      项目描述: '建议不超过100字',
      前端显示: '是/否',
    },
  ]
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: ['项目名称', '关联讲师', '合作年份', '合作月份', '项目满意度', '满意度量程', '项目描述', '前端显示'],
  })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '合作项目导入模板')
  XLSX.writeFile(wb, '合作项目导入模板.xlsx')
}

function onImportFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] || null
  pendingImportFile.value = file
  importFileName.value = file?.name || ''
}

function closeImportModal() {
  showImportModal.value = false
  pendingImportFile.value = null
  importFileName.value = ''
  if (importFileInput.value) importFileInput.value.value = ''
}

function uploadImportFile() {
  if (!pendingImportFile.value) return
  importProjectsFromFile(pendingImportFile.value)
}

function importProjectsFromFile(file: File) {
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const wb = XLSX.read(reader.result as ArrayBuffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })
      let ok = 0
      for (const r of rows) {
        const title = String(r['项目名称'] || r['title'] || '').trim()
        if (!title || title.startsWith('示例：')) continue
        const lecturer = String(r['关联讲师'] || r['lecturer'] || '').trim()
        const matched = store.experts.find(ex => ex.name === lecturer)
        const value = parseFloat(r['项目满意度'] ?? r['满意度分值'] ?? r['satisfactionValue'])
        const scale = parseInt(r['满意度量程'] ?? r['satisfactionScale']) || 10
        const satisfaction = Number.isFinite(value) && value > 0
          ? JSON.stringify({ value, scale }) : null
        const visibleText = String((r['前端显示'] ?? r['visible']) || '')
        const payload: Partial<Project> = {
          title,
          expertId: matched ? matched.id : null,
          pendingExpertName: matched ? '' : lecturer,
          year: parseInt(r['合作年份'] ?? r['year']) || new Date().getFullYear(),
          month: parseInt(r['合作月份'] ?? r['month']) || null,
          desc: String((r['项目描述'] ?? r['desc']) || ''),
          visible: visibleText.includes('是') || visibleText.toLowerCase() === 'true',
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
      closeImportModal()
    } catch (err) {
      window.alert('导入失败：' + (err as Error).message)
    } finally {
      if (importFileInput.value) importFileInput.value.value = ''
    }
  }
  reader.readAsArrayBuffer(file)
}
</script>

<style scoped>
.tab-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.tab-header h2 { font-size: 18px; font-weight: 600; margin: 0; }
.btn { border-radius: 6px; cursor: pointer; font-size: 12px; line-height: 1.2; white-space: nowrap; }
.btn-small { padding: 6px 10px; }
.btn-primary { background: #2563eb; color: #fff; border: 1px solid #2563eb; }
.btn-primary:hover { background: #1d4ed8; }
.btn-secondary { background: #fff; color: var(--text-secondary); border: 1px solid var(--border); padding: 6px 10px; }
.btn-secondary:hover { background: var(--bg); color: var(--text); }
.admin-toolbar { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
.toolbar-main { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.toolbar-actions { display: inline-flex; gap: 6px; align-items: center; margin-left: auto; }
.search-input { flex: 1; max-width: 280px; min-width: 180px; padding: 7px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; }
.search-input:focus { outline: none; border-color: var(--primary); }
.filter-select { padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; background: var(--surface); min-width: 118px; }
.sort-row { display: flex; align-items: center; gap: 8px; }
.sort-label { color: var(--text-muted); font-size: 12px; }
.sort-buttons { display: inline-flex; align-items: center; gap: 4px; padding: 2px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
.sort-btn { border: 0; background: transparent; color: var(--text-secondary); padding: 5px 9px; border-radius: 6px; font-size: 12px; cursor: pointer; white-space: nowrap; }
.sort-btn:hover { background: var(--bg); color: var(--text); }
.sort-btn.active { background: var(--primary); color: #fff; }

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

.stats-bar { margin-top: 12px; padding: 8px 12px; background: var(--bg); border-radius: 8px; border: 1px solid var(--border); font-size: 12px; color: var(--text-secondary); display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
.stats-bar .ok { color: #166534; }
.stats-bar .bad { color: #991b1b; }
.stats-bar .warn, .field-help.warn { color: #b45309; }
.pagination { display: inline-flex; align-items: center; gap: 8px; margin-left: auto; }
.page-btn { border: 1px solid var(--border); background: #fff; border-radius: 6px; padding: 4px 8px; color: var(--text-secondary); cursor: pointer; font-size: 12px; }
.page-btn:disabled { cursor: not-allowed; opacity: .45; }
.page-info { color: var(--text-secondary); }

.modal-overlay { position: fixed; inset: 0; z-index: 1000; background: rgb(0 0 0 / 35%); display: flex; align-items: center; justify-content: center; }
.form-modal { width: min(600px, 92vw); max-height: 88vh; overflow: auto; padding: 20px; border-radius: 8px; background: #fff; }
.form-modal h3, .confirm-modal h3 { margin-top: 0; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-group { display: flex; flex-direction: column; gap: 4px; }
.form-group label { font-size: 13px; font-weight: 600; color: var(--text); }
.form-group input, .form-group select, .form-group textarea { padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; font-family: inherit; }
.form-group textarea { min-height: 70px; resize: vertical; }
.form-group-full { grid-column: 1 / -1; }
.satisfaction-group .satisfaction-inputs { display: flex; gap: 8px; }
.satisfaction-group .satisfaction-inputs input { flex: 1; }
.satisfaction-group .satisfaction-inputs select { width: 100px; flex-shrink: 0; }
.form-actions { margin-top: 16px; display: flex; gap: 10px; justify-content: flex-end; }
.btn-text { background: none; border: 1px solid var(--border); padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; color: var(--text-secondary); }
.lecturer-picker { position: relative; }
.lecturer-dropdown { position: absolute; top: 62px; left: 0; right: 0; z-index: 2; background: #fff; border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 10px 30px rgb(15 23 42 / 12%); max-height: 220px; overflow: auto; padding: 4px; }
.lecturer-dropdown button { width: 100%; border: 0; background: transparent; text-align: left; padding: 8px 10px; border-radius: 6px; cursor: pointer; display: flex; justify-content: space-between; gap: 8px; }
.lecturer-dropdown button:hover { background: var(--bg); }
.field-help { margin: 2px 0 0; font-size: 12px; color: var(--text-muted); }
.confirm-modal { width: min(460px, 92vw); max-height: 88vh; overflow: auto; padding: 20px; border-radius: 8px; background: #fff; }
.confirm-actions { display: flex; flex-direction: column; gap: 10px; }
.quick-field { margin-bottom: 12px; }
.field-checkboxes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; max-height: 220px; overflow: auto; padding: 8px; border: 1px solid var(--border); border-radius: 6px; }
.field-check { display: flex; align-items: center; gap: 6px; font-weight: 400 !important; }
.import-modal-card { width: min(620px, 92vw); max-height: 88vh; overflow: auto; padding: 22px; border-radius: 10px; background: #fff; box-shadow: 0 20px 60px rgb(15 23 42 / 24%); }
.import-modal-card h3 { margin-top: 0; }
.import-step { display: flex; gap: 12px; padding: 14px 0; border-top: 1px solid var(--border); }
.import-step:first-of-type { border-top: 0; }
.step-index { width: 32px; height: 32px; border-radius: 50%; background: var(--primary-light, #dbeafe); color: var(--primary); display: grid; place-items: center; font-weight: 700; flex-shrink: 0; }
.step-title { font-weight: 700; color: var(--text); margin-bottom: 4px; }
.step-content { flex: 1; min-width: 0; }
.step-content p { margin: 4px 0 10px; color: var(--text-secondary); font-size: 13px; line-height: 1.6; }
.import-file-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.import-file-name { font-size: 12px; color: var(--text-secondary); }
.modal-actions { margin-top: 16px; display: flex; gap: 10px; justify-content: flex-end; }
.btn-primary:disabled, .btn-secondary:disabled { opacity: 0.55; cursor: not-allowed; }
@media (max-width: 720px) {
  .toolbar-actions, .pagination { margin-left: 0; }
  .form-grid, .field-checkboxes { grid-template-columns: 1fr; }
}
</style>
