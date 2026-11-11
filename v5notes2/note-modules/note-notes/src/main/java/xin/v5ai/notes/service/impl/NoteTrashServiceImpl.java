package xin.v5ai.notes.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.core.exception.ServiceException;
import xin.v5ai.common.core.utils.MessageUtils;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.common.satoken.utils.LoginHelper;
import xin.v5ai.notes.domain.NoteTrash;
import xin.v5ai.notes.domain.NoteTrashSubject;
import xin.v5ai.notes.domain.vo.NoteTrashItemVo;
import xin.v5ai.notes.domain.vo.NoteTrashRestoreVo;
import xin.v5ai.notes.mapper.NoteTrashMapper;
import xin.v5ai.notes.service.IClientTrialService;
import xin.v5ai.notes.service.INoteRevisionService;
import xin.v5ai.notes.service.INoteTrashService;
import xin.v5ai.notes.util.NoteTrashPaths;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * 删除进入回收站。正文版本留到彻底删除或到期清除。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NoteTrashServiceImpl implements INoteTrashService {

    public static final int TRASH_RETAIN_DAYS = 30;

    static final String TYPE_NOTE = "1";

    static final String TYPE_DIRECTORY = "2";

    private static final String NOTE_FORBIDDEN = "note.forbidden";

    private static final String NOTE_MISSING = "note.missing";

    private static final String NOTE_TRASHED = "note.trashed";

    private static final String DIRECTORY_FORBIDDEN = "note.dir.forbidden";

    private static final String DIRECTORY_MISSING = "note.dir.missing";

    private static final String DIRECTORY_TRASHED = "note.dir.trashed";

    private static final String DIRECTORY_CHANGED = "note.dir.changed";

    private static final String TRASH_MISSING = "note.trash.missing";

    private final NoteTrashMapper trashMapper;

    private final INoteRevisionService revisionService;

    private final IClientTrialService trialService;

    private final ObjectProvider<INoteTrashService> self;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void moveNotes(Collection<Long> ids, boolean clientScope) {
        if (ids == null || ids.isEmpty()) {
            return;
        }
        for (Long id : ids) {
            moveNote(id, clientScope);
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void moveDirectories(Collection<Long> ids, boolean clientScope) {
        if (ids == null || ids.isEmpty()) {
            return;
        }
        for (Long id : ids) {
            moveDirectory(id, clientScope);
        }
    }

    @Override
    public PageResult<NoteTrashItemVo> list(Long userId, PageQuery pageQuery) {
        Page<NoteTrash> page = trashMapper.selectPage(page(pageQuery, 20, 50), Wrappers.<NoteTrash>lambdaQuery()
            .eq(NoteTrash::getUserId, userId)
            .orderByDesc(NoteTrash::getDeletedTime)
            .orderByDesc(NoteTrash::getId));
        return PageResult.build(toItems(page.getRecords()), page.getTotal());
    }

    @Override
    public PageResult<NoteTrashItemVo> listForAdmin(String name, String objectType, String userName, PageQuery pageQuery) {
        Page<NoteTrash> page = trashMapper.selectAdminPage(page(pageQuery, 10, 100), blankToNull(name), objectTypeOf(objectType), blankToNull(userName));
        return PageResult.build(toItems(page.getRecords()), page.getTotal());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public NoteTrashRestoreVo restore(Long trashId, Long userId) {
        NoteTrash trash = lockTrash(trashId);
        if (trash == null || !Objects.equals(trash.getUserId(), userId)) {
            throw new ServiceException(MessageUtils.message(TRASH_MISSING));
        }
        String type = typeOf(trash);
        Long parentId = resolveParent(trash.getOriginalParentId(), userId);
        boolean relocated = trash.getOriginalParentId() != null && trash.getOriginalParentId() != 0L && parentId == 0L;
        long extra = TYPE_NOTE.equals(type) ? trialService.noteBytes(trash.getObjectId()) : trialService.trashNoteBytes(trash.getId());
        trialService.assertCanWrite(userId, extra);
        if (TYPE_NOTE.equals(type)) {
            if (trashMapper.restoreNote(trash.getObjectId(), trash.getId(), userId, parentId) != 1) {
                throw new ServiceException(MessageUtils.message(TRASH_MISSING));
            }
        } else if (TYPE_DIRECTORY.equals(type)) {
            if (trashMapper.restoreDirectory(trash.getObjectId(), trash.getId(), userId, parentId) != 1) {
                throw new ServiceException(MessageUtils.message(TRASH_MISSING));
            }
            trashMapper.restoreChildDirectories(trash.getId(), userId, trash.getObjectId());
            trashMapper.restoreNotesByTrash(trash.getId(), userId);
        } else {
            throw new ServiceException(MessageUtils.message(TRASH_MISSING));
        }
        trashMapper.deleteById(trash.getId());
        NoteTrashRestoreVo restored = new NoteTrashRestoreVo();
        restored.setObjectType(type);
        restored.setObjectId(trash.getObjectId());
        restored.setParentId(parentId);
        restored.setRelocated(relocated);
        return restored;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public NoteTrashRestoreVo restoreForAdmin(Long trashId) {
        NoteTrash trash = trashMapper.selectById(trashId);
        if (trash == null) {
            throw new ServiceException(MessageUtils.message(TRASH_MISSING));
        }
        return restore(trashId, trash.getUserId());
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void purge(Long trashId, Long requiredUserId, boolean missingOk) {
        NoteTrash trash = lockTrash(trashId);
        if (trash == null) {
            if (missingOk) {
                return;
            }
            throw new ServiceException(MessageUtils.message(TRASH_MISSING));
        }
        if (requiredUserId != null && !Objects.equals(requiredUserId, trash.getUserId())) {
            throw new ServiceException(MessageUtils.message(TRASH_MISSING));
        }
        String type = typeOf(trash);
        if (TYPE_NOTE.equals(type)) {
            revisionService.deleteByNoteIds(List.of(trash.getObjectId()));
            trashMapper.deleteNotePhysical(trash.getObjectId(), trash.getId(), trash.getUserId());
        } else if (TYPE_DIRECTORY.equals(type)) {
            List<Long> noteIds = trashMapper.selectNoteIdsByTrash(trash.getId(), trash.getUserId());
            revisionService.deleteByNoteIds(noteIds);
            trashMapper.deleteNotesByTrash(trash.getId(), trash.getUserId());
            trashMapper.deleteDirectoriesByTrash(trash.getId(), trash.getUserId());
        } else {
            throw new ServiceException(MessageUtils.message(TRASH_MISSING));
        }
        trashMapper.deleteById(trash.getId());
    }

    @Override
    public int empty(Long userId) {
        return purgeEach(trashMapper.selectIdsByUser(userId), userId);
    }

    @Override
    public int emptyAll() {
        return purgeEach(trashMapper.selectAllIds(), null);
    }

    @Override
    public void purgeExpired() {
        List<Long> ids = trashMapper.selectExpiredIds(LocalDateTime.now());
        INoteTrashService proxy = self.getObject();
        for (Long id : ids) {
            try {
                proxy.purge(id, null, true);
            } catch (RuntimeException exception) {
                log.error("清除到期回收站记录 {} 失败", id, exception);
            }
        }
    }

    @Override
    public boolean ownedTrashedNote(Long noteId, Long userId) {
        NoteTrashSubject note = trashMapper.selectNote(noteId);
        return note != null && Objects.equals(note.getUserId(), userId) && !NoteTrashPaths.live(note.getDelFlag());
    }

    private void moveNote(Long id, boolean clientScope) {
        NoteTrashSubject note = requireLive(trashMapper.lockNote(id), clientScope, NOTE_FORBIDDEN, NOTE_MISSING, NOTE_TRASHED);
        Map<Long, NoteTrashSubject> directories = index(trashMapper.selectLiveDirectories(note.getUserId()));
        NoteTrash trash = insertTrash(note, TYPE_NOTE, 1, 0, pathFrom(directories, note.getParentId()));
        if (trashMapper.markNotes(note.getUserId(), List.of(note.getId()), trash.getId()) != 1) {
            throw new ServiceException(MessageUtils.message(NOTE_TRASHED));
        }
    }

    private void moveDirectory(Long id, boolean clientScope) {
        NoteTrashSubject directory = requireLive(trashMapper.lockDirectory(id), clientScope, DIRECTORY_FORBIDDEN, DIRECTORY_MISSING, DIRECTORY_TRASHED);
        List<NoteTrashSubject> liveDirectories = trashMapper.selectLiveDirectories(directory.getUserId());
        List<NoteTrashSubject> batch = descendants(liveDirectories, directory.getId());
        if (batch.isEmpty()) {
            throw new ServiceException(MessageUtils.message(DIRECTORY_TRASHED));
        }
        List<Long> directoryIds = batch.stream().map(NoteTrashSubject::getId).toList();
        List<Long> noteIds = trashMapper.selectLiveNoteIds(directory.getUserId(), directoryIds);
        NoteTrash trash = insertTrash(directory, TYPE_DIRECTORY, noteIds.size(), directoryIds.size(), pathFrom(index(liveDirectories), directory.getParentId()));
        if (trashMapper.markDirectories(directory.getUserId(), directoryIds, trash.getId()) != directoryIds.size()) {
            throw new ServiceException(MessageUtils.message(DIRECTORY_CHANGED));
        }
        if (!noteIds.isEmpty() && trashMapper.markNotes(directory.getUserId(), noteIds, trash.getId()) != noteIds.size()) {
            throw new ServiceException(MessageUtils.message(DIRECTORY_CHANGED));
        }
    }

    private NoteTrashSubject requireLive(NoteTrashSubject row, boolean clientScope, String forbidden, String missing, String trashed) {
        if (row == null) {
            throw new ServiceException(MessageUtils.message(clientScope ? forbidden : missing));
        }
        if (clientScope && !Objects.equals(row.getUserId(), LoginHelper.getUserId())) {
            throw new ServiceException(MessageUtils.message(forbidden));
        }
        if (!NoteTrashPaths.live(row.getDelFlag())) {
            throw new ServiceException(MessageUtils.message(trashed));
        }
        return row;
    }

    private NoteTrash insertTrash(NoteTrashSubject target, String type, int noteCount, int dirCount, String path) {
        LocalDateTime now = LocalDateTime.now();
        NoteTrash trash = new NoteTrash();
        trash.setUserId(target.getUserId());
        trash.setObjectType(type);
        trash.setObjectId(target.getId());
        trash.setName(target.getName() == null ? "" : target.getName());
        trash.setOriginalParentId(target.getParentId() == null ? 0L : target.getParentId());
        trash.setOriginalPath(path);
        trash.setNoteCount(noteCount);
        trash.setDirCount(dirCount);
        trash.setCreateBy(LoginHelper.getUserId());
        trash.setDeletedTime(now);
        trash.setExpireTime(now.plusDays(TRASH_RETAIN_DAYS));
        trashMapper.insert(trash);
        return trash;
    }

    private Long resolveParent(Long parentId, Long userId) {
        if (parentId == null || parentId == 0L) {
            return 0L;
        }
        NoteTrashSubject parent = trashMapper.selectLiveDirectory(parentId, userId);
        return parent == null ? 0L : parentId;
    }

    private int purgeEach(List<Long> ids, Long requiredUserId) {
        int failed = 0;
        INoteTrashService proxy = self.getObject();
        for (Long id : ids) {
            try {
                proxy.purge(id, requiredUserId, true);
            } catch (RuntimeException exception) {
                failed++;
                log.warn("清空回收站记录 {} 失败", id, exception);
            }
        }
        return failed;
    }

    private static Page<NoteTrash> page(PageQuery pageQuery, int defaultSize, int maxSize) {
        int pageNum = pageQuery.getPageNum() == null || pageQuery.getPageNum() < 1 ? 1 : pageQuery.getPageNum();
        int pageSize = pageQuery.getPageSize() == null || pageQuery.getPageSize() < 1 ? defaultSize : pageQuery.getPageSize();
        if (pageSize > maxSize) {
            pageSize = maxSize;
        }
        return new Page<>(pageNum, pageSize);
    }

    private static List<NoteTrashItemVo> toItems(List<NoteTrash> records) {
        LocalDate today = LocalDate.now();
        List<NoteTrashItemVo> rows = new ArrayList<>();
        for (NoteTrash trash : records) {
            NoteTrashItemVo item = new NoteTrashItemVo();
            item.setId(trash.getId());
            item.setUserId(trash.getUserId());
            item.setObjectType(typeOf(trash));
            item.setObjectId(trash.getObjectId());
            item.setName(trash.getName());
            item.setOriginalPath(trash.getOriginalPath());
            item.setNoteCount(trash.getNoteCount());
            item.setDirCount(trash.getDirCount());
            item.setDeletedTime(trash.getDeletedTime());
            item.setExpireTime(trash.getExpireTime());
            item.setDaysLeft(NoteTrashPaths.daysLeft(trash.getExpireTime(), today));
            rows.add(item);
        }
        return rows;
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String objectTypeOf(String objectType) {
        String trimmed = blankToNull(objectType);
        if (TYPE_NOTE.equals(trimmed) || TYPE_DIRECTORY.equals(trimmed)) {
            return trimmed;
        }
        return null;
    }

    private NoteTrash lockTrash(Long trashId) {
        return trashMapper.selectOne(Wrappers.<NoteTrash>lambdaQuery()
            .eq(NoteTrash::getId, trashId)
            .last("FOR UPDATE"));
    }

    private static Map<Long, NoteTrashSubject> index(List<NoteTrashSubject> directories) {
        Map<Long, NoteTrashSubject> byId = new HashMap<>();
        for (NoteTrashSubject directory : directories) {
            byId.put(directory.getId(), directory);
        }
        return byId;
    }

    private static String pathFrom(Map<Long, NoteTrashSubject> directories, Long parentId) {
        List<String> names = new ArrayList<>();
        Long current = parentId;
        Set<Long> seen = new HashSet<>();
        while (current != null && current != 0L && seen.add(current)) {
            NoteTrashSubject directory = directories.get(current);
            if (directory == null) {
                break;
            }
            names.add(0, directory.getName() == null ? "" : directory.getName());
            current = directory.getParentId();
        }
        return NoteTrashPaths.join(names);
    }

    private static List<NoteTrashSubject> descendants(List<NoteTrashSubject> directories, Long rootId) {
        Map<Long, List<NoteTrashSubject>> byParent = new HashMap<>();
        NoteTrashSubject root = null;
        for (NoteTrashSubject directory : directories) {
            if (rootId.equals(directory.getId())) {
                root = directory;
            }
            Long parentId = directory.getParentId() == null ? 0L : directory.getParentId();
            byParent.computeIfAbsent(parentId, key -> new ArrayList<>()).add(directory);
        }
        if (root == null) {
            return List.of();
        }
        List<NoteTrashSubject> collected = new ArrayList<>();
        ArrayDeque<NoteTrashSubject> queue = new ArrayDeque<>();
        Set<Long> seen = new HashSet<>();
        queue.add(root);
        while (!queue.isEmpty()) {
            NoteTrashSubject current = queue.removeFirst();
            if (!seen.add(current.getId())) {
                continue;
            }
            collected.add(current);
            queue.addAll(byParent.getOrDefault(current.getId(), List.of()));
        }
        return collected;
    }

    private static String typeOf(NoteTrash trash) {
        return trash.getObjectType() == null ? "" : trash.getObjectType().trim();
    }
}
