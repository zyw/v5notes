package xin.v5ai.notes.service.impl;

import cn.hutool.core.io.unit.DataSizeUtil;
import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import xin.v5ai.common.core.utils.MapstructUtils;
import xin.v5ai.common.core.utils.StringUtils;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.satoken.utils.LoginHelper;
import xin.v5ai.notes.convert.NotesConvert;
import xin.v5ai.notes.domain.NoteNotes;
import xin.v5ai.notes.domain.bo.ClientNotesBo;
import xin.v5ai.notes.domain.bo.NoteNotesBo;
import xin.v5ai.notes.domain.vo.NewNotesVo;
import xin.v5ai.notes.domain.vo.NoteNotesVo;
import xin.v5ai.notes.domain.vo.NotesContentVo;
import xin.v5ai.notes.domain.vo.NotesSearchVo;
import xin.v5ai.notes.mapper.NoteNotesMapper;
import xin.v5ai.notes.service.IClientTrialService;
import xin.v5ai.notes.service.INoteDirectoryService;
import xin.v5ai.notes.service.INoteNotesService;
import xin.v5ai.notes.service.INoteRevisionService;
import xin.v5ai.notes.service.INoteTrashService;
import xin.v5ai.notes.util.NoteContentDigest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * 笔记Service业务层处理
 *
 * @author Lion Li
 * @date 2024-10-25
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class NoteNotesServiceImpl implements INoteNotesService {

    private final NoteNotesMapper baseMapper;

    private final INoteDirectoryService directoryService;

    private final INoteRevisionService revisionService;

    private final INoteTrashService trashService;

    private final IClientTrialService trialService;

    // markdown标签匹配正则
    private final static String MARKDOWN_REGEX = "\\*\\*(.*?)\\*\\*|__(.*?)__|~~(.*?)~~|`(.*?)`|\\[(.*?)\\]\\((.*?)\\)|!\\[(.*?)\\]\\((.*?)\\)|<.*?>|#{1,6}(.*?)|^-{3,}|-{3,}";

    /**
     * 查询笔记
     *
     * @param id 主键
     * @return 笔记
     */
    @Override
    public NotesContentVo queryById(Long id){
        NoteNotes entity = baseMapper.selectById(id);
        if (entity == null) {
            return null;
        }
        NotesContentVo vo = new NotesContentVo();
        vo.setId(entity.getId());
        vo.setName(entity.getName());
        vo.setDirId(entity.getDirId());
        vo.setUserId(entity.getUserId());
        vo.setContent(entity.getContent());
        vo.setUpdateTime(entity.getUpdateTime());
        vo.setContentHash(revisionService.ensureContentHash(entity));
        return vo;
    }

    /**
     * 分页查询笔记列表
     *
     * @param bo        查询条件
     * @param pageQuery 分页参数
     * @return 笔记分页列表
     */
    @Override
    public PageResult<NoteNotesVo> queryPageList(NoteNotesBo bo, PageQuery pageQuery) {
        LambdaQueryWrapper<NoteNotes> lqw = buildQueryWrapper(bo);
        Page<NoteNotesVo> result = baseMapper.selectVoPage(pageQuery.build(), lqw);
        // 计算文件大小
        calcFileSize(result);
        return PageResult.build(result.getRecords(), result.getTotal());
    }

    /**
     * 查询符合条件的笔记列表
     *
     * @param bo 查询条件
     * @return 笔记列表
     */
    @Override
    public List<NoteNotesVo> queryList(NoteNotesBo bo) {
        LambdaQueryWrapper<NoteNotes> lqw = buildQueryWrapper(bo);
        return baseMapper.selectVoList(lqw);
    }

    private LambdaQueryWrapper<NoteNotes> buildQueryWrapper(NoteNotesBo bo) {
        Map<String, Object> params = bo.getParams();
        String searchValue = bo.getSearchValue();
        LambdaQueryWrapper<NoteNotes> lqw = Wrappers.lambdaQuery();
        lqw.and(StringUtils.isNotBlank(searchValue),wapper ->
                wapper.like(NoteNotes::getName, searchValue)
                .or()
                .like(NoteNotes::getContent, searchValue)
            );
//        lqw.and(wapper -> {
//            wapper.eq(bo.getDirId() != null, NoteNotes::getDirId, bo.getDirId());
//            wapper.between(params.get("beginTime") != null && params.get("endTime") != null,
//                NoteNotes::getCreateTime, params.get("beginTime"), params.get("endTime"));
//        });
        lqw.eq(bo.getDirId() != null, NoteNotes::getDirId, bo.getDirId());
        lqw.between(params.get("beginTime") != null && params.get("endTime") != null,
            NoteNotes::getCreateTime, params.get("beginTime"), params.get("endTime"));
        return lqw;
    }

    /**
     * 新增笔记
     *
     * @param bo 笔记
     * @return 是否新增成功
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean insertByBo(NoteNotesBo bo) {
        NoteNotes add = MapstructUtils.convert(bo, NoteNotes.class);
        add.setUserId(LoginHelper.getUserId());
        Long deptId = add.getDeptId();
        add.setDeptId(deptId == null ? LoginHelper.getDeptId() : deptId);
        trialService.assertCanWrite(add.getUserId(), NoteContentDigest.utf8Size(add.getContent()));
        validEntityBeforeSave(add);
        boolean flag = baseMapper.insert(add) > 0;
        if (flag) {
            bo.setId(add.getId());
            bo.setContentHash(revisionService.recordInitial(add));
        }
        return flag;
    }

    /**
     * 修改笔记
     *
     * @param bo 笔记
     * @return 是否修改成功
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean updateByBo(NoteNotesBo bo) {
        NoteNotes update = MapstructUtils.convert(bo, NoteNotes.class);
        validEntityBeforeSave(update);
        revisionService.saveAdmin(bo);
        return true;
    }

    /**
     * 保存前的数据校验
     */
    private void validEntityBeforeSave(NoteNotes entity){
        //TODO 做一些数据校验,如唯一约束
    }

    /**
     * 校验并批量删除笔记信息
     *
     * @param ids     待删除的主键集合
     * @param isValid 是否进行有效性校验
     * @return 是否删除成功
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid) {
        trashService.moveNotes(ids, false);
        return true;
    }

    /**
     * 客户端查询笔记列表
     *
     * @param bo 笔记
     * @return 笔记分页列表
     */
    @Override
    public PageResult<NoteNotesVo> queryPageClientList(ClientNotesBo bo, PageQuery pageQuery) {
        LambdaQueryWrapper<NoteNotes> lqw = buildQueryWrapper();

        if (bo.getDirId() != 0 && bo.getDirId() != 1) {
            // 根据dirId查询出所有子目录ID
            List<Long> childIds = directoryService.getChildIds(bo.getDirId());
            childIds.add(bo.getDirId());
            lqw.in(NoteNotes::getDirId, childIds);
        }

        Page<NoteNotesVo> result = baseMapper.selectVoPage(pageQuery.build(), lqw);
        // 计算文件大小
        calcFileSize(result);
        return PageResult.build(result.getRecords(), result.getTotal());
    }

    private static void calcFileSize(Page<NoteNotesVo> result) {
        // 计算内容大小
        result.getRecords().forEach(item -> {
            String content = item.getContent();
            if (StringUtils.isBlank(content)) {
                item.setFileSize("0 B");
                return;
            }
            byte[] bytes = StrUtil.bytes(item.getContent());
            long textLong = bytes.length;
            log.info("笔记内容大小：{}", textLong);
            String format = DataSizeUtil.format(textLong);
            item.setFileSize(format);
        });
    }

    /**
     * 客户端查询最新笔记列表
     * @param pageQuery 分页参数
     * @return 笔记分页列表
     */
    @Override
    public PageResult<NewNotesVo> queryPageClientNewNotes(PageQuery pageQuery) {
        LambdaQueryWrapper<NoteNotes> lqw = buildQueryWrapper();
        Page<NoteNotesVo> voPage = baseMapper.selectVoPage(pageQuery.build(), lqw);

        IPage<NewNotesVo> result = new Page<>(voPage.getCurrent(), voPage.getSize(), voPage.getTotal());
        result.setRecords(NotesConvert.INSTANCE.toNewNotesVoList(voPage.getRecords()));

        return PageResult.build(result.getRecords(), result.getTotal());
    }

    /**
     * 客户端搜索笔记
     * @param bo 搜索条件
     * @return 笔记列表
     */
    @Override
    public List<NotesSearchVo> searchNotesList(ClientNotesBo bo) {
        Long userId = LoginHelper.getUserId();
        List<NotesSearchVo> searchVoList = baseMapper.selectBySearch(userId, bo.getSearchValue());
        // 去掉内容中的markdown标签，然后截取一定数量的内容返回，而不是返回全部内容。
        searchVoList.forEach(item -> {
            String content = item.getContent();
            if (StringUtils.isNotBlank(content)) {
                content = content.replaceAll(MARKDOWN_REGEX, "");
                content = content.length() > 100 ? (StrUtil.sub(content, 0, 100) + "...") : content;
                item.setContent(content);
            }
        });
        return searchVoList;
    }

    private LambdaQueryWrapper<NoteNotes> buildQueryWrapper() {
        Long userId = LoginHelper.getUserId();
        LambdaQueryWrapper<NoteNotes> lqw = Wrappers.lambdaQuery();
        lqw.eq(NoteNotes::getUserId, userId);
        lqw.orderByDesc(NoteNotes::getUpdateTime);
        return lqw;
    }
}
