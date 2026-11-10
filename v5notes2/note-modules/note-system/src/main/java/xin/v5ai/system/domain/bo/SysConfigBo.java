package xin.v5ai.system.domain.bo;

import io.github.linpeilie.annotations.AutoMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import xin.v5ai.system.domain.SysConfig;

import java.io.Serializable;
import java.util.HashMap;
import java.util.Map;

/**
 * 参数配置业务对象 sys_config
 *
 * @author Michelle.Chung
 */

@Data
@AutoMapper(target = SysConfig.class, reverseConvertGenerate = false)
public class SysConfigBo implements Serializable {

    /**
     * 参数主键
     */
    private Long configId;

    /**
     * 参数名称
     */
    @NotBlank(message = "{config.name.not.blank}")
    @Size(min = 0, max = 100, message = "{config.name.length}")
    private String configName;

    /**
     * 参数键名
     */
    @NotBlank(message = "{config.key.not.blank}")
    @Size(min = 0, max = 100, message = "{config.key.length}")
    private String configKey;

    /**
     * 参数键值
     */
    @NotBlank(message = "{config.value.not.blank}")
    @Size(min = 0, max = 500, message = "{config.value.length}")
    private String configValue;

    /**
     * 系统内置（Y是 N否）
     */
    private String configType;

    /**
     * 备注
     */
    private String remark;

    /**
     * 请求参数
     */
    private Map<String, Object> params = new HashMap<>();

}
