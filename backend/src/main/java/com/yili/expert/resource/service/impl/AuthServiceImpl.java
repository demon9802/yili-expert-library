package com.yili.expert.resource.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.yili.expert.resource.dto.*;
import com.yili.expert.resource.entity.UserEntity;
import com.yili.expert.resource.mapper.UserMapper;
import com.yili.expert.resource.service.AuthService;
import com.yili.expert.resource.utils.JwtUtil;
import com.yili.expert.resource.utils.RequestContextUtil;
import com.yili.expert.resource.utils.Sha256Util;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AuthServiceImpl implements AuthService {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private JwtUtil jwtUtil;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Override
    public Object signUp(SignUpRequest request) {
        String email = request.getEmail();
        String password = request.getPassword();

        if (email == null || email.trim().isEmpty()) {
            throw new RuntimeException("邮箱不能为空");
        }
        if (password == null || password.length() < 6) {
            throw new RuntimeException("密码至少6位");
        }

        // 检查是否已注册
        UserEntity existing = userMapper.selectOne(
                new LambdaQueryWrapper<UserEntity>().eq(UserEntity::getEmail, email));
        if (existing != null) {
            throw new RuntimeException("该邮箱已注册，请直接登录");
        }

        UserEntity user = new UserEntity();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setIsAdmin(false);
        user.setForcePasswordChange(false);
        user.setSecurityAttempts(0);
        userMapper.insert(user);

        String token = jwtUtil.generateToken(user.getId(), user.getEmail());
        Map<String, Object> result = new HashMap<>();
        Map<String, Object> userMap = new HashMap<>();
        userMap.put("id", user.getId());
        userMap.put("email", user.getEmail());
        userMap.put("is_admin", false);
        result.put("user", userMap);
        result.put("token", token);
        return result;
    }

    @Override
    public Object login(LoginRequest request) {
        String email = request.getEmail();
        String password = request.getPassword();

        UserEntity user = userMapper.selectOne(
                new LambdaQueryWrapper<UserEntity>().eq(UserEntity::getEmail, email));
        if (user == null) {
            throw new RuntimeException("密码错误，请重试");
        }

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new RuntimeException("密码错误，请重试");
        }

        String token = jwtUtil.generateToken(user.getId(), user.getEmail());
        Map<String, Object> result = new HashMap<>();
        Map<String, Object> userMap = new HashMap<>();
        userMap.put("id", user.getId());
        userMap.put("email", user.getEmail());
        userMap.put("is_admin", user.getIsAdmin() != null && user.getIsAdmin());
        result.put("user", userMap);
        result.put("token", token);
        return result;
    }

    @Override
    public void logout() {
        // JWT 无状态，客户端删除 token 即可
    }

    @Override
    public void resetPassword(String email) {
        UserEntity user = userMapper.selectOne(
                new LambdaQueryWrapper<UserEntity>().eq(UserEntity::getEmail, email));
        if (user == null) {
            throw new RuntimeException("该邮箱未注册");
        }
        // 生成临时密码并标记强制改密
        String tempPassword = "yl" + (int) (Math.random() * 1000000);
        user.setPasswordHash(passwordEncoder.encode(tempPassword));
        user.setForcePasswordChange(true);
        userMapper.updateById(user);
        // 实际项目中应发送邮件，这里简化处理
    }

    @Override
    public void changePassword(ChangePasswordRequest request) {
        Long userId = RequestContextUtil.getCurrentUserId();
        if (userId == null) {
            throw new RuntimeException("未登录，请先登录");
        }

        UserEntity user = userMapper.selectById(userId);
        if (user == null) {
            throw new RuntimeException("用户不存在");
        }

        // 验证旧密码
        if (request.getOldPassword() != null && !request.getOldPassword().isEmpty()) {
            if (!passwordEncoder.matches(request.getOldPassword(), user.getPasswordHash())) {
                throw new RuntimeException("旧密码错误");
            }
        }

        if (request.getNewPassword() == null || request.getNewPassword().length() < 6) {
            throw new RuntimeException("新密码至少6位");
        }

        if (passwordEncoder.matches(request.getNewPassword(), user.getPasswordHash())) {
            throw new RuntimeException("新密码不能与旧密码相同");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setForcePasswordChange(false);
        userMapper.updateById(user);
    }

    @Override
    public boolean reauthenticate(String password) {
        Long userId = RequestContextUtil.getCurrentUserId();
        if (userId == null) {
            throw new RuntimeException("未登录，请先登录");
        }

        UserEntity user = userMapper.selectById(userId);
        if (user == null) {
            throw new RuntimeException("用户不存在");
        }

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new RuntimeException("旧密码错误");
        }
        return true;
    }

    @Override
    public void saveSecurityQuestions(SecurityQuestionRequest request) {
        Long userId = RequestContextUtil.getCurrentUserId();
        if (userId == null) {
            throw new RuntimeException("未登录");
        }

        if (request.getQuestions() == null || request.getQuestions().size() != 3) {
            throw new RuntimeException("密保问题需填写 3 道");
        }

        List<String> hashed = request.getQuestions().stream()
                .map(a -> Sha256Util.hash(a.trim()))
                .collect(Collectors.toList());

        UserEntity user = new UserEntity();
        user.setId(userId);
        user.setSecurityQuestions(hashed);
        user.setSecurityAttempts(0);
        user.setSecurityLockUntil(null);
        userMapper.updateById(user);
    }

    @Override
    public Object getSecurityQuestionTexts(Long userId) {
        UserEntity user = userMapper.selectById(userId);
        if (user == null || user.getSecurityQuestions() == null) {
            return null;
        }

        boolean locked = user.getSecurityLockUntil() != null
                && user.getSecurityLockUntil().isAfter(LocalDateTime.now());

        Map<String, Object> result = new HashMap<>();
        result.put("locked", locked);
        result.put("lockUntil", user.getSecurityLockUntil());
        result.put("attemptsRemaining", Math.max(0, 3 - (user.getSecurityAttempts() != null ? user.getSecurityAttempts() : 0)));
        result.put("questions", user.getSecurityQuestions());
        return result;
    }

    @Override
    public Object verifySecurityAnswers(SecurityVerifyRequest request) {
        Long userId = request.getUserId();
        List<String> answers = request.getAnswers();

        if (answers == null || answers.size() != 3) {
            throw new RuntimeException("需要回答 3 道密保题");
        }

        UserEntity user = userMapper.selectById(userId);
        if (user == null || user.getSecurityQuestions() == null) {
            Map<String, Object> r = new HashMap<>();
            r.put("success", false);
            r.put("error", "未设置密保问题");
            return r;
        }

        boolean locked = user.getSecurityLockUntil() != null
                && user.getSecurityLockUntil().isAfter(LocalDateTime.now());
        if (locked) {
            Map<String, Object> r = new HashMap<>();
            r.put("success", false);
            r.put("error", "密保已锁定，请稍后重试");
            return r;
        }

        boolean allMatch = true;
        for (int i = 0; i < 3; i++) {
            if (!Sha256Util.hash(answers.get(i).trim()).equals(user.getSecurityQuestions().get(i))) {
                allMatch = false;
                break;
            }
        }

        if (allMatch) {
            UserEntity update = new UserEntity();
            update.setId(userId);
            update.setSecurityAttempts(0);
            update.setSecurityLockUntil(null);
            userMapper.updateById(update);

            Map<String, Object> r = new HashMap<>();
            r.put("success", true);
            return r;
        } else {
            int newAttempts = (user.getSecurityAttempts() != null ? user.getSecurityAttempts() : 0) + 1;
            UserEntity update = new UserEntity();
            update.setId(userId);
            update.setSecurityAttempts(newAttempts);

            if (newAttempts >= 3) {
                update.setSecurityLockUntil(LocalDateTime.now().plusMinutes(5));
                userMapper.updateById(update);
                Map<String, Object> r = new HashMap<>();
                r.put("success", false);
                r.put("error", "答错次数过多，密保已锁定 5 分钟");
                return r;
            } else {
                userMapper.updateById(update);
                Map<String, Object> r = new HashMap<>();
                r.put("success", false);
                r.put("error", "密保答案错误，还剩 " + (3 - newAttempts) + " 次机会");
                return r;
            }
        }
    }

    @Override
    public void changePasswordAfterSecurityVerification(Long userId, String newPassword) {
        if (newPassword == null || newPassword.length() < 6) {
            throw new RuntimeException("新密码至少 6 位");
        }

        UserEntity user = userMapper.selectById(userId);
        if (user == null) {
            throw new RuntimeException("用户不存在");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setForcePasswordChange(true);
        userMapper.updateById(user);
    }

    @Override
    public List<UserDTO> fetchUserList() {
        List<UserEntity> users = userMapper.selectList(null);
        return users.stream().map(u -> {
            UserDTO dto = new UserDTO();
            dto.setId(u.getId());
            dto.setEmail(u.getEmail());
            dto.setIsAdmin(u.getIsAdmin() != null && u.getIsAdmin());
            dto.setHasSecurityQuestions(u.getSecurityQuestions() != null && !u.getSecurityQuestions().isEmpty());
            dto.setForcePasswordChange(u.getForcePasswordChange() != null && u.getForcePasswordChange());
            dto.setCreatedAt(u.getCreatedAt() != null ? u.getCreatedAt().toString() : null);
            return dto;
        }).collect(Collectors.toList());
    }

    @Override
    public void adminResetUserPassword(AdminResetPasswordRequest request) {
        Long userId = request.getUserId();
        String tempPassword = request.getTempPassword();

        if (tempPassword == null || tempPassword.length() < 6) {
            throw new RuntimeException("临时密码至少6位");
        }

        UserEntity user = userMapper.selectById(userId);
        if (user == null) {
            throw new RuntimeException("用户不存在");
        }

        user.setPasswordHash(passwordEncoder.encode(tempPassword));
        user.setForcePasswordChange(true);
        userMapper.updateById(user);
    }

    @Override
    public boolean checkForcePasswordChange() {
        Long userId = RequestContextUtil.getCurrentUserId();
        if (userId == null) return false;

        UserEntity user = userMapper.selectById(userId);
        return user != null && user.getForcePasswordChange() != null && user.getForcePasswordChange();
    }

    @Override
    public void clearForcePasswordChange() {
        Long userId = RequestContextUtil.getCurrentUserId();
        if (userId == null) return;

        UserEntity update = new UserEntity();
        update.setId(userId);
        update.setForcePasswordChange(false);
        userMapper.updateById(update);
    }
}
