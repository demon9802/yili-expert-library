/**
 * 页面访问 API
 */
import { api } from './request'

export const pageViewApi = {
  recordView(): Promise<void> {
    return api.post('/page-views')
  },

  getMonthlyStats(): Promise<any> {
    return api.get('/page-views/monthly')
  },
}
