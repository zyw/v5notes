package org.dromara.basics.file.core.client;

import cn.hutool.core.lang.Assert;
import cn.hutool.core.util.ReflectUtil;
import lombok.extern.slf4j.Slf4j;
import org.dromara.basics.file.core.enums.FileStorageEnum;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * 文件客户端的工厂实现类
 *
 * @author 芋道源码
 */
@Slf4j
public class DefaultFileClientFactory implements FileClientFactory {

    /**
     * 文件客户端缓存 Map
     * key: 配置 ID
     */
    private final ConcurrentMap<Long, AbstractFileClient<?>> clients = new ConcurrentHashMap<>();

    @Override
    public FileClient getFileClient(Long configId) {
        AbstractFileClient<?> client = clients.get(configId);
        if (client == null) {
            log.error("[getFileClient][配置编号({}) 找不到客户端]", configId);
        }
        return client;
    }

    @Override
    @SuppressWarnings("unchecked")
    public <C extends FileClientConfig> void createOrUpdateFileClient(Long configId, Integer storage, C config) {
        AbstractFileClient<C> client = (AbstractFileClient<C>)clients.get(configId);
        if (client == null) {
            client = createFileClient(configId, storage, config);
            client.init();
            clients.put(configId, client);
        } else {
            client.refresh(config);
        }
    }

    @SuppressWarnings("unchecked")
    private <C extends FileClientConfig> AbstractFileClient<C> createFileClient(
        Long configId, Integer storage, C config) {
        FileStorageEnum storageEnum = FileStorageEnum.getByStorage(storage);
        Assert.notNull(storageEnum, String.format("文件配置(%s) 为空", storage));
        // 创建客户端
        return (AbstractFileClient<C>) ReflectUtil.newInstance(storageEnum.getClientClass(), configId, config);
    }
}
