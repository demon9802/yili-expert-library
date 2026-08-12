package com.yili.expert.resource.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.yili.expert.resource.entity.FavoriteEntity;
import com.yili.expert.resource.mapper.FavoriteMapper;
import com.yili.expert.resource.service.FavoriteService;
import com.yili.expert.resource.utils.RequestContextUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class FavoriteServiceImpl implements FavoriteService {

    @Autowired
    private FavoriteMapper favoriteMapper;

    @Override
    public List<Long> findFavorites() {
        Long userId = RequestContextUtil.getCurrentUserId();
        if (userId == null) return new ArrayList<>();

        List<FavoriteEntity> entities = favoriteMapper.selectList(
                new LambdaQueryWrapper<FavoriteEntity>().eq(FavoriteEntity::getUserId, userId));

        List<Long> result = new ArrayList<>();
        for (FavoriteEntity e : entities) {
            result.add(e.getExpertId());
        }
        return result;
    }

    @Override
    public boolean addFavorite(Long expertId) {
        Long userId = RequestContextUtil.getCurrentUserId();
        if (userId == null) return false;

        // Check if already exists
        FavoriteEntity existing = favoriteMapper.selectOne(
                new LambdaQueryWrapper<FavoriteEntity>()
                        .eq(FavoriteEntity::getUserId, userId)
                        .eq(FavoriteEntity::getExpertId, expertId));
        if (existing != null) return true;

        FavoriteEntity entity = new FavoriteEntity();
        entity.setUserId(userId);
        entity.setExpertId(expertId);
        favoriteMapper.insert(entity);
        return true;
    }

    @Override
    public boolean removeFavorite(Long expertId) {
        Long userId = RequestContextUtil.getCurrentUserId();
        if (userId == null) return false;

        favoriteMapper.delete(new LambdaQueryWrapper<FavoriteEntity>()
                .eq(FavoriteEntity::getUserId, userId)
                .eq(FavoriteEntity::getExpertId, expertId));
        return true;
    }

    @Override
    public boolean isFavorite(Long expertId) {
        Long userId = RequestContextUtil.getCurrentUserId();
        if (userId == null) return false;

        Long count = favoriteMapper.selectCount(new LambdaQueryWrapper<FavoriteEntity>()
                .eq(FavoriteEntity::getUserId, userId)
                .eq(FavoriteEntity::getExpertId, expertId));
        return count != null && count > 0;
    }
}
