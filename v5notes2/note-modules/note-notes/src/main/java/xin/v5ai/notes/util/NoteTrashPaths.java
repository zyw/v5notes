package xin.v5ai.notes.util;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * 回收站路径和剩余天数。路径在删除时算好，列表不再递归目录。
 */
public final class NoteTrashPaths {

    public static final int PATH_LIMIT = 500;

    public static final String ROOT = "根目录";

    private NoteTrashPaths() {
    }

    public static boolean live(String delFlag) {
        return delFlag != null && "0".equals(delFlag.trim());
    }

    public static String join(List<String> directoryNames) {
        if (directoryNames == null || directoryNames.isEmpty()) {
            return ROOT;
        }
        return limit(ROOT + " / " + String.join(" / ", directoryNames));
    }

    public static String limit(String path) {
        String value = path == null || path.isBlank() ? ROOT : path;
        if (value.length() <= PATH_LIMIT) {
            return value;
        }
        return "…" + value.substring(value.length() - (PATH_LIMIT - 1));
    }

    public static int daysLeft(LocalDateTime expireTime, LocalDate today) {
        if (expireTime == null || today == null) {
            return 0;
        }
        long days = ChronoUnit.DAYS.between(today, expireTime.toLocalDate());
        return (int) Math.max(days, 0);
    }
}
