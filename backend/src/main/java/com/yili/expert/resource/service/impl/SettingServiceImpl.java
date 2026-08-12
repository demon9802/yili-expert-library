package com.yili.expert.resource.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.yili.expert.resource.entity.SettingEntity;
import com.yili.expert.resource.mapper.SettingMapper;
import com.yili.expert.resource.service.SettingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class SettingServiceImpl implements SettingService {

    @Autowired
    private SettingMapper settingMapper;

    @Override
    public String get(String key) {
        SettingEntity entity = settingMapper.selectOne(
                new LambdaQueryWrapper<SettingEntity>().eq(SettingEntity::getSettingKey, key));
        return entity != null ? entity.getSettingValue() : null;
    }

    @Override
    public void save(String key, String value) {
        SettingEntity existing = settingMapper.selectOne(
                new LambdaQueryWrapper<SettingEntity>().eq(SettingEntity::getSettingKey, key));

        if (existing != null) {
            existing.setSettingValue(value);
            existing.setUpdatedAt(LocalDateTime.now());
            settingMapper.updateById(existing);
        } else {
            SettingEntity entity = new SettingEntity();
            entity.setSettingKey(key);
            entity.setSettingValue(value);
            entity.setUpdatedAt(LocalDateTime.now());
            settingMapper.insert(entity);
        }
    }
}
