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
      <button class="btn secondary" @click="exportExperts">导出Excel</button>
      <button class="btn secondary" @click="triggerImport">导入</button>
    </div>

    <!-- Filter row -->
    <div class="admin-filter-row">
      <span class="filter-label">领域：</span>
      <select v-model="filterField" class="filter-select">
        <option value="">全部领域</option>
        <option v-for="f in store.fields" :key="f.name" :value="f.name">{{ f.name }}</option>
      </select>

      <span class="filter-label">评分：</span>
      <div class="score-range-filter">
        <input
          v-model.number="filterScoreMin"
          type="number"
          step="0.1"
          min="0"
          max="5"
          placeholder="最低 ★"
        />
        <span>-</span>
        <input
          v-model.number="filterScoreMax"
          type="number"
          step="0.1"
          min="0"
          max="5"
          placeholder="最高 ★"
        />
      </div>

      <span class="filter-label">状态：</span>
      <select v-model="filterStatus" class="filter-select">
        <option value="">全部状态</option>
        <option value="active">正常</option>
        <option value="observation">观察中</option>
        <option value="eliminated">已淘汰</option>
      </select>

      <button class="btn clear-btn" @click="clearFilters">清除筛选</button>
    </div>

    <div class="admin-sort-row">
      <span class="filter-label">排序：</span>
      <button
        v-for="option in adminSortOptions"
        :key="option.id"
        class="sort-pill"
        :class="{ active: filterSort === option.id }"
        @click="filterSort = option.id"
      >
        {{ option.name }}
      </button>
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

    <!-- Create / Edit Modal (V5 结构) -->
    <div v-if="showModal" class="modal-mask" @click.self="closeModal">
      <form class="modal-card" @submit.prevent="submitForm">
        <h3>{{ form.id ? '编辑专家：' + form.name : '新增专家' }}</h3>

        <label>姓名 *<input v-model.trim="form.name" required /></label>

        <label>适用领域（多选）</label>
        <div class="checkbox-list">
          <label v-for="field in store.fields" :key="field.name" class="inline-check field-chip" :style="{ '--chip': field.color }">
            <input v-model="form.fields" type="checkbox" :value="field.name" /> {{ field.name }}
          </label>
        </div>

        <div class="form-row">
          <label>学历<input v-model="form.education" /></label>
          <label>库内供应商
            <select v-model="form.isSupplier">
              <option :value="false">否</option>
              <option :value="true">是</option>
            </select>
          </label>
        </div>

        <label>突出优势（每行一条，用■开头，如：■行业经验：20年乳业咨询）</label>
        <textarea v-model="advantagesText" rows="3" placeholder="■行业经验：20年乳业咨询经验"></textarea>

        <label>专家卡优势概括（1-3条，每行一条，显示在专家卡片上）</label>
        <textarea v-model="form.advDisplay" rows="2" placeholder="例：供应链管理专家，10年供应链管理经历"></textarea>

        <label>专家卡资历概括（1-3条，每行一条，显示在专家卡片上）</label>
        <textarea v-model="form.qualDisplay" rows="2" placeholder="例：智篆商业智库专家"></textarea>

        <!-- 资历资质（子标题 + 内容，可增删） -->
        <label>资历资质（选择子标题类型，填写对应内容）</label>
        <div class="repeat-list">
          <div v-for="(pair, idx) in qualPairs" :key="'q' + idx" class="repeat-row">
            <select v-model="pair.subtitle" class="repeat-select">
              <option v-for="opt in qualSubtitleOptions" :key="opt" :value="opt">{{ opt }}</option>
              <option v-if="pair.subtitle && !qualSubtitleOptions.includes(pair.subtitle)" :value="pair.subtitle">{{ pair.subtitle }}</option>
            </select>
            <input v-model="pair.content" class="repeat-input" placeholder="请填写内容" />
            <button type="button" class="row-move" :disabled="idx === 0" @click="moveQual(idx, -1)">↑</button>
            <button type="button" class="row-move" :disabled="idx === qualPairs.length - 1" @click="moveQual(idx, 1)">↓</button>
            <button type="button" class="row-del" @click="removeQual(idx)">✕</button>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" @click="addQual">+ 添加资历项</button>
        </div>

        <!-- 参考案例（固定子标题） -->
        <label>参考案例</label>
        <div class="repeat-list">
          <div v-for="(pair, idx) in casePairs" :key="'c' + idx" class="repeat-block">
            <div class="repeat-subtitle">{{ pair.subtitle }}</div>
            <textarea v-model="pair.content" rows="2" :placeholder="'请填写' + pair.subtitle + '相关内容'"></textarea>
          </div>
        </div>

        <!-- 联系方式（多联系人） -->
        <div class="detail-section-title" style="margin-top:16px">联系方式</div>
        <div class="repeat-list">
          <div v-for="(c, idx) in contacts" :key="'m' + idx" class="repeat-row">
            <input v-model="c.person" class="repeat-input" placeholder="联系人姓名" />
            <select v-model="c.type" class="repeat-select" style="width:90px">
              <option value="phone">电话</option>
              <option value="wechat">微信</option>
              <option value="email">邮箱</option>
            </select>
            <input v-model="c.info" class="repeat-input" placeholder="电话/微信/邮箱" />
            <button type="button" class="row-del" @click="removeContact(idx)">✕</button>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" @click="addContact">+ 新增联系人</button>
        </div>

        <label>内部推荐人<input v-model="form.referrer" /></label>

        <div class="project-collapse">
          <button type="button" class="project-toggle" @click="showProjectPanel = !showProjectPanel">
            合作项目（{{ currentExpertProjects.length }}）
            <span>{{ showProjectPanel ? '收起 ▲' : '展开 ▼' }}</span>
          </button>
          <div v-if="showProjectPanel" class="project-list">
            <div v-for="p in currentExpertProjects" :key="p.id" class="project-item">
              <div class="project-title">{{ p.title || '未命名项目' }}</div>
              <div class="project-meta">
                {{ p.year || '-' }}{{ p.month ? '年' + String(p.month).padStart(2, '0') + '月' : '年' }}
              </div>
            </div>
            <div v-if="currentExpertProjects.length === 0" class="project-empty">暂无合作项目</div>
          </div>
        </div>

        <label>评分（0-5★，可手动调整）</label>
        <div class="form-row">
          <label>专业度<input v-model.number="form.scores.professional" type="number" step="0.1" min="0" max="5" /></label>
          <label>影响力<input v-model.number="form.scores.influence" type="number" step="0.1" min="0" max="5" /></label>
          <label>综合评分<input v-model.number="form.scores.overall" type="number" step="0.1" min="0" max="5" /></label>
        </div>

        <label>状态
          <select v-model="form.status">
            <option value="active">正常</option>
            <option value="observation">观察中</option>
            <option value="eliminated">已淘汰</option>
          </select>
        </label>

        <label>录入信息</label>
        <div class="form-row readonly-row">
          <label>录入时间<input :value="form.createdAt ? formatDate(form.createdAt) : '-'" readonly /></label>
          <label>录入者<input :value="form.createdBy || '主管理员'" readonly /></label>
        </div>

        <div class="modal-actions">
          <button class="btn primary" type="submit">保存修改</button>
          <button class="btn" type="button" @click="closeModal">取消</button>
        </div>
      </form>
    </div>

    <div v-if="showImportModal" class="modal-mask" @click.self="closeImportModal">
      <div class="import-modal-card">
        <h3>批量导入专家数据</h3>
        <div class="import-step">
          <div class="step-index">①</div>
          <div class="step-content">
            <div class="step-title">下载导入模板</div>
            <p>请先下载标准 Excel 模板，按字段填写专家信息后再上传。</p>
            <button type="button" class="btn secondary" @click="downloadImportTemplate">下载导入模板</button>
          </div>
        </div>
        <div class="import-step">
          <div class="step-index">②</div>
          <div class="step-content">
            <div class="step-title">选择文件并导入</div>
            <p>系统自动检测重复专家（基于姓名），由管理员确认后处理。导入不会覆盖已有数据。</p>
            <div class="import-file-row">
              <button type="button" class="btn secondary" @click="importFileInput?.click()">选择文件</button>
              <span class="import-file-name">{{ importFileName || '未选择文件' }}</span>
            </div>
            <input
              ref="importFileInput"
              type="file"
              accept=".xlsx,.xls"
              style="display: none"
              @change="onImportFileSelected"
            />
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn primary" type="button" :disabled="!pendingImportFile" @click="uploadImportFile">上传并导入</button>
          <button class="btn" type="button" @click="closeImportModal">取消</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useAppStore } from '@/store/appStore'
