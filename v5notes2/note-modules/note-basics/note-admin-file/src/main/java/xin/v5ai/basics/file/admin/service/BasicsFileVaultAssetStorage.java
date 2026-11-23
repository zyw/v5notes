package xin.v5ai.basics.file.admin.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import xin.v5ai.basics.file.core.client.FileClient;
import xin.v5ai.basics.file.core.client.s3.S3FileClient;
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
    public VaultStoredObject store(Long configId, InputStream content, long sizeBytes, String mimeType)
        throws Exception {
        Long target = configId == null ? targetConfigId() : configId;
        byte[] bytes = content.readAllBytes();
        String sha256 = sha256Hex(bytes);
        String objectKey = buildKey(LoginHelper.getUserId(), sha256);

        FileInfo info = fileInfoService.uploadToConfig(target, leafOf(objectKey), objectKey, bytes);
        return new VaultStoredObject(
            String.valueOf(info.getId()),
            info.getConfigId(),
            objectKey,
            "sha256:" + sha256,
            bytes.length,
            mimeType
        );
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
    public VaultAssetCapability capability() {
        FileClient client = requirePurposeClient();
        String backend = client instanceof S3FileClient
            ? VaultAssetCapability.BACKEND_S3
            : VaultAssetCapability.BACKEND_LOCAL;
        return VaultAssetCapability.of(backend, VaultQuotaRules.DEFAULT_MAX_FILE_BYTES);
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
     * {@code {userId}/vault/{sha256[:2]}/{sha256}}.
     *
     * <p>Extension-less and ASCII-only on purpose: FTP paths with non-ASCII names depend on the
     * NAS charset negotiation, and a hash needs none of it. The MIME type travels in the database.</p>
     */
    static String buildKey(Long userId, String sha256) {
        String user = userId == null ? "anonymous" : String.valueOf(userId);
        String two = sha256.length() >= 2 ? sha256.substring(0, 2) : sha256;
        return user + "/" + KEY_SEGMENT + "/" + two + "/" + sha256;
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
