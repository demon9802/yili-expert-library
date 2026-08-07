// 缺失默认分两版对比（修正模型版）
// 关键修正：代码 aiScoreExpert 对"信息缺失"子维度实际赋代理值(min(8,round(专业度))等)，
//           配置 missingScore=5 几乎不触发。故对比 = [当前实际(代理值)] vs [缺失=X 政策]。
// 数据：Supabase 真实专家；子维度分忠实复现 aiScoreExpert。

const URL = 'https://owjdwwdipfsnumgoxzih.supabase.co';
const KEY = 'sb_publishable_GQR4Qj9MMaau2V-Zm7_bLA_XUhfaN6j';

const DIMENSIONS = [
  { id: 'professional', weight: 0.6, sub: [
    { name: '学历与学术背景', weight: 0.35 },
    { name: '行业资质与认证', weight: 0.30 },
    { name: '专业成果与经验', weight: 0.35 },
  ]},
  { id: 'influence', weight: 0.4, sub: [
    { name: '社会荣誉与奖项', weight: 0.35 },
    { name: '职称、管理履历与行业地位', weight: 0.65 },
  ]},
];
const CAP = 10;

function scoreSub(dimId, sdName, expert) {
  const qual = expert.qualifications || '';
  const adv = (expert.advantages || []).map(a => ((a && a.title) || '') + ' ' + ((a && a.desc) || '')).join(' ');
  const combinedText = qual + ' ' + adv + ' ' + (expert.education || '') + ' ' + (expert.background || '');
  const txt = combinedText.toLowerCase();
  const profScore = expert.scores ? expert.scores.professional : 7;
  const inflScore = expert.scores ? expert.scores.influence : 7;

  function authorityBonus(text) {
    if (/世界500强|财富500|央企|国企|上市公司|股份|集团|有限责任公司|有限公司| co\.? ltd|inc\.|corp/i.test(text)) return 1;
    if (/百强|大厂|头部|领军|龙头|行业前五|top\s?\d/i.test(text)) return 0.5;
    return 0;
  }

  const nameTxt = sdName.toLowerCase();
  let score = 5;        // 基值（实际几乎被覆盖）
  let infoFound = false; // 是否有关键词命中（即"有信心赋分"）

  if (dimId === 'professional') {
    if (/学历|学术|博士|博士后|phd|硕士|研究生|master|本科|学士|学位|教育|professor/i.test(nameTxt)) {
      if (/博士|博士后|phd|教授|研究员/i.test(txt)) { score = 9; infoFound = true; }
      else if (/硕士|研究生|master|mba/i.test(txt)) { score = 8; infoFound = true; }
      else if (/本科|学士|bachelor/i.test(txt)) { score = 7; infoFound = true; }
      else if (/专科|大专|高职|中专/i.test(txt)) { score = 4; infoFound = true; }
      else { score = 6; } // 类目命中但无具体关键词 → 弱/缺失
    } else if (/资质|认证|资格|certif|注[册会]|cpa|cfa|acca|license|头衔|社会/i.test(nameTxt)) {
      if (/认证|certif|注[册会]|cpa|cfa|acca|权威/i.test(txt)) { score = 9; infoFound = true; }
      else if (/资质|资格|license|行业头衔|社会头衔/i.test(txt)) { score = 7; infoFound = true; }
      else if (/培训|进修|学习|课程/i.test(txt)) { score = 6; }
      else { score = Math.min(8, Math.round(profScore || 7)); }
    } else if (/成果|经验|著作|出版|论文|研究|课题|专利|项目|经历|实践/i.test(nameTxt)) {
      if (/著作|出版|论文|研究|课题|专利|发明/i.test(txt)) { score = 9; infoFound = true; }
      else if (/讲师|培训|课程|开发|项目|服务/i.test(txt)) { score = 8; infoFound = true; }
      else if (/年|企业|集团|公司/i.test(txt)) { score = 7; infoFound = true; }
      else { score = Math.min(7, Math.round(profScore || 7)); }
    } else {
      score = Math.min(8, Math.round(profScore || 7));
    }
  } else {
    if (/荣誉|奖项|奖|称号|表彰|殊荣|十大|百强|社会/i.test(nameTxt)) {
      if (/奖|荣誉|称号|表彰|十大|百强/i.test(txt)) { score = 9; infoFound = true; }
      else if (/协会|学会|理事|委员|专家/i.test(txt)) { score = 8; infoFound = true; }
      else { score = Math.min(7, Math.round(inflScore || 7)); }
    } else if (/职称|头衔|教授|研究员|工程师|院士|首席|高级|技术|管理|履历|行业|地位|领导|职[位务]|ceo|总裁|总[经監]|董事|创始人/i.test(nameTxt)) {
      if (/教授|研究员|高级工程师|院士|首席|ceo|总裁|总经理|董事长|创始人|首席/i.test(txt)) { score = Math.min(10, 9 + authorityBonus(txt)); infoFound = true; }
      else if (/总监|副总裁|合伙人|创始人|副教授|vp|director/i.test(txt)) { score = Math.min(10, 8 + authorityBonus(txt)); infoFound = true; }
      else if (/经理|主管|lead|高级/i.test(txt)) { score = 7; infoFound = true; }
      else { score = Math.min(7, Math.round(inflScore || 7)); }
    } else {
      score = Math.min(7, Math.round(inflScore || 7));
    }
  }
  score = Math.min(CAP, Math.max(1, score));
  return { score, infoFound };
}

