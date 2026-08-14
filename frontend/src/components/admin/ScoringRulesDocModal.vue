<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="rules-doc">
      <div class="doc-head">
        <h3>专家评分规则 · 五星制</h3>
        <button class="doc-close" type="button" @click="emit('close')">✕</button>
      </div>
      <div class="doc-body">
        <h4>一、评分结构与计算</h4>
        <p class="dim-lead">覆盖专业度、影响力 2 个维度，共 5 个评分项，各占 20%。综合评分 = 专业度 × 60% + 影响力 × 40%。</p>
        <div class="rule-summary plain">
          <div class="rule-line prof">专业度：①学历与学术背景、②行业资质与认证、③专业成果与经验</div>
          <div class="rule-line infl">影响力：④社会荣誉与奖项、⑤职称、管理履历与行业地位</div>
        </div>
        <h4>二、评分规则</h4>
        <table class="doc-table matrix">
          <thead>
            <tr>
              <th>评分项</th>
              <th>1★</th>
              <th>2★</th>
              <th>3★</th>
              <th>4★</th>
              <th>5★</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="item">① 学历与学术背景</td>
              <td>大专 / 中专及以下</td>
              <td>普通本科（一般院校）</td>
              <td>较好本科（211 / 双一流）或普通硕士（授课型 / 一般院校）</td>
              <td>名校硕士（985 / 双一流 / 海外知名）或普通博士</td>
              <td>博士 + 顶尖院校（清北 / C9 / QS 前 50 等）</td>
            </tr>
            <tr>
              <td class="item">② 行业资质与认证</td>
              <td>无相关认证</td>
              <td>培训 / 通用认证</td>
              <td>行业厂商认证（华为 / 微软等）或国家级执业资格（单一）</td>
              <td>国家级执业 / 行业权威认证（多重领域）</td>
              <td>国际权威认证（CFA / CPA / ACCA 等）或多项国家级</td>
            </tr>
            <tr>
              <td class="item">③ 专业成果与经验</td>
              <td>一般服务经验 / 仅公开演讲</td>
              <td>参与级项目 / 普通论文</td>
              <td>省级 / 行业级项目 · SCI/EI 论文</td>
              <td>战略级 / 国家级项目 · 顶刊论文</td>
              <td>标杆级（牵头国标行标 / 高被引 / 重大成果转化）</td>
            </tr>
            <tr>
              <td class="item">④ 社会荣誉与奖项</td>
              <td>无荣誉 / 一般协会成员</td>
              <td>地市级荣誉 / 国家级学会成员</td>
              <td>省部级荣誉或称号</td>
              <td>国家级荣誉或称号</td>
              <td>顶尖人才（两院院士 / 国家级人才计划）</td>
            </tr>
            <tr>
              <td class="item">⑤ 职称、管理履历与行业地位</td>
              <td>无职称 / 基层岗位</td>
              <td>经理 / 高工 / 主管（普通企业）</td>
              <td>副教授 / 总监 / VP / 合伙人（或同级别 · 普通企业）</td>
              <td>教授 / CEO / 创始人（行业百强 / 大厂）</td>
              <td>教授 / CEO / 创始人（世界 500 强 / 央企 / 上市公司）</td>
            </tr>
          </tbody>
        </table>
        <p class="missing">信息缺失（未填 / 未公开 / 无法核实）的评分项，默认按 2★ 计，避免粗糙模型批量误判。</p>

        <h4>三、测算</h4>
        <table class="doc-table">
          <thead>
            <tr><th>情形</th><th>①</th><th>②</th><th>③</th><th>④</th><th>⑤</th><th>综合得分</th><th>是否进观察库</th></tr>
          </thead>
          <tbody>
            <tr><td>全部缺失（默认 2★）</td><td>2</td><td>2</td><td>2</td><td>2</td><td>2</td><td>2.0</td><td class="bad">是</td></tr>
            <tr><td>1 项信息缺失，其余中等</td><td>2</td><td>3</td><td>3</td><td>3</td><td>3</td><td>2.8</td><td class="bad">是</td></tr>
            <tr><td>2 项信息缺失，其余中等</td><td>2</td><td>2</td><td>3</td><td>3</td><td>3</td><td>2.6</td><td class="bad">是</td></tr>
            <tr><td>中等水平（各项 3★）</td><td>3</td><td>3</td><td>3</td><td>3</td><td>3</td><td>3.0</td><td class="good">否（达标线）</td></tr>
            <tr><td>良好水平（各项 4★）</td><td>4</td><td>4</td><td>4</td><td>4</td><td>4</td><td>4.0</td><td class="good">否</td></tr>
            <tr><td>专业度强、影响力弱</td><td>5</td><td>5</td><td>5</td><td>2</td><td>2</td><td>3.8</td><td class="good">否</td></tr>
            <tr><td>专业度弱、影响力强</td><td>2</td><td>2</td><td>2</td><td>5</td><td>5</td><td>3.2</td><td class="good">否</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{ close: [] }>()
</script>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 40%);
}
.rules-doc {
  width: min(960px, 96vw);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 24px 70px rgb(15 23 42 / 30%);
  overflow: hidden;
}
.doc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.doc-head h3 { margin: 0; font-size: 18px; color: #1e3a8a; }
.doc-close {
  width: 32px; height: 32px;
  border: none; border-radius: 6px;
  background: #f1f5f9; color: #475569;
  font-size: 16px; cursor: pointer;
}
.doc-close:hover { background: #e2e8f0; }
.doc-body {
  padding: 20px 24px 24px;
  overflow-y: auto;
  line-height: 1.7;
  color: #334155;
  font-size: 13px;
}
.doc-body h4 {
  margin: 22px 0 12px;
  font-size: 15px;
  color: #1d4ed8;
  border-bottom: 1px solid #dbeafe;
  padding-bottom: 6px;
}
.doc-body h4:first-child { margin-top: 0; }
.rule-summary { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
.rule-summary.plain .rule-line { background: none; border: none; padding: 2px 0; }
.rule-line { font-size: 15px; font-weight: 600; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border); }
.rule-summary.plain .rule-line.prof { color: #1e40af; }
.rule-summary.plain .rule-line.infl { color: #b45309; }
.dim-lead { margin: 0 0 12px; color: #64748b; }
.formula { margin: 12px 0 0; padding: 10px 14px; background: #f8fafc; border-radius: 6px; color: #475569; }
.missing { margin: 12px 0 0; padding: 8px 12px; background: #fefce8; border-radius: 6px; color: #854d0e; }
.doc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  margin-bottom: 6px;
}
.doc-table th, .doc-table td {
  padding: 9px 10px;
  border: 1px solid #e2e8f0;
  text-align: left;
  vertical-align: top;
}
.doc-table th {
  background: #f1f5f9;
  font-weight: 600;
  color: #475569;
}
.doc-table .dim {
  font-weight: 700;
  color: #1d4ed8;
  background: #eff6ff;
  text-align: center;
  vertical-align: middle;
}
.doc-table .item {
  font-weight: 600;
  white-space: nowrap;
}
.doc-table.matrix { min-width: 800px; }
.doc-table.matrix td { line-height: 1.5; }
.doc-table .bad { color: #dc2626; font-weight: 600; }
.doc-table .good { color: #059669; font-weight: 600; }
</style>
