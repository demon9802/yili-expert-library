package com.yili.expert.resource.config;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.yili.expert.resource.entity.UserEntity;
import com.yili.expert.resource.mapper.UserMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * 应用启动时初始化默认账号
 * 与 V5 保持一致：
 * - 主管理员：账号留空等价于 master@yili.local，密码 yili2026
 * - 测试子管理员：账号 subj5dpcw，密码 ceshi123
 */
@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private BCryptPasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        ensureAdminUser("master@yili.local", "yili2026", "master");
        ensureAdminUser("subj5dpcw@yili.local", "ceshi123", "sub");
    }

    private void ensureAdminUser(String email, String rawPassword, String role) {
        UserEntity existing = userMapper.selectOne(
                new LambdaQueryWrapper<UserEntity>().eq(UserEntity::getEmail, email));
        if (existing != null) {
            // 强制同步主/子管理员角色（老数据 role 默认 sub 需纠正）
            if (!role.equals(existing.getRole())) {
                existing.setRole(role);
                userMapper.updateById(existing);
            }
            return;
        }
        UserEntity user = new UserEntity();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setIsAdmin(true);
        user.setRole(role);
        user.setForcePasswordChange(false);
        userMapper.insert(user);
    }
}