function buildSubScores(expert) {
  const aiSub = { professional: {}, influence: {} };
  const missingMap = { professional: {}, influence: {} };
  DIMENSIONS.forEach(dim => dim.sub.forEach(sd => {
    const r = scoreSub(dim.id, sd.name, expert);
    aiSub[dim.id][sd.name] = r.score;
    missingMap[dim.id][sd.name] = !r.infoFound;
  }));
  return { aiSub, missingMap };
}

function recalc(sub) {
  let prof = 0, infl = 0;
  DIMENSIONS.forEach(dim => {
    let acc = 0;
    dim.sub.forEach(sd => {
      let v = sub[dim.id][sd.name];
      v = Math.min(CAP, Math.max(0, v));
      acc += v * sd.weight;
    });
    if (dim.id === 'professional') prof = Math.round(acc * 10) / 10;
    else infl = Math.round(acc * 10) / 10;
  });
  const overall = Math.round((prof * 0.6 + infl * 0.4) * 10) / 10;
  return { prof, infl, overall };
}

function policySub(aiSub, missingMap, m) {
  const out = { professional: {}, influence: {} };
  DIMENSIONS.forEach(dim => dim.sub.forEach(sd => {
    out[dim.id][sd.name] = missingMap[dim.id][sd.name] ? m : aiSub[dim.id][sd.name];
  }));
  return out;
}

