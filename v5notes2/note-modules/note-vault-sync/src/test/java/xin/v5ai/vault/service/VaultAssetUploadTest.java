package xin.v5ai.vault.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import xin.v5ai.vault.VaultErrorCodes;
import xin.v5ai.vault.VaultHttpStatus;
import xin.v5ai.vault.domain.VaultAssetRef;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.mapper.VaultAssetRefMapper;
import xin.v5ai.vault.service.impl.VaultAssetServiceImpl;
import xin.v5ai.vault.service.model.VaultAssetDownload;
import xin.v5ai.vault.service.model.VaultAssetCapability;
import xin.v5ai.vault.service.model.VaultStoredObject;
import xin.v5ai.vault.util.VaultContentHash;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Upload dedup, hash verification and download routing (design §4.1 / §4.3).
 */
@ExtendWith(MockitoExtension.class)
class VaultAssetUploadTest {

    @Mock
    private VaultAssetRefMapper refMapper;

    @Mock
    private ObjectProvider<VaultAssetStorage> storageProvider;

    @Mock
    private VaultAssetStorage storage;

    private VaultAssetServiceImpl service() {
        return new VaultAssetServiceImpl(refMapper, storageProvider);
    }

    private static byte[] bytes(String text) {
        return text.getBytes(StandardCharsets.UTF_8);
    }

    @Test
    void storesAndVerifiesStreamedHash() throws Exception {
        byte[] body = bytes("attachment-body");
        String sha = VaultContentHash.ofBytes(body);
        when(storageProvider.getIfAvailable()).thenReturn(storage);
        when(storage.targetConfigId()).thenReturn(9L);
        when(storage.capability()).thenReturn(VaultAssetCapability.of("ftp", 25L * 1024 * 1024));
        when(refMapper.selectOne(any())).thenReturn(null);
        when(storage.store(eq(9L), any(), eq((long) body.length), any()))
            .thenReturn(new VaultStoredObject("77", 9L, "1/vault/ab/ab", sha, body.length, "image/png"));
        lenient().when(storage.capability()).thenReturn(VaultAssetCapability.of("ftp", 25L * 1024 * 1024));

        IVaultAssetService.StoredResult result = service().upload(
            1L, 2L, new ByteArrayInputStream(body), body.length, sha, "image/png");

        assertEquals("77", result.assetId());
        assertEquals(sha, result.sha256());
        assertTrue(!result.deduped());
    }

    @Test
    void mismatchDeletesTheStoredObject() throws Exception {
        byte[] body = bytes("real");
        String wrong = VaultContentHash.ofBytes(bytes("declared"));
        when(storageProvider.getIfAvailable()).thenReturn(storage);
        when(storage.targetConfigId()).thenReturn(9L);
        when(refMapper.selectOne(any())).thenReturn(null);
        // Storage reports a hash that does not match the declared one.
        String actual = VaultContentHash.ofBytes(body);
        when(storage.store(anyLong(), any(), anyLong(), any()))
            .thenReturn(new VaultStoredObject("88", 9L, "1/vault/cd/cd", actual, body.length, "image/png"));

        VaultBusinessException ex = assertThrows(VaultBusinessException.class, () ->
            service().upload(1L, 2L, new ByteArrayInputStream(body), body.length, wrong, "image/png"));

        assertEquals(VaultErrorCodes.HASH_MISMATCH, ex.getBusinessCode());
        assertEquals(409, ex.getHttpStatus());
        verify(storage).delete(eq(9L), eq("1/vault/cd/cd"));
    }

    @Test
    void dedupHitSkipsTheBackend() throws Exception {
        byte[] body = bytes("same-bytes");
        String sha = VaultContentHash.ofBytes(body);
        VaultAssetRef existing = new VaultAssetRef();
        existing.setAssetId(55L);
        existing.setSha256(sha);
        existing.setSizeBytes(10L);
        when(refMapper.selectOne(any())).thenReturn(existing);

        IVaultAssetService.StoredResult result = service().upload(
            1L, 2L, new ByteArrayInputStream(body), body.length, sha, "image/png");

        assertTrue(result.deduped());
        assertEquals("55", result.assetId());
        verify(storageProvider, never()).getIfAvailable();
    }

