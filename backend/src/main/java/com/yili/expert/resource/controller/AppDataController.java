package com.yili.expert.resource.controller;

import com.yili.expert.resource.common.ApiResponse;
import com.yili.expert.resource.dto.AppDataDTO;
import com.yili.expert.resource.dto.ExpertDTO;
import com.yili.expert.resource.dto.FieldDTO;
import com.yili.expert.resource.dto.ProjectDTO;
import com.yili.expert.resource.service.ExpertService;
import com.yili.expert.resource.service.FavoriteService;
import com.yili.expert.resource.service.FieldService;
import com.yili.expert.resource.service.ProjectService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 复合加载 Controller
 * 对应原项目: loadAppData() — 一次性获取页面所需数据
 */
@RestController
@RequestMapping("/api/app-data")
public class AppDataController {

    @Autowired
    private ExpertService expertService;

    @Autowired
    private FieldService fieldService;

    @Autowired
    private ProjectService projectService;

    @Autowired
    private FavoriteService favoriteService;

    @GetMapping
    public ApiResponse<AppDataDTO> loadAppData() {
        AppDataDTO data = new AppDataDTO();
        data.setExperts(expertService.findAll());
        data.setFields(fieldService.findAll());
        data.setYiliProjects(projectService.findAll());
        data.setFavorites(favoriteService.findFavorites());
        return ApiResponse.success(data);
    }
}
