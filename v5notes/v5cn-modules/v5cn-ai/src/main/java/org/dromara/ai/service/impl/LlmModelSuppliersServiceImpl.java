package org.dromara.ai.service.impl;

import org.dromara.ai.domain.LlmModelSuppliers;
import org.dromara.ai.domain.bo.LlmModelSuppliersBo;
import org.dromara.ai.domain.vo.LlmModelSuppliersVo;
import org.dromara.ai.mapper.LlmModelSuppliersMapper;
import org.dromara.ai.service.ILlmModelSuppliersService;
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
 * 模型供应商Service业务层处理
 *
 * @author Lion Li
 * @date 2025-07-21
 */
@RequiredArgsConstructor
@Service
public class LlmModelSuppliersServiceImpl implements ILlmModelSuppliersService {

    private final LlmModelSuppliersMapper baseMapper;

    /**
     * 查询模型供应商
     *
     * @param id 主键
     * @return 模型供应商
     */
    @Override
    public LlmModelSuppliersVo queryById(Long id){
        return baseMapper.selectVoById(id);
    }

    /**
     * 分页查询模型供应商列表
     *
     * @param bo        查询条件
     * @param pageQuery 分页参数
     * @return 模型供应商分页列表
     */
    @Override
    public TableDataInfo<LlmModelSuppliersVo> queryPageList(LlmModelSuppliersBo bo, PageQuery pageQuery) {
        LambdaQueryWrapper<LlmModelSuppliers> lqw = buildQueryWrapper(bo);
        Page<LlmModelSuppliersVo> result = baseMapper.selectVoPage(pageQuery.build(), lqw);
        return TableDataInfo.build(result);
    }

    /**
     * 查询符合条件的模型供应商列表
     *
     * @param bo 查询条件
     * @return 模型供应商列表
     */
    @Override
    public List<LlmModelSuppliersVo> queryList(LlmModelSuppliersBo bo) {
        LambdaQueryWrapper<LlmModelSuppliers> lqw = buildQueryWrapper(bo);
        return baseMapper.selectVoList(lqw);
    }

    private LambdaQueryWrapper<LlmModelSuppliers> buildQueryWrapper(LlmModelSuppliersBo bo) {
        Map<String, Object> params = bo.getParams();
        LambdaQueryWrapper<LlmModelSuppliers> lqw = Wrappers.lambdaQuery();
        lqw.like(StringUtils.isNotBlank(bo.getName()), LlmModelSuppliers::getName, bo.getName());
        lqw.eq(StringUtils.isNotBlank(bo.getIcon()), LlmModelSuppliers::getIcon, bo.getIcon());
        lqw.eq(StringUtils.isNotBlank(bo.getBaseUrl()), LlmModelSuppliers::getBaseUrl, bo.getBaseUrl());
        lqw.eq(StringUtils.isNotBlank(bo.getApiKey()), LlmModelSuppliers::getApiKey, bo.getApiKey());
        lqw.eq(StringUtils.isNotBlank(bo.getApiVersion()), LlmModelSuppliers::getApiVersion, bo.getApiVersion());
        lqw.eq(StringUtils.isNotBlank(bo.getActiveDuration()), LlmModelSuppliers::getActiveDuration, bo.getActiveDuration());
        lqw.eq(StringUtils.isNotBlank(bo.getStatus()), LlmModelSuppliers::getStatus, bo.getStatus());
        return lqw;
    }

    /**
     * 新增模型供应商
     *
     * @param bo 模型供应商
     * @return 是否新增成功
     */
    @Override
    public Boolean insertByBo(LlmModelSuppliersBo bo) {
        LlmModelSuppliers add = MapstructUtils.convert(bo, LlmModelSuppliers.class);
        validEntityBeforeSave(add);
        boolean flag = baseMapper.insert(add) > 0;
        if (flag) {
            bo.setId(add.getId());
        }
        return flag;
    }

    /**
     * 修改模型供应商
     *
     * @param bo 模型供应商
     * @return 是否修改成功
     */
    @Override
    public Boolean updateByBo(LlmModelSuppliersBo bo) {
        LlmModelSuppliers update = MapstructUtils.convert(bo, LlmModelSuppliers.class);
        validEntityBeforeSave(update);
        return baseMapper.updateById(update) > 0;
    }

    /**
     * 保存前的数据校验
     */
    private void validEntityBeforeSave(LlmModelSuppliers entity){
        //TODO 做一些数据校验,如唯一约束
    }

    /**
     * 校验并批量删除模型供应商信息
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
