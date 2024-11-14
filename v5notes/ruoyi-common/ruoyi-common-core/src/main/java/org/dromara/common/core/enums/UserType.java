package org.dromara.common.core.enums;

import org.dromara.common.core.utils.StringUtils;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.dromara.common.core.validate.StringArrayValuable;

import java.util.Arrays;

/**
 * 设备类型
 * 针对多套 用户体系
 *
 * @author Lion Li
 */
@Getter
@AllArgsConstructor
public enum UserType implements StringArrayValuable {

    /**
     * pc管理端用戶
     */
    SYS_USER("sys_user"),

    /**
     * 客戶端用戶(此用户不能登录管理端)，此用户可以是PC客户端、APP客户端、小程序客户端等
     */
    CLIENT_USER("cli_user");

    /**
     * 值数组
     */
    public static final String[] ARRAYS = Arrays.stream(values()).map(UserType::getValue).toArray(String[]::new);

    private final String userType;

    public static UserType getUserType(String str) {
        for (UserType value : values()) {
            if (StringUtils.contains(str, value.getUserType())) {
                return value;
            }
        }
        throw new RuntimeException("'UserType' not found By " + str);
    }

    public String getValue() {
        return userType;
    }

    @Override
    public String[] array() {
        return ARRAYS;
    }
}
