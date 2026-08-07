const fs = require('fs');
const path = require('path');

const URL = 'https://owjdwwdipfsnumgoxzih.supabase.co';
const KEY = 'sb_publishable_GQR4Qj9MMaau2V-Zm7_bLA_XUhfaN6j';

function makeCfg(missingScore) {
  return {
    missingScore,
    cap: 5,
    observationThreshold: 3,
    dimensions: [
      { id: 'professional', weight: 0.6, subDimensions: [
        { name: '学历与学术背景', weight: 1/3 },
        { name: '行业资质与认证', weight: 1/3 },
        { name: '专业成果与经验', weight: 1/3 }
      ]},
      { id: 'influence', weight: 0.4, subDimensions: [
        { name: '社会荣誉与奖项', weight: 0.5 },
        { name: '职称、管理履历与行业地位', weight: 0.5 }
      ]}
    ]
  };
}

function getCompanyAuthorityLevel(text) {
  if (/世界500强|财富500|央企|国企|上市公司|股份|集团|有限责任公司|有限公司| co\.? ltd|inc\.|corp/i.test(text)) return 1;
  if (/百强|大厂|头部|领军|龙头|行业前五|top\s?\d/i.test(text)) return 0.5;
  return 0;
}

function aiScoreExpert(expert, cfg) {
  if (!expert.subScores) expert.subScores = {};
  const qual = expert.qualifications || '';
  const adv = (expert.advantages || []).map(a => (a.title || '') + ' ' + a.desc).join(' ');
  const combinedText = qual + ' ' + adv + ' ' + (expert.education || '') + ' ' + (expert.background || '');
  const txt = combinedText.toLowerCase();
  const authorityLevel = getCompanyAuthorityLevel(txt);

  function scoreEducation() {
    if (/博士|博士后|phd/i.test(txt)) return 5;
    if (/硕士|研究生|master|mba/i.test(txt)) return 4;
    if (/本科|学士|bachelor/i.test(txt)) return 3;
    if (/专科|大专|高职/i.test(txt)) return 2;
    if (/中专|高中|初中|小学/i.test(txt)) return 1;
    return cfg.missingScore;
  }
  function scoreCertification() {
    if (/cfa|cpa|acca|pmp|国际权威|国际认证/i.test(txt)) return 5;
    if (/国家级执业|注册会计师|注册|执业资格|行业权威|权威认证/i.test(txt)) return 4;
    if (/认证|资格|华为|微软|阿里|腾讯|厂商认证/i.test(txt)) return 3;
    if (/培训|进修|课程|通用认证/i.test(txt)) return 2;
    return cfg.missingScore;
  }
  function scoreAchievement() {
    if (/国标|行标|高被引|重大成果转化|牵头.*标准/i.test(txt)) return 5;
    if (/国家级项目|战略级|顶刊/i.test(txt)) return 4;
    if (/省级|行业级|sci|ei|论文|专利|软著|著作|出版/i.test(txt)) return 3;
    if (/项目|讲师|培训|课程|开发|服务|企业|集团|公司|经验/i.test(txt)) return 3;
    return cfg.missingScore;
  }
  function scoreHonor() {
    if (/院士|国家级人才计划|长江学者|杰青|万人计划/i.test(txt)) return 5;
    if (/国家级荣誉|国家级称号|国家.*奖/i.test(txt)) return 4;
    if (/省部级|省级荣誉|省级称号/i.test(txt)) return 3;
    if (/地市|市级荣誉|国家级学会|协会|理事|委员/i.test(txt)) return 2;
    return cfg.missingScore;
  }
  function scoreTitle() {
    const hasTopTitle = /教授|研究员|高级工程师|院士|首席|ceo|总裁|总经理|董事长|创始人/i.test(txt);
    const hasSeniorTitle = /总监|副总裁|合伙人|副教授|vp|director/i.test(txt);
    const hasMidTitle = /经理|高工|主管|高级工程师/i.test(txt);
    let s = cfg.missingScore;
    if (hasTopTitle) s = 4;
    else if (hasSeniorTitle) s = 3;
    else if (hasMidTitle) s = 2;
    if (authorityLevel === 1 && s < 5) s += 1;
    else if (authorityLevel === 0.5 && s < 4) s += 1;
    return Math.min(5, s);
  }

  const profDim = cfg.dimensions.find(d => d.id === 'professional');
  expert.subScores.professional = {};
  profDim.subDimensions.forEach(sd => {
    let s = cfg.missingScore;
    if (sd.name.indexOf('学历') >= 0) s = scoreEducation();
    else if (sd.name.indexOf('资质') >= 0 || sd.name.indexOf('认证') >= 0) s = scoreCertification();
    else if (sd.name.indexOf('成果') >= 0 || sd.name.indexOf('经验') >= 0) s = scoreAchievement();
    expert.subScores.professional[sd.name] = Math.max(1, Math.min(cfg.cap, Math.round(s)));
  });

  const inflDim = cfg.dimensions.find(d => d.id === 'influence');
  expert.subScores.influence = {};
  inflDim.subDimensions.forEach(sd => {
    let s = cfg.missingScore;
    if (sd.name.indexOf('荣誉') >= 0 || sd.name.indexOf('奖项') >= 0) s = scoreHonor();
    else if (sd.name.indexOf('职称') >= 0 || sd.name.indexOf('管理履历') >= 0 || sd.name.indexOf('行业地位') >= 0) s = scoreTitle();
    expert.subScores.influence[sd.name] = Math.max(1, Math.min(cfg.cap, Math.round(s)));
  });
}

