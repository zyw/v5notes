package org.dromara.ai.service;

import org.dromara.ai.domain.bo.LlmModelSuppliersBo;
import org.dromara.ai.domain.vo.LlmModelSuppliersVo;
import org.dromara.common.mybatis.core.page.TableDataInfo;
import org.dromara.common.mybatis.core.page.PageQuery;

import java.util.Collection;
import java.util.List;

/**
 * 模型供应商Service接口
 *
 * @author Lion Li
 * @date 2025-07-21
 */
public interface ILlmModelSuppliersService {

    /**
     * 查询模型供应商
     *
     * @param id 主键
     * @return 模型供应商
     */
    LlmModelSuppliersVo queryById(Long id);

    /**
     * 分页查询模型供应商列表
     *
     * @param bo        查询条件
     * @param pageQuery 分页参数
     * @return 模型供应商分页列表
     */
    TableDataInfo<LlmModelSuppliersVo> queryPageList(LlmModelSuppliersBo bo, PageQuery pageQuery);

    /**
     * 查询符合条件的模型供应商列表
     *
     * @param bo 查询条件
     * @return 模型供应商列表
     */
    List<LlmModelSuppliersVo> queryList(LlmModelSuppliersBo bo);

    /**
     * 新增模型供应商
     *
     * @param bo 模型供应商
     * @return 是否新增成功
     */
    Boolean insertByBo(LlmModelSuppliersBo bo);

    /**
     * 修改模型供应商
     *
     * @param bo 模型供应商
     * @return 是否修改成功
     */
    Boolean updateByBo(LlmModelSuppliersBo bo);

    /**
     * 校验并批量删除模型供应商信息
     *
     * @param ids     待删除的主键集合
     * @param isValid 是否进行有效性校验
     * @return 是否删除成功
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
