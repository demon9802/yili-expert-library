package com.yili.expert.resource.dto;

import lombok.Data;

/**
 * 管理员重置用户密码 DTO
 */
@Data
public class AdminResetPasswordRequest {
    private Long userId;
    private String tempPassword;
}
