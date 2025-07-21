package org.dromara.basics.file.core.enums;

import cn.hutool.core.util.ArrayUtil;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.dromara.basics.file.core.client.FileClient;
import org.dromara.basics.file.core.client.FileClientConfig;
import org.dromara.basics.file.core.client.local.LocalFileClient;
import org.dromara.basics.file.core.client.local.LocalFileClientConfig;
import org.dromara.basics.file.core.client.sftp.SFTPFileClient;
import org.dromara.basics.file.core.client.sftp.SFTPFileClientConfig;
import org.dromara.basics.file.core.client.db.DBFileClient;
import org.dromara.basics.file.core.client.db.DBFileClientConfig;
import org.dromara.basics.file.core.client.ftp.FTPFileClient;
import org.dromara.basics.file.core.client.ftp.FTPFileClientConfig;
import org.dromara.basics.file.core.client.s3.S3FileClient;
import org.dromara.basics.file.core.client.s3.S3FileClientConfig;

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
