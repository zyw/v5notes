package xin.v5ai.vault.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class VaultQuotaRulesTest {

    @Test
    void capacityRejectsPushWhenOver() {
        assertTrue(VaultQuotaRules.wouldExceedCapacity(1000, 1, 1000));
        assertFalse(VaultQuotaRules.wouldExceedCapacity(900, 50, 1000));
    }

    @Test
    void replicaLimitAllowsRebind() {
        assertFalse(VaultQuotaRules.wouldExceedReplicas(3, true, 3));
        assertTrue(VaultQuotaRules.wouldExceedReplicas(3, false, 3));
    }

    @Test
    void fileTooLarge() {
        assertTrue(VaultQuotaRules.tooLarge(VaultQuotaRules.DEFAULT_MAX_FILE_BYTES + 1,
            VaultQuotaRules.DEFAULT_MAX_FILE_BYTES));
        assertFalse(VaultQuotaRules.tooLarge(10, VaultQuotaRules.DEFAULT_MAX_FILE_BYTES));
    }
}
