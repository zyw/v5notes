package xin.v5ai.vault.service;

import xin.v5ai.vault.service.model.VaultAssetCapability;
import xin.v5ai.vault.service.model.VaultStoredObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.util.Optional;

/**
 * Byte storage for attachment objects, kept behind an SPI so {@code note-vault-sync} never
 * depends on {@code note-base-file} (design §4.3).
 *
 * <p><b>Every read takes the {@code configId} recorded on the reference.</b> Never resolve the
 * current master config here: after a backend switch, older attachments still live in the
 * previous one (design §7.4).</p>
 */
public interface VaultAssetStorage {

    /**
     * Stores one object, streaming the body straight into the backend.
     *
     * @param vaultId  owning vault id, used to isolate object keys per vault
     * @param configId backend to write to; callers pass {@link #targetConfigId()}
     * @param mimeType content type, may be null
     * @return the stored object descriptor, including the id the client references later
     */
    VaultStoredObject store(Long vaultId, Long configId, InputStream content, long sizeBytes, String mimeType) throws Exception;

    /**
     * Stores one object while preserving the caller's original filename for display metadata.
     */
    default VaultStoredObject store(Long vaultId, Long configId, InputStream content, long sizeBytes,
                                    String mimeType, String originalFileName) throws Exception {
        return store(vaultId, configId, content, sizeBytes, mimeType);
    }

    /**
     * Looks up a previously uploaded (not yet committed) object by its storage assetId,
     * scoped to {@code userId} and {@code vaultId}. Enables multi-instance or post-restart commits.
     */
    default Optional<VaultStoredObject> lookup(Long userId, Long vaultId, String assetId) {
        return Optional.empty();
    }

    /**
     * Presigned direct URL for {@code objectKey}, when the backend supports it.
     * Returns {@link Optional#empty()} for proxy backends (FTP / local / DB / SFTP).
     */
    Optional<String> presign(Long configId, String objectKey, int ttlSeconds) throws Exception;

    /**
     * Streams the object into {@code out}, honouring {@code offset}/{@code length} for {@code Range}
     * requests. {@code length < 0} means "to the end".
     */
    void streamTo(Long configId, String objectKey, long offset, long length, OutputStream out) throws Exception;

    /** Deletes the stored object; called only when the last reference disappears. */
    void delete(Long configId, String objectKey) throws Exception;

    /**
     * Removes an unreferenced orphan object and its underlying file metadata row.
     */
    default void deleteOrphan(Long assetId, Long configId, String objectKey) throws Exception {
        delete(configId, objectKey);
    }

    /** Backend used for new attachments. */
    VaultAssetCapability capability();

    /** File config every new attachment is written to. */
    Long targetConfigId();
}
