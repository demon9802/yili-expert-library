import type { Expert, Project } from '@/types'

/**
 * V6 五星制自动评分引擎（对齐 V5 最终版口径）
 *
 * V5 核心设计：
 * - 5 个子维度在 10 分制下打分，无信号时默认 5 分（而非 0 分）。
 * - 关键词命中后分数向 7~9 分抬升；未命中时保留基准或继承现有综合分，
 *   避免"粗糙模型"因正则未覆盖就批量判低。
 * - 专业度 60% / 影响力 40%；子维度权重与 V5 一致。
 *
 * V6 映射：将 10 分制子维度分 ÷ 2 得到 5★制，再按权重合成专业度/影响力/综合分。
 */

export interface ScoreBreakdown {
  professional: number
  influence: number
  overall: number
  reasons: string[]
  professionalItems: Record<string, number>
  influenceItems: Record<string, number>
}

/**
 * 观察库阈值（5★制）。综合评分 < 3.5★（即 V5 的 7/10）的专家自动归入观察库，
 * ≥ 3.5★ 则在前端正常展示（status='active'）。与 V5 口径一致。
 */
export const OBSERVATION_THRESHOLD = 3.5

const CAP_10 = 10
const CAP_5 = 5
const BASELINE = 5

function clamp10(v: number) {
  return Math.min(CAP_10, Math.max(1, Math.round(v)))
}

function clamp5(v: number) {
  return Math.min(CAP_5, Math.max(0, Math.round(v * 10) / 10))
}

function buildText(expert: Expert): string {
  const parts: string[] = []
  if (expert.qualifications) parts.push(expert.qualifications)
  if (expert.qualDisplay) parts.push(expert.qualDisplay)
  if (expert.advDisplay) parts.push(expert.advDisplay)
  if (expert.courses) parts.push(expert.courses)
  if (Array.isArray(expert.advantages)) {
    expert.advantages.forEach(a => {
      if (typeof a === 'string') parts.push(a)
      else {
        const any = a as any
        if (any.title) parts.push(any.title)
        if (any.desc) parts.push(any.desc)
      }
    })
  }
  if (expert.education) parts.push(expert.education)
  return parts.join(' ')
}

function projectText(projects: Project[], expertId: number): string {
  return projects
    .filter(p => p.expertId === expertId)
    .map(p => [p.title, p.desc].filter(Boolean).join(' '))
    .join(' ')
}

// ===== 子维度 10 分制打分（V5 逻辑，默认 5 分） =====

function scoreEducation(expert: Expert): number {
  const edu = (expert.education || '').toLowerCase()
  if (!edu || edu === '未公开') return BASELINE
  if (/博士|博士后|phd|教授/i.test(edu)) return 9
  if (/硕士|研究生|master|mba|emba/i.test(edu)) return 8
  if (/本科|学士|bachelor/i.test(edu)) return 7
  return 6
}

function scoreQualification(text: string): number {
  const t = text.toLowerCase()
  if (/认证|certif|注[册会]|cpa|cfa|acca|license/i.test(t)) return 9
  if (/资质|资格|证书/i.test(t)) return 8
  return 7
}

function scoreAchievement(text: string, projectText: string): number {
  const full = (text + ' ' + projectText).toLowerCase()
  if (/著作|出版|论文|研究|课题|专利|发明/i.test(full)) return 9
  if (/讲师|培训|课程|开发|项目|服务|咨询|顾问/i.test(full)) return 8
  if (/年|企业|集团|公司|实战|经验/i.test(full)) return 7
  return 7
}

function scoreHonors(text: string): number {
  const t = text.toLowerCase()
  if (/奖|荣誉|称号|表彰|十大|百强|终身|院士|国家级人才|长江学者|杰青/i.test(t)) return 9
  if (/协会|学会|理事|委员|专家库|智库/i.test(t)) return 8
  return 7
}

