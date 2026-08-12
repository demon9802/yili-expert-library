/**
 * 领域分类 API
 */
import { api } from './request'
import type { Field } from '@/types'

export const fieldApi = {
  findAll(): Promise<Field[]> {
    return api.get('/fields')
  },

  create(field: Partial<Field>): Promise<Field> {
    return api.post('/fields', field)
  },

  update(name: string, field: Partial<Field>): Promise<void> {
    return api.put(`/fields/${encodeURIComponent(name)}`, field)
  },

  delete(name: string): Promise<void> {
    return api.delete(`/fields/${encodeURIComponent(name)}`)
  },
}
