package xin.v5ai.common.social.config.properties;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Social 配置属性。
 * <p>{@code address} 供管理端回调；{@code clientAddress} 供笔记客户端（含 deep link）回调。</p>
 *
 * @author thiszhc
 */
@Data
@Component
@ConfigurationProperties(prefix = "justauth")
public class SocialProperties {

    /**
     * 管理端前端外网地址，用于拼装 redirect-uri。
     */
    private String address;

    /**
     * 笔记客户端回调基址（如 http://127.0.0.1:1420 或 v5notes://app）。
     */
    private String clientAddress;

    /**
     * 授权类型
     */
    private Map<String, SocialLoginConfigProperties> type;

}
