package com.yili.expert.resource.dto;

import lombok.Data;
import java.util.List;

/**
 * 用户 DTO - 管理员用户列表展示
 */
@Data
public class UserDTO {
    private Long id;
    private String email;
    private Boolean isAdmin;
    private Boolean hasSecurityQuestions;
    private Boolean forcePasswordChange;
    private String createdAt;
}
