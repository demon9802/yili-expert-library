# -*- coding: utf-8 -*-
"""专家信息 xlsx -> 五星制结构化评分(1-5★) 提取器 v1
数据源: tools/experts_export_专家资源库.csv (由 read_experts_xlsx.py 从 xlsx 导出)
输出:   docs/expert-scores-extracted.json
对齐:   js/app.js DEFAULT_RATING_CONFIG 子维度命名
规则:   见 docs/extraction-mapping.md v1
"""
import csv, re, json, os

CSV = os.path.join(os.path.dirname(__file__), "experts_export_专家资源库.csv")
OUT = os.path.join(os.path.dirname(__file__), "..", "docs", "expert-scores-extracted.json")

TOP_SCHOOLS = ["清华", "北大", "浙江大学", "浙大", "复旦", "上海交大", "上交",
               "中国科学技术大学", "中科大", "南京大学", "哈工大", "西安交大",
               "MIT", "斯坦福", "剑桥", "牛津", "牛津大学", "帝国理工"]

def seg(text, label):
    m = re.search(r"【" + label + r"】([\s\S]*?)(?=【|$)", text or "")
    return m.group(1).strip() if m else ""

def first_match(text, patterns):
    for p in patterns:
        m = re.search(p, text or "")
        if m:
            s = m.start()
            return text[max(0, s - 0):s + 24].replace("\n", " ")
    return None

# ---------- ① 学历与学术背景 ----------
def score_education(text):
    t = (text or "").strip()
    if not t or "未公开" in t:
        return 2, "missing", ("未公开" if "未公开" in t else "(空白)")
    if re.search(r"博士|博士后", t):
        return 5, "clear", t[:24]
    if re.search(r"硕士|MBA|EMBA|研究生|master", t, re.I):
        return 4, "clear", t[:24]
    if re.search(r"本科|学士|bachelor", t, re.I):
        return 3, "clear", t[:24]
    if re.search(r"大专|专科", t):
        return 2, "clear", t[:24]
    return 3, "vague", t[:24]

# ---------- ② 行业资质与认证 ----------
CERT_5 = [r"CFA", r"CPA", r"注册会计师", r"ACCA", r"FRM", r"PMP",
          r"法律职业资格|律师资格|执业律师", r"华为\s*HCIE", r"微软\s*MVP",
          r"华为云\s*MVP|腾讯云\s*MVP|阿里云\s*MVP", r"认证出题", r"认证&培训专家|认证培训专家",
          r"认证讲师.*(工信部|人社部)"]
CERT_4 = [r"华为认证|阿里云认证|腾讯云认证|云认证讲师", r"IEEE\s*Senior|IEEE\s*会员",
          r"国家级执业|执业资格", r"认证讲师|授权讲师|金牌讲师", r"认证专家|特聘专家|特聘大数据专家"]
CERT_VAGUE = [r"认证|资格|培训师|讲师|持证"]

def score_certification(text):
    t = text or ""
    m = first_match(t, CERT_5)
    if m: return 5, "clear", m
    m = first_match(t, CERT_4)
    if m: return 4, "clear", m
    m = first_match(t, CERT_VAGUE)
    if m: return 3, "vague", m
    return 2, "missing", "(无认证/资格表述)"

# ---------- ③ 专业成果与经验 ----------
def score_achievement(adv, zz, course):
    t = " ".join([adv or "", zz or "", course or ""])
    signals = {
        "国标/行标": r"国标|行标|国家标准|行业标准|标准制定|标准化技术委员会",
        "国家级项目": r"国家级|国家重大|国家专项|重大专项|国家战略",
        "专利": r"专利|发明",
        "著作/教材": r"著作|教材|出版|编写",
        "论文": r"SCI|EI|论文|期刊|顶刊|核心期刊",
        "世界500强": r"世界\s?500强|财富\s?500|500强",
        "多年经验": r"(\d{2})\s*年.*(经验|从业|研究)|二十余年|三十余年|十余年",
        "工程中心": r"工程研究中心|研究中心创办|研究院",
        "牵头": r"牵头|创始人|创办人",
    }
    hits = [k for k, p in signals.items() if re.search(p, t)]
    ev = "；".join(hits) if hits else ""
    # 计分：硬成果数量决定层级
    hard = sum(1 for h in hits if h in ("国标/行标", "国家级项目", "专利", "著作/教材", "论文", "工程中心"))
    if "国标/行标" in hits or "国家级项目" in hits:
        return 5, "clear", ev
    if hard >= 2 or "世界500强" in hits or "多年经验" in hits:
        return 4, "clear", ev
    if hard == 1 or re.search(r"■", adv or ""):
        return 3, "vague" if hard == 0 else "clear", (ev or "有 ■ 要点描述的经验")
    return 2, "missing", "(无成果/经验表述)"

# ---------- ④ 社会荣誉与奖项 ----------
def score_honor(zz, soc, adv):
    t = " ".join([zz or "", soc or "", adv or ""])
    if re.search(r"院士", t):  # 含外籍院士
        return 5, "clear", first_match(t, [r"院士"])
    if re.search(r"长江学者|杰青|万人计划|国家级人才|国务院特殊津贴|国家.*奖|ISMS|Gary", t):
        return 5, "clear", "国家级人才/奖项"
    if re.search(r"省部级|省级|学者|岳麓学者|杰出青年|领军人才", t):
        return 3, "clear", "省部级/学者称号"
    if re.search(r"副会长|理事|委员|秘书长|会长|主席", t):
        return 2, "vague", first_match(t, [r"副会长|理事|委员|秘书长|会长|主席"])
    if re.search(r"荣誉|奖项|称号|拔尖|优秀人才", t):
        return 3, "clear", first_match(t, [r"荣誉|奖项|称号"])
    return 2, "missing", "(无荣誉表述)"

