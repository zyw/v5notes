package xin.v5ai.basics.file.admin.service;

import cn.hutool.core.io.file.FileNameUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import xin.v5ai.basics.file.core.utils.FileTypeUtils;
import xin.v5ai.basics.file.core.client.FileClient;
import xin.v5ai.basics.file.core.client.db.DBFileClient;
import xin.v5ai.basics.file.core.client.ftp.FTPFileClient;
import xin.v5ai.basics.file.core.client.s3.S3FileClient;
import xin.v5ai.basics.file.core.client.sftp.SFTPFileClient;
import xin.v5ai.basics.file.core.enums.FileConfigPurpose;
import xin.v5ai.basics.file.domain.FileInfo;
import xin.v5ai.basics.file.service.IFileConfigService;
import xin.v5ai.basics.file.service.IFileInfoService;
import xin.v5ai.common.core.exception.ServiceException;
import xin.v5ai.common.oss.enums.AccessPolicy;
import xin.v5ai.common.satoken.utils.LoginHelper;
import xin.v5ai.vault.VaultErrorCodes;
import xin.v5ai.vault.VaultHttpStatus;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.service.VaultAssetStorage;
import xin.v5ai.vault.service.model.VaultAssetCapability;
import xin.v5ai.vault.service.model.VaultStoredObject;
import xin.v5ai.vault.util.VaultQuotaRules;

