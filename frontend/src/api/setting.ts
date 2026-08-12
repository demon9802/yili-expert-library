/**
 * 设置 API
 */
import { api } from './request'

export const settingApi = {
  get(key: string): Promise<string | null> {
    return api.get(`/settings/${encodeURIComponent(key)}`)
  },

  save(key: string, value: string): Promise<void> {
    return api.put(`/settings/${encodeURIComponent(key)}`, value)
  },
}
