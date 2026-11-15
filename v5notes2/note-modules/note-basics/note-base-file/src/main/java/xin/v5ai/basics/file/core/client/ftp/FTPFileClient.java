package xin.v5ai.basics.file.core.client.ftp;

import cn.hutool.core.io.FileUtil;
import cn.hutool.core.util.StrUtil;
import cn.hutool.extra.ftp.FtpException;
import cn.hutool.extra.ftp.FtpMode;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.net.ftp.FTP;
import org.apache.commons.net.ftp.FTPClient;
import org.apache.commons.net.ftp.FTPReply;
import org.apache.commons.net.ftp.FTPSClient;
import org.apache.commons.net.util.TrustManagerUtils;
import xin.v5ai.basics.file.core.client.AbstractFileClient;
import xin.v5ai.basics.file.core.client.FileUploadResult;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

/**
 * FTP / FTPS 文件客户端。
 * <p>直接使用 Apache Commons Net。控制连接字符集必须在 connect 之前设置，
 * 否则中文路径会变成 ???? 并触发 550。</p>
 *
 * @author 芋道源码
 */
@Slf4j
public class FTPFileClient extends AbstractFileClient<FTPFileClientConfig> {

    private static final int CONNECT_TIMEOUT_MS = 10_000;
    private static final int SO_TIMEOUT_MS = 30_000;

    private FTPClient client;

    public FTPFileClient(Long id, FTPFileClientConfig config) {
        super(id, config);
    }

    @Override
    protected void doInit() {
        config.setBasePath(normalizeDir(config.getBasePath()));

        FtpMode mode = resolveMode();
        String charset = resolveCharset();
        try {
            this.client = Boolean.TRUE.equals(config.getSslEnable()) ? connectFtps(charset) : connectFtp(charset);
            applyTransferMode(mode);
            enableUtf8IfNeeded(charset);
            client.setFileType(FTP.BINARY_FILE_TYPE);

            String pwd = client.printWorkingDirectory();
            log.info("[doInit][FTP 登录成功 pwd={} basePath={} mode={} ssl={} charset={} reply={}]",
                pwd, config.getBasePath(), mode, config.getSslEnable(), charset, compactReply());

            if (!changeWorkingDirectory(config.getBasePath())) {
                String hint = containsNonAscii(config.getBasePath())
                    ? "路径含中文时请确认字符集（UTF-8/GBK）与 NAS 一致；reply 出现 ???? 基本是编码问题。"
                    : "若账号已在 NAS 绑定存储目录，请按 FTP 客户端可见路径填写，例如 /共享目录/v5notes_attach/";
                throw new FtpException(StrUtil.format(
                    "无法进入基础路径 [{}]，当前 FTP 工作目录为 [{}]，charset={}，reply={}。{}",
                    config.getBasePath(), pwd, charset, compactReply(), hint));
            }
            changeWorkingDirectory(StrUtil.blankToDefault(pwd, "/"));
        } catch (IOException ex) {
            disconnectQuietly();
            throw new FtpException(StrUtil.format("FTP 初始化失败: {}:{} , {}",
                config.getHost(), config.getPort(), ex.getMessage()), ex);
        }
    }

    private FtpMode resolveMode() {
        FtpMode mode = FtpMode.valueOf(config.getMode());
        if (Boolean.TRUE.equals(config.getSslEnable()) && mode == FtpMode.Active) {
            log.warn("[doInit][FTPS 下 Active 模式不稳定，已强制改为 Passive]");
            mode = FtpMode.Passive;
            config.setMode(FtpMode.Passive.name());
        }
        return mode;
    }

    private String resolveCharset() {
        String charset = StrUtil.blankToDefault(config.getCharset(), "UTF-8").trim();
        // 校验合法性，非法时回退 UTF-8
        try {
            Charset.forName(charset);
            return charset;
        } catch (Exception ex) {
            log.warn("[resolveCharset][非法字符集 {}，回退 UTF-8]", charset);
            return "UTF-8";
        }
    }

