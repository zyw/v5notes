package xin.v5ai.vault.service.impl;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.unit.DataSize;
import xin.v5ai.common.core.constant.HttpStatus;
import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.core.utils.StringUtils;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.vault.VaultErrorCodes;
import xin.v5ai.vault.domain.VaultUserQuota;
import xin.v5ai.vault.domain.bo.admin.VaultQuotaPolicyBo;
import xin.v5ai.vault.domain.bo.admin.VaultUserQuotaBo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminUserQuotaVo;
import xin.v5ai.vault.domain.vo.admin.VaultQuotaPolicyVo;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.mapper.VaultAdminMapper;
import xin.v5ai.vault.mapper.VaultUserQuotaMapper;
import xin.v5ai.vault.service.IVaultQuotaService;
import xin.v5ai.vault.service.model.ResolvedVaultQuota;
import xin.v5ai.vault.util.VaultQuotaRules;

import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Vault 两层配额服务实现（P2）。
 *
 * <p>全局默认参数保存在 {@code sys_config}（前缀 {@code vault.sync.}），用户级覆盖保存在
 * {@code vault_user_quota}；所有数值经 {@link #getPolicy()} 短缓存后读取。</p>
 */
@Service
public class VaultQuotaServiceImpl implements IVaultQuotaService {

    public static final String CONFIG_PREFIX = "vault.sync.";
    public static final String KEY_DEFAULT_QUOTA_BYTES = "vault.sync.defaultQuotaBytes";
    public static final String KEY_DEFAULT_REPLICA_LIMIT = "vault.sync.defaultReplicaLimit";
    public static final String KEY_DEFAULT_MAX_FILE_BYTES = "vault.sync.defaultMaxFileBytes";
    public static final String KEY_TOMBSTONE_RETENTION_DAYS = "vault.sync.tombstoneRetentionDays";
    public static final String KEY_ORPHAN_ASSET_GRACE_DAYS = "vault.sync.orphanAssetGraceDays";

    public static final int DEFAULT_TOMBSTONE_RETENTION_DAYS = 90;
    public static final int DEFAULT_ORPHAN_ASSET_GRACE_DAYS = 7;

    private static final long MIN_QUOTA_BYTES = 10L * 1024 * 1024;
    private static final long MIN_FILE_BYTES = 1024L * 1024;
    private static final long POLICY_CACHE_TTL_MS = 30_000L;

    private final VaultAdminMapper adminMapper;
    private final VaultUserQuotaMapper userQuotaMapper;
    private final long multipartMaxFileBytes;

    private volatile CachedPolicy cachedPolicy;

    public VaultQuotaServiceImpl(VaultAdminMapper adminMapper, VaultUserQuotaMapper userQuotaMapper) {
        this(adminMapper, userQuotaMapper, DataSize.ofBytes(VaultQuotaRules.DEFAULT_MAX_FILE_BYTES));
    }

    @Autowired
    public VaultQuotaServiceImpl(
        VaultAdminMapper adminMapper,
        VaultUserQuotaMapper userQuotaMapper,
        @Value("${spring.servlet.multipart.max-file-size:25MB}") DataSize multipartMaxFileSize
    ) {
        this.adminMapper = adminMapper;
        this.userQuotaMapper = userQuotaMapper;
        long bytes = multipartMaxFileSize == null ? VaultQuotaRules.DEFAULT_MAX_FILE_BYTES : multipartMaxFileSize.toBytes();
        this.multipartMaxFileBytes = bytes > 0 ? bytes : VaultQuotaRules.DEFAULT_MAX_FILE_BYTES;
    }

    @Override
    public VaultQuotaPolicyVo getPolicy() {
        CachedPolicy current = cachedPolicy;
        long now = System.currentTimeMillis();
        if (current != null && now < current.expiresAt) {
            return copyPolicy(current.value);
        }
        VaultQuotaPolicyVo loaded = loadPolicyFromDb();
        cachedPolicy = new CachedPolicy(loaded, now + POLICY_CACHE_TTL_MS);
        return copyPolicy(loaded);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public VaultQuotaPolicyVo updatePolicy(VaultQuotaPolicyBo bo) {
        if (bo.getDefaultMaxFileBytes() > multipartMaxFileBytes) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID,
                "默认单文件上限不能超过服务端 multipart 上限（" + (multipartMaxFileBytes / (1024 * 1024)) + "MB）");
        }
        adminMapper.updateSysConfigValue(KEY_DEFAULT_QUOTA_BYTES, String.valueOf(bo.getDefaultQuotaBytes()));
        adminMapper.updateSysConfigValue(KEY_DEFAULT_REPLICA_LIMIT, String.valueOf(bo.getDefaultReplicaLimit()));
        adminMapper.updateSysConfigValue(KEY_DEFAULT_MAX_FILE_BYTES, String.valueOf(bo.getDefaultMaxFileBytes()));
        adminMapper.updateSysConfigValue(KEY_TOMBSTONE_RETENTION_DAYS, String.valueOf(bo.getTombstoneRetentionDays()));
        adminMapper.updateSysConfigValue(KEY_ORPHAN_ASSET_GRACE_DAYS, String.valueOf(bo.getOrphanAssetGraceDays()));
        cachedPolicy = null;
        return getPolicy();
    }

    @Override
    public ResolvedVaultQuota resolveForUser(Long userId) {
        VaultQuotaPolicyVo policy = getPolicy();
        VaultUserQuota override = userId == null ? null : userQuotaMapper.selectById(userId);
        if (override == null || isExpired(override.getExpireTime())) {
            return new ResolvedVaultQuota(
                policy.getDefaultQuotaBytes(),
                policy.getDefaultReplicaLimit(),
                policy.getDefaultMaxFileBytes(),
                "vault-default",
                false
            );
        }
        long quota = override.getQuotaBytes() != null ? override.getQuotaBytes() : policy.getDefaultQuotaBytes();
        int replicas = override.getReplicaLimit() != null ? override.getReplicaLimit() : policy.getDefaultReplicaLimit();
        long maxFile = override.getMaxFileBytes() != null ? override.getMaxFileBytes() : policy.getDefaultMaxFileBytes();
        String planName = StringUtils.isNotBlank(override.getPlanName()) ? override.getPlanName().trim() : "vault-custom";
        return new ResolvedVaultQuota(quota, replicas, maxFile, planName, true);
    }

    @Override
    public PageResult<VaultAdminUserQuotaVo> listUserQuotas(String keyword, PageQuery pageQuery) {
        VaultQuotaPolicyVo policy = getPolicy();
        Page<VaultAdminUserQuotaVo> page = adminMapper.selectUserQuotaPage(
            pageQuery.build(),
            StringUtils.isBlank(keyword) ? null : keyword.trim(),
            policy.getDefaultQuotaBytes(),
            policy.getDefaultReplicaLimit(),
            policy.getDefaultMaxFileBytes()
        );
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void upsertUserQuota(Long userId, VaultUserQuotaBo bo) {
        if (userId == null || adminMapper.existsUserById(userId) <= 0) {
            throw new VaultBusinessException(HttpStatus.NOT_FOUND, VaultErrorCodes.NOT_FOUND, "用户不存在");
        }
        if (bo.getQuotaBytes() != null && bo.getQuotaBytes() < MIN_QUOTA_BYTES) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, "容量上限不能低于 10MB");
        }
        if (bo.getReplicaLimit() != null && (bo.getReplicaLimit() < 1 || bo.getReplicaLimit() > 50)) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, "副本上限需在 1~50 之间");
        }
        if (bo.getMaxFileBytes() != null) {
            if (bo.getMaxFileBytes() < MIN_FILE_BYTES) {
                throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, "单文件上限不能低于 1MB");
            }
            if (bo.getMaxFileBytes() > multipartMaxFileBytes) {
                throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID,
                    "单文件上限不能超过服务端 multipart 上限（" + (multipartMaxFileBytes / (1024 * 1024)) + "MB）");
            }
        }
        VaultUserQuota existing = userQuotaMapper.selectById(userId);
        Date now = new Date();
        VaultUserQuota entity = existing == null ? new VaultUserQuota() : existing;
        entity.setUserId(userId);
        entity.setQuotaBytes(bo.getQuotaBytes());
        entity.setReplicaLimit(bo.getReplicaLimit());
        entity.setMaxFileBytes(bo.getMaxFileBytes());
        entity.setPlanName(StringUtils.isBlank(bo.getPlanName()) ? null : bo.getPlanName().trim());
        entity.setExpireTime(bo.getExpireTime());
        entity.setRemark(StringUtils.isBlank(bo.getRemark()) ? null : bo.getRemark().trim());
        entity.setUpdateTime(now);
        if (existing == null) {
            entity.setCreateTime(now);
            userQuotaMapper.insert(entity);
        } else {
            userQuotaMapper.updateById(entity);
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteUserQuota(Long userId) {
        if (userId == null || userQuotaMapper.selectById(userId) == null) {
            throw new VaultBusinessException(HttpStatus.NOT_FOUND, VaultErrorCodes.NOT_FOUND, "用户配额覆盖记录不存在");
        }
        userQuotaMapper.deleteById(userId);
    }

    private VaultQuotaPolicyVo loadPolicyFromDb() {
        List<Map<String, Object>> rows = adminMapper.selectSysConfigsByPrefix(CONFIG_PREFIX);
        Map<String, String> byKey = new HashMap<>();
        if (rows != null) {
            for (Map<String, Object> row : rows) {
                String key = getStringIgnoreCase(row, "configKey");
                String val = getStringIgnoreCase(row, "configValue");
                if (key != null && val != null) {
                    byKey.put(key, val.trim());
                }
            }
        }
        VaultQuotaPolicyVo vo = new VaultQuotaPolicyVo();
        vo.setDefaultQuotaBytes(parsePositiveLong(byKey.get(KEY_DEFAULT_QUOTA_BYTES), VaultQuotaRules.DEFAULT_QUOTA_BYTES));
        vo.setDefaultReplicaLimit((int) parsePositiveLong(byKey.get(KEY_DEFAULT_REPLICA_LIMIT), VaultQuotaRules.DEFAULT_REPLICA_LIMIT));
        vo.setDefaultMaxFileBytes(parsePositiveLong(byKey.get(KEY_DEFAULT_MAX_FILE_BYTES), VaultQuotaRules.DEFAULT_MAX_FILE_BYTES));
        vo.setTombstoneRetentionDays((int) parsePositiveLong(byKey.get(KEY_TOMBSTONE_RETENTION_DAYS), DEFAULT_TOMBSTONE_RETENTION_DAYS));
        vo.setOrphanAssetGraceDays((int) parsePositiveLong(byKey.get(KEY_ORPHAN_ASSET_GRACE_DAYS), DEFAULT_ORPHAN_ASSET_GRACE_DAYS));
        vo.setMultipartMaxFileBytes(multipartMaxFileBytes);
        return vo;
    }

    private static VaultQuotaPolicyVo copyPolicy(VaultQuotaPolicyVo src) {
        VaultQuotaPolicyVo copy = new VaultQuotaPolicyVo();
        copy.setDefaultQuotaBytes(src.getDefaultQuotaBytes());
        copy.setDefaultReplicaLimit(src.getDefaultReplicaLimit());
        copy.setDefaultMaxFileBytes(src.getDefaultMaxFileBytes());
        copy.setTombstoneRetentionDays(src.getTombstoneRetentionDays());
        copy.setOrphanAssetGraceDays(src.getOrphanAssetGraceDays());
        copy.setMultipartMaxFileBytes(src.getMultipartMaxFileBytes());
        return copy;
    }

    private static boolean isExpired(Date expireTime) {
        return expireTime != null && !expireTime.after(new Date());
    }

    private static long parsePositiveLong(String raw, long fallback) {
        if (StringUtils.isBlank(raw)) {
            return fallback;
        }
        try {
            long parsed = Long.parseLong(raw.trim());
            return parsed > 0 ? parsed : fallback;
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private static String getStringIgnoreCase(Map<String, Object> row, String key) {
        if (row.containsKey(key)) {
            Object v = row.get(key);
            return v == null ? null : v.toString();
        }
        for (Map.Entry<String, Object> entry : row.entrySet()) {
            if (entry.getKey() != null && entry.getKey().equalsIgnoreCase(key)) {
                return entry.getValue() == null ? null : entry.getValue().toString();
            }
        }
        return null;
    }

    private record CachedPolicy(VaultQuotaPolicyVo value, long expiresAt) {
    }
}
