import type { Expert, Project } from '@/types'

/**
 * V6 五星制自动评分引擎
 *
 * 设计原则（对齐 V5.9.x）：
 * 1. 无子维度，只有评分项；每个评分项独立 0-5★。
 * 2. 专业度 60% + 影响力 40% 加权得出综合评分。
 * 3. 任一评分项无有效信号时，该项取缺失固定值 2★。
 * 4. 单个评分项封顶 5★。
 * 5. 综合 < 3★ 不在前端展示（由调用方控制）。
 * 6. 识别“资深行业实战派”等不易被常规头衔覆盖的专家，避免分值失真。
 */

export interface ScoreBreakdown {
  professional: number
  influence: number
  overall: number
  reasons: string[]
  professionalItems: Record<string, number>
  influenceItems: Record<string, number>
}

const MISSING = 2
const CAP = 5

function clamp(v: number) {
  return Math.min(CAP, Math.max(0, Math.round(v * 10) / 10))
}

function hasAny(patterns: RegExp[], text: string): boolean {
  return patterns.some(p => p.test(text))
}

function countMatches(patterns: RegExp[], text: string): number {
  return patterns.reduce((n, p) => n + (p.test(text) ? 1 : 0), 0)
}

function buildText(expert: Expert): string {
  const parts: string[] = []
  if (expert.education) parts.push(expert.education)
  if (expert.qualifications) parts.push(expert.qualifications)
  if (expert.qualDisplay) parts.push(expert.qualDisplay)
  if (expert.courses) parts.push(expert.courses)
  if (expert.advDisplay) parts.push(expert.advDisplay)
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
  return parts.join(' ')
}

function projectText(projects: Project[], expertId: number): string {
  return projects
    .filter(p => p.expertId === expertId)
    .map(p => [p.title, p.desc].filter(Boolean).join(' '))
    .join(' ')
}

// ===== 专业度评分项 =====

function scoreEducation(expert: Expert): number {
  const edu = (expert.education || '').toLowerCase()
  if (/博士|博士后|phd/i.test(edu)) return 5
  if (/硕士|研究生|mba|emba/i.test(edu)) return 4.5
  if (/本科|学士|双学位/i.test(edu)) return 4
  if (/专科|大专|本科以下/i.test(edu)) return 3
  if (edu && edu !== '未公开') return 2.5
  return MISSING
}

function scoreQualification(text: string): number {
  const strong = /(高级|资深|首席|专家|院士|教授|研究员).*?(认证|资格|资质)|cpa|cfa|acca|注册.{0,3}(会计|金融|工程师)|专利|发明专利|著作|出版|发表论文/i
  const medium = /认证|资格|资质|证书|讲师|培训师/i
  if (strong.test(text)) return 4.5
  if (medium.test(text)) return 3.8
  if (/资质|认证|资格/i.test(text)) return 3.2
  return MISSING
}

function scoreProfessionalExperience(text: string, projectText: string): number {
  const full = text + ' ' + projectText
  const strong = /(著作|出版|论文|研究|课题|专利|发明|方法论|模型|体系).*?(专家|作者|负责人)|多年实战|实战经验|服务(过)?头部|头部客户|世界500强|500强|行业标杆/i
  const medium = /讲师|培训|课程|开发|项目|咨询|顾问|服务|企业|集团|公司|行业经验|实战经验/i
  if (strong.test(full)) return 4.8
  if (medium.test(full)) {
    const hits = countMatches([
      /讲师|培训|课程|开发/, /项目|咨询|顾问/, /企业|集团|公司/,
      /行业经验|实战经验|多年/, /方法论|模型|体系/
    ], full)
    return 3.2 + Math.min(1.6, hits * 0.4)
  }
  return MISSING
}

function scoreCourses(expert: Expert): number {
  const c = (expert.courses || '').toLowerCase()
  if (!c) return MISSING
  if (/体系|方法论|模型|课程开发|主讲|核心课程/i.test(c)) return 4.5
  if (/课程|培训|授课/i.test(c)) return 3.8
  return 2.5
}

