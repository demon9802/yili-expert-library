package com.yili.expert.resource.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 收藏实体类
 * 对应表: yl_expert_resource_favorite
 */
@Data
@TableName("yl_expert_resource_favorite")
public class FavoriteEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;
    private Long expertId;
    private LocalDateTime createdAt;
}
