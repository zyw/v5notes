package xin.v5ai.system.domain.bo;

import io.github.linpeilie.annotations.AutoMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import xin.v5ai.common.core.constant.RegexConstants;
import xin.v5ai.system.domain.SysDictType;

import java.io.Serial;
import java.io.Serializable;

/**
 * 字典类型业务对象 sys_dict_type
 *
 * @author Michelle.Chung
 */

@Data
@AutoMapper(target = SysDictType.class, reverseConvertGenerate = false)
public class SysDictTypeBo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 字典主键
     */
    private Long dictId;

    /**
     * 字典名称
     */
    @NotBlank(message = "{dict.name.not.blank}")
    @Size(min = 0, max = 100, message = "{dict.name.length}")
    private String dictName;

    /**
     * 字典类型
     */
    @NotBlank(message = "{dict.type.not.blank}")
    @Size(min = 0, max = 100, message = "{dict.type.type.length}")
    @Pattern(regexp = RegexConstants.DICTIONARY_TYPE, message = "{dict.type.pattern}")
    private String dictType;

    /**
     * 备注
     */
    private String remark;


}
