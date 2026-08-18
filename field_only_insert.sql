-- 为 yl_expert_resource_field 表重灌 16 条分类（解决 分类管理 为空 / 领域人数分布暂无）
-- 用法：mysql -h <host> -P <port> -u <user> -p<pwd> yili_expert_resource_<env> < field_only_insert.sql
-- 时间: 2026-08-17 17:00:00

INSERT INTO `yl_expert_resource_field` (`id`, `name`, `color`, `text_color`, `hide_when_empty`, `sort_order`, `creator`, `created_at`) VALUES (46, 'AI', '#2563EB', '#ffffff', 0, 1, NULL, '2026-06-24 01:21:50');
INSERT INTO `yl_expert_resource_field` (`id`, `name`, `color`, `text_color`, `hide_when_empty`, `sort_order`, `creator`, `created_at`) VALUES (47, '产品', '#059669', '#ffffff', 0, 2, NULL, '2026-06-24 01:21:50');
INSERT INTO `yl_expert_resource_field` (`id`, `name`, `color`, `text_color`, `hide_when_empty`, `sort_order`, `creator`, `created_at`) VALUES (48, '产品创新', '#76ec4b', '#ffffff', 0, 3, NULL, '2026-06-24 01:21:50');
INSERT INTO `yl_expert_resource_field` (`id`, `name`, `color`, `text_color`, `hide_when_empty`, `sort_order`, `creator`, `created_at`) VALUES (49, '内容营销', '#33049f', '#ffffff', 0, 4, NULL, '2026-06-24 01:21:50');
INSERT INTO `yl_expert_resource_field` (`id`, `name`, `color`, `text_color`, `hide_when_empty`, `sort_order`, `creator`, `created_at`) VALUES (50, '商业模式', '#b90404', '#ffffff', 0, 5, NULL, '2026-06-24 01:21:50');
INSERT INTO `yl_expert_resource_field` (`id`, `name`, `color`, `text_color`, `hide_when_empty`, `sort_order`, `creator`, `created_at`) VALUES (51, '战略规划/战略解码/战略落地', '#0891B2', '#ffffff', 0, 6, NULL, '2026-06-24 01:21:50');
INSERT INTO `yl_expert_resource_field` (`id`, `name`, `color`, `text_color`, `hide_when_empty`, `sort_order`, `creator`, `created_at`) VALUES (52, '技术', '#91cdf3', '#ffffff', 0, 7, NULL, '2026-06-24 01:21:50');
INSERT INTO `yl_expert_resource_field` (`id`, `name`, `color`, `text_color`, `hide_when_empty`, `sort_order`, `creator`, `created_at`) VALUES (53, '数据', '#F59E0B', '#ffffff', 0, 8, NULL, '2026-06-24 01:21:50');
INSERT INTO `yl_expert_resource_field` (`id`, `name`, `color`, `text_color`, `hide_when_empty`, `sort_order`, `creator`, `created_at`) VALUES (54, '数智化供应链', '#f396c0', '#ffffff', 0, 9, NULL, '2026-06-24 01:21:50');
INSERT INTO `yl_expert_resource_field` (`id`, `name`, `color`, `text_color`, `hide_when_empty`, `sort_order`, `creator`, `created_at`) VALUES (55, '数智化营销', '#705fec', '#ffffff', 0, 10, NULL, '2026-06-24 01:21:50');
INSERT INTO `yl_expert_resource_field` (`id`, `name`, `color`, `text_color`, `hide_when_empty`, `sort_order`, `creator`, `created_at`) VALUES (56, '流程管理', '#81fdf3', '#ffffff', 0, 11, NULL, '2026-06-24 01:21:50');
INSERT INTO `yl_expert_resource_field` (`id`, `name`, `color`, `text_color`, `hide_when_empty`, `sort_order`, `creator`, `created_at`) VALUES (57, '电商', '#de79ec', '#ffffff', 0, 12, NULL, '2026-06-24 01:21:50');
INSERT INTO `yl_expert_resource_field` (`id`, `name`, `color`, `text_color`, `hide_when_empty`, `sort_order`, `creator`, `created_at`) VALUES (58, '组织人才', '#f8fc03', '#8B7355', 0, 13, NULL, '2026-06-24 01:21:50');
INSERT INTO `yl_expert_resource_field` (`id`, `name`, `color`, `text_color`, `hide_when_empty`, `sort_order`, `creator`, `created_at`) VALUES (59, '通用（领导力/协同/执行力/目标管理）', '#b3b2b2', '#ffffff', 0, 14, NULL, '2026-06-24 01:21:50');
INSERT INTO `yl_expert_resource_field` (`id`, `name`, `color`, `text_color`, `hide_when_empty`, `sort_order`, `creator`, `created_at`) VALUES (60, '会员运营', '#c8aff3', '#ffffff', 1, 15, NULL, '2026-06-24 01:21:50');
INSERT INTO `yl_expert_resource_field` (`id`, `name`, `color`, `text_color`, `hide_when_empty`, `sort_order`, `creator`, `created_at`) VALUES (61, '私域运营', '#e6ccde', '#ffffff', 0, 15, NULL, '2026-08-13 18:55:39');

SELECT id, name, color, sort_order FROM yl_expert_resource_field ORDER BY sort_order;
