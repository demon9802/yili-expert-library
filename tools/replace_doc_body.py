import re, sys
path = r'C:\Users\PC\WorkBuddy\Claw\yili-expert-library\js\app.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

start_marker = '    docBody.innerHTML = `'
end_marker = '    `;'
start = text.find(start_marker)
if start == -1:
    print('start not found')
    sys.exit(1)
# find end_marker after start, but ensure it's at start of line (4 spaces)
end = text.find(end_marker, start + len(start_marker))
if end == -1:
    print('end not found')
    sys.exit(1)
# include the end marker
end += len(end_marker)

new_block = '''    docBody.innerHTML = `
      <!-- ===== 文档入口卡片 ===== -->
      <div style="margin-bottom:14px; padding:10px 14px; background:linear-gradient(135deg,#F0FDF4,#ECFDF5); border-radius:8px; border:1px solid #BBF7D0; display:flex; align-items:center; gap:10px;">
        <div style="font-size:24px; flex-shrink:0;">📐</div>
        <div style="flex:1;">
          <div style="font-weight:600; font-size:13px; color:'#166534';">评分规则·五星制内部版（v5.9.0）</div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">覆盖专业度、影响力2个维度，共5个评分项，计算综合得分 → 核对赋分逻辑 / 检验测算结果</div>
        </div>
        <a href="https://yili-expert-library-bvw2itdk.zh-cn.edgeone.cool/docs/scoring-rules-five-star.md" target="_blank" rel="noopener" style="flex-shrink:0; font-size:11px; color:#166534; text-decoration:none; padding:5px 12px; border:1px solid #86EFAC; border-radius:6px; background:white; font-weight:600;">打开完整文档 ↗</a>
      </div>

      <!-- ===== 第一部分：计算公式与逻辑 ===== -->
      <div style="margin-bottom:16px; padding:12px 14px; background:linear-gradient(135deg,#EEF2FF,#E0E7FF); border-radius:8px; border-left:4px solid #4338CA;">
        <strong style="font-size:14px; color:#312E81;">📐 核心计算公式（五星制）</strong>
        <div style="margin-top:8px; font-size:11.5px; background:#fff; padding:10px; border-radius:6px; line-height:1.9;">
          <b>Step 1</b> — 取子维度分值（整数★）：<br>
          &nbsp;&nbsp;有录入值 → 使用录入值；缺失(空/未公开/模糊) → 统一取 <b style="color:#DC2626">3★</b><br>
          &nbsp;&nbsp;结果截断到 <b>[1, 5]</b>（超出封顶或低于1均修正）<br><br>
          <b>Step 2</b> — 加权求大维度分：<br>
          &nbsp;&nbsp;<b>专业度</b> = (学历 + 资质 + 成果) / 3<br>
          &nbsp;&nbsp;<b>影响力</b> = (荣誉 + 职称) / 2<br><br>
          <b>Step 3</b> — 加权求综合得分：<br>
          &nbsp;&nbsp;<b>综合</b> = 专业度 × ${profW}% + 影响力 × ${inflW}%<br><br>
          <b>Step 4</b> — 结果保留 1 位小数
        </div>
      </div>

      <!-- ===== 第二部分：五子维度 1-5★ 速查 ===== -->
      <h5 style="color:#312E81; margin:14px 0 8px; font-size:13px; border-bottom:1px solid #E0E7FF; paddingBottom:4px;">📊 五子维度 1-5★ 赋分表</h5>

      <div style="margin-bottom:10px; padding:10px; background:#F8FAFC; border-radius:6px; border-left:3px solid #3B82F6;">
        <b style="color:#1D4ED8;">① 学历与学术背景</b> <span style="color:#6B7280;font-size:11px;">（权重 1/3 | 封顶 5★ | 缺失 3★）</span>
        <div style="font-size:11px;margin-top:4px;line-height:1.7;">
          5★ 博士+顶尖院校（清北/C9/QS前50） | 4★ 名校硕士/普通博士 | 3★ 较好本科/普通硕士 | 2★ 普通本科 | 1★ 大专/中专及以下
        </div>
      </div>
      <div style="margin-bottom:10px; padding:10px; background:#F8FAFC; border-radius:6px; border-left:3px solid #10B981;">
        <b style="color:#059669;">② 行业资质与认证</b> <span style="color:#6B7280;font-size:11px;">（权重 1/3 | 封顶 5★ | 缺失 3★）</span>
        <div style="font-size:11px;margin-top:4px;line-height:1.7;">
          5★ 国际权威认证（CFA/CPA/ACCA等）或多顶国家级 | 4★ 国家级执业/行业权威（多领域） | 3★ 行业厂商认证或单一国家级执业 | 2★ 培训/通用认证 | 1★ 无相关认证
        </div>
      </div>
      <div style="margin-bottom:10px; padding:10px; background:#F8FAFC; border-radius:6px; border-left:3px solid #F59E0B;">
        <b style="color:#D97706;">③ 专业成果与经验</b> <span style="color:#6B7280;font-size:11px;">（权重 1/3 | 封顶 5★ | 缺失 3★）</span>
        <div style="font-size:11px;margin-top:4px;line-height:1.7;">
          5★ 标杆级（牵头国标行标/高被引/重大成果转化） | 4★ 战略级/国家级项目·顶刊 | 3★ 省级/行业级·SCI/EI | 2★ 参与级/普通论文 | 1★ 一般经验/仅演讲
        </div>
      </div>
      <div style="margin-bottom:10px; padding:10px; background:#F8FAFC; border-radius:6px; border-left:3px solid #EF4444;">
        <b style="color:#DC2626;">④ 社会荣誉与奖项</b> <span style="color:#6B7280;font-size:11px;">（权重 1/2 | 封顶 5★ | 缺失 3★）</span>
        <div style="font-size:11px;margin-top:4px;line-height:1.7;">
          5★ 顶尖人才（两院院士/国家级人才计划） | 4★ 国家级荣誉/称号 | 3★ 省部级荣誉/称号 | 2★ 地市级/国家级学会成员 | 1★ 无荣誉/一般协会
        </div>
      </div>
      <div style="margin-bottom:12px; padding:10px; background:#F8FAFC; border-radius:6px; border-left:3px solid #8B5CF6;">
        <b style="color:#7C3AED;">⑤ 职称、管理履历与行业地位</b> <span style="color:#6B7280;font-size:11px;">（权重 1/2 | 封顶 5★ | 缺失 3★）</span>
        <div style="font-size:11px;margin-top:4px;line-height:1.7;">
          5★ 教授/CEO/创始人（世界500强/央企/上市公司） | 4★ 教授/CEO/创始人（行业百强/大厂） | 3★ 副教授/总监/VP/合伙人 | 2★ 经理/高工/主管 | 1★ 无职称/基层
        </div>
      </div>

      <!-- ===== 第三部分：关键测试案例 ===== -->
      <h5 style="color:#312E81; margin:16px 0 8px; font-size:13px; border-bottom:1px solid #E0E7FF; paddingBottom:4px;">🧪 关键测试案例</h5>

      <div style="padding:10px; background:#FEF2F2; border-radius:6px; border:1px solid #FECACA; margin-bottom:10px;">
        <b style="color:#991B1B;">案例A：全缺失专家</b>
        <div style="font-size:11px;margin-top:4px;line-height:1.8;">
          输入：5 个维度全部缺失 → 每个子维度统一取 <b>3★</b><br>
          专业度 = (3+3+3)/3 = <b>3.0</b>；影响力 = (3+3)/2 = <b>3.0</b><br>
          综合 = 3.0×${profW}% + 3.0×${inflW}% = <b>3.0</b>（恰好达到展示线）<br>
          <span style="color:#991B1B;">✅ 验证：缺失默认 3★，不占优不拉低，综合=3.0 不进入观察库。</span>
        </div>
      </div>

      <div style="padding:10px; background:#F0FDF4; border-radius:6px; border:1px solid #BBF7D0; margin-bottom:10px;">
        <b style="color:#166534;">案例B：顶级专家</b>
        <div style="font-size:11px;margin-top:4px;line-height:1.8;">
          输入：学历=5★ | 资质=5★ | 成果=5★ | 荣誉=5★ | 职称=5★<br>
          专业度 = 5.0；影响力 = 5.0；综合 = <b>5.0</b><br>
          <span style="color:#166534;">✅ 验证：全满星综合为 5.0。</span>
        </div>
      </div>

      <div style="padding:10px; background:#EFF6FF; border-radius:6px; border:1px solid #BFDBFE; margin-bottom:10px;">
        <b style="color:#1E40AF;">案例C：边界值</b>
        <div style="font-size:11px;margin-top:4px;line-height:1.8;">
          输入：某子维度手动输入 6 → 截断为 <b>5★（硬封顶）</b>；输入 0 → 截断为 <b>1★（硬下限）</b><br>
          <span style="color:#1E40AF;">✅ 验证：子维度只能在 1-5★ 之间。</span>
        </div>
      </div>

      <!-- ===== 第四部分：全局规则速查 ===== -->
      <h5 style="color:#312E81; margin:16px 0 8px; font-size:13px; border-bottom:1px solid #E0E7FF; paddingBottom:4px;">⚙️ 全局规则汇总</h5>
      <ul style="margin:0;padding-left:18px;font-size:11.5px;line-height:1.9;">
        <li><b>信息缺失统一 3★</b>（五维度一致），不空置不占优</li>
        <li><b>子维度硬封顶 5★、硬下限 1★</b></li>
        <li><b>综合得分 &lt; 3★ 进入观察库</b>，不进入前端展示</li>
        <li><b>管理员仅可调整 5 个评分项的整数星分</b>；专业度、影响力、综合得分由系统自动计算，不可直接编辑</li>
      </ul>
    `;'''

new_text = text[:start] + new_block + text[end:]
with open(path, 'w', encoding='utf-8') as f:
    f.write(new_text)
print('replaced', end - start, 'chars with', len(new_block), 'chars')
