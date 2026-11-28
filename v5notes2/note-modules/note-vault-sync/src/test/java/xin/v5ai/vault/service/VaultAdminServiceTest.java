package xin.v5ai.vault.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.vault.VaultErrorCodes;
import xin.v5ai.vault.domain.VaultAssetRef;
import xin.v5ai.vault.domain.VaultChange;
import xin.v5ai.vault.domain.VaultFile;
import xin.v5ai.vault.domain.VaultSpace;
import xin.v5ai.vault.domain.vo.admin.VaultAdminAssetVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminFileContentVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminOverviewVo;
import xin.v5ai.vault.domain.vo.admin.VaultCleanupResultVo;
import xin.v5ai.vault.domain.vo.admin.VaultMaintenanceStatsVo;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.mapper.VaultAdminMapper;
import xin.v5ai.vault.mapper.VaultChangeMapper;
import xin.v5ai.vault.mapper.VaultFileMapper;
import xin.v5ai.vault.mapper.VaultReplicaMapper;
import xin.v5ai.vault.mapper.VaultSpaceMapper;
import xin.v5ai.vault.service.impl.VaultAdminServiceImpl;
import xin.v5ai.vault.service.model.VaultAssetCapability;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VaultAdminServiceTest {

    @Mock
    private VaultAdminMapper adminMapper;
    @Mock
    private VaultSpaceMapper spaceMapper;
    @Mock
    private VaultReplicaMapper replicaMapper;
    @Mock
    private VaultFileMapper fileMapper;
    @Mock
    private VaultChangeMapper changeMapper;
    @Mock
    private IVaultAssetService assetService;

    private VaultAdminServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new VaultAdminServiceImpl(
            adminMapper, spaceMapper, replicaMapper, fileMapper, changeMapper, assetService);
    }

    @Test
    void overviewFillsMissingDaysAndAggregatesOps() {
        when(adminMapper.selectOverviewCounts(anyLong())).thenReturn(Map.ofEntries(
            Map.entry("totalSpaces", 3L),
            Map.entry("activeUsers", 2L),
            Map.entry("totalReplicas", 4L),
            Map.entry("uniqueDevices", 2L),
            Map.entry("totalFiles", 10L),
            Map.entry("noteFiles", 7L),
            Map.entry("assetFiles", 2L),
            Map.entry("configFiles", 1L),
            Map.entry("totalUsedBytes", 4096L),
            Map.entry("assetBytes", 2048L),
            Map.entry("overQuotaUsers", 0L)
        ));
        String today = LocalDate.now().toString();
        when(adminMapper.selectChangeTrend(any())).thenReturn(List.of(
            Map.of("day", today, "op", "upsert", "cnt", 5L),
            Map.of("day", today, "op", "delete", "cnt", 2L)
        ));
        when(assetService.capability()).thenReturn(VaultAssetCapability.of("local", 25L * 1024 * 1024));

        VaultAdminOverviewVo vo = service.overview(7);

        assertEquals(3L, vo.getTotalSpaces());
        assertEquals(2L, vo.getActiveUsers());
        assertEquals(4L, vo.getTotalReplicas());
        assertEquals(10L, vo.getTotalFiles());
        assertEquals(7, vo.getTrend().size());
        assertEquals(today, vo.getTrend().get(6).getDay());
        assertEquals(5L, vo.getTrend().get(6).getUpsertCount());
        assertEquals(2L, vo.getTrend().get(6).getDeleteCount());
        assertEquals(0L, vo.getTrend().get(6).getRenameCount());
        assertNotNull(vo.getAssetStorage());
    }

    @Test
    void deleteFileWritesTombstoneAndAppendsDeleteChange() {
        VaultSpace space = new VaultSpace();
        space.setId(100L);
        space.setUsedBytes(1000L);
        when(spaceMapper.selectById(100L)).thenReturn(space);

        VaultFile file = new VaultFile();
        file.setId(200L);
        file.setVaultId(100L);
        file.setPath("notes/a.md");
        file.setFileType("note");
        file.setContentHash("sha256:abc");
        file.setSizeBytes(300L);
        file.setRev(3L);
        file.setDeleted(0);
        when(fileMapper.selectById(200L)).thenReturn(file);

        service.deleteFile(100L, 200L);

        assertEquals(1, file.getDeleted());
        assertEquals(4L, file.getRev());
        assertNull(file.getContent());
        verify(fileMapper).updateById(file);
        assertEquals(700L, space.getUsedBytes());
        verify(spaceMapper).updateById(space);

        ArgumentCaptor<VaultChange> captor = ArgumentCaptor.forClass(VaultChange.class);
        verify(changeMapper).insert(captor.capture());
        assertEquals("delete", captor.getValue().getOp());
        assertEquals(4L, captor.getValue().getRemoteRev());
        assertEquals("notes/a.md", captor.getValue().getPath());
    }

    @Test
    void deleteAssetFileReleasesAssetReference() {
        VaultSpace space = new VaultSpace();
        space.setId(100L);
        space.setUsedBytes(500L);
        when(spaceMapper.selectById(100L)).thenReturn(space);

        VaultFile file = new VaultFile();
        file.setId(201L);
        file.setVaultId(100L);
        file.setPath("attachments/a.png");
        file.setFileType("asset");
        file.setSizeBytes(500L);
        file.setRev(1L);
        file.setDeleted(0);
        when(fileMapper.selectById(201L)).thenReturn(file);

        VaultAssetRef ref = new VaultAssetRef();
        ref.setFileId(201L);
        ref.setAssetId(900L);
        when(assetService.findByFileId(201L)).thenReturn(ref);

        service.deleteFile(100L, 201L);

        verify(assetService).releaseReference(201L, ref);
        assertEquals(0L, space.getUsedBytes());
    }

    @Test
    void getFileContentReadsBodyForNoteAndMetaForAsset() {
        VaultSpace space = new VaultSpace();
        space.setId(100L);
        when(spaceMapper.selectById(100L)).thenReturn(space);

        VaultFile note = new VaultFile();
        note.setId(300L);
        note.setVaultId(100L);
        note.setPath("hello.md");
        note.setFileType("note");
        note.setDeleted(0);
        note.setRev(2L);
        note.setSizeBytes(12L);
        when(fileMapper.selectById(300L)).thenReturn(note);
        when(fileMapper.selectContentById(300L)).thenReturn("# Hello");

        VaultAdminFileContentVo noteVo = service.getFileContent(100L, 300L);
        assertEquals("# Hello", noteVo.getBody());
        assertNull(noteVo.getAssetId());

        VaultFile asset = new VaultFile();
        asset.setId(301L);
        asset.setVaultId(100L);
        asset.setPath("pic.png");
        asset.setFileType("asset");
        asset.setDeleted(0);
        asset.setRev(1L);
        when(fileMapper.selectById(301L)).thenReturn(asset);
        VaultAssetRef ref = new VaultAssetRef();
        ref.setAssetId(888L);
        ref.setMimeType("image/png");
        ref.setBackend("s3");
        ref.setConfigId(12L);
        ref.setStorageKey("1/vault/100/aa/aabb");
        when(assetService.findByFileId(301L)).thenReturn(ref);

        VaultAdminFileContentVo assetVo = service.getFileContent(100L, 301L);
        assertNull(assetVo.getBody());
        assertEquals("888", assetVo.getAssetId());
        assertEquals("s3", assetVo.getBackend());
    }

    @Test
    void deleteSpaceRejectsMissingVault() {
        when(spaceMapper.selectById(999L)).thenReturn(null);
        VaultBusinessException ex = assertThrows(VaultBusinessException.class, () -> service.deleteSpace(999L));
        assertEquals(VaultErrorCodes.NOT_FOUND, ex.getBusinessCode());
    }

    @Test
    void maintenanceStatsAndCleanupsWorkWithStorageSpi() throws Exception {
        @SuppressWarnings("unchecked")
        ObjectProvider<VaultAssetStorage> storageProvider = mock(ObjectProvider.class);
        VaultAssetStorage storage = mock(VaultAssetStorage.class);
        when(storageProvider.getIfAvailable()).thenReturn(storage);

        VaultAdminServiceImpl withStorage = new VaultAdminServiceImpl(
            adminMapper, spaceMapper, replicaMapper, fileMapper, changeMapper, assetService, null, storageProvider);

        when(adminMapper.selectOrphanAssetStats(any())).thenReturn(Map.of("orphanCount", 2L, "orphanBytes", 4096L));
        when(adminMapper.selectExpiredTombstoneCount(any())).thenReturn(5L);

        VaultMaintenanceStatsVo stats = withStorage.getMaintenanceStats();
        assertEquals(2L, stats.getOrphanAssetCount());
        assertEquals(4096L, stats.getOrphanAssetBytes());
        assertEquals(5L, stats.getExpiredTombstoneCount());

        when(adminMapper.selectOrphanAssetCandidates(any(), anyInt())).thenReturn(List.of(
            Map.of("id", 11L, "configId", 1L, "path", "1/vault/10/aa/aabb", "size", 1024L),
            Map.of("id", 12L, "configId", 1L, "path", "1/vault/10/cc/ccdd", "size", 2048L)
        ));
        doNothing().when(storage).deleteOrphan(11L, 1L, "1/vault/10/aa/aabb");
        doThrow(new RuntimeException("io error")).when(storage).deleteOrphan(12L, 1L, "1/vault/10/cc/ccdd");

        VaultCleanupResultVo orphanRes = withStorage.cleanupOrphanAssets();
        assertEquals(1L, orphanRes.getDeletedCount());
        assertEquals(1024L, orphanRes.getFreedBytes());
        assertEquals(1L, orphanRes.getFailedCount());

        when(adminMapper.deleteExpiredTombstones(any())).thenReturn(5);
        VaultCleanupResultVo tombstoneRes = withStorage.cleanupExpiredTombstones();
        assertEquals(5L, tombstoneRes.getDeletedCount());
    }

    @Test
    void listAssetsGlobalNormalizesFiltersWithoutSpaceCheck() {
        VaultAdminAssetVo row = new VaultAdminAssetVo();
        row.setAssetId("1001");
        row.setVaultId("2001");
        row.setVaultName("Work");
        row.setFileName("pic.png");
        Page<VaultAdminAssetVo> page = new Page<>(1, 20);
        page.setRecords(List.of(row));
        page.setTotal(1L);
        when(adminMapper.selectAssetPage(any(), isNull(), eq("pic"), eq("s3"), eq("image/"))).thenReturn(page);

        PageQuery query = new PageQuery(20, 1);
        PageResult<VaultAdminAssetVo> res = service.listAssets(null, "  pic ", " S3 ", " Image/ ", query);

        assertEquals(1L, res.getTotal());
        assertEquals(1, res.getRows().size());
        assertEquals("1001", res.getRows().iterator().next().getAssetId());
        verify(spaceMapper, never()).selectById(any());
        verify(adminMapper).selectAssetPage(any(), isNull(), eq("pic"), eq("s3"), eq("image/"));
    }

    @Test
    void listAssetsScopedRejectsMissingVault() {
        when(spaceMapper.selectById(999L)).thenReturn(null);
        PageQuery query = new PageQuery(20, 1);
        VaultBusinessException ex = assertThrows(VaultBusinessException.class,
            () -> service.listAssets(999L, null, null, null, query));
        assertEquals(VaultErrorCodes.NOT_FOUND, ex.getBusinessCode());
        verify(adminMapper, never()).selectAssetPage(any(), any(), any(), any(), any());
    }
}
