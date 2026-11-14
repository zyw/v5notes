package xin.v5ai.vault.util;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Vault path identity rules (design §6.2). Mirror of client {@code path/identity.ts}.
 */
public final class VaultPathRules {

    private static final Set<String> WINDOWS_RESERVED = Set.of(
        "CON", "PRN", "AUX", "NUL",
        "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
    );

    private static final Pattern ILLEGAL_CHARS = Pattern.compile("[\\u0000-\\u001f<>:\"|?*\\\\]");

    public record NormalizedVaultPath(String displayPath, String identityKey) {
    }

    private VaultPathRules() {
    }

    public static NormalizedVaultPath normalize(String input) {
        if (input == null || input.isBlank()) {
            throw new IllegalArgumentException("路径不能为空");
        }
        if (input.matches("^[a-zA-Z]:.*") || input.startsWith("/") || input.startsWith("\\")) {
            throw new IllegalArgumentException("路径必须是库内相对路径");
        }
        String unified = input.replace('\\', '/');
        String trimmed = unified.replaceAll("^/+", "").replaceAll("/+$", "");
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("路径不能为空");
        }
        String[] parts = trimmed.split("/");
        StringBuilder display = new StringBuilder();
        StringBuilder identity = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            String segment = normalizeDisplaySegment(parts[i]);
            if (i > 0) {
                display.append('/');
                identity.append('/');
            }
            display.append(segment);
            identity.append(toIdentitySegment(segment));
        }
        return new NormalizedVaultPath(display.toString(), identity.toString());
    }

    public static String normalizeDisplaySegment(String raw) {
        String segment = nfc(raw);
        if (segment.isEmpty()) {
            throw new IllegalArgumentException("路径段不能为空");
        }
        if (".".equals(segment) || "..".equals(segment)) {
            throw new IllegalArgumentException("路径段不能为 . 或 ..");
        }
        if (ILLEGAL_CHARS.matcher(segment).find()) {
            throw new IllegalArgumentException("路径段含非法字符: " + segment);
        }
        if (segment.matches(".*[ .]$") || !stripTrailingDotsAndSpaces(segment).equals(segment)) {
            throw new IllegalArgumentException("路径段不能以空格或句点结尾: " + segment);
        }
        String reserved = segment.contains(".") ? segment.substring(0, segment.indexOf('.')) : segment;
        if (WINDOWS_RESERVED.contains(reserved.toUpperCase(Locale.ROOT))) {
            throw new IllegalArgumentException("保留设备名不可用: " + segment);
        }
        return segment;
    }

    public static String toIdentitySegment(String displaySegment) {
        return nfc(displaySegment).toLowerCase(Locale.ROOT);
    }

    public static String nfc(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFC);
    }

    private static String stripTrailingDotsAndSpaces(String segment) {
        return segment.replaceAll("[ .]+$", "");
    }
}
