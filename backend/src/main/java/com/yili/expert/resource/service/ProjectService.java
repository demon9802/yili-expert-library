package com.yili.expert.resource.service;

import com.yili.expert.resource.dto.ProjectDTO;
import java.util.List;

public interface ProjectService {
    List<ProjectDTO> findAll();
    ProjectDTO create(ProjectDTO dto);
    ProjectDTO update(Long id, ProjectDTO dto);
    ProjectDTO upsert(ProjectDTO dto);
    void delete(Long id);
}
