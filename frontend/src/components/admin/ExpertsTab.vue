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
        accept=".xlsx,.xls,.csv"
        style="display: none"
        @change="onImportFile"
      />
    </div>

    <!-- Filter row (含「排序一行」) -->
    <div class="admin-filter-row">
      <span class="filter-label">领域：</span>
      <select v-model="filterField" class="filter-select">
        <option value="">全部领域</option>
        <option v-for="f in store.fields" :key="f.name" :value="f.name">{{ f.name }}</option>
      </select>

      <span class="filter-label">排序：</span>
      <select v-model="filterSort" class="filter-select">
        <option value="">默认（姓名）</option>
        <option v-for="o in sortOptions" :key="o.id" :value="o.id">{{ o.name }}</option>
      </select>

      <span class="filter-label">评分：</span>
      <select v-model="filterScore" class="filter-select">
        <option value="">全部评分</option>
        <option value="4.5">4.5★及以上</option>
        <option value="4.0">4.0★及以上</option>
        <option value="3.5">3.5★及以上</option>
        <option value="3.0">3.0★及以上</option>
        <option value="2.5">2.5★及以上</option>
        <option value="2.0">2.0★及以上</option>
        <option value="1.0">1.0★及以上</option>
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

        <label>🃏 专家卡优势概括（1-3条，每行一条，显示在专家卡片上）</label>
        <textarea v-model="form.advDisplay" rows="2" placeholder="例：供应链管理专家，10年供应链管理经历"></textarea>

        <label>🃏 专家卡资历概括（1-3条，每行一条，显示在专家卡片上）</label>
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
        <div class="detail-section-title" style="margin-top:16px">📋 联系方式</div>
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
import type { Expert, Scores, ContactInfo } from '@/types'
import { formatDate } from '@/utils/helpers'
import * as XLSX from 'xlsx'

const store = useAppStore()
const importFileInput = ref<HTMLInputElement | null>(null)

// ===== Filters (local, reset on tab switch) =====
const filterField = ref('')
const filterSort = ref('')
const filterScore = ref('')
const filterStatus = ref('')

const sortOptions = computed(() => store.sortOptions)

function clearFilters() {
  filterField.value = ''
  filterSort.value = ''
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
  // 「排序一行」：按选定维度排序
  const arr = [...list]
  const sort = filterSort.value
  if (sort === 'overall') arr.sort((a, b) => (b.scores?.overall ?? 0) - (a.scores?.overall ?? 0))
  else if (sort === 'professional') arr.sort((a, b) => (b.scores?.professional ?? 0) - (a.scores?.professional ?? 0))
  else if (sort === 'influence') arr.sort((a, b) => (b.scores?.influence ?? 0) - (a.scores?.influence ?? 0))
  else arr.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
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
  importFileInput.value?.click()
}

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
      let fail = 0
      for (const r of rows) {
        const name = String(r['姓名'] || r['name'] || '').trim()
        if (!name) { fail++; continue }
        const fields = String(r['适用领域'] || r['fields'] || '')
          .split(/[、,，]/).map((s: string) => s.trim()).filter(Boolean)
        const advantages = String(r['核心优势'] || r['advantages'] || '')
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
          // 后端不可用时降级到本地，保证数据落地
          store.experts.push({ ...payload, id: -Date.now() - ok } as Expert)
          store.persistLocal()
          ok++
        }
      }
      window.alert(`成功导入 ${ok} 条专家${fail ? `，${fail} 条因缺少姓名跳过` : ''}`)
    } catch (err) {
      window.alert('导入失败：' + (err as Error).message)
    } finally {
      input.value = ''
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
.field-chip {
  padding: 4px 10px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: #fff;
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
</style>
