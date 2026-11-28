package xin.v5ai.basics.file.admin.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import xin.v5ai.basics.file.domain.FileInfo;
import xin.v5ai.basics.file.service.IFileConfigService;
import xin.v5ai.basics.file.service.IFileInfoService;
import xin.v5ai.common.satoken.utils.LoginHelper;
import xin.v5ai.vault.service.model.VaultStoredObject;

import java.io.ByteArrayInputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BasicsFileVaultAssetStorageTest {

    private static final byte[] PNG_HEADER = new byte[]{
        (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52
    };

    @Mock
    private IFileInfoService fileInfoService;

    @Mock
    private IFileConfigService fileConfigService;

    @Test
    void preservesOriginalFilenameWithExtensionWhileKeepingObjectKeyExtensionless() throws Exception {
        String sha = BasicsFileVaultAssetStorage.sha256Hex(PNG_HEADER);
        String expectedKey = "101/vault/202/" + sha.substring(0, 2) + "/" + sha;
        FileInfo saved = new FileInfo();
        saved.setId(501L);
        saved.setConfigId(9L);
        saved.setName("baize-logo.png");
        saved.setPath(expectedKey);
        saved.setType("image/png");

        when(fileInfoService.uploadToConfig(eq(9L), eq("baize-logo.png"), eq(expectedKey), eq(PNG_HEADER)))
            .thenReturn(saved);

        BasicsFileVaultAssetStorage storage = new BasicsFileVaultAssetStorage(fileInfoService, fileConfigService);
        try (MockedStatic<LoginHelper> login = mockStatic(LoginHelper.class)) {
            login.when(LoginHelper::getUserId).thenReturn(101L);

            VaultStoredObject stored = storage.store(
                202L, 9L, new ByteArrayInputStream(PNG_HEADER), PNG_HEADER.length,
                "application/octet-stream", "baize-logo.png");

            assertEquals("501", stored.assetId());
            assertEquals(expectedKey, stored.objectKey());
            assertFalse(stored.objectKey().contains("."));
            assertEquals("image/png", stored.mimeType());
            verify(fileInfoService).uploadToConfig(9L, "baize-logo.png", expectedKey, PNG_HEADER);
        }
    }

    @Test
    void appendsDetectedExtensionWhenOriginalFilenameIsMissingOrGeneric() throws Exception {
        String sha = BasicsFileVaultAssetStorage.sha256Hex(PNG_HEADER);
        String expectedKey = "101/vault/202/" + sha.substring(0, 2) + "/" + sha;
        String expectedDisplayName = sha + ".png";
        FileInfo saved = new FileInfo();
        saved.setId(502L);
        saved.setConfigId(9L);
        saved.setName(expectedDisplayName);
        saved.setPath(expectedKey);
        saved.setType("image/png");

        when(fileInfoService.uploadToConfig(eq(9L), eq(expectedDisplayName), eq(expectedKey), eq(PNG_HEADER)))
            .thenReturn(saved);

        BasicsFileVaultAssetStorage storage = new BasicsFileVaultAssetStorage(fileInfoService, fileConfigService);
        try (MockedStatic<LoginHelper> login = mockStatic(LoginHelper.class)) {
            login.when(LoginHelper::getUserId).thenReturn(101L);

            storage.store(202L, 9L, new ByteArrayInputStream(PNG_HEADER), PNG_HEADER.length,
                "application/octet-stream", "attachment");
            storage.store(202L, 9L, new ByteArrayInputStream(PNG_HEADER), PNG_HEADER.length,
                "application/octet-stream", null);

            verify(fileInfoService, org.mockito.Mockito.times(2))
                .uploadToConfig(9L, expectedDisplayName, expectedKey, PNG_HEADER);
        }
    }
}
