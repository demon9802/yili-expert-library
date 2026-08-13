<template>
  <section class="admin-tab permissions-tab">
    <h3>权限管理</h3>

    <!-- 主管理员 -->
    <div class="perm-section">
      <h4>主管理员</h4>
      <div class="master-card">
        <div class="master-info">
          <div class="master-name">主管理员</div>
          <div class="master-desc">全部功能权限（专家管理、合作项目管理、评分管理、排序标签、数据看板、分类管理、观察库、权限管理、系统设置）</div>
        </div>
        <button class="btn btn-secondary btn-sm" @click="changeMasterPassword">修改密码</button>
      </div>
    </div>

    <!-- 子管理员 -->
    <div class="perm-section">
      <h4>子管理员</h4>
      <p class="section-desc">子管理员默认拥有：专家导入/导出/新增/编辑、分类标签新增、具体专家评分调整。可以在此调整各权限开关。</p>

      <div v-if="subAdmins.length === 0" class="empty-box">暂无子管理员</div>

      <div v-for="user in subAdmins" :key="user.id" class="sub-admin-card">
        <div class="sub-admin-header">
          <div>
            <div class="sub-admin-name">{{ user.extra?.name || '未命名' }}</div>
            <div class="sub-admin-meta">
              账号：{{ user.email }}
              <span v-if="user.extra?.binding"> | 已绑定：{{ user.extra.binding }}</span>
              <span v-else> | 未绑定</span>
            </div>
          </div>
          <div class="sub-admin-actions">
            <button class="btn btn-warn btn-sm" @click="resetPassword(user)">重置密码</button>
            <button class="btn btn-danger btn-sm" @click="deleteUser(user)">删除</button>
          </div>
        </div>

        <div class="perm-grid">
          <label v-for="pd in permDefs" :key="pd.key" class="perm-row" :title="pd.desc">
            <input v-model="userPermState[user.id][pd.key]" type="checkbox" @change="saveUserPerms(user)" />
            <span class="perm-name">{{ pd.name }}</span>
            <span class="perm-desc">{{ pd.desc }}</span>
          </label>
        </div>
      </div>

      <div class="generate-box">
        <button class="btn primary btn-sm" @click="generateSubAdmin">+ 生成子管理员账号</button>
        <span class="generate-hint">生成账号和随机密码，默认赋予基础编辑权限</span>
      </div>
      <div v-if="generatedInfo" class="generated-info">
        <strong>已生成子管理员：</strong><br>
        账号：{{ generatedInfo.email }}<br>
        密码：{{ generatedInfo.password }}<br>
        <span class="gen-hint">请妥善保管，分享给对应子管理员。</span>
      </div>
    </div>

    <!-- 链接分享设置 -->
    <div class="perm-section">
      <h4>链接分享设置</h4>
      <div class="share-row">
        <label class="share-label">
          <span>允许分享链接：</span>
          <input v-model="shareSettings.linkActive" type="checkbox" @change="saveShareSettings" />
        </label>
        <label class="share-label">
          <span>需要登录验证：</span>
          <input v-model="shareSettings.requireLogin" type="checkbox" @change="saveShareSettings" />
        </label>
      </div>
    </div>

    <p v-if="message" class="message" :class="messageType">{{ message }}</p>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { authApi } from '@/api/auth'
import { settingApi } from '@/api/setting'
import type { UserDTO } from '@/types'

interface PermDef {
  key: string
  name: string
  desc: string
}

const permDefs: PermDef[] = [
  { key: 'expertView', name: '专家查看', desc: '查看专家列表和详情' },
  { key: 'expertAdd', name: '新增专家', desc: '创建新的专家记录' },
  { key: 'expertEdit', name: '编辑专家', desc: '修改已有专家信息' },
  { key: 'expertDelete', name: '删除专家', desc: '删除专家记录' },
  { key: 'expertImport', name: '导入专家', desc: '批量导入专家数据' },
  { key: 'expertExport', name: '导出专家', desc: '导出专家数据为文件' },
  { key: 'expertScore', name: '评分调整', desc: '手动调整专家评分' },
  { key: 'categoryManage', name: '分类管理', desc: '新增/编辑/删除适用领域' },
  { key: 'dashboardManage', name: '数据看板', desc: '查看和管理数据看板' },
  { key: 'projectsManage', name: '合作项目管理', desc: '新增/编辑/删除合作项目记录' },
  { key: 'observationManage', name: '观察库', desc: '管理观察中的专家' },
  { key: 'sortManage', name: '排序标签', desc: '管理排序选项（通常关闭）' },
  { key: 'ratingManage', name: '评分管理', desc: '修改评分体系和权重（仅主管理员）' },
  { key: 'permissionManage', name: '权限管理', desc: '管理子管理员和权限（仅主管理员）' },
  { key: 'systemSettings', name: '系统设置', desc: '系统配置和数据重置（仅主管理员）' }
]

const defaultSubPerms: Record<string, boolean> = {
  expertView: true,
  expertAdd: true,
  expertEdit: true,
  expertDelete: false,
  expertImport: true,
  expertExport: true,
  expertScore: true,
  categoryManage: true,
  dashboardManage: true,
  projectsManage: true,
  observationManage: true,
  sortManage: false,
  ratingManage: false,
  permissionManage: false,
  systemSettings: false
}

const users = ref<UserDTO[]>([])
const loading = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')
const generatedInfo = ref<{ email: string; password: string } | null>(null)
const userPermState = reactive<Record<number, Record<string, boolean>>>({})

const shareSettings = ref({ linkActive: true, requireLogin: true })

