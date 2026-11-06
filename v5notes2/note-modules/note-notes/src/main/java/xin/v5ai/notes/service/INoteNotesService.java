package xin.v5ai.notes.service;

import xin.v5ai.notes.domain.bo.ClientNotesBo;
import xin.v5ai.notes.domain.vo.NewNotesVo;
import xin.v5ai.notes.domain.vo.NoteNotesVo;
import xin.v5ai.notes.domain.bo.NoteNotesBo;
import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.notes.domain.vo.NotesContentVo;
import xin.v5ai.notes.domain.vo.NotesSearchVo;

import java.util.Collection;
import java.util.List;

/**
 * 笔记Service接口
 *
 * @author Lion Li
 * @date 2024-10-25
 */
public interface INoteNotesService {

    /**
     * 查询笔记
     *
     * @param id 主键
     * @return 笔记
     */
    NotesContentVo queryById(Long id);

    /**
     * 分页查询笔记列表
     *
     * @param bo        查询条件
     * @param pageQuery 分页参数
     * @return 笔记分页列表
     */
    PageResult<NoteNotesVo> queryPageList(NoteNotesBo bo, PageQuery pageQuery);

    /**
     * 查询符合条件的笔记列表
     *
     * @param bo 查询条件
     * @return 笔记列表
     */
    List<NoteNotesVo> queryList(NoteNotesBo bo);

    /**
     * 新增笔记
     *
     * @param bo 笔记
     * @return 是否新增成功
     */
    Boolean insertByBo(NoteNotesBo bo);

    /**
     * 修改笔记
     *
     * @param bo 笔记
     * @return 是否修改成功
     */
    Boolean updateByBo(NoteNotesBo bo);

    /**
     * 校验并批量删除笔记信息
     *
     * @param ids     待删除的主键集合
     * @param isValid 是否进行有效性校验
     * @return 是否删除成功
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);

    /**
     * 客户端分页查询笔记列表
     * @param bo
     * @param pageQuery
     * @return
     */
    PageResult<NoteNotesVo> queryPageClientList(ClientNotesBo bo, PageQuery pageQuery);

    /**
     * 客户端分页查询最新笔记列表
     * @param pageQuery
     * @return
     */
    PageResult<NewNotesVo> queryPageClientNewNotes(PageQuery pageQuery);

    /**
     * 客户端搜索笔记列表
     * @param bo
     * @return
     */
    List<NotesSearchVo> searchNotesList(ClientNotesBo bo);
}
