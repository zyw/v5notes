package xin.v5ai.basics.file.core.client.ftp;

import cn.hutool.core.io.IoUtil;
import cn.hutool.core.util.StrUtil;
import cn.hutool.extra.ftp.FtpException;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.net.ftp.FTPClient;
import org.apache.commons.pool2.impl.GenericObjectPool;
import org.apache.commons.pool2.impl.GenericObjectPoolConfig;
import xin.v5ai.basics.file.core.client.AbstractFileClient;
import xin.v5ai.basics.file.core.client.FileUploadResult;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * FTP / FTPS 文件客户端。
 *
 * <p>每个操作从连接池借出一条独占连接，用完归还（设计 D1）。此前整个客户端共享一个
 * {@code FTPClient}，而 FTP 靠 {@code CWD} 定位文件，两个线程同时上传会互相切走工作目录，
 * 结果是把文件写进别人的目录或者收到 550。池化之后连接与操作一一对应。</p>
 *
 * <p>连接建立、登录、FTPS 握手、UTF-8 协商与 basePath 校验都在 {@link FTPConnectionFactory}
 * 里完成，每条连接一次。</p>
 *
 * @author 芋道源码
 */
@Slf4j
public class FTPFileClient extends AbstractFileClient<FTPFileClientConfig> {

    /** Design D1: the ceiling for this process, not a target concurrency. */
    private static final int POOL_MAX_TOTAL = 8;
    private static final int POOL_MAX_IDLE = 4;
    private static final long POOL_MAX_WAIT_MS = 5_000L;
    private static final long POOL_EVICTABLE_IDLE_MS = 30_000L;

    private GenericObjectPool<FTPClient> pool;

    public FTPFileClient(Long id, FTPFileClientConfig config) {
        super(id, config);
    }

    @Override
    protected void doInit() {
        config.setBasePath(normalizeDir(config.getBasePath()));
        doDestroy();
        this.pool = new GenericObjectPool<>(new FTPConnectionFactory(config), poolConfig());
        log.info("[doInit][FTP 连接池就绪 host={}:{} basePath={} maxTotal={}]",
            config.getHost(), config.getPort(), config.getBasePath(), POOL_MAX_TOTAL);
    }

    /**
     * Releases pooled connections. Called before a re-init and when the config is removed, so
     * changing a file config never leaks the previous pool (design T1b).
     */
    public void doDestroy() {
        if (pool != null) {
            try {
                pool.close();
            } finally {
                pool = null;
            }
        }
    }

    private static GenericObjectPoolConfig<FTPClient> poolConfig() {
        GenericObjectPoolConfig<FTPClient> cfg = new GenericObjectPoolConfig<>();
        cfg.setMaxTotal(POOL_MAX_TOTAL);
        cfg.setMaxIdle(POOL_MAX_IDLE);
        cfg.setMinIdle(0);
        cfg.setMaxWait(java.time.Duration.ofMillis(POOL_MAX_WAIT_MS));
        cfg.setMinEvictableIdleTime(java.time.Duration.ofMillis(POOL_EVICTABLE_IDLE_MS));
        // Borrowing never pays for a round trip; idle connections are probed in the background
        // and again on borrow through validateObject only when a stale one is suspected.
        cfg.setTestOnBorrow(false);
        cfg.setTestWhileIdle(true);
        cfg.setTimeBetweenEvictionRuns(java.time.Duration.ofSeconds(30));
        return cfg;
    }

    private GenericObjectPool<FTPClient> requirePool() {
        GenericObjectPool<FTPClient> current = pool;
        if (current == null) {
            throw new FtpException("FTP 连接池未初始化");
        }
        return current;
    }

    /** Runs one operation against an exclusively borrowed connection. */
    private <T> T withClient(FtpOperation<T> operation) throws Exception {
        GenericObjectPool<FTPClient> current = requirePool();
        FTPClient client = current.borrowObject();
        boolean healthy = false;
        try {
            T result = operation.run(client);
            healthy = true;
            return result;
        } finally {
            if (healthy) {
                // Reset the position so the next borrower starts from the config base path.
                try {
                    client.changeWorkingDirectory(config.getBasePath());
                } catch (Exception ignored) {
                    // A stale directory is harmless: every operation sets its own.
                }
                current.returnObject(client);
            } else {
                current.invalidateObject(client);
            }
        }
    }

    @FunctionalInterface
    private interface FtpOperation<T> {
        T run(FTPClient client) throws Exception;
    }

    @Override
    public FileUploadResult upload(byte[] content, String path, String type) throws Exception {
        return uploadStream(new ByteArrayInputStream(content), content.length, path, type);
    }

