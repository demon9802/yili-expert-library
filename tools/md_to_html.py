#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Convert docs/scoring-rules-five-star.md to a styled HTML file."""
import markdown
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
SRC = BASE / 'docs' / 'scoring-rules-five-star.md'
DST = BASE / 'docs' / 'scoring-rules-five-star.html'

css = """
:root {
  --bg: #f8fafc;
  --card: #ffffff;
  --text: #1e293b;
  --muted: #64748b;
  --border: #e2e8f0;
  --primary: #2563eb;
  --radius: 8px;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.7;
}
.container {
  max-width: 900px;
  margin: 24px auto;
  padding: 32px;
  background: var(--card);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
h1 { font-size: 28px; margin: 0 0 16px; padding-bottom: 12px; border-bottom: 2px solid var(--primary); }
h2 { font-size: 20px; margin: 28px 0 12px; padding-bottom: 6px; border-bottom: 1px solid var(--border); color: #1e40af; }
h3 { font-size: 16px; margin: 20px 0 10px; color: #334155; }
h4 { font-size: 14px; margin: 16px 0 8px; color: #475569; }
p { margin: 10px 0; }
blockquote {
  margin: 14px 0;
  padding: 12px 16px;
  background: #f0f7ff;
  border-left: 4px solid var(--primary);
  border-radius: var(--radius);
  color: #334155;
}
blockquote p { margin: 6px 0; }
code {
  font-family: "SF Mono", Consolas, monospace;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.92em;
}
pre {
  background: #0f172a;
  color: #e2e8f0;
  padding: 16px;
  border-radius: var(--radius);
  overflow-x: auto;
  line-height: 1.5;
}
pre code { background: transparent; padding: 0; }
table {
  width: 100%;
  border-collapse: collapse;
  margin: 14px 0;
  font-size: 13px;
}
th, td {
  border: 1px solid var(--border);
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
}
th {
  background: #f1f5f9;
  font-weight: 600;
  color: #334155;
}
tr:nth-child(even) { background: #f8fafc; }
ul, ol { margin: 10px 0; padding-left: 22px; }
li { margin: 4px 0; }
strong { color: #1e40af; }
@media (max-width: 640px) {
  .container { margin: 12px; padding: 16px; }
  h1 { font-size: 22px; }
  table { font-size: 12px; }
  th, td { padding: 6px; }
}
"""

def main():
    md = SRC.read_text(encoding='utf-8')
    html_body = markdown.markdown(
        md,
        extensions=['tables', 'fenced_code', 'toc'],
        extension_configs={}
    )
    full = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>专家评分规则 · 五星制</title>
<style>{css}</style>
</head>
<body>
  <div class="container">
    {html_body}
  </div>
</body>
</html>"""
    DST.write_text(full, encoding='utf-8')
    print(f'Converted {SRC} -> {DST}')

if __name__ == '__main__':
    main()
