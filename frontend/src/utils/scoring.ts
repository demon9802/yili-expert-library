import type { Expert, Project } from '@/types'

/**
 * V6 五星制自动评分引擎（对齐 V5 最终版口径）
 *
 * V5 核心设计：
 * - 5 个子维度直接在 1-5★ 制下打分，信息缺失（未填/未公开/无法核实）固定按 2★ 计。
 * - 专业度 60% / 影响力 40%；子维度权重与 V5 一致。
 * - 观察库阈值：综合评分 < 3★ 进观察库，≥ 3★ 在前端展示。
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
 * 观察库阈值（5★制）。综合评分 < 3★ 的专家自动归入观察库，
 * ≥ 3★ 则在前端正常展示（status='active'）。
 */
export const OBSERVATION_THRESHOLD = 3

const CAP_5 = 5
const MISSING = 2 // 信息缺失固定 2★

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

// ===== 子维度 1-5★ 打分（V5 逻辑，信息缺失固定 2★） =====

function scoreEducation(expert: Expert): number {
  const edu = (expert.education || '').trim()
  if (!edu || edu === '未公开') return MISSING
  const e = edu.toLowerCase()
  // 5★：博士 + 顶尖院校
  if (/博士|博士后|phd/i.test(e) && /清华|北大|浙大|复旦|上交|中科大|南大|人大|港大|港中文|哈佛|麻省|斯坦福|牛津|剑桥|帝国理工|qs\s*前|qs\s*50|c9/i.test(e)) return 5
  // 4★：名校硕士 / 普通博士
  if (/博士|博士后|phd/i.test(e)) return 4
  if (/硕士|研究生|master|mba|emba/i.test(e) && /985|211|双一流|海外|世界|qs|著名|知名/i.test(e)) return 4
  // 3★：较好本科 / 普通硕士
  if (/硕士|研究生|master|mba|emba/i.test(e)) return 3
  if (/本科|学士|bachelor/i.test(e) && /211|双一流|一本|重点|海外/i.test(e)) return 3
  // 2★：普通本科
  if (/本科|学士|bachelor/i.test(e)) return 2
  // 1★：大专及以下
  return 1
}

function scoreQualification(text: string): number {
  const t = text.toLowerCase()
  if (!text.trim()) return MISSING
  // 5★：国际权威认证 / 多重国家级
  if (/cfa|cpa|acca|frm|法律职业资格|司法考试|一级建筑师|注册.*工程师|国际权威|国际认证/i.test(t)) return 5
  // 4★：国家级执业 / 行业权威认证（多重）
  if (/国家级执业|国家.*认证|行业权威|高级.*师|高级.*认证|多重认证|多项认证/i.test(t)) return 4
  // 3★：行业厂商认证 / 单一国家级资格
  if (/认证|资格|证书|华为|微软|亚马逊|阿里|腾讯|百度|谷歌|oracle|pmp|npdp|acp/i.test(t)) return 3
  // 2★：培训 / 通用认证
  if (/培训|通用|结业|合格证/i.test(t)) return 2
  // 1★：无相关认证
  return 1
}

function scoreAchievement(text: string, projectText: string): number {
  const full = (text + ' ' + projectText).toLowerCase()
  if (!text.trim() && !projectText.trim()) return MISSING
  // 5★：标杆级成果（国标/行标、高被引、重大成果转化、国家级项目主导）
  if (/国标|行标|标准制定|重大成果转化|高被引|国家科技进步|国家自然科学|发明.*专利.*转化|主导.*国家.*项目|主持.*国家.*项目/i.test(full)) return 5
  // 4★：显著成果（著作、专利、国家级/省部级项目、SCI/EI 论文）
  if (/著作|出版|专著|sci|ei|核心期刊|发明专利|国家级.*项目|省部级.*项目|战略级.*项目/i.test(full)) return 4
  // 3★：丰富实战经验（多年、大型企业项目、头部客户服务）
  if (/讲师|培训|课程|开发|项目|服务|咨询|顾问|头部客户|世界500强|央企|上市公司|大型企业/i.test(full) && /\d+\s*年|资深|多年/i.test(full)) return 3
  // 2★：一般服务经验
  if (/讲师|培训|课程|项目|服务|咨询|顾问|企业|集团|公司|实战|经验/i.test(full)) return 2
  // 1★：仅有公开演讲/参与级
  return 1
}

