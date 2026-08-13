/**
 * 通用工具函数
 */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('zh-CN')
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('zh-CN')
  } catch {
    return dateStr
  }
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export function isMobile(): boolean {
  return window.innerWidth <= 768
}

export function isNarrowScreen(): boolean {
  return window.innerWidth <= 400
}

// localStorage 安全读写
export function lsGet(key: string): any {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function lsSet(key: string, value: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

export function lsRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

// 将 V5 格式的富文本（含【子标题】、/ 分隔、URL）渲染为 HTML
export function formatRichText(text: string): string {
  if (!text) return ''

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function linkify(s: string): string {
    const escaped = escapeHtml(s)
    const urlRegex = /(https?:\/\/[^\s<>"'}\uFF0C\u3002\uFF1B\uFF09\uFF08()]+)/gi
    return escaped.replace(urlRegex, (match) => {
      const clean = match.replace(/[\u3002\uFF0C\u3001\uFF1B\uFF09\u201C\u201D''\]\u3011]$/, '')
      return `<a href="${clean}" target="_blank" rel="noopener" style="color:var(--primary);word-break:break-all;">${clean}</a>`
    })
  }

  function cleanContent(s: string): string {
    let r = linkify(s)
    r = r.replace(/\n/g, '<br>')
    r = r.replace(/ \/ /g, '<br>')
    r = r.replace(/ \/<br>/g, '<br>')
    r = r.replace(/\/ /g, '<br>')
    r = r.replace(/\s*\/\s*$/, '')
    r = r.replace(/^\s*\/\s*/, '')
    r = r.replace(/(<a\b[^>]*>[\s\S]*?<\/a>)|(\/)/gi, (m, atag, slash) => {
      return atag || '<span style="white-space:nowrap">&#8203;/&#8203;</span>'
    })
    return r
  }

  const parts = text.split(/\u3010([^\u3011]+)\u3011/)
  let result = ''
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim()
    if (!part) continue
    if (i % 2 === 1) {
      result += `<div class="detail-sub-heading">${part.replace(/\//g, '<span style="white-space:nowrap">&#8203;/&#8203;</span>')}</div>`
    } else {
      result += `<div class="detail-sub-content">${cleanContent(part)}</div>`
    }
  }
  if (!result) {
    result = `<div class="detail-sub-content">${cleanContent(text)}</div>`
  }
  return result
}

export function copyText(text: string): Promise<void> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text)
  }
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
      resolve()
    } catch (e) {
      reject(e)
    } finally {
      document.body.removeChild(ta)
    }
  })
}

export function contactTypeLabel(type?: string): string {
  switch (type) {
    case 'email': return '邮箱'
    case 'wechat': return '微信'
    case 'phone':
    case 'mobile': return '电话'
    default: return '联系方式'
  }
}

// 根据联系方式值推断真实类型：当 info 是纯电话号码（含 +、数字、空格、短横线）但
// 存储的 type 误标为 email/other 时，强制判定为 phone。
// 这样可修复「办公电话」被识别成邮箱、以及由此导致的 010 区号未格式化问题。
export function resolveContactType(c: { type?: string; info?: string; value?: string }): string {
  const declared = c.type || 'other'
  const info = String(c.info || c.value || '').trim()
  if (!info) return declared
  const phoneLike = /^[+\d][\d\s-]{6,}$/.test(info)
  if (phoneLike && declared !== 'phone' && declared !== 'mobile') {
    return 'phone'
  }
  return declared
}

export function contactTypeIcon(c: { type?: string; info?: string; value?: string }): string {
  const t = resolveContactType(c)
  switch (t) {
    case 'email': return '📧'
    case 'wechat': return '💬'
    case 'phone':
    case 'mobile': return '📞'
    default: return '📎'
  }
}

export function normalizePhone(info?: string): string {
  return String(info || '').replace(/[^0-9+]/g, '')
}

// V5.9.4: 座机强带区号显示，例如 010-12345678
export function formatPhoneDisplay(info?: string): string {
  if (!info) return ''
  const s = String(info).trim()
  // 邮箱、微信、已有 - 或国际号不重新格式化
  if (s.includes('@') || s.startsWith('+')) return s
  const digits = s.replace(/[^0-9]/g, '')
  if (!digits) return s
  if (digits.startsWith('0')) {
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`
    }
    if (digits.length === 11) {
      if (digits.startsWith('01') || digits.startsWith('02')) {
        return `${digits.slice(0, 3)}-${digits.slice(3)}`
      }
      return `${digits.slice(0, 4)}-${digits.slice(4)}`
    }
    if (digits.length === 12) {
      return `${digits.slice(0, 4)}-${digits.slice(4)}`
    }
  } else if (digits.length === 8) {
    // 8 位号码默认为北京本地座机，补 010 区号
    return `010-${digits}`
  }
  return s
}

// V6: 不再直接调用邮件/电话应用，由 ContactActionMenu 统一处理（PC 复制、手机复制+拨打）
export function handleContactClick(c: { type?: string; info?: string; value?: string }) {
  const info = c.info || c.value || ''
  if (!info) return
  const t = resolveContactType(c)
  if (t === 'email') {
    window.location.href = 'mailto:' + info
    return
  }
  if (t === 'phone' || t === 'mobile') {
    window.location.href = 'tel:' + normalizePhone(info)
    return
  }
  copyText(info).catch(() => {})
}

export function contactHref(c: { type?: string; info?: string; value?: string }): string {
  const info = c.info || c.value || ''
  if (!info) return '#'
  const t = resolveContactType(c)
  if (t === 'email') return 'mailto:' + info
  if (t === 'phone' || t === 'mobile') return 'tel:' + normalizePhone(info)
  return '#'
}
