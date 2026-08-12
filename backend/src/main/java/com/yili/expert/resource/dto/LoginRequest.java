package com.yili.expert.resource.dto;

import lombok.Data;

/**
 * 登录请求 DTO
 */
@Data
public class LoginRequest {
    private String email;
    private String password;
}
