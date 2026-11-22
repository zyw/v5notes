package xin.v5ai.vault.util;

/**
 * Vault sync quota policy (design §8.3).
 * Defaults keep sync usable for smoke; full billing field persistence remains deferred.
 */
public final class VaultQuotaRules {

    /** Default sync capacity when no plan row exists. */
    public static final long DEFAULT_QUOTA_BYTES = 1L * 1024 * 1024 * 1024;

    /** Default max bound replicas per vault (one per bound library directory). */
    public static final int DEFAULT_REPLICA_LIMIT = 3;

    /** Single-file soft limit (Phase 4 PUT path). */
    public static final long DEFAULT_MAX_FILE_BYTES = 25L * 1024 * 1024;

    private VaultQuotaRules() {
    }

    public static boolean wouldExceedCapacity(long usedBytes, long incomingDelta, long quotaBytes) {
        if (quotaBytes <= 0) {
            return true;
        }
        long next = usedBytes + Math.max(0, incomingDelta);
        return next > quotaBytes;
    }

    public static boolean wouldExceedReplicas(int replicaUsed, boolean alreadyBound, int replicaLimit) {
        if (alreadyBound) {
            return false;
        }
        return replicaUsed >= replicaLimit;
    }

    public static boolean tooLarge(long sizeBytes, long maxFileBytes) {
        return sizeBytes > maxFileBytes;
    }
}
