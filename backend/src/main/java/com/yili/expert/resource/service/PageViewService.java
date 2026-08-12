package com.yili.expert.resource.service;

import java.util.Map;

public interface PageViewService {
    void recordView();
    Map<String, Object> getMonthlyStats();
}
