/**
 * 认证 API
 */
import { api } from './request'
import type { LoginResult, UserDTO } from '@/types'

export const authApi = {
  signUp(email: string, password: string): Promise<LoginResult> {
    return api.post('/auth/signup', { email, password })
  },

  login(email: string, password: string): Promise<LoginResult> {
    return api.post('/auth/login', { email, password })
  },

  logout(): Promise<void> {
    return api.post('/auth/logout')
  },

  resetPassword(email: string): Promise<void> {
    return api.post(`/auth/reset-password?email=${encodeURIComponent(email)}`)
  },

  changePassword(oldPassword: string, newPassword: string): Promise<void> {
    return api.put('/auth/change-password', { oldPassword, newPassword })
  },

  reauthenticate(password: string): Promise<boolean> {
    return api.post(`/auth/reauthenticate?password=${encodeURIComponent(password)}`)
  },

  checkForcePasswordChange(): Promise<boolean> {
    return api.get('/auth/force-password-change')
  },

  clearForcePasswordChange(): Promise<void> {
    return api.delete('/auth/force-password-change')
  },

  // 密保问题
  saveSecurityQuestions(questions: string[]): Promise<void> {
    return api.put('/auth/security/questions', { questions })
  },

  getSecurityQuestionTexts(userId: number): Promise<any> {
    return api.get(`/auth/security/questions/${userId}`)
  },

  verifySecurityAnswers(userId: number, answers: string[]): Promise<any> {
    return api.post('/auth/security/verify', { userId, answers })
  },

  changePasswordAfterSecurityVerification(userId: number, newPassword: string): Promise<void> {
    return api.post(`/auth/security/reset-password?userId=${userId}&newPassword=${encodeURIComponent(newPassword)}`)
  },

  // 用户管理
  fetchUserList(): Promise<UserDTO[]> {
    return api.get('/auth/users')
  },

  adminResetUserPassword(userId: number, tempPassword: string): Promise<void> {
    return api.post('/auth/users/reset-password', { userId, tempPassword })
  },

  createSubAdmin(email: string, password: string, name: string): Promise<UserDTO> {
    return api.post('/auth/users/sub-admin', { email, password, name })
  },

  deleteUser(userId: number): Promise<void> {
    return api.delete(`/auth/users/${userId}`)
  },

  updateUserPermissions(userId: number, permissions: Record<string, boolean>): Promise<void> {
    return api.put('/auth/users/permissions', { userId, permissions })
  },
}