// ===== 影响力评分项 =====

function scoreHonors(text: string): number {
  const strong = /(国家|全国|全球|中国|年度|十大|百强|卓越|杰出|最具影响力|终身).*?(奖|荣誉|称号|人物|专家)|获奖|殊荣/i
  const medium = /奖|荣誉|称号|表彰|评优|优秀|先进/i
  const light = /协会|学会|理事|委员|会员|专家库|智库|顾问/i
  if (strong.test(text)) return 5
  if (medium.test(text)) {
    const hits = countMatches([/奖|获奖|殊荣/, /荣誉|称号|表彰/, /优秀|先进|杰出/], text)
    return 3.5 + Math.min(1.5, hits * 0.5)
  }
  if (light.test(text)) return 3.2
  return MISSING
}

function scoreTitles(text: string): number {
  const strong = /教授|研究员|高级工程师|院士|首席|专家|博士生导师/i
  const medium = /总监|副总裁|vp|合伙人|创始人|co-founder|cto|cmo|coo/i
  const light = /经理|主管|负责人|高级|资深|顾问|讲师/i
  if (strong.test(text)) return 5
  if (medium.test(text)) return 4.5
  if (light.test(text)) {
    const hits = countMatches([/高级|资深/, /经理|主管|负责人/, /顾问|讲师/], text)
    return 3.2 + Math.min(1.3, hits * 0.4)
  }
  return MISSING
}

function scoreManagementStatus(text: string): number {
  const cLevel = /ceo|总裁|总经理|董事长|创始人|co-founder|董事局主席/i
  const vp = /总监|副总裁|vp|合伙人|首席|cfo|cto|cmo|coo/i
  const manager = /经理|主管|负责人|总监/i
  const seniorPractitioner = /多年实战|品牌营销总经理|4a高管|服务头部客户|头部客户|行业领军人物|行业领袖|资深行业/i
  if (cLevel.test(text)) return 5
  if (vp.test(text)) return 4.5
  if (seniorPractitioner.test(text)) return 4.5
  if (manager.test(text)) {
    const hits = countMatches([/经理|主管/, /负责人|总监/, /资深|高级/], text)
    return 3.2 + Math.min(1.3, hits * 0.4)
  }
  return MISSING
}

// ===== 对外接口 =====

export function autoScoreExpert(expert: Expert, projects: Project[] = []): ScoreBreakdown {
  const text = buildText(expert)
  const proj = projectText(projects, expert.id)

  const professionalItems = {
    学历与学术背景: scoreEducation(expert),
    行业资质与认证: scoreQualification(text),
    专业成果与经验: scoreProfessionalExperience(text, proj),
    课程与培训体系: scoreCourses(expert),
  }

  const influenceItems = {
    社会荣誉与奖项: scoreHonors(text),
    职称与专业头衔: scoreTitles(text),
    管理履历与行业地位: scoreManagementStatus(text),
  }

  const profValues = Object.values(professionalItems)
  const inflValues = Object.values(influenceItems)

  const professional = clamp(profValues.reduce((s, v) => s + v, 0) / profValues.length)
  const influence = clamp(inflValues.reduce((s, v) => s + v, 0) / inflValues.length)
  const overall = clamp(professional * 0.6 + influence * 0.4)

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
2. 每个评分项独立 0-5★；若某项无有效识别信号，按缺失固定 2★ 计。
3. 单个评分项封顶 5★。
4. 专业度评分项：学历与学术背景、行业资质与认证、专业成果与经验、课程与培训体系。
5. 影响力评分项：社会荣誉与奖项、职称与专业头衔、管理履历与行业地位。
6. 对“资深行业实战派”等特殊履历做独立识别，避免头衔不足导致分值失真。
7. 综合评分 < 3★ 的专家不在前端展示评分。
`.trim()
