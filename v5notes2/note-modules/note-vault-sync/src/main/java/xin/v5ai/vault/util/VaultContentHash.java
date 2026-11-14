package xin.v5ai.vault.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;

/**
 * Content addressing for vault blobs. Protocol form: {@code sha256:<hex>}.
 */
public final class VaultContentHash {

    public static final String PREFIX = "sha256:";

    private VaultContentHash() {
    }

    public static String ofBytes(byte[] bytes) {
        byte[] data = bytes == null ? new byte[0] : bytes;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(data);
            return PREFIX + HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public static String ofText(String text) {
        return ofBytes(text == null ? new byte[0] : text.getBytes(StandardCharsets.UTF_8));
    }

    public static String normalize(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("contentHash 不能为空");
        }
        String trimmed = value.trim().toLowerCase(Locale.ROOT);
        if (trimmed.startsWith(PREFIX)) {
            String hex = trimmed.substring(PREFIX.length());
            if (!hex.matches("[0-9a-f]{64}")) {
                throw new IllegalArgumentException("contentHash 格式无效");
            }
            return PREFIX + hex;
        }
        if (trimmed.matches("[0-9a-f]{64}")) {
            return PREFIX + trimmed;
        }
        throw new IllegalArgumentException("contentHash 格式无效");
    }

    public static boolean equalsNormalized(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        return normalize(a).equals(normalize(b));
    }
}
