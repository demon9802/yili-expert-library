package com.yili.expert.resource.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 领域分类实体类
 * 对应表: yl_expert_resource_field
 */
@Data
@TableName("yl_expert_resource_field")
public class FieldEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;
    private String color;
    private String textColor;
    private Boolean hideWhenEmpty;
    private Integer sortOrder;
    private String creator;
    private LocalDateTime createdAt;
}