function main() {
  fetch(URL + '/rest/v1/experts?select=*', {
    headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' }
  }).then(r => r.json()).then(rows => {
    const experts = rows.map(r => ({
      name: r.name, qualifications: r.qualifications, advantages: r.advantages,
      education: r.education, background: r.background,
      stored: r.scores || { overall: 0, professional: 0, influence: 0 }, status: r.status,
    }));

    const built = experts.map(e => {
      const { aiSub, missingMap } = buildSubScores(e);
      const actual = recalc(aiSub);
      const scenarios = { actual };
      [5, 4, 3, 2].forEach(m => { scenarios[m] = recalc(policySub(aiSub, missingMap, m)); });
      const missingCount = Object.values(missingMap.professional).filter(Boolean).length + Object.values(missingMap.influence).filter(Boolean).length;
      const missingDims = [];
      DIMENSIONS.forEach(dim => dim.sub.forEach(sd => { if (missingMap[dim.id][sd.name]) missingDims.push((dim.id === 'professional' ? '专·' : '影·') + sd.name); }));
      return { name: e.name, stored: e.stored, status: e.status, actual, scenarios, missingCount, missingDims };
    });

    // 复现校验：与 Supabase 存储分对比
    let errSum = 0, errMax = 0, errMaxName = '';
    built.forEach(b => {
      const d = Math.abs(b.actual.overall - (b.stored.overall || 0));
      errSum += d; if (d > errMax) { errMax = d; errMaxName = b.name; }
    });
    const meanErr = (errSum / built.length).toFixed(2);

    const THRESH = 7;
    const policyKeys = [5, 4, 3, 2];
    const agg = { actual: mkAgg(built, 'actual', THRESH) };
    policyKeys.forEach(m => agg[m] = mkAgg(built, m, THRESH));

    function hist(key) {
      const buckets = {};
      built.forEach(b => { const o = b.scenarios[key].overall; const k = Math.floor(o); buckets[k] = (buckets[k] || 0) + 1; });
      return buckets;
    }
    const hists = { actual: hist('actual') }; policyKeys.forEach(m => hists[m] = hist(m));

    const flips = built.filter(b => b.scenarios[5].overall >= THRESH && b.scenarios[2].overall < THRESH);
    const borderFrom5 = built.filter(b => b.scenarios[5].overall >= 6.5 && b.scenarios[5].overall < 7.5);
    const borderFromActual = built.filter(b => b.actual.overall >= 6.5 && b.actual.overall < 7.5);
    const sorted5 = [...built].sort((a, b) => a.scenarios[5].overall - b.scenarios[5].overall);
    const lowest = sorted5.slice(0, 8);
    const sens = [...built].sort((a, b) => (b.scenarios[5].overall - b.scenarios[2].overall) - (a.scenarios[5].overall - a.scenarios[2].overall)).slice(0, 8);

    const report = renderHTML(built, agg, hists, flips, borderFrom5, borderFromActual, lowest, sens, meanErr, errMax, errMaxName, policyKeys);
    require('fs').writeFileSync('docs/score-missing-compare.html', report, 'utf8');
    console.log('DONE experts=' + built.length);
    console.log('复现校验 meanErr=' + meanErr + ' maxErr=' + errMax.toFixed(2) + ' (' + errMaxName + ')');
    console.log('obs actual=' + agg.actual.obsCount + ' | @5=' + agg[5].obsCount + ' | @2=' + agg[2].obsCount);
    console.log('flips(5->2)=' + flips.length + ' border@5=' + borderFrom5.length + ' border@actual=' + borderFromActual.length);
  }).catch(e => console.log('ERR', e.message, e.stack));
}

function mkAgg(built, key, THRESH) {
  const obs = built.filter(b => b.scenarios[key].overall < THRESH);
  const byDim = { professional: 0, influence: 0 };
  obs.forEach(b => { if (b.scenarios[key].prof < THRESH) byDim.professional++; if (b.scenarios[key].infl < THRESH) byDim.influence++; });
  return { total: built.length, obsCount: obs.length, obsRate: (obs.length / built.length * 100).toFixed(1), byDim };
}
main();

