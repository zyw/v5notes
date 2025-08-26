package org.dromara.common.core.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 设备类型
 * 针对一套 用户体系
 *
 * @author Lion Li
 */
@Getter
@AllArgsConstructor
public enum DeviceType {

    /**
     * pc端管理端
     */
    PC("pc"),

    /**
     * PC端客户端
     */
    CLIENT_PC("cli_pc"),

    /**
     * app端
     */
    APP("app"),

    /**
     * 小程序端
     */
    XCX("xcx"),

    /**
     * social第三方端
     */
    SOCIAL("social");

    private final String device;
}