    private FTPClient connectFtp(String charset) throws IOException {
        FTPClient ftpClient = new FTPClient();
        // 必须在 connect 前设置，否则中文路径按 ISO-8859-1 发出变成 ????
        ftpClient.setControlEncoding(charset);
        ftpClient.setDefaultTimeout(CONNECT_TIMEOUT_MS);
        ftpClient.setConnectTimeout(CONNECT_TIMEOUT_MS);
        ftpClient.connect(config.getHost(), config.getPort());
        ftpClient.setSoTimeout(SO_TIMEOUT_MS);
        assertConnected(ftpClient);
        if (!ftpClient.login(config.getUsername(), config.getPassword())) {
            throw new FtpException(StrUtil.format("FTP 登录失败: {}:{} , reply={}",
                config.getHost(), config.getPort(), StrUtil.trim(ftpClient.getReplyString())));
        }
        return ftpClient;
    }

    private FTPSClient connectFtps(String charset) throws IOException {
        FTPSClient ftpsClient = new FTPSClient(false);
        ftpsClient.setControlEncoding(charset);
        ftpsClient.setTrustManager(TrustManagerUtils.getAcceptAllTrustManager());
        ftpsClient.setDefaultTimeout(CONNECT_TIMEOUT_MS);
        ftpsClient.setConnectTimeout(CONNECT_TIMEOUT_MS);
        ftpsClient.connect(config.getHost(), config.getPort());
        ftpsClient.setSoTimeout(SO_TIMEOUT_MS);
        assertConnected(ftpsClient);
        if (!ftpsClient.login(config.getUsername(), config.getPassword())) {
            throw new FtpException(StrUtil.format("FTPS 登录失败: {}:{} , reply={}",
                config.getHost(), config.getPort(), StrUtil.trim(ftpsClient.getReplyString())));
        }
        ftpsClient.execPBSZ(0);
        ftpsClient.execPROT("P");
        log.info("[connectFtps][FTPS 连接成功 host={} port={} charset={}]",
            config.getHost(), config.getPort(), charset);
        return ftpsClient;
    }

    private void enableUtf8IfNeeded(String charset) {
        if (!StandardCharsets.UTF_8.name().equalsIgnoreCase(charset)) {
            return;
        }
        try {
            // 部分 NAS 需要显式打开 UTF-8，才能正确处理中文目录名
            int reply = client.sendCommand("OPTS", "UTF8 ON");
            log.info("[enableUtf8IfNeeded][OPTS UTF8 ON reply={} {}]", reply, compactReply());
        } catch (IOException ex) {
            log.warn("[enableUtf8IfNeeded][OPTS UTF8 ON 失败，继续使用控制连接编码] {}", ex.getMessage());
        }
    }

    private void applyTransferMode(FtpMode mode) {
        if (mode == FtpMode.Passive) {
            client.enterLocalPassiveMode();
        } else {
            client.enterLocalActiveMode();
        }
    }

    @Override
    public FileUploadResult upload(byte[] content, String path, String type) throws Exception {
        String filePath = getFilePath(path);
        String fileName = FileUtil.getName(filePath);
        String dir = normalizeDir(StrUtil.removeSuffix(filePath, fileName));

        reconnectIfNeeded();
        String pwd = client.printWorkingDirectory();
        try {
            ensureDirectory(dir);
            if (!changeWorkingDirectory(dir)) {
                throw new FtpException(StrUtil.format(
                    "切换到上传目录失败 [{}]，pwd=[{}]，reply={}",
                    dir, client.printWorkingDirectory(), compactReply()));
            }
            try (InputStream in = new ByteArrayInputStream(content)) {
                boolean success = client.storeFile(fileName, in);
                if (!success) {
                    throw new FtpException(StrUtil.format(
                        "上传文件失败 path={} reply={}", filePath, compactReply()));
                }
            }
            log.info("[upload][上传成功 path={} size={}]", filePath, content.length);
        } finally {
            changeWorkingDirectory(StrUtil.blankToDefault(pwd, "/"));
        }

        return FileUploadResult.builder()
            .url(super.formatFileUrl(config.getDomain(), path))
            .path(path)
            .build();
    }

