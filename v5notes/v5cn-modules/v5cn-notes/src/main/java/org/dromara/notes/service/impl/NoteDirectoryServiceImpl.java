package org.dromara.notes.service.impl;

import cn.hutool.core.collection.CollUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.apache.commons.compress.utils.Lists;
import org.dromara.common.core.utils.MapstructUtils;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.mybatis.core.page.TableDataInfo;
import org.dromara.common.satoken.utils.LoginHelper;
import org.dromara.notes.convert.NotesConvert;
import org.dromara.notes.domain.NoteDirectory;
import org.dromara.notes.domain.NoteNotes;
import org.dromara.notes.domain.bo.NoteDirectoryBo;
import org.dromara.notes.domain.vo.NoteDirectoryVo;
import org.dromara.notes.domain.vo.NoteNotesVo;
import org.dromara.notes.domain.vo.NotesTreeVo;
import org.dromara.notes.mapper.NoteDirectoryMapper;
import org.dromara.notes.mapper.NoteNotesMapper;
import org.dromara.notes.service.INoteDirectoryService;
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
    public TableDataInfo<NoteDirectoryVo> queryPageList(NoteDirectoryBo bo, PageQuery pageQuery) {
        LambdaQueryWrapper<NoteDirectory> lqw = buildQueryWrapper(bo);
        Page<NoteDirectoryVo> result = baseMapper.selectVoPage(pageQuery.build(), lqw);
        return TableDataInfo.build(result);
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
        add.setUserId(LoginHelper.getUserId());
        Long deptId = add.getDeptId();
        add.setDeptId(deptId == null ? LoginHelper.getDeptId() : deptId);
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
        if(isValid){
            //TODO 做一些业务上的校验,判断是否需要校验
        }
        // 删除目录下所用笔记和子目录再删除目录
        recursiveDelete(ids);
        // 删除选中目录
        return true;
    }

    @Override
    public List<NotesTreeVo> dirTreeList() {
        List<NotesTreeVo> result = Lists.newArrayList();
        Long userId = LoginHelper.getUserId();
//        List<NoteDirectoryVo> dirlist = baseMapper.selectByUserId(userId);
        // 使用数据权限，不需要单独指定用户ID
        List<NoteDirectoryVo> dirlist = baseMapper.selectVoList();
        List<NoteDirectoryVo> parentDirList = dirlist.stream().filter(item -> item.getPid() == 0).toList();
        parentDirList.forEach(item -> {
            NotesTreeVo vo = NotesConvert.INSTANCE.dirVoToNotesTreeVo(item);
            vo.setChildren(getChild(dirlist, item.getId(), List.of()));
            result.add(vo);
        });
        return result;
    }

    @Override
    public List<NotesTreeVo> notesTreeList() {
        List<NotesTreeVo> result = Lists.newArrayList();
        Long userId = LoginHelper.getUserId();
//        List<NoteDirectoryVo> dirlist = baseMapper.selectByUserId(userId);
        // 使用数据权限，不需要单独指定用户ID
        List<NoteDirectoryVo> dirlist = baseMapper.selectVoList();
//        List<NoteNotesVo> notesList = notesMapper.selectByUserId(userId);
        // 使用数据权限，不需要单独指定用户ID
        List<NoteNotesVo> notesList = notesMapper.selectVoList();
        List<NoteDirectoryVo> parentDirList = dirlist.stream().filter(item -> item.getPid() == 0).toList();
        parentDirList.forEach(item -> {
            NotesTreeVo vo = NotesConvert.INSTANCE.dirVoToNotesTreeVo(item);
            vo.setChildren(getChild(dirlist, item.getId(), notesList));
            result.add(vo);
        });
        List<NoteNotesVo> notesVos = notesList.stream().filter(item -> item.getDirId() == 0).toList();
        notesVos.forEach(item -> {
            NotesTreeVo notesTreeVo = NotesConvert.INSTANCE.nnVoToNotesTreeVo(item);
            result.add(notesTreeVo);
        });
        return result;
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

    private List<NotesTreeVo> getChild(List<NoteDirectoryVo> list, Long pid,List<NoteNotesVo> notesList) {
        List<NotesTreeVo> result = Lists.newArrayList();
        List<NoteDirectoryVo> childList = list.stream().filter(item -> Objects.equals(item.getPid(), pid)).toList();
        List<NoteNotesVo> notesVos = notesList.stream().filter(item -> Objects.equals(item.getDirId(), pid)).toList();
        if(!childList.isEmpty()) {
            childList.forEach(item -> {
                NotesTreeVo vo = NotesConvert.INSTANCE.dirVoToNotesTreeVo(item);
                vo.setChildren(getChild(list, item.getId(), notesList));
                result.add(vo);
            });
        }
        if(!notesVos.isEmpty()) {
            notesVos.forEach(item -> {
                NotesTreeVo notesTreeVo = NotesConvert.INSTANCE.nnVoToNotesTreeVo(item);
                result.add(notesTreeVo);
            });
        }
        return result.isEmpty() ? null : result;
    }

    private void recursiveDelete(Collection<Long> pids) {
        pids.forEach(pid -> {
            // 目录下是否有子目录
            LambdaQueryWrapper<NoteDirectory> queryDirect = Wrappers.lambdaQuery();
            queryDirect.eq(NoteDirectory::getPid, pid);
            List<NoteDirectoryVo> list = baseMapper.selectVoList(queryDirect);

            // 删除目录下笔记
            LambdaQueryWrapper<NoteNotes> queryNotes = Wrappers.lambdaQuery();
            queryNotes.eq(NoteNotes::getDirId, pid);
//            queryNotes.eq(NoteNotes::getDelFlag, 0); // 系统自动添加了，无需手动添加
            List<NoteNotesVo> listNotes = notesMapper.selectVoList(queryNotes);
            if (CollUtil.isNotEmpty(listNotes)) {
                notesMapper.deleteByIds(listNotes.stream().map(NoteNotesVo::getId).toList());
            }
            if (CollUtil.isNotEmpty(list)) {
                recursiveDelete(list.stream().map(NoteDirectoryVo::getId).toList());
            }
            baseMapper.deleteById(pid);
        });
    }
}
