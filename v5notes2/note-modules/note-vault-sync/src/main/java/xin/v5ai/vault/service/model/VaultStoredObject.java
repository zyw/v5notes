package xin.v5ai.vault.service.model;

/**
 * Result of storing one attachment body.
 *
 * @param assetId   underlying basic-file record id (stringified snowflake)
 * @param configId  file config that actually holds the bytes; persisted so later reads go back
 *                  to the same backend even after the VAULT_ASSET config is switched
 * @param objectKey storage key handed to the backend
 * @param sha256    normalized content hash ({@code sha256:<hex>})
 * @param sizeBytes stored byte length
 * @param mimeType  stored MIME type, may be null
 */
public record VaultStoredObject(
    String assetId,
    Long configId,
    String objectKey,
    String sha256,
    long sizeBytes,
    String mimeType
) {
}
