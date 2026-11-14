package xin.v5ai.vault.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import xin.v5ai.common.core.constant.HttpStatus;
import xin.v5ai.vault.VaultErrorCodes;
import xin.v5ai.vault.domain.VaultChange;
import xin.v5ai.vault.domain.VaultDevice;
import xin.v5ai.vault.domain.VaultFile;
import xin.v5ai.vault.domain.VaultFileBlob;
import xin.v5ai.vault.domain.VaultSpace;
import xin.v5ai.vault.domain.bo.VaultBindBo;
import xin.v5ai.vault.domain.bo.VaultCreateBo;
import xin.v5ai.vault.domain.bo.VaultFileDeleteBo;
import xin.v5ai.vault.domain.bo.VaultFilePutBo;
import xin.v5ai.vault.domain.bo.VaultRenameBo;
import xin.v5ai.vault.domain.vo.VaultBindVo;
import xin.v5ai.vault.domain.vo.VaultChangeVo;
import xin.v5ai.vault.domain.vo.VaultConflictVo;
import xin.v5ai.vault.domain.vo.VaultFileContentVo;
import xin.v5ai.vault.domain.vo.VaultFileMetaVo;
import xin.v5ai.vault.domain.vo.VaultManifestVo;
import xin.v5ai.vault.domain.vo.VaultQuotaVo;
import xin.v5ai.vault.domain.vo.VaultSpaceVo;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.exception.VaultConflictException;
import xin.v5ai.vault.mapper.VaultChangeMapper;
import xin.v5ai.vault.mapper.VaultDeviceMapper;
import xin.v5ai.vault.mapper.VaultFileBlobMapper;
import xin.v5ai.vault.mapper.VaultFileMapper;
import xin.v5ai.vault.mapper.VaultSpaceMapper;
import xin.v5ai.vault.service.IVaultSyncService;
import xin.v5ai.vault.util.VaultContentHash;
import xin.v5ai.vault.util.VaultPathRules;
import xin.v5ai.vault.util.VaultQuotaRules;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class VaultSyncServiceImpl implements IVaultSyncService {

    private final VaultSpaceMapper spaceMapper;
    private final VaultDeviceMapper deviceMapper;
    private final VaultFileMapper fileMapper;
    private final VaultFileBlobMapper blobMapper;
    private final VaultChangeMapper changeMapper;

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
        String deviceId = bo.getDeviceId().trim();
        VaultDevice existing = deviceMapper.selectOne(new LambdaQueryWrapper<VaultDevice>()
            .eq(VaultDevice::getVaultId, vaultId)
            .eq(VaultDevice::getDeviceId, deviceId));
        int deviceUsed = Math.toIntExact(deviceMapper.selectCount(new LambdaQueryWrapper<VaultDevice>()
            .eq(VaultDevice::getVaultId, vaultId)));
        boolean alreadyBound = existing != null;
        if (VaultQuotaRules.wouldExceedDevices(deviceUsed, alreadyBound, VaultQuotaRules.DEFAULT_DEVICE_LIMIT)) {
            throw new VaultBusinessException(HttpStatus.FORBIDDEN, VaultErrorCodes.QUOTA_EXCEEDED,
                "同步设备数已达上限，请踢除旧设备或升级套餐");
        }
        Date now = new Date();
        if (existing == null) {
            VaultDevice device = new VaultDevice();
            device.setVaultId(vaultId);
            device.setUserId(userId);
            device.setDeviceId(deviceId);
            device.setClientInfo(bo.getClientInfo());
            device.setLastSeenAt(now);
            device.setCreateTime(now);
            device.setUpdateTime(now);
            deviceMapper.insert(device);
        } else {
            existing.setClientInfo(bo.getClientInfo());
            existing.setLastSeenAt(now);
            existing.setUpdateTime(now);
            deviceMapper.updateById(existing);
        }
        VaultBindVo vo = new VaultBindVo();
        vo.setVaultId(String.valueOf(space.getId()));
        vo.setDeviceId(deviceId);
        vo.setCloudHasContent(hasLiveFiles(vaultId));
        vo.setQuota(buildQuota(userId));
        return vo;
    }

    @Override
    public VaultManifestVo manifest(Long userId, Long vaultId, String sinceCursor) {
        requireOwnedVault(userId, vaultId);
        long since = parseCursor(sinceCursor);
        List<VaultChange> changes = changeMapper.selectList(new LambdaQueryWrapper<VaultChange>()
            .eq(VaultChange::getVaultId, vaultId)
            .gt(VaultChange::getId, since)
            .orderByAsc(VaultChange::getId)
            .last("LIMIT 500"));
        VaultManifestVo vo = new VaultManifestVo();
        vo.setEmpty(!hasLiveFiles(vaultId));
        List<VaultChangeVo> items = new ArrayList<>(changes.size());
        long maxCursor = since;
        for (VaultChange change : changes) {
            items.add(toChangeVo(change));
            maxCursor = Math.max(maxCursor, change.getId());
        }
        vo.setChanges(items);
        vo.setCursor(String.valueOf(maxCursor));
        return vo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public VaultFileMetaVo putFile(Long userId, Long vaultId, VaultFilePutBo bo) {
        VaultSpace space = requireOwnedVault(userId, vaultId);
        VaultPathRules.NormalizedVaultPath normalized;
        try {
            normalized = VaultPathRules.normalize(bo.getPath());
        } catch (IllegalArgumentException ex) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, ex.getMessage());
        }
        byte[] bytes = decodeBody(bo);
        long size = bytes.length;
        if (VaultQuotaRules.tooLarge(size, VaultQuotaRules.DEFAULT_MAX_FILE_BYTES)) {
            throw new VaultBusinessException(413, VaultErrorCodes.FILE_TOO_LARGE, "单文件超过上限");
        }
        String hash;
        try {
            hash = VaultContentHash.normalize(bo.getHash());
        } catch (IllegalArgumentException ex) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, ex.getMessage());
        }
        String computed = VaultContentHash.ofBytes(bytes);
        if (!VaultContentHash.equalsNormalized(hash, computed)) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, "contentHash 与正文不一致");
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

        ensureBlob(hash, bytes, size);
        Date now = new Date();
        String type = resolveType(bo.getType(), normalized.displayPath());
        VaultFile file;
        if (byFileId == null) {
            if (liveByIdentity != null && (liveByIdentity.getDeleted() == null || liveByIdentity.getDeleted() == 0)) {
                throw conflict(liveByIdentity);
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
            file.setUpdateTime(now);
            fileMapper.updateById(file);
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
            // Still return current content; client can detect mismatch via remoteRev.
        }
        VaultFileBlob blob = blobMapper.selectById(file.getContentHash());
        if (blob == null || blob.getContent() == null) {
            throw new VaultBusinessException(HttpStatus.NOT_FOUND, VaultErrorCodes.FILE_NOT_FOUND, "文件内容不存在");
        }
        VaultFileContentVo vo = new VaultFileContentVo();
        vo.setFileId(String.valueOf(file.getId()));
        vo.setPath(file.getPath());
        vo.setRemoteRev(file.getRev());
        vo.setContentHash(file.getContentHash());
        vo.setSize(file.getSizeBytes());
        vo.setType(file.getFileType());
        byte[] content = blob.getContent();
        if (isMostlyText(content)) {
            vo.setBody(new String(content, StandardCharsets.UTF_8));
        } else {
            vo.setBase64Body(Base64.getEncoder().encodeToString(content));
        }
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
        file.setUpdateTime(new Date());
        fileMapper.updateById(file);
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
            throw new VaultBusinessException(HttpStatus.CONFLICT, VaultErrorCodes.PATH_INVALID, "目标路径已存在");
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

    private VaultQuotaVo buildQuota(Long userId) {
        List<VaultSpace> spaces = spaceMapper.selectList(new LambdaQueryWrapper<VaultSpace>()
            .eq(VaultSpace::getUserId, userId));
        long used = spaces.stream().mapToLong(s -> nullToZero(s.getUsedBytes())).sum();
        int devices = 0;
        for (VaultSpace space : spaces) {
            devices += Math.toIntExact(deviceMapper.selectCount(new LambdaQueryWrapper<VaultDevice>()
                .eq(VaultDevice::getVaultId, space.getId())));
        }
        VaultQuotaVo vo = new VaultQuotaVo();
        vo.setAvailable(true);
        vo.setUsedBytes(used);
        vo.setQuotaBytes(VaultQuotaRules.DEFAULT_QUOTA_BYTES);
        vo.setDeviceLimit(VaultQuotaRules.DEFAULT_DEVICE_LIMIT);
        vo.setDeviceUsed(devices);
        vo.setPlanName("vault-default");
        vo.setOverQuota(used >= VaultQuotaRules.DEFAULT_QUOTA_BYTES);
        vo.setMaxFileBytes(VaultQuotaRules.DEFAULT_MAX_FILE_BYTES);
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

    private void ensureBlob(String hash, byte[] bytes, long size) {
        VaultFileBlob existing = blobMapper.selectById(hash);
        if (existing != null) {
            return;
        }
        VaultFileBlob blob = new VaultFileBlob();
        blob.setContentHash(hash);
        blob.setContent(bytes);
        blob.setSizeBytes(size);
        blob.setCreateTime(new Date());
        blobMapper.insert(blob);
    }

    private VaultFile findLiveByIdentity(Long vaultId, String identityKey) {
        return fileMapper.selectOne(new LambdaQueryWrapper<VaultFile>()
            .eq(VaultFile::getVaultId, vaultId)
            .eq(VaultFile::getIdentityKey, identityKey)
            .eq(VaultFile::getDeleted, 0)
            .last("LIMIT 1"));
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
        VaultConflictVo vo = new VaultConflictVo();
        vo.setCode(VaultErrorCodes.CONFLICT_REV);
        vo.setPath(file.getPath());
        vo.setFileId(String.valueOf(file.getId()));
        vo.setRemoteRev(file.getRev());
        vo.setContentHash(file.getContentHash());
        vo.setSize(file.getSizeBytes());
        return new VaultConflictException(vo);
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

    private VaultChangeVo toChangeVo(VaultChange change) {
        VaultChangeVo vo = new VaultChangeVo();
        vo.setOp(change.getOp());
        vo.setPath(change.getPath());
        vo.setFrom(change.getFromPath());
        vo.setFileId(String.valueOf(change.getFileId()));
        vo.setRemoteRev(change.getRemoteRev());
        vo.setContentHash(change.getContentHash());
        vo.setSize(change.getSizeBytes());
        if ("upsert".equals(change.getOp()) || "rename".equals(change.getOp())) {
            VaultFile file = fileMapper.selectById(change.getFileId());
            if (file != null) {
                vo.setType(file.getFileType());
            }
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

    private static byte[] decodeBody(VaultFilePutBo bo) {
        if (bo.getBody() != null) {
            return bo.getBody().getBytes(StandardCharsets.UTF_8);
        }
        if (bo.getBase64Body() != null && !bo.getBase64Body().isBlank()) {
            try {
                return Base64.getDecoder().decode(bo.getBase64Body());
            } catch (IllegalArgumentException ex) {
                throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, "base64Body 无效");
            }
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

    private static boolean isMostlyText(byte[] content) {
        if (content == null || content.length == 0) {
            return true;
        }
        int sample = Math.min(content.length, 512);
        for (int i = 0; i < sample; i++) {
            int b = content[i] & 0xff;
            if (b == 0) {
                return false;
            }
        }
        return true;
    }
}
