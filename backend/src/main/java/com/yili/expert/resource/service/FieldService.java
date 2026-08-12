package com.yili.expert.resource.service;

import com.yili.expert.resource.dto.FieldDTO;
import java.util.List;

public interface FieldService {
    List<FieldDTO> findAll();
    FieldDTO create(FieldDTO dto);
    void update(String name, FieldDTO dto);
    void delete(String name);
}