import type { Expert, Scores, ContactInfo, Project } from '@/types'
import { formatDate } from '@/utils/helpers'
import * as XLSX from 'xlsx'

const store = useAppStore()
const importFileInput = ref<HTMLInputElement | null>(null)
const showImportModal = ref(false)
const pendingImportFile = ref<File | null>(null)
const importFileName = ref('')

// ===== Filters (local, reset on tab switch) =====
const filterField = ref('')
const filterSort = ref('default')
const filterScoreMin = ref<number | null>(null)
const filterScoreMax = ref<number | null>(null)
const filterStatus = ref('')

const adminSortOptions = [
  { id: 'default', name: '默认（姓名）' },
  { id: 'overall', name: '综合评分 ▼' },
  { id: 'createdAt', name: '录入时间 ▼' },
  { id: 'nameAsc', name: '姓名 A-Z' },
]

function clearFilters() {
  filterField.value = ''
  filterSort.value = 'default'
  filterScoreMin.value = null
  filterScoreMax.value = null
  filterStatus.value = ''
}

const filteredExperts = computed(() => {
  let list = store.experts
  const q = store.adminSearchQuery.trim().toLowerCase()
  if (q) list = list.filter(e => e.name?.toLowerCase().includes(q))
  if (filterField.value) list = list.filter(e => (e.fields || []).includes(filterField.value))
  if (filterScoreMin.value != null) {
    list = list.filter(e => e.scores?.overall != null && e.scores.overall >= Number(filterScoreMin.value))
  }
  if (filterScoreMax.value != null) {
    list = list.filter(e => e.scores?.overall != null && e.scores.overall <= Number(filterScoreMax.value))
  }
  if (filterStatus.value) {
    list = list.filter(
      e =>
        e.status === filterStatus.value ||
        (filterStatus.value === 'observation' && (e.status === 'observation' || e.observationStatus))
    )
  }
  // 「排序一行」：按选定维度排序
  const arr = [...list]
  const sort = filterSort.value
  if (sort === 'overall') arr.sort((a, b) => (b.scores?.overall ?? 0) - (a.scores?.overall ?? 0))
  else if (sort === 'createdAt') arr.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
  else arr.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh'))
  return arr
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

// ===== Export / Import (Excel) =====
function exportExperts() {
  const rows = filteredExperts.value.map(e => {
    const contacts = getContactList(e)
    const contactStr = contacts.map(c => (c.person ? c.person + '：' : '') + c.info).join(' / ')
    return {
      姓名: e.name || '',
      适用领域: (e.fields || []).join('、'),
      学历: e.education || '',
      核心优势: (e.advantages || []).map(a => typeof a === 'string' ? a : `${a.title || ''}：${a.desc || ''}`).join('\n'),
      专家卡优势概括: e.advDisplay || '',
      专家卡资历概括: e.qualDisplay || '',
      资历资质: e.qualifications || '',
      参考案例: e.courses || '',
      库内供应商: e.isSupplier ? '是' : '否',
      内部推荐人: e.referrer || '',
      专业度: e.scores?.professional ?? '',
      影响力: e.scores?.influence ?? '',
      综合评分: e.scores?.overall ?? '',
      联系人: contacts.map(c => c.person).join('、') || '',
      联系方式: contactStr,
      状态: statusInfo(e).label,
      录入时间: e.createdAt ? formatDate(e.createdAt).slice(0, 10) : '',
      录入者: e.createdBy || '主管理员',
    }
  })
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '专家')
  XLSX.writeFile(wb, `专家库导出-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function triggerImport() {
  showImportModal.value = true
}

function closeImportModal() {
  showImportModal.value = false
  pendingImportFile.value = null
  importFileName.value = ''
  if (importFileInput.value) importFileInput.value.value = ''
}

function onImportFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] || null
  pendingImportFile.value = file
  importFileName.value = file?.name || ''
}

function downloadImportTemplate() {
  const rows = [
    {
      姓名: '',
      适用领域: '',
      学历: '',
      库内供应商: '否',
      核心优势: '■行业经验：',
      专家卡优势概括: '',
      专家卡资历概括: '',
      资历资质: '【职称/荣誉头衔】\n【社会职务】\n【履历资历】',
      参考案例: '【核心课程】\n【服务经历】',
      联系人: '',
      联系方式: '',
      内部推荐人: '',
      专业度: '',
      影响力: '',
      综合评分: '',
      状态: '正常',
    },
  ]
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '导入模板')
  XLSX.writeFile(wb, '专家导入模板.xlsx')
}

function uploadImportFile() {
  if (!pendingImportFile.value) return
  importExpertsFromFile(pendingImportFile.value)
}

function importExpertsFromFile(file: File) {
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const wb = XLSX.read(reader.result as ArrayBuffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })
      let ok = 0
      let fail = 0
      let skipped = 0
      for (const r of rows) {
        const name = String(r['姓名'] || r['name'] || '').trim()
        if (!name) { fail++; continue }
        if (store.experts.some(e => e.name === name)) { skipped++; continue }
        const fields = String(r['适用领域'] || r['fields'] || '')
          .split(/[、,，]/).map((s: string) => s.trim()).filter(Boolean)
        const advantages = String(r['核心优势'] || r['突出优势'] || r['advantages'] || '')
          .split('\n').map((s: string) => s.trim()).filter(Boolean)
        const contactsRaw = String(r['联系方式'] || r['contactInfo'] || '')
        const contacts: ContactInfo[] = contactsRaw
          ? [{ type: 'phone', info: contactsRaw, value: contactsRaw, person: String(r['联系人'] || r['contactPerson'] || '') }]
          : []
        const statusMap: Record<string, string> = { 正常: 'active', 观察中: 'observation', 已淘汰: 'eliminated', active: 'active', observation: 'observation', eliminated: 'eliminated' }
        const status = statusMap[String(r['状态'] || r['status'] || '').trim()] || 'active'
        const payload: Partial<Expert> = {
          name,
          fields,
          education: String(r['学历'] || r['education'] || ''),
          advantages,
          advDisplay: String(r['专家卡优势概括'] || r['advDisplay'] || ''),
          qualDisplay: String(r['专家卡资历概括'] || r['qualDisplay'] || ''),
          qualifications: String(r['资历资质'] || r['qualifications'] || ''),
          courses: String(r['参考案例'] || r['courses'] || ''),
          contacts,
          contactPerson: String(r['联系人'] || r['contactPerson'] || ''),
          contactInfo: contactsRaw,
          contactType: 'phone',
          referrer: String(r['内部推荐人'] || r['referrer'] || ''),
          isSupplier: String(r['库内供应商'] || r['isSupplier'] || '').includes('是'),
          status,
          scores: {
            professional: parseFloat(r['专业度'] ?? r['professional']) || null,
            influence: parseFloat(r['影响力'] ?? r['influence']) || null,
            overall: parseFloat(r['综合评分'] ?? r['overall']) || null,
          },
        }
        try {
          await store.saveExpert(payload)
          ok++
        } catch {
          store.experts.push({ ...payload, id: -Date.now() - ok } as Expert)
          store.persistLocal()
          ok++
        }
      }
      window.alert(`成功导入 ${ok} 条专家${skipped ? `，${skipped} 条重复姓名已跳过` : ''}${fail ? `，${fail} 条因缺少姓名跳过` : ''}`)
      closeImportModal()
    } catch (err) {
      window.alert('导入失败：' + (err as Error).message)
    }
  }
  reader.readAsArrayBuffer(file)
}

// ===== Create / Edit =====
const showModal = ref(false)
const advantagesText = ref('')
const qualSubtitleOptions = ['职称/荣誉头衔', '社会职务', '履历资历']
const qualPairs = ref<{ subtitle: string; content: string }[]>([])
const casePairs = ref<{ subtitle: string; content: string }[]>([])
const contacts = ref<ContactInfo[]>([])

const emptyForm = (): Partial<Expert> & { scores: Scores } => ({
  name: '',
  fields: [],
  advantages: [],
  education: '',
  qualDisplay: '',
  advDisplay: '',
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
const showProjectPanel = ref(false)

const currentExpertProjects = computed<Project[]>(() => {
  if (!form.id) return []
  return store.yiliProjects
    .filter(p => p.expertId === form.id)
    .sort((a, b) => (b.year || 0) - (a.year || 0) || (b.month || 0) - (a.month || 0))
})

function parsePairs(text?: string): { subtitle: string; content: string }[] {
  if (!text) return []
  const pairs: { subtitle: string; content: string }[] = []
  const parts = String(text).split(/【([^】]+)】/)
  for (let i = 1; i < parts.length; i += 2) {
    pairs.push({ subtitle: parts[i].trim(), content: (parts[i + 1] || '').trim() })
  }
  if (pairs.length === 0 && String(text).trim()) pairs.push({ subtitle: '', content: String(text).trim() })
  return pairs
}

function resetForm(data: Partial<Expert> = emptyForm()) {
  Object.assign(form, emptyForm(), data, { fields: [...(data.fields || [])] })
  showProjectPanel.value = false
  advantagesText.value = (data.advantages || [])
    .map(a => (typeof a === 'string' ? a : a.title && a.desc ? `${a.title}：${a.desc}` : a.desc || a.title || ''))
    .join('\n')
  qualPairs.value = parsePairs(data.qualifications).length ? parsePairs(data.qualifications) : [{ subtitle: '职称/荣誉头衔', content: '' }]
  casePairs.value = (['核心课程', '服务经历']).map(sub => {
    const found = parsePairs(data.courses).find(p => p.subtitle === sub)
    return found || { subtitle: sub, content: '' }
  })
  const cl = getContactList(data as Expert)
  contacts.value = cl.length ? cl.map(c => ({ person: c.person, info: c.info, value: c.info, type: 'phone' })) : [{ person: '', info: '', value: '', type: 'phone' }]
}

function addQual() { qualPairs.value.push({ subtitle: '职称/荣誉头衔', content: '' }) }
function moveQual(idx: number, dir: -1 | 1) {
  const next = idx + dir
  if (next < 0 || next >= qualPairs.value.length) return
  const item = qualPairs.value[idx]
  qualPairs.value.splice(idx, 1)
  qualPairs.value.splice(next, 0, item)
}
function removeQual(idx: number) {
  qualPairs.value.splice(idx, 1)
  if (qualPairs.value.length === 0) qualPairs.value.push({ subtitle: '职称/荣誉头衔', content: '' })
}
function addContact() { contacts.value.push({ person: '', info: '', value: '', type: 'phone' }) }
function removeContact(idx: number) {
  if (contacts.value.length <= 1) return
  contacts.value.splice(idx, 1)
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
  // 资历资质 → 【子标题】内容
  form.qualifications = qualPairs.value
    .filter(p => p.subtitle || p.content)
    .map(p => '【' + (p.subtitle || '未分类') + '】' + (p.content || ''))
    .join('\n')
  // 参考案例 → 【子标题】内容
  form.courses = casePairs.value
    .filter(p => p.subtitle || p.content)
    .map(p => '【' + (p.subtitle || '未分类') + '】' + (p.content || ''))
    .join('\n')
  // 联系方式
  const validContacts = contacts.value.filter(c => c.person || c.info)
  const contactArr = validContacts.length ? validContacts : [{ person: '', info: '', value: '', type: 'phone' }]
  form.contacts = contactArr
  form.contactPerson = contactArr[0].person
  form.contactInfo = contactArr[0].info
  form.contactType = contactArr[0].type || 'phone'
  try {
    await store.saveExpert({ ...form })
  } catch {
    store.persistLocal()
  }
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
.score-range-filter {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 176px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
}
.score-range-filter input {
  width: 66px;
  border: 0;
  outline: 0;
  padding: 1px 0;
  font-size: 12px;
  background: transparent;
}
.admin-sort-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin: 0 0 12px;
}
.sort-pill {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: var(--transition);
}
.sort-pill.active,
.sort-pill:hover {
  border-color: var(--primary);
  background: var(--primary-light, #dbeafe);
  color: var(--primary);
  font-weight: 600;
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
  width: min(860px, 94vw);
  max-height: 88vh;
  overflow: auto;
  padding: 20px;
  border-radius: 8px;
  background: #fff;
}
.import-modal-card {
  width: min(620px, 92vw);
  max-height: 88vh;
  overflow: auto;
  padding: 22px;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 20px 60px rgb(15 23 42 / 24%);
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
.field-chip {
  padding: 4px 10px;
  border-radius: 16px;
  border: 1px solid var(--chip, var(--border));
  color: #374151;
  background: color-mix(in srgb, var(--chip, #64748b) 12%, #fff);
}
.field-chip:has(input:checked) {
  background: color-mix(in srgb, var(--chip) 16%, #fff);
  border-color: var(--chip);
}
.field-chip:has(input:checked) span { color: var(--chip); font-weight: 600; }

/* 可重复条目（资历/案例/联系方式） */
.repeat-list { display: flex; flex-direction: column; gap: 8px; margin: 4px 0 8px; }
.repeat-row { display: flex; gap: 8px; align-items: center; }
.repeat-select {
  padding: 7px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; background: #fff;
}
.repeat-input {
  flex: 1; padding: 7px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; font-family: inherit;
}
.row-del {
  flex-shrink: 0; padding: 6px 10px; border: 1px solid #fecaca; border-radius: 6px;
  background: #fef2f2; color: #dc2626; cursor: pointer; font-size: 12px;
}
.row-move {
  flex-shrink: 0; padding: 6px 9px; border: 1px solid #bfdbfe; border-radius: 6px;
  background: #eff6ff; color: #2563eb; cursor: pointer; font-size: 12px;
}
.row-move:disabled { opacity: 0.45; cursor: not-allowed; }
.row-del:hover { background: #fee2e2; }
.repeat-block { border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; background: var(--bg); }
.repeat-subtitle {
  font-size: 12px; font-weight: 600; color: var(--text); margin-bottom: 4px;
  padding: 4px 8px; background: var(--bg); border-radius: 4px; border-left: 3px solid var(--primary);
}
.repeat-block textarea { width: 100%; margin-top: 0; }
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
.project-collapse {
  margin: 12px 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.project-toggle {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border: 0;
  background: var(--bg);
  color: var(--text);
  font-weight: 600;
  cursor: pointer;
}
.project-list { padding: 10px 12px; display: grid; gap: 8px; }
.project-item { padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; background: #fff; }
.project-title { font-size: 13px; font-weight: 600; color: var(--text); }
.project-meta, .project-empty { font-size: 12px; color: var(--text-secondary); }
.readonly-row input { background: #f8fafc; color: var(--text-secondary); }
.import-step {
  display: flex;
  gap: 12px;
  padding: 14px 0;
  border-top: 1px solid var(--border);
}
.import-step:first-of-type { border-top: 0; }
.step-index {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--primary-light, #dbeafe);
  color: var(--primary);
  display: grid;
  place-items: center;
  font-weight: 700;
  flex-shrink: 0;
}
.step-title { font-weight: 700; color: var(--text); margin-bottom: 4px; }
.step-content p { margin: 4px 0 10px; color: var(--text-secondary); font-size: 13px; line-height: 1.6; }
.import-file-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.import-file-name { font-size: 12px; color: var(--text-secondary); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
</style>
