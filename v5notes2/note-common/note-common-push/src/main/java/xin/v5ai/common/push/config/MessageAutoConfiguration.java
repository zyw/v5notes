package xin.v5ai.common.push.config;

import xin.v5ai.common.push.controller.MessageTicketController;
import xin.v5ai.common.push.filter.MessageTicketFilter;
import xin.v5ai.common.push.properties.MessageProperties;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;

/**
 * 统一消息推送公共自动装配。
 *
 * @author Lion Li
 */
@AutoConfiguration
@ConditionalOnProperty(prefix = "message", name = "enabled", havingValue = "true", matchIfMissing = true)
@EnableConfigurationProperties(MessageProperties.class)
public class MessageAutoConfiguration {

    /**
     * 注册一次性 ticket 签发接口。
     */
    @Bean
    public MessageTicketController messageTicketController() {
        return new MessageTicketController();
    }

    /**
     * WebSocket 握手前把 ticket 换成 Authorization Header，避免 JWT 出现在 URL。
     */
    @Bean
    public FilterRegistrationBean<MessageTicketFilter> messageTicketFilter(MessageProperties messageProperties) {
        FilterRegistrationBean<MessageTicketFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new MessageTicketFilter());
        registration.addUrlPatterns(messageProperties.getPath(), messageProperties.getPath() + "/*");
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 20);
        return registration;
    }
}
