package org.dromara.generator.domain.bo;

import io.github.linpeilie.annotations.AutoMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import org.dromara.common.core.validate.EditGroup;
import org.dromara.generator.domain.GenTemplate;

import java.io.Serial;
import java.io.Serializable;

@Data
@AutoMapper(target = GenTemplate.class, reverseConvertGenerate = false)
public class GenEditTemplateBo implements Serializable {
    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * ID
     */
    @NotNull(message = "ID不能为空", groups = { EditGroup.class })
    private Long id;

    /**
     * 模版内容
     */
    @NotBlank(message = "模版内容不能为空", groups = { EditGroup.class })
    private String content;
}
