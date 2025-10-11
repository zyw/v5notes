package org.dromara.generator.config;

import cn.hutool.extra.template.TemplateEngine;
import cn.hutool.extra.template.TemplateUtil;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TemplateConfig {

    @Bean
    public MyBatisDataSourceMonitor myBatisDataSourceMonitor() {
        return new MyBatisDataSourceMonitor();
    }

    @Bean
    public TemplateEngine templateEngine() {
        return TemplateUtil.createEngine();
    }

}
