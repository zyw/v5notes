package xin.v5ai.vault.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import xin.v5ai.common.core.constant.HttpStatus;
import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.core.utils.StringUtils;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.vault.VaultErrorCodes;
import xin.v5ai.vault.domain.VaultAssetRef;
import xin.v5ai.vault.domain.VaultChange;
import xin.v5ai.vault.domain.VaultFile;
import xin.v5ai.vault.domain.VaultReplica;
import xin.v5ai.vault.domain.VaultSpace;
import xin.v5ai.vault.domain.vo.admin.VaultAdminAssetVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminChangeVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminFileContentVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminFileVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminOverviewVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminReplicaVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminSpaceVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminStorageRankVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminTrendPointVo;
import xin.v5ai.vault.domain.vo.admin.VaultCleanupResultVo;
import xin.v5ai.vault.domain.vo.admin.VaultMaintenanceStatsVo;
import xin.v5ai.vault.domain.vo.admin.VaultQuotaPolicyVo;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.mapper.VaultAdminMapper;
import xin.v5ai.vault.mapper.VaultChangeMapper;
import xin.v5ai.vault.mapper.VaultFileMapper;
import xin.v5ai.vault.mapper.VaultReplicaMapper;
import xin.v5ai.vault.mapper.VaultSpaceMapper;
import xin.v5ai.vault.service.IVaultAdminService;
import xin.v5ai.vault.service.IVaultAssetService;
import xin.v5ai.vault.service.IVaultQuotaService;
import xin.v5ai.vault.service.VaultAssetStorage;
import xin.v5ai.vault.util.VaultQuotaRules;

import java.io.OutputStream;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * 管理端 Vault 同步观测与运维服务实现。
 *
 * <p>遵循本地权威原则：不提供在线编辑正文能力；文件删除走标准同步协议墓碑（deleted=1、rev+1、追加
 * {@code vault_change}），避免破坏客户端增量同步状态机。</p>
 */
@Slf4j
@Service
public class VaultAdminServiceImpl implements IVaultAdminService {

    private static final int ORPHAN_CLEANUP_BATCH_LIMIT = 200;

    private final VaultAdminMapper adminMapper;
    private final VaultSpaceMapper spaceMapper;
    private final VaultReplicaMapper replicaMapper;
    private final VaultFileMapper fileMapper;
    private final VaultChangeMapper changeMapper;
    private final IVaultAssetService assetService;
    private final ObjectProvider<IVaultQuotaService> quotaServiceProvider;
    private final ObjectProvider<VaultAssetStorage> storageProvider;

    public VaultAdminServiceImpl(VaultAdminMapper adminMapper,
                                 VaultSpaceMapper spaceMapper,
                                 VaultReplicaMapper replicaMapper,
                                 VaultFileMapper fileMapper,
                                 VaultChangeMapper changeMapper,
                                 IVaultAssetService assetService) {
        this(adminMapper, spaceMapper, replicaMapper, fileMapper, changeMapper, assetService, null, null);
    }

    @Autowired
    public VaultAdminServiceImpl(VaultAdminMapper adminMapper,
                                 VaultSpaceMapper spaceMapper,
                                 VaultReplicaMapper replicaMapper,
                                 VaultFileMapper fileMapper,
                                 VaultChangeMapper changeMapper,
                                 IVaultAssetService assetService,
                                 ObjectProvider<IVaultQuotaService> quotaServiceProvider,
                                 ObjectProvider<VaultAssetStorage> storageProvider) {
        this.adminMapper = adminMapper;
        this.spaceMapper = spaceMapper;
        this.replicaMapper = replicaMapper;
        this.fileMapper = fileMapper;
        this.changeMapper = changeMapper;
        this.assetService = assetService;
        this.quotaServiceProvider = quotaServiceProvider;
        this.storageProvider = storageProvider;
    }

