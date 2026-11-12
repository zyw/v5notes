package xin.v5ai.common.core.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 用户来源。试用期作用于客户端自助获客（邮箱注册与社交开户）。
 */
@Getter
@AllArgsConstructor
public enum UserSource {

    /**
     * 管理端添加
     */
    SYS_ADD("sys_add"),

    /**
     * 客户端邮箱自助注册
     */
    CLIENT_REGISTER("client_register"),

    /**
     * 客户端第三方登录自动开户
     */
    CLIENT_SOCIAL("client_social"),

    /**
     * 管理端注册页注册
     */
    ADMIN_REGISTER("admin_register");

    private final String code;

    public boolean matches(String value) {
        return code.equals(value);
    }

    /**
     * 是否为客户端自助获客账号（计入试用限制）。
     */
    public static boolean isClientSelfServe(String value) {
        return CLIENT_REGISTER.matches(value) || CLIENT_SOCIAL.matches(value);
    }
}
