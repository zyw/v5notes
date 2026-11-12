package xin.v5ai.web.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;
import xin.v5ai.common.core.constant.CacheNames;

/**
 * 设备类型和客户端配置会决定谁能登录。迁移改库后清掉这两处缓存，避免继续用旧的 pc / pc_client。
 */
@Slf4j
@Component
public class ClientAuthCacheRefresher implements ApplicationRunner {

    private final CacheManager cacheManager;

    public ClientAuthCacheRefresher(CacheManager cacheManager) {
        this.cacheManager = cacheManager;
    }

    @Override
    public void run(ApplicationArguments args) {
        clear(CacheNames.SYS_CLIENT);
        Cache dictCache = cacheManager.getCache(CacheNames.SYS_DICT);
        if (dictCache != null) {
            dictCache.evict("sys_device_type");
        }
        log.info("已刷新客户端与设备类型缓存");
    }

    private void clear(String cacheName) {
        Cache cache = cacheManager.getCache(cacheName);
        if (cache != null) {
            cache.clear();
        }
    }
}
