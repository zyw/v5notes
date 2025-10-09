package org.dromara.generator.service;

import org.dromara.common.core.utils.MapstructUtils;
import org.dromara.common.mybatis.core.page.TableDataInfo;
import org.dromara.common.mybatis.core.page.PageQuery;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.generator.domain.GenTemplate;
import org.dromara.generator.domain.bo.GenTemplateBo;
import org.dromara.generator.mapper.GenTemplateMapper;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Collection;

/**
 * gen_template;代码模版Service业务层处理
 *
 * @author zyw
 * @date 2025-10-09
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class GenTemplateServiceImpl implements IGenTemplateService {

    private final GenTemplateMapper baseMapper;

    /**
     * 查询gen_template;代码模版
     *
     * @param id 主键
     * @return gen_template;代码模版
     */
    @Override
    public GenTemplate queryById(Long id){
        return baseMapper.selectVoById(id);
    }

    /**
     * 分页查询gen_template;代码模版列表
     *
     * @param bo        查询条件
     * @param pageQuery 分页参数
     * @return gen_template;代码模版分页列表
     */
    @Override
    public TableDataInfo<GenTemplate> queryPageList(GenTemplateBo bo, PageQuery pageQuery) {
        LambdaQueryWrapper<GenTemplate> lqw = buildQueryWrapper(bo);
        Page<GenTemplate> result = baseMapper.selectPage(pageQuery.build(), lqw);
        return TableDataInfo.build(result);
    }

    /**
     * 查询符合条件的gen_template;代码模版列表
     *
     * @param bo 查询条件
     * @return gen_template;代码模版列表
     */
    @Override
    public List<GenTemplate> queryList(GenTemplateBo bo) {
        LambdaQueryWrapper<GenTemplate> lqw = buildQueryWrapper(bo);
        return baseMapper.selectVoList(lqw);
    }

    private LambdaQueryWrapper<GenTemplate> buildQueryWrapper(GenTemplateBo bo) {
        Map<String, Object> params = bo.getParams();
        LambdaQueryWrapper<GenTemplate> lqw = Wrappers.lambdaQuery();
        lqw.orderByAsc(GenTemplate::getId);
        lqw.eq(bo.getBeType() != null, GenTemplate::getBeType, bo.getBeType());
        lqw.eq(bo.getFeType() != null, GenTemplate::getFeType, bo.getFeType());
        lqw.like(bo.getName() != null, GenTemplate::getName, bo.getName());
        lqw.eq(bo.getContent() != null, GenTemplate::getContent, bo.getContent());
        lqw.like(bo.getFileName() != null, GenTemplate::getFileName, bo.getFileName());
        lqw.eq(bo.getFilePath() != null, GenTemplate::getFilePath, bo.getFilePath());
        lqw.eq(bo.getStatus() != null, GenTemplate::getStatus, bo.getStatus());
        return lqw;
    }

    /**
     * 新增gen_template;代码模版
     *
     * @param bo gen_template;代码模版
     * @return 是否新增成功
     */
    @Override
    public Boolean insertByBo(GenTemplateBo bo) {
        GenTemplate add = MapstructUtils.convert(bo, GenTemplate.class);
        validEntityBeforeSave(add);
        boolean flag = baseMapper.insert(add) > 0;
        if (flag) {
            bo.setId(add.getId());
        }
        return flag;
    }

    /**
     * 修改gen_template;代码模版
     *
     * @param bo gen_template;代码模版
     * @return 是否修改成功
     */
    @Override
    public Boolean updateByBo(GenTemplateBo bo) {
        GenTemplate update = MapstructUtils.convert(bo, GenTemplate.class);
        validEntityBeforeSave(update);
        return baseMapper.updateById(update) > 0;
    }

    /**
     * 保存前的数据校验
     */
    private void validEntityBeforeSave(GenTemplate entity){
        //TODO 做一些数据校验,如唯一约束
    }

    /**
     * 校验并批量删除gen_template;代码模版信息
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
}
