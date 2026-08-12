/**
 * API 请求工具
 * 封装 fetch，自动携带 JWT Token
 */
import type { ApiResponse } from '@/types'

const BASE_URL = '/api'
const TOKEN_KEY = 'yili_expert_token'

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

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
  })

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
