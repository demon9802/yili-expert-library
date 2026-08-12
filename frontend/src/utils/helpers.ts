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
