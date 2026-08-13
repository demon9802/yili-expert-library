<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="rules-doc">
      <div class="doc-head">
        <h3>评分规则与测算文档（10分制 · 主管理员完整版 v5.8.9）</h3>
        <button class="doc-close" type="button" @click="emit('close')">✕</button>
      </div>
      <div class="doc-body">
        <p class="doc-lead">
          受众：<strong>主管理员</strong>（用于汇报演示、规则解释、对外说明）。本版为「四版本体系」中最完整一版，含全部层级定义、矩阵、计算公式与关键测算。
        </p>

        <h4>〇、设计原则</h4>
        <ul>
          <li>10 分制，1–10 全档位对应标准，0 分不计。</li>
          <li>主锚点 + 维度2 + 维度3 三层结构：维度1 定档（主锚）、维度2 次要角度微调（封顶 +0.5）、维度3 额外加分（封顶 +1.0，动态封顶 = 10 − base − 维度2）。</li>
          <li>质量 &gt; 数量：主锚取最高不累计，广度仅作封顶加成。</li>
          <li>可锚定、少争议：院校用 985/211/双一流+排名；机构用财富500强/央企/上市公司；荣誉用行政级别；职称用国家职称序列。</li>
          <li>信息缺失统一 5.0，综合 &lt;7 不进入观察库（不给大家不确定信息）。</li>
        </ul>

        <h4>一、维度与权重</h4>
        <table class="doc-table">
          <thead>
            <tr><th>一级维度</th><th>权重</th><th>二级子维度</th><th>子维度权重</th></tr>
          </thead>
          <tbody>
            <tr><td class="dim" rowspan="3">专业度</td><td class="w" rowspan="3">0.6</td><td>学历与学术背景</td><td>0.35</td></tr>
            <tr><td>行业资质与认证</td><td>0.30</td></tr>
            <tr><td>专业成果与经验</td><td>0.35</td></tr>
            <tr><td class="dim" rowspan="2">影响力</td><td class="w" rowspan="2">0.4</td><td>社会荣誉与奖项</td><td>0.35</td></tr>
            <tr><td>职称、管理履历与行业地位</td><td>0.65</td></tr>
          </tbody>
        </table>
        <p class="formula">综合分 = 专业度 × 0.6 + 影响力 × 0.4（各维度分为其子维度加权平均，四舍五入 1 位）。</p>

        <h4>二、子维度① 学历与学术背景（专业度，权重 0.35）</h4>
        <p class="dim-lead">维度1 主锚 = 学历层次（行）× 院校实力（列 T0–T4）矩阵。</p>
        <table class="doc-table matrix">
          <thead>
            <tr><th>学历＼院校</th><th>T0 全球顶尖</th><th>T1 国内顶尖</th><th>T2 国内重点</th><th>T3 普通院校</th><th>T4 其他/无法核实</th></tr>
          </thead>
          <tbody>
            <tr><td>博士</td><td>9.5</td><td>9.0</td><td>8.5</td><td>8.0</td><td>7.0</td></tr>
            <tr><td>硕士</td><td>8.5</td><td>8.0</td><td>7.5</td><td>7.0</td><td>6.5</td></tr>
            <tr><td>本科</td><td>8.0</td><td>7.5</td><td>7.0</td><td>6.5</td><td>6.0</td></tr>
            <tr><td>专升本</td><td>5.0</td><td>5.0</td><td>4.5</td><td>4.5</td><td>4.5</td></tr>
            <tr><td>专科</td><td>3.0–4.0</td><td>3.0–4.0</td><td>3.0–4.0</td><td>3.0–4.0</td><td>3.0–4.0</td></tr>
            <tr><td>高中/中专</td><td>2.5</td><td>2.5</td><td>2.5</td><td>2.5</td><td>2.5</td></tr>
            <tr><td>初中</td><td>2.0</td><td>2.0</td><td>2.0</td><td>2.0</td><td>2.0</td></tr>
            <tr><td>小学及以下</td><td>1.0</td><td>1.0</td><td>1.0</td><td>1.0</td><td>1.0</td></tr>
            <tr class="miss"><td>信息缺失</td><td>5.0</td><td>5.0</td><td>5.0</td><td>5.0</td><td>5.0</td></tr>
          </tbody>
        </table>
        <ul>
          <li>院校分层：T0 全球顶尖（清北及 QS/THE/ARWU 前50）；T1 国内顶尖（985/双一流）；T2 国内重点（211/双一流学科）；T3 普通院校；T4 其他/无法核实。</li>
          <li>专科按"优质4.0 / 普通3.5 / 成人自考3.0"区分；专升本上限 5.0（保证统招本科≥6.0 稳高于专升本）。</li>
          <li>水硕（无门槛在线硕士）= 硕士 T4 −0.5 = 5.5；自考本科 = 本科 T4 = 6.0。</li>
          <li>博士后不计入学历（归「专业成果·科研经历」）。</li>
          <li>维度2 微调（封顶 +0.5）：院系权威 ±0.3（A+ 学科 +0.3、继续教育学院 −0.3）。</li>
          <li>维度3 额外加分（封顶 +1.0）：第二有效学位 +0.3；跨学科复合 +0.3；第三有效学位 +0.2。动态封顶 = 10 − base − 维度2。</li>
        </ul>

        <h4>三、子维度② 行业资质与认证（专业度，权重 0.30）</h4>
        <table class="doc-table">
          <thead>
            <tr><th>层级</th><th>定义</th><th>分</th></tr>
          </thead>
          <tbody>
            <tr><td>A0</td><td>国际权威认证（CFA/CPA/ACCA/国家级执业资格）</td><td>9.0</td></tr>
            <tr><td>A1</td><td>国家级执业 / 行业权威认证</td><td>8.0</td></tr>
            <tr><td>A2</td><td>行业厂商认证（华为/微软等）</td><td>6.0</td></tr>
            <tr><td>A3</td><td>培训 / 通用认证</td><td>4.0</td></tr>
            <tr class="miss"><td>信息缺失</td><td>—</td><td>5.0</td></tr>
          </tbody>
        </table>
        <ul>
          <li>维度2 微调（封顶 +0.5）：≥2 个不相关领域有效认证 +0.3；≥3 个 +0.5。</li>
          <li>维度3 额外加分（封顶 +1.0）：双 A0/A1 认证 +0.5；PMP 等国际管理认证 +0.5；与主领域强相关且稀缺 +0.5。</li>
        </ul>

        <h4>四、子维度③ 专业成果与经验（专业度，权重 0.35）</h4>
        <p class="dim-lead">维度1 主锚 = 学术路径 与 企业路径 取高不累计（base 取整数）。</p>
        <table class="doc-table">
          <thead>
            <tr><th>学术路径</th><th>分</th><th>企业路径</th><th>分</th></tr>
          </thead>
          <tbody>
            <tr><td>A0 顶刊/高被引/著作专利</td><td>9.0</td><td>B0 战略级主持/国家级项目</td><td>9.0</td></tr>
            <tr><td>A1 SCI/EI/核心论文</td><td>8.0</td><td>B1 省级/行业级项目</td><td>8.0</td></tr>
            <tr><td>A2 普通论文/课题</td><td>6.0</td><td>B2 参与级项目</td><td>6.0</td></tr>
            <tr><td>A3 仅公开演讲</td><td>4.0</td><td>B3 一般服务</td><td>4.0</td></tr>
            <tr class="miss"><td>信息缺失</td><td>5.0</td><td>信息缺失</td><td>5.0</td></tr>
          </tbody>
        </table>
        <ul>
          <li>维度2 微调（封顶 +0.5）：H-index≥15 或 授课≥50场 +0.3；H-index≥25 或 授课≥100场 +0.5。</li>
          <li>维度3 额外加分（封顶 +1.0）：顶刊/高被引 +0.5；牵头国标/行标 +0.5；正规博士后科研经历 +0.5。</li>
        </ul>

        <h4>五、子维度④ 社会荣誉与奖项（影响力，权重 0.35）</h4>
        <p class="dim-lead">维度1 主锚 = 行政级别（取最高不累计，沿用上海落户原则）。</p>
        <table class="doc-table">
          <thead>
            <tr><th>层级</th><th>定义</th><th>分</th></tr>
          </thead>
          <tbody>
            <tr><td>H0</td><td>国家级荣誉/称号</td><td>9.0</td></tr>
            <tr><td>H1</td><td>省部级荣誉/称号</td><td>7.5</td></tr>
            <tr><td>H2</td><td>地市级 / 国家级学会</td><td>6.0</td></tr>
            <tr><td>H3</td><td>县级 / 一般协会</td><td>4.0</td></tr>
            <tr class="miss"><td>信息缺失</td><td>—</td><td>5.0</td></tr>
          </tbody>
        </table>
        <ul>
          <li>维度2 微调（封顶 +0.5）：同级别荣誉≥2项 +0.3；≥3项 +0.5。</li>
          <li>维度3 额外加分（封顶 +1.0）：两院院士 +1.0；国家级人才计划/国际权威榜单 +0.5。</li>
          <li>行业榜单水分较大，按发布方权威性定档（一般归 H2，权威发布方可上调 H1）。</li>
        </ul>

        <h4>六、子维度⑤ 职称、管理履历与行业地位（影响力，权重 0.65）</h4>
        <p class="dim-lead">维度1 主锚 = 职级（行 J0–J3）× 机构（列 C0–C2）矩阵，顶点保留封顶余量。</p>
        <table class="doc-table matrix">
          <thead>
            <tr><th>职级＼机构</th><th>C0 世界500强/央企/上市公司</th><th>C1 行业百强/大厂</th><th>C2 普通企业</th></tr>
          </thead>
          <tbody>
            <tr><td>J0 教授/院士/首席/CEO总裁创始人董事长</td><td>9.5</td><td>9.0</td><td>8.5</td></tr>
            <tr><td>J1 副教授/总监/VP/合伙人</td><td>8.5</td><td>8.0</td><td>7.5</td></tr>
            <tr><td>J2 经理/高工/主管</td><td>7.0</td><td>6.5</td><td>6.0</td></tr>
            <tr><td>J3 无职称/基层</td><td>5.5</td><td>5.0</td><td>4.5</td></tr>
            <tr class="miss"><td>信息缺失</td><td>5.0</td><td>5.0</td><td>5.0</td></tr>
          </tbody>
        </table>
        <ul>
          <li>维度2 微调（封顶 +0.5）：从业≥10年 +0.3；≥15年 或 跨行业经历 +0.5。</li>
          <li>维度3 额外加分（封顶 +1.0）：国标委/一级学会常务理事/早期创始团队（A轮前）+0.5；主导企业变革 +0.3~0.5。</li>
          <li>顶点 J0×C0=9.5 保留余量；C0 含规模较小上市公司；初创界定 A轮前。</li>
        </ul>

        <h4>七、关键测算结果（部署验证）</h4>
        <table class="doc-table">
          <thead>
            <tr><th>专家类型</th><th>综合分</th><th>观察库（&lt;7 不出）</th></tr>
          </thead>
          <tbody>
            <tr><td>顶尖学者（清北博士+院士）</td><td>9.2</td><td>展示</td></tr>
            <tr><td>行业高管（985硕士+世界500强CEO）</td><td>8.5</td><td>展示</td></tr>
            <tr><td>普通高校讲师（博士+副教授）</td><td>6.8</td><td>不展示</td></tr>
            <tr><td>低学历实务专家（专科+多年经验）</td><td>5.3</td><td>不展示</td></tr>
            <tr><td>缺1项+其余强</td><td>8.3</td><td>展示</td></tr>
            <tr><td>缺2项+其余中上</td><td>6.4</td><td>不展示</td></tr>
            <tr><td>全平庸（均6.5）</td><td>6.5</td><td>不展示</td></tr>
            <tr><td>1缺失+全平庸</td><td>6.2</td><td>不展示</td></tr>
            <tr><td>强者带2缺失</td><td>7.6</td><td>展示</td></tr>
          </tbody>
        </table>
        <p class="formula">结论：缺失越多越不展示；强者可带 1–2 项缺失仍展示；全平庸不展示 —— 与"不给大家不确定信息"逻辑自洽。</p>

        <h4>八、待定项</h4>
        <ul>
          <li>成就类维度 1–3 档位：方案 X（定义问题/劣质地档，全 1–10 覆盖）或 方案 Y（地面 4，1–3 不适用）待定。</li>
          <li>录入临界提醒：综合落入 6.5–7.5 或存在信息缺失项时，后台弹窗请管理员人工确认（随完整文档定稿后嵌入）。</li>
        </ul>
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
  width: min(880px, 94vw);
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
.doc-head h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--primary);
}
.doc-close {
  border: none;
  background: var(--bg);
  color: var(--text-secondary);
  width: 30px;
  height: 30px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.doc-close:hover { background: #fee2e2; color: #dc2626; }
.doc-body {
  padding: 18px 20px 28px;
  overflow: auto;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text);
}
.doc-lead { background: var(--bg); padding: 10px 12px; border-radius: 8px; margin: 0 0 16px; }
.doc-body h4 {
  margin: 20px 0 8px;
  font-size: 14px;
  font-weight: 700;
  color: #1d4ed8;
  border-left: 3px solid #dbeafe;
  padding-left: 8px;
}
.doc-body ul { margin: 8px 0; padding-left: 20px; }
.doc-body li { margin: 3px 0; }
.dim-lead { color: var(--text-secondary); margin: 6px 0; }
.formula {
  margin: 8px 0 0;
  padding: 8px 12px;
  background: #eff6ff;
  border-radius: 8px;
  color: #1e40af;
  font-weight: 600;
}
.doc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
  margin: 8px 0;
}
.doc-table th, .doc-table td {
  border: 1px solid var(--border);
  padding: 7px 10px;
  text-align: center;
  vertical-align: middle;
}
.doc-table th { background: var(--bg); font-weight: 600; color: var(--text-secondary); }
.doc-table .dim { font-weight: 700; color: #1e40af; background: #eff6ff; }
.doc-table .w { font-weight: 700; }
.doc-table.matrix th:nth-child(n+2), .doc-table.matrix td:nth-child(n+2) { min-width: 96px; }
.doc-table .miss { background: #f1f5f9; color: var(--text-muted); }
</style>
