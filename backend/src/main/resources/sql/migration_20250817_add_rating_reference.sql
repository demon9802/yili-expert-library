-- ============================================================
-- 2026-08-17 修复：专家表缺失 rating_reference 列
-- 适用场景：已通过旧版 init.sql 初始化的 SIT/PROD/本地数据库
-- 执行后需重启后端，/api/app-data 即可正常查询
-- ============================================================
ALTER TABLE `yl_expert_resource_expert`
  ADD COLUMN `rating_reference` VARCHAR(500) DEFAULT NULL COMMENT '评分依据/参考来源'
  AFTER `adv_display`;
