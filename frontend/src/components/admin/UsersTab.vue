<template>
  <section class="admin-tab">
    <div class="admin-toolbar">
      <h3>用户管理</h3>
      <button class="btn" @click="loadUsers">刷新</button>
    </div>

    <p v-if="message" class="message">{{ message }}</p>
    <table class="admin-table">
      <thead>
        <tr>
          <th>邮箱</th>
          <th>管理员</th>
          <th>已设密保</th>
          <th>强制改密</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users" :key="user.id">
          <td>{{ user.email }}</td>
          <td>{{ user.isAdmin ? '是' : '否' }}</td>
          <td>{{ user.hasSecurityQuestions ? '是' : '否' }}</td>
          <td>{{ user.forcePasswordChange ? '是' : '否' }}</td>
          <td><button class="btn" @click="resetPassword(user)">重置密码</button></td>
        </tr>
        <tr v-if="users.length === 0 && !loading">
          <td colspan="5" class="empty">暂无用户</td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading">加载中...</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { authApi } from '@/api/auth'
import type { UserDTO } from '@/types'

const users = ref<UserDTO[]>([])
const loading = ref(false)
const message = ref('')

async function loadUsers() {
  loading.value = true
  message.value = ''
  try {
    users.value = await authApi.fetchUserList()
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
th, td { padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: left; }
.empty { text-align: center; color: #888; }
.message { color: #059669; }
.btn { margin-right: 8px; padding: 6px 12px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; }
</style>
