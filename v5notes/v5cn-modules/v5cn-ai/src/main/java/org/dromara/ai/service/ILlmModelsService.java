package org.dromara.ai.service;

import org.dromara.ai.domain.bo.LlmModelsBo;
import org.dromara.ai.domain.vo.LlmModelsVo;
import org.dromara.common.mybatis.core.page.TableDataInfo;
import org.dromara.common.mybatis.core.page.PageQuery;

import java.util.Collection;
import java.util.List;

/**
 * 模型Service接口
 *
 * @author Lion Li
 * @date 2025-07-21
 */
public interface ILlmModelsService {

    /**
     * 查询模型
     *
     * @param id 主键
     * @return 模型
     */
    LlmModelsVo queryById(Long id);

    /**
     * 分页查询模型列表
     *
     * @param bo        查询条件
     * @param pageQuery 分页参数
     * @return 模型分页列表
     */
    TableDataInfo<LlmModelsVo> queryPageList(LlmModelsBo bo, PageQuery pageQuery);

    /**
     * 查询符合条件的模型列表
     *
     * @param bo 查询条件
     * @return 模型列表
     */
    List<LlmModelsVo> queryList(LlmModelsBo bo);

    /**
     * 新增模型
     *
     * @param bo 模型
     * @return 是否新增成功
     */
    Boolean insertByBo(LlmModelsBo bo);

    /**
     * 修改模型
     *
     * @param bo 模型
     * @return 是否修改成功
     */
    Boolean updateByBo(LlmModelsBo bo);

    /**
     * 校验并批量删除模型信息
     *
     * @param ids     待删除的主键集合
     * @param isValid 是否进行有效性校验
     * @return 是否删除成功
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
