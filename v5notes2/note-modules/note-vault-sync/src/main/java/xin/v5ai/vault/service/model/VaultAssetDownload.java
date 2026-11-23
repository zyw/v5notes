package xin.v5ai.vault.service.model;

/**
 * Where the client should fetch an attachment body from (design §3.3).
 *
 * @param mode          {@code direct} for a presigned storage link, {@code proxy} for our streaming endpoint
 * @param url           absolute URL (direct) or vault-relative path (proxy)
 * @param expiresIn     seconds the URL stays valid; 0 means "as long as you hold the token"
 * @param supportsRange whether the URL honours {@code Range} for resumable downloads
 */
public record VaultAssetDownload(String mode, String url, int expiresIn, boolean supportsRange) {

    public static final String MODE_DIRECT = "direct";
    public static final String MODE_PROXY = "proxy";

    /** Presigned links are short-lived; clients cache for slightly less. */
    public static final int DEFAULT_TTL_SECONDS = 300;

    public static VaultAssetDownload direct(String url, int expiresIn) {
        return new VaultAssetDownload(MODE_DIRECT, url, expiresIn, true);
    }

    public static VaultAssetDownload proxy(String path) {
        return new VaultAssetDownload(MODE_PROXY, path, 0, true);
    }
}
