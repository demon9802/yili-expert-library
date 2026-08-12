package com.yili.expert.resource.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.yili.expert.resource.entity.UserEntity;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserMapper extends BaseMapper<UserEntity> {
}
