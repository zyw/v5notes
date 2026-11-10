package xin.v5ai.system.domain.bo;

import io.github.linpeilie.annotations.AutoMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import xin.v5ai.system.domain.SysDictData;

import java.io.Serial;
import java.io.Serializable;

/**
 * 字典数据业务对象 sys_dict_data
 *
 * @author Michelle.Chung
 */

@Data
@AutoMapper(target = SysDictData.class, reverseConvertGenerate = false)
public class SysDictDataBo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 字典编码
     */
    private Long dictCode;

    /**
     * 字典排序
     */
    private Integer dictSort;

    /**
     * 字典标签
     */
    @NotBlank(message = "{dict.label.not.blank}")
    @Size(min = 0, max = 100, message = "{dict.label.length}")
    private String dictLabel;

    /**
     * 字典键值
     */
    @NotBlank(message = "{dict.value.not.blank}")
    @Size(min = 0, max = 100, message = "{dict.value.length}")
    private String dictValue;

    /**
     * 字典类型
     */
    @NotBlank(message = "{dict.type.not.blank}")
    @Size(min = 0, max = 100, message = "{dict.type.length}")
    private String dictType;

    /**
     * 样式属性（其他样式扩展）
     */
    @Size(min = 0, max = 100, message = "{dict.css.length}")
    private String cssClass;

    /**
     * 表格回显样式
     */
    private String listClass;

    /**
     * 是否默认（Y是 N否）
     */
    private String isDefault;

    /**
     * 创建部门
     */
    private Long createDept;

    /**
     * 备注
     */
    private String remark;

}
