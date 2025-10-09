package org.dromara.generator.domain;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.common.tenant.core.TenantEntity;

import java.io.Serial;

/**
 * gen_template;代码模版对象 gen_template
 *
 * @author zyw
 * @date 2025-10-09
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("gen_template")
public class GenTemplate extends TenantEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * ID
     */
    @TableId(value = "id")
    private Long id;

    /**
     * 后端模版类型
     */
    private String beType;

    /**
     * 前端模版类型
     */
    private String feType;

    /**
     * 模版名称
     */
    private String name;

    /**
     * 模版内容
     */
    private String content;

    /**
     * 模版名称，需要包含生成文件的扩展名
     */
    private String fileName;

    /**
     * 生成文件路径，如果为空生成文件在压缩包的跟目录下
     */
    private String filePath;

    /**
     * 状态:0正常,1停用
     */
    private String status;

    /**
     * 删除标志（0代表存在 2代表删除）
     */
    @TableLogic
    private String delFlag;


}
