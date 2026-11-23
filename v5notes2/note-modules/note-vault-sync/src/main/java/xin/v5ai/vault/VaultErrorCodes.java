package xin.v5ai.vault;

/**
 * Draft Vault Sync business error codes (design §8.2).
 * Keep aligned with {@code v5notes-clients/v5notes-vault-client/src/models/errors.ts}.
 */
public final class VaultErrorCodes {

    public static final String AUTH_UNAUTHORIZED = "auth.unauthorized";
    public static final String QUOTA_EXCEEDED = "vault.quota.exceeded";
    /** Device-count exceeded on bind; distinct from capacity so clients can branch UI (design §8.3). */
    public static final String QUOTA_DEVICES_EXCEEDED = "vault.quota.devices-exceeded";
    public static final String NOT_FOUND = "vault.not.found";
    public static final String FILE_NOT_FOUND = "vault.file.not.found";
    public static final String CONFLICT_REV = "vault.conflict.rev";
    /** Rename target identity already live (conflict family; design §8.2 error table). */
    public static final String CONFLICT_PATH_EXISTS = "vault.conflict.path-exists";
    /** Declared contentHash does not match the bytes uploaded. */
    public static final String HASH_MISMATCH = "vault.hash.mismatch";
    public static final String FILE_TOO_LARGE = "vault.file.too.large";
    public static final String RATE_LIMITED = "vault.rate.limited";
    public static final String PATH_INVALID = "vault.path.invalid";

    /**
     * {@code type=asset} arrived without an {@code asset} reference (design D5).
     * Retrying the same body can never succeed, so clients must not enqueue it.
     */
    public static final String ASSET_REQUIRED = "vault.asset.required";

    /** The asset object named by {@code asset.assetId} does not exist or is not owned by the caller. */
    public static final String ASSET_NOT_FOUND = "vault.asset.not.found";

    /** Attachment storage backend is not configured for this deployment (no VAULT_ASSET file config). */
    public static final String ASSET_STORAGE_UNAVAILABLE = "vault.asset.storage-unavailable";

    private VaultErrorCodes() {
    }
}
