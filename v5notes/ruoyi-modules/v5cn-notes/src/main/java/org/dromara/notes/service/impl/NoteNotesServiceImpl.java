package org.dromara.notes.service.impl;

import cn.hutool.core.io.unit.DataSizeUtil;
import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.utils.MapstructUtils;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.mybatis.core.page.TableDataInfo;
import org.dromara.common.satoken.utils.LoginHelper;
import org.dromara.notes.convert.NotesConvert;
import org.dromara.notes.domain.NoteNotes;
import org.dromara.notes.domain.bo.ClientNotesBo;
import org.dromara.notes.domain.bo.NoteNotesBo;
import org.dromara.notes.domain.vo.NewNotesVo;
import org.dromara.notes.domain.vo.NoteNotesVo;
import org.dromara.notes.domain.vo.NotesContentVo;
import org.dromara.notes.domain.vo.NotesSearchVo;
import org.dromara.notes.mapper.NoteNotesMapper;
import org.dromara.notes.service.INoteDirectoryService;
import org.dromara.notes.service.INoteNotesService;
import org.springframework.stereotype.Service;

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
        NoteNotesVo noteNotesVo = baseMapper.selectVoById(id);
        return MapstructUtils.convert(noteNotesVo, NotesContentVo.class);
    }

    /**
     * 分页查询笔记列表
     *
     * @param bo        查询条件
     * @param pageQuery 分页参数
     * @return 笔记分页列表
     */
    @Override
    public TableDataInfo<NoteNotesVo> queryPageList(NoteNotesBo bo, PageQuery pageQuery) {
        LambdaQueryWrapper<NoteNotes> lqw = buildQueryWrapper(bo);
        Page<NoteNotesVo> result = baseMapper.selectVoPage(pageQuery.build(), lqw);
        return TableDataInfo.build(result);
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
        LambdaQueryWrapper<NoteNotes> lqw = Wrappers.lambdaQuery();
        lqw.like(StringUtils.isNotBlank(bo.getName()), NoteNotes::getName, bo.getName());
        lqw.eq(bo.getDirId() != null, NoteNotes::getDirId, bo.getDirId());
        lqw.eq(StringUtils.isNotBlank(bo.getContent()), NoteNotes::getContent, bo.getContent());
        return lqw;
    }

    /**
     * 新增笔记
     *
     * @param bo 笔记
     * @return 是否新增成功
     */
    @Override
    public Boolean insertByBo(NoteNotesBo bo) {
        NoteNotes add = MapstructUtils.convert(bo, NoteNotes.class);
        add.setUserId(LoginHelper.getUserId());
        validEntityBeforeSave(add);
        boolean flag = baseMapper.insert(add) > 0;
        if (flag) {
            bo.setId(add.getId());
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
    public Boolean updateByBo(NoteNotesBo bo) {
        NoteNotes update = MapstructUtils.convert(bo, NoteNotes.class);
        validEntityBeforeSave(update);
        return baseMapper.updateById(update) > 0;
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
    public Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid) {
        if(isValid){
            //TODO 做一些业务上的校验,判断是否需要校验
        }
        return baseMapper.deleteByIds(ids) > 0;
    }

    /**
     * 客户端查询笔记列表
     *
     * @param bo 笔记
     * @return 笔记分页列表
     */
    @Override
    public TableDataInfo<NoteNotesVo> queryPageClientList(ClientNotesBo bo, PageQuery pageQuery) {
        LambdaQueryWrapper<NoteNotes> lqw = buildQueryWrapper();

        if (bo.getDirId() != 0 && bo.getDirId() != 1) {
            // 根据dirId查询出所有子目录ID
            List<Long> childIds = directoryService.getChildIds(bo.getDirId());
            childIds.add(bo.getDirId());
            lqw.in(NoteNotes::getDirId, childIds);
        }

        Page<NoteNotesVo> result = baseMapper.selectVoPage(pageQuery.build(), lqw);
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
        return TableDataInfo.build(result);
    }

    /**
     * 客户端查询最新笔记列表
     * @param pageQuery 分页参数
     * @return 笔记分页列表
     */
    @Override
    public TableDataInfo<NewNotesVo> queryPageClientNewNotes(PageQuery pageQuery) {
        LambdaQueryWrapper<NoteNotes> lqw = buildQueryWrapper();
        Page<NoteNotesVo> voPage = baseMapper.selectVoPage(pageQuery.build(), lqw);

        IPage<NewNotesVo> result = new Page<>(voPage.getCurrent(), voPage.getSize(), voPage.getTotal());
        result.setRecords(NotesConvert.INSTANCE.toNewNotesVoList(voPage.getRecords()));

        return TableDataInfo.build(result);
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