    @Override
    public VaultAdminOverviewVo overview(int range) {
        int days = (range == 7 || range == 30 || range == 90) ? range : 30;
        VaultQuotaPolicyVo policy = currentPolicy();
        Map<String, Object> counts = adminMapper.selectOverviewCounts(policy.getDefaultQuotaBytes());

        VaultAdminOverviewVo vo = new VaultAdminOverviewVo();
        vo.setTotalSpaces(toLong(counts, "totalSpaces"));
        vo.setActiveUsers(toLong(counts, "activeUsers"));
        vo.setTotalReplicas(toLong(counts, "totalReplicas"));
        vo.setUniqueDevices(toLong(counts, "uniqueDevices"));
        vo.setTotalFiles(toLong(counts, "totalFiles"));
        vo.setNoteFiles(toLong(counts, "noteFiles"));
        vo.setAssetFiles(toLong(counts, "assetFiles"));
        vo.setConfigFiles(toLong(counts, "configFiles"));
        vo.setTotalUsedBytes(toLong(counts, "totalUsedBytes"));
        vo.setAssetBytes(toLong(counts, "assetBytes"));
        vo.setOverQuotaUsers(toLong(counts, "overQuotaUsers"));
        vo.setDefaultQuotaBytes(policy.getDefaultQuotaBytes());
        vo.setDefaultReplicaLimit(policy.getDefaultReplicaLimit());
        vo.setDefaultMaxFileBytes(policy.getDefaultMaxFileBytes());
        try {
            vo.setAssetStorage(assetService.capability());
        } catch (VaultBusinessException ex) {
            vo.setAssetStorage(null);
        }

        LocalDate today = LocalDate.now();
        LocalDate startDay = today.minusDays(days - 1L);
        Date since = Date.from(startDay.atStartOfDay(ZoneId.systemDefault()).toInstant());
        List<Map<String, Object>> rawTrend = adminMapper.selectChangeTrend(since);
        Map<String, VaultAdminTrendPointVo> byDay = new HashMap<>(days * 2);
        for (int i = 0; i < days; i++) {
            String key = startDay.plusDays(i).toString();
            byDay.put(key, new VaultAdminTrendPointVo(key, 0L, 0L, 0L));
        }
        if (rawTrend != null) {
            for (Map<String, Object> row : rawTrend) {
                Object dayObj = getIgnoreCase(row, "day");
                Object opObj = getIgnoreCase(row, "op");
                if (dayObj == null || opObj == null) {
                    continue;
                }
                String dayKey = dayObj.toString().substring(0, Math.min(10, dayObj.toString().length()));
                VaultAdminTrendPointVo point = byDay.get(dayKey);
                if (point == null) {
                    continue;
                }
                long cnt = toLong(row, "cnt");
                String op = opObj.toString().toLowerCase(Locale.ROOT);
                switch (op) {
                    case "upsert" -> point.setUpsertCount(point.getUpsertCount() + cnt);
                    case "delete" -> point.setDeleteCount(point.getDeleteCount() + cnt);
                    case "rename" -> point.setRenameCount(point.getRenameCount() + cnt);
                    default -> {
                    }
                }
            }
        }
        List<VaultAdminTrendPointVo> trend = new ArrayList<>(days);
        for (int i = 0; i < days; i++) {
            trend.add(byDay.get(startDay.plusDays(i).toString()));
        }
        vo.setTrend(trend);
        return vo;
    }

    @Override
    public List<VaultAdminStorageRankVo> storageTop(int limit) {
        int size = limit < 1 ? 10 : Math.min(limit, 50);
        VaultQuotaPolicyVo policy = currentPolicy();
        Page<VaultAdminStorageRankVo> page = new Page<>(1, size, false);
        adminMapper.selectStorageRank(page, policy.getDefaultQuotaBytes());
        return page.getRecords();
    }

