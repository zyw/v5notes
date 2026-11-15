package xin.v5ai.basics.file.core.client.sftp;

import cn.hutool.core.io.FileUtil;
import cn.hutool.extra.ssh.Sftp;
import xin.v5ai.basics.file.core.client.AbstractFileClient;
import xin.v5ai.basics.file.core.client.FileUploadResult;

import java.io.File;

/**
 * Sftp 文件客户端
 *
 * @author 芋道源码
 */
public class SFTPFileClient extends AbstractFileClient<SFTPFileClientConfig> {

    private Sftp sftp;
    /**
     * 构造方法
     *
     * @param id     配置ID
     * @param config 配置信息
     */
    public SFTPFileClient(Long id, SFTPFileClientConfig config) {
        super(id, config);
    }

    @Override
    protected void doInit() {
        // 远端路径统一用 /，避免 Windows 分隔符污染 SFTP 路径
        String basePath = config.getBasePath().replace('\\', '/');
        if (!basePath.endsWith("/")) {
            basePath = basePath + "/";
        }
        config.setBasePath(basePath);
        // 初始化 SFTP 对象（SSH 协议，通常端口 22，与 FTPS/21 不同）
        this.sftp = new Sftp(config.getHost(), config.getPort(), config.getUsername(), config.getPassword());
    }

    @Override
    public FileUploadResult upload(byte[] content, String path, String type) throws Exception {
        // 执行写入
        String filePath = getFilePath(path);
        File file = File.createTempFile("basics-sftp-upload-", ".tmp");
        try {
            FileUtil.writeBytes(content, file);
            sftp.upload(filePath, file);
        } finally {
            FileUtil.del(file);
        }
        // 拼接返回路径
        return FileUploadResult.builder()
            .url(super.formatFileUrl(config.getDomain(), path))
            .path(path)
            .build();
    }

    @Override
    public void delete(String path) throws Exception {
        String filePath = getFilePath(path);
        sftp.delFile(filePath);
    }

    @Override
    public byte[] getContent(String path) throws Exception {
        String filePath = getFilePath(path);
        File destFile = File.createTempFile("basics-sftp-download-", ".tmp");
        try {
            sftp.download(filePath, destFile);
            return FileUtil.readBytes(destFile);
        } finally {
            FileUtil.del(destFile);
        }
    }

    private String getFilePath(String path) {
        return config.getBasePath() + path;
    }
}
