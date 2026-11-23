package xin.v5ai.vault.service.model;

/**
 * What the configured attachment backend can do (design §5.3).
 *
 * <p>Clients only branch on {@code directDownload}: {@code true} means the returned URL is a
 * presigned object-storage link the client may fetch without our auth header; {@code false}
 * means the URL is this service's streaming proxy endpoint and the bearer token is required.</p>
 *
 * @param backend              backend family: {@code s3} (direct) or {@code ftp}/{@code local}/{@code db}/{@code sftp} (proxy)
 * @param directDownload       whether presigned direct download is available
 * @param maxFileBytes         single-file ceiling
 * @param maxConcurrentUploads recommended client-side concurrent attachment transfers
 */
public record VaultAssetCapability(
    String backend,
    boolean directDownload,
    long maxFileBytes,
    int maxConcurrentUploads
) {

    public static final String BACKEND_S3 = "s3";
    public static final String BACKEND_FTP = "ftp";
    public static final String BACKEND_LOCAL = "local";
    public static final String BACKEND_DB = "db";
    public static final String BACKEND_SFTP = "sftp";

    /** Proxy mode is bandwidth-bound on our own server, so it gets the conservative budget (design §5.5). */
    public static final int CONCURRENT_PROXY = 2;
    /** Direct mode talks to object storage, so it can afford a wider fan-out. */
    public static final int CONCURRENT_DIRECT = 4;

    public static VaultAssetCapability of(String backend, long maxFileBytes) {
        boolean direct = BACKEND_S3.equalsIgnoreCase(backend);
        return new VaultAssetCapability(
            backend,
            direct,
            maxFileBytes,
            direct ? CONCURRENT_DIRECT : CONCURRENT_PROXY
        );
    }
}