    @Override
    public FileUploadResult uploadStream(InputStream in, long size, String path, String type) throws Exception {
        String filePath = getFilePath(path);
        String fileName = fileNameOf(filePath);
        String dir = dirOf(filePath);

        withClient(client -> {
            ensureDirectory(client, dir);
            if (!client.changeWorkingDirectory(dir)) {
                throw new FtpException(StrUtil.format(
                    "切换到上传目录失败 [{}]，pwd=[{}]，reply={}",
                    dir, client.printWorkingDirectory(), replyOf(client)));
            }
            if (!client.storeFile(fileName, in)) {
                throw new FtpException(StrUtil.format(
                    "上传文件失败 path={} reply={}", filePath, replyOf(client)));
            }
            return null;
        });
        log.debug("[upload][上传成功 path={} size={}]", filePath, size);

        return FileUploadResult.builder()
            .url(super.formatFileUrl(config.getDomain(), path))
            .path(path)
            .build();
    }

    @Override
    public byte[] getContent(String path) throws Exception {
        return withClient(client -> {
            String filePath = getFilePath(path);
            try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                changeToFileDir(client, filePath);
                if (!client.retrieveFile(fileNameOf(filePath), out)) {
                    throw new FtpException(StrUtil.format(
                        "下载文件失败 path={} reply={}", filePath, replyOf(client)));
                }
                return out.toByteArray();
            }
        });
    }

    /**
     * Range read. FTP has no partial-retrieve call, so the offset goes through {@code REST} and
     * the bytes are streamed out instead of being buffered whole.
     */
    @Override
    public void getContentStream(String path, long offset, long length, OutputStream out) throws Exception {
        String filePath = getFilePath(path);
        withClient(client -> {
            changeToFileDir(client, filePath);
            if (offset > 0) {
                client.setRestartOffset(offset);
            }
            try (InputStream remote = client.retrieveFileStream(fileNameOf(filePath))) {
                if (remote == null) {
                    throw new FtpException(StrUtil.format(
                        "下载文件失败 path={} reply={}", filePath, replyOf(client)));
                }
                copyLimited(remote, out, length);
            } finally {
                client.setRestartOffset(0);
                client.completePendingCommand();
            }
            return null;
        });
    }

    @Override
    public void delete(String path) throws Exception {
        String filePath = getFilePath(path);
        withClient(client -> {
            if (!client.deleteFile(filePath) && !client.deleteFile(StrUtil.removePrefix(filePath, "/"))) {
                throw new FtpException(StrUtil.format(
                    "删除文件失败 path={} reply={}", filePath, replyOf(client)));
            }
            return null;
        });
    }

    private void changeToFileDir(FTPClient client, String filePath) throws IOException {
        String dir = dirOf(filePath);
        if (!client.changeWorkingDirectory(dir)) {
            throw new FtpException(StrUtil.format("下载时无法进入目录 [{}]，reply={}", dir, replyOf(client)));
        }
    }

    private void ensureDirectory(FTPClient client, String dir) throws IOException {
        String normalized = StrUtil.removeSuffix(normalizeDir(dir), "/");
        if (StrUtil.isBlank(normalized) || "/".equals(normalized)) {
            return;
        }
        if (client.changeWorkingDirectory(normalized + "/")) {
            return;
        }
        String pwd = client.printWorkingDirectory();
        try {
            if (!client.changeWorkingDirectory("/")) {
                throw new FtpException("无法切换到 FTP 根目录 / ，reply=" + replyOf(client));
            }
            for (String part : normalized.split("/")) {
                if (StrUtil.isBlank(part)) {
                    continue;
                }
                if (client.changeWorkingDirectory(part)) {
                    continue;
                }
                boolean created = client.makeDirectory(part);
                if (!client.changeWorkingDirectory(part)) {
                    throw new FtpException(StrUtil.format(
                        "创建目录 [{}] 失败，目标 [{}]，pwd=[{}]，created={}，reply={}",
                        part, normalized, client.printWorkingDirectory(), created, replyOf(client)));
                }
            }
        } finally {
            client.changeWorkingDirectory(StrUtil.blankToDefault(pwd, "/"));
        }
    }

    private static void copyLimited(InputStream in, OutputStream out, long length) throws IOException {
        byte[] buf = new byte[8192];
        long remaining = length < 0 ? Long.MAX_VALUE : length;
        while (remaining > 0) {
            int want = (int) Math.min(buf.length, remaining);
            int read = in.read(buf, 0, want);
            if (read < 0) {
                break;
            }
            out.write(buf, 0, read);
            remaining -= read;
        }
    }

    private static String replyOf(FTPClient client) {
        return StrUtil.trim(StrUtil.blankToDefault(client.getReplyString(), String.valueOf(client.getReplyCode())));
    }

    private static String fileNameOf(String filePath) {
        return cn.hutool.core.io.FileUtil.getName(filePath);
    }

    private static String dirOf(String filePath) {
        return normalizeDir(StrUtil.removeSuffix(filePath, fileNameOf(filePath)));
    }

    private static String normalizeDir(String path) {
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
}
