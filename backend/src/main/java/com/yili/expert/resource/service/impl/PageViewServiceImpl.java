package com.yili.expert.resource.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.yili.expert.resource.entity.PageViewEntity;
import com.yili.expert.resource.mapper.PageViewMapper;
import com.yili.expert.resource.service.PageViewService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class PageViewServiceImpl implements PageViewService {

    @Autowired
    private PageViewMapper pageViewMapper;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    private static final String REDIS_KEY_PREFIX = "expert_resource:page_views:";

    @Override
    public void recordView() {
        LocalDate today = LocalDate.now();
        String redisKey = REDIS_KEY_PREFIX + today.toString();

        // 先写 Redis 缓存
        try {
            redisTemplate.opsForValue().increment(redisKey);
        } catch (Exception e) {
            // Redis 不可用时直接写数据库
        }

        // 同步到数据库
        PageViewEntity existing = pageViewMapper.selectOne(
                new LambdaQueryWrapper<PageViewEntity>().eq(PageViewEntity::getViewDate, today));

        if (existing != null) {
            existing.setViewCount(existing.getViewCount() + 1);
            existing.setUpdatedAt(LocalDateTime.now());
            pageViewMapper.updateById(existing);
        } else {
            PageViewEntity entity = new PageViewEntity();
            entity.setViewDate(today);
            entity.setViewCount(1);
            entity.setCreatedAt(LocalDateTime.now());
            entity.setUpdatedAt(LocalDateTime.now());
            pageViewMapper.insert(entity);
        }
    }

    @Override
    public Map<String, Object> getMonthlyStats() {
        LocalDate now = LocalDate.now();
        LocalDate startOfMonth = now.withDayOfMonth(1);
        LocalDate startOfPrevMonth = startOfMonth.minusMonths(1);

        // 本月访问量
        List<PageViewEntity> thisMonth = pageViewMapper.selectList(
                new LambdaQueryWrapper<PageViewEntity>()
                        .ge(PageViewEntity::getViewDate, startOfMonth)
                        .le(PageViewEntity::getViewDate, now));

        int thisMonthTotal = 0;
        for (PageViewEntity e : thisMonth) {
            thisMonthTotal += e.getViewCount();
        }

        // 上月访问量
        List<PageViewEntity> lastMonth = pageViewMapper.selectList(
                new LambdaQueryWrapper<PageViewEntity>()
                        .ge(PageViewEntity::getViewDate, startOfPrevMonth)
                        .lt(PageViewEntity::getViewDate, startOfMonth));

        int lastMonthTotal = 0;
        for (PageViewEntity e : lastMonth) {
            lastMonthTotal += e.getViewCount();
        }

        // 总访问量
        List<PageViewEntity> all = pageViewMapper.selectList(null);
        int totalViews = 0;
        for (PageViewEntity e : all) {
            totalViews += e.getViewCount();
        }

        Map<String, Object> result = new HashMap<>();
        result.put("thisMonth", thisMonthTotal);
        result.put("lastMonth", lastMonthTotal);
        result.put("total", totalViews);
        result.put("dailyRecords", thisMonth);
        return result;
    }
}
