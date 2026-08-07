const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://owjdwwdipfsnumgoxzih.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GQR4Qj9MMaau2V-Zm7_bLA_XUhfaN6j';

function roundScore(s) { return Math.round(s * 10) / 10; }

const cfg3 = {
  configVersion: 4, missingScore: 3, cap: 5, observationThreshold: 3,
  dimensions: [
    { id: 'professional', name: '专业度', weight: 0.6, subDimensions: [
      { name: '学历与学术背景', weight: 1/3 },
      { name: '行业资质与认证', weight: 1/3 },
      { name: '专业成果与经验', weight: 1/3 }
    ]},
    { id: 'influence', name: '影响力', weight: 0.4, subDimensions: [
      { name: '社会荣誉与奖项', weight: 0.5 },
      { name: '职称、管理履历与行业地位', weight: 0.5 }
    ]}
  ]
};
const cfg2 = JSON.parse(JSON.stringify(cfg3));
cfg2.missingScore = 2;

function aiScoreExpert(expert, cfg) {
  const qual = expert.qualifications || '';
  const adv = (Array.isArray(expert.advantages) ? expert.advantages : []).map(a => (a.title || '') + ' ' + (a.desc || '')).join(' ');
  const combinedText = qual + ' ' + adv + ' ' + (expert.education || '') + ' ' + (expert.background || '');
  const txt = combinedText.toLowerCase();

  // 任职机构权威性：2=顶尖（世界500强/央企/知名大厂/C0），1=行业百强/大厂/C1，0=普通/C2
  function getCompanyAuthorityLevel(text) {
    if (/世界500强|财富500|央企|国有企业|上市公司|知名大厂|华为|腾讯|阿里巴巴|字节跳动|百度|美团|京东|滴滴|小米|网易|搜狐|新浪|联想|海尔|格力/i.test(text)) return 2;
    if (/百强|行业百强|领军企业|龙头企业|行业前五|行业前三|头部企业|大厂|top\s?5|top\s?10/i.test(text)) return 1;
    return 0;
  }
  const authorityLevel = getCompanyAuthorityLevel(txt);

  function isExplicitlyMissing(fieldText) {
    return /未公开|保密|暂无|不清楚|未知|缺失|无.*信息|信息未提供/i.test(fieldText);
  }

  // ① 学历与学术背景
  function scoreEducation() {
    const eduText = ((expert.education || '') + ' ' + (expert.background || '')).toLowerCase();
    if (!eduText.trim() || isExplicitlyMissing(eduText)) return cfg.missingScore;
    // 顶尖院校
    const topSchools = /清华|北大|中国科学技术大学|中科大|复旦大学|上海交大|上海交通大学|浙江大学|南京大学|哈尔滨工业大学|哈工大|西安交通大学|西交大|中国人民大学|c9|qs前50|qs top 50|常春藤|mit|斯坦福|哈佛|牛津|剑桥/i;
    const eliteSchools = /985|211|双一流|海外知名|国外知名|世界知名/i;
    const hasTop = topSchools.test(eduText);
    const hasElite = eliteSchools.test(eduText);
    if (/博士|博士后|phd/i.test(eduText)) return hasTop ? 5 : 4;
    if (/硕士|研究生|master|mba/i.test(eduText)) return hasElite ? 4 : 3;
    if (/本科|学士|bachelor/i.test(eduText)) return hasElite ? 3 : 2;
    if (/专科|大专|高职/i.test(eduText)) return 2;
    if (/中专|高中|初中|小学/i.test(eduText)) return 1;
    return cfg.missingScore;
  }

  // ② 行业资质与认证
  function scoreCertification() {
    if (/无.*认证|无.*资质|没有认证|没有资质/i.test(txt)) return 1;
    if (/cfa|cpa|acca|pmp|frm|国际权威认证|国际公认|国际认可|国际注册/i.test(txt)) return 5;
    if (/注册会计师|注册税务师|注册资产评估师|执业律师|执业医师|专利代理人|国家级执业|国家.*资格|高级技师|一级建造师|注册电气工程师|注册结构工程师/i.test(txt)) return 4;
    if (/hcie|微软mvp|阿里云.*认证|腾讯云.*认证|aws.*认证|谷歌.*认证|oracle.*认证|cissp|cisa|itil|六西格玛黑带|精益黑带|厂商.*高级认证|厂商.*专家/i.test(txt)) return 3;
    if (/认证讲师|认证培训师|认证.*师|华为.*讲师|微软.*讲师|厂商.*认证|获得.*认证|资格证书|职业资格/i.test(txt)) return 3;
    if (/培训.*证书|进修.*证书|课程.*证书|结业.*证书|通用认证|参加过.*培训/i.test(txt)) return 2;
    return cfg.missingScore;
  }

  // ③ 专业成果与经验
  function scoreAchievement() {
    if (/仅.*演讲|只.*演讲|一般.*经验|无.*成果|无.*项目/i.test(txt)) return 1;
    if (/牵头.*国标|牵头.*行标|牵头.*标准|制定.*国家标准|制定.*行业标准|高被引|重大.*成果转化|国家.*重大.*专项/i.test(txt)) return 5;
    if (/国家级.*项目|国家.*项目|战略.*项目|顶刊|nature|science|cell|sci.*一作|sci.*通讯|top.*期刊/i.test(txt)) return 4;
    // 统计软著数量
    const softMatch = txt.match(/(\d+)\s*项?\s*软著|软著\s*(\d+)\s*项?/g);
    let softCount = 0;
    if (softMatch) {
      softMatch.forEach(m => {
        const n = parseInt(m.match(/\d+/)[0], 10);
        if (n > softCount) softCount = n;
      });
    }
    const hasHighPatent = /发明.*专利|发明专利|国家.*专利|国际.*专利/i.test(txt);
    const hasSCI = /sci|ei|核心期刊|cssci|北大核心/i.test(txt);
    const hasPublish = /出版.*著作|出版.*书籍|专著|著书|主编|副主编/i.test(txt);
    const hasProvincial = /省级.*项目|省部级.*项目|行业.*项目|行业级.*项目|重点.*项目/i.test(txt);
    if (hasProvincial || hasSCI || hasHighPatent || softCount >= 5 || hasPublish) return 3;
    if (/参与.*项目|普通.*论文|软著|实用新型|参与.*研发|参与.*课题|论文.*发表/i.test(txt) || softCount >= 1) return 2;
    if (/项目|讲师|培训|课程|开发|服务|企业|集团|公司|经验/i.test(txt)) return 2;
    return cfg.missingScore;
  }

  // ④ 社会荣誉与奖项
  function scoreHonor() {
    if (/无.*荣誉|无.*奖项|不是.*会员|非.*会员/i.test(txt)) return 1;
    if (/院士|国家级人才计划|长江学者|杰青|万人计划|国家.*特聘|国家.*领军|享受国务院|国家级.*专家/i.test(txt)) return 5;
    if (/国家级.*荣誉|国家级.*称号|国家.*奖|全国.*奖|国家.*表彰/i.test(txt)) return 4;
    if (/省部级|省级.*荣誉|省级.*称号|省.*奖|部.*奖|自治区.*奖/i.test(txt)) return 3;
    if (/地市.*荣誉|市级.*荣誉|市.*奖|国家级学会.*理事|国家级学会.*委员|协会.*理事|协会.*委员/i.test(txt)) return 2;
    if (/协会.*会员|学会.*会员|会员|理事|委员/i.test(txt)) return 1;
    return cfg.missingScore;
  }

  // ⑤ 职称、管理履历与行业地位
  function scoreTitle() {
    const hasProfessor = /教授|研究员|正高|正高级/i.test(txt);
    const hasSeniorTitle = /副教授|总监|副总裁|合伙人|vp\b|director|cio|cto|cfo| coo/i.test(txt);
    const hasMidTitle = /经理|主管|高工|高级工程师|讲师|工程师|项目经理/i.test(txt);
    const hasFounder = /创始人|ceo|首席执行官|总裁|总经理|董事长|董事局主席/i.test(txt);
    let s = cfg.missingScore;
    if (hasFounder || hasProfessor) {
      if (authorityLevel === 2) s = 5;
      else if (authorityLevel === 1) s = 4;
      else s = 4; // 教授/创始人即使机构普通也给4
    } else if (hasSeniorTitle) {
      s = authorityLevel >= 1 ? 4 : 3;
    } else if (hasMidTitle) {
      s = 2;
    }
    return Math.max(1, Math.min(5, s));
  }

  const subScores = { professional: {}, influence: {} };
  cfg.dimensions.find(d => d.id === 'professional').subDimensions.forEach(sd => {
    const name = sd.name;
    let s = cfg.missingScore;
    if (name.includes('学历')) s = scoreEducation();
    else if (name.includes('资质') || name.includes('认证')) s = scoreCertification();
    else if (name.includes('成果') || name.includes('经验')) s = scoreAchievement();
    subScores.professional[name] = Math.max(1, Math.min(cfg.cap, Math.round(s)));
  });
  cfg.dimensions.find(d => d.id === 'influence').subDimensions.forEach(sd => {
    const name = sd.name;
    let s = cfg.missingScore;
    if (name.includes('荣誉') || name.includes('奖项')) s = scoreHonor();
    else if (name.includes('职称') || name.includes('管理履历') || name.includes('行业地位')) s = scoreTitle();
    subScores.influence[name] = Math.max(1, Math.min(cfg.cap, Math.round(s)));
  });
  return subScores;
}

