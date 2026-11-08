package xin.v5ai.notes.service;

import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.notes.domain.vo.NoteTrashItemVo;
import xin.v5ai.notes.domain.vo.NoteTrashRestoreVo;

import java.util.Collection;

/**
 * 把笔记和目录送入回收站，并支持恢复、彻底删除和到期清除。
 */
public interface INoteTrashService {

    /**
     * 每篇笔记各写一条回收站记录，放在同一个事务里。
     *
     * @param clientScope 为 true 时只允许删除当前登录用户自己的笔记
     */
    void moveNotes(Collection<Long> ids, boolean clientScope);

    /**
     * 每个目录各写一条回收站记录。子孙中仍然有效的笔记和目录使用同一个批次。
     *
     * @param clientScope 为 true 时只允许删除当前登录用户自己的目录
     */
    void moveDirectories(Collection<Long> ids, boolean clientScope);

    PageResult<NoteTrashItemVo> list(Long userId, PageQuery pageQuery);

    NoteTrashRestoreVo restore(Long trashId, Long userId);

    /**
     * 彻底删除一条记录及其正文版本。
     *
     * @param requiredUserId 非空时必须与记录所属用户一致
     * @param missingOk      记录已经不存在时直接返回
     */
    void purge(Long trashId, Long requiredUserId, boolean missingOk);

    /**
     * 清空指定用户的回收站。每条单独提交，返回未能清除的条数。
     */
    int empty(Long userId);

    /**
     * 清除已经到期的记录。单条失败只记录日志。
     */
    void purgeExpired();

    /**
     * 笔记属于该用户，且已经不在目录树中。
     */
    boolean ownedTrashedNote(Long noteId, Long userId);
}
