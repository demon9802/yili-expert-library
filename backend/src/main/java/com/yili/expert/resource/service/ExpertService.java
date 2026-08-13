package com.yili.expert.resource.service;

import com.yili.expert.resource.dto.BulkScoreUpdateRequest;
import com.yili.expert.resource.dto.ExpertDTO;
import java.util.List;

public interface ExpertService {
    List<ExpertDTO> findAll();
    ExpertDTO findById(Long id);
    ExpertDTO create(ExpertDTO dto);
    ExpertDTO update(Long id, ExpertDTO dto);
    ExpertDTO upsert(ExpertDTO dto);
    void delete(Long id);
    int bulkUpdateScores(List<BulkScoreUpdateRequest> requests);
}