    @Test
    void oversizeIsRejectedBeforeTouchingStorage() {
        VaultBusinessException ex = assertThrows(VaultBusinessException.class, () ->
            service().upload(1L, 2L, new ByteArrayInputStream(new byte[0]),
                26L * 1024 * 1024, VaultContentHash.ofBytes(new byte[0]), "image/png"));
        assertEquals(VaultErrorCodes.FILE_TOO_LARGE, ex.getBusinessCode());
        assertEquals(VaultHttpStatus.PAYLOAD_TOO_LARGE, ex.getHttpStatus());
    }

    @Test
    void directBackendReturnsPresignedLink() throws Exception {
        VaultAssetRef ref = new VaultAssetRef();
        ref.setAssetId(1L);
        ref.setConfigId(9L);
        ref.setStorageKey("1/vault/ab/ab");
        when(storageProvider.getIfAvailable()).thenReturn(storage);
        when(storage.presign(anyLong(), anyString(), anyInt())).thenReturn(Optional.of("https://oss/x"));

        VaultAssetDownload download = service().download(2L, ref);

        assertEquals(VaultAssetDownload.MODE_DIRECT, download.mode());
        assertEquals("https://oss/x", download.url());
    }

    @Test
    void proxyBackendFallsBackToVaultEndpoint() throws Exception {
        VaultAssetRef ref = new VaultAssetRef();
        ref.setAssetId(42L);
        ref.setConfigId(9L);
        ref.setStorageKey("1/vault/cd/cd");
        when(storageProvider.getIfAvailable()).thenReturn(storage);
        when(storage.presign(anyLong(), anyString(), anyInt())).thenReturn(Optional.empty());

        VaultAssetDownload download = service().download(2L, ref);

        assertEquals(VaultAssetDownload.MODE_PROXY, download.mode());
        assertEquals("/vault/v1/vaults/2/assets/42/content", download.url());
    }

    @Test
    void unconfiguredStorageIsRetryable503() {
        when(storageProvider.getIfAvailable()).thenReturn(null);
        VaultBusinessException ex = assertThrows(VaultBusinessException.class,
            () -> service().capability());
        assertEquals(VaultErrorCodes.ASSET_STORAGE_UNAVAILABLE, ex.getBusinessCode());
        assertEquals(VaultHttpStatus.SERVICE_UNAVAILABLE, ex.getHttpStatus());
    }

    @Test
    void lastReferenceDeletesTheObject() throws Exception {
        VaultAssetRef ref = new VaultAssetRef();
        ref.setAssetId(5L);
        ref.setConfigId(9L);
        ref.setStorageKey("1/vault/ee/ee");
        when(storageProvider.getIfAvailable()).thenReturn(storage);
        lenient().when(refMapper.selectCount(any())).thenReturn(0L);
        lenient().when(refMapper.deleteById(anyLong())).thenReturn(1);

        service().releaseReference(100L, ref);

        verify(storage).delete(eq(9L), eq("1/vault/ee/ee"));
    }

    @Test
    void remainingReferenceKeepsTheObject() throws Exception {
        VaultAssetRef ref = new VaultAssetRef();
        ref.setAssetId(5L);
        ref.setConfigId(9L);
        ref.setStorageKey("1/vault/ff/ff");
        lenient().when(refMapper.selectCount(any())).thenReturn(2L);

        service().releaseReference(100L, ref);

        verify(storage, never()).delete(anyLong(), anyString());
    }

    @Test
    void invalidDeclaredHashIsBadRequest() {
        VaultBusinessException ex = assertThrows(VaultBusinessException.class, () ->
            service().upload(1L, 2L, new ByteArrayInputStream(new byte[0]), 0, "not-a-hash", null));
        assertEquals(VaultErrorCodes.PATH_INVALID, ex.getBusinessCode());
    }
}
