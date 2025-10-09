package org.dromara.generator.service;

import org.dromara.common.mybatis.core.page.TableDataInfo;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.generator.domain.GenTemplate;
import org.dromara.generator.domain.bo.GenTemplateBo;

import java.util.Collection;
import java.util.List;

/**
 * gen_template;代码模版Service接口
 *
 * @author zyw
 * @date 2025-10-09
 */
public interface IGenTemplateService {

    /**
     * 查询gen_template;代码模版
     *
     * @param ${pkColumn.javaField} 主键
     * @return gen_template;代码模版
     */
    GenTemplate queryById(Long id);

    /**
     * 分页查询gen_template;代码模版列表
     *
     * @param bo        查询条件
     * @param pageQuery 分页参数
     * @return gen_template;代码模版分页列表
     */
    TableDataInfo<GenTemplate> queryPageList(GenTemplateBo bo, PageQuery pageQuery);

    /**
     * 查询符合条件的gen_template;代码模版列表
     *
     * @param bo 查询条件
     * @return gen_template;代码模版列表
     */
    List<GenTemplate> queryList(GenTemplateBo bo);

    /**
     * 新增gen_template;代码模版
     *
     * @param bo gen_template;代码模版
     * @return 是否新增成功
     */
    Boolean insertByBo(GenTemplateBo bo);

    /**
     * 修改gen_template;代码模版
     *
     * @param bo gen_template;代码模版
     * @return 是否修改成功
     */
    Boolean updateByBo(GenTemplateBo bo);

    /**
     * 校验并批量删除gen_template;代码模版信息
     *
     * @param ids     待删除的主键集合
     * @param isValid 是否进行有效性校验
     * @return 是否删除成功
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
