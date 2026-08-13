package com.yili.expert.resource.dto;

import lombok.Data;

@Data
public class CreateSubAdminRequest {
    private String email;
    private String password;
    private String name;
}
