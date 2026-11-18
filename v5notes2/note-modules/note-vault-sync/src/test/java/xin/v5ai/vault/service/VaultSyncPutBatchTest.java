package xin.v5ai.vault.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import xin.v5ai.common.core.constant.HttpStatus;
import xin.v5ai.vault.VaultErrorCodes;
import xin.v5ai.vault.domain.VaultChange;
import xin.v5ai.vault.domain.VaultFile;
import xin.v5ai.vault.domain.VaultFileBlob;
import xin.v5ai.vault.domain.VaultSpace;
import xin.v5ai.vault.domain.bo.VaultFilePutBo;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.mapper.VaultChangeMapper;
import xin.v5ai.vault.mapper.VaultDeviceMapper;
import xin.v5ai.vault.mapper.VaultFileBlobMapper;
import xin.v5ai.vault.mapper.VaultFileMapper;
import xin.v5ai.vault.mapper.VaultSpaceMapper;
import xin.v5ai.vault.service.impl.VaultSyncServiceImpl;
import xin.v5ai.vault.util.VaultContentHash;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Batch write semantics (design §8.2 recommended endpoint): sequential apply, and a
 * declared-hash mismatch now surfaces as {@code vault.hash.mismatch} instead of the
 * malformed-path code (conflict/quota family stays intact).
 */
@ExtendWith(MockitoExtension.class)
class VaultSyncPutBatchTest {

    @Mock
    private VaultSpaceMapper spaceMapper;
    @Mock
    private VaultDeviceMapper deviceMapper;
    @Mock
    private VaultFileMapper fileMapper;
    @Mock
    private VaultFileBlobMapper blobMapper;
    @Mock
    private VaultChangeMapper changeMapper;

    private VaultSyncServiceImpl service() {
        return new VaultSyncServiceImpl(spaceMapper, deviceMapper, fileMapper, blobMapper, changeMapper);
    }

    private void stubOwnedVault() {
        VaultSpace space = new VaultSpace();
        space.setId(1L);
        space.setUserId(7L);
        space.setUsedBytes(0L);
        lenient().when(spaceMapper.selectById(1L)).thenReturn(space);
    }

    private void stubNoLiveIdentity() {
        lenient().when(fileMapper.selectOne(any())).thenReturn(null);
    }

    private VaultFilePutBo putBo(String path, String text) {
        VaultFilePutBo bo = new VaultFilePutBo();
        bo.setPath(path);
        bo.setHash(VaultContentHash.ofBytes(text.getBytes(StandardCharsets.UTF_8)));
        bo.setBody(text);
        return bo;
    }

    @Test
    void batchAppliesItemsInOrder() {
        stubOwnedVault();
        stubNoLiveIdentity();
        when(changeMapper.insert(any(VaultChange.class))).thenAnswer(inv -> 1);
        var metas = service().putBatch(7L, 1L, List.of(
            putBo("a.md", "# A"), putBo("b.md", "# B")));
        assertEquals(2, metas.size());
        verify(fileMapper, times(2)).insert(any(VaultFile.class));
    }

    @Test
    void hashMismatchUsesDedicatedCode() {
        stubOwnedVault();
        VaultFilePutBo bo = new VaultFilePutBo();
        bo.setPath("bad.md");
        bo.setBody("# real bytes");
        bo.setHash(VaultContentHash.ofBytes("different".getBytes(StandardCharsets.UTF_8)));

        VaultBusinessException ex = assertThrows(VaultBusinessException.class,
            () -> service().putFile(7L, 1L, bo));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        assertEquals(VaultErrorCodes.HASH_MISMATCH, ex.getBusinessCode());
        verify(fileMapper, never()).insert(any(VaultFile.class));
    }

    @Test
    void blobReuseDoesNotReinsert() {
        String text = "# shared";
        String hash = VaultContentHash.ofBytes(text.getBytes(StandardCharsets.UTF_8));
        VaultFileBlob existing = new VaultFileBlob();
        existing.setContentHash(hash);
        existing.setContent(text.getBytes(StandardCharsets.UTF_8));
        when(blobMapper.selectById(hash)).thenReturn(existing);

        // ensureBlob is private; exercise it through a real first upload of shared content.
        when(fileMapper.selectOne(any())).thenReturn(null)
            .thenReturn(null);
        stubOwnedVault();
        when(changeMapper.insert(any(VaultChange.class))).thenAnswer(inv -> 1);
        service().putFile(7L, 1L, putBo("shared.md", text));
        verify(blobMapper, never()).insert(any(VaultFileBlob.class));
        verify(blobMapper, never()).updateById(any(VaultFileBlob.class));
        verify(blobMapper, never()).insert(any(VaultFileBlob.class));
    }
}
