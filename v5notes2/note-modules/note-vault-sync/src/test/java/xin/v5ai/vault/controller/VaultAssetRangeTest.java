package xin.v5ai.vault.controller;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Range parsing for resumable attachment downloads (design §5.4 / G5).
 */
class VaultAssetRangeTest {

    @Test
    void wholeObjectWhenHeaderAbsent() {
        assertEquals(0L, VaultAssetController.parseRange(null, 1000)[0]);
        assertEquals(1000L, VaultAssetController.parseRange(null, 1000)[1]);
    }

    @Test
    void explicitWindow() {
        long[] window = VaultAssetController.parseRange("bytes=1000-3047", 10_000);
        assertEquals(1000L, window[0]);
        assertEquals(2048L, window[1]);
    }

    @Test
    void openEndedReadsToTheEnd() {
        long[] window = VaultAssetController.parseRange("bytes=900-", 1000);
        assertEquals(900L, window[0]);
        assertEquals(100L, window[1]);
    }

    @Test
    void suffixFormReturnsTail() {
        long[] window = VaultAssetController.parseRange("bytes=-100", 1000);
        assertEquals(900L, window[0]);
        assertEquals(100L, window[1]);
    }

    @Test
    void endBeyondSizeIsClamped() {
        long[] window = VaultAssetController.parseRange("bytes=800-5000", 1000);
        assertEquals(800L, window[0]);
        assertEquals(200L, window[1]);
    }

    @Test
    void startPastEndFallsBackToWholeObject() {
        long[] window = VaultAssetController.parseRange("bytes=2000-3000", 1000);
        assertEquals(0L, window[0]);
        assertEquals(1000L, window[1]);
    }

    @Test
    void malformedHeaderFallsBackToWholeObject() {
        assertEquals(1000L, VaultAssetController.parseRange("bytes=abc-def", 1000)[1]);
        assertEquals(1000L, VaultAssetController.parseRange("items=0-10", 1000)[1]);
    }
}