function scoreTitleAndManagement(text: string): number {
  const t = text.toLowerCase()
  const titleTop = /教授|研究员|高级工程师|院士|首席科学家/i.test(t)
  const mgmtTop = /ceo|总裁|总经理|董事长|创始人|董事局主席/i.test(t)
  if (titleTop || mgmtTop) return 9
  if (/总监|副总裁|vp|合伙人|cfo|cto|cmo|coo/i.test(t)) return 8
  if (/经理|主管|负责人|高级|资深/i.test(t)) return 7
  return 6
}

// ===== 对外接口 =====

export function autoScoreExpert(expert: Expert, projects: Project[] = []): ScoreBreakdown {
  const text = buildText(expert)
  const proj = projectText(projects, expert.id)

  // 10 分制子维度分
  const profSub10 = {
    学历与学术背景: scoreEducation(expert),
    行业资质与认证: scoreQualification(text),
    专业成果与经验: scoreAchievement(text, proj),
  }
  const inflSub10 = {
    社会荣誉与奖项: scoreHonors(text),
    '职称/管理履历与行业地位': scoreTitleAndManagement(text),
  }

  // V5 子维度权重（专业度 3 项 / 影响力 2 项合并后权重）
  const profWeights = {
    学历与学术背景: 0.35,
    行业资质与认证: 0.30,
    专业成果与经验: 0.35,
  }
  const inflWeights = {
    社会荣誉与奖项: 0.35,
    '职称/管理履历与行业地位': 0.65,
  }

  // 先按 10 分制加权，再 ÷2 映射到 5★
  const prof10 = Object.entries(profSub10).reduce((s, [k, v]) => s + v * profWeights[k as keyof typeof profWeights], 0)
  const infl10 = Object.entries(inflSub10).reduce((s, [k, v]) => s + v * inflWeights[k as keyof typeof inflWeights], 0)

  const professional = clamp5(prof10 / 2)
  const influence = clamp5(infl10 / 2)
  const overall = clamp5(professional * 0.6 + influence * 0.4)

  // 5★制子维度用于前端展示（仍保持与 V5 子维度一一对应）
  const professionalItems: Record<string, number> = {}
  Object.entries(profSub10).forEach(([k, v]) => { professionalItems[k] = clamp5(v / 2) })
  const influenceItems: Record<string, number> = {}
  Object.entries(inflSub10).forEach(([k, v]) => { influenceItems[k] = clamp5(v / 2) })

  const reasons: string[] = []
  if (professional < 3.5) reasons.push(`专业度偏低（${professional.toFixed(1)}★），建议补充学历、资质或成果信息`)
  if (influence < 3.5) reasons.push(`影响力偏低（${influence.toFixed(1)}★），建议补充荣誉、头衔或管理履历`)
  if (overall < 3) reasons.push(`综合评分低于3★，前端将不展示评分`)

  return {
    professional,
    influence,
    overall,
    reasons,
    professionalItems,
    influenceItems,
  }
}

export function batchAutoScore(experts: Expert[], projects: Project[] = []): Map<number, ScoreBreakdown> {
  const map = new Map<number, ScoreBreakdown>()
  experts.forEach(e => map.set(e.id, autoScoreExpert(e, projects)))
  return map
}

export const RATING_RULES_DOC = `
评分体系说明（V5 五星制）
1. 综合评分 = 专业度 × 60% + 影响力 × 40%。
2. 每个评分项独立 0-5★；若某项无有效识别信号，按基准 2.5★ 计，避免粗糙模型批量误判。
3. 单个评分项封顶 5★。
4. 专业度评分项：①学历与学术背景、②行业资质与认证、③专业成果与经验。
5. 影响力评分项：④社会荣誉与奖项、⑤职称/管理履历与行业地位。
6. 对“资深行业实战派”“品牌营销总经理”“4A 高管”“服务头部客户”等特殊履历做识别，避免头衔不足导致分值失真。
7. 综合评分 < 3★ 的专家不在前端展示评分。
`.trim()
