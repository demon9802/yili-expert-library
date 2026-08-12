package com.yili.expert.resource.service;

import com.yili.expert.resource.entity.ObservationOperationEntity;
import java.util.List;

public interface ObservationOperationService {
    List<ObservationOperationEntity> findByExpertId(Long expertId);
    ObservationOperationEntity create(ObservationOperationEntity entity);
}
