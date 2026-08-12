/**
 * 观察库操作 API
 */
import { api } from './request'
import type { ObservationOperation } from '@/types'

export const observationApi = {
  findByExpertId(expertId?: number): Promise<ObservationOperation[]> {
    const url = expertId
      ? `/observation-operations?expertId=${expertId}`
      : '/observation-operations'
    return api.get(url)
  },

  create(entity: Partial<ObservationOperation>): Promise<ObservationOperation> {
    return api.post('/observation-operations', entity)
  },
}
