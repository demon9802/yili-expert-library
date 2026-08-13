package com.yili.expert.resource.controller;

import com.yili.expert.resource.common.ApiResponse;
import com.yili.expert.resource.dto.BulkScoreUpdateRequest;
import com.yili.expert.resource.dto.ExpertDTO;
import com.yili.expert.resource.service.ExpertService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 专家 Controller
 * 对应原项目: fetchExperts, createExpert, updateExpert, upsertExpert, deleteExpert
 */
@RestController
@RequestMapping("/api/experts")
public class ExpertController {

    @Autowired
    private ExpertService expertService;

    @GetMapping
    public ApiResponse<List<ExpertDTO>> findAll() {
        return ApiResponse.success(expertService.findAll());
    }

    @GetMapping("/{id}")
    public ApiResponse<ExpertDTO> findById(@PathVariable Long id) {
        return ApiResponse.success(expertService.findById(id));
    }

    @PostMapping
    public ApiResponse<ExpertDTO> create(@RequestBody ExpertDTO dto) {
        return ApiResponse.success(expertService.create(dto));
    }

    @PutMapping("/{id}")
    public ApiResponse<ExpertDTO> update(@PathVariable Long id, @RequestBody ExpertDTO dto) {
        return ApiResponse.success(expertService.update(id, dto));
    }

    @PutMapping("/upsert")
    public ApiResponse<ExpertDTO> upsert(@RequestBody ExpertDTO dto) {
        return ApiResponse.success(expertService.upsert(dto));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        expertService.delete(id);
        return ApiResponse.success();
    }

    @PostMapping("/bulk-update-scores")
    public ApiResponse<Integer> bulkUpdateScores(@RequestBody List<BulkScoreUpdateRequest> requests) {
        return ApiResponse.success(expertService.bulkUpdateScores(requests));
    }
}
