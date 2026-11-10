package xin.v5ai.basics.file.core.client.local;

import cn.hutool.core.io.FileUtil;
import xin.v5ai.basics.file.core.client.AbstractFileClient;
import xin.v5ai.basics.file.core.client.FileUploadResult;

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
        // 支持 ${user.home} / ${user.dir} 占位符，避免开发机和服务器路径写死
        String basePath = config.getBasePath()
            .replace("__USER_HOME__", System.getProperty("user.home", ""))
            .replace("${user.home}", System.getProperty("user.home", ""))
            .replace("${user.dir}", System.getProperty("user.dir", ""));
        // 补全风格。例如：Linux风格的路径是：/，Windows风格的路径是：\
        if (!basePath.endsWith(File.separator)) {
            basePath = basePath + File.separator;
        }
        config.setBasePath(basePath);
    }

    @Override
    public FileUploadResult upload(byte[] content, String path, String type) throws Exception {
        // 执行写入操作
        String filePath = getFilePath(path);
        File parent = FileUtil.file(filePath).getParentFile();
        if (parent != null) {
            FileUtil.mkdir(parent);
        }
        FileUtil.writeBytes(content, filePath);
        // 拼接返回路径
        return FileUploadResult.builder()
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