function recalc(subScores, cfg) {
  const profDim = cfg.dimensions.find(d => d.id === 'professional');
  const inflDim = cfg.dimensions.find(d => d.id === 'influence');
  let profSum = 0;
  profDim.subDimensions.forEach(sd => {
    profSum += (subScores.professional[sd.name] || cfg.missingScore) * sd.weight;
  });
  let inflSum = 0;
  inflDim.subDimensions.forEach(sd => {
    inflSum += (subScores.influence[sd.name] || cfg.missingScore) * sd.weight;
  });
  const professional = roundScore(profSum);
  const influence = roundScore(inflSum);
  const overall = roundScore(professional * profDim.weight + influence * inflDim.weight);
  return { professional, influence, overall };
}

async function fetchExperts() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/experts?select=*&order=id`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Accept': 'application/json'
    }
  });
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status} ${res.statusText}`);
  return await res.json();
}

function classify(score, cfg) {
  return score < cfg.observationThreshold ? 'observation' : 'active';
}

function buildReport(experts) {
  const by3 = experts.map(e => {
    const sub = aiScoreExpert(e, cfg3);
    const scores = recalc(sub, cfg3);
    return { id: e.id, name: e.name, fields: e.fields, sub, scores, status: classify(scores.overall, cfg3), raw: { education: e.education, qualifications: e.qualifications, background: e.background, advantages: e.advantages } };
  }).sort((a, b) => b.scores.overall - a.scores.overall);

  const by2 = experts.map(e => {
    const sub = aiScoreExpert(e, cfg2);
    const scores = recalc(sub, cfg2);
    return { id: e.id, name: e.name, fields: e.fields, sub, scores, status: classify(scores.overall, cfg2) };
  }).sort((a, b) => b.scores.overall - a.scores.overall);

  const stats = (arr, cfg) => {
    const obs = arr.filter(x => x.status === 'observation');
    const avg = roundScore(arr.reduce((s, x) => s + x.scores.overall, 0) / arr.length);
    const buckets = {
      '4-5★': arr.filter(x => x.scores.overall >= 4).length,
      '3-4★': arr.filter(x => x.scores.overall >= 3 && x.scores.overall < 4).length,
      '2-3★': arr.filter(x => x.scores.overall >= 2 && x.scores.overall < 3).length,
      '<3★(观察库)': obs.length
    };
    return { total: arr.length, observation: obs.length, observationRate: roundScore(obs.length / arr.length * 100), average: avg, buckets };
  };

  // find flips and boundary cases
  const map3 = new Map(by3.map(x => [x.id, x]));
  const map2 = new Map(by2.map(x => [x.id, x]));
  const flips = by3.filter(x3 => {
    const x2 = map2.get(x3.id);
    return x3.status === 'active' && x2.status === 'observation';
  }).sort((a, b) => a.scores.overall - b.scores.overall).map(x3 => {
    const x2 = map2.get(x3.id);
    return { id: x3.id, name: x3.name, score3: x3.scores.overall, score2: x2.scores.overall, diff: roundScore(x3.scores.overall - x2.scores.overall) };
  });

  const boundary = by3.filter(x3 => {
    const o = x3.scores.overall;
    return o >= 2.5 && o < 3.5;
  }).sort((a, b) => a.scores.overall - b.scores.overall).map(x3 => {
    const x2 = map2.get(x3.id);
    return { id: x3.id, name: x3.name, score3: x3.scores.overall, score2: x2.scores.overall };
  });

  const subDimDistribution = {};
  cfg3.dimensions.forEach(d => {
    d.subDimensions.forEach(sd => {
      const counts = {1:0,2:0,3:0,4:0,5:0};
      by3.forEach(e => {
        const s = e.sub[d.id][sd.name];
        counts[s] = (counts[s] || 0) + 1;
      });
      subDimDistribution[sd.name] = counts;
    });
  });

  return {
    generatedAt: new Date().toISOString(),
    missing3: { config: cfg3, stats: stats(by3, cfg3), experts: by3 },
    missing2: { config: cfg2, stats: stats(by2, cfg2), experts: by2 },
    flips,
    boundary,
    subDimDistribution
  };
}