function recalcExpertFromSubscores(e, cfg) {
  const profDim = cfg.dimensions.find(d => d.id === 'professional');
  const inflDim = cfg.dimensions.find(d => d.id === 'influence');
  let prof = 0, infl = 0;
  const getSub = (sd, val) => {
    let v = val;
    if (v === undefined || v === null) v = sd.missingScore !== undefined ? sd.missingScore : cfg.missingScore;
    return Math.min(cfg.cap, Math.max(1, v));
  };
  if (e.subScores && e.subScores.professional && profDim && profDim.subDimensions) {
    profDim.subDimensions.forEach(sd => { prof += getSub(sd, e.subScores.professional[sd.name]) * sd.weight; });
  }
  if (e.subScores && e.subScores.influence && inflDim && inflDim.subDimensions) {
    inflDim.subDimensions.forEach(sd => { infl += getSub(sd, e.subScores.influence[sd.name]) * sd.weight; });
  }
  e.scores = {
    professional: Math.round(prof * 10) / 10,
    influence: Math.round(infl * 10) / 10,
    overall: Math.round((prof * profDim.weight + infl * inflDim.weight) * 10) / 10
  };
}

function scoreExpert(expert, missingScore) {
  const e = JSON.parse(JSON.stringify(expert));
  e.subScores = null;
  const cfg = makeCfg(missingScore);
  aiScoreExpert(e, cfg);
  recalcExpertFromSubscores(e, cfg);
  return e;
}

function summarize(list) {
  const obs = list.filter(e => e.scores.overall < 3);
  return {
    count: list.length,
    observation: obs.length,
    observationPct: (obs.length / list.length * 100).toFixed(1),
    avgOverall: (list.reduce((s, e) => s + e.scores.overall, 0) / list.length).toFixed(2),
    avgProf: (list.reduce((s, e) => s + e.scores.professional, 0) / list.length).toFixed(2),
    avgInfl: (list.reduce((s, e) => s + e.scores.influence, 0) / list.length).toFixed(2),
    buckets: {
      '4-5★': list.filter(e => e.scores.overall >= 4).length,
      '3-4★': list.filter(e => e.scores.overall >= 3 && e.scores.overall < 4).length,
      '2-3★': list.filter(e => e.scores.overall >= 2 && e.scores.overall < 3).length,
      '<2★': list.filter(e => e.scores.overall < 2).length
    }
  };
}

function lowReasons(list) {
  const reasons = {};
  list.filter(e => e.scores.overall < 3).forEach(e => {
    Object.entries(e.subScores.professional).forEach(([k, v]) => { if (v < 3) reasons['专业度·' + k] = (reasons['专业度·' + k] || 0) + 1; });
    Object.entries(e.subScores.influence).forEach(([k, v]) => { if (v < 3) reasons['影响力·' + k] = (reasons['影响力·' + k] || 0) + 1; });
  });
  return reasons;
}

