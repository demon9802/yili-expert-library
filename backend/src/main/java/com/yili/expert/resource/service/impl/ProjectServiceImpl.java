package com.yili.expert.resource.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.yili.expert.resource.dto.ProjectDTO;
import com.yili.expert.resource.entity.ProjectEntity;
import com.yili.expert.resource.mapper.ProjectMapper;
import com.yili.expert.resource.service.ProjectService;
import com.yili.expert.resource.utils.RequestContextUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
public class ProjectServiceImpl implements ProjectService {

    @Autowired
    private ProjectMapper projectMapper;

    @Override
    public List<ProjectDTO> findAll() {
        boolean isAdmin = RequestContextUtil.isAdmin();
        LambdaQueryWrapper<ProjectEntity> wrapper = new LambdaQueryWrapper<ProjectEntity>()
                .orderByDesc(ProjectEntity::getYear);
        if (!isAdmin) {
            wrapper.eq(ProjectEntity::getVisible, true);
        }
        List<ProjectEntity> entities = projectMapper.selectList(wrapper);
        List<ProjectDTO> result = new ArrayList<>();
        for (ProjectEntity e : entities) {
            result.add(entityToDTO(e));
        }
        return result;
    }

    @Override
    public ProjectDTO create(ProjectDTO dto) {
        ProjectEntity entity = dtoToEntity(dto);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        if (entity.getCreatedBy() == null || entity.getCreatedBy().isEmpty()) {
            String email = RequestContextUtil.getCurrentUserEmail();
            entity.setCreatedBy(email != null ? email : "主管理员");
        }
        projectMapper.insert(entity);
        return entityToDTO(entity);
    }

    @Override
    public ProjectDTO update(Long id, ProjectDTO dto) {
        ProjectEntity entity = dtoToEntity(dto);
        entity.setId(id);
        entity.setUpdatedAt(LocalDateTime.now());
        projectMapper.updateById(entity);
        return entityToDTO(projectMapper.selectById(id));
    }

    @Override
    public ProjectDTO upsert(ProjectDTO dto) {
        if (dto.getId() != null) {
            ProjectEntity existing = projectMapper.selectById(dto.getId());
            if (existing != null) {
                return update(dto.getId(), dto);
            }
        }
        return create(dto);
    }

    @Override
    public void delete(Long id) {
        projectMapper.deleteById(id);
    }

    private ProjectDTO entityToDTO(ProjectEntity e) {
        ProjectDTO dto = new ProjectDTO();
        dto.setId(e.getId());
        dto.setTitle(e.getTitle());
        dto.setExpertId(e.getExpertId());
        dto.setPendingExpertName(e.getPendingExpertName() != null ? e.getPendingExpertName() : "");
        dto.setYear(e.getYear());
        dto.setMonth(e.getMonth());
        dto.setSatisfaction(e.getSatisfaction());
        dto.setDesc(e.getDescription() != null ? e.getDescription() : "");
        dto.setVisible(e.getVisible() != null ? e.getVisible() : true);
        dto.setCreatedBy(e.getCreatedBy() != null ? e.getCreatedBy() : "主管理员");
        dto.setCreatedAt(e.getCreatedAt() != null ? e.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) : null);
        dto.setUpdatedAt(e.getUpdatedAt() != null ? e.getUpdatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) : null);
        return dto;
    }

    private ProjectEntity dtoToEntity(ProjectDTO dto) {
        ProjectEntity e = new ProjectEntity();
        e.setId(dto.getId());
        e.setTitle(dto.getTitle());
        e.setExpertId(dto.getExpertId());
        e.setPendingExpertName(dto.getPendingExpertName() != null ? dto.getPendingExpertName() : "");
        e.setYear(dto.getYear());
        e.setMonth(dto.getMonth());
        e.setSatisfaction(dto.getSatisfaction());
        e.setDescription(dto.getDesc() != null ? dto.getDesc() : "");
        e.setVisible(dto.getVisible() != null ? dto.getVisible() : true);
        e.setCreatedBy(dto.getCreatedBy());
        return e;
    }
}
