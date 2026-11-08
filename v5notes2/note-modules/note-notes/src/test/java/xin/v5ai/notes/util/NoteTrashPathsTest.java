package xin.v5ai.notes.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("回收站路径和剩余天数")
class NoteTrashPathsTest {

    @Test
    @DisplayName("根目录和多级路径用分隔符连接")
    void joinsAncestorsFromTheRoot() {
        assertEquals("根目录", NoteTrashPaths.join(List.of()));
        assertEquals("根目录 / 资料 / 工作", NoteTrashPaths.join(List.of("资料", "工作")));
    }

    @Test
    @DisplayName("超长路径保留靠近对象的部分")
    void keepsTheTailOfALongPath() {
        String path = "根目录 / " + "目录".repeat(300);
        String limited = NoteTrashPaths.limit(path);
        assertEquals(500, limited.length());
        assertTrue(limited.startsWith("…"));
        assertTrue(limited.endsWith("目录"));
    }

    @Test
    @DisplayName("剩余天数按日期差计算，过期后为 0")
    void daysLeftNeverGoesBelowZero() {
        LocalDate today = LocalDate.of(2026, 11, 8);
        assertEquals(30, NoteTrashPaths.daysLeft(LocalDateTime.of(2026, 12, 8, 3, 10), today));
        assertEquals(0, NoteTrashPaths.daysLeft(LocalDateTime.of(2026, 11, 8, 23, 0), today));
        assertEquals(0, NoteTrashPaths.daysLeft(LocalDateTime.of(2026, 11, 1, 0, 0), today));
    }

    @Test
    @DisplayName("只有未删除标志 0 算作仍在目录树中")
    void onlyZeroFlagIsLive() {
        assertTrue(NoteTrashPaths.live("0"));
        assertTrue(NoteTrashPaths.live(" 0 "));
        assertFalse(NoteTrashPaths.live("1"));
        assertFalse(NoteTrashPaths.live("2"));
        assertFalse(NoteTrashPaths.live(null));
    }
}
