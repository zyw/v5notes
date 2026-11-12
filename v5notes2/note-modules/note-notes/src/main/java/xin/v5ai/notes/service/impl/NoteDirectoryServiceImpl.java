package xin.v5ai.notes.service.impl;

import cn.hutool.core.collection.CollUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.apache.commons.compress.utils.Lists;
import xin.v5ai.common.core.utils.MapstructUtils;
import xin.v5ai.common.core.utils.StringUtils;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.satoken.utils.LoginHelper;
import xin.v5ai.notes.convert.NotesConvert;
import xin.v5ai.notes.domain.NoteDirectory;
import xin.v5ai.notes.domain.NoteNotes;
import xin.v5ai.notes.domain.bo.NoteDirectoryBo;
import xin.v5ai.notes.domain.vo.NoteDirectoryVo;
import xin.v5ai.notes.domain.vo.NotesTreeVo;
import xin.v5ai.notes.mapper.NoteDirectoryMapper;
import xin.v5ai.notes.mapper.NoteNotesMapper;
import xin.v5ai.notes.service.IClientTrialService;
import xin.v5ai.notes.service.INoteDirectoryService;
import xin.v5ai.notes.service.INoteTrashService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 目录Service业务层处理
 *
 * @author Lion Li
 * @date 2024-10-25
 */
@RequiredArgsConstructor
@Service
public class NoteDirectoryServiceImpl implements INoteDirectoryService {

    private final NoteDirectoryMapper baseMapper;
    private final NoteNotesMapper notesMapper;
    private final INoteTrashService trashService;
    private final IClientTrialService trialService;

    /**
     * 查询目录
     *
     * @param id 主键
     * @return 目录
     */
    @Override
    public NoteDirectoryVo queryById(Long id){
        return baseMapper.selectVoById(id);
    }

    /**
     * 分页查询目录列表
     *
     * @param bo        查询条件
     * @param pageQuery 分页参数
     * @return 目录分页列表
     */
    @Override
    public PageResult<NoteDirectoryVo> queryPageList(NoteDirectoryBo bo, PageQuery pageQuery) {
        LambdaQueryWrapper<NoteDirectory> lqw = buildQueryWrapper(bo);
        Page<NoteDirectoryVo> result = baseMapper.selectVoPage(pageQuery.build(), lqw);
        return PageResult.build(result.getRecords(), result.getTotal());
    }

    /**
     * 查询符合条件的目录列表
     *
     * @param bo 查询条件
     * @return 目录列表
     */
    @Override
    public List<NoteDirectoryVo> queryList(NoteDirectoryBo bo) {
        LambdaQueryWrapper<NoteDirectory> lqw = buildQueryWrapper(bo);
        return baseMapper.selectVoList(lqw);
    }

    private LambdaQueryWrapper<NoteDirectory> buildQueryWrapper(NoteDirectoryBo bo) {
        Map<String, Object> params = bo.getParams();
        LambdaQueryWrapper<NoteDirectory> lqw = Wrappers.lambdaQuery();
        lqw.eq(bo.getUserId() != null, NoteDirectory::getUserId, bo.getUserId());
        applyUserNameFilter(lqw, "note_directory", bo.getUserName());
        lqw.eq(bo.getPid() != null, NoteDirectory::getPid, bo.getPid());
        lqw.like(StringUtils.isNotBlank(bo.getName()), NoteDirectory::getName, bo.getName());
        lqw.between(params.get("beginTime") != null && params.get("endTime") != null,
            NoteDirectory::getCreateTime, params.get("beginTime"), params.get("endTime"));
        return lqw;
    }

    /**
     * 新增目录
     *
     * @param bo 目录
     * @return 是否新增成功
     */
    @Override
    public Boolean insertByBo(NoteDirectoryBo bo) {
        NoteDirectory add = MapstructUtils.convert(bo, NoteDirectory.class);
        if (add.getUserId() == null) {
            add.setUserId(LoginHelper.getUserId());
        }
        Long deptId = add.getDeptId();
        add.setDeptId(deptId == null ? LoginHelper.getDeptId() : deptId);
        trialService.assertCanWrite(add.getUserId(), 0);
        validEntityBeforeSave(add);
        boolean flag = baseMapper.insert(add) > 0;
        if (flag) {
            bo.setId(add.getId());
        }
        return flag;
    }

