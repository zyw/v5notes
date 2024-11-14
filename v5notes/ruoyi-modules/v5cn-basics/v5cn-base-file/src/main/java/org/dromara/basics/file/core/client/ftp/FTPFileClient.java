package org.dromara.basics.file.core.client.ftp;

import cn.hutool.core.io.FileUtil;
import cn.hutool.core.util.CharsetUtil;
import cn.hutool.core.util.StrUtil;
import cn.hutool.extra.ftp.Ftp;
import cn.hutool.extra.ftp.FtpException;
import cn.hutool.extra.ftp.FtpMode;
import org.dromara.basics.file.core.client.AbstractFileClient;
import org.dromara.common.oss.entity.UploadResult;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;

/**
 * FTP 文件客户端
 *
 * @author 芋道源码
 */
public class FTPFileClient extends AbstractFileClient<FTPFileClientConfig> {

    private Ftp ftp;

    /**
     * 构造方法
     *
     * @param id     配置ID
     * @param config 配置信息
     */
    public FTPFileClient(Long id, FTPFileClientConfig config) {
        super(id, config);
    }

    @Override
    protected void doInit() {
        // 把配置的 \ 替换成 /,如果路径配置 \a\test,则替换成 /a/test, 替换方法已经处理 null 情况
        config.setBasePath(StrUtil.replace(config.getBasePath(), StrUtil.BACKSLASH, StrUtil.SLASH));
        // ftp的路径是 / 结尾
        if(!config.getBasePath().endsWith(StrUtil.SLASH)) {
            config.setBasePath(config.getBasePath() + StrUtil.SLASH);
        }
        // 初始化 FTP 对象
        ftp = new Ftp(config.getHost(), config.getPort(), config.getUsername(), config.getPassword(),
            CharsetUtil.CHARSET_UTF_8, null, null, FtpMode.valueOf(config.getMode()));
    }

    @Override
    public UploadResult upload(byte[] content, String path, String type) throws Exception {
        // 执行写入
        String filePath = getFilePath(path);
        String fileName = FileUtil.getName(filePath);
        String dir = StrUtil.removeSuffix(filePath, fileName);
        ftp.reconnectIfTimeout();
        boolean success = ftp.upload(dir, fileName, new ByteArrayInputStream(content));
        if (!success) {
            throw new FtpException(StrUtil.format("上传文件到目标目录 ({}) 失败", filePath));
        }
        // 拼接返回路径
        return UploadResult.builder()
            .url(super.formatFileUrl(config.getDomain(), path))
            .path(path)
            .build();
    }

    @Override
    public void delete(String path) throws Exception {
        String filePath = getFilePath(path);
        ftp.reconnectIfTimeout();
        ftp.delFile(filePath);
    }

    @Override
    public byte[] getContent(String path) throws Exception {
        String filePath = getFilePath(path);
        String fileName = FileUtil.getName(filePath);
        String dir = StrUtil.removeSuffix(filePath, fileName);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ftp.reconnectIfTimeout();
        ftp.download(dir, fileName, out);
        return out.toByteArray();
    }

    private String getFilePath(String path) {
        return config.getBasePath() + path;
    }
}
