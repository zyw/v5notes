package xin.v5ai.common.core.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 用户来源。试用期只作用于客户端自助注册。
 */
@Getter
@AllArgsConstructor
public enum UserSource {

    /**
     * 管理端添加
     */
    SYS_ADD("sys_add"),

    /**
     * 客户端自助注册
     */
    CLIENT_REGISTER("client_register"),

    /**
     * 管理端注册页注册
     */
    ADMIN_REGISTER("admin_register");

    private final String code;

    public boolean matches(String value) {
        return code.equals(value);
    }
}
