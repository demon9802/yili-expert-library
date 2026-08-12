package com.yili.expert.resource.config;

import com.yili.expert.resource.utils.JwtUtil;
import com.yili.expert.resource.utils.RequestContextUtil;
import com.yili.expert.resource.entity.UserEntity;
import com.yili.expert.resource.mapper.UserMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * JWT 认证拦截器
 * 验证 Authorization Header 中的 JWT Token
 */
@Component
public class JwtAuthInterceptor implements HandlerInterceptor {

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserMapper userMapper;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // OPTIONS 预检请求直接放行
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            // 未登录请求放行，由 Controller/Service 层判断是否需要登录
            return true;
        }

        String token = authHeader.substring(7);
        try {
            Long userId = jwtUtil.getUserIdFromToken(token);
            UserEntity user = userMapper.selectById(userId);
            if (user != null) {
                RequestContextUtil.setCurrentUser(request, user.getId(), user.getEmail(), user.getIsAdmin() != null && user.getIsAdmin());
            }
        } catch (Exception e) {
            // Token 无效，放行但不设置用户信息
        }
        return true;
    }
}
