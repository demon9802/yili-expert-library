package com.yili.expert.resource.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 专家实体类
 * 对应表: yl_expert_resource_expert
 */
@Data
@TableName(value = "yl_expert_resource_expert", autoResultMap = true)
public class ExpertEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> fields;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Object> advantages;

    private String education;
    private String qualifications;
    private String courses;
    private String contactPerson;
    private String contactInfo;
    private String contactType;
    private String referrer;
    private Boolean isSupplier;
    private String qualDisplay;
    private String advDisplay;
    private String ratingReference;

    private String scores;

    private String status;
    private String observationStatus;
    private String observationDate;

    private String contacts;

    private Integer sortOrder;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
