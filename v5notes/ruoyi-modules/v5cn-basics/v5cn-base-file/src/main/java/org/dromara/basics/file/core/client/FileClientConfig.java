package org.dromara.basics.file.core.client;

import com.fasterxml.jackson.annotation.JsonTypeInfo;

/**
 * 文件客户端配置
 * 不同实现客户端，需要不同的配置，通过子类实现
 *
 * 1. @JsonTypeInfo 注解的作用，Jackson 多态，使得不同的实现类，序列化时，使用不同的类型，以便于反序列化
 * 2. use = JsonTypeInfo.Id.CLASS，使用类名作为序列化类型。序列化到时数据库时，增加 @class 属性。
 * 3. 反序列化到内存对象时，通过 @class 属性，可以创建出正确的类型
 *
 * @author ZYW
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.CLASS)
public interface FileClientConfig {
}
