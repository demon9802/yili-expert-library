// ===== 系统更新日志 =====
// v5.8.0+ 独立文件，编辑此文件即可更新月度报告中的更新日志
// 格式：{ version, date (YYYY-MM-DD), summary, module }
var VERSION_CHANGELOG = [
  { version: 'v5.8.5', date: '2026-07-28', summary: '修复 getDB() 白名单缺陷：管理员设置（手机端开关等）不再被启动重建覆盖', module: '紧急修复' },
  { version: 'v5.8.4', date: '2026-07-28', summary: '修复数据合并BUG（专家/项目丢失）+ 仪表盘去掉分布图 + 管理后台排序 + 月度报告修正', module: '紧急修复' },
  { version: 'v5.8.3', date: '2026-07-28', summary: '手机端开关（系统设置）+ 子管理员关闭分类管理权限', module: '权限设置' },
  { version: 'v5.8.2', date: '2026-07-28', summary: '全面升级Excel (.xlsx) 导入/导出 + CSV编码自动修复 + 模板升级为.xlsx', module: '基础架构' },
  { version: 'v5.8.1', date: '2026-07-27', summary: '月度报告导出PNG/PDF + 更新日志独立文件 + 测试模式迁入系统设置', module: '系统管理' },
  { version: 'v5.8.0', date: '2026-07-27', summary: '月度报告功能上线 + 排序标签迁移至系统设置', module: '系统管理' },
  { version: 'v5.7.3', date: '2026-07-24', summary: '适用领域筛选标签——0人领域不显示', module: 'UI/交互' },
  { version: 'v5.7.2', date: '2026-07-24', summary: '仪表盘动态显示——空领域不显示不统计', module: '仪表盘' },
  { version: 'v5.7.1', date: '2026-07-22', summary: '手机端UI修复 + 收起按钮修复 + 专家卡片名字截断 + 评分并排', module: 'UI/交互' },
  { version: 'v5.7.0', date: '2026-07-21', summary: '修复严重数据丢失bug + 子管理员密码管理', module: '基础架构' },
  { version: 'v5.6.9', date: '2026-07-18', summary: '手机端切换功能', module: 'UI/交互' },
  { version: 'v5.6.8', date: '2026-07-17', summary: '账号管理UI改进 + 仪表盘导出重构', module: 'UI/交互' },
  { version: 'v5.6.7', date: '2026-07-16', summary: '测试模式仪表盘修复 + 子管理员标签权限 + 子管理员仪表盘只读', module: '权限设置' }
];