function scoreHonors(text: string): number {
  const t = text.toLowerCase()
  if (!text.trim()) return MISSING
  // 5★：顶尖人才 / 国家级重大荣誉
  if (/院士|国家级人才|长江学者|杰青|万人计划|国家.*奖|国家荣誉|国家级.*称号|终身成就/i.test(t)) return 5
  // 4★：国家级荣誉或称号
  if (/国家.*荣誉|国家.*奖|全国.*奖|国家级.*称号|享受国务院|特殊津贴/i.test(t)) return 4
  // 3★：省部级荣誉 / 知名协会理事
  if (/省部级|省级.*奖|部级.*奖|协会.*理事|学会.*理事|专家库|智库|委员|十大|百强/i.test(t)) return 3
  // 2★：地市级 / 行业协会成员
  if (/地市|市级.*奖|行业协会|协会成员|学会会员|一般.*荣誉/i.test(t)) return 2
  // 1★：无荣誉或仅一般称号
  return 1
}

function scoreTitleAndManagement(text: string): number {
  const t = text.toLowerCase()
  if (!text.trim()) return MISSING
  // 5★：顶尖头衔 / 顶级企业 CEO/创始人
  if (/教授.*博导|首席科学家|院士|哈佛|麻省|斯坦福|牛津|剑桥|世界500强.*ceo|世界500强.*总裁|世界500强.*董事长/i.test(t)) return 5
  if (/ceo|总裁|总经理|董事长|创始人|董事局主席/i.test(t) && /世界500强|央企|上市公司|大型企业|集团/i.test(t)) return 5
  // 4★：教授 / 高级企业管理者
  if (/教授|研究员|高级工程师|高级.*师/i.test(t)) return 4
  if (/ceo|总裁|总经理|董事长|创始人|董事局主席|vp|副总裁|合伙人|c.*o/i.test(t)) return 4
  // 3★：总监 / 资深专家 / 副教授
  if (/总监|高级经理|资深|高级|副教授|高工/i.test(t)) return 3
  // 2★：经理 / 主管 / 一般工程师
  if (/经理|主管|负责人|工程师|讲师/i.test(t)) return 2
  // 1★：基层 / 无职称
  return 1
}

// ===== 对外接口 =====

export function autoScoreExpert(expert: Expert, projects: Project[] = []): ScoreBreakdown {
  const text = buildText(expert)
  const proj = projectText(projects, expert.id)

  // 1-5★ 子维度分
  const professionalItems = {
    学历与学术背景: scoreEducation(expert),
    行业资质与认证: scoreQualification(text),
    专业成果与经验: scoreAchievement(text, proj),
  }
  const influenceItems = {
    社会荣誉与奖项: scoreHonors(text),
    '职称、管理履历与行业地位': scoreTitleAndManagement(text),
  }

  // V5 子维度权重
  const profWeights = {
    学历与学术背景: 0.35,
    行业资质与认证: 0.30,
    专业成果与经验: 0.35,
  }
  const inflWeights = {
    社会荣誉与奖项: 0.35,
    '职称、管理履历与行业地位': 0.65,
  }

  const profWeighted = Object.entries(professionalItems).reduce((s, [k, v]) => s + v * profWeights[k as keyof typeof profWeights], 0)
  const inflWeighted = Object.entries(influenceItems).reduce((s, [k, v]) => s + v * inflWeights[k as keyof typeof inflWeights], 0)

  const professional = clamp5(profWeighted)
  const influence = clamp5(inflWeighted)
  const overall = clamp5(professional * 0.6 + influence * 0.4)

  const reasons: string[] = []
  if (professional < 3) reasons.push(`专业度偏低（${professional.toFixed(1)}★），建议补充学历、资质或成果信息`)
  if (influence < 3) reasons.push(`影响力偏低（${influence.toFixed(1)}★），建议补充荣誉、头衔或管理履历`)
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
1. 覆盖专业度、影响力 2 个维度，共 5 个评分项，各占 20%。
2. 综合评分 = 专业度 × 60% + 影响力 × 40%。
3. 每个评分项独立 1-5★；信息缺失（未填 / 未公开 / 无法核实）的评分项，默认按 2★ 计，避免粗糙模型批量误判。
4. 专业度评分项：①学历与学术背景、②行业资质与认证、③专业成果与经验。
5. 影响力评分项：④社会荣誉与奖项、⑤职称、管理履历与行业地位。
6. 综合评分 < 3★ 的专家自动进入观察库，不在前端展示。
`.trim()
