package xin.v5ai.notes.service;

import xin.v5ai.notes.domain.vo.NoteDirectoryVo;
import xin.v5ai.notes.domain.bo.NoteDirectoryBo;
import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.notes.domain.vo.NotesTreeVo;

import java.util.Collection;
import java.util.List;

/**
 * 目录Service接口
 *
 * @author Lion Li
 * @date 2024-10-25
 */
public interface INoteDirectoryService {

    /**
     * 查询目录
     *
     * @param id 主键
     * @return 目录
     */
    NoteDirectoryVo queryById(Long id);

    /**
     * 分页查询目录列表
     *
     * @param bo        查询条件
     * @param pageQuery 分页参数
     * @return 目录分页列表
     */
    PageResult<NoteDirectoryVo> queryPageList(NoteDirectoryBo bo, PageQuery pageQuery);

    /**
     * 查询符合条件的目录列表
     *
     * @param bo 查询条件
     * @return 目录列表
     */
    List<NoteDirectoryVo> queryList(NoteDirectoryBo bo);

    /**
     * 新增目录
     *
     * @param bo 目录
     * @return 是否新增成功
     */
    Boolean insertByBo(NoteDirectoryBo bo);

    /**
     * 修改目录
     *
     * @param bo 目录
     * @return 是否修改成功
     */
    Boolean updateByBo(NoteDirectoryBo bo);

    /**
     * 校验并批量删除目录信息
     *
     * @param ids     待删除的主键集合
     * @param isValid 是否进行有效性校验
     * @return 是否删除成功
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);

    /**
     * 获取目录树
     * @return
     */
    List<NotesTreeVo> dirTreeList();

    /**
     * 获取指定用户的目录树（客户端按登录用户隔离）
     * @param userId 用户ID；null 表示沿用数据权限
     * @return 目录树
     */
    List<NotesTreeVo> dirTreeList(Long userId);

    /**
     * 管理端按所属用户筛选目录树
     *
     * @param userId   用户 ID；可空
     * @param userName 用户账号模糊匹配；可空
     * @return 目录树
     */
    List<NotesTreeVo> dirTreeList(Long userId, String userName);

    /**
     * 获取目录笔记树
     * @return
     */
    List<NotesTreeVo> notesTreeList();

    /**
     * 获取指定用户的目录笔记树（客户端按登录用户隔离）
     * @param userId 用户ID；null 表示沿用数据权限
     * @return 目录笔记树
     */
    List<NotesTreeVo> notesTreeList(Long userId);

    /**
     * 管理端按所属用户筛选目录笔记树
     *
     * @param userId   用户 ID；可空
     * @param userName 用户账号模糊匹配；可空
     * @return 目录笔记树
     */
    List<NotesTreeVo> notesTreeList(Long userId, String userName);

    /**
     * 获取子目录id
     * @param parentId 父级id
     * @return 所有子目录ID
     */
    List<Long> getChildIds(Long parentId);
}
