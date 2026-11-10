package xin.v5ai.common.core.domain.model;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 通用登录请求对象，封装客户端、授权类型和验证码信息。
 *
 * @author Lion Li
 */
@Data
public class LoginBody implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 客户端id
     */
    @NotBlank(message = "{auth.clientid.not.blank}")
    private String clientId;

    /**
     * 授权类型
     */
    @NotBlank(message = "{auth.grant.type.not.blank}")
    private String grantType;

    /**
     * 验证码
     */
    private String code;

    /**
     * 验证码唯一标识。
     */
    private String uuid;

    /**
     * 租户编号（兼容 v5notes 旧客户端的冗余字段，6.1.0 无租户逻辑，解析后忽略）。
     */
    private String tenantId;

    /**
     * 设备类型（兼容 v5notes 旧客户端的冗余字段，实际以 sys_client 配置为准）。
     */
    private String deviceType;

}
