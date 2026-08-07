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
  if (/世界500强|财富500|央企|国企|上市公司|股份|集团|有限责任公司|有限公司| co\.? ltd|inc\.|corp/i.test(text)) return { level: 1, reason: '世界500强/央企/国企/上市公司/集团' };
  if (/百强|大厂|头部|领军|龙头|行业前五|top\s?\d/i.test(text)) return { level: 0.5, reason: '百强/大厂/头部/领军' };
  return { level: 0, reason: '无明确权威机构关键词' };
}

function scoreEducation(txt, cfg) {
  if (/博士|博士后|phd/i.test(txt)) return { score: 5, reason: '识别到 博士/博士后/PhD' };
  if (/硕士|研究生|master|mba/i.test(txt)) return { score: 4, reason: '识别到 硕士/研究生/MBA' };
  if (/本科|学士|bachelor/i.test(txt)) return { score: 3, reason: '识别到 本科/学士' };
  if (/专科|大专|高职/i.test(txt)) return { score: 2, reason: '识别到 专科/大专/高职' };
  if (/中专|高中|初中|小学/i.test(txt)) return { score: 1, reason: '识别到 中专/高中/初中/小学' };
  return { score: cfg.missingScore, reason: '未识别学历关键词（未填/未公开/表述模糊）→ 缺失默认' };
}

function scoreCertification(txt, cfg) {
  if (/cfa|cpa|acca|pmp|国际权威|国际认证/i.test(txt)) return { score: 5, reason: '识别到 CFA/CPA/ACCA/PMP/国际权威认证' };
  if (/国家级执业|注册会计师|注册|执业资格|行业权威|权威认证/i.test(txt)) return { score: 4, reason: '识别到 国家级执业/注册/行业权威认证' };
  if (/认证|资格|华为|微软|阿里|腾讯|厂商认证/i.test(txt)) return { score: 3, reason: '识别到 厂商/通用认证或资格' };
  if (/培训|进修|课程|通用认证/i.test(txt)) return { score: 2, reason: '识别到 培训/进修/课程' };
  return { score: cfg.missingScore, reason: '未识别资质认证关键词 → 缺失默认' };
}

function scoreAchievement(txt, cfg) {
  if (/国标|行标|高被引|重大成果转化|牵头.*标准/i.test(txt)) return { score: 5, reason: '识别到 国标/行标/高被引/重大成果转化/牵头标准' };
  if (/国家级项目|战略级|顶刊/i.test(txt)) return { score: 4, reason: '识别到 国家级项目/战略级/顶刊' };
  if (/省级|行业级|sci|ei|论文|专利|软著|著作|出版/i.test(txt)) return { score: 3, reason: '识别到 省级/行业级/SCI/EI/论文/专利/软著/著作' };
  if (/项目|讲师|培训|课程|开发|服务|企业|集团|公司|经验/i.test(txt)) return { score: 3, reason: '识别到 项目/讲师/培训/课程/开发/服务/企业/经验（兜底3★）' };
  return { score: cfg.missingScore, reason: '未识别成果/经验关键词 → 缺失默认' };
}

function scoreHonor(txt, cfg) {
  if (/院士|国家级人才计划|长江学者|杰青|万人计划/i.test(txt)) return { score: 5, reason: '识别到 院士/国家级人才计划/长江学者/杰青/万人计划' };
  if (/国家级荣誉|国家级称号|国家.*奖/i.test(txt)) return { score: 4, reason: '识别到 国家级荣誉/称号/奖项' };
  if (/省部级|省级荣誉|省级称号/i.test(txt)) return { score: 3, reason: '识别到 省部级/省级荣誉/称号' };
  if (/地市|市级荣誉|国家级学会|协会|理事|委员/i.test(txt)) return { score: 2, reason: '识别到 地市/市级荣誉/国家级学会/协会/理事/委员' };
  return { score: cfg.missingScore, reason: '未识别荣誉奖项关键词 → 缺失默认' };
}