function renderHTML(report) {
  const head = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>五星制细化规则测算：缺失3★ vs 2★</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;background:#f8fafc;padding:24px;color:#1f2937;}
.wrap{max-width:1200px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08);}
h1{font-size:22px;margin-bottom:8px;}h2{font-size:18px;margin-top:28px;border-bottom:1px solid #e5e7eb;padding-bottom:8px;}
.sub{color:#6b7280;font-size:13px;margin-bottom:20px;}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:20px 0;}
.card{background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:18px;}
.card h3{margin-top:0;font-size:16px;color:#111827;}
.stat{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #e5e7eb;font-size:14px;}
.stat:last-child{border-bottom:none;}
table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px;}
th,td{border:1px solid #e5e7eb;padding:8px;text-align:left;}
th{background:#f3f4f6;font-weight:600;}
tr:nth-child(even){background:#fafafa;}
.obs{color:#dc2626;font-weight:600;}
.ok{color:#16a34a;}
.warn{color:#d97706;}
.legend{font-size:12px;color:#6b7280;margin-top:6px;}
</style></head><body>`;
  const s3 = report.missing3.stats; const s2 = report.missing2.stats;
  const cards = `
<div class="grid">
  <div class="card">
    <h3>缺失默认 = 3★</h3>
    <div class="stat"><span>专家总数</span><span>${s3.total}</span></div>
    <div class="stat"><span>观察库人数</span><span class="${s3.observation>0?'obs':'ok'}">${s3.observation} (${s3.observationRate}%)</span></div>
    <div class="stat"><span>平均综合</span><span>${s3.average}★</span></div>
    <div class="stat"><span>4–5★</span><span>${s3.buckets['4-5★']}</span></div>
    <div class="stat"><span>3–4★</span><span>${s3.buckets['3-4★']}</span></div>
    <div class="stat"><span>2–3★</span><span>${s3.buckets['2-3★']}</span></div>
  </div>
  <div class="card">
    <h3>缺失默认 = 2★</h3>
    <div class="stat"><span>专家总数</span><span>${s2.total}</span></div>
    <div class="stat"><span>观察库人数</span><span class="${s2.observation>0?'obs':'ok'}">${s2.observation} (${s2.observationRate}%)</span></div>
    <div class="stat"><span>平均综合</span><span>${s2.average}★</span></div>
    <div class="stat"><span>4–5★</span><span>${s2.buckets['4-5★']}</span></div>
    <div class="stat"><span>3–4★</span><span>${s2.buckets['3-4★']}</span></div>
    <div class="stat"><span>2–3★</span><span>${s2.buckets['2-3★']}</span></div>
  </div>
</div>`;

  const distRows = Object.entries(report.subDimDistribution).map(([name, counts]) => {
    const total = Object.values(counts).reduce((a,b)=>a+b,0);
    const pct = n => total ? Math.round(n/total*100) : 0;
    return `<tr><td>${name}</td><td>${counts[5]} (${pct(counts[5])}%)</td><td>${counts[4]} (${pct(counts[4])}%)</td><td>${counts[3]} (${pct(counts[3])}%)</td><td>${counts[2]} (${pct(counts[2])}%)</td><td>${counts[1]} (${pct(counts[1])}%)</td></tr>`;
  }).join('');
  const distTable = `
<h2>细化规则后：子维度分布（缺失=3★）</h2>
<table><tr><th>评分项</th><th>5★</th><th>4★</th><th>3★</th><th>2★</th><th>1★</th></tr>${distRows}</table>
<p class="legend">3★ 占比过高说明信息模糊或规则仍偏保守；细化后 4★/5★ 应比旧规则明显增多。</p>`;

  const flipRows = report.flips.map(x => `<tr><td>${x.name}</td><td>${x.score3}</td><td class="ok">${x.score2}</td><td>${x.diff}</td></tr>`).join('');
  const flipTable = report.flips.length ? `
<h2>3★ 正常 → 2★ 进观察库（共 ${report.flips.length} 人）</h2>
<table><tr><th>姓名</th><th>缺失=3★ 综合</th><th>缺失=2★ 综合</th><th>分差</th></tr>${flipRows}</table>` : '<h2>无 3★→2★ 翻转专家</h2>';

  const boundRows = report.boundary.map(x => `<tr><td>${x.name}</td><td>${x.score3}</td><td>${x.score2}</td></tr>`).join('');
  const boundTable = `
<h2>边界专家（2.5–3.5★，共 ${report.boundary.length} 人）</h2>
<table><tr><th>姓名</th><th>缺失=3★ 综合</th><th>缺失=2★ 综合</th></tr>${boundRows}</table>
<p class="legend">这些专家对缺失默认取值最敏感，是规则松紧的主要杠杆。</p>`;

  const top3Rows = report.missing3.experts.slice(0,10).map(e => {
    const prof = e.sub.professional;
    const infl = e.sub.influence;
    return `<tr><td>${e.name}</td><td>${prof['学历与学术背景']}</td><td>${prof['行业资质与认证']}</td><td>${prof['专业成果与经验']}</td><td>${infl['社会荣誉与奖项']}</td><td>${infl['职称、管理履历与行业地位']}</td><td>${e.scores.overall}</td></tr>`;
  }).join('');
  const topTable = `
<h2>Top 10 专家（缺失=3★）</h2>
<table><tr><th>姓名</th><th>①学历</th><th>②资质</th><th>③成果</th><th>④荣誉</th><th>⑤职称</th><th>综合</th></tr>${top3Rows}</table>`;

  const tail3Rows = report.missing3.experts.slice(-10).map(e => {
    const prof = e.sub.professional;
    const infl = e.sub.influence;
    return `<tr><td>${e.name}</td><td>${prof['学历与学术背景']}</td><td>${prof['行业资质与认证']}</td><td>${prof['专业成果与经验']}</td><td>${infl['社会荣誉与奖项']}</td><td>${infl['职称、管理履历与行业地位']}</td><td class="obs">${e.scores.overall}</td></tr>`;
  }).join('');
  const tailTable = `
<h2>Bottom 10 专家（缺失=3★）</h2>
<table><tr><th>姓名</th><th>①学历</th><th>②资质</th><th>③成果</th><th>④荣誉</th><th>⑤职称</th><th>综合</th></tr>${tail3Rows}</table>`;

  return head + `<div class="wrap"><h1>五星制细化规则测算：缺失默认 3★ vs 2★</h1><p class="sub">基于 ${s3.total} 位真实专家 · 细化识别规则 · 生成时间 ${report.generatedAt}</p>` + cards + distTable + flipTable + boundTable + topTable + tailTable + '</div></body></html>';
}

async function main() {
  const experts = await fetchExperts();
  const report = buildReport(experts);
  const outDir = path.join(__dirname, '..', 'docs');
  fs.writeFileSync(path.join(outDir, 'score-five-star-refined.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, 'score-five-star-refined.html'), renderHTML(report));
  console.log('report written:', path.join(outDir, 'score-five-star-refined.html'));
  console.log('summary:', JSON.stringify({
    missing3: report.missing3.stats,
    missing2: report.missing2.stats,
    flips: report.flips.length,
    boundary: report.boundary.length
  }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
