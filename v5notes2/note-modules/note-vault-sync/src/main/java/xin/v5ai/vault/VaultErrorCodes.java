package xin.v5ai.vault;

/**
 * Draft Vault Sync business error codes (design §8.2).
 * Keep aligned with {@code v5notes-vault-client/src/models/errors.ts}.
 */
public final class VaultErrorCodes {

    public static final String AUTH_UNAUTHORIZED = "auth.unauthorized";
    public static final String QUOTA_EXCEEDED = "vault.quota.exceeded";
    public static final String NOT_FOUND = "vault.not.found";
    public static final String FILE_NOT_FOUND = "vault.file.not.found";
    public static final String CONFLICT_REV = "vault.conflict.rev";
    public static final String FILE_TOO_LARGE = "vault.file.too.large";
    public static final String RATE_LIMITED = "vault.rate.limited";
    public static final String PATH_INVALID = "vault.path.invalid";

    private VaultErrorCodes() {
    }
}
