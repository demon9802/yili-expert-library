package com.yili.expert.resource.controller;

import com.yili.expert.resource.common.ApiResponse;
import com.yili.expert.resource.service.PageViewService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 页面访问记录 Controller
 * 对应原项目: localStorage yili_page_views (月报统计)
 */
@RestController
@RequestMapping("/api/page-views")
public class PageViewController {

    @Autowired
    private PageViewService pageViewService;

    @PostMapping
    public ApiResponse<Void> recordView() {
        pageViewService.recordView();
        return ApiResponse.success();
    }

    @GetMapping("/monthly")
    public ApiResponse<Map<String, Object>> getMonthlyStats() {
        return ApiResponse.success(pageViewService.getMonthlyStats());
    }
}
