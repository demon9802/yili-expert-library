package com.yili.expert.resource.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 合作项目实体类
 * 对应表: yl_expert_resource_project
 */
@Data
@TableName("yl_expert_resource_project")
public class ProjectEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String title;
    private Long expertId;
    private String pendingExpertName;
    private Integer year;
    private Integer month;
    private String satisfaction;
    private String description;
    private Boolean visible;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
