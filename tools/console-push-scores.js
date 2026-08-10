/* =====================================================
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
  var SCORES_DATA = {"任沁源":{"subScores":{"professional":{"学历与学术背景":5,"行业资质与认证":4,"专业成果与经验":5},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":5}},"scores":{"professional":4.7,"influence":4.0,"overall":4.4}},"方明":{"subScores":{"professional":{"学历与学术背景":5,"行业资质与认证":4,"专业成果与经验":5},"influence":{"社会荣誉与奖项":5,"职称、管理履历与行业地位":5}},"scores":{"professional":4.7,"influence":5.0,"overall":4.8}},"李晓华":{"subScores":{"professional":{"学历与学术背景":5,"行业资质与认证":5,"专业成果与经验":3},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":3}},"scores":{"professional":4.33,"influence":2.5,"overall":3.6}},"胡赛全":{"subScores":{"professional":{"学历与学术背景":5,"行业资质与认证":4,"专业成果与经验":4},"influence":{"社会荣誉与奖项":5,"职称、管理履历与行业地位":5}},"scores":{"professional":4.3,"influence":5.0,"overall":4.6}},"钱兴会":{"subScores":{"professional":{"学历与学术背景":5,"行业资质与认证":5,"专业成果与经验":4},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":5}},"scores":{"professional":4.7,"influence":3.5,"overall":4.2}},"赵渝强":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":4,"专业成果与经验":4},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":5}},"scores":{"professional":4.0,"influence":3.5,"overall":3.8}},"张赟":{"subScores":{"professional":{"学历与学术背景":5,"行业资质与认证":4,"专业成果与经验":4},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":5}},"scores":{"professional":4.3,"influence":4.0,"overall":4.2}},"孔令涛":{"subScores":{"professional":{"学历与学术背景":2,"行业资质与认证":4,"专业成果与经验":4},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":5}},"scores":{"professional":3.33,"influence":3.5,"overall":3.4}},"毛利涛":{"subScores":{"professional":{"学历与学术背景":2,"行业资质与认证":5,"专业成果与经验":4},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":5}},"scores":{"professional":3.67,"influence":4.0,"overall":3.8}},"陈哲":{"subScores":{"professional":{"学历与学术背景":2,"行业资质与认证":3,"专业成果与经验":5},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":5}},"scores":{"professional":3.33,"influence":3.5,"overall":3.4}},"冰洋":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":4,"专业成果与经验":3},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":3}},"scores":{"professional":3.67,"influence":2.5,"overall":3.2}},"王春阳":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":4,"专业成果与经验":4},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":5}},"scores":{"professional":4.0,"influence":4.0,"overall":4.0}},"陈才斌（陈天 sky）":{"subScores":{"professional":{"学历与学术背景":3,"行业资质与认证":4,"专业成果与经验":4},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":5}},"scores":{"professional":3.7,"influence":3.5,"overall":3.6}},"唐兴通":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":3,"专业成果与经验":4},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":3}},"scores":{"professional":3.67,"influence":3.0,"overall":3.4}},"刘华鹏":{"subScores":{"professional":{"学历与学术背景":5,"行业资质与认证":3,"专业成果与经验":4},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":5}},"scores":{"professional":4.0,"influence":4.0,"overall":4.0}},"李家贵":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":3,"专业成果与经验":4},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":4}},"scores":{"professional":3.67,"influence":3.0,"overall":3.4}},"王明哲":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":3,"专业成果与经验":5},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":4}},"scores":{"professional":4.0,"influence":3.0,"overall":3.6}},"卢森煌":{"subScores":{"professional":{"学历与学术背景":3,"行业资质与认证":4,"专业成果与经验":3},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":5}},"scores":{"professional":3.3,"influence":3.5,"overall":3.4}},"焦波":{"subScores":{"professional":{"学历与学术背景":2,"行业资质与认证":4,"专业成果与经验":3},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":5}},"scores":{"professional":3.0,"influence":3.5,"overall":3.2}},"邵昶盛":{"subScores":{"professional":{"学历与学术背景":2,"行业资质与认证":4,"专业成果与经验":5},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":4}},"scores":{"professional":3.7,"influence":3.5,"overall":3.6}},"魏凌睿":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":3,"专业成果与经验":4},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":3}},"scores":{"professional":3.67,"influence":3.0,"overall":3.4}},"王川":{"subScores":{"professional":{"学历与学术背景":2,"行业资质与认证":4,"专业成果与经验":4},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":5}},"scores":{"professional":3.33,"influence":4.0,"overall":3.6}},"黄洁":{"subScores":{"professional":{"学历与学术背景":2,"行业资质与认证":4,"专业成果与经验":4},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":5}},"scores":{"professional":3.3,"influence":4.0,"overall":3.6}},"苏嘉昊":{"subScores":{"professional":{"学历与学术背景":5,"行业资质与认证":2,"专业成果与经验":4},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":5}},"scores":{"professional":3.67,"influence":3.5,"overall":3.6}},"冯博":{"subScores":{"professional":{"学历与学术背景":3,"行业资质与认证":4,"专业成果与经验":4},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":5}},"scores":{"professional":3.7,"influence":3.5,"overall":3.6}},"王国谦":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":3,"专业成果与经验":4},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":5}},"scores":{"professional":3.67,"influence":3.5,"overall":3.6}},"韦玮":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":4,"专业成果与经验":3},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":4}},"scores":{"professional":3.67,"influence":3.0,"overall":3.4}},"王思轩":{"subScores":{"professional":{"学历与学术背景":5,"行业资质与认证":3,"专业成果与经验":4},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":5}},"scores":{"professional":4.0,"influence":4.0,"overall":4.0}},"傅一航":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":4,"专业成果与经验":4},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":5}},"scores":{"professional":4.0,"influence":3.5,"overall":3.8}},"王旭刚":{"subScores":{"professional":{"学历与学术背景":5,"行业资质与认证":4,"专业成果与经验":4},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":4}},"scores":{"professional":4.3,"influence":3.0,"overall":3.8}},"蔡春久":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":2,"专业成果与经验":5},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":4}},"scores":{"professional":3.67,"influence":3.5,"overall":3.6}},"徐霄鹏":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":5,"专业成果与经验":5},"influence":{"社会荣誉与奖项":4,"职称、管理履历与行业地位":4}},"scores":{"professional":4.67,"influence":4.0,"overall":4.4}},"韦凯元（凯元老师）":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":4,"专业成果与经验":4},"influence":{"社会荣誉与奖项":4,"职称、管理履历与行业地位":5}},"scores":{"professional":4.0,"influence":4.5,"overall":4.2}},"罗佳":{"subScores":{"professional":{"学历与学术背景":3,"行业资质与认证":3,"专业成果与经验":3},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":5}},"scores":{"professional":3.0,"influence":4.0,"overall":3.4}},"罗建国":{"subScores":{"professional":{"学历与学术背景":3,"行业资质与认证":4,"专业成果与经验":5},"influence":{"社会荣誉与奖项":4,"职称、管理履历与行业地位":4}},"scores":{"professional":4.0,"influence":4.0,"overall":4.0}},"韩京伟":{"subScores":{"professional":{"学历与学术背景":5,"行业资质与认证":2,"专业成果与经验":4},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":5}},"scores":{"professional":3.67,"influence":4.0,"overall":3.8}},"赵先德":{"subScores":{"professional":{"学历与学术背景":5,"行业资质与认证":2,"专业成果与经验":3},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":5}},"scores":{"professional":3.33,"influence":4.0,"overall":3.6}},"余星冰":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":3,"专业成果与经验":3},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":5}},"scores":{"professional":3.33,"influence":3.5,"overall":3.4}},"马涛":{"subScores":{"professional":{"学历与学术背景":2,"行业资质与认证":3,"专业成果与经验":4},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":5}},"scores":{"professional":3.0,"influence":4.0,"overall":3.4}},"陈剑文":{"subScores":{"professional":{"学历与学术背景":5,"行业资质与认证":2,"专业成果与经验":4},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":5}},"scores":{"professional":3.67,"influence":3.5,"overall":3.6}},"伍晖":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":3,"专业成果与经验":4},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":5}},"scores":{"professional":3.67,"influence":3.5,"overall":3.6}},"卜安洵":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":2,"专业成果与经验":3},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":5}},"scores":{"professional":3.0,"influence":4.0,"overall":3.4}},"乔锐杰":{"subScores":{"professional":{"学历与学术背景":2,"行业资质与认证":4,"专业成果与经验":5},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":3}},"scores":{"professional":3.7,"influence":2.5,"overall":3.2}},"罗文":{"subScores":{"professional":{"学历与学术背景":2,"行业资质与认证":4,"专业成果与经验":3},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":4}},"scores":{"professional":3.0,"influence":3.0,"overall":3.0}},"蔚江":{"subScores":{"professional":{"学历与学术背景":2,"行业资质与认证":4,"专业成果与经验":4},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":5}},"scores":{"professional":3.3,"influence":4.0,"overall":3.6}},"徐微":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":4,"专业成果与经验":3},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":5}},"scores":{"professional":3.7,"influence":4.0,"overall":3.8}},"秦江":{"subScores":{"professional":{"学历与学术背景":2,"行业资质与认证":3,"专业成果与经验":3},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":3}},"scores":{"professional":2.67,"influence":2.5,"overall":2.6}},"冯豪":{"subScores":{"professional":{"学历与学术背景":2,"行业资质与认证":3,"专业成果与经验":3},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":3}},"scores":{"professional":2.67,"influence":2.5,"overall":2.6}},"陈起辉":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":2,"专业成果与经验":3},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":5}},"scores":{"professional":3.0,"influence":4.0,"overall":3.4}},"刘春雄":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":2,"专业成果与经验":3},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":5}},"scores":{"professional":3.0,"influence":4.0,"overall":3.4}},"徐全":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":3,"专业成果与经验":3},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":5}},"scores":{"professional":3.33,"influence":3.5,"overall":3.4}},"李广":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":2,"专业成果与经验":3},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":5}},"scores":{"professional":3.0,"influence":3.5,"overall":3.2}},"阿木（阿布力克木·阿不力米提）":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":4,"专业成果与经验":3},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":5}},"scores":{"professional":3.7,"influence":4.0,"overall":3.8}},"吕守升":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":4,"专业成果与经验":3},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":5}},"scores":{"professional":3.67,"influence":4.0,"overall":3.8}},"黄岩":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":3,"专业成果与经验":4},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":5}},"scores":{"professional":3.67,"influence":3.5,"overall":3.6}},"李忠秋":{"subScores":{"professional":{"学历与学术背景":3,"行业资质与认证":4,"专业成果与经验":4},"influence":{"社会荣誉与奖项":4,"职称、管理履历与行业地位":5}},"scores":{"professional":3.7,"influence":4.5,"overall":4.0}},"怀国良":{"subScores":{"professional":{"学历与学术背景":2,"行业资质与认证":4,"专业成果与经验":4},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":4}},"scores":{"professional":3.3,"influence":3.0,"overall":3.2}},"黄博":{"subScores":{"professional":{"学历与学术背景":2,"行业资质与认证":4,"专业成果与经验":3},"influence":{"社会荣誉与奖项":4,"职称、管理履历与行业地位":5}},"scores":{"professional":3.0,"influence":4.5,"overall":3.6}},"袁海涛":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":4,"专业成果与经验":4},"influence":{"社会荣誉与奖项":2,"职称、管理履历与行业地位":5}},"scores":{"professional":4.0,"influence":3.5,"overall":3.8}},"农洲":{"subScores":{"professional":{"学历与学术背景":2,"行业资质与认证":3,"专业成果与经验":4},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":5}},"scores":{"professional":3.0,"influence":4.0,"overall":3.4}},"刘伟华":{"subScores":{"professional":{"学历与学术背景":5,"行业资质与认证":4,"专业成果与经验":5},"influence":{"社会荣誉与奖项":4,"职称、管理履历与行业地位":5}},"scores":{"professional":4.7,"influence":4.5,"overall":4.6}},"余玉刚":{"subScores":{"professional":{"学历与学术背景":5,"行业资质与认证":2,"专业成果与经验":3},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":5}},"scores":{"professional":3.33,"influence":4.0,"overall":3.6}},"周禹":{"subScores":{"professional":{"学历与学术背景":5,"行业资质与认证":4,"专业成果与经验":5},"influence":{"社会荣誉与奖项":4,"职称、管理履历与行业地位":5}},"scores":{"professional":4.7,"influence":4.5,"overall":4.6}},"高文":{"subScores":{"professional":{"学历与学术背景":5,"行业资质与认证":4,"专业成果与经验":5},"influence":{"社会荣誉与奖项":5,"职称、管理履历与行业地位":5}},"scores":{"professional":4.7,"influence":5.0,"overall":4.8}},"陈煜波":{"subScores":{"professional":{"学历与学术背景":5,"行业资质与认证":4,"专业成果与经验":5},"influence":{"社会荣誉与奖项":5,"职称、管理履历与行业地位":5}},"scores":{"professional":4.7,"influence":5.0,"overall":4.8}},"姚建明":{"subScores":{"professional":{"学历与学术背景":5,"行业资质与认证":3,"专业成果与经验":4},"influence":{"社会荣誉与奖项":4,"职称、管理履历与行业地位":5}},"scores":{"professional":4.0,"influence":4.5,"overall":4.2}},"方跃":{"subScores":{"professional":{"学历与学术背景":5,"行业资质与认证":2,"专业成果与经验":4},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":5}},"scores":{"professional":3.67,"influence":4.0,"overall":3.8}},"崔瀚文":{"subScores":{"professional":{"学历与学术背景":2,"行业资质与认证":2,"专业成果与经验":5},"influence":{"社会荣誉与奖项":4,"职称、管理履历与行业地位":5}},"scores":{"professional":3.0,"influence":4.5,"overall":3.6}},"俞培斌（成智大兵）":{"subScores":{"professional":{"学历与学术背景":4,"行业资质与认证":4,"专业成果与经验":4},"influence":{"社会荣誉与奖项":3,"职称、管理履历与行业地位":5}},"scores":{"professional":4.0,"influence":4.0,"overall":4.0}}};

  // 姓名别名（线上库与数据可能用字不同，如 徐薇/徐微）
  var ALIAS = {"徐薇": "徐微", "徐微": "徐薇"};

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
        // subScores + 综合分一并内嵌进 scores jsonb（与 supabase.js expertToRow/rowToExpert 约定一致）
        // 注：必须同时覆盖 professional/influence/overall 为 curated 值，否则 Supabase 仍存旧 AI 分数，
        // 与 localStorage 及前端子维度条不一致
        var newScores = Object.assign({}, row.scores || {}, d2.scores, { subScores: d2.subScores });
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
      await supabase.from('app_settings').upsert({ key: 'ratingConfig', value: db.ratingConfig }, { onConflict: 'key' });
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
