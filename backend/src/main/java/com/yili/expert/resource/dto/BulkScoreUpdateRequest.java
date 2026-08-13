package com.yili.expert.resource.dto;

import lombok.Data;

import java.util.Map;

/**
 * 批量更新专家评分请求
 */
@Data
public class BulkScoreUpdateRequest {
    private Long id;
    private Map<String, Object> scores;
}