import java.io.InputStream;
import java.io.OutputStream;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Attachments on top of the basic-file storage stack (design §4.3).
 *
 * <p>Lives in {@code note-admin-file}, which depends on both {@code note-base-file} and
 * {@code note-vault-sync}; the vault module only sees the {@link VaultAssetStorage} SPI, so the
 * dependency never points back into vault sync.</p>
 *
 * <p><b>Reads follow the {@code configId} recorded on the reference</b>, never the current
 * VAULT_ASSET config: after a backend switch the older attachments still sit in the previous
 * one (design §7.4).</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BasicsFileVaultAssetStorage implements VaultAssetStorage {

    /** Object keys are content-addressed, so a repeated upload writes the same path. */
    private static final String KEY_SEGMENT = "vault";

    private final IFileInfoService fileInfoService;
    private final IFileConfigService fileConfigService;

    @Override
    public VaultStoredObject store(Long vaultId, Long configId, InputStream content, long sizeBytes, String mimeType)
        throws Exception {
        return store(vaultId, configId, content, sizeBytes, mimeType, null);
    }

    @Override
    public VaultStoredObject store(Long vaultId, Long configId, InputStream content, long sizeBytes,
                                   String mimeType, String originalFileName) throws Exception {
        Long target = configId == null ? targetConfigId() : configId;
        byte[] bytes = readBounded(content, VaultQuotaRules.DEFAULT_MAX_FILE_BYTES);
        String sha256 = sha256Hex(bytes);
        String objectKey = buildKey(LoginHelper.getUserId(), vaultId, sha256);
        String displayName = resolveDisplayName(originalFileName, objectKey, bytes);

        FileInfo info = fileInfoService.uploadToConfig(target, displayName, objectKey, bytes);
        String detectedMime = info.getType();
        String resolvedMime = (detectedMime != null && !detectedMime.isBlank()
            && !"application/octet-stream".equalsIgnoreCase(detectedMime))
            ? detectedMime
            : (mimeType != null && !mimeType.isBlank() ? mimeType : detectedMime);
        return new VaultStoredObject(
            String.valueOf(info.getId()),
            info.getConfigId(),
            objectKey,
            "sha256:" + sha256,
            bytes.length,
            resolvedMime
        );
    }

    static String resolveDisplayName(String originalFileName, String objectKey, byte[] bytes) {
        String sanitized = sanitizeOriginalFileName(originalFileName);
        if (sanitized != null) {
            String existingExt = FileNameUtil.getSuffix(sanitized);
            if (existingExt != null && !existingExt.isBlank()) {
                return sanitized;
            }
        }
        String base = sanitized != null ? sanitized : leafOf(objectKey);
        String detectedMime = FileTypeUtils.getMineType(bytes, base);
        String ext = FileTypeUtils.getExtensionByMimeType(detectedMime);
        return (ext == null || ext.isBlank()) ? base : base + "." + ext;
    }

    private static String sanitizeOriginalFileName(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String trimmed = raw.trim();
        int slash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
        String leaf = slash >= 0 ? trimmed.substring(slash + 1).trim() : trimmed;
        if (leaf.isEmpty() || ".".equals(leaf) || "..".equals(leaf) || "attachment".equalsIgnoreCase(leaf)) {
            return null;
        }
        for (int i = 0; i < leaf.length(); i++) {
            if (Character.isISOControl(leaf.charAt(i))) {
                return null;
            }
        }
        return leaf;
    }

    @Override
    public Optional<VaultStoredObject> lookup(Long userId, Long vaultId, String assetId) {
        if (assetId == null || assetId.isBlank() || vaultId == null) {
            return Optional.empty();
        }
        long id;
        try {
            id = Long.parseLong(assetId.trim());
        } catch (NumberFormatException ex) {
            return Optional.empty();
        }
        var info = fileInfoService.queryById(id);
        if (info == null || info.getPath() == null) {
            return Optional.empty();
        }
        String expectedPrefix = (userId == null ? "anonymous" : String.valueOf(userId))
            + "/" + KEY_SEGMENT + "/" + vaultId + "/";
        if (!info.getPath().startsWith(expectedPrefix)) {
            return Optional.empty();
        }
        String leaf = leafOf(info.getPath());
        long size = info.getSize() == null ? 0L : info.getSize();
        return Optional.of(new VaultStoredObject(
            String.valueOf(info.getId()),
            info.getConfigId(),
            info.getPath(),
            "sha256:" + leaf,
            size,
            info.getType()
        ));
    }

    @Override
    public Optional<String> presign(Long configId, String objectKey, int ttlSeconds) {
        FileClient client = fileConfigService.getFileClient(configId);
        if (client instanceof S3FileClient s3 && AccessPolicy.PRIVATE == s3.getAccessPolicy()) {
            return Optional.ofNullable(s3.getPrivateUrl(objectKey, ttlSeconds));
        }
        // FTP / local / DB / SFTP expose no direct URL: the vault proxy endpoint streams instead.
        return Optional.empty();
    }

    @Override
    public void streamTo(Long configId, String objectKey, long offset, long length, OutputStream out)
        throws Exception {
        FileClient client = fileConfigService.getFileClient(configId);
        if (client == null) {
            throw new VaultBusinessException(VaultHttpStatus.SERVICE_UNAVAILABLE,
                VaultErrorCodes.ASSET_STORAGE_UNAVAILABLE, "附件存储配置不可用");
        }
        client.getContentStream(objectKey, offset, length, out);
    }

    @Override
    public void delete(Long configId, String objectKey) throws Exception {
        FileClient client = fileConfigService.getFileClient(configId);
        if (client != null) {
            client.delete(objectKey);
        }
    }

    @Override
    public void deleteOrphan(Long assetId, Long configId, String objectKey) throws Exception {
        if (assetId != null) {
            fileInfoService.deleteWithValidByIds(java.util.List.of(assetId), false);
            return;
        }
        delete(configId, objectKey);
    }

    @Override
    public VaultAssetCapability capability() {
        FileClient client = requirePurposeClient();
        if (client instanceof S3FileClient s3) {
            boolean direct = AccessPolicy.PRIVATE == s3.getAccessPolicy();
            return new VaultAssetCapability(
                VaultAssetCapability.BACKEND_S3,
                direct,
                VaultQuotaRules.DEFAULT_MAX_FILE_BYTES,
                direct ? VaultAssetCapability.CONCURRENT_DIRECT : VaultAssetCapability.CONCURRENT_PROXY
            );
        }
        String backend;
        if (client instanceof FTPFileClient) {
            backend = VaultAssetCapability.BACKEND_FTP;
        } else if (client instanceof SFTPFileClient) {
            backend = VaultAssetCapability.BACKEND_SFTP;
        } else if (client instanceof DBFileClient) {
            backend = VaultAssetCapability.BACKEND_DB;
        } else {
            backend = VaultAssetCapability.BACKEND_LOCAL;
        }
        return VaultAssetCapability.of(backend, VaultQuotaRules.DEFAULT_MAX_FILE_BYTES);
    }

    private static byte[] readBounded(InputStream in, long maxBytes) throws Exception {
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        long total = 0;
        int n;
        while ((n = in.read(buf)) != -1) {
            total += n;
            if (total > maxBytes) {
                throw new VaultBusinessException(VaultHttpStatus.PAYLOAD_TOO_LARGE,
                    VaultErrorCodes.FILE_TOO_LARGE, "单文件超过上限");
            }
            out.write(buf, 0, n);
        }
        return out.toByteArray();
    }

    @Override
    public Long targetConfigId() {
        return requirePurposeClient().getId();
    }

    /**
     * Resolves the VAULT_ASSET backend through {@link IFileConfigService#getByPurpose} so the
     * image library keeps its own {@code master} selection rule completely untouched (E8).
     */
    private FileClient requirePurposeClient() {
        try {
            FileClient client = fileConfigService.getByPurpose(FileConfigPurpose.VAULT_ASSET);
            if (client == null) {
                throw new VaultBusinessException(VaultHttpStatus.SERVICE_UNAVAILABLE,
                    VaultErrorCodes.ASSET_STORAGE_UNAVAILABLE, "附件存储未配置");
            }
            return client;
        } catch (ServiceException ex) {
            throw new VaultBusinessException(VaultHttpStatus.SERVICE_UNAVAILABLE,
                VaultErrorCodes.ASSET_STORAGE_UNAVAILABLE, ex.getMessage());
        }
    }

    /**
     * {@code {userId}/vault/{vaultId}/{sha256[:2]}/{sha256}}.
     *
     * <p>Scoped by {@code vaultId} so deleting an attachment in one vault never removes the
     * physical object referenced by another vault. Extension-less and ASCII-only on purpose:
     * FTP paths with non-ASCII names depend on the NAS charset negotiation.</p>
     */
    static String buildKey(Long userId, Long vaultId, String sha256) {
        String user = userId == null ? "anonymous" : String.valueOf(userId);
        String vault = vaultId == null ? "0" : String.valueOf(vaultId);
        String two = sha256.length() >= 2 ? sha256.substring(0, 2) : sha256;
        return user + "/" + KEY_SEGMENT + "/" + vault + "/" + two + "/" + sha256;
    }

    private static String leafOf(String objectKey) {
        int slash = objectKey.lastIndexOf('/');
        return slash < 0 ? objectKey : objectKey.substring(slash + 1);
    }

    static String sha256Hex(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }
}
