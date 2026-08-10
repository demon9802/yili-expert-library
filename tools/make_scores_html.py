# -*- coding: utf-8 -*-
"""把 expert-scores-extracted.json 渲染为可审阅 HTML 报告"""
import json, os

HERE = os.path.dirname(__file__)
JSON = os.path.join(HERE, "..", "docs", "expert-scores-extracted.json")
OUT = os.path.join(HERE, "..", "docs", "expert-scores-extracted.html")

d = json.load(open(JSON, encoding="utf-8"))
es = d["experts"]
DIMS_P = ["学历与学术背景", "行业资质与认证", "专业成果与经验"]
DIMS_I = ["社会荣誉与奖项", "职称、管理履历与行业地位"]

def color(v):
    return "#16a34a" if v >= 4 else ("#d97706" if v >= 3 else "#dc2626")

def cell(val, status, ev):
    tag = {"missing": "缺", "vague": "糊", "clear": "实"}.get(status, "")
    title = (ev or "").replace('"', "&quot;").replace("\n", " ")
    return f'<td title="依据：{title}" style="color:{color(val)};font-weight:600;cursor:help">{val} <span style="font-size:10px;color:#888">{tag}</span></td>'

rows = ""
for e in sorted(es, key=lambda x: -x["scores"]["overall"]):
    obs = e["scores"]["overall"] < 3.0
    badge = '<span style="background:#fee2e2;color:#b91c1c;padding:1px 6px;border-radius:4px;font-size:11px">观察库</span>' if obs else ""
    p = e["subScores"]["professional"]; i = e["subScores"]["influence"]; st = e["status"]; ev = e["evidence"]
    rows += f"""<tr>
<td>{e['name']}</td><td title="{e['field'].replace('"','&quot;')}">{e['field']}</td>
{cell(p['学历与学术背景'], st['学历与学术背景'], ev['学历与学术背景'])}
{cell(p['行业资质与认证'], st['行业资质与认证'], ev['行业资质与认证'])}
{cell(p['专业成果与经验'], st['专业成果与经验'], ev['专业成果与经验'])}
{cell(i['社会荣誉与奖项'], st['社会荣誉与奖项'], ev['社会荣誉与奖项'])}
{cell(i['职称、管理履历与行业地位'], st['职称、管理履历与行业地位'], ev['职称、管理履历与行业地位'])}
<td title="综合=专业度60%+影响力40%" style="color:{color(e['scores']['overall'])};font-weight:700">{e['scores']['overall']}</td>
<td>{badge}</td></tr>"""

# 分布柱状
dist = d["distribution_overall"]
maxc = max(dist.values()) if dist else 1
bars = ""
for k in sorted(dist):
    h = int(100 * dist[k] / maxc)
    bars += f'<div style="display:flex;align-items:center;gap:6px;margin:2px 0"><span style="width:32px;text-align:right;font-size:12px">{k}★</span><div style="width:{h}%;background:#3b82f6;height:14px;border-radius:3px"></div><span style="font-size:12px">{dist[k]}</span></div>'

HTML = f"""<!doctype html><html lang="zh"><head><meta charset="utf-8">
<title>专家五星制提取报告 v1</title>
<style>body{{font-family:system-ui,'Microsoft YaHei',sans-serif;margin:24px;color:#1f2937}}
h1{{font-size:20px}} table{{border-collapse:collapse;width:100%;font-size:13px;margin-top:0}}
th,td{{border:1px solid #e5e7eb;padding:5px 8px;text-align:center}}
th{{background:#f3f4f6;position:sticky;top:0;z-index:5}}
tr:nth-child(even){{background:#fafafa}}
.tag{{display:inline-block;padding:1px 6px;border-radius:4px;font-size:11px;margin:1px}}
.card{{border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin:10px 0;background:#fff}}
.legend span{{margin-right:10px;font-size:12px}}
/* 领域列窄 + 不换行，便于长表滚动查阅 */
th:nth-child(2),td:nth-child(2){{width:64px;min-width:64px;max-width:64px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.scroll-wrap{{max-height:calc(100vh - 230px);overflow:auto;border:1px solid #e5e7eb;border-radius:8px}}</style></head>
<body>
<h1>专家信息 → 五星制结构化评分 提取报告（v1，{d['meta']['count']} 位）</h1>
<div class="card">
<div class="legend"><b>综合分布</b> &nbsp; 进观察库(&lt;3★)：<b>{d['observation_count']}</b> 人（{round(100*d['observation_count']/d['meta']['count'],1)}%）</div>
{bars}
</div>
<div class="card legend">
<span>颜色：<span style="color:#16a34a">≥4★ 绿</span> / <span style="color:#d97706">3★ 橙</span> / <span style="color:#dc2626">&lt;3★ 红</span></span>
&nbsp;|&nbsp; <span>状态标：实=有具体信号 / 糊=有信息笼统 / 缺=未公开或空白</span>
</div>
<div class="scroll-wrap"><table>
<tr><th>姓名</th><th>领域</th><th>学历</th><th>资质</th><th>成果</th><th>荣誉</th><th>职称履历</th><th>综合</th><th></th></tr>
{rows}
</table></div>
</body></html>"""
open(OUT, "w", encoding="utf-8").write(HTML)
print("HTML 写出:", os.path.abspath(OUT))
