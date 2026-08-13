package com.yili.expert.resource.controller;

import com.yili.expert.resource.common.ApiResponse;
import com.yili.expert.resource.service.SettingService;
import com.yili.expert.resource.utils.RequestContextUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

/**
 * 应用设置 Controller
 * 对应原项目: syncPermissions, fetchPermissions (app_settings 表)
 */
@RestController
@RequestMapping("/api/settings")
public class SettingController {

    @Autowired
    private SettingService settingService;

    @GetMapping("/{key}")
    public ApiResponse<String> get(@PathVariable String key) {
        return ApiResponse.success(settingService.get(key));
    }

    @PutMapping("/{key}")
    public ApiResponse<Void> save(@PathVariable String key, @RequestBody String value) {
        RequestContextUtil.requireAdmin();
        settingService.save(key, value);
        return ApiResponse.success();
    }
}
