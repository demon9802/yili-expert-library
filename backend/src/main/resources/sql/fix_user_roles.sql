-- 修复：早期 role 默认值误为 'sub'，导致普通用户被当作子管理员。
-- 把非管理员账号的 role 统一修正为 'user'，避免其出现在权限管理和用户管理混乱。
UPDATE `yl_expert_resource_user`
SET `role` = 'user'
WHERE `is_admin` = 0 AND (`role` IS NULL OR `role` = '' OR `role` = 'sub');

-- 可选：若存在 role 为空的管理员，确保主/子管理员角色明确
-- UPDATE `yl_expert_resource_user` SET `role` = 'sub' WHERE `is_admin` = 1 AND `role` IS NULL;
