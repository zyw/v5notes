package xin.v5ai.vault.util;

/**
 * Phase 4 default quota policy (design §8.3).
 * Full billing persistence is Phase 5; defaults keep sync usable for smoke.
 */
public final class VaultQuotaRules {

    /** Default sync capacity when no plan row exists. */
    public static final long DEFAULT_QUOTA_BYTES = 1L * 1024 * 1024 * 1024;

    /** Default max bound devices per vault. */
    public static final int DEFAULT_DEVICE_LIMIT = 3;

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

    public static boolean wouldExceedDevices(int deviceUsed, boolean alreadyBound, int deviceLimit) {
        if (alreadyBound) {
            return false;
        }
        return deviceUsed >= deviceLimit;
    }

    public static boolean tooLarge(long sizeBytes, long maxFileBytes) {
        return sizeBytes > maxFileBytes;
    }
}
