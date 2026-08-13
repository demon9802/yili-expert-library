package com.yili.expert.resource.dto;

import lombok.Data;
import java.util.List;

/**
 * 专家 DTO - 与前端数据模型一致
 */
@Data
public class ExpertDTO {
    private Long id;
    private String name;
    private List<String> fields;
    private List<Object> advantages;
    private String education;
    private String qualifications;
    private String courses;
    private String contactPerson;
    private String contactInfo;
    private String contactType;
    private String referrer;
    private Boolean isSupplier;
    private String qualDisplay;
    private String advDisplay;
    private Object scores;
    private String status;
    private String observationStatus;
    private String observationDate;
    private List<Object> contacts;
    private String createdBy;
    private String createdAt;
    private String updatedAt;
    private Object subScores;
}
