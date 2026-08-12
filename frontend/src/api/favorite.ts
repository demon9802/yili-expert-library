/**
 * 收藏 API
 */
import { api } from './request'

export const favoriteApi = {
  findFavorites(): Promise<number[]> {
    return api.get('/favorites')
  },

  addFavorite(expertId: number): Promise<boolean> {
    return api.post(`/favorites/${expertId}`)
  },

  removeFavorite(expertId: number): Promise<boolean> {
    return api.delete(`/favorites/${expertId}`)
  },

  isFavorite(expertId: number): Promise<boolean> {
    return api.get(`/favorites/${expertId}/check`)
  },
}
