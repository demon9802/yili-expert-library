package com.yili.expert.resource.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yili.expert.resource.dto.BulkScoreUpdateRequest;
import com.yili.expert.resource.dto.ExpertDTO;
import com.yili.expert.resource.entity.ExpertEntity;
import com.yili.expert.resource.mapper.ExpertMapper;
import com.yili.expert.resource.service.ExpertService;
import com.yili.expert.resource.utils.RequestContextUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class ExpertServiceImpl implements ExpertService {

    @Autowired
    private ExpertMapper expertMapper;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public List<ExpertDTO> findAll() {
        List<ExpertEntity> entities = expertMapper.selectList(
                new LambdaQueryWrapper<ExpertEntity>()
                        .orderByAsc(ExpertEntity::getSortOrder)
                        .orderByAsc(ExpertEntity::getId));
        List<ExpertDTO> result = new ArrayList<>();
        for (ExpertEntity e : entities) {
            result.add(entityToDTO(e));
        }
        return result;
    }

    @Override
    public ExpertDTO findById(Long id) {
        ExpertEntity e = expertMapper.selectById(id);
        return e != null ? entityToDTO(e) : null;
    }

    @Override
    public ExpertDTO create(ExpertDTO dto) {
        ExpertEntity entity = dtoToEntity(dto);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        if (entity.getCreatedBy() == null || entity.getCreatedBy().isEmpty()) {
            String email = RequestContextUtil.getCurrentUserEmail();
            entity.setCreatedBy(email != null ? email : "主管理员");
        }
        expertMapper.insert(entity);
        return entityToDTO(entity);
    }

    @Override
    public ExpertDTO update(Long id, ExpertDTO dto) {
        ExpertEntity entity = dtoToEntity(dto);
        entity.setId(id);
        entity.setUpdatedAt(LocalDateTime.now());
        expertMapper.updateById(entity);
        return entityToDTO(expertMapper.selectById(id));
    }

    @Override
    public ExpertDTO upsert(ExpertDTO dto) {
        if (dto.getId() != null) {
            ExpertEntity existing = expertMapper.selectById(dto.getId());
            if (existing != null) {
                return update(dto.getId(), dto);
            }
        }
        return create(dto);
    }

    @Override
    public void delete(Long id) {
        expertMapper.deleteById(id);
    }

    @Override
    public int bulkUpdateScores(List<BulkScoreUpdateRequest> requests) {
        int updated = 0;
        LocalDateTime now = LocalDateTime.now();
        for (BulkScoreUpdateRequest req : requests) {
            ExpertEntity e = expertMapper.selectById(req.getId());
            if (e == null) continue;
            try {
                Map<String, Object> scoresMap = new HashMap<>();
                if (req.getScores() != null) {
                    scoresMap.putAll(req.getScores());
                }
                e.setScores(objectMapper.writeValueAsString(scoresMap));
                e.setUpdatedAt(now);
                expertMapper.updateById(e);
                updated++;
            } catch (Exception ex) {
                // skip invalid entry
            }
        }
        return updated;
    }

    // ===== Data conversion: Entity ↔ DTO (matching original rowToExpert/expertToRow) =====

    @SuppressWarnings("unchecked")
    private ExpertDTO entityToDTO(ExpertEntity e) {
        ExpertDTO dto = new ExpertDTO();
        dto.setId(e.getId());
        dto.setName(e.getName());
        dto.setFields(e.getFields() != null ? e.getFields() : new ArrayList<>());
        dto.setAdvantages(e.getAdvantages() != null ? e.getAdvantages() : new ArrayList<>());
        dto.setEducation(e.getEducation() != null ? e.getEducation() : "");
        dto.setQualifications(e.getQualifications() != null ? e.getQualifications() : "");
        dto.setCourses(e.getCourses() != null ? e.getCourses() : "");
        dto.setContactPerson(e.getContactPerson() != null ? e.getContactPerson() : "");
        dto.setContactInfo(e.getContactInfo() != null ? e.getContactInfo() : "");
        dto.setContactType(e.getContactType() != null ? e.getContactType() : "phone");
        dto.setReferrer(e.getReferrer() != null ? e.getReferrer() : "");
        dto.setIsSupplier(e.getIsSupplier() != null ? e.getIsSupplier() : false);
        dto.setQualDisplay(e.getQualDisplay() != null ? e.getQualDisplay() : "");
        dto.setAdvDisplay(e.getAdvDisplay() != null ? e.getAdvDisplay() : "");

        // Parse scores JSON
        if (e.getScores() != null) {
            try {
                Map<String, Object> scores = objectMapper.readValue(e.getScores(), Map.class);
                dto.setScores(scores);
                if (scores.containsKey("subScores")) {
                    dto.setSubScores(scores.get("subScores"));
                }
            } catch (Exception ex) {
                Map<String, Object> def = new HashMap<>();
                def.put("professional", null);
                def.put("influence", null);
                def.put("overall", null);
                dto.setScores(def);
            }
        } else {
            Map<String, Object> def = new HashMap<>();
            def.put("professional", null);
            def.put("influence", null);
            def.put("overall", null);
            dto.setScores(def);
        }

        dto.setStatus(e.getStatus() != null ? e.getStatus() : "active");
        dto.setObservationStatus(e.getObservationStatus());
        dto.setObservationDate(e.getObservationDate());

        // Parse contacts JSON
        if (e.getContacts() != null) {
            try {
                dto.setContacts(objectMapper.readValue(e.getContacts(), List.class));
            } catch (Exception ex) {
                dto.setContacts(new ArrayList<>());
            }
        } else {
            dto.setContacts(new ArrayList<>());
        }

        dto.setCreatedBy(e.getCreatedBy() != null ? e.getCreatedBy() : "主管理员");
        dto.setCreatedAt(e.getCreatedAt() != null ? e.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) : null);
        dto.setUpdatedAt(e.getUpdatedAt() != null ? e.getUpdatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) : null);
        return dto;
    }

    @SuppressWarnings("unchecked")
    private ExpertEntity dtoToEntity(ExpertDTO dto) {
        ExpertEntity e = new ExpertEntity();
        e.setId(dto.getId());
        e.setName(dto.getName());
        e.setFields(dto.getFields() != null ? dto.getFields() : new ArrayList<>());
        e.setAdvantages(dto.getAdvantages() != null ? dto.getAdvantages() : new ArrayList<>());
        e.setEducation(dto.getEducation() != null ? dto.getEducation() : "");
        e.setQualifications(dto.getQualifications() != null ? dto.getQualifications() : "");
        e.setCourses(dto.getCourses() != null ? dto.getCourses() : "");
        e.setContactPerson(dto.getContactPerson() != null ? dto.getContactPerson() : "");
        e.setContactInfo(dto.getContactInfo() != null ? dto.getContactInfo() : "");
        e.setContactType(dto.getContactType() != null ? dto.getContactType() : "phone");
        e.setReferrer(dto.getReferrer() != null ? dto.getReferrer() : "");
        e.setIsSupplier(dto.getIsSupplier() != null ? dto.getIsSupplier() : false);
        e.setQualDisplay(dto.getQualDisplay() != null ? dto.getQualDisplay() : "");
        e.setAdvDisplay(dto.getAdvDisplay() != null ? dto.getAdvDisplay() : "");

        // Serialize scores (merge subScores into scores)
        try {
            Map<String, Object> scoresMap = new HashMap<>();
            if (dto.getScores() instanceof Map) {
                scoresMap = new HashMap<>((Map<String, Object>) dto.getScores());
            }
            if (dto.getSubScores() != null) {
                scoresMap.put("subScores", dto.getSubScores());
            }
            if (!scoresMap.isEmpty()) {
                e.setScores(objectMapper.writeValueAsString(scoresMap));
            }
        } catch (Exception ex) {
            // ignore
        }

        e.setStatus(dto.getStatus() != null ? dto.getStatus() : "active");
        e.setObservationStatus(dto.getObservationStatus());
        e.setObservationDate(dto.getObservationDate());

        // Serialize contacts
        try {
            if (dto.getContacts() != null && !dto.getContacts().isEmpty()) {
                e.setContacts(objectMapper.writeValueAsString(dto.getContacts()));
            }
        } catch (Exception ex) {
            // ignore
        }

        e.setCreatedBy(dto.getCreatedBy());
        return e;
    }
}
