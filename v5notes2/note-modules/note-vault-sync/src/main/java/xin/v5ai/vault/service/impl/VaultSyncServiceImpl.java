package xin.v5ai.vault.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import xin.v5ai.common.core.constant.HttpStatus;
import xin.v5ai.vault.VaultErrorCodes;
import xin.v5ai.vault.domain.VaultChange;
import xin.v5ai.vault.domain.VaultReplica;
import xin.v5ai.vault.domain.VaultFile;
import xin.v5ai.vault.domain.VaultAssetRef;
import xin.v5ai.vault.domain.VaultSpace;
import xin.v5ai.vault.domain.bo.VaultBindBo;
import xin.v5ai.vault.domain.bo.VaultCreateBo;
import xin.v5ai.vault.domain.bo.VaultFileDeleteBo;
import xin.v5ai.vault.domain.bo.VaultFilePutBo;
import xin.v5ai.vault.domain.bo.VaultRenameBo;
import xin.v5ai.vault.domain.vo.VaultBindVo;
import xin.v5ai.vault.domain.vo.VaultChangeVo;
import xin.v5ai.vault.domain.vo.VaultConflictVo;
import xin.v5ai.vault.domain.vo.VaultReplicaVo;
import xin.v5ai.vault.domain.vo.VaultFileContentVo;
import xin.v5ai.vault.domain.vo.VaultFileMetaVo;
import xin.v5ai.vault.domain.vo.VaultFileVersionVo;
import xin.v5ai.vault.domain.vo.VaultManifestVo;
import xin.v5ai.vault.domain.vo.VaultQuotaVo;
import xin.v5ai.vault.domain.vo.VaultSpaceVo;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.exception.VaultConflictException;
import xin.v5ai.vault.mapper.VaultChangeMapper;
import xin.v5ai.vault.mapper.VaultReplicaMapper;
import xin.v5ai.vault.mapper.VaultFileMapper;
import xin.v5ai.vault.mapper.VaultSpaceMapper;
import xin.v5ai.vault.service.IVaultAssetService;
import xin.v5ai.vault.service.IVaultSyncService;
import xin.v5ai.vault.util.VaultContentHash;
import xin.v5ai.vault.util.VaultPathRules;
import xin.v5ai.vault.util.VaultQuotaRules;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
public class VaultSyncServiceImpl implements IVaultSyncService {

    /** Max changes per manifest page; client pages via hasMore until exhausted (design §8.2). */
    public static final int MANIFEST_PAGE_LIMIT = 500;

    private final VaultSpaceMapper spaceMapper;
    private final VaultReplicaMapper replicaMapper;
    private final VaultFileMapper fileMapper;
    private final VaultChangeMapper changeMapper;
    private final IVaultAssetService assetService;
    private final ObjectProvider<TransactionTemplate> transactionTemplateProvider;

    public VaultSyncServiceImpl(VaultSpaceMapper spaceMapper,
                                VaultReplicaMapper replicaMapper,
                                VaultFileMapper fileMapper,
                                VaultChangeMapper changeMapper,
                                IVaultAssetService assetService) {
        this(spaceMapper, replicaMapper, fileMapper, changeMapper, assetService, null);
    }

