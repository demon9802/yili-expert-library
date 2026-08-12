package com.yili.expert.resource;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 伊利专家资源库 V6 - Spring Boot 后端主应用
 */
@SpringBootApplication
@MapperScan("com.yili.expert.resource.mapper")
@EnableAsync
@EnableScheduling
public class ExpertResourceApplication {

    public static void main(String[] args) {
        SpringApplication.run(ExpertResourceApplication.class, args);
    }
}
