package com.yili.expert.resource.dto;

import lombok.Data;
import java.util.List;

/**
 * 复合加载响应 DTO - 对应 loadAppData()
 */
@Data
public class AppDataDTO {
    private List<ExpertDTO> experts;
    private List<FieldDTO> fields;
    private List<ProjectDTO> yiliProjects;
    private List<Long> favorites;
}
