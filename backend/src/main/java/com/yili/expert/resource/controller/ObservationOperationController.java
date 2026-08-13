package com.yili.expert.resource.controller;

import com.yili.expert.resource.common.ApiResponse;
import com.yili.expert.resource.entity.ObservationOperationEntity;
import com.yili.expert.resource.service.ObservationOperationService;
import com.yili.expert.resource.utils.RequestContextUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 观察库操作记录 Controller
 * 对应原项目: createObservationOperation, fetchObservationOperations
 */
@RestController
@RequestMapping("/api/observation-operations")
public class ObservationOperationController {

    @Autowired
    private ObservationOperationService observationOperationService;

    @GetMapping
    public ApiResponse<List<ObservationOperationEntity>> findByExpertId(
            @RequestParam(required = false) Long expertId) {
        RequestContextUtil.requireAdmin();
        return ApiResponse.success(observationOperationService.findByExpertId(expertId));
    }

    @PostMapping
    public ApiResponse<ObservationOperationEntity> create(@RequestBody ObservationOperationEntity entity) {
        RequestContextUtil.requireAdmin();
        return ApiResponse.success(observationOperationService.create(entity));
    }
}
