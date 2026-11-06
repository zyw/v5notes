package xin.v5ai.basics.file.core.enums;

import cn.hutool.core.util.ArrayUtil;
import lombok.AllArgsConstructor;
import lombok.Getter;
import xin.v5ai.basics.file.core.client.FileClient;
import xin.v5ai.basics.file.core.client.FileClientConfig;
import xin.v5ai.basics.file.core.client.local.LocalFileClient;
import xin.v5ai.basics.file.core.client.local.LocalFileClientConfig;
import xin.v5ai.basics.file.core.client.sftp.SFTPFileClient;
import xin.v5ai.basics.file.core.client.sftp.SFTPFileClientConfig;
import xin.v5ai.basics.file.core.client.db.DBFileClient;
import xin.v5ai.basics.file.core.client.db.DBFileClientConfig;
import xin.v5ai.basics.file.core.client.ftp.FTPFileClient;
import xin.v5ai.basics.file.core.client.ftp.FTPFileClientConfig;
import xin.v5ai.basics.file.core.client.s3.S3FileClient;
import xin.v5ai.basics.file.core.client.s3.S3FileClientConfig;

/**
 * 文件存储类型枚举类
 * @author ZYW
 */
@Getter
@AllArgsConstructor
public enum FileStorageEnum {

    LOCAL(100, LocalFileClientConfig.class, LocalFileClient.class),
    DB(101, DBFileClientConfig.class, DBFileClient.class),
    FTP(102, FTPFileClientConfig.class, FTPFileClient.class),
    SFTP(103, SFTPFileClientConfig.class, SFTPFileClient.class),
    S3(104, S3FileClientConfig.class, S3FileClient.class)
    ;

    /**
     * 存储器
     */
    private final Integer storage;

    /**
     * 配置类
     */
    private final Class<? extends FileClientConfig> configClass;

    /**
     * 客户端类
     */
    private final Class<? extends FileClient> clientClass;

    public static FileStorageEnum getByStorage(Integer storage) {
        return ArrayUtil.firstMatch(o -> o.getStorage().equals(storage), values());
    }
}
