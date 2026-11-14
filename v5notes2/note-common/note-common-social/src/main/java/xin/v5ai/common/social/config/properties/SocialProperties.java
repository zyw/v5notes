package xin.v5ai.common.social.config.properties;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Social 配置属性。
 * <p>{@code address} 供管理端回调；{@code clientAddress} 供 Cloud 客户端；
 * {@code vaultClientAddress} 供 Vault 客户端（含 {@code v5notes-vault://} / 落地页 {@code app=vault}）。</p>
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
     * Vault 客户端回调基址（如落地页 HTTPS 源或 {@code v5notes-vault://app}）。
     * 请求 {@code app=vault} 时使用；未配置时回退 {@link #clientAddress} 并附加 {@code app=vault}。
     */
    private String vaultClientAddress;

    /**
     * 授权类型
     */
    private Map<String, SocialLoginConfigProperties> type;

}