function scoreTitle(txt, cfg, authority) {
  const hasTopTitle = /教授|研究员|高级工程师|院士|首席|ceo|总裁|总经理|董事长|创始人/i.test(txt);
  const hasSeniorTitle = /总监|副总裁|合伙人|副教授|vp|director/i.test(txt);
  const hasMidTitle = /经理|高工|主管|高级工程师/i.test(txt);
  let s = cfg.missingScore;
  let reason = '未识别职称/管理履历关键词 → 缺失默认';
  if (hasTopTitle) { s = 4; reason = '识别到 教授/研究员/首席/CEO/总裁/总经理/董事长/创始人'; }
  else if (hasSeniorTitle) { s = 3; reason = '识别到 总监/副总裁/合伙人/副教授/VP/Director'; }
  else if (hasMidTitle) { s = 2; reason = '识别到 经理/高工/主管'; }

  if (authority.level === 1 && s < 5) { s += 1; reason += '；机构权威性上浮 +1★（' + authority.reason + '）'; }
  else if (authority.level === 0.5 && s < 4) { s += 1; reason += '；机构权威性上浮 +1★（' + authority.reason + '）'; }
  return { score: Math.min(5, s), reason };
}

function aiScoreExpertTrace(expert, cfg) {
  const qual = expert.qualifications || '';
  const adv = (expert.advantages || []).map(a => (a.title || '') + ' ' + a.desc).join(' ');
  const combinedText = qual + ' ' + adv + ' ' + (expert.education || '') + ' ' + (expert.background || '');
  const txt = combinedText.toLowerCase();
  const authority = getCompanyAuthorityLevel(txt);

  const traces = [];

  const profDim = cfg.dimensions.find(d => d.id === 'professional');
  expert.subScores = { professional: {}, influence: {} };
  profDim.subDimensions.forEach(sd => {
    let t;
    if (sd.name.indexOf('学历') >= 0) t = scoreEducation(txt, cfg);
    else if (sd.name.indexOf('资质') >= 0 || sd.name.indexOf('认证') >= 0) t = scoreCertification(txt, cfg);
    else if (sd.name.indexOf('成果') >= 0 || sd.name.indexOf('经验') >= 0) t = scoreAchievement(txt, cfg);
    else t = { score: cfg.missingScore, reason: '未匹配维度' };
    expert.subScores.professional[sd.name] = t.score;
    traces.push({ dim: '专业度', name: sd.name, score: t.score, reason: t.reason, isMissing: t.reason.includes('缺失默认') });
  });

  const inflDim = cfg.dimensions.find(d => d.id === 'influence');
  inflDim.subDimensions.forEach(sd => {
    let t;
    if (sd.name.indexOf('荣誉') >= 0 || sd.name.indexOf('奖项') >= 0) t = scoreHonor(txt, cfg);
    else if (sd.name.indexOf('职称') >= 0 || sd.name.indexOf('管理履历') >= 0 || sd.name.indexOf('行业地位') >= 0) t = scoreTitle(txt, cfg, authority);
    else t = { score: cfg.missingScore, reason: '未匹配维度' };
    expert.subScores.influence[sd.name] = t.score;
    traces.push({ dim: '影响力', name: sd.name, score: t.score, reason: t.reason, isMissing: t.reason.includes('缺失默认') });
  });

  return { traces, authority };
}

