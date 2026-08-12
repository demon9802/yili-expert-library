package com.yili.expert.resource.controller;

import com.yili.expert.resource.common.ApiResponse;
import com.yili.expert.resource.service.FavoriteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 收藏 Controller
 * 对应原项目: fetchFavorites, addFavorite, removeFavorite, isFavorite
 */
@RestController
@RequestMapping("/api/favorites")
public class FavoriteController {

    @Autowired
    private FavoriteService favoriteService;

    @GetMapping
    public ApiResponse<List<Long>> findFavorites() {
        return ApiResponse.success(favoriteService.findFavorites());
    }

    @PostMapping("/{expertId}")
    public ApiResponse<Boolean> addFavorite(@PathVariable Long expertId) {
        return ApiResponse.success(favoriteService.addFavorite(expertId));
    }

    @DeleteMapping("/{expertId}")
    public ApiResponse<Boolean> removeFavorite(@PathVariable Long expertId) {
        return ApiResponse.success(favoriteService.removeFavorite(expertId));
    }

    @GetMapping("/{expertId}/check")
    public ApiResponse<Boolean> isFavorite(@PathVariable Long expertId) {
        return ApiResponse.success(favoriteService.isFavorite(expertId));
    }
}
