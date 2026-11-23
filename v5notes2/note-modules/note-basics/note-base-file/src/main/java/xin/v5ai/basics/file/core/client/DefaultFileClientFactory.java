package xin.v5ai.basics.file.core.client;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.lang.Assert;
import lombok.extern.slf4j.Slf4j;
import xin.v5ai.basics.file.core.client.db.DBFileClient;
import xin.v5ai.basics.file.core.client.db.DBFileClientConfig;
import xin.v5ai.basics.file.core.client.ftp.FTPFileClient;
import xin.v5ai.basics.file.core.client.ftp.FTPFileClientConfig;
import xin.v5ai.basics.file.core.client.local.LocalFileClient;
import xin.v5ai.basics.file.core.client.local.LocalFileClientConfig;
import xin.v5ai.basics.file.core.client.s3.S3FileClient;
import xin.v5ai.basics.file.core.client.s3.S3FileClientConfig;
import xin.v5ai.basics.file.core.client.sftp.SFTPFileClient;
import xin.v5ai.basics.file.core.client.sftp.SFTPFileClientConfig;
import xin.v5ai.basics.file.core.enums.FileStorageEnum;

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
        FileStorageEnum storageEnum = FileStorageEnum.getByStorage(storage);
        Assert.notNull(storageEnum, String.format("文件配置(%s) 为空", storage));
        C typedConfig = (C) castConfig(config, storageEnum.getConfigClass());

        AbstractFileClient<C> client = (AbstractFileClient<C>) clients.get(configId);
        if (client == null) {
            client = createFileClient(configId, storageEnum, typedConfig);
            client.init();
            clients.put(configId, client);
        } else {
            client.refresh(typedConfig);
        }
    }

    @Override
    public void removeFileClient(Long configId) {
        AbstractFileClient<?> client = clients.remove(configId);
        if (client != null) {
            // Pooled clients keep live connections; dropping the map entry alone would strand them.
            try {
                client.destroy();
            } catch (Exception ex) {
                log.warn("[removeFileClient][释放客户端失败 configId={}] {}", configId, ex.getMessage());
            }
        }
    }

    @SuppressWarnings("unchecked")
    private <C extends FileClientConfig> AbstractFileClient<C> createFileClient(
        Long configId, FileStorageEnum storageEnum, C config) {
        // 显式创建，避免 ReflectUtil 按 Class 精确匹配构造器失败（例如 ClassLoader 不一致）
        return switch (storageEnum) {
            case LOCAL -> (AbstractFileClient<C>) new LocalFileClient(configId, (LocalFileClientConfig) config);
            case DB -> (AbstractFileClient<C>) new DBFileClient(configId, (DBFileClientConfig) config);
            case FTP -> (AbstractFileClient<C>) new FTPFileClient(configId, (FTPFileClientConfig) config);
            case SFTP -> (AbstractFileClient<C>) new SFTPFileClient(configId, (SFTPFileClientConfig) config);
            case S3 -> (AbstractFileClient<C>) new S3FileClient(configId, (S3FileClientConfig) config);
        };
    }

    private static <T extends FileClientConfig> T castConfig(FileClientConfig config, Class<T> configClass) {
        Assert.notNull(config, "文件配置不能为空");
        if (configClass.isInstance(config)) {
            return configClass.cast(config);
        }
        // 运行时类型不符（常见于 ClassLoader 不一致）时，复制为当前 ClassLoader 下的配置实例
        T typed = BeanUtil.toBean(config, configClass);
        Assert.notNull(typed, "文件配置转换失败: " + configClass.getName());
        return typed;
    }
}
