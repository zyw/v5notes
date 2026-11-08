package xin.v5ai.notes.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import xin.v5ai.common.core.constant.HttpStatus;
import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.core.exception.ServiceException;
import xin.v5ai.common.core.utils.StringUtils;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.common.satoken.utils.LoginHelper;
import xin.v5ai.notes.domain.NoteNotes;
import xin.v5ai.notes.domain.NoteRevision;
import xin.v5ai.notes.domain.bo.NoteNotesBo;
import xin.v5ai.notes.domain.bo.NoteRestoreBo;
import xin.v5ai.notes.domain.vo.NoteHashVo;
import xin.v5ai.notes.domain.vo.NoteRestoreVo;
import xin.v5ai.notes.domain.vo.NoteRevisionDetailVo;
import xin.v5ai.notes.domain.vo.NoteRevisionItemVo;
import xin.v5ai.notes.exception.NoteContentConflictException;
import xin.v5ai.notes.mapper.NoteNotesMapper;
import xin.v5ai.notes.mapper.NoteRevisionMapper;
import xin.v5ai.notes.service.INoteRevisionService;
import xin.v5ai.notes.util.NoteContentDigest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Objects;

/**
 * 追加正文快照，并把笔记表保持为最新正文。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NoteRevisionServiceImpl implements INoteRevisionService {

    private static final String MISSING_REVISION = "版本不存在";

    private static final String FORBIDDEN_NOTE = "无权操作该笔记";

    private final NoteRevisionMapper revisionMapper;

    private final NoteNotesMapper noteNotesMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String recordInitial(NoteNotes note) {
        String content = NoteContentDigest.text(note.getContent());
        String hash = NoteContentDigest.sha256(content);
        note.setContentHash(hash);
        NoteNotes patch = new NoteNotes();
        patch.setId(note.getId());
        patch.setContentHash(hash);
        noteNotesMapper.updateById(patch);
        insertRevision(note, content, hash);
        trim(note.getId());
        return hash;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public NoteHashVo saveClient(NoteNotesBo bo) {
        requireBaseHash(bo.getBaseHash());
        return write(bo, true);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public NoteHashVo saveAdmin(NoteNotesBo bo) {
        return write(bo, false);
    }

    @Override
    public String ensureContentHash(NoteNotes note) {
        if (StringUtils.isNotBlank(note.getContentHash())) {
            return NoteContentDigest.normalizeHash(note.getContentHash());
        }
        String hash = NoteContentDigest.sha256(note.getContent());
        try {
            noteNotesMapper.fillContentHash(note.getId(), hash);
            note.setContentHash(hash);
        } catch (RuntimeException exception) {
            log.warn("补写笔记 {} 的正文哈希失败", note.getId(), exception);
        }
        return hash;
    }

    @Override
    public void deleteByNoteIds(Collection<Long> noteIds) {
        if (noteIds == null || noteIds.isEmpty()) {
            return;
        }
        revisionMapper.delete(Wrappers.<NoteRevision>lambdaQuery().in(NoteRevision::getNoteId, noteIds));
    }

    @Override
    public PageResult<NoteRevisionItemVo> list(Long noteId, PageQuery pageQuery) {
        NoteNotes note = requireNote(noteId, MISSING_REVISION);
        String noteHash = ensureContentHash(note);
        int pageNum = pageQuery.getPageNum() == null || pageQuery.getPageNum() < 1 ? 1 : pageQuery.getPageNum();
        int pageSize = pageQuery.getPageSize() == null ? 20 : pageQuery.getPageSize();
        if (pageSize < 1) {
            pageSize = 20;
        }
        if (pageSize > REVISION_RETAIN_COUNT) {
            pageSize = REVISION_RETAIN_COUNT;
        }
        Page<NoteRevision> page = revisionMapper.selectPage(new Page<>(pageNum, pageSize), listQuery(noteId));
        List<NoteRevisionItemVo> rows = new java.util.ArrayList<>();
        List<NoteRevision> records = page.getRecords();
        for (int index = 0; index < records.size(); index++) {
            NoteRevision revision = records.get(index);
            NoteRevisionItemVo item = new NoteRevisionItemVo();
            item.setId(revision.getId());
            item.setNoteId(revision.getNoteId());
            item.setContentHash(NoteContentDigest.normalizeHash(revision.getContentHash()));
            item.setExcerpt(revision.getExcerpt());
            item.setSize(revision.getSize());
            item.setCreateTime(revision.getCreateTime());
            item.setHead(pageNum == 1 && index == 0 && noteHash.equals(item.getContentHash()));
            rows.add(item);
        }
        return PageResult.build(rows, page.getTotal());
    }

    @Override
    public NoteRevisionDetailVo detail(Long noteId, Long revisionId) {
        requireNote(noteId, MISSING_REVISION);
        NoteRevision revision = requireRevision(noteId, revisionId);
        return toDetail(revision);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public NoteRestoreVo restore(Long noteId, Long revisionId, NoteRestoreBo bo) {
        NoteRestoreBo request = bo == null ? new NoteRestoreBo() : bo;
        requireBaseHash(request.getBaseHash());
        NoteNotes note = lockNote(noteId, MISSING_REVISION);
        NoteRevision target = requireRevision(noteId, revisionId);
        String currentContent = NoteContentDigest.text(note.getContent());
        String currentHash = currentHash(note, currentContent);
        if (!Boolean.TRUE.equals(request.getForce())
            && !currentHash.equals(NoteContentDigest.normalizeHash(request.getBaseHash()))) {
            throw new NoteContentConflictException(currentHash, note.getUpdateTime());
        }
        String restored = NoteContentDigest.text(target.getContent());
        String restoredHash = NoteContentDigest.sha256(restored);
        if (!restoredHash.equals(currentHash)) {
            snapshotCurrentIfMissing(note, currentContent, currentHash);
            insertCopy(note, target, restored, restoredHash);
            updateNote(note.getId(), note.getName(), note.getDirId(), restored, restoredHash, true);
            trim(note.getId());
        }
        NoteRestoreVo vo = new NoteRestoreVo();
        vo.setContent(restored);
        vo.setContentHash(restoredHash);
        vo.setUpdateTime(LocalDateTime.now());
        return vo;
    }

    private NoteHashVo write(NoteNotesBo bo, boolean client) {
        NoteNotes note = lockNote(bo.getId(), client ? FORBIDDEN_NOTE : "笔记不存在");
        String currentContent = NoteContentDigest.text(note.getContent());
        String currentHash = currentHash(note, currentContent);
        boolean force = Boolean.TRUE.equals(bo.getForce());
        if (client && !force && !currentHash.equals(NoteContentDigest.normalizeHash(bo.getBaseHash()))) {
            throw new NoteContentConflictException(currentHash, note.getUpdateTime());
        }
        String incoming = bo.getContent() == null ? currentContent : bo.getContent();
        String newHash = NoteContentDigest.sha256(incoming);
        boolean contentChanged = !newHash.equals(currentHash);
        if (contentChanged) {
            snapshotCurrentIfMissing(note, currentContent, currentHash);
            insertRevision(note, incoming, newHash);
        }
        updateNote(note.getId(), bo.getName(), bo.getDirId(), incoming, newHash, bo.getContent() != null || contentChanged || StringUtils.isBlank(note.getContentHash()));
        if (contentChanged) {
            trim(note.getId());
        }
        NoteHashVo vo = new NoteHashVo();
        vo.setContentHash(newHash);
        return vo;
    }

    private void requireBaseHash(String baseHash) {
        if (StringUtils.isBlank(baseHash)) {
            throw new ServiceException("缺少正文版本", HttpStatus.BAD_REQUEST);
        }
        if (!NoteContentDigest.isHash(baseHash)) {
            throw new ServiceException("正文版本无效", HttpStatus.BAD_REQUEST);
        }
    }

    private String currentHash(NoteNotes note, String currentContent) {
        if (StringUtils.isNotBlank(note.getContentHash())) {
            return NoteContentDigest.normalizeHash(note.getContentHash());
        }
        return NoteContentDigest.sha256(currentContent);
    }

    private void snapshotCurrentIfMissing(NoteNotes note, String currentContent, String currentHash) {
        NoteRevision latest = latest(note.getId());
        String latestHash = latest == null ? null : NoteContentDigest.normalizeHash(latest.getContentHash());
        if (NoteContentDigest.needsCurrentSnapshot(latestHash, currentHash)) {
            insertRevision(note, currentContent, currentHash);
        }
    }

    private void insertCopy(NoteNotes note, NoteRevision source, String content, String hash) {
        NoteRevision revision = baseRevision(note, content, hash);
        revision.setExcerpt(source.getExcerpt() == null ? NoteContentDigest.excerpt(content) : source.getExcerpt());
        revision.setSize(source.getSize() == null ? NoteContentDigest.utf8Size(content) : source.getSize());
        revisionMapper.insert(revision);
    }

    private void insertRevision(NoteNotes note, String content, String hash) {
        NoteRevision revision = baseRevision(note, content, hash);
        revision.setExcerpt(NoteContentDigest.excerpt(content));
        revision.setSize(NoteContentDigest.utf8Size(content));
        revisionMapper.insert(revision);
    }

    private NoteRevision baseRevision(NoteNotes note, String content, String hash) {
        NoteRevision revision = new NoteRevision();
        revision.setNoteId(note.getId());
        revision.setUserId(note.getUserId());
        revision.setContent(content);
        revision.setContentHash(hash);
        revision.setCreateBy(LoginHelper.getUserId());
        revision.setCreateDept(LoginHelper.getDeptId());
        revision.setCreateTime(LocalDateTime.now());
        return revision;
    }

    private void updateNote(Long id, String name, Long dirId, String content, String hash, boolean writeContent) {
        NoteNotes patch = new NoteNotes();
        patch.setId(id);
        patch.setName(name);
        patch.setDirId(dirId);
        patch.setContentHash(hash);
        if (writeContent) {
            patch.setContent(content);
        }
        noteNotesMapper.updateById(patch);
    }

    private void trim(Long noteId) {
        List<NoteRevision> kept = revisionMapper.selectList(Wrappers.<NoteRevision>lambdaQuery()
            .select(NoteRevision::getId)
            .eq(NoteRevision::getNoteId, noteId)
            .orderByDesc(NoteRevision::getCreateTime)
            .orderByDesc(NoteRevision::getId)
            .last("LIMIT " + REVISION_RETAIN_COUNT));
        if (kept.size() < REVISION_RETAIN_COUNT) {
            return;
        }
        List<Long> keepIds = kept.stream().map(NoteRevision::getId).toList();
        revisionMapper.delete(Wrappers.<NoteRevision>lambdaQuery()
            .eq(NoteRevision::getNoteId, noteId)
            .notIn(NoteRevision::getId, keepIds));
    }

    private NoteRevision latest(Long noteId) {
        return revisionMapper.selectOne(Wrappers.<NoteRevision>lambdaQuery()
            .eq(NoteRevision::getNoteId, noteId)
            .orderByDesc(NoteRevision::getCreateTime)
            .orderByDesc(NoteRevision::getId)
            .last("LIMIT 1"));
    }

    private LambdaQueryWrapper<NoteRevision> listQuery(Long noteId) {
        return Wrappers.<NoteRevision>lambdaQuery()
            .select(NoteRevision::getId, NoteRevision::getNoteId, NoteRevision::getContentHash,
                NoteRevision::getExcerpt, NoteRevision::getSize, NoteRevision::getCreateTime)
            .eq(NoteRevision::getNoteId, noteId)
            .orderByDesc(NoteRevision::getCreateTime)
            .orderByDesc(NoteRevision::getId);
    }

    private NoteNotes lockNote(Long id, String missingMessage) {
        NoteNotes note = noteNotesMapper.selectOne(Wrappers.<NoteNotes>lambdaQuery()
            .eq(NoteNotes::getId, id)
            .last("FOR UPDATE"));
        if (note == null) {
            throw new ServiceException(missingMessage);
        }
        if (FORBIDDEN_NOTE.equals(missingMessage) && !Objects.equals(note.getUserId(), LoginHelper.getUserId())) {
            throw new ServiceException(FORBIDDEN_NOTE);
        }
        if (MISSING_REVISION.equals(missingMessage) && !Objects.equals(note.getUserId(), LoginHelper.getUserId())) {
            throw new ServiceException(MISSING_REVISION);
        }
        return note;
    }

    private NoteNotes requireNote(Long id, String missingMessage) {
        NoteNotes note = noteNotesMapper.selectById(id);
        if (note == null || !Objects.equals(note.getUserId(), LoginHelper.getUserId())) {
            throw new ServiceException(missingMessage);
        }
        return note;
    }

    private NoteRevision requireRevision(Long noteId, Long revisionId) {
        NoteRevision revision = revisionMapper.selectById(revisionId);
        if (revision == null || !Objects.equals(revision.getNoteId(), noteId)) {
            throw new ServiceException(MISSING_REVISION);
        }
        NoteNotes note = noteNotesMapper.selectById(noteId);
        if (note == null || !Objects.equals(revision.getUserId(), note.getUserId())) {
            throw new ServiceException(MISSING_REVISION);
        }
        return revision;
    }

    private NoteRevisionDetailVo toDetail(NoteRevision revision) {
        NoteRevisionDetailVo detail = new NoteRevisionDetailVo();
        detail.setId(revision.getId());
        detail.setNoteId(revision.getNoteId());
        detail.setContent(NoteContentDigest.text(revision.getContent()));
        detail.setContentHash(NoteContentDigest.normalizeHash(revision.getContentHash()));
        detail.setExcerpt(revision.getExcerpt());
        detail.setSize(revision.getSize());
        detail.setCreateTime(revision.getCreateTime());
        return detail;
    }
}
