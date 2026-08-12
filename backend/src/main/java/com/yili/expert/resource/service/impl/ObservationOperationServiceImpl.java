package com.yili.expert.resource.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.yili.expert.resource.entity.ObservationOperationEntity;
import com.yili.expert.resource.mapper.ObservationOperationMapper;
import com.yili.expert.resource.service.ObservationOperationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ObservationOperationServiceImpl implements ObservationOperationService {

    @Autowired
    private ObservationOperationMapper observationOperationMapper;

    @Override
    public List<ObservationOperationEntity> findByExpertId(Long expertId) {
        LambdaQueryWrapper<ObservationOperationEntity> wrapper =
                new LambdaQueryWrapper<ObservationOperationEntity>()
                        .orderByDesc(ObservationOperationEntity::getCreatedAt);
        if (expertId != null) {
            wrapper.eq(ObservationOperationEntity::getExpertId, expertId);
        }
        return observationOperationMapper.selectList(wrapper);
    }

    @Override
    public ObservationOperationEntity create(ObservationOperationEntity entity) {
        observationOperationMapper.insert(entity);
        return entity;
    }
}
