<template>
  <div class="admin-tab projects-tab">
    <div class="tab-header">
      <h2>合作项目管理</h2>
      <button class="btn btn-primary" @click="showForm = true; editing = null">新增项目</button>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>项目标题</th><th>专家</th><th>年份</th><th>满意度</th><th>可见</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="project in store.yiliProjects" :key="project.id">
            <td>{{ project.title }}</td>
            <td>{{ getExpertName(project.expertId) || project.pendingExpertName }}</td>
            <td>{{ project.year }}{{ project.month ? '.' + project.month : '' }}</td>
            <td>{{ project.satisfaction || '—' }}</td>
            <td>{{ project.visible ? '是' : '否' }}</td>
            <td class="actions">
              <button class="btn-link" @click="editProject(project)">编辑</button>
              <button class="btn-link danger" @click="handleDelete(project)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
      <div class="form-modal">
        <h3>{{ editing ? '编辑项目' : '新增项目' }}</h3>
        <div class="form-grid">
          <div class="form-group"><label>项目标题 *</label><input v-model="formData.title" type="text" /></div>
          <div class="form-group"><label>关联专家</label>
            <select v-model="formData.expertId"><option :value="null">请选择</option>
              <option v-for="e in store.experts" :key="e.id" :value="e.id">{{ e.name }}</option></select></div>
          <div class="form-group"><label>待定专家姓名</label><input v-model="formData.pendingExpertName" type="text" /></div>
          <div class="form-group"><label>年份 *</label><input v-model.number="formData.year" type="number" /></div>
          <div class="form-group"><label>月份</label><input v-model.number="formData.month" type="number" min="1" max="12" /></div>
          <div class="form-group"><label>满意度</label><input v-model="formData.satisfaction" type="text" /></div>
          <div class="form-group"><label>项目描述</label><textarea v-model="formData.desc" rows="3"></textarea></div>
          <div class="form-group"><label>是否可见</label><input v-model="formData.visible" type="checkbox" /></div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" @click="handleSave">保存</button>
          <button class="btn btn-text" @click="showForm = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useAppStore } from '@/store/appStore'
import type { Project } from '@/types'

const store = useAppStore()
const showForm = ref(false)
const editing = ref<Project | null>(null)
const formData = reactive<Partial<Project>>({ title: '', expertId: null, pendingExpertName: '', year: new Date().getFullYear(), month: null, satisfaction: '', desc: '', visible: true })

function getExpertName(id: number | null) {
  if (!id) return ''
  return store.experts.find(e => e.id === id)?.name || ''
}
function editProject(p: Project) { editing.value = p; Object.assign(formData, p); showForm.value = true }
async function handleSave() {
  if (!formData.title?.trim()) { alert('请填写项目标题'); return }
  if (!formData.year) { alert('请填写年份'); return }
  await store.saveProject(formData); showForm.value = false; Object.assign(formData, { title: '', expertId: null, pendingExpertName: '', year: new Date().getFullYear(), month: null, satisfaction: '', desc: '', visible: true }); editing.value = null
}
async function handleDelete(p: Project) { if (confirm(`确认删除「${p.title}」？`)) await store.deleteProject(p.id) }
</script>