function recalcExpertFromSubscores(e, cfg) {
  const profDim = cfg.dimensions.find(d => d.id === 'professional');
  const inflDim = cfg.dimensions.find(d => d.id === 'influence');
  let prof = 0, infl = 0;
  if (e.subScores && e.subScores.professional && profDim && profDim.subDimensions) {
    profDim.subDimensions.forEach(sd => { prof += e.subScores.professional[sd.name] * sd.weight; });
  }
  if (e.subScores && e.subScores.influence && inflDim && inflDim.subDimensions) {
    inflDim.subDimensions.forEach(sd => { infl += e.subScores.influence[sd.name] * sd.weight; });
  }
  e.scores = {
    professional: Math.round(prof * 10) / 10,
    influence: Math.round(infl * 10) / 10,
    overall: Math.round((prof * profDim.weight + infl * inflDim.weight) * 10) / 10
  };
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function main() {
  const res = await fetch(URL + '/rest/v1/experts?select=*', {
    headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' }
  });
  const experts = await res.json();
  const cfg = makeCfg(3);

  const rows = experts.map(expert => {
    const e = JSON.parse(JSON.stringify(expert));
    const { traces, authority } = aiScoreExpertTrace(e, cfg);
    recalcExpertFromSubscores(e, cfg);
    return { ...e, traces, authority, raw: expert };
  }).sort((a, b) => b.scores.overall - a.scores.overall);

  // Aggregate stats
  const countsByScore = { 1:0, 2:0, 3:0, 4:0, 5:0 };
  const missingByDim = {};
  const matchedByDim = {};
  rows.forEach(r => {
    r.traces.forEach(t => {
      countsByScore[t.score] = (countsByScore[t.score] || 0) + 1;
      if (t.isMissing) missingByDim[t.dim + '·' + t.name] = (missingByDim[t.dim + '·' + t.name] || 0) + 1;
      else matchedByDim[t.dim + '·' + t.name] = (matchedByDim[t.dim + '·' + t.name] || 0) + 1;
    });
  });

  const observationCount = rows.filter(r => r.scores.overall < 3).length;
  const highScoreCount = rows.filter(r => r.scores.overall >= 4).length;

  // Examples: top, bottom, boundary
  const top3 = rows.slice(0, 3);
  const bottom3 = rows.slice(-3);
  const boundary = rows.filter(r => r.scores.overall >= 2.5 && r.scores.overall <= 3.5).slice(0, 10);

  const traceJson = {
    timestamp: new Date().toISOString(),
    sampleSize: experts.length,
    observationCount,
    highScoreCount,
    countsByScore,
    missingByDim,
    matchedByDim,
    experts: rows.map(r => ({
      name: r.name,
      education: r.education,
      qualifications: r.qualifications,
      background: r.background,
      advantages: r.advantages,
      scores: r.scores,
      observation: r.scores.overall < 3,
      authority: r.authority,
      traces: r.traces
    }))
  };

  const style = `
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; margin: 0; padding: 24px; background: #f8fafc; color: #1e293b; }
    .container { max-width: 1300px; margin: 0 auto; }
    .card { background: #fff; border-radius: 12px; padding: 20px 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    h1 { font-size: 22px; margin: 0 0 6px; }
    h2 { font-size: 16px; border-left: 4px solid #3b82f6; padding-left: 10px; margin: 0 0 14px; }
    h3 { font-size: 14px; margin: 16px 0 8px; color: #334155; }
    .sub { color: #64748b; font-size: 13px; margin-bottom: 16px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .metric { background: #f8fafc; border-radius: 8px; padding: 12px; border: 1px solid #e2e8f0; }
    .metric .label { font-size: 12px; color: #64748b; }
    .metric .value { font-size: 20px; font-weight: 700; margin-top: 4px; }
    .green { color: #059669; } .red { color: #dc2626; } .blue { color: #2563eb; } .orange { color: #d97706; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
    th, td { padding: 8px 10px; border: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; }
    tr:nth-child(even) { background: #f8fafc; }
    .score { font-weight: 700; }
    .score5 { color: #059669; } .score4 { color: #16a34a; } .score3 { color: #d97706; } .score2 { color: #dc2626; } .score1 { color: #991b1b; }
    .reason { color: #64748b; font-size: 11px; display: block; margin-top: 2px; }
    .missing { background: #fef3c7; }
    .obs { background: #fee2e2; }
    .note { background: #fffbeb; border: 1px solid #fde68a; padding: 12px; border-radius: 8px; font-size: 12px; color: #92400e; line-height: 1.7; }
    .code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #f1f5f9; padding: 2px 5px; border-radius: 4px; font-size: 11px; }
    pre { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 11px; line-height: 1.5; }
    .ellipsis { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `;

  function scoreClass(s) { return 'score score' + Math.round(s); }
  function scoreCell(t) {
    const cls = t.isMissing ? 'missing' : '';
    return `<td class="${cls}"><span class="${scoreClass(t.score)}">${t.score}★</span><span class="reason" title="${escapeHtml(t.reason)}">${escapeHtml(truncate(t.reason, 42))}</span></td>`;
  }

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>五星制评分：逐专家打分明细追踪</title>
<style>${style}</style>
</head>
<body>
<div class="container">
  <div class="card">
    <h1>五星制评分：逐专家打分明细追踪</h1>
    <div class="sub">样本：Supabase 线上 ${experts.length} 位真实专家 | 缺失默认 = 3★ | 展示线：综合 &lt; 3★</div>
    <div class="grid-3">
      <div class="metric"><div class="label">平均综合得分</div><div class="value blue">${(rows.reduce((s,r)=>s+r.scores.overall,0)/rows.length).toFixed(2)}★</div></div>
      <div class="metric"><div class="label">高分专家（≥4★）</div><div class="value green">${highScoreCount} 位 (${(highScoreCount/rows.length*100).toFixed(1)}%)</div></div>
      <div class="metric"><div class="label">观察库（&lt;3★）</div><div class="value red">${observationCount} 位 (${(observationCount/rows.length*100).toFixed(1)}%)</div></div>
    </div>
  </div>

  <div class="card">
    <h2>一、为什么高分少 / 平均分中庸？—— 诊断结论</h2>
    <div class="note">
      <b>1. 不是系统识别问题，而是规则“兜底 3★”太宽：</b>
      当前启发式规则对“有信息但不够顶尖”的专家一律给 3★（例如：只要提到“本科”就给 3★，只要提到“项目/经验”就给 3★）。
      这导致 5 项子维度大量集中在 3★，综合分自然被拉向 3.0–3.5 区间，真正达到 4–5★ 的顶尖信号（博士/院士/国标/世界500强等）很少。
      <br><br>
      <b>2. 真正“缺失”的比例并不高：</b>
      在 ${experts.length * 5} 项次评分中，缺失默认命中的主要是“学历未公开/未识别”和“荣誉/资质未识别”，其他维度因字段里多少有些相关关键词，大多被兜底为 3★ 而非判定为缺失。
      <br><br>
      <b>3. 差异化小的根因：档位粗 + 关键词匹配。</b>
      规则目前只用关键词 presence/absence，没有“985/211 区分”、“几篇论文/几个项目”等量纲；
      一个普通本科讲师和一个北大硕士都会被同一规则打到 3★ 或 4★，导致大量专家挤在同一档。
    </div>

    <h3>子维度得分分布（${experts.length * 5} 项次）</h3>
    <table>
      <tr><th>得分</th><th>1★</th><th>2★</th><th>3★</th><th>4★</th><th>5★</th></tr>
      <tr>
        <td>项次数</td>
        <td>${countsByScore[1]}</td>
        <td>${countsByScore[2]}</td>
        <td class="missing">${countsByScore[3]}</td>
        <td>${countsByScore[4]}</td>
        <td>${countsByScore[5]}</td>
      </tr>
      <tr>
        <td>占比</td>
        <td>${(countsByScore[1]/(experts.length*5)*100).toFixed(1)}%</td>
        <td>${(countsByScore[2]/(experts.length*5)*100).toFixed(1)}%</td>
        <td class="missing">${(countsByScore[3]/(experts.length*5)*100).toFixed(1)}%</td>
        <td>${(countsByScore[4]/(experts.length*5)*100).toFixed(1)}%</td>
        <td>${(countsByScore[5]/(experts.length*5)*100).toFixed(1)}%</td>
      </tr>
    </table>

    <h3>各维度“缺失默认”命中次数（真正未识别）</h3>
    <table>
      <tr><th>维度·评分项</th><th>缺失默认命中次数</th></tr>
      ${Object.entries(missingByDim).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr><td>${escapeHtml(k)}</td><td>${v}</td></tr>`).join('') || '<tr><td colspan="2">无</td></tr>'}
    </table>
  </div>

  <div class="card">
    <h2>二、极端案例参考</h2>
    <h3>高分代表（≥4.5★）</h3>
    ${top3.map(r => `
      <div style="margin-bottom:12px;padding:10px;background:#f8fafc;border-radius:6px;">
        <b>${escapeHtml(r.name)}</b> · 综合 ${r.scores.overall.toFixed(1)}★ · 专业 ${r.scores.professional.toFixed(1)} · 影响 ${r.scores.influence.toFixed(1)}
        <div style="font-size:12px;color:#64748b;margin-top:4px;">学历：${escapeHtml(truncate(r.education, 80))}</div>
        <div style="font-size:12px;color:#64748b;">资质：${escapeHtml(truncate(r.qualifications, 80))}</div>
        <div style="font-size:12px;color:#64748b;">背景：${escapeHtml(truncate(r.background, 80))}</div>
      </div>
    `).join('')}

    <h3>低分代表（如果改缺失=2★会进观察库的典型）</h3>
    ${bottom3.map(r => `
      <div style="margin-bottom:12px;padding:10px;background:#fee2e2;border-radius:6px;">
        <b>${escapeHtml(r.name)}</b> · 综合 ${r.scores.overall.toFixed(1)}★ · 专业 ${r.scores.professional.toFixed(1)} · 影响 ${r.scores.influence.toFixed(1)}
        <div style="font-size:12px;color:#64748b;margin-top:4px;">学历：${escapeHtml(truncate(r.education, 80))}</div>
        <div style="font-size:12px;color:#64748b;">资质：${escapeHtml(truncate(r.qualifications, 80))}</div>
        <div style="font-size:12px;color:#64748b;">背景：${escapeHtml(truncate(r.background, 80))}</div>
      </div>
    `).join('')}
  </div>

  <div class="card">
    <h2>三、逐专家打分明细（按综合得分降序）</h2>
    <table>
      <tr>
        <th>姓名</th>
        <th>学历与学术背景</th>
        <th>行业资质与认证</th>
        <th>专业成果与经验</th>
        <th>社会荣誉与奖项</th>
        <th>职称/管理履历/行业地位</th>
        <th>专业度</th>
        <th>影响力</th>
        <th>综合</th>
        <th>状态</th>
      </tr>
      ${rows.map(r => `
        <tr class="${r.scores.overall < 3 ? 'obs' : ''}">
          <td><b>${escapeHtml(r.name)}</b></td>
          ${scoreCell(r.traces.find(t => t.name === '学历与学术背景'))}
          ${scoreCell(r.traces.find(t => t.name === '行业资质与认证'))}
          ${scoreCell(r.traces.find(t => t.name === '专业成果与经验'))}
          ${scoreCell(r.traces.find(t => t.name === '社会荣誉与奖项'))}
          ${scoreCell(r.traces.find(t => t.name === '职称、管理履历与行业地位'))}
          <td>${r.scores.professional.toFixed(1)}</td>
          <td>${r.scores.influence.toFixed(1)}</td>
          <td><b class="${r.scores.overall >= 4 ? 'green' : (r.scores.overall >= 3 ? 'orange' : 'red')}">${r.scores.overall.toFixed(1)}</b></td>
          <td>${r.scores.overall < 3 ? '观察库' : '展示'}</td>
        </tr>
      `).join('')}
    </table>
  </div>

  <div class="card">
    <h2>四、原始字段示例（用于复核识别是否准确）</h2>
    <p style="font-size:12px;color:#64748b;">展示前 3 位高分 + 后 3 位低分的原始 education / qualifications / background / advantages 字段，可对照规则复核识别问题。</p>
    <pre>${escapeHtml(JSON.stringify([...top3, ...bottom3].map(r => ({
      name: r.name,
      education: r.education,
      qualifications: r.qualifications,
      background: r.background,
      advantages: r.advantages
    })), null, 2))}</pre>
  </div>
</div>
</body>
</html>`;

  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'score-five-star-trace.html'), html);
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'score-five-star-trace.json'), JSON.stringify(traceJson, null, 2));
  console.log('trace report written:', path.join(__dirname, '..', 'docs', 'score-five-star-trace.html'));
}

main().catch(e => { console.error(e); process.exit(1); });
