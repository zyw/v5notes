package xin.v5ai.vault.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.json.JsonMapper;
import xin.v5ai.vault.VaultErrorCodes;
import xin.v5ai.vault.catalog.VaultCatalogValidator;
import xin.v5ai.vault.catalog.VaultCatalogZipParser;
import xin.v5ai.vault.domain.VaultCatalogItem;
import xin.v5ai.vault.domain.bo.admin.VaultCatalogSaveBo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminCatalogDetailVo;
import xin.v5ai.vault.domain.vo.admin.VaultCatalogZipPreviewVo;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.mapper.VaultCatalogItemMapper;
import xin.v5ai.vault.service.impl.VaultAdminCatalogServiceImpl;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VaultAdminCatalogServiceTest {

    @Mock
    private VaultCatalogItemMapper itemMapper;

    private VaultAdminCatalogServiceImpl service;
    private final JsonMapper jsonMapper = JsonMapper.builder().build();

    @BeforeEach
    void setUp() {
        service = new VaultAdminCatalogServiceImpl(itemMapper);
    }

    @Test
    void validatorRejectsPublishingAndForbiddenPermissions() {
        VaultCatalogSaveBo tagBo = validPluginBo();
        tagBo.setTags(List.of("Publishing"));
        VaultBusinessException ex1 = assertThrows(VaultBusinessException.class, () -> VaultCatalogValidator.validate(tagBo));
        assertEquals(VaultErrorCodes.PATH_INVALID, ex1.getBusinessCode());

        VaultCatalogSaveBo permBo = validPluginBo();
        permBo.setPermissions(List.of("ui:commands", "publish:*"));
        assertThrows(VaultBusinessException.class, () -> VaultCatalogValidator.validate(permBo));

        VaultCatalogSaveBo netBo = validPluginBo();
        netBo.setPermissions(List.of("network:safe"));
        netBo.setNetworkAllowlist(List.of());
        assertThrows(VaultBusinessException.class, () -> VaultCatalogValidator.validate(netBo));
    }

    @Test
    void validatorChecksThemeScopeAndPermissions() {
        VaultCatalogSaveBo badThemePerm = validThemeBo();
        badThemePerm.setPermissions(List.of("vault:read"));
        assertThrows(VaultBusinessException.class, () -> VaultCatalogValidator.validate(badThemePerm));

        VaultCatalogSaveBo bareRootTheme = validThemeBo();
        bareRootTheme.setFiles(Map.of(
            "manifest.json", "{}",
            "theme.css", ":root { --bg: #fff; --panel: #fff; --ink: #000; --muted: #555; --line: #ccc; }"
        ));
        assertThrows(VaultBusinessException.class, () -> VaultCatalogValidator.validate(bareRootTheme));

        VaultCatalogValidator.ValidatedPackage ok = VaultCatalogValidator.validate(validThemeBo());
        assertEquals("theme", ok.kind());
        assertEquals(List.of("ui:theme"), ok.permissions());
    }

    @Test
    void zipParserAcceptsFlatPackageAndRejectsNestedOrNonUtf8() throws Exception {
        byte[] validZip = zipOf(Map.of(
            "manifest.json", """
                {"id":"demo-ext","name":"Demo","kind":"plugin","version":"1.2.0","permissions":["ui:commands"]}
                """,
            "main.js", "module.exports = class Demo extends Plugin { onload() {} }"
        ));
        VaultCatalogZipPreviewVo preview = VaultCatalogZipParser.parse(new ByteArrayInputStream(validZip), jsonMapper);
        assertEquals("demo-ext", preview.getId());
        assertEquals("1.2.0", preview.getVersion());
        assertTrue(preview.getFiles().containsKey("main.js"));

        byte[] nestedZip = zipOf(Map.of(
            "manifest.json", "{\"id\":\"demo-ext\",\"name\":\"Demo\",\"version\":\"1.0.0\"}",
            "dist/main.js", "module.exports = class {}"
        ));
        assertThrows(VaultBusinessException.class,
            () -> VaultCatalogZipParser.parse(new ByteArrayInputStream(nestedZip), jsonMapper));

        byte[] binaryZip = zipBytesOf(Map.of(
            "manifest.json", "{\"id\":\"demo-ext\",\"name\":\"Demo\",\"version\":\"1.0.0\"}".getBytes(StandardCharsets.UTF_8),
            "main.js", new byte[]{(byte) 0xff, (byte) 0xfe, 0x00}
        ));
        assertThrows(VaultBusinessException.class,
            () -> VaultCatalogZipParser.parse(new ByteArrayInputStream(binaryZip), jsonMapper));
    }

    @Test
    void createStartsAsDraftAndBlocksDeletingPublished() {
        when(itemMapper.selectById("demo-ext")).thenReturn(null);
        VaultAdminCatalogDetailVo created = service.create(validPluginBo());
        assertEquals("0", created.getStatus());
        assertTrue(created.getFiles().containsKey("manifest.json"));

        ArgumentCaptor<VaultCatalogItem> captor = ArgumentCaptor.forClass(VaultCatalogItem.class);
        verify(itemMapper).insert(captor.capture());
        assertEquals("0", captor.getValue().getStatus());

        VaultCatalogItem published = captor.getValue();
        published.setStatus("1");
        when(itemMapper.selectById("demo-ext")).thenReturn(published);
        assertThrows(VaultBusinessException.class, () -> service.delete("demo-ext"));

        service.updateStatus("demo-ext", "2");
        assertEquals("2", published.getStatus());
        service.delete("demo-ext");
        verify(itemMapper).deleteById("demo-ext");
    }

    private static VaultCatalogSaveBo validPluginBo() {
        VaultCatalogSaveBo bo = new VaultCatalogSaveBo();
        bo.setId("demo-ext");
        bo.setName("Demo Ext");
        bo.setKind("plugin");
        bo.setVersion("1.0.0");
        bo.setPermissions(List.of("ui:commands"));
        bo.setTags(List.of("official"));
        bo.setFiles(Map.of("main.js", "module.exports = class Demo extends Plugin {}"));
        return bo;
    }

    private static VaultCatalogSaveBo validThemeBo() {
        VaultCatalogSaveBo bo = new VaultCatalogSaveBo();
        bo.setId("demo-theme");
        bo.setName("Demo Theme");
        bo.setKind("theme");
        bo.setVersion("1.0.0");
        bo.setFiles(Map.of(
            "theme.css",
            ":root[data-community-theme='demo-theme'] { --bg: #fff; --panel: #fff; --ink: #111; --muted: #555; --line: #ddd; --accent: #2f6b47; }"
        ));
        return bo;
    }

    private static byte[] zipOf(Map<String, String> entries) throws Exception {
        Map<String, byte[]> raw = new java.util.LinkedHashMap<>();
        entries.forEach((k, v) -> raw.put(k, v.getBytes(StandardCharsets.UTF_8)));
        return zipBytesOf(raw);
    }

    private static byte[] zipBytesOf(Map<String, byte[]> entries) throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            for (Map.Entry<String, byte[]> e : entries.entrySet()) {
                zos.putNextEntry(new ZipEntry(e.getKey()));
                zos.write(e.getValue());
                zos.closeEntry();
            }
        }
        return baos.toByteArray();
    }
}
