<template>
  <div class="scoring-help-overlay" @click.self="$emit('close')">
    <div class="scoring-help-modal">
      <div class="sh-head">
        <div class="sh-title">评分规则说明</div>
        <div class="sh-ver">五星制</div>
      </div>
      <div class="sh-body" style="padding-top:10px">
        <table class="sh-table" style="margin:0">
          <thead>
            <tr style="background:#f8fafc">
              <th class="sh-item-header">评分项</th>
              <th class="sh-star-header">1★</th>
              <th class="sh-star-header">2★</th>
              <th class="sh-star-header">3★</th>
              <th class="sh-star-header">4★</th>
              <th class="sh-star-header">5★</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in ruleMatrix" :key="row.item">
              <td class="sh-item-cell" :style="{ color: row.dim === '专业度' ? '#3B82F6' : '#F59E0B' }">{{ row.item }}</td>
              <td v-for="(star, i) in row.stars" :key="i" class="sh-star-cell">{{ star }}</td>
            </tr>
          </tbody>
        </table>
        <div class="sh-foot" style="margin-top:14px;padding-top:12px;border-top:1px solid #e2e8f0;color:#475569;line-height:1.7">
          信息缺失统一记为 2★，专家评分根据补充信息动态维护。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineEmits<{ close: [] }>()

const ruleMatrix = [
  { item: '① 学历与学术背景', dim: '专业度', stars: ['大专/中专及以下', '普通本科', '较好本科(211/双一流)或普通硕士', '名校硕士(985/双一流)或普通博士', '博士+顶尖院校(清北/C9/QS50)'] },
  { item: '② 行业资质与认证', dim: '专业度', stars: ['无相关认证', '培训/通用认证', '厂商认证或国家级执业资格', '国家级执业/行业权威认证', '国际权威认证(CFA/CPA等)'] },
  { item: '③ 专业成果与经验', dim: '专业度', stars: ['一般经验/仅演讲', '参与级项目/普通论文', '省级/行业级项目·SCI/EI', '战略级/国家级项目·顶刊', '牵头国标行标/高被引'] },
  { item: '④ 社会荣誉与奖项', dim: '影响力', stars: ['无荣誉/一般成员', '地市级/国家级学会成员', '省部级荣誉或称号', '国家级荣誉或称号', '两院院士/国家级人才'] },
  { item: '⑤ 职称·管理履历·行业地位', dim: '影响力', stars: ['无职称/基层', '经理/高工/主管', '副教授/总监/VP/合伙人', '教授/CEO/创始人(百强)', '教授/CEO(世界500强/央企)'] },
]
</script>
