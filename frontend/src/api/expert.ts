/**
 * 专家 API
 */
import { api } from './request'
import type { Expert } from '@/types'

export const expertApi = {
  findAll(): Promise<Expert[]> {
    return api.get('/experts')
  },

  findById(id: number): Promise<Expert> {
    return api.get(`/experts/${id}`)
  },

  create(expert: Partial<Expert>): Promise<Expert> {
    return api.post('/experts', expert)
  },

  update(id: number, expert: Partial<Expert>): Promise<Expert> {
    return api.put(`/experts/${id}`, expert)
  },

  upsert(expert: Partial<Expert>): Promise<Expert> {
    return api.put('/experts/upsert', expert)
  },

  delete(id: number): Promise<void> {
    return api.delete(`/experts/${id}`)
  },
}
