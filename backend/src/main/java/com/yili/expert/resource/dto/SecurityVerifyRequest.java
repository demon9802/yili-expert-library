package com.yili.expert.resource.dto;

import lombok.Data;
import java.util.List;

/**
 * 密保验证 DTO
 */
@Data
public class SecurityVerifyRequest {
    private Long userId;
    private List<String> answers;
}
