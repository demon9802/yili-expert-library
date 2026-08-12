package com.yili.expert.resource.dto;

import lombok.Data;

/**
 * 领域分类 DTO - 与前端数据模型一致
 */
@Data
public class FieldDTO {
    private Long id;
    private String name;
    private String color;
    private String textColor;
    private Boolean hideWhenEmpty;
    private Integer sortOrder;
    private String creator;
}
