<template>
  <section class="admin-tab docs-tab">
    <h3>系统文档</h3>
    <div class="doc-card">
      <h4>版本信息</h4>
      <p><strong>项目：</strong>伊利专家资源库</p>
      <p><strong>技术栈：</strong>Vue3 + Vite + TypeScript + SCSS + Pinia</p>
      <p><strong>当前版本：</strong>V6</p>
    </div>

    <div class="doc-card">
      <h4>更新日志</h4>
      <ul>
        <li>V6：前端组件化重构，接入 Pinia 状态管理和 API 模块。</li>
        <li>新增专家、项目、领域、评分、排序、观察库、权限、设置等后台模块。</li>
        <li>新增数据看板和月报统计入口。</li>
      </ul>
    </div>

    <div class="doc-card">
      <h4>后台模块说明</h4>
      <p>管理员可在后台维护专家资源、合作项目、分类字段、评分和系统基础配置。</p>
      <p>用户、权限、观察库和统计数据均通过后端 API 获取。</p>
    </div>
  </section>
</template>

<script setup lang="ts">
</script>

<style scoped>
.docs-tab { line-height: 1.7; }
.doc-card { margin-bottom: 16px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; }
.doc-card h4 { margin-top: 0; }
</style>
