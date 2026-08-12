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
        ensureAdminUser("master@yili.local", "yili2026");
        ensureAdminUser("subj5dpcw@yili.local", "ceshi123");
    }

    private void ensureAdminUser(String email, String rawPassword) {
        UserEntity existing = userMapper.selectOne(
                new LambdaQueryWrapper<UserEntity>().eq(UserEntity::getEmail, email));
        if (existing != null) {
            return;
        }
        UserEntity user = new UserEntity();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setIsAdmin(true);
        user.setForcePasswordChange(false);
        userMapper.insert(user);
    }
}
