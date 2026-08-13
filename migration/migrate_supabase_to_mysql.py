#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Supabase -> V6 MySQL 数据迁移脚本
运行前请确保：
1. MySQL 已启动，数据库 yili_expert_resource_local 已创建
2. 已执行 backend/src/main/resources/sql/init.sql 建表
3. 本地 Redis 已启动（后端运行时需要）
"""

import json
import os
from datetime import datetime

import pandas as pd
import pymysql

# ============== 配置 ==============
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_HOST = "localhost"
DB_PORT = 3306
DB_USER = "root"
DB_PASSWORD = "root"
DB_NAME = "yili_expert_resource_local"

CSV_FILES = {
    "fields": os.path.join(BASE_DIR, "fields_rows.csv"),
    "experts": os.path.join(BASE_DIR, "experts_rows.csv"),
    "projects": os.path.join(BASE_DIR, "projects_rows.csv"),
    "settings": os.path.join(BASE_DIR, "app_settings_rows.csv"),
}


def get_conn():
    return pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )


def parse_timestamp(val):
    """把 Supabase timestamptz 字符串转成 datetime"""
    if pd.isna(val):
        return None
    s = str(val).strip()
    # 处理 2026-06-24 01:21:50.319623+00
    if s.endswith("+00"):
        s = s[:-3]
    # 截取到秒，忽略微秒（MySQL datetime 默认精度到微秒也可，但为兼容这里截断）
    if "." in s:
        s = s.split(".")[0]
    try:
        return datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
    except Exception:
        return None


def parse_json(val):
    """把 CSV 中的 JSON 字符串转成 Python 对象；失败返回 None"""
    if pd.isna(val):
        return None
    try:
        return json.loads(str(val))
    except Exception:
        return None


def to_mysql_json(val):
    """把任意值转成可写入 MySQL JSON 列的字符串"""
    if pd.isna(val):
        return None
    parsed = parse_json(val)
    if parsed is None:
        return None
    return json.dumps(parsed, ensure_ascii=False, separators=(",", ":"))


def migrate_fields(conn):
    df = pd.read_csv(CSV_FILES["fields"])
    print(f"[fields] 读取 {len(df)} 条")

    with conn.cursor() as cur:
        cur.execute("TRUNCATE TABLE yl_expert_resource_field")
        sql = """
            INSERT INTO yl_expert_resource_field
            (id, name, color, text_color, hide_when_empty, sort_order, creator, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        for _, row in df.iterrows():
            cur.execute(
                sql,
                (
                    int(row["id"]),
                    row["name"],
                    row["color"],
                    row["text_color"],
                    bool(row["hide_when_empty"]),
                    int(row["sort_order"]),
                    row.get("creator") if pd.notna(row.get("creator")) else None,
                    parse_timestamp(row["created_at"]),
                ),
            )
    conn.commit()
    print("[fields] 写入完成")


def migrate_experts(conn):
    df = pd.read_csv(CSV_FILES["experts"])
    print(f"[experts] 读取 {len(df)} 条")

    with conn.cursor() as cur:
        cur.execute("TRUNCATE TABLE yl_expert_resource_expert")
        sql = """
            INSERT INTO yl_expert_resource_expert
            (id, name, fields, advantages, education, qualifications, courses,
             contact_person, contact_info, contact_type, referrer, is_supplier,
             qual_display, adv_display, scores, status, observation_status,
             observation_date, contacts, sort_order, created_by, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        for _, row in df.iterrows():
            # contact_info 在 CSV 里可能是数字，需要转字符串
            contact_info = row["contact_info"]
            if pd.notna(contact_info):
                contact_info = str(contact_info)
            else:
                contact_info = ""

            # status 映射：Supabase active -> active，其他保持
            status = row["status"] if pd.notna(row["status"]) else "active"

            cur.execute(
                sql,
                (
                    int(row["id"]),
                    row["name"],
                    to_mysql_json(row["fields"]),
                    to_mysql_json(row["advantages"]),
                    row["education"] if pd.notna(row["education"]) else None,
                    row["qualifications"] if pd.notna(row["qualifications"]) else None,
                    row["courses"] if pd.notna(row["courses"]) else None,
                    row["contact_person"] if pd.notna(row["contact_person"]) else "",
                    contact_info,
                    row["contact_type"] if pd.notna(row["contact_type"]) else "phone",
                    row["referrer"] if pd.notna(row["referrer"]) else "",
                    bool(row["is_supplier"]),
                    row["qual_display"] if pd.notna(row["qual_display"]) else None,
                    row["adv_display"] if pd.notna(row["adv_display"]) else None,
                    to_mysql_json(row["scores"]),
                    status,
                    row["observation_status"] if pd.notna(row["observation_status"]) else None,
                    row["observation_date"] if pd.notna(row["observation_date"]) else None,
                    to_mysql_json(row["contacts"]),
                    int(row["sort_order"]) if pd.notna(row["sort_order"]) else 0,
                    row["created_by"] if pd.notna(row["created_by"]) else "",
                    parse_timestamp(row["created_at"]),
                    parse_timestamp(row["updated_at"]),
                ),
            )
    conn.commit()
    print("[experts] 写入完成")


def migrate_projects(conn):
    df = pd.read_csv(CSV_FILES["projects"])
    print(f"[projects] 读取 {len(df)} 条")

    with conn.cursor() as cur:
        cur.execute("TRUNCATE TABLE yl_expert_resource_project")
        sql = """
            INSERT INTO yl_expert_resource_project
            (title, expert_id, pending_expert_name, year, month, satisfaction,
             description, visible, created_by, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        for _, row in df.iterrows():
            expert_id = row["expert_id"]
            if pd.isna(expert_id) or str(expert_id).strip() == "":
                expert_id = None
            else:
                expert_id = int(float(expert_id))

            month = row["month"]
            if pd.isna(month) or str(month).strip() == "":
                month = None
            else:
                month = int(float(month))

            satisfaction = to_mysql_json(row["satisfaction"])

            cur.execute(
                sql,
                (
                    row["title"],
                    expert_id,
                    row["pending_expert_name"] if pd.notna(row["pending_expert_name"]) else "",
                    int(row["year"]),
                    month,
                    satisfaction,
                    row["description"] if pd.notna(row["description"]) else None,
                    bool(row["visible"]),
                    row["created_by"] if pd.notna(row["created_by"]) else "",
                    parse_timestamp(row["created_at"]),
                    parse_timestamp(row["updated_at"]),
                ),
            )
    conn.commit()
    print("[projects] 写入完成")


def migrate_settings(conn):
    df = pd.read_csv(CSV_FILES["settings"])
    print(f"[settings] 读取 {len(df)} 条")

    with conn.cursor() as cur:
        cur.execute("TRUNCATE TABLE yl_expert_resource_setting")
        sql = """
            INSERT INTO yl_expert_resource_setting (setting_key, setting_value, updated_at)
            VALUES (%s, %s, %s)
        """
        for _, row in df.iterrows():
            key = row["key"]
            value = to_mysql_json(row["value"])
            updated_at = parse_timestamp(row["updated_at"])
            cur.execute(sql, (key, value, updated_at))
    conn.commit()
    print("[settings] 写入完成")


def verify_counts(conn):
    print("\n=== 迁移后数据量 ===")
    with conn.cursor() as cur:
        for table in [
            "yl_expert_resource_field",
            "yl_expert_resource_expert",
            "yl_expert_resource_project",
            "yl_expert_resource_setting",
        ]:
            cur.execute(f"SELECT COUNT(*) as cnt FROM {table}")
            print(f"{table}: {cur.fetchone()['cnt']} 条")


def main():
    conn = get_conn()
    try:
        migrate_fields(conn)
        migrate_experts(conn)
        migrate_projects(conn)
        migrate_settings(conn)
        verify_counts(conn)
        print("\n✅ 迁移完成，请刷新 http://localhost:3000 验证")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
