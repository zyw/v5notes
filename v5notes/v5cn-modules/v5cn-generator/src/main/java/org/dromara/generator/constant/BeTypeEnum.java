package org.dromara.generator.constant;

import lombok.Getter;

@Getter
public enum BeTypeEnum {
    JAVA("java"),
    GOLANG("golang");

    private final String value;

    BeTypeEnum(String value) {
        this.value = value;
    }

}
