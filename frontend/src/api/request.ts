/**
 * API 请求工具
 * 封装 fetch，自动携带 JWT Token
 */
import type { ApiResponse } from '@/types'

// 后端所有接口统一以 /api 为前缀（见各 Controller 的 @RequestMapping("/api/...")），
// 且后端未配置 context-path。部署环境通过 VITE_API_BASE_URL 指定后端域名（约定只填域名，不含 /api），
// 此处统一在基地址后拼接 /api，避免部署环境漏配 /api 导致全部接口 404。
// 本地开发未设置该变量时回退为 '/api'，由 vite.config.ts 的 proxy 转发到 localhost:8080。
const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
const BASE_URL = API_ORIGIN ? `${API_ORIGIN}/api` : '/api'
const TOKEN_KEY = 'yili_expert_token'
const REQUEST_TIMEOUT = 6000

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // ignore
  }
}

export function removeToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const response = await fetch(`${BASE_URL}${url}`, {
      ...options,
      headers,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok && response.status !== 400) {
      if (response.status === 401) {
        removeToken()
        throw new Error('登录已过期，请重新登录')
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result: ApiResponse<T> = await response.json()

    if (result.code !== 200) {
      throw new Error(result.message || '请求失败')
    }

    return result.data
  } catch (e: any) {
    clearTimeout(timeoutId)
    if (e?.name === 'AbortError') {
      throw new Error('请求超时，请检查后端服务')
    }
    throw e
  }
}

export const api = {
  get<T>(url: string): Promise<T> {
    return request<T>(url, { method: 'GET' })
  },

  post<T>(url: string, data?: any): Promise<T> {
    return request<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  put<T>(url: string, data?: any): Promise<T> {
    return request<T>(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  delete<T>(url: string): Promise<T> {
    return request<T>(url, { method: 'DELETE' })
  },
}
