package xin.v5ai.notes.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("笔记正文摘要")
class NoteContentDigestTest {

    @Test
    @DisplayName("空正文使用固定的 SHA-256")
    void emptyContentHasStableHash() {
        assertEquals(NoteContentDigest.EMPTY_SHA256, NoteContentDigest.sha256(null));
        assertEquals(NoteContentDigest.EMPTY_SHA256, NoteContentDigest.sha256(""));
        assertEquals(0, NoteContentDigest.utf8Size(null));
        assertEquals("", NoteContentDigest.excerpt(null));
    }

    @Test
    @DisplayName("按 UTF-8 字节计算大小，摘要按码位截断")
    void sizeUsesUtf8AndExcerptUsesCodePoints() {
        assertEquals(3, NoteContentDigest.utf8Size("你"));
        String emojis = "😀".repeat(121);
        String excerpt = NoteContentDigest.excerpt(emojis);
        assertEquals(120, excerpt.codePointCount(0, excerpt.length()));
        assertTrue(NoteContentDigest.excerpt("第一行\r\n第二行").startsWith("第一行 第二行"));
    }

    @Test
    @DisplayName("哈希校验忽略首尾空白和大小写")
    void hashCheckNormalizesCase() {
        String upper = NoteContentDigest.EMPTY_SHA256.toUpperCase();
        assertTrue(NoteContentDigest.isHash("  " + upper + "\n"));
        assertEquals(NoteContentDigest.EMPTY_SHA256, NoteContentDigest.normalizeHash("  " + upper));
        assertFalse(NoteContentDigest.isHash("abc"));
    }

    @Test
    @DisplayName("没有最新版本或哈希不同时需要补记当前正文")
    void snapshotIsNeededWhenCurrentIsNotLatest() {
        assertTrue(NoteContentDigest.needsCurrentSnapshot(null, "abc"));
        assertTrue(NoteContentDigest.needsCurrentSnapshot("old", "new"));
        assertFalse(NoteContentDigest.needsCurrentSnapshot("same", "same"));
    }
}
