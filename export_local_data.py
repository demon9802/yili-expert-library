import pymysql
import datetime
import os
import re

HOST = '127.0.0.1'
PORT = 3306
USER = 'root'
PASSWORD = 'root'
DB = 'yili_expert_resource_local'

OUT = r'C:\Users\PC\WorkBuddy\Claw\yili-expert-library\local_data_export.sql'

# 真实业务表插入顺序（依赖关系）：分类 -> 专家 -> 用户 -> 项目 -> 收藏 -> 设置 -> 观察操作日志
TABLE_ORDER = [
    'yl_expert_resource_field',
    'yl_expert_resource_expert',
    'yl_expert_resource_user',
    'yl_expert_resource_project',
    'yl_expert_resource_favorite',
    'yl_expert_resource_setting',
    'yl_expert_resource_observation_operation',
]

# 排除：修复备份表(_bak_)、访问日志(孤立非业务数据)
EXCLUDE = lambda t: '_bak_' in t or t == 'yl_expert_resource_page_view' or t == 'yl_expert_resource_page_views'

conn = pymysql.connect(host=HOST, port=PORT, user=USER, password=PASSWORD,
                       database=DB, charset='utf8mb4', autocommit=True)
cur = conn.cursor()


def esc(v):
    if v is None:
        return 'NULL'
    if isinstance(v, (bytes, bytearray)):
        v = v.decode('utf-8', 'replace')
    if isinstance(v, bool):
        return '1' if v else '0'
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (datetime.datetime, datetime.date, datetime.time)):
        return "'" + str(v) + "'"
    s = str(v)
    s = s.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n').replace('\r', '\\r')
    return "'" + s + "'"


cur.execute("SHOW TABLES")
all_tables = [r[0] for r in cur.fetchall()]
tables = [t for t in TABLE_ORDER if t in all_tables]
skipped = [t for t in all_tables if EXCLUDE(t)]
missing = [t for t in TABLE_ORDER if t not in all_tables]

lines = []
lines.append('-- ============================================================')
lines.append('-- 本地库数据导出 (yili_expert_resource_local @ localhost:3306)')
lines.append('-- 生成时间: ' + datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
lines.append('-- 用途: 将本地数据迁移到测试/生产环境 MySQL')
lines.append('-- ============================================================')
lines.append('-- 使用说明:')
lines.append('-- 1) 目标库先执行 backend/src/main/resources/sql/init.sql 建表(若未建)')
lines.append('-- 2) 若目标库为新库, 先启动后端让 DataInitializer 种子管理员账号,')
lines.append('--    再执行本文件; user 表已用 INSERT IGNORE 避免与种子管理员(email冲突)')
lines.append('-- 3) rating_reference 列若不存在, 先执行 migration_20250817_add_rating_reference.sql')
lines.append('-- 4) 本文件已排除: 修复备份表(*_bak_*) 与 访问日志(page_view, 孤立非业务)')
lines.append('-- ============================================================')
lines.append('')
lines.append('SET NAMES utf8mb4;')
lines.append('')

total_rows = 0
for t in tables:
    cur.execute("SHOW COLUMNS FROM `%s`" % t)
    cols = [r[0] for r in cur.fetchall()]
    cur.execute("SELECT * FROM `%s`" % t)
    rows = cur.fetchall()
    if not rows:
        lines.append('-- (空表, 无数据) %s' % t)
        lines.append('')
        continue
    verb = 'INSERT IGNORE INTO' if t == 'yl_expert_resource_user' else 'INSERT INTO'
    col_str = ', '.join('`%s`' % c for c in cols)
    lines.append('-- %s : %d 行' % (t, len(rows)))
    for row in rows:
        vals = ', '.join(esc(v) for v in row)
        lines.append('%s `%s` (%s) VALUES (%s);' % (verb, t, col_str, vals))
    lines.append('')
    total_rows += len(rows)

if missing:
    lines.append('-- 注意: 以下预期表在本地库中不存在(跳过): %s' % ', '.join(missing))
if skipped:
    lines.append('-- 已排除(非业务/备份): %s' % ', '.join(skipped))
lines.append('')
lines.append('-- 导出完成, 共 %d 行数据, 覆盖 %d 张表。' % (total_rows, len(tables)))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

cur.close()
conn.close()
print('OK 导出文件:', OUT)
print('覆盖表(%d):' % len(tables), ', '.join(tables))
print('总行数:', total_rows)
print('已排除:', ', '.join(skipped))
if missing:
    print('缺失表:', ', '.join(missing))