    @Autowired
    public VaultSyncServiceImpl(VaultSpaceMapper spaceMapper,
                                VaultReplicaMapper replicaMapper,
                                VaultFileMapper fileMapper,
                                VaultChangeMapper changeMapper,
                                IVaultAssetService assetService,
                                ObjectProvider<TransactionTemplate> transactionTemplateProvider) {
        this.spaceMapper = spaceMapper;
        this.replicaMapper = replicaMapper;
        this.fileMapper = fileMapper;
        this.changeMapper = changeMapper;
        this.assetService = assetService;
        this.transactionTemplateProvider = transactionTemplateProvider;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public VaultSpaceVo createVault(Long userId, VaultCreateBo bo) {
        String name = bo.getName() == null ? "" : bo.getName().trim();
        if (name.isEmpty() || name.length() > 100) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, "库名称无效");
        }
        VaultSpace space = new VaultSpace();
        space.setUserId(userId);
        space.setName(name);
        space.setUsedBytes(0L);
        spaceMapper.insert(space);
        return toSpaceVo(space, true);
    }

    @Override
    public List<VaultSpaceVo> listVaults(Long userId) {
        List<VaultSpace> spaces = spaceMapper.selectList(new LambdaQueryWrapper<VaultSpace>()
            .eq(VaultSpace::getUserId, userId)
            .orderByDesc(VaultSpace::getCreateTime));
        List<VaultSpaceVo> out = new ArrayList<>(spaces.size());
        for (VaultSpace space : spaces) {
            out.add(toSpaceVo(space, !hasLiveFiles(space.getId())));
        }
        return out;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public VaultBindVo bind(Long userId, Long vaultId, VaultBindBo bo) {
        VaultSpace space = requireOwnedVault(userId, vaultId);
        String replicaId = bo.getReplicaId().trim();
        String deviceId = bo.getDeviceId().trim();
        VaultReplica existing = replicaMapper.selectOne(new LambdaQueryWrapper<VaultReplica>()
            .eq(VaultReplica::getVaultId, vaultId)
            .eq(VaultReplica::getReplicaId, replicaId));
        int replicaUsed = Math.toIntExact(replicaMapper.selectCount(new LambdaQueryWrapper<VaultReplica>()
            .eq(VaultReplica::getVaultId, vaultId)));
        boolean alreadyBound = existing != null;
        if (VaultQuotaRules.wouldExceedReplicas(replicaUsed, alreadyBound, VaultQuotaRules.DEFAULT_REPLICA_LIMIT)) {
            throw new VaultBusinessException(HttpStatus.FORBIDDEN, VaultErrorCodes.QUOTA_DEVICES_EXCEEDED,
                "同步副本数已达上限，请停止旧副本的同步或升级套餐");
        }
        Date now = new Date();
        if (existing == null) {
            VaultReplica replica = new VaultReplica();
            replica.setVaultId(vaultId);
            replica.setUserId(userId);
            replica.setReplicaId(replicaId);
            replica.setDeviceId(deviceId);
            replica.setClientInfo(bo.getClientInfo());
            replica.setLastSeenAt(now);
            replica.setCreateTime(now);
            replica.setUpdateTime(now);
            replicaMapper.insert(replica);
        } else {
            // The replica moved to a machine (or its data was restored there):
            // follow it, so the listing never points at a machine it left.
            existing.setDeviceId(deviceId);
            existing.setClientInfo(bo.getClientInfo());
            existing.setLastSeenAt(now);
            existing.setUpdateTime(now);
            replicaMapper.updateById(existing);
        }
        VaultBindVo vo = new VaultBindVo();
        vo.setVaultId(String.valueOf(space.getId()));
        vo.setReplicaId(replicaId);
        vo.setCloudHasContent(hasLiveFiles(vaultId));
        vo.setQuota(buildQuota(userId));
        return vo;
    }

    @Override
    public List<VaultReplicaVo> listReplicas(Long userId, Long vaultId) {
        requireOwnedVault(userId, vaultId);
        List<VaultReplica> replicas = replicaMapper.selectList(new LambdaQueryWrapper<VaultReplica>()
            .eq(VaultReplica::getVaultId, vaultId)
            .orderByDesc(VaultReplica::getLastSeenAt));
        List<VaultReplicaVo> out = new ArrayList<>(replicas.size());
        for (VaultReplica replica : replicas) {
            out.add(toReplicaVo(replica));
        }
        return out;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void kickReplica(Long userId, Long vaultId, String replicaId) {
        requireOwnedVault(userId, vaultId);
        if (replicaId == null || replicaId.isBlank()) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, "replicaId 无效");
        }
        VaultReplica existing = replicaMapper.selectOne(new LambdaQueryWrapper<VaultReplica>()
            .eq(VaultReplica::getVaultId, vaultId)
            .eq(VaultReplica::getReplicaId, replicaId.trim()));
        if (existing == null) {
            throw new VaultBusinessException(HttpStatus.NOT_FOUND, VaultErrorCodes.NOT_FOUND, "副本未绑定");
        }
        replicaMapper.deleteById(existing.getId());
    }

    @Override
    public VaultManifestVo manifest(Long userId, Long vaultId, String sinceCursor) {
        requireOwnedVault(userId, vaultId);
        long since = parseCursor(sinceCursor);
        List<VaultChange> changes = changeMapper.selectList(new LambdaQueryWrapper<VaultChange>()
            .eq(VaultChange::getVaultId, vaultId)
            .gt(VaultChange::getId, since)
            .orderByAsc(VaultChange::getId)
            .last("LIMIT " + (MANIFEST_PAGE_LIMIT + 1)));
        // Page limit + 1 probe: an extra row means more pages remain (design §8.2 pagination).
        boolean hasMore = changes.size() > MANIFEST_PAGE_LIMIT;
        if (hasMore) {
            changes = changes.subList(0, MANIFEST_PAGE_LIMIT);
        }
        VaultManifestVo vo = new VaultManifestVo();
        vo.setEmpty(!hasLiveFiles(vaultId));
        List<VaultChangeVo> items = new ArrayList<>(changes.size());
        long maxCursor = since;
        // One query for the whole page instead of one per change: the per-change lookup used to
        // read a full row (now including the note body) 500 times per page.
        Map<Long, String> fileTypes = loadFileTypes(changes);
        for (VaultChange change : changes) {
            items.add(toChangeVo(change, fileTypes));
            maxCursor = Math.max(maxCursor, change.getId());
        }
        vo.setChanges(items);
        vo.setCursor(String.valueOf(maxCursor));
        vo.setHasMore(hasMore);
        return vo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public VaultFileMetaVo putFile(Long userId, Long vaultId, VaultFilePutBo bo) {
        return putFileInternal(userId, vaultId, bo);
    }

    /**
     * Applies items one at a time, each in its own transaction.
     *
     * <p>Deliberately <b>not</b> wrapped in a single batch transaction. A commit item may reach
     * out to the attachment backend (presign / stream), and holding a database transaction open
     * across object-storage or FTP round-trips pins a pooled connection for the duration of slow
     * network IO. Per-item transactions also make the failure semantics honest: callers learn
     * which item failed instead of receiving a rollback that silently discarded earlier ones.</p>
     *
     * <p>The engine no longer calls this endpoint (it pushes one file at a time), so the change
     * has no client-visible effect; it only removes the trap.</p>
     */
    @Override
    public List<VaultFileMetaVo> putBatch(Long userId, Long vaultId, List<VaultFilePutBo> files) {
        TransactionTemplate txTemplate = transactionTemplateProvider == null
            ? null : transactionTemplateProvider.getIfAvailable();
        List<VaultFileMetaVo> out = new ArrayList<>(files.size());
        for (VaultFilePutBo bo : files) {
            if (txTemplate != null) {
                out.add(txTemplate.execute(status -> putFileInternal(userId, vaultId, bo)));
            } else {
                out.add(putFileInternal(userId, vaultId, bo));
            }
        }
        return out;
    }

    private VaultFileMetaVo putFileInternal(Long userId, Long vaultId, VaultFilePutBo bo) {
        VaultSpace space = requireOwnedVault(userId, vaultId);
        VaultPathRules.NormalizedVaultPath normalized;
        try {
            normalized = VaultPathRules.normalize(bo.getPath());
        } catch (IllegalArgumentException ex) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, ex.getMessage());
        }
        String type = resolveType(bo.getType(), normalized.displayPath());
        String hash;
        try {
            hash = VaultContentHash.normalize(bo.getHash());
        } catch (IllegalArgumentException ex) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, ex.getMessage());
        }

        // Assets carry bytes by reference (design D5); notes/config still travel as inline text.
        boolean isAsset = "asset".equals(type);
        byte[] bytes = null;
        long size;
        VaultAssetRef assetRef = null;
        if (isAsset) {
            VaultFilePutBo.AssetRef refBo = bo.getAsset();
            if (refBo == null || refBo.getAssetId() == null || refBo.getAssetId().isBlank()) {
                throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.ASSET_REQUIRED,
                    "附件必须通过 /vault/v1/vaults/{vaultId}/assets 上传后再提交引用");
            }
            assetRef = assetService.resolveForCommit(userId, vaultId, refBo.getAssetId(), hash);
            if (assetRef == null) {
                throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.ASSET_NOT_FOUND,
                    "附件对象不存在，请先上传");
            }
            size = assetRef.getSizeBytes() == null ? 0L : assetRef.getSizeBytes();
        } else {
            bytes = decodeBody(bo);
            size = bytes.length;
            String computed = VaultContentHash.ofBytes(bytes);
            if (!VaultContentHash.equalsNormalized(hash, computed)) {
                throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.HASH_MISMATCH, "contentHash 与正文不一致");
            }
        }
        if (VaultQuotaRules.tooLarge(size, VaultQuotaRules.DEFAULT_MAX_FILE_BYTES)) {
            throw new VaultBusinessException(413, VaultErrorCodes.FILE_TOO_LARGE, "单文件超过上限");
        }

        VaultFile liveByIdentity = findLiveByIdentity(vaultId, normalized.identityKey());
        VaultFile byFileId = null;
        if (bo.getFileId() != null && !bo.getFileId().isBlank()) {
            byFileId = fileMapper.selectById(parseId(bo.getFileId(), "fileId"));
            if (byFileId == null || !Objects.equals(byFileId.getVaultId(), vaultId)) {
                throw new VaultBusinessException(HttpStatus.NOT_FOUND, VaultErrorCodes.FILE_NOT_FOUND, "文件不存在");
            }
        }

        long baseRev = bo.getBaseRev() == null ? 0L : bo.getBaseRev();
        if (byFileId != null) {
            if (byFileId.getDeleted() != null && byFileId.getDeleted() == 1) {
                // Tombstone then recreate same path → new fileId (design §8.2).
                byFileId = null;
            } else if (!Objects.equals(byFileId.getRev(), baseRev)) {
                throw conflict(byFileId);
            }
        } else if (liveByIdentity != null) {
            // First upload of identity that already exists remotely.
            if (baseRev == 0L) {
                throw conflict(liveByIdentity);
            }
            if (!Objects.equals(liveByIdentity.getRev(), baseRev)) {
                throw conflict(liveByIdentity);
            }
            byFileId = liveByIdentity;
        }

        long previousSize = byFileId == null ? 0L : nullToZero(byFileId.getSizeBytes());
        long delta = size - previousSize;
        long used = nullToZero(space.getUsedBytes());
        if (VaultQuotaRules.wouldExceedCapacity(used, delta, VaultQuotaRules.DEFAULT_QUOTA_BYTES)) {
            throw new VaultBusinessException(402, VaultErrorCodes.QUOTA_EXCEEDED,
                "同步容量已超额；仍可 pull，本地编辑不受影响");
        }

        Date now = new Date();
        VaultFile file;
        if (byFileId == null) {
            if (liveByIdentity != null && (liveByIdentity.getDeleted() == null || liveByIdentity.getDeleted() == 0)) {
                throw conflict(liveByIdentity);
            }
            // Re-check under row lock: two devices first-uploading the same identity
            // concurrently must not both insert (design §8.2 active-identity uniqueness).
            VaultFile concurrent = findLiveByIdentityForUpdate(vaultId, normalized.identityKey());
            if (concurrent != null) {
                throw conflict(concurrent);
            }
            file = new VaultFile();
            file.setVaultId(vaultId);
            file.setPath(normalized.displayPath());
            file.setIdentityKey(normalized.identityKey());
            file.setFileType(type);
            file.setContentHash(hash);
            file.setSizeBytes(size);
            file.setRev(1L);
            file.setDeleted(0);
            // Text body lives on the row (design §4.2.1); assets keep content null.
            file.setContent(isAsset ? null : new String(bytes, StandardCharsets.UTF_8));
            file.setCreateTime(now);
            file.setUpdateTime(now);
            fileMapper.insert(file);
        } else {
            file = byFileId;
            file.setPath(normalized.displayPath());
            file.setIdentityKey(normalized.identityKey());
            file.setFileType(type);
            file.setContentHash(hash);
            file.setSizeBytes(size);
            file.setRev(file.getRev() + 1);
            file.setDeleted(0);
            file.setContent(isAsset ? null : new String(bytes, StandardCharsets.UTF_8));
            file.setUpdateTime(now);
            fileMapper.updateById(file);
        }

        if (isAsset) {
            // Keep existing link untouched when the asset object did not change;
            // releasing before re-linking the same sole reference would delete the physical object.
            VaultAssetRef previous = assetService.findByFileId(file.getId());
            if (previous == null) {
                assetService.link(file.getId(), vaultId, assetRef);
            } else if (!Objects.equals(previous.getAssetId(), assetRef.getAssetId())) {
                assetService.releaseReference(file.getId(), previous);
                assetService.link(file.getId(), vaultId, assetRef);
            }
        }

        space.setUsedBytes(Math.max(0, used + delta));
        spaceMapper.updateById(space);

        VaultChange change = appendChange(vaultId, file.getId(), "upsert", file.getPath(), null,
            file.getContentHash(), file.getSizeBytes(), file.getRev());
        return toMeta(file, change.getId());
    }

    @Override
    public VaultFileContentVo getContent(Long userId, Long vaultId, String path, Long rev) {
        requireOwnedVault(userId, vaultId);
        VaultPathRules.NormalizedVaultPath normalized;
        try {
            normalized = VaultPathRules.normalize(path);
        } catch (IllegalArgumentException ex) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, ex.getMessage());
        }
        VaultFile file = findLiveByIdentity(vaultId, normalized.identityKey());
        if (file == null) {
            throw new VaultBusinessException(HttpStatus.NOT_FOUND, VaultErrorCodes.FILE_NOT_FOUND, "文件不存在");
        }
        if (rev != null && !Objects.equals(file.getRev(), rev)) {
            // Requested rev no longer current (design §8.2): surface the live metadata so
            // the client can decide to refetch instead of silently writing stale content.
            throw conflict(file);
        }
        VaultFileContentVo vo = new VaultFileContentVo();
        vo.setFileId(String.valueOf(file.getId()));
        vo.setPath(file.getPath());
        vo.setRemoteRev(file.getRev());
        vo.setContentHash(file.getContentHash());
        vo.setSize(file.getSizeBytes());
        vo.setType(file.getFileType());

        if ("asset".equals(file.getFileType())) {
            // Bytes live in the attachment backend; hand the client a fetch descriptor (design §3.3).
            VaultAssetRef ref = assetService.findByFileId(file.getId());
            if (ref == null) {
                throw new VaultBusinessException(HttpStatus.NOT_FOUND, VaultErrorCodes.ASSET_NOT_FOUND,
                    "附件对象不存在");
            }
            vo.setDownload(assetService.download(vaultId, ref));
            return vo;
        }

        // Notes and configs read straight off the row (design §4.2.1). The body is fetched with
        // a dedicated projection because the entity never loads it by default.
        String body = fileMapper.selectContentById(file.getId());
        vo.setBody(body == null ? "" : body);
        return vo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public VaultFileMetaVo deleteFile(Long userId, Long vaultId, VaultFileDeleteBo bo) {
        VaultSpace space = requireOwnedVault(userId, vaultId);
        VaultPathRules.NormalizedVaultPath normalized;
        try {
            normalized = VaultPathRules.normalize(bo.getPath());
        } catch (IllegalArgumentException ex) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, ex.getMessage());
        }
        VaultFile file = findLiveByIdentity(vaultId, normalized.identityKey());
        if (file == null) {
            throw new VaultBusinessException(HttpStatus.NOT_FOUND, VaultErrorCodes.FILE_NOT_FOUND, "文件不存在");
        }
        if (!Objects.equals(file.getRev(), bo.getBaseRev())) {
            throw conflict(file);
        }
        long size = nullToZero(file.getSizeBytes());
        file.setDeleted(1);
        file.setRev(file.getRev() + 1);
        // Drop the text body with the row's tombstone; it is no longer readable once deleted.
        file.setContent(null);
        file.setUpdateTime(new Date());
        fileMapper.updateById(file);
        // Storage is only released when the last reference disappears (design §6.1).
        if ("asset".equals(file.getFileType())) {
            assetService.releaseReference(file.getId(), assetService.findByFileId(file.getId()));
        }
        space.setUsedBytes(Math.max(0, nullToZero(space.getUsedBytes()) - size));
        spaceMapper.updateById(space);
        VaultChange change = appendChange(vaultId, file.getId(), "delete", file.getPath(), null,
            file.getContentHash(), 0L, file.getRev());
        return toMeta(file, change.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public VaultFileMetaVo rename(Long userId, Long vaultId, VaultRenameBo bo) {
        requireOwnedVault(userId, vaultId);
        VaultPathRules.NormalizedVaultPath from;
        VaultPathRules.NormalizedVaultPath to;
        try {
            from = VaultPathRules.normalize(bo.getFrom());
            to = VaultPathRules.normalize(bo.getTo());
        } catch (IllegalArgumentException ex) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, ex.getMessage());
        }
        VaultFile file = findLiveByIdentity(vaultId, from.identityKey());
        if (file == null) {
            throw new VaultBusinessException(HttpStatus.NOT_FOUND, VaultErrorCodes.FILE_NOT_FOUND, "文件不存在");
        }
        if (!Objects.equals(file.getRev(), bo.getBaseRev())) {
            throw conflict(file);
        }
        VaultFile target = findLiveByIdentity(vaultId, to.identityKey());
        if (target != null && !Objects.equals(target.getId(), file.getId())) {
            // Target path taken: conflict family, not a malformed-path error (design §8.2).
            throw new VaultConflictException(conflictVo(VaultErrorCodes.CONFLICT_PATH_EXISTS, target));
        }
        String oldPath = file.getPath();
        file.setPath(to.displayPath());
        file.setIdentityKey(to.identityKey());
        file.setRev(file.getRev() + 1);
        file.setUpdateTime(new Date());
        fileMapper.updateById(file);
        VaultChange change = appendChange(vaultId, file.getId(), "rename", file.getPath(), oldPath,
            file.getContentHash(), file.getSizeBytes(), file.getRev());
        return toMeta(file, change.getId());
    }

    @Override
    public VaultQuotaVo quota(Long userId) {
        return buildQuota(userId);
    }

    @Override
    public List<VaultFileVersionVo> listFileVersions(Long userId, Long vaultId, String path) {
        requireOwnedVault(userId, vaultId);
        // Validate path so clients get consistent errors; history storage is deferred.
        try {
            VaultPathRules.normalize(path);
        } catch (IllegalArgumentException ex) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, ex.getMessage());
        }
        return List.of();
    }

    private VaultQuotaVo buildQuota(Long userId) {
        List<VaultSpace> spaces = spaceMapper.selectList(new LambdaQueryWrapper<VaultSpace>()
            .eq(VaultSpace::getUserId, userId));
        long used = spaces.stream().mapToLong(s -> nullToZero(s.getUsedBytes())).sum();
        // Quota counts replicas: each bound library directory is one slot. The
        // machine count is reported alongside it for display only.
        int replicas = 0;
        int devices = 0;
        for (VaultSpace space : spaces) {
            List<VaultReplica> bound = replicaMapper.selectList(new LambdaQueryWrapper<VaultReplica>()
                .eq(VaultReplica::getVaultId, space.getId()));
            replicas += bound.size();
            devices += (int) bound.stream().map(VaultReplica::getDeviceId).distinct().count();
        }
        VaultQuotaVo vo = new VaultQuotaVo();
        vo.setAvailable(true);
        vo.setUsedBytes(used);
        vo.setQuotaBytes(VaultQuotaRules.DEFAULT_QUOTA_BYTES);
        vo.setReplicaLimit(VaultQuotaRules.DEFAULT_REPLICA_LIMIT);
        vo.setReplicaUsed(replicas);
        vo.setDeviceUsed(devices);
        vo.setPlanName("vault-default");
        vo.setOverQuota(used >= VaultQuotaRules.DEFAULT_QUOTA_BYTES);
        vo.setMaxFileBytes(VaultQuotaRules.DEFAULT_MAX_FILE_BYTES);
        // Capability tells clients whether downloads are direct or proxied (design §5.3).
        // An unconfigured backend leaves it null instead of failing /quota, so the client can
        // still sync notes and report the attachment misconfiguration separately.
        try {
            vo.setAssetStorage(assetService.capability());
        } catch (VaultBusinessException ex) {
            vo.setAssetStorage(null);
        }
        return vo;
    }

    private VaultChange appendChange(Long vaultId, Long fileId, String op, String path, String fromPath,
                                     String contentHash, Long sizeBytes, Long remoteRev) {
        VaultChange change = new VaultChange();
        change.setId(IdWorker.getId());
        change.setVaultId(vaultId);
        change.setFileId(fileId);
        change.setOp(op);
        change.setPath(path);
        change.setFromPath(fromPath);
        change.setContentHash(contentHash);
        change.setSizeBytes(sizeBytes);
        change.setRemoteRev(remoteRev);
        change.setCreateTime(new Date());
        changeMapper.insert(change);
        return change;
    }

    private VaultFile findLiveByIdentity(Long vaultId, String identityKey) {
        return fileMapper.selectOne(new LambdaQueryWrapper<VaultFile>()
            .eq(VaultFile::getVaultId, vaultId)
            .eq(VaultFile::getIdentityKey, identityKey)
            .eq(VaultFile::getDeleted, 0)
            .last("LIMIT 1"));
    }

    /**
     * Row-locked existence check for the active identity (design §8.2 uniqueness).
     *
     * <p>The soft-deleted history rows share the identity key, so a plain UNIQUE index
     * cannot enforce "at most one live row per (vault_id, identity_key)". Instead, on
     * first upload we lock the vault_space row (serializing writers per vault) and
     * re-check before insert. Concurrent first-uploads of the same identity then
     * serialize: the loser sees the winner's row and gets {@code 409}.</p>
     */
    private VaultFile findLiveByIdentityForUpdate(Long vaultId, String identityKey) {
        spaceMapper.selectOne(new LambdaQueryWrapper<VaultSpace>()
            .eq(VaultSpace::getId, vaultId)
            .last("FOR UPDATE"));
        return findLiveByIdentity(vaultId, identityKey);
    }

    private boolean hasLiveFiles(Long vaultId) {
        return fileMapper.selectCount(new LambdaQueryWrapper<VaultFile>()
            .eq(VaultFile::getVaultId, vaultId)
            .eq(VaultFile::getDeleted, 0)) > 0;
    }

    private VaultSpace requireOwnedVault(Long userId, Long vaultId) {
        VaultSpace space = spaceMapper.selectById(vaultId);
        if (space == null || !Objects.equals(space.getUserId(), userId)) {
            throw new VaultBusinessException(HttpStatus.NOT_FOUND, VaultErrorCodes.NOT_FOUND, "云端库不存在");
        }
        return space;
    }

    private VaultConflictException conflict(VaultFile file) {
        return new VaultConflictException(conflictVo(VaultErrorCodes.CONFLICT_REV, file));
    }

    /** Conflict payload for the given live file (design §8.2: body carries server metadata). */
    private VaultConflictVo conflictVo(String code, VaultFile file) {
        VaultConflictVo vo = new VaultConflictVo();
        vo.setCode(code);
        vo.setPath(file.getPath());
        vo.setFileId(String.valueOf(file.getId()));
        vo.setRemoteRev(file.getRev());
        vo.setContentHash(file.getContentHash());
        vo.setSize(file.getSizeBytes());
        return vo;
    }

    private VaultSpaceVo toSpaceVo(VaultSpace space, boolean empty) {
        VaultSpaceVo vo = new VaultSpaceVo();
        vo.setVaultId(String.valueOf(space.getId()));
        vo.setName(space.getName());
        vo.setUsedBytes(nullToZero(space.getUsedBytes()));
        vo.setEmpty(empty);
        vo.setCreatedAt(space.getCreateTime());
        return vo;
    }

    private VaultReplicaVo toReplicaVo(VaultReplica replica) {
        VaultReplicaVo vo = new VaultReplicaVo();
        vo.setId(String.valueOf(replica.getId()));
        vo.setVaultId(String.valueOf(replica.getVaultId()));
        vo.setReplicaId(replica.getReplicaId());
        vo.setDeviceId(replica.getDeviceId());
        vo.setClientInfo(replica.getClientInfo());
        vo.setLastSeenAt(replica.getLastSeenAt());
        vo.setBoundAt(replica.getCreateTime());
        return vo;
    }

    /**
     * File types for every file referenced by this manifest page, in one query.
     *
     * <p>The projection names only the two columns needed, so the {@code content} column is
     * never read while building a manifest.</p>
     */
    private Map<Long, String> loadFileTypes(List<VaultChange> changes) {
        List<Long> ids = changes.stream()
            .filter(c -> "upsert".equals(c.getOp()) || "rename".equals(c.getOp()))
            .map(VaultChange::getFileId)
            .filter(Objects::nonNull)
            .distinct()
            .toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        List<VaultFile> rows = fileMapper.selectList(new LambdaQueryWrapper<VaultFile>()
            .select(VaultFile::getId, VaultFile::getFileType)
            .in(VaultFile::getId, ids));
        Map<Long, String> out = new HashMap<>(rows.size());
        for (VaultFile row : rows) {
            out.put(row.getId(), row.getFileType());
        }
        return out;
    }

    private VaultChangeVo toChangeVo(VaultChange change, Map<Long, String> fileTypes) {
        VaultChangeVo vo = new VaultChangeVo();
        vo.setOp(change.getOp());
        vo.setPath(change.getPath());
        vo.setFrom(change.getFromPath());
        vo.setFileId(String.valueOf(change.getFileId()));
        vo.setRemoteRev(change.getRemoteRev());
        vo.setContentHash(change.getContentHash());
        vo.setSize(change.getSizeBytes());
        if ("upsert".equals(change.getOp()) || "rename".equals(change.getOp())) {
            vo.setType(fileTypes.get(change.getFileId()));
        }
        return vo;
    }

    private VaultFileMetaVo toMeta(VaultFile file, Long cursor) {
        VaultFileMetaVo vo = new VaultFileMetaVo();
        vo.setFileId(String.valueOf(file.getId()));
        vo.setPath(file.getPath());
        vo.setRemoteRev(file.getRev());
        vo.setContentHash(file.getContentHash());
        vo.setSize(file.getSizeBytes());
        vo.setType(file.getFileType());
        vo.setCursor(String.valueOf(cursor));
        return vo;
    }

    /**
     * Text bodies only. Assets never travel inline (design D5), so a missing {@code body}
     * on a non-asset is a plain parameter error rather than a fallback to base64.
     */
    private static byte[] decodeBody(VaultFilePutBo bo) {
        if (bo.getBody() != null) {
            return bo.getBody().getBytes(StandardCharsets.UTF_8);
        }
        throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, "缺少文件正文");
    }

    private static String resolveType(String type, String path) {
        if (type != null && !type.isBlank()) {
            return type.trim().toLowerCase(Locale.ROOT);
        }
        String lower = path.toLowerCase(Locale.ROOT);
        if (lower.startsWith(".v5notes/")) {
            return "config";
        }
        if (lower.endsWith(".md")) {
            return "note";
        }
        return "asset";
    }

    private static long parseCursor(String since) {
        if (since == null || since.isBlank() || "0".equals(since)) {
            return 0L;
        }
        try {
            return Long.parseLong(since.trim());
        } catch (NumberFormatException ex) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, "cursor 无效");
        }
    }

    private static Long parseId(String raw, String label) {
        try {
            return Long.parseLong(raw.trim());
        } catch (Exception ex) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, label + " 无效");
        }
    }

    private static long nullToZero(Long value) {
        return value == null ? 0L : value;
    }

}