    @Override
    public PageResult<VaultAdminSpaceVo> listSpaces(String keyword, String name, String status, PageQuery pageQuery) {
        String normalizedStatus = normalizeSpaceStatus(status);
        VaultQuotaPolicyVo policy = currentPolicy();
        Page<VaultAdminSpaceVo> page = adminMapper.selectSpacePage(
            pageQuery.build(),
            blankToNull(keyword),
            blankToNull(name),
            normalizedStatus,
            policy.getDefaultQuotaBytes(),
            policy.getDefaultReplicaLimit()
        );
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public VaultAdminSpaceVo getSpace(Long vaultId) {
        VaultQuotaPolicyVo policy = currentPolicy();
        VaultAdminSpaceVo vo = adminMapper.selectSpaceById(
            vaultId,
            policy.getDefaultQuotaBytes(),
            policy.getDefaultReplicaLimit()
        );
        if (vo == null) {
            throw new VaultBusinessException(HttpStatus.NOT_FOUND, VaultErrorCodes.NOT_FOUND, "云端库不存在");
        }
        return vo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteSpace(Long vaultId) {
        VaultSpace space = requireSpace(vaultId);
        // 解除所有副本绑定
        replicaMapper.delete(new LambdaQueryWrapper<VaultReplica>().eq(VaultReplica::getVaultId, vaultId));
        // 清理活跃文件正文并释放附件引用计数
        List<VaultFile> liveFiles = fileMapper.selectList(new LambdaQueryWrapper<VaultFile>()
            .eq(VaultFile::getVaultId, vaultId)
            .eq(VaultFile::getDeleted, 0));
        Date now = new Date();
        for (VaultFile file : liveFiles) {
            file.setDeleted(1);
            file.setRev((file.getRev() == null ? 0L : file.getRev()) + 1);
            file.setContent(null);
            file.setUpdateTime(now);
            fileMapper.updateById(file);
            if ("asset".equals(file.getFileType())) {
                assetService.releaseReference(file.getId(), assetService.findByFileId(file.getId()));
            }
        }
        space.setUsedBytes(0L);
        spaceMapper.updateById(space);
        spaceMapper.deleteById(vaultId);
    }

    @Override
    public PageResult<VaultAdminFileVo> listFiles(Long vaultId, String keyword, String fileType,
                                                  Boolean includeDeleted, PageQuery pageQuery) {
        requireSpace(vaultId);
        LambdaQueryWrapper<VaultFile> lqw = new LambdaQueryWrapper<VaultFile>()
            .eq(VaultFile::getVaultId, vaultId);
        if (!Boolean.TRUE.equals(includeDeleted)) {
            lqw.eq(VaultFile::getDeleted, 0);
        }
        String kw = blankToNull(keyword);
        if (kw != null) {
            lqw.like(VaultFile::getPath, kw);
        }
        String type = blankToNull(fileType);
        if (type != null) {
            lqw.eq(VaultFile::getFileType, type.toLowerCase(Locale.ROOT));
        }
        lqw.orderByDesc(VaultFile::getUpdateTime).orderByDesc(VaultFile::getId);

        Page<VaultFile> page = fileMapper.selectPage(pageQuery.build(), lqw);
        List<VaultAdminFileVo> rows = new ArrayList<>(page.getRecords().size());
        for (VaultFile file : page.getRecords()) {
            rows.add(toFileVo(file));
        }
        return PageResult.build(rows, page.getTotal());
    }

    @Override
    public VaultAdminFileContentVo getFileContent(Long vaultId, Long fileId) {
        requireSpace(vaultId);
        VaultFile file = fileMapper.selectById(fileId);
        if (file == null || !Objects.equals(file.getVaultId(), vaultId)) {
            throw new VaultBusinessException(HttpStatus.NOT_FOUND, VaultErrorCodes.FILE_NOT_FOUND, "文件不存在");
        }
        VaultAdminFileContentVo vo = new VaultAdminFileContentVo();
        vo.setFileId(String.valueOf(file.getId()));
        vo.setVaultId(String.valueOf(file.getVaultId()));
        vo.setPath(file.getPath());
        vo.setFileType(file.getFileType());
        vo.setContentHash(file.getContentHash());
        vo.setSizeBytes(file.getSizeBytes() == null ? 0L : file.getSizeBytes());
        vo.setRev(file.getRev() == null ? 0L : file.getRev());
        vo.setDeleted(file.getDeleted() != null && file.getDeleted() == 1);

        if ("asset".equals(file.getFileType())) {
            VaultAssetRef ref = assetService.findByFileId(file.getId());
            if (ref != null) {
                vo.setAssetId(ref.getAssetId() == null ? null : String.valueOf(ref.getAssetId()));
                vo.setMimeType(ref.getMimeType());
                vo.setStorageKey(ref.getStorageKey());
                vo.setConfigId(ref.getConfigId() == null ? null : String.valueOf(ref.getConfigId()));
                vo.setBackend(ref.getBackend());
            }
            return vo;
        }
        if (!vo.isDeleted()) {
            String body = fileMapper.selectContentById(file.getId());
            vo.setBody(body == null ? "" : body);
        }
        return vo;
    }

    @Override
    public VaultAssetRef requireAssetForAdminRead(Long vaultId, String assetId) {
        requireSpace(vaultId);
        VaultAssetRef ref = assetService.findByAssetIdForRead(vaultId, assetId);
        if (ref == null) {
            throw new VaultBusinessException(HttpStatus.NOT_FOUND, VaultErrorCodes.ASSET_NOT_FOUND, "附件对象不存在");
        }
        return ref;
    }

    @Override
    public void streamAssetContent(VaultAssetRef ref, OutputStream out) throws Exception {
        long size = ref.getSizeBytes() == null ? 0L : ref.getSizeBytes();
        assetService.streamTo(ref, 0L, size, out);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteFile(Long vaultId, Long fileId) {
        VaultSpace space = requireSpace(vaultId);
        VaultFile file = fileMapper.selectById(fileId);
        if (file == null || !Objects.equals(file.getVaultId(), vaultId)) {
            throw new VaultBusinessException(HttpStatus.NOT_FOUND, VaultErrorCodes.FILE_NOT_FOUND, "文件不存在");
        }
        if (file.getDeleted() != null && file.getDeleted() == 1) {
            return;
        }
        long size = file.getSizeBytes() == null ? 0L : file.getSizeBytes();
        long nextRev = (file.getRev() == null ? 0L : file.getRev()) + 1;
        Date now = new Date();

        file.setDeleted(1);
        file.setRev(nextRev);
        file.setContent(null);
        file.setUpdateTime(now);
        fileMapper.updateById(file);

        if ("asset".equals(file.getFileType())) {
            assetService.releaseReference(file.getId(), assetService.findByFileId(file.getId()));
        }

        long currentUsed = space.getUsedBytes() == null ? 0L : space.getUsedBytes();
        space.setUsedBytes(Math.max(0L, currentUsed - size));
        spaceMapper.updateById(space);

        VaultChange change = new VaultChange();
        change.setId(IdWorker.getId());
        change.setVaultId(vaultId);
        change.setFileId(file.getId());
        change.setOp("delete");
        change.setPath(file.getPath());
        change.setContentHash(file.getContentHash());
        change.setSizeBytes(0L);
        change.setRemoteRev(nextRev);
        change.setCreateTime(now);
        changeMapper.insert(change);
    }

    @Override
    public PageResult<VaultAdminAssetVo> listAssets(Long vaultId, String keyword, PageQuery pageQuery) {
        return listAssets(vaultId, keyword, null, null, pageQuery);
    }

    @Override
    public PageResult<VaultAdminAssetVo> listAssets(Long vaultId, String keyword, String backend,
                                                  String mimePrefix, PageQuery pageQuery) {
        if (vaultId != null) {
            requireSpace(vaultId);
        }
        String normBackend = blankToNull(backend);
        if (normBackend != null) {
            normBackend = normBackend.toLowerCase(Locale.ROOT);
        }
        String normMimePrefix = blankToNull(mimePrefix);
        if (normMimePrefix != null) {
            normMimePrefix = normMimePrefix.toLowerCase(Locale.ROOT);
        }
        Page<VaultAdminAssetVo> page = adminMapper.selectAssetPage(
            pageQuery.build(),
            vaultId,
            blankToNull(keyword),
            normBackend,
            normMimePrefix
        );
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public PageResult<VaultAdminChangeVo> listChanges(Long vaultId, String op, String keyword, PageQuery pageQuery) {
        requireSpace(vaultId);
        LambdaQueryWrapper<VaultChange> lqw = new LambdaQueryWrapper<VaultChange>()
            .eq(VaultChange::getVaultId, vaultId);
        String opNorm = blankToNull(op);
        if (opNorm != null) {
            lqw.eq(VaultChange::getOp, opNorm.toLowerCase(Locale.ROOT));
        }
        String kw = blankToNull(keyword);
        if (kw != null) {
            lqw.and(w -> w.like(VaultChange::getPath, kw).or().like(VaultChange::getFromPath, kw));
        }
        lqw.orderByDesc(VaultChange::getId);

        Page<VaultChange> page = changeMapper.selectPage(pageQuery.build(), lqw);
        List<VaultAdminChangeVo> rows = new ArrayList<>(page.getRecords().size());
        for (VaultChange change : page.getRecords()) {
            rows.add(toChangeVo(change));
        }
        return PageResult.build(rows, page.getTotal());
    }

    @Override
    public PageResult<VaultAdminReplicaVo> listReplicas(Long vaultId, String keyword, String deviceId,
                                                        Integer inactiveDays, PageQuery pageQuery) {
        Date inactiveBefore = null;
        if (inactiveDays != null && inactiveDays > 0) {
            inactiveBefore = Date.from(Instant.now().minus(inactiveDays, ChronoUnit.DAYS));
        }
        Page<VaultAdminReplicaVo> page = adminMapper.selectReplicaPage(
            pageQuery.build(),
            vaultId,
            blankToNull(keyword),
            blankToNull(deviceId),
            inactiveBefore
        );
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void kickReplica(Long id) {
        VaultReplica replica = replicaMapper.selectById(id);
        if (replica == null) {
            throw new VaultBusinessException(HttpStatus.NOT_FOUND, VaultErrorCodes.NOT_FOUND, "副本绑定记录不存在");
        }
        replicaMapper.deleteById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int kickReplicas(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return 0;
        }
        return replicaMapper.deleteByIds(ids);
    }

    @Override
    public VaultMaintenanceStatsVo getMaintenanceStats() {
        VaultQuotaPolicyVo policy = currentPolicy();
        Date orphanCutoff = cutoffDaysAgo(policy.getOrphanAssetGraceDays());
        Date tombstoneCutoff = cutoffDaysAgo(policy.getTombstoneRetentionDays());

        Map<String, Object> orphanStats = adminMapper.selectOrphanAssetStats(orphanCutoff);
        VaultMaintenanceStatsVo vo = new VaultMaintenanceStatsVo();
        vo.setOrphanAssetCount(toLong(orphanStats, "orphanCount"));
        vo.setOrphanAssetBytes(toLong(orphanStats, "orphanBytes"));
        vo.setExpiredTombstoneCount(adminMapper.selectExpiredTombstoneCount(tombstoneCutoff));
        vo.setOrphanAssetGraceDays(policy.getOrphanAssetGraceDays());
        vo.setTombstoneRetentionDays(policy.getTombstoneRetentionDays());
        try {
            vo.setAssetStorage(assetService.capability());
        } catch (VaultBusinessException ex) {
            vo.setAssetStorage(null);
        }
        return vo;
    }

    @Override
    public VaultCleanupResultVo cleanupOrphanAssets() {
        VaultAssetStorage storage = storageProvider == null ? null : storageProvider.getIfAvailable();
        if (storage == null) {
            return new VaultCleanupResultVo(0L, 0L, 0L);
        }
        VaultQuotaPolicyVo policy = currentPolicy();
        Date cutoff = cutoffDaysAgo(policy.getOrphanAssetGraceDays());
        List<Map<String, Object>> candidates = adminMapper.selectOrphanAssetCandidates(cutoff, ORPHAN_CLEANUP_BATCH_LIMIT);
        if (candidates == null || candidates.isEmpty()) {
            return new VaultCleanupResultVo(0L, 0L, 0L);
        }
        long deleted = 0L;
        long freedBytes = 0L;
        long failed = 0L;
        for (Map<String, Object> row : candidates) {
            long assetId = toLong(row, "id");
            long configId = toLong(row, "configId");
            Object pathObj = getIgnoreCase(row, "path");
            String path = pathObj == null ? null : pathObj.toString();
            long size = toLong(row, "size");
            try {
                storage.deleteOrphan(assetId > 0 ? assetId : null, configId > 0 ? configId : null, path);
                deleted++;
                freedBytes += Math.max(0L, size);
            } catch (Exception ex) {
                failed++;
                log.warn("[cleanupOrphanAssets][清理孤儿附件失败][assetId({}) path({})] {}", assetId, path, ex.getMessage());
            }
        }
        return new VaultCleanupResultVo(deleted, freedBytes, failed);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public VaultCleanupResultVo cleanupExpiredTombstones() {
        VaultQuotaPolicyVo policy = currentPolicy();
        Date cutoff = cutoffDaysAgo(policy.getTombstoneRetentionDays());
        int deleted = adminMapper.deleteExpiredTombstones(cutoff);
        return new VaultCleanupResultVo(Math.max(0L, deleted), 0L, 0L);
    }

    private VaultQuotaPolicyVo currentPolicy() {
        IVaultQuotaService quotaService = quotaServiceProvider == null ? null : quotaServiceProvider.getIfAvailable();
        if (quotaService != null) {
            return quotaService.getPolicy();
        }
        VaultQuotaPolicyVo fallback = new VaultQuotaPolicyVo();
        fallback.setDefaultQuotaBytes(VaultQuotaRules.DEFAULT_QUOTA_BYTES);
        fallback.setDefaultReplicaLimit(VaultQuotaRules.DEFAULT_REPLICA_LIMIT);
        fallback.setDefaultMaxFileBytes(VaultQuotaRules.DEFAULT_MAX_FILE_BYTES);
        fallback.setTombstoneRetentionDays(VaultQuotaServiceImpl.DEFAULT_TOMBSTONE_RETENTION_DAYS);
        fallback.setOrphanAssetGraceDays(VaultQuotaServiceImpl.DEFAULT_ORPHAN_ASSET_GRACE_DAYS);
        fallback.setMultipartMaxFileBytes(VaultQuotaRules.DEFAULT_MAX_FILE_BYTES);
        return fallback;
    }

    private static Date cutoffDaysAgo(int days) {
        return Date.from(Instant.now().minus(Math.max(1, days), ChronoUnit.DAYS));
    }

    private VaultSpace requireSpace(Long vaultId) {
        VaultSpace space = vaultId == null ? null : spaceMapper.selectById(vaultId);
        if (space == null) {
            throw new VaultBusinessException(HttpStatus.NOT_FOUND, VaultErrorCodes.NOT_FOUND, "云端库不存在");
        }
        return space;
    }

    private static VaultAdminFileVo toFileVo(VaultFile file) {
        VaultAdminFileVo vo = new VaultAdminFileVo();
        vo.setFileId(String.valueOf(file.getId()));
        vo.setVaultId(String.valueOf(file.getVaultId()));
        vo.setPath(file.getPath());
        vo.setFileType(file.getFileType());
        vo.setContentHash(file.getContentHash());
        vo.setSizeBytes(file.getSizeBytes() == null ? 0L : file.getSizeBytes());
        vo.setRev(file.getRev() == null ? 0L : file.getRev());
        vo.setDeleted(file.getDeleted() != null && file.getDeleted() == 1);
        vo.setCreateTime(file.getCreateTime());
        vo.setUpdateTime(file.getUpdateTime());
        return vo;
    }

    private static VaultAdminChangeVo toChangeVo(VaultChange change) {
        VaultAdminChangeVo vo = new VaultAdminChangeVo();
        vo.setCursor(String.valueOf(change.getId()));
        vo.setVaultId(String.valueOf(change.getVaultId()));
        vo.setFileId(String.valueOf(change.getFileId()));
        vo.setOp(change.getOp());
        vo.setPath(change.getPath());
        vo.setFromPath(change.getFromPath());
        vo.setContentHash(change.getContentHash());
        vo.setSizeBytes(change.getSizeBytes());
        vo.setRemoteRev(change.getRemoteRev() == null ? 0L : change.getRemoteRev());
        vo.setCreateTime(change.getCreateTime());
        return vo;
    }

    private static String normalizeSpaceStatus(String status) {
        if (StringUtils.isBlank(status)) {
            return null;
        }
        String norm = status.trim().toLowerCase(Locale.ROOT);
        if ("normal".equals(norm) || "over_quota".equals(norm)) {
            return norm;
        }
        return null;
    }

    private static String blankToNull(String value) {
        return StringUtils.isBlank(value) ? null : value.trim();
    }

    private static Object getIgnoreCase(Map<String, Object> map, String key) {
        if (map == null) {
            return null;
        }
        if (map.containsKey(key)) {
            return map.get(key);
        }
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            if (entry.getKey() != null && entry.getKey().equalsIgnoreCase(key)) {
                return entry.getValue();
            }
        }
        return null;
    }

    private static long toLong(Map<String, Object> map, String key) {
        Object val = getIgnoreCase(map, key);
        if (val == null) {
            return 0L;
        }
        if (val instanceof Number n) {
            return n.longValue();
        }
        try {
            return Long.parseLong(val.toString());
        } catch (NumberFormatException ex) {
            return 0L;
        }
    }
}
