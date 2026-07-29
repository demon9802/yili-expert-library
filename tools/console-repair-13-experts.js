/* =====================================================
 * 13位专家数据修复脚本 — 在浏览器控制台执行
 * =====================================================
 * 使用方法:
 * 1. 打开专家库管理后台并确保已登录为管理员
 * 2. 按 F12 打开开发者工具 → Console
 * 3. 复制粘贴本脚本全部内容 → 回车执行
 * ===================================================== */

(async function() {
  // 从 xlsx 提取的正确数据
  var REPAIR_DATA = {};

  REPAIR_DATA['俞培斌（成智大兵）'] = { advDisplay: "私域流量数字化运营专家，15年营销实战经验", qualDisplay: "晨智信息科技CEO\n成智营销创始人", qualifications: "【社会职务】湖南省人社厅创业专家咨询团成员，创业黑马学院营销创新讲师，吴晓波频道特邀营销讲师；【履职资历】晨智信息科技CEO，成智营销创始人", courses: "【核心课程】《私域流量运营与会员体系搭建》《MarTech营销技术与自动化》《内容营销与社群增长》《数字化营销增长实战》《私域流量数字化运营增长》《新零售品牌数字化营销》《用户运营裂变增长实战策略》；【服务经历】华为云、腾讯大湘网、阿里太极禅苑、步步高集团、新希望味业、盐子铺子、褚酒、胜田食品、澜东科技、隆平茶业等" };
  REPAIR_DATA['怀国良'] = { advDisplay: "数字化品牌营销专家，京东系背景，营销高管出身", qualDisplay: "京东集团数字产业品牌营销总经理", qualifications: "【社会职务】曾担任中国人民大学经济学院职场导师、北大光华管理学院\u201c时代企业家\u201d产业研学企业讲师；【履职资历】京东集团数字产业品牌营销总经理、企业认证讲师，曾任奥美&电通等国际顶级4A整合营销集团高管、长城汽车品牌总经理&新闻发言人、中国人民大学经济学院职场导师", courses: "【核心课程】《AI时代的企业组织及品牌管理模式变革》《品牌营销体系的数字化转型升级》《企业品牌战略升级与数智化品牌营销创新发展》《AI时代企业内部创新创业意识及能力养成》《人工智能时代的品牌管理与运营》《数智化品牌营销驱动业务创新增长》《AI时代如何从0到1打造新品牌》《新品研发及上市的数智化品牌营销体系打造》《线下零售门店+供应链数字化创新管理》；【服务经历】联想、三星、长虹、海信、青岛啤酒、红牛、伊利和北京奥组委等" };
  REPAIR_DATA['黄博'] = { advDisplay: "高社会影响力，内容电商营销专家，中国数字营销10年杰出人物", qualDisplay: "华盟新媒CEO", qualifications: "【社会职务】西南财经大学、四川传媒学院、香港都会大学特聘导师，曾任淘宝达人学院校董、国际实效营销艾菲奖评委、国际商业创新艾奇奖评委、中国数字营销金鼠标奖评委、中国经典传播虎啸奖评委、中国广告主金远奖评委、商务部电商直播大赛总导师；【履职资历】华盟新媒集团CEO", courses: "【核心课程】《抖音电商全域运营实战》《短视频与直播带货操盘》《内容营销与超级 IP 打造》《AI 内容营销实战》；【服务经历】服务淘宝、抖音、快手等平台数百家品牌商家直播电商转型，操盘多个亿级 GMV 直播项目" };
  REPAIR_DATA['袁海涛'] = { advDisplay: "1、社群私域垂直领域专家，讲师+编委经验\n2、华为系背景", qualDisplay: "中国社群领袖俱乐部专家组组长\n中国互联网协会\u201c互联网+产业融合\u201d社群专家组组长", qualifications: "【社会职务】中国社群领袖俱乐部专家组组长，中国互联网协会\u201c互联网+产业融合\u201d社群专家组组长，团中央\u201c青年之声\u201d百名创业导师团成员，社群新零售商学院创始人；【履职资历】北京壹起创科技有限公司董事长，曾任职于华为北京研究所、摩托罗拉手机事业部", courses: "【核心课程】《社群营销——从定位到变现》《私域营销变现攻略》《超级用户运营之道》《私域流量与社群运营实战》《会员体系搭建与用户生命周期管理》《社群新零售与渠道数字化》《私域转化与复购提升》；【服务经历】华联集团、茅台白金、联想、晨光生物等" };
  REPAIR_DATA['农洲'] = { advDisplay: "AI+获客专家，19年+行业经验，长期专注于新媒体营销和电商直播", qualDisplay: "工信部认证人工智能研发高级工程师\n巨量学认证高级讲师\n清华大学《新媒体营销》授课讲师", qualifications: "【社会职务】工信部认证人工智能研发高级工程师，巨量学认证高级讲师，清华大学《新媒体营销》授课讲师，大道商学联合创始人，抖音全域兴趣电商认证操盘手，快手/抖音直播基地特聘高级讲师", courses: "【核心课程】《AI三维营销系统》《新媒体营销》《品牌IP商业》；【服务经历】中国电信、中国移动、伊利、蒙牛、珀莱雅、以纯等" };
  REPAIR_DATA['刘伟华'] = { advDisplay: "高学术影响力，供应链领域权威学者，运营与供应链管理系主任及讲席教授", qualDisplay: "天津大学运营与供应链管理系主任、讲席教授、博士生导师\n中国物流学会副会长", qualifications: "【职称/荣誉头衔】天津大学运营与供应链管理系主任、讲席教授、博士生导师；【社会职务】中国物流学会副会长，教育部物流教学指导委员会委员兼青年工作组组长，国家社科基金重大项目首席专家，国家科学技术奖励办会评专家、中国物流与采购联合会物流专家，全国物流标准化技术委员会委员，IEEE智能工厂标准化技术委员会委员", courses: "【核心课程】《数智化供应链管理前沿》《智慧物流与供应链创新》《供应链金融与风险管理》《服务供应链与数字化运营》；【服务经历】主持国家自然科学基金重点项目等多项国家级课题，为顺丰、京东物流、中外运等头部企业提供供应链数字化咨询" };
  REPAIR_DATA['余玉刚'] = { advDisplay: "1、高学术背景\n2、数字智能和供应链交叉研究前沿专家，精通数智建模下供应链决策", qualDisplay: "中国科学技术大学讲席教授\n中国物流学会副会长", qualifications: "【职称/荣誉头衔】安徽理工大学党委书记，中国科学技术大学讲席教授，安徽省数智供应链重点实验室主任；【社会职务】中国物流学会副会长，中国运筹学会副理事长，国际标准化组织创新物流技术委员会（ISO TC344）委员", courses: "【核心课程】《物流与供应链管理》《现代供应链管理》；【服务经历】国家电网、国家能源投资、中国华电、阳光电源、海尔日日顺、海康威视、红星美凯龙、京东等" };
  REPAIR_DATA['周禹'] = { advDisplay: "高学术背景，人才管理专家", qualDisplay: "中国人民大学商学院组织与人力资源系副教授、博士生导师", qualifications: "【职称/荣誉头衔】中国人民大学商学院组织与人力资源系副教授、博士生导师，MBA 项目中心主任；【社会职务】中国人力资源理论与实践联盟秘书长，中国企业改革发展研究会人力资源分会秘书长，中国人民大学商学院国企改革与发展研究中心研究员", courses: "【核心课程】《战略人力资源管理》《发挥每位管理者人带队伍的效能：中高层管理者（非HR）的人力资源管理》《人力资本管理与核心团队建设》《人才效能与力资本投回报率提升》《企业组织变革与商模式创新》《整合领导力：管理沙盘模拟课程》；【服务经历】华为集团、联想集团、美的集团、万达集团、万科集团、新希望集团、阿里巴巴、腾讯、百度、京东等" };
  REPAIR_DATA['高文'] = { advDisplay: "1、高学术背景，院士级学术权威\n2、人工智能领域顶级战略专家，在AI与多媒体技术具有突出贡献", qualDisplay: "中国工程院院士\n北京大学教授\n鹏城实验室主任", qualifications: "【职称/荣誉头衔】中国工程院院士，北京大学教授；【社会职务】鹏城实验室主任，IEEE Fellow、ACM Fellow，新一代人工智能产业技术创新战略联盟理事长，数字音视频编解码技术标准 (AVS) 工作组组长", courses: "【服务经历】活跃在人工智能领域高校讲座、行业论坛及媒体节目，分享内容或参与项目包括：央视《开讲啦》、《中国算力网计划与鹏城脑海大模型》、《人工智能前沿技术与中国算力网计划》等" };
  REPAIR_DATA['陈煜波'] = { advDisplay: "高学术背景，管理学博士、清华讲席教授", qualDisplay: "清华大学经济管理学院可口可乐讲席教授\n互联网发展与治理研究中心主任", qualifications: "【职称/荣誉头衔】清华大学经济管理学院可口可乐讲席教授、互联网发展与治理研究中心主任，曾任美国亚利桑那大学艾勒管理学院副教授、终身教职；【社会职务】中国信息经济学会副理事长，国家数字经济发展规划专家组成员", courses: "【核心课程】《数字经济与中国经济数字化转型》；【服务经历】京东集团、阿里巴巴、百度、中信银行等" };
  REPAIR_DATA['姚建明'] = { advDisplay: "1、高学术影响力+高社会影响力\n2、数字化转型管理创新领域专家，主持承担了国家、省部级课题及政府、企业委托项目40余项", qualDisplay: "中国人民大学商学院教授、博士生导师\n中国人民大学中国企业创新发展研究中心主任", qualifications: "【职称/荣誉头衔】中国人民大学商学院教授、博士生导师，中国人民大学中国企业创新发展研究中心主任、数字经济产业创新研究院院长，中国人民大学国家发展战略研究院研究员；【社会职务】国家自然科学基金委管理科学部重要期刊《系统管理学报》编委会委员，联合国国际贸易中心（ITC）\u201c采购与供应链管理国际资格认证\u201d培训师，中国\u201c数字经济百城助力计划\u201d首席专家", courses: "【核心课程】课程方向：战略管理、企业增长与产品创新、商业模式创新、创新与变革管理、新质生产力、数字化转型与商业模式创新、智慧供应链物流、新消费与新零售等；【服务经历】宝钢、三元、中国商飞集团、五粮液、联想等及众多政府项目" };
  REPAIR_DATA['方跃'] = { advDisplay: "1、高学历+国际化学术背景\n2、产教融合，20年+教学经验，创办了中欧AI与管理创新研究中心，擅长人工智能与管理创新、企业数智化转型", qualDisplay: "中欧国际工商学院AI与管理创新研究中心主任、荣誉退休教授", qualifications: "【社会职务】中欧国际工商学院AI与管理创新研究中心主任、荣誉退休教授，超级智体AI管理创新联盟理事长，上海市政府\u201c十五五\u201d规划专家咨询委员会委员；【履职资历】深圳市硅基管理创新研究院创始执行院长", courses: "【服务经历】AT&T、GE Capital、华为、阿里、腾讯、平安、招商银行等" };
  REPAIR_DATA['崔瀚文'] = { advDisplay: "阿里系近20年战略与商业生态经验", qualDisplay: "曾任阿里巴巴集团商业生态负责人", qualifications: "【社会职务】商业进化研究所创始人，中国技术经济学会理事、科技部现代服务业重大专项专家组专家，中国国际电子商务中心特聘导师/台湾中华经济研究院专家，清华大学企业成长与经济安全研究中心、中国人民大学数字创业创新研究中心研究员；【履职资历】友橘科技董事长，曾任阿里巴巴集团商业生态/创新案例研究/公共战略等负责人、大唐电信集团战略管理负责人、GFK咨询中国产品研究部负责人、中科同创董事总经理/CEO", courses: "【核心课程】《培育指数级创新增长元动力——数字化战略与指数型组织解决方案》《数字经济生态与行业机会风口——新商业时代的企业战略与定位》《新消费驱动与新零售进化——立体打造创新零售共同体》《聚变裂变：抓住第二次社会化商业风口期——社群营销与私域电商》《关键时刻：生命周期与第二曲线——阿里典型企业案例解析》；【服务经历】阿里系子公司、联想、三星、三只松鼠、三夫户外、全球时刻、盘古、平安、东风汽车、雀氏等" };

  console.log('========================================');
  console.log('  13位专家数据修复脚本');
  console.log('========================================');

  // Step 1: 读取 db
  var raw = localStorage.getItem('yili_expert_db');
  if (!raw) { console.error('localStorage 中没有数据！'); return; }
  var db = JSON.parse(raw);

  var fixed = 0;
  var notFound = [];

  for (var i = 0; i < db.experts.length; i++) {
    var e = db.experts[i];
    var rd = REPAIR_DATA[e.name];
    if (!rd) continue;

    console.log('修复: ' + e.name);

    // 设置缺失字段
    e.advDisplay = rd.advDisplay;
    e.qualDisplay = rd.qualDisplay;

    // 清理 qualifications 和 courses 中的分号残留
    if (rd.qualifications) {
      e.qualifications = rd.qualifications;
    }
    if (rd.courses) {
      e.courses = rd.courses;
    }

    fixed++;
  }

  // 检查未找到的
  for (var name in REPAIR_DATA) {
    var found = false;
    for (var i = 0; i < db.experts.length; i++) {
      if (db.experts[i].name === name) { found = true; break; }
    }
    if (!found) notFound.push(name);
  }

  // Step 2: 保存到 localStorage
  localStorage.setItem('yili_expert_db', JSON.stringify(db));
  console.log('修复完成: ' + fixed + ' 位专家已修复，保存到 localStorage');

  if (notFound.length > 0) {
    console.warn('以下专家未在 localStorage 中找到: ' + notFound.join(', '));
  }

  // Step 3: 同步到 Supabase（如果已登录）
  if (typeof supabase !== 'undefined' && supabase && typeof isAdmin !== 'undefined' && isAdmin) {
    console.log('检测到管理员登录，开始同步到 Supabase...');
    var syncCount = 0;

    for (var i = 0; i < db.experts.length; i++) {
      var e = db.experts[i];
      var rd = REPAIR_DATA[e.name];
      if (!rd) continue;

      try {
        var row = {
          name: e.name,
          fields: e.fields || [],
          advantages: e.advantages || [],
          education: e.education || '',
          qualifications: e.qualifications || '',
          courses: e.courses || '',
          contact_person: e.contactPerson || '',
          contact_info: e.contactInfo || '',
          contact_type: e.contactType || 'phone',
          referrer: e.referrer || '',
          is_supplier: e.isSupplier || false,
          qual_display: e.qualDisplay || '',
          adv_display: e.advDisplay || '',
          scores: e.scores || { professional: null, influence: null, overall: null },
          status: e.status || 'active',
          observation_status: e.observationStatus || null,
          observation_date: e.observationDate || null,
          contacts: e.contacts || [],
          created_by: e.createdBy || '主管理员',
          updated_at: new Date().toISOString()
        };

        if (e.id) {
          await supabase.from('experts').update(row).eq('id', e.id);
        } else {
          await supabase.from('experts').insert(row);
        }
        syncCount++;
      } catch(err) {
        console.error('Supabase 同步失败 [' + e.name + ']:', err.message);
      }
    }

    console.log('Supabase 同步完成: ' + syncCount + ' 位专家');
  } else {
    console.warn('未检测到管理员登录，Supabase 同步跳过。请登录后重新执行脚本。');
  }

  console.log('========================================');
  console.log('  修复完成！请刷新页面查看效果');
  console.log('========================================');
})();
