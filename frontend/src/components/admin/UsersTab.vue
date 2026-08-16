<template>
  <section class="admin-tab">
    <div class="admin-toolbar">
      <h3>用户管理</h3>
      <button class="btn btn-secondary btn-sm" @click="loadUsers">刷新</button>
    </div>

    <p v-if="message" class="message">{{ message }}</p>
    <p v-if="error" class="error-box">
      加载用户列表失败：{{ error }}
      <button class="btn btn-secondary btn-sm" @click="loadUsers">重试</button>
    </p>
    <table class="admin-table">
      <thead>
        <tr>
          <th>账号</th>
          <th>注册时间</th>
          <th>最近登录时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in normalUsers" :key="user.id">
          <td class="col-account">{{ user.email }}</td>
          <td>{{ formatDateTime(user.createdAt) || '—' }}</td>
          <td>{{ formatDateTime(user.lastLoginAt ?? null) || '—' }}</td>
          <td><button class="btn btn-secondary btn-sm" @click="resetPassword(user)">重置密码</button></td>
        </tr>
        <tr v-if="normalUsers.length === 0 && !loading && !error">
          <td colspan="4" class="empty">暂无普通用户</td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading">加载中...</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { authApi } from '@/api/auth'
import { formatDateTime } from '@/utils/helpers'
import type { UserDTO } from '@/types'

const users = ref<UserDTO[]>([])
const loading = ref(false)
const message = ref('')
const error = ref('')

const normalUsers = computed(() => users.value.filter(u => u.role !== 'master' && u.role !== 'sub' && !u.isAdmin))

async function loadUsers() {
  loading.value = true
  message.value = ''
  error.value = ''
  try {
    users.value = await authApi.fetchUserList()
  } catch (err: any) {
    error.value = err?.message || '请求失败，请检查网络后重试'
  } finally {
    loading.value = false
  }
}

async function resetPassword(user: UserDTO) {
  const tempPassword = window.prompt(`请输入为 ${user.email} 设置的临时密码`)
  if (!tempPassword) return
  await authApi.adminResetUserPassword(user.id, tempPassword)
  message.value = `已重置 ${user.email} 的密码`
  await loadUsers()
}

onMounted(loadUsers)
</script>

<style scoped>
.admin-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.admin-table { width: 100%; border-collapse: collapse; }
th, td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: left; font-size: 13px; }
th { background: var(--bg, #f8fafc); font-weight: 600; color: var(--text-secondary, #64748b); }
.col-account { font-weight: 500; color: var(--text, #1e293b); }
.empty { text-align: center; color: #888; padding: 24px; }
.message { color: #059669; font-size: 13px; }
.error-box { color: #b91c1c; font-size: 13px; background: #fef2f2; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 6px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }

/* 与平台统一按钮风格 */
.btn { border-radius: 6px; cursor: pointer; font-size: 12px; line-height: 1.2; white-space: nowrap; }
.btn-sm { padding: 6px 10px; }
.btn-primary { background: #2563eb; color: #fff; border: 1px solid #2563eb; }
.btn-primary:hover { background: #1d4ed8; }
.btn-secondary { background: #fff; color: var(--text-secondary, #64748b); border: 1px solid var(--border, #e2e8f0); }
.btn-secondary:hover { background: var(--bg, #f8fafc); color: var(--text, #1e293b); }
.btn:disabled { opacity: .55; cursor: not-allowed; }
</style>
