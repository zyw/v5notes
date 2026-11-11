package xin.v5ai.basics.file.core.config;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.context.annotation.Bean;
import xin.v5ai.basics.file.core.client.DefaultFileClientFactory;
import xin.v5ai.basics.file.core.client.FileClientFactory;

/**
 * 文件模块自动化配置：注册 {@link FileClientFactory}。
 */
@AutoConfiguration
public class V5FileAutoConfig {

    @Bean
    public FileClientFactory fileClientFactory() {
        return new DefaultFileClientFactory();
    }

}
