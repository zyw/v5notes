package xin.v5ai.vault.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import xin.v5ai.common.core.constant.HttpStatus;
import org.springframework.stereotype.Service;
import xin.v5ai.vault.VaultErrorCodes;
import xin.v5ai.vault.VaultHttpStatus;
import xin.v5ai.vault.domain.VaultAssetRef;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.mapper.VaultAssetRefMapper;
import xin.v5ai.vault.service.IVaultAssetService;
import xin.v5ai.vault.service.VaultAssetStorage;
import xin.v5ai.vault.service.model.VaultAssetCapability;
import xin.v5ai.vault.service.model.VaultAssetDownload;
import xin.v5ai.vault.service.model.VaultStoredObject;
import xin.v5ai.vault.util.VaultContentHash;
import xin.v5ai.vault.util.VaultQuotaRules;

import java.io.InputStream;
import java.io.OutputStream;
import java.util.Objects;
import java.util.Optional;

/**
 * Attachment objects: content-addressed storage with per-vault dedup (design §4.1).
 *
 * <p>Dedup is decided on {@code (vault_id, sha256)} in {@code vault_asset_ref}; a hit skips the
 * backend entirely, which is what makes retrying a half-finished push cheap.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VaultAssetServiceImpl implements IVaultAssetService {

    private final VaultAssetRefMapper refMapper;
    private final ObjectProvider<VaultAssetStorage> storageProvider;

    @Override
    public StoredResult upload(Long userId, Long vaultId, InputStream content, long sizeBytes,
                               String declaredSha256, String mimeType) throws Exception {
        if (VaultQuotaRules.tooLarge(sizeBytes, VaultQuotaRules.DEFAULT_MAX_FILE_BYTES)) {
            throw new VaultBusinessException(VaultHttpStatus.PAYLOAD_TOO_LARGE, VaultErrorCodes.FILE_TOO_LARGE,
                "单文件超过上限");
        }
        String declared = normalizeDeclared(declaredSha256);

        // Dedup first: identical bytes never need to reach the backend again.
        VaultAssetRef existing = findByHash(vaultId, declared);
        if (existing != null) {
            return new StoredResult(String.valueOf(existing.getAssetId()), declared,
                existing.getSizeBytes() == null ? sizeBytes : existing.getSizeBytes(), true);
        }

        VaultAssetStorage storage = requireStorage();
        Long configId = storage.targetConfigId();

        // The storage layer hashes exactly the bytes it wrote, which is the only implementation
        // that stays correct no matter how a backend consumes the stream.
        VaultStoredObject stored = storage.store(configId, content, sizeBytes, mimeType);
        String actual = VaultContentHash.normalize(stored.sha256());

        if (!actual.equalsIgnoreCase(declared)) {
            // Bytes are already in the backend; drop them rather than leave a lie behind.
            safeDelete(storage, configId, stored.objectKey());
            throw new VaultBusinessException(HttpStatus.CONFLICT, VaultErrorCodes.HASH_MISMATCH,
                "声明的内容哈希与实际字节不一致");
        }

        VaultAssetRef ref = new VaultAssetRef();
        ref.setVaultId(vaultId);
        ref.setAssetId(Long.parseLong(stored.assetId()));
        ref.setSha256(actual);
        ref.setSizeBytes(stored.sizeBytes());
        ref.setMimeType(mimeType);
        ref.setStorageKey(stored.objectKey());
        ref.setConfigId(configId);
        // Config id is what reads follow (§7.4); backend is informational for diagnostics.
        ref.setBackend(backendFor(storage));
        // fileId is the primary key and is only known at commit time, so it stays null here.
        return new StoredResult(stored.assetId(), actual, stored.sizeBytes(), false);
    }

    @Override
    public VaultAssetRef findByHash(Long vaultId, String sha256) {
        if (sha256 == null || sha256.isBlank()) {
            return null;
        }
        return refMapper.selectOne(new LambdaQueryWrapper<VaultAssetRef>()
            .eq(VaultAssetRef::getVaultId, vaultId)
            .eq(VaultAssetRef::getSha256, sha256)
            .last("LIMIT 1"));
    }

    @Override
    public VaultAssetRef findByFileId(Long fileId) {
        return fileId == null ? null : refMapper.selectById(fileId);
    }

    @Override
    public VaultAssetRef findByAssetIdForRead(Long vaultId, String assetId) {
        return findByAssetId(vaultId, assetId);
    }

    @Override
    public void requireOwned(Long userId, Long vaultId, String assetId) {
        VaultAssetRef ref = findByAssetId(vaultId, assetId);
        if (ref == null) {
            throw new VaultBusinessException(HttpStatus.NOT_FOUND, VaultErrorCodes.ASSET_NOT_FOUND,
                "附件对象不存在");
        }
    }

    @Override
    public VaultAssetDownload download(Long vaultId, VaultAssetRef ref) {
        VaultAssetStorage storage = requireStorage();
        String proxyPath = "/vault/v1/vaults/" + vaultId + "/assets/" + ref.getAssetId() + "/content";
        try {
            Optional<String> direct = storage.presign(ref.getConfigId(), ref.getStorageKey(),
                VaultAssetDownload.DEFAULT_TTL_SECONDS);
            if (direct.isPresent()) {
                return VaultAssetDownload.direct(direct.get(), VaultAssetDownload.DEFAULT_TTL_SECONDS);
            }
        } catch (Exception ex) {
            // A presign failure must not block the read: proxy always works while the token is valid.
            log.warn("[download][presign 失败，回退 proxy][configId({}) key({})] {}",
                ref.getConfigId(), ref.getStorageKey(), ex.getMessage());
        }
        return VaultAssetDownload.proxy(proxyPath);
    }

    @Override
    public void streamTo(VaultAssetRef ref, long offset, long length, OutputStream out) throws Exception {
        requireStorage().streamTo(ref.getConfigId(), ref.getStorageKey(), offset, length, out);
    }

    @Override
    public void releaseReference(Long fileId, VaultAssetRef ref) {
        if (ref == null || fileId == null) {
            return;
        }
        refMapper.deleteById(fileId);
        Long remaining = refMapper.selectCount(new LambdaQueryWrapper<VaultAssetRef>()
            .eq(VaultAssetRef::getAssetId, ref.getAssetId()));
        if (remaining != null && remaining > 0) {
            return;
        }
        // Last reference gone: the object itself may be removed (design §6.1).
        VaultAssetStorage storage = storageProvider.getIfAvailable();
        if (storage == null) {
            log.warn("[releaseReference][存储未配置，跳过对象删除][assetId({})]", ref.getAssetId());
            return;
        }
        try {
            storage.delete(ref.getConfigId(), ref.getStorageKey());
        } catch (Exception ex) {
            // Metadata is already gone; an orphan sweep reclaims the object later (§6.3).
            log.warn("[releaseReference][对象删除失败，留给孤儿回收][assetId({}) key({})] {}",
                ref.getAssetId(), ref.getStorageKey(), ex.getMessage());
        }
    }

    @Override
    public VaultAssetCapability capability() {
        return requireStorage().capability();
    }

    @Override
    public void link(Long fileId, Long vaultId, VaultAssetRef ref) {
        VaultAssetRef row = new VaultAssetRef();
        row.setFileId(fileId);
        row.setAssetId(ref.getAssetId());
        row.setVaultId(vaultId);
        row.setSha256(ref.getSha256());
        row.setSizeBytes(ref.getSizeBytes());
        row.setMimeType(ref.getMimeType());
        row.setStorageKey(ref.getStorageKey());
        row.setConfigId(ref.getConfigId());
        row.setBackend(ref.getBackend());
        refMapper.insert(row);
    }

    private VaultAssetRef findByAssetId(Long vaultId, String assetId) {
        if (assetId == null || assetId.isBlank()) {
            return null;
        }
        Long id;
        try {
            id = Long.parseLong(assetId.trim());
        } catch (NumberFormatException ex) {
            return null;
        }
        return refMapper.selectOne(new LambdaQueryWrapper<VaultAssetRef>()
            .eq(VaultAssetRef::getVaultId, vaultId)
            .eq(VaultAssetRef::getAssetId, id)
            .last("LIMIT 1"));
    }

    private VaultAssetStorage requireStorage() {
        VaultAssetStorage storage = storageProvider.getIfAvailable();
        if (storage == null) {
            throw new VaultBusinessException(VaultHttpStatus.SERVICE_UNAVAILABLE,
                VaultErrorCodes.ASSET_STORAGE_UNAVAILABLE, "附件存储未配置");
        }
        return storage;
    }

    private static String backendFor(VaultAssetStorage storage) {
        try {
            return storage.capability().backend();
        } catch (RuntimeException ex) {
            return VaultAssetCapability.BACKEND_LOCAL;
        }
    }

    private static String normalizeDeclared(String declaredSha256) {
        try {
            return VaultContentHash.normalize(declaredSha256);
        } catch (IllegalArgumentException ex) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID,
                "sha256 参数无效");
        }
    }

    private static void safeDelete(VaultAssetStorage storage, Long configId, String key) {
        try {
            storage.delete(configId, key);
        } catch (Exception ex) {
            log.warn("[safeDelete][清理失败][key({})] {}", key, ex.getMessage());
        }
    }

    /** Equality helper for callers that need to compare stored hashes safely. */
    public static boolean sameHash(String a, String b) {
        return Objects.equals(normalizeQuietly(a), normalizeQuietly(b));
    }

    private static String normalizeQuietly(String value) {
        try {
            return VaultContentHash.normalize(value);
        } catch (IllegalArgumentException ex) {
            return value == null ? null : value.toLowerCase();
        }
    }
}
