package org.dromara.basics.file.core.client;

import org.dromara.basics.file.core.enums.FileStorageEnum;

/**
 * @author ZYW
 */
public interface FileClientFactory {
    /**
     * 获得文件客户端
     * @param configId 配置ID
     * @return 文件客户端
     */
    FileClient getFileClient(Long configId);

    /**
     * 创建文件客户端
     *
     * @param configId 配置ID
     * @param storage 存储器的枚举 {@link FileStorageEnum}
     * @param config 文件配置
     */
    <C extends FileClientConfig> void createOrUpdateFileClient(Long configId, Integer storage, C config);
}
