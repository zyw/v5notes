package xin.v5ai.vault.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import xin.v5ai.vault.domain.VaultFile;
import xin.v5ai.vault.domain.VaultSpace;
import xin.v5ai.vault.domain.bo.VaultFileDeleteBo;
import xin.v5ai.vault.domain.bo.VaultFilePutBo;
import xin.v5ai.vault.mapper.VaultChangeMapper;
import xin.v5ai.vault.mapper.VaultReplicaMapper;
import xin.v5ai.vault.mapper.VaultFileMapper;
import xin.v5ai.vault.mapper.VaultSpaceMapper;
import xin.v5ai.vault.service.impl.VaultSyncServiceImpl;
import xin.v5ai.vault.util.VaultContentHash;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Text body storage and retrieval (design §4.2.1 / D6).
 *
 * <p>The body lives on {@code vault_file.content}, which the entity never loads by default;
 * {@code getContent} reaches for it through a dedicated projection instead.</p>
 */
@ExtendWith(MockitoExtension.class)
class VaultSyncContentTest {

    /** Lambda wrappers need the TableInfo cache that the Spring context normally provides. */
    @org.junit.jupiter.api.BeforeAll
    static void initTableInfo() {
        com.baomidou.mybatisplus.core.metadata.TableInfoHelper.initTableInfo(
            new org.apache.ibatis.builder.MapperBuilderAssistant(new org.apache.ibatis.session.Configuration(), ""),
            VaultFile.class);
    }

    @Mock
    private VaultSpaceMapper spaceMapper;
    @Mock
    private VaultReplicaMapper replicaMapper;
    @Mock
    private VaultFileMapper fileMapper;
    @Mock
    private IVaultAssetService assetService;
    @Mock
    private VaultChangeMapper changeMapper;

    private VaultSyncServiceImpl service() {
        return new VaultSyncServiceImpl(spaceMapper, replicaMapper, fileMapper, changeMapper, assetService);
    }

    /** Assigns the change id the way the mapper's snowflake id generator would. */
    private void selectIdOnInsert(long id) {
        org.mockito.Mockito.lenient()
            .doAnswer(inv -> {
                ((xin.v5ai.vault.domain.VaultChange) inv.getArgument(0)).setId(id);
                return 1;
            })
            .when(changeMapper).insert(any(xin.v5ai.vault.domain.VaultChange.class));
    }

    private void stubVault(long usedBytes) {
        VaultSpace space = new VaultSpace();
        space.setId(1L);
        space.setUserId(7L);
        space.setUsedBytes(usedBytes);
        lenient().when(spaceMapper.selectById(1L)).thenReturn(space);
    }

    @Test
    void noteBodyIsPersistedOnTheRowAndReadBackByProjection() throws Exception {
        stubVault(0L);
        String body = "# 标题\n\n正文";
        VaultFilePutBo bo = new VaultFilePutBo();
        bo.setPath("notes/a.md");
        bo.setType("note");
        bo.setBody(body);
        bo.setHash(VaultContentHash.ofText(body));

        when(fileMapper.selectOne(any())).thenReturn(null);
        selectIdOnInsert(42L);

        service().putFile(7L, 1L, bo);

        org.mockito.ArgumentCaptor<VaultFile> saved = org.mockito.ArgumentCaptor.forClass(VaultFile.class);
        verify(fileMapper).insert(saved.capture());
        assertEquals(body, saved.getValue().getContent());

        // Reading goes through the explicit projection, never a full-row load.
        VaultFile live = new VaultFile();
        live.setId(9L);
        live.setVaultId(1L);
        live.setPath("notes/a.md");
        live.setFileType("note");
        live.setRev(1L);
        live.setSizeBytes(10L);
        live.setContentHash(VaultContentHash.ofText(body));
        when(fileMapper.selectOne(any())).thenReturn(live);
        when(fileMapper.selectContentById(anyLong())).thenReturn(body);

        var vo = service().getContent(7L, 1L, "notes/a.md", null);

        assertEquals(body, vo.getBody());
        verify(fileMapper).selectContentById(9L);
    }

    @Test
    void deletedNoteDropsItsBody() throws Exception {
        stubVault(50L);
        VaultFile live = new VaultFile();
        live.setId(9L);
        live.setVaultId(1L);
        live.setPath("notes/a.md");
        live.setFileType("note");
        live.setRev(2L);
        live.setDeleted(0);
        live.setSizeBytes(50L);
        when(fileMapper.selectOne(any())).thenReturn(live);
        selectIdOnInsert(43L);

        VaultFilePutBo del = new VaultFilePutBo();
        del.setPath("notes/a.md");
        del.setBaseRev(2L);
        service().deleteFile(7L, 1L, deleteBo("notes/a.md", 2L));

        org.mockito.ArgumentCaptor<VaultFile> saved = org.mockito.ArgumentCaptor.forClass(VaultFile.class);
        verify(fileMapper).updateById(saved.capture());
        // Tombstoned rows must not keep the body around.
        assertEquals(null, saved.getValue().getContent());
        assertEquals(1, saved.getValue().getDeleted());
        verify(assetService, never()).releaseReference(anyLong(), any());
    }

    private static VaultFileDeleteBo deleteBo(String path, long rev) {
        VaultFileDeleteBo bo = new VaultFileDeleteBo();
        bo.setPath(path);
        bo.setBaseRev(rev);
        return bo;
    }
}