async function main() {
  const res = await fetch(URL + '/rest/v1/experts?select=*', {
    headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' }
  });
  const experts = await res.json();

  const v3 = experts.map(e => scoreExpert(e, 3));
  const v2 = experts.map(e => scoreExpert(e, 2));

  const s3 = summarize(v3);
  const s2 = summarize(v2);

  const changed = [];
  for (let i = 0; i < experts.length; i++) {
    const name = experts[i].name;
    const o3 = v3[i].scores.overall;
    const o2 = v2[i].scores.overall;
    if ((o3 >= 3 && o2 < 3) || (o3 < 3 && o2 >= 3)) {
      changed.push({ name, o3, o2, delta: (o2 - o3).toFixed(1), prof3: v3[i].scores.professional, infl3: v3[i].scores.influence, prof2: v2[i].scores.professional, infl2: v2[i].scores.influence });
    }
  }

  const boundary = [];
  for (let i = 0; i < experts.length; i++) {
    const o3 = v3[i].scores.overall;
    if (o3 >= 2.5 && o3 <= 3.5) {
      boundary.push({ name: experts[i].name, overall3: o3, overall2: v2[i].scores.overall, prof: v3[i].scores.professional, infl: v3[i].scores.influence });
    }
  }

  const reasons2 = lowReasons(v2);

  // 调回难度：v2 中进观察库的专家，需要综合分涨多少才能到 3
  const needIncrease = v2.filter(e => e.scores.overall < 3).map(e => ({ name: e.name, overall: e.scores.overall, need: (3 - e.scores.overall).toFixed(1) }));

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>五星制评分：缺失默认 3★ vs 2★ 对比测算</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; margin: 24px; background: #f8fafc; color: #1e293b; }
.container { max-width: 1100px; margin: 0 auto; background: #fff; padding: 24px 32px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
h1 { font-size: 22px; margin-bottom: 6px; }
.sub { color: #64748b; font-size: 13px; margin-bottom: 20px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
.card { background: #f8fafc; border-radius: 10px; padding: 16px; border: 1px solid #e2e8f0; }
.card h3 { margin: 0 0 12px; font-size: 16px; }
.metric { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; font-size: 13px; }
.metric:last-child { border-bottom: none; }
.big { font-size: 20px; font-weight: 700; }
.red { color: #dc2626; }
.green { color: #059669; }
.blue { color: #2563eb; }
table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
th, td { padding: 8px 10px; border: 1px solid #e2e8f0; text-align: left; }
th { background: #f1f5f9; font-weight: 600; }
tr:nth-child(even) { background: #f8fafc; }
.section { margin-top: 28px; }
.section h2 { font-size: 16px; border-left: 4px solid #3b82f6; padding-left: 10px; margin-bottom: 10px; }
.note { background: #fffbeb; border: 1px solid #fde68a; padding: 12px; border-radius: 8px; font-size: 12px; color: #92400e; line-height: 1.7; }
</style>
</head>
<body>
<div class="container">
  <h1>五星制评分：缺失默认 3★ vs 2★ 对比测算</h1>
  <div class="sub">样本：Supabase 线上 56 位真实专家 | 测算模型：v5.9.0 五星制 AI 评分 | 展示线：综合得分 &lt; 3★ 进入观察库</div>

  <div class="grid">
    <div class="card">
      <h3>方案 A：缺失默认 3★</h3>
      <div class="metric"><span>观察库人数</span><span class="big green">${s3.observation} 位 (${s3.observationPct}%)</span></div>
      <div class="metric"><span>平均综合得分</span><span class="big">${s3.avgOverall}</span></div>
      <div class="metric"><span>平均专业度</span><span>${s3.avgProf}</span></div>
      <div class="metric"><span>平均影响力</span><span>${s3.avgInfl}</span></div>
      <div class="metric"><span>分布 4-5★ / 3-4★ / 2-3★ / &lt;2★</span><span>${s3.buckets['4-5★']} / ${s3.buckets['3-4★']} / ${s3.buckets['2-3★']} / ${s3.buckets['<2★']}</span></div>
    </div>
    <div class="card">
      <h3>方案 B：缺失默认 2★</h3>
      <div class="metric"><span>观察库人数</span><span class="big red">${s2.observation} 位 (${s2.observationPct}%)</span></div>
      <div class="metric"><span>平均综合得分</span><span class="big">${s2.avgOverall}</span></div>
      <div class="metric"><span>平均专业度</span><span>${s2.avgProf}</span></div>
      <div class="metric"><span>平均影响力</span><span>${s2.avgInfl}</span></div>
      <div class="metric"><span>分布 4-5★ / 3-4★ / 2-3★ / &lt;2★</span><span>${s2.buckets['4-5★']} / ${s2.buckets['3-4★']} / ${s2.buckets['2-3★']} / ${s2.buckets['<2★']}</span></div>
    </div>
  </div>

  <div class="note">
    <b>核心发现：</b>在五星制新 AI 映射下，缺失默认 3★ 时所有 56 位专家均 ≥3★（观察库 0 人）；缺失默认 2★ 时 15 位（26.8%）进入观察库。两方案平均综合得分仅差 0.26★，但库容展示面差异显著。
  </div>

  <div class="section">
    <h2>展示线翻转专家（${changed.length} 位）</h2>
    <table>
      <tr><th>姓名</th><th>缺失=3★ 综合</th><th>缺失=2★ 综合</th><th>差值</th><th>3★ 专业度/影响力</th><th>2★ 专业度/影响力</th></tr>
      ${changed.map(e => `<tr><td>${e.name}</td><td>${e.o3.toFixed(1)}</td><td>${e.o2.toFixed(1)}</td><td>${e.delta}</td><td>${e.prof3.toFixed(1)} / ${e.infl3.toFixed(1)}</td><td>${e.prof2.toFixed(1)} / ${e.infl2.toFixed(1)}</td></tr>`).join('')}
    </table>
  </div>

  <div class="section">
    <h2>边界专家（综合 2.5-3.5★，${boundary.length} 位）</h2>
    <p style="font-size:12px;color:#64748b;margin:4px 0 10px;">这些专家对缺失默认取值最敏感，轻微调整即可能跨展示线。</p>
    <table>
      <tr><th>姓名</th><th>3★ 综合</th><th>2★ 综合</th><th>专业度</th><th>影响力</th></tr>
      ${boundary.slice(0, 40).map(e => `<tr><td>${e.name}</td><td>${e.overall3.toFixed(1)}</td><td>${e.overall2.toFixed(1)}</td><td>${e.prof.toFixed(1)}</td><td>${e.infl.toFixed(1)}</td></tr>`).join('')}
    </table>
  </div>

  <div class="section">
    <h2>方案 B 落选主因（子维度 &lt;3★ 出现次数）</h2>
    <table>
      <tr><th>子维度</th><th>出现次数</th></tr>
      ${Object.entries(reasons2).sort((a,b) => b[1]-a[1]).map(([k,v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
    </table>
  </div>

  <div class="section">
    <h2>调回展示线所需涨幅（方案 B 观察库专家）</h2>
    <table>
      <tr><th>姓名</th><th>当前综合（缺失=2★）</th><th>需涨到 3★</th></tr>
      ${needIncrease.map(e => `<tr><td>${e.name}</td><td>${e.overall.toFixed(1)}</td><td>+${e.need}</td></tr>`).join('')}
    </table>
  </div>

  <div class="section">
    <h2>结论与建议</h2>
    <div class="note">
      1. <b>方案 A（缺失=3★）</b>非常宽松：信息不明确的专家也能展示，适合“先展示再复核”。<br>
      2. <b>方案 B（缺失=2★）</b>较严格：约 1/4 专家进入观察库，需人工复核后决定是否展示，适合“宁缺毋滥”。<br>
      3. 边界专家多达 ${boundary.length} 位，说明<strong>缺失默认取值是主要杠杆</strong>，而非专家真实差距。<br>
      4. 调回难度低：方案 B 中观察库专家平均只需涨 0.1~0.5★ 即可达标，补实一项信息或据实上调一个子维度即可。<br>
      5. 建议：若希望减少人工复核量、优先保证库容，选 <b>3★</b>；若希望严控前端质量、接受人工复核，选 <b>2★</b>。也可折中尝试 <b>2.5★</b>（需支持半星输入，当前系统子维度为整数星）。
    </div>
  </div>
</div>
</body>
</html>`;

  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'score-five-star-compare.html'), html);
  console.log('report written:', path.join(__dirname, '..', 'docs', 'score-five-star-compare.html'));
}

main().catch(e => { console.error(e); process.exit(1); });