    private void ensureDirectory(String dir) throws IOException {
        String normalized = StrUtil.removeSuffix(normalizeDir(dir), "/");
        if (StrUtil.isBlank(normalized) || "/".equals(normalized)) {
            return;
        }
        if (changeWorkingDirectory(normalized + "/")) {
            return;
        }

        String pwd = client.printWorkingDirectory();
        try {
            if (!changeWorkingDirectory("/")) {
                throw new FtpException("无法切换到 FTP 根目录 / ，reply=" + compactReply());
            }
            for (String part : normalized.split("/")) {
                if (StrUtil.isBlank(part)) {
                    continue;
                }
                if (changeWorkingDirectory(part)) {
                    continue;
                }
                boolean created = client.makeDirectory(part);
                if (!changeWorkingDirectory(part)) {
                    throw new FtpException(StrUtil.format(
                        "创建目录 [{}] 失败，目标 [{}]，pwd=[{}]，created={}，reply={}",
                        part, normalized, client.printWorkingDirectory(), created, compactReply()));
                }
            }
        } finally {
            changeWorkingDirectory(StrUtil.blankToDefault(pwd, "/"));
        }
    }

    @Override
    public void delete(String path) throws Exception {
        String filePath = getFilePath(path);
        reconnectIfNeeded();
        if (!client.deleteFile(filePath) && !client.deleteFile(StrUtil.removePrefix(filePath, "/"))) {
            throw new FtpException(StrUtil.format("删除文件失败 path={} reply={}", filePath, compactReply()));
        }
    }

    @Override
    public byte[] getContent(String path) throws Exception {
        String filePath = getFilePath(path);
        String fileName = FileUtil.getName(filePath);
        String dir = normalizeDir(StrUtil.removeSuffix(filePath, fileName));
        reconnectIfNeeded();
        String pwd = client.printWorkingDirectory();
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (!changeWorkingDirectory(dir)) {
                throw new FtpException(StrUtil.format("下载时无法进入目录 [{}]，reply={}", dir, compactReply()));
            }
            if (!client.retrieveFile(fileName, out)) {
                throw new FtpException(StrUtil.format("下载文件失败 path={} reply={}", filePath, compactReply()));
            }
            return out.toByteArray();
        } finally {
            changeWorkingDirectory(StrUtil.blankToDefault(pwd, "/"));
        }
    }

    private void reconnectIfNeeded() throws IOException {
        try {
            if (client != null && client.isConnected() && client.sendNoOp()) {
                applyTransferMode(resolveMode());
                return;
            }
        } catch (IOException ex) {
            log.warn("[reconnectIfNeeded][连接不可用，准备重连] {}", ex.getMessage());
        }
        disconnectQuietly();
        doInit();
    }

    private boolean changeWorkingDirectory(String dir) throws IOException {
        if (StrUtil.isBlank(dir)) {
            return true;
        }
        return client.changeWorkingDirectory(dir);
    }

    private String normalizeDir(String path) {
        String normalized = StrUtil.replace(StrUtil.blankToDefault(path, "/"), StrUtil.BACKSLASH, StrUtil.SLASH);
        if (!normalized.startsWith("/")) {
            normalized = "/" + normalized;
        }
        if (!normalized.endsWith("/")) {
            normalized = normalized + "/";
        }
        while (normalized.contains("//")) {
            normalized = normalized.replace("//", "/");
        }
        return normalized;
    }

    private String getFilePath(String path) {
        String relative = StrUtil.removePrefix(StrUtil.replace(path, StrUtil.BACKSLASH, StrUtil.SLASH), "/");
        return config.getBasePath() + relative;
    }

    private boolean containsNonAscii(String text) {
        if (text == null) {
            return false;
        }
        for (int i = 0; i < text.length(); i++) {
            if (text.charAt(i) > 127) {
                return true;
            }
        }
        return false;
    }

    private void assertConnected(FTPClient ftpClient) throws IOException {
        int reply = ftpClient.getReplyCode();
        if (!FTPReply.isPositiveCompletion(reply)) {
            String replyText = StrUtil.trim(ftpClient.getReplyString());
            ftpClient.disconnect();
            throw new FtpException(StrUtil.format("FTP 连接被拒绝 reply={}", replyText));
        }
    }

    private String compactReply() {
        if (client == null) {
            return "";
        }
        return StrUtil.trim(StrUtil.blankToDefault(client.getReplyString(), String.valueOf(client.getReplyCode())));
    }

    private void disconnectQuietly() {
        if (client == null) {
            return;
        }
        try {
            if (client.isConnected()) {
                try {
                    client.logout();
                } catch (IOException ignored) {
                    // ignore
                }
                client.disconnect();
            }
        } catch (IOException ignored) {
            // ignore
        } finally {
            client = null;
        }
    }
}
