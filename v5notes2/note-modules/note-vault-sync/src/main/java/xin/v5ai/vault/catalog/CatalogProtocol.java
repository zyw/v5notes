package xin.v5ai.vault.catalog;

/**
 * Catalog is <strong>not</strong> part of the file-sync protocol.
 * Bumping {@link #PROTOCOL_VERSION} must not force SyncEngine clients to upgrade;
 * Sync protocol bumps must not force catalog clients to upgrade.
 */
public final class CatalogProtocol {

    /** Independent of vault file manifest / rev protocol. */
    public static final String PROTOCOL_VERSION = "1";

    /** Response header: catalog protocol version (non-file-sync). */
    public static final String HEADER_VERSION = "X-Vault-Catalog-Version";

    /** Response header: explicitly marks resource as non-file-sync. */
    public static final String HEADER_KIND = "X-Vault-Resource-Kind";

    public static final String RESOURCE_KIND = "catalog-non-file-sync";

    private CatalogProtocol() {
    }
}
