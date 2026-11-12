package xin.v5ai.common.core.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 登录设备类型枚举。
 *
 * @author Lion Li
 */
@Getter
@AllArgsConstructor
public enum DeviceType {

    /**
     * 管理端。只允许 {@code sys_user} 登录。
     */
    ADMIN("admin"),

    /**
     * 客户端（PC、APP、小程序等）。只允许 {@code cli_user} 登录。
     */
    CLIENT("client"),

    /**
     * pc端（历史设备类型，等同管理端）
     */
    PC("pc"),

    /**
     * app端
     */
    APP("app"),

    /**
     * 小程序端
     */
    XCX("xcx"),

    /**
     * 第三方社交登录平台
     */
    SOCIAL("social");

    /**
     * 设备标识
     */
    private final String device;
}
