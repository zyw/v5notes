package xin.v5ai.basics.file.core.client.ftp;

import cn.hutool.core.util.StrUtil;
import cn.hutool.extra.ftp.FtpException;
import cn.hutool.extra.ftp.FtpMode;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.net.ftp.FTP;
import org.apache.commons.net.ftp.FTPClient;
import org.apache.commons.net.ftp.FTPReply;
import org.apache.commons.net.ftp.FTPSClient;
import org.apache.commons.net.util.TrustManagerUtils;
import org.apache.commons.pool2.BasePooledObjectFactory;
import org.apache.commons.pool2.PooledObject;
import org.apache.commons.pool2.impl.DefaultPooledObject;

import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

/**
 * Creates and validates the FTP connections held by the pool (design T1).
 *
 * <p>Connection state that used to live in {@code FTPFileClient.doInit()} now happens here, once
 * per pooled connection: charset-before-connect, login, FTPS handshake, UTF-8 negotiation, binary
 * mode and the base-path reachability check.</p>
 */
@Slf4j
final class FTPConnectionFactory extends BasePooledObjectFactory<FTPClient> {

    static final int CONNECT_TIMEOUT_MS = 10_000;
    static final int SO_TIMEOUT_MS = 30_000;

    private final FTPFileClientConfig config;
    private final FtpMode mode;
    private final String charset;

    FTPConnectionFactory(FTPFileClientConfig config) {
        this.config = config;
        this.mode = resolveMode(config);
        this.charset = resolveCharset(config);
    }

    /**
     * FTPS with Active mode is known to hang against several NAS boxes, so the mode is forced to
     * Passive. The adjustment is local: writing it back onto the shared config object would make
     * concurrent readers observe different values.
     */
    static FtpMode resolveMode(FTPFileClientConfig config) {
        FtpMode mode = FtpMode.valueOf(config.getMode());
        if (Boolean.TRUE.equals(config.getSslEnable()) && mode == FtpMode.Active) {
            log.warn("[resolveMode][FTPS 下 Active 模式不稳定，本次连接使用 Passive]");
            return FtpMode.Passive;
        }
        return mode;
    }

    static String resolveCharset(FTPFileClientConfig config) {
        String charset = StrUtil.blankToDefault(config.getCharset(), "UTF-8").trim();
        try {
            Charset.forName(charset);
            return charset;
        } catch (Exception ex) {
            log.warn("[resolveCharset][非法字符集 {}，回退 UTF-8]", charset);
            return "UTF-8";
        }
    }

    FtpMode mode() {
        return mode;
    }

    @Override
    public FTPClient create() throws Exception {
        FTPClient client = Boolean.TRUE.equals(config.getSslEnable()) ? connectFtps() : connectFtp();
        try {
            applyTransferMode(client);
            enableUtf8IfNeeded(client);
            client.setFileType(FTP.BINARY_FILE_TYPE);
            assertBasePathReachable(client);
            return client;
        } catch (Exception ex) {
            disconnect(client);
            throw ex;
        }
    }

    @Override
    public PooledObject<FTPClient> wrap(FTPClient client) {
        return new DefaultPooledObject<>(client);
    }

    /**
     * Liveness probe. A pooled connection can be dropped by the NAS idle timeout, and a silently
     * returning {@code true} here turns the next real upload into a confusing failure, so the
     * reply code is checked rather than just {@code isConnected()}.
     */
    @Override
    public boolean validateObject(PooledObject<FTPClient> pooled) {
        FTPClient client = pooled.getObject();
        try {
            return client.isConnected() && client.sendNoOp() && FTPReply.isPositiveCompletion(client.getReplyCode());
        } catch (Exception ex) {
            log.debug("[validateObject][连接探活失败] {}", ex.getMessage());
            return false;
        }
    }

    @Override
    public void destroyObject(PooledObject<FTPClient> pooled) {
        disconnect(pooled.getObject());
    }

    private FTPClient connectFtp() throws IOException {
        FTPClient ftpClient = new FTPClient();
        // Must be set before connect(), otherwise non-ASCII paths are sent as ISO-8859-1 and
        // the NAS answers 550 for a name it received as "????".
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

    private FTPClient connectFtps() throws IOException {
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
        return ftpsClient;
    }

    private void applyTransferMode(FTPClient client) {
        if (mode == FtpMode.Passive) {
            client.enterLocalPassiveMode();
        } else {
            client.enterLocalActiveMode();
        }
    }

    private void enableUtf8IfNeeded(FTPClient client) {
        if (!StandardCharsets.UTF_8.name().equalsIgnoreCase(charset)) {
            return;
        }
        try {
            // Some NAS boxes need the option explicitly before they decode UTF-8 names.
            client.sendCommand("OPTS", "UTF8 ON");
        } catch (IOException ex) {
            log.warn("[enableUtf8IfNeeded][OPTS UTF8 ON 失败，继续使用控制连接编码] {}", ex.getMessage());
        }
    }

    /** Fails fast at connection time when the configured base path is not reachable. */
    private void assertBasePathReachable(FTPClient client) throws IOException {
        String pwd = client.printWorkingDirectory();
        if (!client.changeWorkingDirectory(config.getBasePath())) {
            String hint = containsNonAscii(config.getBasePath())
                ? "路径含中文时请确认字符集（UTF-8/GBK）与 NAS 一致；reply 出现 ???? 基本是编码问题。"
                : "若账号已在 NAS 绑定存储目录，请按 FTP 客户端可见路径填写，例如 /共享目录/v5notes_attach/";
            throw new FtpException(StrUtil.format(
                "无法进入基础路径 [{}]，当前 FTP 工作目录为 [{}]，charset={}，reply={}。{}",
                config.getBasePath(), pwd, charset, StrUtil.trim(StrUtil.blankToDefault(client.getReplyString(), "")), hint));
        }
        client.changeWorkingDirectory(StrUtil.blankToDefault(pwd, "/"));
    }

    private static void assertConnected(FTPClient ftpClient) throws IOException {
        int reply = ftpClient.getReplyCode();
        if (!FTPReply.isPositiveCompletion(reply)) {
            String replyText = StrUtil.trim(ftpClient.getReplyString());
            ftpClient.disconnect();
            throw new FtpException(StrUtil.format("FTP 连接被拒绝 reply={}", replyText));
        }
    }

    static void disconnect(FTPClient client) {
        if (client == null) {
            return;
        }
        try {
            if (client.isConnected()) {
                try {
                    client.logout();
                } catch (IOException ignored) {
                    // best effort
                }
                client.disconnect();
            }
        } catch (IOException ignored) {
            // best effort
        }
    }

    private static boolean containsNonAscii(String text) {
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
}
