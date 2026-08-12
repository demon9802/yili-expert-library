package com.yili.expert.resource.service;

import java.util.List;

public interface FavoriteService {
    List<Long> findFavorites();
    boolean addFavorite(Long expertId);
    boolean removeFavorite(Long expertId);
    boolean isFavorite(Long expertId);
}