    /**
     * 修改目录
     *
     * @param bo 目录
     * @return 是否修改成功
     */
    @Override
    public Boolean updateByBo(NoteDirectoryBo bo) {
        NoteDirectory update = MapstructUtils.convert(bo, NoteDirectory.class);
        trialService.assertCanWrite(LoginHelper.getUserId(), 0);
        validEntityBeforeSave(update);
        return baseMapper.updateById(update) > 0;
    }

    /**
     * 保存前的数据校验
     */
    private void validEntityBeforeSave(NoteDirectory entity){
        //TODO 做一些数据校验,如唯一约束
    }

    /**
     * 校验并批量删除目录信息
     *
     * @param ids     待删除的主键集合
     * @param isValid 是否进行有效性校验
     * @return 是否删除成功
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid) {
        trashService.moveDirectories(ids, false);
        return true;
    }

    @Override
    public List<NotesTreeVo> dirTreeList() {
        return dirTreeList(null, null);
    }

    @Override
    public List<NotesTreeVo> dirTreeList(Long userId) {
        return dirTreeList(userId, null);
    }

    @Override
    public List<NotesTreeVo> dirTreeList(Long userId, String userName) {
        return assembleTree(listDirectories(userId, userName), List.of());
    }

    @Override
    public List<NotesTreeVo> notesTreeList() {
        return notesTreeList(null, null);
    }

    @Override
    public List<NotesTreeVo> notesTreeList(Long userId) {
        return notesTreeList(userId, null);
    }

    @Override
    public List<NotesTreeVo> notesTreeList(Long userId, String userName) {
        return assembleTree(listDirectories(userId, userName), listNotes(userId, userName));
    }

    @Override
    public List<Long> getChildIds(Long parentId) {
        List<Long> result = Lists.newArrayList();
        List<Long> sbuDirs = baseMapper.selectObjs(Wrappers.lambdaQuery(NoteDirectory.class).eq(NoteDirectory::getPid, parentId));
        if (CollUtil.isNotEmpty(sbuDirs)) {
            result.addAll(sbuDirs);
            for (Long id : sbuDirs) {
                result.addAll(getChildIds(id));
            }
        }
        return result;
    }

    private List<NoteDirectory> listDirectories(Long userId, String userName) {
        LambdaQueryWrapper<NoteDirectory> query = Wrappers.lambdaQuery();
        query.eq(userId != null, NoteDirectory::getUserId, userId);
        applyUserNameFilter(query, "note_directory", userName);
        return baseMapper.selectList(query);
    }

    private List<NoteNotes> listNotes(Long userId, String userName) {
        LambdaQueryWrapper<NoteNotes> query = Wrappers.lambdaQuery();
        query.eq(userId != null, NoteNotes::getUserId, userId);
        applyUserNameFilter(query, "note_notes", userName);
        return notesMapper.selectList(query);
    }

    private static void applyUserNameFilter(LambdaQueryWrapper<?> query, String tableName, String userName) {
        if (StringUtils.isBlank(userName)) {
            return;
        }
        query.apply("exists (select 1 from sys_user u where u.user_id = " + tableName + ".user_id and u.user_name like concat('%', {0}, '%'))",
            userName);
    }

    private List<NotesTreeVo> assembleTree(List<NoteDirectory> directories, List<NoteNotes> notes) {
        List<NotesTreeVo> result = Lists.newArrayList();
        directories.stream().filter(item -> Objects.equals(item.getPid(), 0L)).forEach(item -> {
            NotesTreeVo vo = NotesConvert.INSTANCE.directoryToTree(item);
            vo.setChildren(childNodes(directories, notes, item.getId()));
            result.add(vo);
        });
        notes.stream().filter(item -> Objects.equals(item.getDirId(), 0L)).forEach(item -> result.add(NotesConvert.INSTANCE.noteToTree(item)));
        return result;
    }

    private List<NotesTreeVo> childNodes(List<NoteDirectory> directories, List<NoteNotes> notes, Long pid) {
        List<NotesTreeVo> result = Lists.newArrayList();
        directories.stream().filter(item -> Objects.equals(item.getPid(), pid)).forEach(item -> {
            NotesTreeVo vo = NotesConvert.INSTANCE.directoryToTree(item);
            vo.setChildren(childNodes(directories, notes, item.getId()));
            result.add(vo);
        });
        notes.stream().filter(item -> Objects.equals(item.getDirId(), pid)).forEach(item -> result.add(NotesConvert.INSTANCE.noteToTree(item)));
        return result.isEmpty() ? null : result;
    }
}
