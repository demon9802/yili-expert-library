package com.yili.expert.resource.controller;

import com.yili.expert.resource.common.ApiResponse;
import com.yili.expert.resource.dto.FieldDTO;
import com.yili.expert.resource.service.FieldService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 领域分类 Controller
 * 对应原项目: fetchFields, createField, updateField, deleteField
 */
@RestController
@RequestMapping("/api/fields")
public class FieldController {

    @Autowired
    private FieldService fieldService;

    @GetMapping
    public ApiResponse<List<FieldDTO>> findAll() {
        return ApiResponse.success(fieldService.findAll());
    }

    @PostMapping
    public ApiResponse<FieldDTO> create(@RequestBody FieldDTO dto) {
        return ApiResponse.success(fieldService.create(dto));
    }

    @PutMapping("/{name}")
    public ApiResponse<Void> update(@PathVariable String name, @RequestBody FieldDTO dto) {
        fieldService.update(name, dto);
        return ApiResponse.success();
    }

    @DeleteMapping("/{name}")
    public ApiResponse<Void> delete(@PathVariable String name) {
        fieldService.delete(name);
        return ApiResponse.success();
    }
}
