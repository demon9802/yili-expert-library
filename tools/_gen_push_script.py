#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""生成 tools/console-push-scores.js —— 在管理员浏览器控制台执行，将 69 位专家评分(subScores+scores)推送到 localStorage + Supabase。"""
import json, io

SRC = 'docs/expert-scores-extracted.json'
OUT = 'tools/console-push-scores.js'

d = json.load(open(SRC, encoding='utf-8'))
ex = d['experts']

# 构建精简数据: name -> {subScores, scores}
data = {}
for e in ex:
    name = e['name']
    data[name] = {
        'subScores': e['subScores'],
        'scores': e['scores'],
    }

# 额外别名: 数据中可能用"徐微"，线上库可能用"徐薇"，反之亦然
ALIAS = {'徐薇': '徐微', '徐微': '徐薇'}

data_js = json.dumps(data, ensure_ascii=False, separators=(',', ':'))

script = """/* =====================================================
 * 评分数据一键推送脚本 (v5.9.0) — 在浏览器控制台执行
 * =====================================================
 * 使用方法:
 * 1. 打开专家库管理后台并确保已登录为管理员
 * 2. 按 F12 打开开发者工具 -> Console
 * 3. 复制粘贴本脚本全部内容 -> 回车执行
 * 4. 执行完成后刷新页面，评分即按 curated 数据展示
 * ===================================================== */

(async function() {
  // ===== 评分数据（来自 expert-scores-extracted.json，69 位专家 curated 结果）=====
  var SCORES_DATA = __DATA__;

  // 姓名别名（线上库与数据可能用字不同，如 徐薇/徐微）
  var ALIAS = __ALIAS__;

  function lookup(name) {
    if (SCORES_DATA[name]) return SCORES_DATA[name];
    if (ALIAS[name] && SCORES_DATA[ALIAS[name]]) return SCORES_DATA[ALIAS[name]];
    return null;
  }

  console.log('========================================');
  console.log('  评分数据推送脚本 v5.9.0');
  console.log('========================================');

  var raw = localStorage.getItem('yili_expert_db');
  if (!raw) { console.error('localStorage 中无数据，请先登录管理后台！'); return; }
  var db = JSON.parse(raw);

  var matched = 0;
  var matchedNames = {};
  for (var i = 0; i < db.experts.length; i++) {
    var e = db.experts[i];
    var sd = lookup(e.name);
    if (!sd) continue;
    e.subScores = JSON.parse(JSON.stringify(sd.subScores));
    e.scores = JSON.parse(JSON.stringify(sd.scores));
    matchedNames[e.name] = true;
    matched++;
  }

  // 记录数据中未匹配到的专家（便于排查）
  var notFound = [];
  for (var k in SCORES_DATA) {
    if (!matchedNames[k]) notFound.push(k);
  }

  // 开启前端评分展示
  if (!db.ratingConfig) db.ratingConfig = {};
  db.ratingConfig.showScores = true;

  localStorage.setItem('yili_expert_db', JSON.stringify(db));
  console.log('localStorage 更新: ' + matched + ' 位专家，showScores=on');
  if (notFound.length > 0) console.warn('以下专家未在本地库匹配: ' + notFound.join('、'));

  // ===== 同步到 Supabase（需管理员登录）=====
  if (typeof supabase !== 'undefined' && supabase && typeof isAdmin !== 'undefined' && isAdmin) {
    console.log('检测到管理员登录，开始同步 Supabase...');
    var res = await supabase.from('experts').select('*');
    if (res.error) {
      console.error('读取 experts 失败:', res.error.message);
    } else {
      var rows = res.data || [];
      var supMatched = 0;
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        var d2 = lookup(row.name);
        if (!d2) continue;
        // subScores 内嵌进 scores jsonb（与 supabase.js expertToRow/rowToExpert 约定一致）
        var newScores = Object.assign({}, row.scores || {}, { subScores: d2.subScores });
        try {
          await supabase.from('experts').update({ scores: newScores, updated_at: new Date().toISOString() }).eq('id', row.id);
          supMatched++;
        } catch (err) {
          console.error('Supabase 更新失败 [' + row.name + ']:', err.message);
        }
      }
      console.log('Supabase 同步完成: ' + supMatched + ' 位专家');
    }
    // 同步 ratingConfig（showScores=on）
    try {
      await supabase.from('app_settings').upsert({ key: 'ratingConfig', value: db.ratingConfig });
      console.log('app_settings.ratingConfig 已更新 (showScores=on)');
    } catch (err) {
      console.error('ratingConfig 同步失败:', err.message);
    }
  } else {
    console.warn('未检测到管理员登录，Supabase 同步跳过。请登录后重新执行本脚本。');
  }

  console.log('========================================');
  console.log('  完成！请刷新页面查看评分效果');
  console.log('========================================');
})();
"""

script = script.replace('__DATA__', data_js)
script = script.replace('__ALIAS__', json.dumps(ALIAS, ensure_ascii=False))

with io.open(OUT, 'w', encoding='utf-8') as f:
    f.write(script)

print('written', OUT, 'size', len(script), 'experts', len(data))
