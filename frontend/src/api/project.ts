/**
 * 合作项目 API
 */
import { api } from './request'
import type { Project } from '@/types'

export const projectApi = {
  findAll(): Promise<Project[]> {
    return api.get('/projects')
  },

  create(project: Partial<Project>): Promise<Project> {
    return api.post('/projects', project)
  },

  update(id: number, project: Partial<Project>): Promise<Project> {
    return api.put(`/projects/${id}`, project)
  },

  upsert(project: Partial<Project>): Promise<Project> {
    return api.put('/projects/upsert', project)
  },

  delete(id: number): Promise<void> {
    return api.delete(`/projects/${id}`)
  },
}
