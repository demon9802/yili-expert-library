<template>
  <div class="admin-tab categories-tab">
    <div class="tab-header">
      <h2>分类管理</h2>
      <button class="btn btn-primary" @click="showForm = true; editing = null">新增分类</button>
    </div>
    <div class="fields-list">
      <div v-for="field in store.fields" :key="field.name" class="field-row">
        <span class="field-color" :style="{ background: field.color, color: field.textColor }">{{ field.name }}</span>
        <span class="field-info">排序: {{ field.sortOrder }}</span>
        <span class="field-info">{{ field.hideWhenEmpty ? '无专家时隐藏' : '始终显示' }}</span>
        <div class="actions">
          <button class="btn-link" @click="editField(field)">编辑</button>
          <button class="btn-link danger" @click="handleDelete(field)">删除</button>
        </div>
      </div>
    </div>
    <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
      <div class="form-modal">
        <h3>{{ editing ? '编辑分类' : '新增分类' }}</h3>
        <div class="form-grid">
          <div class="form-group"><label>名称 *</label><input v-model="formData.name" type="text" :disabled="!!editing" /></div>
          <div class="form-group"><label>背景色</label><input v-model="formData.color" type="color" /></div>
          <div class="form-group"><label>文字色</label><input v-model="formData.textColor" type="color" /></div>
          <div class="form-group"><label>排序权重</label><input v-model.number="formData.sortOrder" type="number" /></div>
          <div class="form-group"><label>无专家时隐藏</label><input v-model="formData.hideWhenEmpty" type="checkbox" /></div>
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
import type { Field } from '@/types'

const store = useAppStore()
const showForm = ref(false)
const editing = ref<Field | null>(null)
const formData = reactive<Partial<Field>>({ name: '', color: '#2563EB', textColor: '#ffffff', hideWhenEmpty: false, sortOrder: 0 })

function editField(f: Field) { editing.value = f; Object.assign(formData, f); showForm.value = true }
async function handleSave() {
  if (!formData.name?.trim()) { alert('请填写名称'); return }
  await store.saveField(formData); showForm.value = false
  Object.assign(formData, { name: '', color: '#2563EB', textColor: '#ffffff', hideWhenEmpty: false, sortOrder: 0 }); editing.value = null
}
async function handleDelete(f: Field) { if (confirm(`确认删除分类「${f.name}」？`)) await store.deleteField(f.name) }
</script>