# ---------- ⑤ 职称、管理履历与行业地位 ----------
def score_title(zz, duty, soc):
    t = " ".join([zz or "", duty or "", soc or ""])
    if re.search(r"教授|研究员|博士生导师|博导", t):
        return 5, "clear", first_match(t, [r"教授|研究员|博士生导师|博导"])
    if re.search(r"院士", t):
        return 5, "clear", "院士"
    if re.search(r"首席执行官|CEO|总裁|董事长|创始人|院长|副校长", t):
        return 5, "clear", first_match(t, [r"CEO|总裁|董事长|创始人|院长|副校长"])
    if re.search(r"副教授|高级工程师|高工|副总裁|总监|CTO|合伙人|首席", t):
        return 4, "clear", first_match(t, [r"副教授|高级工程师|高工|副总裁|总监|CTO|合伙人|首席"])
    if re.search(r"经理|主管|讲师|工程师|架构师|主任|班主任|顾问", t):
        return 3, "vague", first_match(t, [r"经理|主管|讲师|工程师|架构师|主任|班主任|顾问"])
    return 2, "missing", "(无职称/履历表述)"

def main():
    with open(CSV, encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    experts = []
    for row in rows:
        name = (row.get("姓名") or "").strip()
        field = (row.get("适用领域") or "").strip()
        edu = row.get("学历") or ""
        zz = row.get("资历资质") or ""
        adv = row.get("突出优势") or ""
        course = row.get("课程/案例") or ""
        soc = seg(zz, "社会职务")
        duty = seg(zz, "履职资历")
        title_seg = seg(zz, "职称/荣誉头衔")
        referrer = (row.get("内部推荐人") or "").strip()
        supplier = (row.get("是否库内供应商") or "").strip()

        e_edu, s_edu, ev_edu = score_education(edu)
        cert_text = " ".join([soc, zz, adv, course])
        e_cert, s_cert, ev_cert = score_certification(cert_text)
        e_ach, s_ach, ev_ach = score_achievement(adv, zz, course)
        e_hon, s_hon, ev_hon = score_honor(title_seg, soc, adv)
        e_title, s_title, ev_title = score_title(title_seg, duty, soc)

        sub = {
            "professional": {
                "学历与学术背景": e_edu,
                "行业资质与认证": e_cert,
                "专业成果与经验": e_ach,
            },
            "influence": {
                "社会荣誉与奖项": e_hon,
                "职称、管理履历与行业地位": e_title,
            },
        }
        prof = (e_edu + e_cert + e_ach) / 3.0
        infl = (e_hon + e_title) / 2.0
        overall = round(prof * 0.6 + infl * 0.4, 2)
        experts.append({
            "name": name, "field": field,
            "referrer": referrer, "supplier": supplier,
            "subScores": sub,
            "evidence": {
                "学历与学术背景": ev_edu, "行业资质与认证": ev_cert,
                "专业成果与经验": ev_ach, "社会荣誉与奖项": ev_hon,
                "职称、管理履历与行业地位": ev_title,
            },
            "status": {
                "学历与学术背景": s_edu, "行业资质与认证": s_cert,
                "专业成果与经验": s_ach, "社会荣誉与奖项": s_hon,
                "职称、管理履历与行业地位": s_title,
            },
            "scores": {"professional": round(prof, 2), "influence": round(infl, 2), "overall": overall},
        })

    # 统计
    from collections import Counter
    dist = Counter()
    subdist = {k: Counter() for k in ["学历与学术背景", "行业资质与认证", "专业成果与经验", "社会荣誉与奖项", "职称、管理履历与行业地位"]}
    obs = [e for e in experts if e["scores"]["overall"] < 3.0]
    for e in experts:
        dist[round(e["scores"]["overall"], 1)] += 1
        for dim, val in e["subScores"]["professional"].items():
            subdist[dim][val] += 1
        for dim, val in e["subScores"]["influence"].items():
            subdist[dim][val] += 1
    result = {
        "meta": {"source": "专家资源库_69位信息待修复.xlsx", "version": "v1",
                 "count": len(experts), "observation_threshold": 3.0},
        "distribution_overall": dict(sorted(dist.items())),
        "sub_dim_distribution": {k: dict(v) for k, v in subdist.items()},
        "observation_count": len(obs),
        "experts": experts,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print("已写出:", OUT)
    print("专家数:", len(experts), " 进观察库(<3★):", len(obs), f"({round(100*len(obs)/len(experts),1)}%)")
    print("综合分布:", dict(sorted(dist.items())))
    print("子维度分布:")
    for k, v in subdist.items():
        print(f"  {k}: {dict(sorted(v.items()))}")
    print("\n观察库名单:")
    for e in sorted(obs, key=lambda x: x["scores"]["overall"]):
        print(f"  {e['name']} 综合{e['scores']['overall']} 专业{e['scores']['professional']} 影响{e['scores']['influence']} 缺失项:{[d for d,s in e['status'].items() if s=='missing']}")

if __name__ == "__main__":
    main()
