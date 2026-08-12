package com.yili.expert.resource.dto;

import lombok.Data;

/**
 * 修改密码 DTO
 */
@Data
public class ChangePasswordRequest {
    private String oldPassword;
    private String newPassword;
}
