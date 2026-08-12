package com.yili.expert.resource.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 应用设置实体类
 * 对应表: yl_expert_resource_setting
 */
@Data
@TableName(value = "yl_expert_resource_setting", autoResultMap = true)
public class SettingEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String settingKey;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private String settingValue;

    private LocalDateTime updatedAt;
}
