package com.yili.expert.resource.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 页面访问记录实体类
 * 对应表: yl_expert_resource_page_view
 */
@Data
@TableName("yl_expert_resource_page_view")
public class PageViewEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private LocalDate viewDate;
    private Integer viewCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
