package com.yili.expert.resource.dto;

import lombok.Data;

/**
 * 合作项目 DTO - 与前端数据模型一致
 */
@Data
public class ProjectDTO {
    private Long id;
    private String title;
    private Long expertId;
    private String pendingExpertName;
    private Integer year;
    private Integer month;
    private String satisfaction;
    private String desc;
    private Boolean visible;
    private String createdBy;
    private String createdAt;
    private String updatedAt;
}
