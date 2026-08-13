/**
 * 导入合作项目 Excel 到 frontend/public/data.js
 * 用途：后端未启动/数据未迁移时，将 23 项合作项目作为离线种子写入 EXPERT_DATA.yiliProjects
 * 逻辑与 ProjectsTab.onImportFile 保持一致：按"关联讲师"匹配 experts[].name 得到 expertId
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)
const XLSX = require(path.join(__dirname, '../frontend/node_modules/xlsx'))

const EXCEL_PATH = 'C:/Users/PC/Downloads/合作项目_2026-08-13.xlsx'
const PUBLIC_DATA_JS = path.join(__dirname, '../frontend/public/data.js')
const DIST_DATA_JS = path.join(__dirname, '../frontend/dist/data.js')

function parseDataJs(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const prefix = 'const EXPERT_DATA = '
  if (!raw.trimStart().startsWith(prefix)) {
    throw new Error(`文件 ${filePath} 不是预期的 const EXPERT_DATA = ... 格式`)
  }
  let json = raw.trimStart().slice(prefix.length).trimEnd()
  if (json.endsWith(';')) json = json.slice(0, -1)
  return { data: JSON.parse(json), rawPrefix: prefix }
}

function stringifyDataJs(data) {
  return 'const EXPERT_DATA = ' + JSON.stringify(data, null, 2) + ';\n'
}

function parseSatisfaction(rawValue, rawScale) {
  const value = parseFloat(rawValue)
  const scale = parseInt(rawScale) || 10
  if (!Number.isFinite(value) || value <= 0) return null
  return JSON.stringify({ value, scale })
}

function main() {
  // 1. 读取 Excel
  const workbook = XLSX.readFile(EXCEL_PATH)
  const sheetName = workbook.SheetNames[0]
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })

  // 2. 读取 data.js 专家库
  const { data } = parseDataJs(PUBLIC_DATA_JS)
  const experts = Array.isArray(data.experts) ? data.experts : []
  const nameToId = new Map()
  for (const e of experts) {
    if (e && e.name && e.id != null && !nameToId.has(e.name)) {
      nameToId.set(e.name, e.id)
    }
  }

  // 3. 转换项目
  const projects = []
  let matchedCount = 0
  let unmatchedCount = 0
  const unmatchedNames = new Set()
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const title = String(r['项目名称'] || '').trim()
    if (!title) continue
    const lecturer = String(r['关联讲师'] || '').trim()
    const expertId = nameToId.get(lecturer) ?? null
    if (expertId != null) matchedCount++
    else {
      unmatchedCount++
      if (lecturer) unmatchedNames.add(lecturer)
    }

    const createdRaw = r['创建时间']
    let createdAt
    if (createdRaw instanceof Date) {
      createdAt = createdRaw.toISOString()
    } else if (typeof createdRaw === 'number') {
      // Excel 日期序列号
      const d = XLSX.SSF.parse_date_code(createdRaw)
      createdAt = new Date(Date.UTC(d.y, d.m - 1, d.d, d.H, d.M, d.S)).toISOString()
    } else if (createdRaw) {
      const d = new Date(createdRaw)
      createdAt = Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
    } else {
      createdAt = new Date().toISOString()
    }

    projects.push({
      id: -(i + 1),
      title,
      expertId,
      pendingExpertName: expertId != null ? '' : lecturer,
      year: parseInt(r['合作年份']) || new Date().getFullYear(),
      month: parseInt(r['合作月份']) || null,
      satisfaction: parseSatisfaction(r['满意度分值'], r['满意度量程']),
      desc: String(r['项目描述'] || ''),
      visible: String(r['前端显示'] || '').includes('是'),
      createdBy: 'system',
      createdAt,
      updatedAt: createdAt,
    })
  }

  // 4. 报告
  console.log(`\n=== 合作项目导入报告 ===`)
  console.log(`Excel 行数: ${rows.length}`)
  console.log(`有效项目: ${projects.length}`)
  console.log(`已关联专家: ${matchedCount}`)
  console.log(`待关联: ${unmatchedCount}`)
  if (unmatchedNames.size > 0) {
    console.log(`待关联讲师: ${Array.from(unmatchedNames).join('、')}`)
  }
  console.log('\n项目明细:')
  for (const p of projects) {
    const link = p.expertId ? `→ 专家#${p.expertId}` : `待关联: ${p.pendingExpertName || '-'}`
    console.log(`  [${p.id}] ${p.title} (${p.year}${p.month ? '/' + p.month : ''}) ${link}`)
  }

  // 5. 写入 data.js
  data.yiliProjects = projects
  const output = stringifyDataJs(data)
  fs.writeFileSync(PUBLIC_DATA_JS, output, 'utf-8')
  console.log(`\n已写入: ${PUBLIC_DATA_JS}`)

  // 6. 同步 dist/data.js（若存在）
  if (fs.existsSync(DIST_DATA_JS)) {
    fs.writeFileSync(DIST_DATA_JS, output, 'utf-8')
    console.log(`已同步: ${DIST_DATA_JS}`)
  }
}

main()
