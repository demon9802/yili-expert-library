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
    // 使用 query 参数传递 name，避免字段名包含 /（如"通用（领导力/协同/执行力/目标管理）"）
    // 被 Tomcat 默认拒绝的 %2F 路径段问题
    return api.put(`/fields?oldName=${encodeURIComponent(name)}`, field)
  },

  delete(name: string): Promise<void> {
    return api.delete(`/fields?name=${encodeURIComponent(name)}`)
  },
}
