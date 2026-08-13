package com.yili.expert.resource.dto;

import lombok.Data;
import java.util.Map;

@Data
public class UpdateUserPermissionsRequest {
    private Long userId;
    private Map<String, Boolean> permissions;
}
