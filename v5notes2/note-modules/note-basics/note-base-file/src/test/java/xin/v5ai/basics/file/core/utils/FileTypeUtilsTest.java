package xin.v5ai.basics.file.core.utils;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class FileTypeUtilsTest {

    @Test
    void resolvesCommonMimeTypesToLowercaseExtensions() {
        assertEquals("png", FileTypeUtils.getExtensionByMimeType("image/png"));
        assertEquals("jpg", FileTypeUtils.getExtensionByMimeType("image/jpeg"));
        assertEquals("webp", FileTypeUtils.getExtensionByMimeType("image/webp"));
        assertEquals("svg", FileTypeUtils.getExtensionByMimeType("image/svg+xml"));
        assertEquals("pdf", FileTypeUtils.getExtensionByMimeType("application/pdf"));
        assertEquals("txt", FileTypeUtils.getExtensionByMimeType("text/plain; charset=utf-8"));
    }

    @Test
    void returnsEmptyStringForOctetStreamAndBlankMimeTypes() {
        assertEquals("", FileTypeUtils.getExtensionByMimeType("application/octet-stream"));
        assertEquals("", FileTypeUtils.getExtensionByMimeType(""));
        assertEquals("", FileTypeUtils.getExtensionByMimeType(null));
    }

    @Test
    void appendsSuffixOnlyWhenMissing() {
        assertEquals("hash.png", FileTypeUtils.appendSuffixIfMissing("hash", "png"));
        assertEquals("photo.jpg", FileTypeUtils.appendSuffixIfMissing("photo.jpg", "png"));
        assertEquals("file.pdf", FileTypeUtils.appendSuffixIfMissing("", "pdf"));
    }
}
