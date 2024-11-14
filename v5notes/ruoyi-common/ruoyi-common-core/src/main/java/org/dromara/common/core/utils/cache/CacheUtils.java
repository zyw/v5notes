package org.dromara.common.core.utils.cache;

import cn.hutool.core.thread.ExecutorBuilder;
import com.alibaba.ttl.threadpool.TtlExecutors;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import lombok.extern.slf4j.Slf4j;

import java.time.Duration;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * Cache 工具类
 *
 * @author 芋道源码
 */
@Slf4j
public class CacheUtils {

    public static <K, V> LoadingCache<K, V> buildAsyncReloadingCache(Duration duration, CacheLoader<K, V> loader) {
//        Executor executor = Executors.newCachedThreadPool(  // TODO 芋艿：可能要思考下，未来要不要做成可配置
//                TtlExecutors.getDefaultDisableInheritableThreadFactory()); // TTL 保证 ThreadLocal 可以透传

        // 使用hutool的ExecutorBuilder来构建线程池
        ThreadPoolExecutor executor = ExecutorBuilder.create()
            .setCorePoolSize(5)
            .setMaxPoolSize(10)
            .setThreadFactory(TtlExecutors.getDefaultDisableInheritableThreadFactory())
            .setWorkQueue(new LinkedBlockingQueue<>(100))
            .build();
        return CacheBuilder.newBuilder()
                // 只阻塞当前数据加载线程，其他线程返回旧值
                .refreshAfterWrite(duration)
                //移除监听器
                .removalListener(notification ->
                    log.info("CacheBuilder.removalListener [" + notification.getKey() + ":" + notification.getValue() + "---" + notification.getCause() +  "] is evicted!"))
                // 通过 asyncReloading 实现全异步加载，包括 refreshAfterWrite 被阻塞的加载线程
                .build(CacheLoader.asyncReloading(loader, executor));
    }
}
