package com.yili.expert.resource.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

/**
 * 用户 DTO - 管理员用户列表展示
 */
@Data
public class UserDTO {
    private Long id;
    private String email;
    private Boolean isAdmin;
    private String role; // master / sub
    private Boolean hasSecurityQuestions;
    private Boolean forcePasswordChange;
    private String createdAt;
    private List<String> permissions;
    private Map<String, Object> extra;
}
