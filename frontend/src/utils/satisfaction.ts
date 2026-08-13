/**
 * 合作项目满意度解析与展示（对齐 V5）
 * V5 满意度字段为对象 { value: number, scale: 5|10 }，
 * V6 后端为兼容迁移数据存储为字符串，需兼容多种格式。
 */

export interface SatisfactionValue {
  raw: number      // 原始分值（按原始 scale）
  scale: 5 | 10    // 原始量表
  display: number  // 统一折算到 10 分制后的值
}

export function parseSatisfaction(sat: any): SatisfactionValue | null {
  if (sat == null || sat === '' || sat === 'null' || sat === 'undefined') return null

  // 对象格式 { value, scale }
  if (typeof sat === 'object' && sat !== null) {
    const v = Number(sat.value ?? sat.raw)
    if (!Number.isFinite(v) || v <= 0) return null
    const scale = sat.scale === 5 ? 5 : 10
    return {
      raw: v,
      scale,
      display: scale === 5 ? v * 2 : v,
    }
  }

  // 字符串格式：先尝试 JSON 解析（V6 后端存储格式）
  const s = String(sat).trim()
  if (!s) return null

  try {
    const parsed = JSON.parse(s)
    if (parsed && typeof parsed === 'object') {
      const v = Number(parsed.value ?? parsed.raw)
      if (Number.isFinite(v) && v > 0) {
        const scale = parsed.scale === 5 ? 5 : 10
        return {
          raw: v,
          scale,
          display: scale === 5 ? v * 2 : v,
        }
      }
    }
  } catch {
    // 非 JSON，继续走兜底正则
  }

  // 兜底：提取第一个数字，并识别 /5 或 /10 量表
  const m = s.match(/(\d+(?:\.\d+)?)/)
  if (!m) return null
  const v = Number(m[1])
  if (!Number.isFinite(v) || v <= 0) return null

  const scale = /\/\s*5\b|分制\s*5|5\s*分/i.test(s) ? 5 : 10
  return {
    raw: v,
    scale,
    display: scale === 5 ? v * 2 : v,
  }
}

export function satisfactionDisplay(sat: any): string {
  const parsed = parseSatisfaction(sat)
  if (!parsed) return ''
  // 对齐 V5：保留最多 2 位小数并去除末尾 0
  const str = parsed.display.toFixed(2)
  return parseFloat(str).toString()
}

export function satisfactionStars(sat: any): string {
  const parsed = parseSatisfaction(sat)
  if (!parsed) return ''
  // V5：10 星制，按 10 分制四舍五入
  const full = Math.round(parsed.display)
  return '★'.repeat(Math.max(0, full)) + '☆'.repeat(Math.max(0, 10 - full))
}

export function satisfactionHasValue(sat: any): boolean {
  return parseSatisfaction(sat) !== null
}
