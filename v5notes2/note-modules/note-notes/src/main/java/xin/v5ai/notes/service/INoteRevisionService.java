package xin.v5ai.notes.service;

import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.notes.domain.NoteNotes;
import xin.v5ai.notes.domain.bo.NoteNotesBo;
import xin.v5ai.notes.domain.bo.NoteRestoreBo;
import xin.v5ai.notes.domain.vo.NoteHashVo;
import xin.v5ai.notes.domain.vo.NoteRestoreVo;
import xin.v5ai.notes.domain.vo.NoteRevisionDetailVo;
import xin.v5ai.notes.domain.vo.NoteRevisionItemVo;

import java.util.Collection;

/**
 * 笔记正文版本。
 */
public interface INoteRevisionService {

    int REVISION_RETAIN_COUNT = 50;

    /**
     * 新建笔记后写入初始版本，并返回正文哈希。
     */
    String recordInitial(NoteNotes note);

    /**
     * 客户端保存。必须带有效的 baseHash。
     */
    NoteHashVo saveClient(NoteNotesBo bo);

    /**
     * 管理端保存。未带 baseHash 时先补记库中正文再覆盖。
     */
    NoteHashVo saveAdmin(NoteNotesBo bo);

    /**
     * 读取时补齐尚未计算的正文哈希。补写失败仍返回计算出的哈希。
     */
    String ensureContentHash(NoteNotes note);

    void deleteByNoteIds(Collection<Long> noteIds);

    PageResult<NoteRevisionItemVo> list(Long noteId, PageQuery pageQuery);

    NoteRevisionDetailVo detail(Long noteId, Long revisionId);

    NoteRestoreVo restore(Long noteId, Long revisionId, NoteRestoreBo bo);

    /**
     * 管理端历史列表。不校验笔记归属，回收站中的笔记视为不存在。
     */
    PageResult<NoteRevisionItemVo> listForAdmin(Long noteId, PageQuery pageQuery);

    /**
     * 管理端读取某一版全文。
     */
    NoteRevisionDetailVo detailForAdmin(Long noteId, Long revisionId);

    /**
     * 管理端恢复。不要求客户端持有的正文哈希；当前正文不同时先记入历史再覆盖。
     */
    NoteRestoreVo restoreForAdmin(Long noteId, Long revisionId);
}
