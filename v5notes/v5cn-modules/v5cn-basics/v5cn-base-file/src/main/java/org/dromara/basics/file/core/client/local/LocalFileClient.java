package org.dromara.basics.file.core.client.local;

import cn.hutool.core.io.FileUtil;
import org.dromara.basics.file.core.client.AbstractFileClient;
import org.dromara.common.oss.entity.UploadResult;

import java.io.File;

/**
 * 本地文件存储客户端
 * @author ZYW
 */
public class LocalFileClient extends AbstractFileClient<LocalFileClientConfig> {

    public LocalFileClient(Long id,LocalFileClientConfig config) {
        super(id,config);
    }

    @Override
    protected void doInit() {
        // 补全风格。例如：Linux风格的路径是：/，，Windows风格的路径是：\
        if (!config.getBasePath().endsWith(File.separator)) {
            config.setBasePath(config.getBasePath() + File.separator);
        }
    }

    @Override
    public UploadResult upload(byte[] content, String path, String type) throws Exception {
        // 执行写入操作
        String filePath = getFilePath(path);
        FileUtil.writeBytes(content, filePath);
        // 拼接返回路径
        return UploadResult.builder()
            .url(super.formatFileUrl(config.getDomain(), path))
            .path(path)
            .build();
    }

    @Override
    public void delete(String path) throws Exception {
        String filePath = getFilePath(path);
        FileUtil.del(filePath);
    }

    @Override
    public byte[] getContent(String path) throws Exception {
        String filePath = getFilePath(path);
        return FileUtil.readBytes(filePath);
    }

    private String getFilePath(String path) {
        return config.getBasePath() + path;
    }
}
