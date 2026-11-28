package xin.v5ai.vault.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.util.unit.DataSize;
import xin.v5ai.vault.VaultErrorCodes;
import xin.v5ai.vault.domain.VaultUserQuota;
import xin.v5ai.vault.domain.bo.admin.VaultQuotaPolicyBo;
import xin.v5ai.vault.domain.bo.admin.VaultUserQuotaBo;
import xin.v5ai.vault.domain.vo.admin.VaultQuotaPolicyVo;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.mapper.VaultAdminMapper;
import xin.v5ai.vault.mapper.VaultUserQuotaMapper;
import xin.v5ai.vault.service.impl.VaultQuotaServiceImpl;
import xin.v5ai.vault.service.model.ResolvedVaultQuota;
import xin.v5ai.vault.util.VaultQuotaRules;

import java.util.Date;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VaultQuotaServiceTest {

    @Mock
    private VaultAdminMapper adminMapper;
    @Mock
    private VaultUserQuotaMapper userQuotaMapper;

    private VaultQuotaServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new VaultQuotaServiceImpl(adminMapper, userQuotaMapper, DataSize.ofMegabytes(25));
    }

    @Test
    void policyLoadsConfiguredValuesAndRejectsExceedingMultipartLimit() {
        when(adminMapper.selectSysConfigsByPrefix(VaultQuotaServiceImpl.CONFIG_PREFIX)).thenReturn(List.of(
            Map.of("configKey", VaultQuotaServiceImpl.KEY_DEFAULT_QUOTA_BYTES, "configValue", "2147483648"),
            Map.of("configKey", VaultQuotaServiceImpl.KEY_DEFAULT_REPLICA_LIMIT, "configValue", "5"),
            Map.of("configKey", VaultQuotaServiceImpl.KEY_DEFAULT_MAX_FILE_BYTES, "configValue", "20971520"),
            Map.of("configKey", VaultQuotaServiceImpl.KEY_TOMBSTONE_RETENTION_DAYS, "configValue", "120"),
            Map.of("configKey", VaultQuotaServiceImpl.KEY_ORPHAN_ASSET_GRACE_DAYS, "configValue", "14")
        ));

        VaultQuotaPolicyVo vo = service.getPolicy();
        assertEquals(2147483648L, vo.getDefaultQuotaBytes());
        assertEquals(5, vo.getDefaultReplicaLimit());
        assertEquals(20971520L, vo.getDefaultMaxFileBytes());
        assertEquals(120, vo.getTombstoneRetentionDays());
        assertEquals(14, vo.getOrphanAssetGraceDays());
        assertEquals(25L * 1024 * 1024, vo.getMultipartMaxFileBytes());

        VaultQuotaPolicyBo bad = new VaultQuotaPolicyBo();
        bad.setDefaultQuotaBytes(VaultQuotaRules.DEFAULT_QUOTA_BYTES);
        bad.setDefaultReplicaLimit(3);
        bad.setDefaultMaxFileBytes(30L * 1024 * 1024);
        bad.setTombstoneRetentionDays(90);
        bad.setOrphanAssetGraceDays(7);

        VaultBusinessException ex = assertThrows(VaultBusinessException.class, () -> service.updatePolicy(bad));
        assertEquals(VaultErrorCodes.PATH_INVALID, ex.getBusinessCode());
    }

    @Test
    void resolveForUserAppliesActiveOverrideAndFallsBackWhenExpired() {
        when(adminMapper.selectSysConfigsByPrefix(VaultQuotaServiceImpl.CONFIG_PREFIX)).thenReturn(List.of());

        VaultUserQuota active = new VaultUserQuota();
        active.setUserId(10L);
        active.setQuotaBytes(5L * 1024 * 1024 * 1024);
        active.setReplicaLimit(null); // inherit default
        active.setMaxFileBytes(10L * 1024 * 1024);
        active.setPlanName("vault-pro");
        active.setExpireTime(new Date(System.currentTimeMillis() + 60_000L));
        when(userQuotaMapper.selectById(10L)).thenReturn(active);

        ResolvedVaultQuota resolved = service.resolveForUser(10L);
        assertTrue(resolved.overridden());
        assertEquals(5L * 1024 * 1024 * 1024, resolved.quotaBytes());
        assertEquals(VaultQuotaRules.DEFAULT_REPLICA_LIMIT, resolved.replicaLimit());
        assertEquals(10L * 1024 * 1024, resolved.maxFileBytes());
        assertEquals("vault-pro", resolved.planName());

        VaultUserQuota expired = new VaultUserQuota();
        expired.setUserId(11L);
        expired.setQuotaBytes(9L * 1024 * 1024 * 1024);
        expired.setExpireTime(new Date(System.currentTimeMillis() - 60_000L));
        when(userQuotaMapper.selectById(11L)).thenReturn(expired);

        ResolvedVaultQuota fallback = service.resolveForUser(11L);
        assertFalse(fallback.overridden());
        assertEquals(VaultQuotaRules.DEFAULT_QUOTA_BYTES, fallback.quotaBytes());
        assertEquals("vault-default", fallback.planName());
    }

    @Test
    void upsertUserQuotaRejectsUnknownUser() {
        when(adminMapper.existsUserById(999L)).thenReturn(0L);
        VaultUserQuotaBo bo = new VaultUserQuotaBo();
        bo.setQuotaBytes(200L * 1024 * 1024);

        VaultBusinessException ex = assertThrows(VaultBusinessException.class, () -> service.upsertUserQuota(999L, bo));
        assertEquals(VaultErrorCodes.NOT_FOUND, ex.getBusinessCode());
    }
}
