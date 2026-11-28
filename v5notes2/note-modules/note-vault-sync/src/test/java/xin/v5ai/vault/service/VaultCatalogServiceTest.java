package xin.v5ai.vault.service;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import xin.v5ai.vault.catalog.CatalogProtocol;
import xin.v5ai.vault.domain.VaultCatalogItem;
import xin.v5ai.vault.domain.vo.VaultCatalogListVo;
import xin.v5ai.vault.domain.vo.VaultCatalogPackageVo;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.mapper.VaultCatalogItemMapper;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class VaultCatalogServiceTest {

    private final VaultCatalogService service = new VaultCatalogService();

    @Test
    void listIsNonFileSyncAndIndependentVersion() {
        VaultCatalogListVo list = service.list(null);
        assertEquals(CatalogProtocol.PROTOCOL_VERSION, list.getCatalogProtocolVersion());
        assertFalse(list.isFileSyncResource());
        assertTrue(list.getItems().stream().anyMatch(i -> "plugin".equals(i.getKind())));
        assertTrue(list.getItems().stream().anyMatch(i -> "theme".equals(i.getKind())));
    }

    @Test
    void filterByKind() {
        assertEquals(1, service.list("plugin").getItems().size());
        assertEquals(1, service.list("theme").getItems().size());
    }

    @Test
    void packageContainsInstallFiles() {
        VaultCatalogPackageVo pkg = service.packageOf("safe-fetch-demo");
        assertFalse(pkg.isFileSyncResource());
        assertTrue(pkg.getFiles().containsKey("manifest.json"));
        assertTrue(pkg.getFiles().containsKey("main.js"));
    }

    @Test
    void rejectsPublishingTags() {
        assertTrue(VaultCatalogService.hasForbiddenTag(List.of("publishing")));
        assertTrue(VaultCatalogService.hasForbiddenTag(List.of("Publish")));
        assertFalse(VaultCatalogService.hasForbiddenTag(List.of("demo", "network")));
    }

    @Test
    void dbModeExposesOnlyPublishedItems() {
        VaultCatalogItemMapper mapper = Mockito.mock(VaultCatalogItemMapper.class);
        VaultCatalogItem published = new VaultCatalogItem();
        published.setId("my-plugin");
        published.setName("My Plugin");
        published.setKind("plugin");
        published.setVersion("1.0.0");
        published.setPermissionsJson("[\"ui:commands\"]");
        published.setTagsJson("[\"official\"]");
        published.setFilesJson("{\"manifest.json\":\"{}\",\"main.js\":\"module.exports=class{}\"}");
        published.setStatus("1");

        VaultCatalogItem draft = new VaultCatalogItem();
        draft.setId("draft-plugin");
        draft.setStatus("0");

        when(mapper.selectList(any())).thenReturn(List.of(published));
        when(mapper.selectById("draft-plugin")).thenReturn(draft);
        when(mapper.selectById("my-plugin")).thenReturn(published);

        VaultCatalogService dbService = new VaultCatalogService(mapper, null);
        VaultCatalogListVo list = dbService.list(null);
        assertEquals(1, list.getItems().size());
        assertEquals("my-plugin", list.getItems().get(0).getId());
        assertEquals("/vault/v1/catalog/plugins/my-plugin/package", list.getItems().get(0).getPackagePath());
        assertTrue(dbService.packageOf("my-plugin").getFiles().containsKey("main.js"));
        assertThrows(VaultBusinessException.class, () -> dbService.get("draft-plugin"));
    }
}
