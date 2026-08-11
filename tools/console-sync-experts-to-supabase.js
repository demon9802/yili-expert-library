/* =====================================================
 * 专家全量同步脚本 (v5.9.0) — localStorage → Supabase
 * =====================================================
 * 目的：让 Supabase 与 localStorage 保持一致（69 位），
 *      使后续批量测算/统计不再只默认已有的 56 位。
 *
 * 【重要】本脚本默认 DRY_RUN = true，只做诊断、不写任何数据。
 *        请先执行一次看诊断报告，确认无 id 冲突后，
 *        再把 DRY_RUN 改为 false 重新执行，才会真正写入。
 *
 * 使用方法：
 * 1. 打开专家库并以【主管理员】身份登录
 * 2. F12 → Console
 * 3. 粘贴本脚本全文 → 回车（第一次：诊断）
 * 4. 阅读报告，确认安全后，把第 20 行改 false → 再执行一次（写入）
 * ===================================================== */

(async function () {
  // ↓↓↓ 改成 false 才会真正写入 Supabase ↓↓↓
  var DRY_RUN = true;
  // ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑

  var LINE = '============================================================';
  console.log('%c' + LINE, 'color:#8B5CF6');
  console.log('%c  专家同步脚本 v5.9.0  ' + (DRY_RUN ? '【诊断模式 · 不写入】' : '【写入模式】'),
    'color:#8B5CF6;font-weight:bold;font-size:14px');
  console.log('%c' + LINE, 'color:#8B5CF6');

  // ---------- 0. 环境检查 ----------
  if (typeof supabase === 'undefined' || !supabase) {
    console.error('❌ 未检测到 supabase 客户端，请在专家库页面执行本脚本。');
    return;
  }
  if (typeof isAdmin === 'undefined' || !isAdmin) {
    console.error('❌ 当前不是管理员身份，Supabase 写入会被 RLS 拒绝。请先登录主管理员账号。');
    return;
  }

  var raw = localStorage.getItem('yili_expert_db');
  if (!raw) { console.error('❌ localStorage 无 yili_expert_db 数据。'); return; }
  var db = JSON.parse(raw);
  var localExperts = (db.experts || []).filter(function (e) { return e && e.name; });

  var res = await supabase.from('experts').select('*');
  if (res.error) { console.error('❌ 读取 Supabase experts 失败:', res.error.message); return; }
  var remoteRows = res.data || [];

  console.log('%c📊 数量对比：localStorage = ' + localExperts.length +
    ' 位　|　Supabase = ' + remoteRows.length + ' 位',
    'color:#059669;font-weight:bold;font-size:13px');

  // ---------- 1. 建索引 ----------
  var remoteById = {}, remoteByName = {};
  remoteRows.forEach(function (r) {
    if (r.id !== undefined && r.id !== null) remoteById[String(r.id)] = r;
    if (r.name) remoteByName[String(r.name).trim()] = r;
  });
  var localByName = {};
  localExperts.forEach(function (e) { localByName[String(e.name).trim()] = e; });

  // ---------- 2. 致命风险检测：同 id 不同名 ----------
  var idConflicts = [];
  localExperts.forEach(function (e) {
    if (e.id === undefined || e.id === null) return;
    var r = remoteById[String(e.id)];
    if (r && String(r.name).trim() !== String(e.name).trim()) {
      idConflicts.push({ id: e.id, 本地姓名: e.name, 云端同id姓名: r.name });
    }
  });

  // ---------- 3. 差异分类 ----------
  var missingInRemote = [];   // 本地有、云端无（按姓名判断）
  var nameMatchIdDiff = [];   // 姓名相同但 id 不同（需按姓名对齐）
  var bothExist = [];         // 两边都有
  localExperts.forEach(function (e) {
    var nm = String(e.name).trim();
    var r = remoteByName[nm];
    if (!r) { missingInRemote.push(e); return; }
    bothExist.push({ local: e, remote: r });
    if (String(r.id) !== String(e.id)) {
      nameMatchIdDiff.push({ 姓名: nm, 本地id: e.id, 云端id: r.id });
    }
  });
  var onlyInRemote = remoteRows.filter(function (r) {
    return !localByName[String(r.name).trim()];
  });

  // ---------- 4. 内容差异（评分 + 补充信息）----------
  var TEXT_FIELDS = [
    ['education', '学历背景'], ['qualifications', '资质认证'], ['courses', '课程'],
    ['qualDisplay', '资质展示'], ['advDisplay', '优势展示']
  ];
  var scoreDiff = [], infoDiff = [];
  bothExist.forEach(function (p) {
    var L = p.local, R = p.remote;
    var rScores = R.scores || {};
    var rSub = rScores.subScores || null;
    var lSub = L.subScores || null;
    if (JSON.stringify(lSub) !== JSON.stringify(rSub) ||
      Number(rScores.overall) !== Number((L.scores || {}).overall)) {
      scoreDiff.push(L.name);
    }
    var changed = [];
    TEXT_FIELDS.forEach(function (f) {
      var col = f[0] === 'qualDisplay' ? 'qual_display' : (f[0] === 'advDisplay' ? 'adv_display' : f[0]);
      var lv = (L[f[0]] || '').toString().trim();
      var rv = (R[col] || '').toString().trim();
      if (lv !== rv) changed.push(f[1]);
    });
    if (changed.length) infoDiff.push(L.name + '（' + changed.join('、') + '）');
  });

  // ---------- 5. 诊断报告 ----------
  console.log('\n%c── 诊断报告 ──', 'color:#8B5CF6;font-weight:bold');

  if (idConflicts.length) {
    console.error('🚨 致命：发现 ' + idConflicts.length + ' 处「同 id 不同人」冲突！');
    console.error('   直接同步会覆盖云端的另一位专家，脚本已阻止写入。');
    console.table(idConflicts);
  } else {
    console.log('✅ id 冲突检测：无同 id 不同人的情况，可安全同步');
  }

  console.log('\n📌 云端缺失（本地有、Supabase 无）：' + missingInRemote.length + ' 位');
  if (missingInRemote.length) {
    console.table(missingInRemote.map(function (e) {
      return {
        本地id: e.id, 姓名: e.name,
        领域: (e.fields || []).join('/'),
        综合分: (e.scores || {}).overall,
        添加人: e.createdBy || ''
      };
    }));
  }

  if (nameMatchIdDiff.length) {
    console.warn('\n⚠️ 姓名相同但 id 不同：' + nameMatchIdDiff.length + ' 位（将按姓名对齐，沿用云端 id）');
    console.table(nameMatchIdDiff);
  }

  if (onlyInRemote.length) {
    console.warn('\n⚠️ 仅云端存在（本地无）：' + onlyInRemote.length + ' 位（本脚本不会删除它们）');
    console.table(onlyInRemote.map(function (r) { return { 云端id: r.id, 姓名: r.name }; }));
  }

  console.log('\n📈 待更新内容差异：');
  console.log('   · 评分不一致：' + scoreDiff.length + ' 位' + (scoreDiff.length ? ' → ' + scoreDiff.join('、') : ''));
  console.log('   · 补充信息不一致：' + infoDiff.length + ' 位' + (infoDiff.length ? '\n     → ' + infoDiff.join('\n     → ') : ''));

  console.log('\n🎯 本次将执行：');
  console.log('   · 新增 ' + missingInRemote.length + ' 位（云端缺失，插入时不带本地 id，由数据库分配）');
  console.log('   · 刷新 ' + bothExist.length + ' 位（以 localStorage 为准全字段回写，其中 '
    + scoreDiff.length + ' 位评分有变化）');
  console.log('   · 删除 0 位（本脚本永不删除任何数据）');

  // ---------- 6. 写入 ----------
  if (idConflicts.length) {
    console.error('\n⛔ 因存在 id 冲突，已终止。请先人工确认这些 id 归属，再联系处理。');
    return;
  }
  if (DRY_RUN) {
    console.log('\n%c🔒 当前为诊断模式，未写入任何数据。', 'color:#D97706;font-weight:bold;font-size:13px');
    console.log('%c   确认以上报告无误后，把脚本第 20 行 DRY_RUN 改为 false，重新执行即可同步。',
      'color:#D97706');
    return;
  }

  console.log('\n%c▶ 开始写入 Supabase…', 'color:#059669;font-weight:bold');
  var okIns = 0, okUpd = 0, failed = [];

  // 6a. 新增云端缺失的专家（不带 id，由 DB 自增，避免 id 撞车）
  for (var i = 0; i < missingInRemote.length; i++) {
    var e = missingInRemote[i];
    try {
      var row = expertToRow(e);
      delete row.id;                       // 关键：让数据库自己分配 id
      if (!row.created_by) row.created_by = e.createdBy || '主管理员';
      row.updated_at = new Date().toISOString();
      var r1 = await supabase.from('experts').insert(row).select().single();
      if (r1.error) throw new Error(r1.error.message);
      // 回写新 id 到 localStorage，保证两端主键一致
      e.id = r1.data.id;
      okIns++;
      console.log('  ＋ 新增 [' + e.name + '] → 云端 id=' + r1.data.id);
    } catch (err) {
      failed.push(e.name + '（新增失败：' + err.message + '）');
      console.error('  ✗ 新增失败 [' + e.name + ']:', err.message);
    }
  }

  // 6b. 更新两边都有的专家（全字段：评分 + 补充信息）
  for (var j = 0; j < bothExist.length; j++) {
    var L = bothExist[j].local, R = bothExist[j].remote;
    try {
      var row2 = expertToRow(L);
      row2.id = R.id;                      // 以云端 id 为准，按姓名对齐
      row2.created_at = R.created_at || row2.created_at;
      row2.created_by = R.created_by || row2.created_by;
      row2.updated_at = new Date().toISOString();
      var r2 = await supabase.from('experts').update(row2).eq('id', R.id);
      if (r2.error) throw new Error(r2.error.message);
      if (String(L.id) !== String(R.id)) L.id = R.id;  // 本地 id 对齐云端
      okUpd++;
    } catch (err2) {
      failed.push(L.name + '（更新失败：' + err2.message + '）');
      console.error('  ✗ 更新失败 [' + L.name + ']:', err2.message);
    }
  }

  // 6c. 回写 localStorage（id 已与云端对齐）
  db.experts = localExperts;
  localStorage.setItem('yili_expert_db', JSON.stringify(db));

  // 6d. 复核
  var chk = await supabase.from('experts').select('id,name');
  var finalCount = chk.error ? '读取失败' : (chk.data || []).length;

  console.log('\n%c' + LINE, 'color:#059669');
  console.log('%c  同步完成：新增 ' + okIns + ' 位，更新 ' + okUpd + ' 位',
    'color:#059669;font-weight:bold;font-size:14px');
  console.log('%c  Supabase 现有专家总数：' + finalCount + ' 位',
    'color:#059669;font-weight:bold;font-size:14px');
  if (failed.length) {
    console.error('  ⚠️ 失败 ' + failed.length + ' 条：');
    failed.forEach(function (f) { console.error('     · ' + f); });
  }
  console.log('%c' + LINE, 'color:#059669');
  console.log('👉 请刷新页面确认；此后所有批量测算将基于 ' + finalCount + ' 位专家。');
})();
