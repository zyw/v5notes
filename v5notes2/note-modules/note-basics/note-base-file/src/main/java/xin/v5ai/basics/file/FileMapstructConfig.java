package xin.v5ai.basics.file;

import io.github.linpeilie.annotations.MapperConfig;

/**
 * 将 mapstruct-plus 生成的转换接口放到 convert 包，
 * 避免落入 {@code typeAliasesPackage=xin.v5ai.**.domain} 的实体扫描范围。
 */
@MapperConfig(mapperPackage = "xin.v5ai.basics.file.convert")
public class FileMapstructConfig {
}
