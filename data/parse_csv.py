import csv
import json
import re
import random

# Read the CSV file
import os
base_dir = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(base_dir, 'experts_raw.csv'), 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

print(f"Columns: {reader.fieldnames}")
print(f"Total rows: {len(rows)}")

experts = []
for i, row in enumerate(rows):
    name = row['姓名'].strip()
    if not name:
        continue
    
    fields_raw = row['适用领域'].strip()
    fields = [f.strip() for f in fields_raw.split(',') if f.strip()] if fields_raw else []
    
    advantages = row['突出优势'].strip()
    education = row['学历'].strip()
    qualifications = row['资历资质'].strip()
    courses = row['课程/案例'].strip()
    contact_person = row['联系人'].strip()
    contact_info = row['联系方式'].strip()
    referrer = row['内部推荐人'].strip()
    is_supplier = row['是否库内供应商'].strip() == '是'
    
    # Parse advantages into bullet points
    advantage_items = []
    if advantages:
        parts = re.split(r'\n(?=■)', advantages)
        for part in parts:
            part = part.strip()
            if not part:
                continue
            if part.startswith('■'):
                content = part[1:].strip()
                if '：' in content:
                    title, desc = content.split('：', 1)
                    advantage_items.append({'title': title.strip(), 'desc': desc.strip()})
                elif ':' in content:
                    title, desc = content.split(':', 1)
                    advantage_items.append({'title': title.strip(), 'desc': desc.strip()})
                else:
                    advantage_items.append({'title': '', 'desc': content})
            elif part:
                advantage_items.append({'title': '', 'desc': part})
    
    # Identify contact type
    contact_type = 'other'
    if contact_info:
        if '@' in contact_info and ('邮箱' in contact_info or contact_info.count('@') == 1):
            contact_type = 'email'
        elif '微信' in contact_info:
            contact_type = 'wechat'
        elif re.match(r'^[\d\-\s]+$', contact_info):
            contact_type = 'phone'
        else:
            # Detect email in multi-line
            email_match = re.search(r'[\w\.-]+@[\w\.-]+', contact_info)
            if email_match:
                contact_type = 'email'
            elif re.search(r'1[3-9]\d{9}', contact_info):
                contact_type = 'phone'
    
    # Extract education level for scoring
    edu_lower = education.lower()
    if any(kw in edu_lower for kw in ['博士', 'phd', '博士后']):
        edu_base = random.randint(8, 10)
    elif any(kw in edu_lower for kw in ['硕士', 'master', 'mba', '研究生']):
        edu_base = random.randint(7, 9)
    elif any(kw in edu_lower for kw in ['学士', '本科', 'bachelor']):
        edu_base = random.randint(6, 8)
    else:
        edu_base = random.randint(5, 8)
    
    # Influence score based on qualifications
    influence_base = random.randint(7, 10) if (qualifications and len(qualifications) > 150) else random.randint(6, 9)
    
    elite_kw = ['院士', '副总裁', '教授', '首席', '院长', '副会长', '秘书长', '副总裁', '总经理']
    for kw in elite_kw:
        if kw in qualifications:
            influence_base = min(10, influence_base + 1)
    
    overall = round((edu_base * 0.5 + influence_base * 0.5), 1)
    
    expert = {
        'id': i + 1,
        'name': name,
        'fields': fields,
        'advantages': advantage_items,
        'education': education,
        'qualifications': qualifications,
        'courses': courses,
        'contactPerson': contact_person,
        'contactInfo': contact_info,
        'contactType': contact_type,
        'referrer': referrer,
        'isSupplier': is_supplier,
        'scores': {
            'professional': edu_base,
            'influence': influence_base,
            'overall': overall
        },
        'status': 'active' if overall >= 7.0 else 'observation',
        'observationStatus': None,
        'observationDate': None
    }
    experts.append(expert)

# Get all unique fields
all_fields = set()
for e in experts:
    for f in e['fields']:
        all_fields.add(f)
fields_list = sorted(list(all_fields))

# Field colors
field_colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899',
    '#06B6D4', '#84CC16', '#F97316', '#6366F1', '#14B8A6',
    '#E11D48', '#7C3AED', '#0EA5E9', '#22C55E', '#A855F7',
    '#EAB308', '#0891B2', '#DC2626'
]

field_color_map = {}
for idx, f in enumerate(fields_list):
    field_color_map[f] = field_colors[idx % len(field_colors)]

data = {
    'updateTime': '2026-06-12T10:45:00+08:00',
    'totalExperts': len(experts),
    'totalFields': len(fields_list),
    'fields': [{'name': f, 'color': field_color_map[f]} for f in fields_list],
    'experts': experts
}

with open(os.path.join(base_dir, 'experts.json'), 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Parsed {len(experts)} experts, {len(fields_list)} unique fields")
print(f"Fields: {fields_list}")
low_score = [e['name'] for e in experts if e['scores']['overall'] < 7]
print(f"Experts with score < 7 ({len(low_score)}): {low_score}")