const subAdmins = computed(() => users.value.filter(u => u.role === 'sub'))

onMounted(async () => {
  await loadUsers()
  await loadShareSettings()
})

async function loadUsers() {
  loading.value = true
  try {
    const list = await authApi.fetchUserList()
    users.value = list.map(u => ({
      ...u,
      extra: u.extra || {}
    }))
    list.forEach(u => {
      const base = { ...defaultSubPerms }
      if (u.permissions) {
        u.permissions.forEach(p => { base[p] = true })
      }
      userPermState[u.id] = base
    })
  } finally {
    loading.value = false
  }
}

async function loadShareSettings() {
  try {
    const raw = await settingApi.get('shareSettings')
    if (raw) {
      const parsed = JSON.parse(raw)
      shareSettings.value = {
        linkActive: parsed.linkActive !== false,
        requireLogin: parsed.requireLogin !== false
      }
    }
  } catch {
    // ignore
  }
}

async function saveShareSettings() {
  try {
    await settingApi.save('shareSettings', JSON.stringify(shareSettings.value))
    showMessage('分享设置已保存', 'success')
  } catch (err: any) {
    showMessage('保存失败：' + (err?.message || String(err)), 'error')
  }
}

function showMessage(text: string, type: 'success' | 'error') {
  message.value = text
  messageType.value = type
  setTimeout(() => { message.value = '' }, 4000)
}

function changeMasterPassword() {
  const newPwd = prompt('请输入新密码（至少6位）：')
  if (!newPwd) return
  if (newPwd.length < 6) {
    alert('密码至少需要6位')
    return
  }
  authApi.changePassword('', newPwd)
    .then(() => showMessage('主管理员密码已更新', 'success'))
    .catch((err: any) => showMessage('修改失败：' + (err?.message || String(err)), 'error'))
}

async function resetPassword(user: UserDTO) {
  const newPwd = prompt(`请输入子管理员「${user.email}」的新密码（至少6位）：`)
  if (!newPwd) return
  if (newPwd.length < 6) {
    alert('密码至少需要6位')
    return
  }
  try {
    await authApi.adminResetUserPassword(user.id, newPwd)
    showMessage('密码已重置', 'success')
  } catch (err: any) {
    showMessage('重置失败：' + (err?.message || String(err)), 'error')
  }
}

async function deleteUser(user: UserDTO) {
  if (!confirm(`确认删除子管理员「${user.email}」？此操作不可恢复。`)) return
  try {
    await authApi.deleteUser(user.id)
    users.value = users.value.filter(u => u.id !== user.id)
    showMessage('已删除子管理员', 'success')
  } catch (err: any) {
    showMessage('删除失败：' + (err?.message || String(err)), 'error')
  }
}

async function saveUserPerms(user: UserDTO) {
  try {
    await authApi.updateUserPermissions(user.id, userPermState[user.id])
    showMessage('权限已保存', 'success')
  } catch (err: any) {
    showMessage('保存失败：' + (err?.message || String(err)), 'error')
  }
}

async function generateSubAdmin() {
  const name = prompt('请输入子管理员名称（可选）：') || ''
  const random = Math.random().toString(36).substring(2, 8)
  const email = `sub${random}@yili.local`
  const password = Math.random().toString(36).substring(2, 10)
  try {
    const created = await authApi.createSubAdmin(email, password, name)
    users.value.push({ ...created, extra: { name } })
    userPermState[created.id] = { ...defaultSubPerms }
    generatedInfo.value = { email, password }
    showMessage('子管理员账号已生成', 'success')
  } catch (err: any) {
    showMessage('生成失败：' + (err?.message || String(err)), 'error')
  }
}
</script>

<style scoped>
.permissions-tab h3 { font-size: 18px; font-weight: 600; margin: 0 0 16px; }
.perm-section { margin-bottom: 24px; }
.perm-section h4 { font-size: 15px; font-weight: 600; margin: 0 0 10px; color: var(--text); }
.section-desc { font-size: 12px; color: var(--text-muted); margin: -4px 0 12px; }

.master-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.master-name { font-weight: 600; font-size: 14px; }
.master-desc { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

.sub-admin-card {
  padding: 16px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  margin-bottom: 12px;
}
.sub-admin-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}
.sub-admin-name { font-weight: 600; font-size: 14px; }
.sub-admin-meta { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
.sub-admin-actions { display: flex; gap: 8px; flex-shrink: 0; }

.perm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 6px;
}
.perm-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.15s;
}
.perm-row:hover { background: rgba(0,0,0,0.03); }
.perm-row input { flex-shrink: 0; }
.perm-name { font-weight: 500; color: var(--text); white-space: nowrap; }
.perm-desc { color: var(--text-muted); font-size: 11px; flex: 1; text-align: right; }

.generate-box { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
.generate-hint { font-size: 12px; color: var(--text-muted); }
.generated-info {
  margin-top: 12px;
  padding: 12px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  font-size: 13px;
  color: #1e40af;
}
.gen-hint { font-size: 11px; color: #64748b; }

.share-row { display: flex; gap: 24px; flex-wrap: wrap; }
.share-label { display: flex; align-items: center; gap: 8px; font-size: 13px; }

.empty-box {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  background: var(--bg);
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.btn {
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}
.btn-sm { padding: 5px 12px; font-size: 12px; }
.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.btn-secondary { background: var(--bg); color: var(--text-secondary); }
.btn-danger { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
.btn-warn { background: #fffbeb; color: #b45309; border-color: #fde68a; }

.message {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
}
.message.success { background: #f0fdf4; color: #059669; border: 1px solid #bbf7d0; }
.message.error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
</style>
