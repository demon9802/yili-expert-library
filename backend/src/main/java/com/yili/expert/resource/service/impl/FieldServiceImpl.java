package com.yili.expert.resource.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.yili.expert.resource.dto.FieldDTO;
import com.yili.expert.resource.entity.ExpertEntity;
import com.yili.expert.resource.entity.FieldEntity;
import com.yili.expert.resource.mapper.ExpertMapper;
import com.yili.expert.resource.mapper.FieldMapper;
import com.yili.expert.resource.service.FieldService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class FieldServiceImpl implements FieldService {

    @Autowired
    private FieldMapper fieldMapper;

    @Autowired
    private ExpertMapper expertMapper;

    @Override
    public List<FieldDTO> findAll() {
        List<FieldEntity> entities = fieldMapper.selectList(
                new LambdaQueryWrapper<FieldEntity>().orderByAsc(FieldEntity::getSortOrder));
        List<FieldDTO> result = new ArrayList<>();
        for (FieldEntity e : entities) {
            result.add(entityToDTO(e));
        }
        return result;
    }

    @Override
    public FieldDTO create(FieldDTO dto) {
        FieldEntity entity = new FieldEntity();
        entity.setName(dto.getName());
        entity.setColor(dto.getColor() != null ? dto.getColor() : "#2563EB");
        entity.setTextColor(dto.getTextColor() != null ? dto.getTextColor() : "#ffffff");
        entity.setHideWhenEmpty(dto.getHideWhenEmpty() != null ? dto.getHideWhenEmpty() : false);
        entity.setSortOrder(dto.getSortOrder() != null ? dto.getSortOrder() : 0);
        entity.setCreator(dto.getCreator());
        fieldMapper.insert(entity);
        return entityToDTO(entity);
    }

    @Override
    public void update(String name, FieldDTO dto) {
        FieldEntity existing = fieldMapper.selectOne(
                new LambdaQueryWrapper<FieldEntity>().eq(FieldEntity::getName, name));
        if (existing == null) return;

        // 支持改名：dto.name 与路径参数 name 不一致时视为改名（对齐 V5 改名级联专家）
        String newName = dto.getName();
        boolean renamed = newName != null && !newName.trim().isEmpty() && !newName.trim().equals(existing.getName());

        existing.setColor(dto.getColor());
        existing.setTextColor(dto.getTextColor());
        existing.setHideWhenEmpty(dto.getHideWhenEmpty());
        existing.setSortOrder(dto.getSortOrder() != null ? dto.getSortOrder() : 0);
        existing.setCreator(dto.getCreator());
        if (renamed) {
            existing.setName(newName.trim());
        }
        fieldMapper.updateById(existing);

        if (renamed) {
            cascadeRenameField(name, newName.trim());
        }
    }

    @Override
    public void delete(String name) {
        // 先清理所有专家身上的领域引用，避免脏数据（对齐 V5 删除级联）
        List<ExpertEntity> all = expertMapper.selectList(null);
        for (ExpertEntity e : all) {
            List<String> fs = e.getFields();
            if (fs != null && fs.contains(name)) {
                fs.removeIf(f -> f.equals(name));
                expertMapper.updateById(e);
            }
        }
        fieldMapper.delete(new LambdaQueryWrapper<FieldEntity>().eq(FieldEntity::getName, name));
    }

    private void cascadeRenameField(String oldName, String newName) {
        List<ExpertEntity> all = expertMapper.selectList(null);
        for (ExpertEntity e : all) {
            List<String> fs = e.getFields();
            if (fs != null && fs.contains(oldName)) {
                List<String> updated = new ArrayList<>();
                for (String f : fs) {
                    updated.add(f.equals(oldName) ? newName : f);
                }
                e.setFields(updated);
                expertMapper.updateById(e);
            }
        }
    }

    private FieldDTO entityToDTO(FieldEntity e) {
        FieldDTO dto = new FieldDTO();
        dto.setId(e.getId());
        dto.setName(e.getName());
        dto.setColor(e.getColor());
        dto.setTextColor(e.getTextColor() != null ? e.getTextColor() : "#ffffff");
        dto.setHideWhenEmpty(e.getHideWhenEmpty() != null ? e.getHideWhenEmpty() : false);
        dto.setSortOrder(e.getSortOrder() != null ? e.getSortOrder() : 0);
        dto.setCreator(e.getCreator());
        return dto;
    }
}
