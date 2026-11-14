package xin.v5ai.vault.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class VaultContentHashTest {

    @Test
    void hashesTextWithPrefix() {
        String hash = VaultContentHash.ofText("hello");
        assertTrue(hash.startsWith("sha256:"));
        assertEquals(hash, VaultContentHash.normalize(hash.substring("sha256:".length())));
    }
}
