/**
 * 复合加载 API
 */
import { api } from './request'
import type { AppData } from '@/types'

export const appDataApi = {
  loadAppData(): Promise<AppData> {
    return api.get('/app-data')
  },
}
