package xin.v5ai.notes.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;

/**
 * 笔记正文的哈希、字节数和列表摘要。空正文与 {@code null} 按空字符串处理。
 */
public final class NoteContentDigest {

    public static final String EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

    private static final int EXCERPT_CODE_POINTS = 120;

    private NoteContentDigest() {
    }

    public static String text(String content) {
        return content == null ? "" : content;
    }

    public static String sha256(String content) {
        byte[] bytes = text(content).getBytes(StandardCharsets.UTF_8);
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    public static int utf8Size(String content) {
        return text(content).getBytes(StandardCharsets.UTF_8).length;
    }

    public static String excerpt(String content) {
        String flat = text(content).replace("\r\n", " ").replace('\n', ' ').replace('\r', ' ');
        return flat.codePoints()
            .limit(EXCERPT_CODE_POINTS)
            .collect(StringBuilder::new, StringBuilder::appendCodePoint, StringBuilder::append)
            .toString();
    }

    public static boolean isHash(String value) {
        return value != null && value.trim().matches("^[0-9a-fA-F]{64}$");
    }

    public static String normalizeHash(String value) {
        return value.trim().toLowerCase(Locale.ROOT);
    }

    /**
     * 最新版本没有覆盖当前正文时，保存前要先把当前正文补记进去。
     */
    public static boolean needsCurrentSnapshot(String latestHash, String currentHash) {
        return latestHash == null || !currentHash.equals(latestHash);
    }
}
