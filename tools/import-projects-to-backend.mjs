import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)
const XLSX = require(path.join(__dirname, '../frontend/node_modules/xlsx'))

const EXCEL_PATH = process.env.PROJECTS_EXCEL || 'C:/Users/PC/Downloads/合作项目_2026-08-13.xlsx'
const API_BASE = process.env.API_BASE || 'http://localhost:8080/api'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'master@yili.local'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'yili2026'
const SQL_FALLBACK_PATH = path.join(__dirname, 'import-projects-fallback.sql')
const DRY_RUN = process.argv.includes('--dry-run')

function excelDateToIso(value) {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value)
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H, d.M, d.S)).toISOString()
  }
  if (value) {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return new Date().toISOString()
}

function toMysqlDateTime(value) {
  const d = new Date(value)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function parseSatisfaction(valueRaw, scaleRaw) {
  const value = parseFloat(valueRaw)
  const scale = parseInt(scaleRaw) || 10
  if (!Number.isFinite(value) || value <= 0) return null
  return JSON.stringify({ value, scale })
}

function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, '')
}

function readProjectsFromExcel() {
  const workbook = XLSX.readFile(EXCEL_PATH, { cellDates: true })
  const sheetName = workbook.SheetNames.includes('合作项目') ? '合作项目' : workbook.SheetNames[0]
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })
  const projects = []

  for (const row of rows) {
    const title = String(row['项目名称'] || '').trim()
    if (!title) continue
    const lecturer = String(row['关联讲师'] || '').trim()
    const createdAt = excelDateToIso(row['创建时间'])
    projects.push({
      title,
      lecturer,
      year: parseInt(row['合作年份']) || new Date().getFullYear(),
      month: parseInt(row['合作月份']) || null,
      satisfaction: parseSatisfaction(row['满意度分值'], row['满意度量程']),
      desc: String(row['项目描述'] || ''),
      visible: String(row['前端显示'] || '').trim() === '是',
      createdAt,
    })
  }

  return { sheetName, rows, projects }
}

async function apiRequest(pathname, options = {}, token = '') {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${API_BASE}${pathname}`, { ...options, headers })
  const text = await response.text()
  let json
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    throw new Error(`HTTP ${response.status}: ${text}`)
  }
  if (!response.ok || json?.code !== 200) {
    throw new Error(json?.message || `HTTP ${response.status}`)
  }
  return json.data
}

async function login() {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  if (!data?.token) throw new Error('登录响应中缺少 token')
  return data.token
}

function attachExperts(projects, experts) {
  const nameToExpert = new Map()
  for (const expert of experts) {
    const key = normalizeName(expert.name)
    if (key && !nameToExpert.has(key)) nameToExpert.set(key, expert)
  }

  let matched = 0
  let pending = 0
  const pendingNames = new Set()
  const attached = projects.map(project => {
    const expert = nameToExpert.get(normalizeName(project.lecturer))
    if (expert) matched++
    else {
      pending++
      if (project.lecturer) pendingNames.add(project.lecturer)
    }
    return {
      title: project.title,
      expertId: expert ? expert.id : null,
      pendingExpertName: expert ? '' : project.lecturer,
      year: project.year,
      month: project.month,
      satisfaction: project.satisfaction,
      desc: project.desc,
      visible: project.visible,
      createdBy: '主管理员',
      createdAt: project.createdAt,
      updatedAt: project.createdAt,
    }
  })

  return { attached, matched, pending, pendingNames: Array.from(pendingNames) }
}

function sqlValue(value) {
  if (value === null || value === undefined || value === '') return 'NULL'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? '1' : '0'
  return `'${String(value).replace(/'/g, "''")}'`
}

function writeSqlFallback(projects) {
  const lines = []
  lines.push('-- 合作项目导入 SQL fallback')
  lines.push('-- 执行前请确认目标库为伊利专家库 V6 MySQL 数据库')
  lines.push('')
  lines.push('INSERT INTO yl_expert_resource_project')
  lines.push('  (title, expert_id, pending_expert_name, year, month, satisfaction, description, visible, created_by, created_at, updated_at)')
  lines.push('VALUES')
  lines.push(projects.map(p => {
    const values = [
      p.title,
      p.expertId,
      p.pendingExpertName,
      p.year,
      p.month,
      p.satisfaction,
      p.desc,
      p.visible,
      p.createdBy,
      toMysqlDateTime(p.createdAt),
      toMysqlDateTime(p.updatedAt),
    ].map(sqlValue).join(', ')
    return `  (${values})`
  }).join(',\n') + ';')
  fs.writeFileSync(SQL_FALLBACK_PATH, lines.join('\n'), 'utf-8')
  return SQL_FALLBACK_PATH
}

function projectKey(project) {
  return `${project.title}__${project.year}__${project.month || ''}`
}

async function main() {
  const { sheetName, rows, projects } = readProjectsFromExcel()
  console.log('=== Excel 读取结果 ===')
  console.log(`文件: ${EXCEL_PATH}`)
  console.log(`Sheet: ${sheetName}`)
  console.log(`原始行数: ${rows.length}`)
  console.log(`有效项目: ${projects.length}`)

  let token
  try {
    token = await login()
    console.log('\n后端登录: 成功')
  } catch (error) {
    console.error('\n后端登录失败，无法按专家库匹配 expertId。')
    throw error
  }

  const experts = await apiRequest('/experts', {}, token)
  const { attached, matched, pending, pendingNames } = attachExperts(projects, experts)
  console.log('\n=== 导入前匹配统计 ===')
  console.log(`专家总数: ${experts.length}`)
  console.log(`待导入项目: ${attached.length}`)
  console.log(`已关联专家: ${matched}`)
  console.log(`待关联: ${pending}`)
  if (pendingNames.length) console.log(`待关联讲师: ${pendingNames.join('、')}`)

  const sqlPath = writeSqlFallback(attached)
  console.log(`SQL fallback 已生成: ${sqlPath}`)

  if (DRY_RUN) {
    console.log('\n--dry-run 已启用，未写入后端。')
    return
  }

  const existingProjects = await apiRequest('/projects', {}, token)
  const existingByKey = new Map(existingProjects.map(project => [projectKey(project), project]))
  let created = 0
  let updated = 0
  let failed = 0
  const failures = []

  for (const project of attached) {
    try {
      const existing = existingByKey.get(projectKey(project))
      if (existing?.id) {
        await apiRequest(`/projects/${existing.id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...project, id: existing.id }),
        }, token)
        updated++
      } else {
        await apiRequest('/projects', {
          method: 'POST',
          body: JSON.stringify(project),
        }, token)
        created++
      }
    } catch (error) {
      failed++
      failures.push(`${project.title}: ${error.message}`)
    }
  }

  console.log('\n=== 导入后写入统计 ===')
  console.log(`成功: ${created + updated}`)
  console.log(`新增: ${created}`)
  console.log(`更新: ${updated}`)
  console.log(`失败: ${failed}`)
  console.log(`已关联专家: ${matched}`)
  console.log(`待关联: ${pending}`)
  if (failures.length) {
    console.log('\n失败明细:')
    failures.forEach(item => console.log(`- ${item}`))
  }
}

main().catch(error => {
  console.error('\n导入失败:', error.message)
  process.exitCode = 1
})
