package com.yili.expert.resource.dto;

import lombok.Data;
import java.util.List;

/**
 * 密保问题保存 DTO
 */
@Data
public class SecurityQuestionRequest {
    private List<String> questions;
}
