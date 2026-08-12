package com.yili.expert.resource.service;

public interface SettingService {
    String get(String key);
    void save(String key, String value);
}
