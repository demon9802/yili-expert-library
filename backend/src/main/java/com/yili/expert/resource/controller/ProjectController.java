package com.yili.expert.resource.controller;

import com.yili.expert.resource.common.ApiResponse;
import com.yili.expert.resource.dto.ProjectDTO;
import com.yili.expert.resource.service.ProjectService;
import com.yili.expert.resource.utils.RequestContextUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 合作项目 Controller
 * 对应原项目: fetchProjects, createProject, updateProject, upsertProject, deleteProject
 */
@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    @Autowired
    private ProjectService projectService;

    @GetMapping
    public ApiResponse<List<ProjectDTO>> findAll() {
        return ApiResponse.success(projectService.findAll());
    }

    @PostMapping
    public ApiResponse<ProjectDTO> create(@RequestBody ProjectDTO dto) {
        RequestContextUtil.requireAdmin();
        return ApiResponse.success(projectService.create(dto));
    }

    @PutMapping("/{id}")
    public ApiResponse<ProjectDTO> update(@PathVariable Long id, @RequestBody ProjectDTO dto) {
        RequestContextUtil.requireAdmin();
        return ApiResponse.success(projectService.update(id, dto));
    }

    @PutMapping("/upsert")
    public ApiResponse<ProjectDTO> upsert(@RequestBody ProjectDTO dto) {
        RequestContextUtil.requireAdmin();
        return ApiResponse.success(projectService.upsert(dto));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        RequestContextUtil.requireAdmin();
        projectService.delete(id);
        return ApiResponse.success();
    }
}
