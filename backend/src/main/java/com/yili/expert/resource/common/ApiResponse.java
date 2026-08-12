package com.yili.expert.resource.common;

import lombok.Data;

/**
 * 统一API响应包装类
 * 保持与原项目一致的响应结构
 */
@Data
public class ApiResponse<T> {
    private int code;
    private String message;
    private T data;

    public static <T> ApiResponse<T> success(T data) {
        ApiResponse<T> r = new ApiResponse<>();
        r.code = 200;
        r.message = "success";
        r.data = data;
        return r;
    }

    public static <T> ApiResponse<T> success() {
        return success(null);
    }

    public static <T> ApiResponse<T> error(int code, String message) {
        ApiResponse<T> r = new ApiResponse<>();
        r.code = code;
        r.message = message;
        r.data = null;
        return r;
    }

    public static <T> ApiResponse<T> error(String message) {
        return error(500, message);
    }
}
