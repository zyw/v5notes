package xin.v5ai.vault.service;

import xin.v5ai.vault.domain.VaultAssetRef;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.service.model.VaultAssetCapability;
import xin.v5ai.vault.service.model.VaultAssetDownload;

import java.io.InputStream;
import java.io.OutputStream;

/**
 * Attachment object lifecycle on top of {@link VaultAssetStorage} (design §4.1).
 */
public interface IVaultAssetService {

    /**
     * Stores an attachment body, deduplicating by content hash within the vault.
     *
     * @throws VaultBusinessException 415 when storage is unconfigured, 413 when over the ceiling,
     *                                409 when the declared hash does not match the bytes
     */
    StoredResult upload(Long userId, Long vaultId, InputStream content, long sizeBytes,
                        String declaredSha256, String mimeType) throws Exception;

    /** Looks up the reference previously stored for this vault + hash, if any (used by commit). */
    VaultAssetRef findByHash(Long vaultId, String sha256);

    /**
     * Resolves an uploaded or already-committed attachment reference for {@code PUT /files} commit,
     * checking existing refs, recent upload staging, and storage lookup in order.
     */
    default VaultAssetRef resolveForCommit(Long userId, Long vaultId, String assetId, String sha256) {
        return findByHash(vaultId, sha256);
    }

    /** The storage reference for one file row, or null when the file has no stored object. */
    VaultAssetRef findByFileId(Long fileId);

    /** Row for a specific asset inside a vault; used by the streaming read path. */
    VaultAssetRef findByAssetIdForRead(Long vaultId, String assetId);

    /** Ensures {@code assetId} exists and is owned by {@code userId}. */
    void requireOwned(Long userId, Long vaultId, String assetId);

    /** Where the client should fetch this reference from. */
    VaultAssetDownload download(Long vaultId, VaultAssetRef ref);

    /** Streams the bytes for a reference (proxy mode / internal callers). */
    void streamTo(VaultAssetRef ref, long offset, long length, OutputStream out) throws Exception;

    /** Records the per-file storage link once the {@code vault_file} row exists. */
    void link(Long fileId, Long vaultId, VaultAssetRef ref);

    /** Drops one reference; deletes the stored object when no reference remains (design §6.1). */
    void releaseReference(Long fileId, VaultAssetRef ref);

    VaultAssetCapability capability();

    /**
     * @param assetId   basic-file id (stringified snowflake)
     * @param sha256    normalized content hash
     * @param deduped   true when the same bytes were already stored for this vault
     */
    record StoredResult(String assetId, String sha256, long sizeBytes, boolean deduped) {
    }
}
