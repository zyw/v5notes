package xin.v5ai.vault.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import xin.v5ai.vault.domain.VaultChange;
import xin.v5ai.vault.domain.VaultFile;
import xin.v5ai.vault.domain.VaultSpace;
import xin.v5ai.vault.mapper.VaultChangeMapper;
import xin.v5ai.vault.mapper.VaultReplicaMapper;
import xin.v5ai.vault.mapper.VaultFileBlobMapper;
import xin.v5ai.vault.mapper.VaultFileMapper;
import xin.v5ai.vault.mapper.VaultSpaceMapper;
import xin.v5ai.vault.service.impl.VaultSyncServiceImpl;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Manifest pagination semantics (design §8.2): page limit probe + hasMore flag +
 * cursor equals the max change id in the returned page.
 */
@ExtendWith(MockitoExtension.class)
class VaultSyncManifestPaginationTest {

    @Mock
    private VaultSpaceMapper spaceMapper;
    @Mock
    private VaultReplicaMapper replicaMapper;
    @Mock
    private VaultFileMapper fileMapper;
    @Mock
    private VaultFileBlobMapper blobMapper;
    @Mock
    private VaultChangeMapper changeMapper;

    private VaultSyncServiceImpl service() {
        return new VaultSyncServiceImpl(spaceMapper, replicaMapper, fileMapper, blobMapper, changeMapper);
    }

    private VaultChange change(long id) {
        VaultChange c = new VaultChange();
        c.setId(id);
        c.setVaultId(1L);
        c.setFileId(id);
        c.setOp("upsert");
        c.setPath("p/" + id + ".md");
        c.setRemoteRev(1L);
        return c;
    }

    private void stubOwnedVault() {
        VaultSpace space = new VaultSpace();
        space.setId(1L);
        space.setUserId(7L);
        when(spaceMapper.selectById(1L)).thenReturn(space);
    }

    @Test
    void pageReturnsHasMoreFalseWhenUnderLimit() {
        stubOwnedVault();
        // LIMIT probe = 501 rows requested; 3 returned → no more pages.
        List<VaultChange> rows = List.of(change(1), change(2), change(3));
        when(changeMapper.selectList(any())).thenReturn(new ArrayList<>(rows));
        when(fileMapper.selectCount(any())).thenReturn(0L);

        var vo = service().manifest(7L, 1L, "0");
        assertFalse(vo.getHasMore());
        assertEquals(3, vo.getChanges().size());
        assertEquals("3", vo.getCursor());
        // empty flag reflects no live files
        assertTrue(vo.getEmpty());
    }

    @Test
    void pageReturnsHasMoreTrueAndCapsAtLimitWhenProbeFindsExtra() {
        stubOwnedVault();
        List<VaultChange> rows = new ArrayList<>();
        for (long i = 1; i <= VaultSyncServiceImpl.MANIFEST_PAGE_LIMIT + 1; i++) {
            rows.add(change(i));
        }
        when(changeMapper.selectList(any())).thenReturn(rows);
        when(fileMapper.selectCount(any())).thenReturn(1L);

        var vo = service().manifest(7L, 1L, "0");
        assertTrue(vo.getHasMore());
        assertEquals(VaultSyncServiceImpl.MANIFEST_PAGE_LIMIT, vo.getChanges().size());
        assertEquals(String.valueOf(VaultSyncServiceImpl.MANIFEST_PAGE_LIMIT), vo.getCursor());
        assertFalse(vo.getEmpty());
    }

    @Test
    void selectListQueryRequestsLimitPlusOneProbe() throws Exception {
        stubOwnedVault();
        when(changeMapper.selectList(any())).thenReturn(new ArrayList<>());
        when(fileMapper.selectCount(any())).thenReturn(0L);

        service().manifest(7L, 1L, "0");

        // The pagination probe relies on requesting LIMIT (page + 1) from the DB.
        @SuppressWarnings("unchecked")
        ArgumentCaptor<com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<VaultChange>> captor =
            ArgumentCaptor.forClass(com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper.class);
        org.mockito.Mockito.verify(changeMapper).selectList(captor.capture());
        var field = com.baomidou.mybatisplus.core.conditions.AbstractWrapper.class.getDeclaredField("lastSql");
        field.setAccessible(true);
        var lastSql = (com.baomidou.mybatisplus.core.conditions.SharedString) field.get(captor.getValue());
        assertTrue(String.valueOf(lastSql.getStringValue()).contains("LIMIT " + (VaultSyncServiceImpl.MANIFEST_PAGE_LIMIT + 1)),
            "expected probe limit, got: " + lastSql.getStringValue());
    }

    @Test
    void emptyPageKeepsClientCursorAndNullHasMoreUnsetIsAbsent() {
        stubOwnedVault();
        when(changeMapper.selectList(any())).thenReturn(new ArrayList<>());
        when(fileMapper.selectCount(any())).thenReturn(0L);

        var vo = service().manifest(7L, 1L, "12345");
        assertFalse(vo.getHasMore());
        assertEquals("12345", vo.getCursor());
        assertNull(vo.getChanges().isEmpty() ? null : "unexpected", "changes must be empty");
        assertTrue(vo.getChanges().isEmpty());
    }
}
