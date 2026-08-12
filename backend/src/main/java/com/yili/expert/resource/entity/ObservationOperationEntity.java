package com.yili.expert.resource.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 观察库操作记录实体类
 * 对应表: yl_expert_resource_observation_operation
 */
@Data
@TableName(value = "yl_expert_resource_observation_operation", autoResultMap = true)
public class ObservationOperationEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long expertId;
    private String expertName;
    private String operation;
    private String operatorId;
    private String operatorName;
    private String operatorRole;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private String beforeState;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private String afterState;

    private String note;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> tags;

    private LocalDateTime createdAt;
}
