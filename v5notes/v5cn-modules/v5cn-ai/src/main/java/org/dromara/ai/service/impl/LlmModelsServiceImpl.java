package org.dromara.ai.service.impl;

import org.dromara.ai.domain.LlmModels;
import org.dromara.ai.domain.bo.LlmModelsBo;
import org.dromara.ai.domain.vo.LlmModelsVo;
import org.dromara.ai.mapper.LlmModelsMapper;
import org.dromara.ai.service.ILlmModelsService;
import org.dromara.common.core.utils.MapstructUtils;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.common.mybatis.core.page.TableDataInfo;
import org.dromara.common.mybatis.core.page.PageQuery;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Collection;

/**
 * 模型Service业务层处理
 *
 * @author Lion Li
 * @date 2025-07-21
 */
@RequiredArgsConstructor
@Service
public class LlmModelsServiceImpl implements ILlmModelsService {

    private final LlmModelsMapper baseMapper;

    /**
     * 查询模型
     *
     * @param id 主键
     * @return 模型
     */
    @Override
    public LlmModelsVo queryById(Long id){
        return baseMapper.selectVoById(id);
    }

    /**
     * 分页查询模型列表
     *
     * @param bo        查询条件
     * @param pageQuery 分页参数
     * @return 模型分页列表
     */
    @Override
    public TableDataInfo<LlmModelsVo> queryPageList(LlmModelsBo bo, PageQuery pageQuery) {
        LambdaQueryWrapper<LlmModels> lqw = buildQueryWrapper(bo);
        Page<LlmModelsVo> result = baseMapper.selectVoPage(pageQuery.build(), lqw);
        return TableDataInfo.build(result);
    }

    /**
     * 查询符合条件的模型列表
     *
     * @param bo 查询条件
     * @return 模型列表
     */
    @Override
    public List<LlmModelsVo> queryList(LlmModelsBo bo) {
        LambdaQueryWrapper<LlmModels> lqw = buildQueryWrapper(bo);
        return baseMapper.selectVoList(lqw);
    }

    private LambdaQueryWrapper<LlmModels> buildQueryWrapper(LlmModelsBo bo) {
        Map<String, Object> params = bo.getParams();
        LambdaQueryWrapper<LlmModels> lqw = Wrappers.lambdaQuery();
        lqw.eq(bo.getSupplierId() != null, LlmModels::getSupplierId, bo.getSupplierId());
        lqw.eq(StringUtils.isNotBlank(bo.getModelId()), LlmModels::getModelId, bo.getModelId());
        lqw.like(StringUtils.isNotBlank(bo.getName()), LlmModels::getName, bo.getName());
        lqw.eq(bo.getType() != null, LlmModels::getType, bo.getType());
        lqw.eq(bo.getContextLen() != null, LlmModels::getContextLen, bo.getContextLen());
        lqw.eq(bo.getMaxToken() != null, LlmModels::getMaxToken, bo.getMaxToken());
        lqw.eq(bo.getFunctionCalling() != null, LlmModels::getFunctionCalling, bo.getFunctionCalling());
        lqw.eq(StringUtils.isNotBlank(bo.getStreamFunctionCalling()), LlmModels::getStreamFunctionCalling, bo.getStreamFunctionCalling());
        lqw.eq(StringUtils.isNotBlank(bo.getVision()), LlmModels::getVision, bo.getVision());
        lqw.eq(StringUtils.isNotBlank(bo.getStatus()), LlmModels::getStatus, bo.getStatus());
        return lqw;
    }

    /**
     * 新增模型
     *
     * @param bo 模型
     * @return 是否新增成功
     */
    @Override
    public Boolean insertByBo(LlmModelsBo bo) {
        LlmModels add = MapstructUtils.convert(bo, LlmModels.class);
        validEntityBeforeSave(add);
        boolean flag = baseMapper.insert(add) > 0;
        if (flag) {
            bo.setId(add.getId());
        }
        return flag;
    }

    /**
     * 修改模型
     *
     * @param bo 模型
     * @return 是否修改成功
     */
    @Override
    public Boolean updateByBo(LlmModelsBo bo) {
        LlmModels update = MapstructUtils.convert(bo, LlmModels.class);
        validEntityBeforeSave(update);
        return baseMapper.updateById(update) > 0;
    }

    /**
     * 保存前的数据校验
     */
    private void validEntityBeforeSave(LlmModels entity){
        //TODO 做一些数据校验,如唯一约束
    }

    /**
     * 校验并批量删除模型信息
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
