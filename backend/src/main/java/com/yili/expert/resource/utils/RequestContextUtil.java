package com.yili.expert.resource.utils;

import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import javax.servlet.http.HttpServletRequest;

/**
 * 请求上下文工具类
 * 从当前请求中获取用户信息
 */
@Component
public class RequestContextUtil {

    private static final String CURRENT_USER_ID = "currentUserId";
    private static final String CURRENT_USER_EMAIL = "currentUserEmail";
    private static final String IS_ADMIN = "isAdmin";

    public static Long getCurrentUserId() {
        HttpServletRequest request = getCurrentRequest();
        if (request == null) return null;
        Object id = request.getAttribute(CURRENT_USER_ID);
        return id != null ? (Long) id : null;
    }

    public static String getCurrentUserEmail() {
        HttpServletRequest request = getCurrentRequest();
        if (request == null) return null;
        return (String) request.getAttribute(CURRENT_USER_EMAIL);
    }

    public static boolean isAdmin() {
        HttpServletRequest request = getCurrentRequest();
        if (request == null) return false;
        Object admin = request.getAttribute(IS_ADMIN);
        return admin != null && (Boolean) admin;
    }

    public static void requireAdmin() {
        if (!isAdmin()) {
            throw new SecurityException("无管理员权限");
        }
    }

    public static void setCurrentUser(HttpServletRequest request, Long userId, String email, boolean isAdmin) {
        request.setAttribute(CURRENT_USER_ID, userId);
        request.setAttribute(CURRENT_USER_EMAIL, email);
        request.setAttribute(IS_ADMIN, isAdmin);
    }

    private static HttpServletRequest getCurrentRequest() {
        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return attrs != null ? attrs.getRequest() : null;
    }
}
