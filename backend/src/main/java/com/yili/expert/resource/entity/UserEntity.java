package com.yili.expert.resource.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 用户实体类（替代 Supabase auth.users + profiles）
 * 对应表: yl_expert_resource_user
 */
@Data
@TableName(value = "yl_expert_resource_user", autoResultMap = true)
public class UserEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String email;
    private String passwordHash;
    private Boolean isAdmin;
    private Boolean forcePasswordChange;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> securityQuestions;

    private Integer securityAttempts;
    private LocalDateTime securityLockUntil;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
