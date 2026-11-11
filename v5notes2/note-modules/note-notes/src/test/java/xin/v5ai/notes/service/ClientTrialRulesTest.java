package xin.v5ai.notes.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ClientTrialRulesTest {

    private final LocalDateTime created = LocalDateTime.of(2026, 1, 1, 0, 0);
    private final long quota = 20L * 1024 * 1024;

    @Test
    void staysInsideBothLimits() {
        assertFalse(ClientTrialRules.exceeded(created, 30, quota, 0, quota, created.plusDays(29)));
    }

    @Test
    void endsWhenTheTrialInstantIsReached() {
        assertTrue(ClientTrialRules.exceeded(created, 30, 0, 0, quota, created.plusDays(30)));
    }

    @Test
    void endsWhenTheNextWriteCrossesTheQuota() {
        assertTrue(ClientTrialRules.exceeded(created, 30, quota, 1, quota, created.plusDays(1)));
    }

    @Test
    void shrinkingContentDoesNotCountAsExtraUsage() {
        assertFalse(ClientTrialRules.exceeded(created, 30, quota, -10, quota, created.plusDays(1)));
    }
}