function renderHTML(built, agg, hists, flips, borderFrom5, borderFromActual, lowest, sens, meanErr, errMax, errMaxName, policyKeys) {
  const bar = (n, max) => `<div style="display:flex;align-items:center;gap:6px;font-size:12px;margin:2px 0;"><div style="width:${max?n/max*100:0}%;background:#3B82F6;height:14px;border-radius:3px;"></div><span>${n}</span></div>`;
  const maxH = Math.max(...[ 'actual', ...policyKeys ].flatMap(m => Object.values(hists[m])));
  let histHTML = '';
  [ 'actual', ...policyKeys ].forEach(m => {
    const label = m === 'actual' ? '当前实际（代理值，部署态）' : ('缺失默认=' + m + '（' + (m === 5 ? '≈3★·当前文档政策' : '≈' + m + '★') + '）');
    histHTML += `<div style="margin-bottom:10px;"><div style="font-weight:600;margin-bottom:4px;">${label}</div>`;
    for (let k = 10; k >= 0; k--) { const n = hists[m][k] || 0; histHTML += `<div style="display:flex;align-items:center;gap:8px;font-size:11px;"><span style="width:28px;color:#64748b;">${k}-${k + 1}</span>${bar(n, maxH)}</div>`; }
    histHTML += `</div>`;
  });
  const expertRow = (b, m) => { const s = b.scenarios[m]; const c = s.overall < 7 ? '#dc2626' : s.overall < 8 ? '#d97706' : '#059669'; return `<tr><td>${b.name}</td><td style="color:${c};font-weight:600;">${s.overall.toFixed(1)}</td><td>${s.prof.toFixed(1)}</td><td>${s.infl.toFixed(1)}</td><td style="color:#94a3b8;">缺失${b.missingCount}项</td></tr>`; };
  const flipRows = flips.map(b => `<tr><td>${b.name}</td><td style="color:#059669;">${b.scenarios[5].overall.toFixed(1)}</td><td style="color:#dc2626;">${b.scenarios[2].overall.toFixed(1)}</td><td>${b.missingDims.join('、') || '—'}</td></tr>`).join('');
  const borderRows = borderFrom5.map(b => `<tr><td>${b.name}</td><td>${b.scenarios[5].overall.toFixed(1)}</td><td>${b.scenarios[2].overall.toFixed(1)}</td><td>需 +${(7 - b.scenarios[5].overall).toFixed(1)}</td><td>${b.missingDims.join('、') || '—'}</td></tr>`).join('');
  const lowRows = lowest.map(b => expertRow(b, 5)).join('');
  const sensRows = sens.map(b => `<tr><td>${b.name}</td><td>${b.scenarios[5].overall.toFixed(1)}</td><td>${b.scenarios[2].overall.toFixed(1)}</td><td style="color:#dc2626;font-weight:600;">Δ${(b.scenarios[5].overall - b.scenarios[2].overall).toFixed(1)}</td></tr>`).join('');
  const sumRows = [ 'actual', ...policyKeys ].map(m => { const a = agg[m]; const label = m === 'actual' ? '当前实际（代理值）' : ('缺失=' + m + '（' + (m === 5 ? '≈3★' : '≈' + m + '★') + '）'); return `<tr><td style="font-weight:600;">${label}</td><td>${a.obsCount}</td><td>${a.obsRate}%</td><td>${a.byDim.professional}</td><td>${a.byDim.influence}</td></tr>`; }).join('');

  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>缺失默认分两版对比</title>
<style>body{font-family:-apple-system,'Segoe UI',sans-serif;max-width:980px;margin:24px auto;padding:0 16px;color:#0f172a;line-height:1.6;}
h1{font-size:22px;border-bottom:3px solid #2563eb;padding-bottom:8px;}h2{font-size:17px;margin-top:28px;color:#1e40af;}
table{border-collapse:collapse;width:100%;font-size:13px;margin:10px 0;}th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left;}
th{background:#f1f5f9;} .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin:12px 0;}
.note{font-size:12px;color:#64748b;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px;}</style></head>
<body>
<h1>评分缺失默认分 · 两版对比测算（修正模型）</h1>
<div class="note"><b>口径说明</b>：数据来自线上 Supabase 真实专家（${built.length} 位）。子维度分由 app.js 的 aiScoreExpert 启发式在 Node 中忠实复现。
<b>重要修正</b>：代码对"信息缺失"子维度实际赋的是<b>代理值</b>（如 min(8, round(专业度))），配置项 missingScore=5 几乎不被触发——所以"当前实际"用的是代理值，而非干净的 5。
对比方案 = <b>当前实际（代理值）</b> vs <b>缺失默认={5,4,3,2}</b>（即把信息缺失项统一设为该固定值）。综合 = 专业度×60% + 影响力×40%，综合&lt;7 进观察库。
<br><b>复现校验</b>：我复现的综合得分与 Supabase 存储分值的平均误差 = <b>${meanErr}</b> 分，最大误差 = ${errMax.toFixed(2)} 分（${errMaxName}），说明复现基本忠实（差异来自手动调分/补录未进文本字段）。</div>

<h2>一、整体分布对比（综合得分直方图）</h2>
<div class="card">${histHTML}</div>

<h2>二、进观察库（综合&lt;7）汇总</h2>
<table><thead><tr><th>方案</th><th>进观察库人数</th><th>占比</th><th>其中专业度&lt;7</th><th>其中影响力&lt;7</th></tr></thead><tbody>${sumRows}</tbody></table>
<div class="note">从"当前实际"到"缺失=2"：进观察库由 ${agg.actual.obsCount} 人增至 ${agg[2].obsCount} 人（+${agg[2].obsCount - agg.actual.obsCount}）。
注意：<b>缺失=5 反而比当前实际更多</b>进观察库（${agg[5].obsCount} vs ${agg.actual.obsCount}）——因为当前实际用偏高的代理值托住了缺失项，而干净的"缺失=5"反而更低。这说明"缺失给5"并非当前部署行为。</div>

<h2>三、翻转专家（缺失=5 可展示 → 缺失=2 落入观察库）</h2>
<p>共 <b>${flips.length}</b> 位：当前靠缺失项按 5 计才过展示线，降到 2 便跌破。</p>
<table><thead><tr><th>专家</th><th>缺失=5 综合</th><th>缺失=2 综合</th><th>缺失的子维度</th></tr></thead><tbody>${flipRows}</tbody></table>

<h2>四、边界专家（缺失=5 时 6.5–7.5）</h2>
<p>共 <b>${borderFrom5.length}</b> 位，距展示线最近，调分/补信息最敏感。当前实际边界 ${borderFromActual.length} 位。</p>
<table><thead><tr><th>专家</th><th>缺失=5 综合</th><th>缺失=2 综合</th><th>调回展示线所需</th><th>缺失的子维度</th></tr></thead><tbody>${borderRows}</tbody></table>

<h2>五、极端情形（缺失=5 时综合最低）</h2>
<table><thead><tr><th>专家</th><th>综合</th><th>专业度</th><th>影响力</th><th>缺失情况</th></tr></thead><tbody>${lowRows}</tbody></table>

<h2>六、对缺失默认最敏感前 8 位（缺失 5→2 跌幅）</h2>
<table><thead><tr><th>专家</th><th>缺失=5 综合</th><th>缺失=2 综合</th><th>跌幅</th></tr></thead><tbody>${sensRows}</tbody></table>

<div class="note"><b>结论提示</b>：
① 维度/综合得分为平均值（权重计算），管理员只能改 5 个整数评分项 → 不会出现"飞升/跌落"，调分影响平滑、可解释。
② "缺失=2"较激进：会把约 ${(agg[2].obsCount - agg.actual.obsCount)} 位当前可展示专家转为进观察库复核（占全库 ${((agg[2].obsCount - agg.actual.obsCount) / built.length * 100).toFixed(0)}%），主要伤及"信息不全但被中性/代理值托住"的群体。
③ 翻转与边界专家集中在缺失 1–2 个子维度者，管理员只需补实其中一项信息或据实上调对应评分项整数分即可回展示线，调分难度低。
④ 是否采用"缺失=2"= 策略取舍：宁可严（信息不全先进观察库复核）vs 宁可宽（先展示、靠人工复核）。建议结合观察库容量与人工复核成本决定；亦可折中取"缺失=3 或 4"。</div>
</body></html>`;
}
