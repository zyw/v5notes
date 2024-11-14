package org.dromara.basics.file.core.config;

import org.dromara.basics.file.core.client.DefaultFileClientFactory;
import org.dromara.basics.file.core.client.FileClientFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 文件配置自动化配置类
 * @author 芋道源码
 */
@Configuration(proxyBeanMethods = false)
public class V5FileAutoConfig {

    @Bean
    public FileClientFactory fileClientFactory() {
        return new DefaultFileClientFactory();
    }

}
