package xin.v5ai.common.social.config.properties;

import lombok.Data;

import java.util.List;

/**
 * 社交登录配置
 *
 * @author thiszhc
 */
@Data
public class SocialLoginConfigProperties {

    /**
     * 应用 ID
     */
    private String clientId;

    /**
     * 应用密钥
     */
    private String clientSecret;

    /**
     * 回调地址兜底值。
     * <p>优先使用 {@code justauth.address} / {@code justauth.client-address}
     * 按请求 {@code app} 拼装；仅当两个基址都未配置时才使用本字段。
     * 不要用本字段区分管理端与笔记客户端。
     */
    private String redirectUri;

    /**
     * 是否需要申请unionid，目前只针对qq登录
     */
    private Boolean unionId;

    /**
     * Microsoft Entra ID（原微软 AAD）中的租户 ID
     */
    private String tenantId;

    /**
     * Coding 企业名称
     */
    private String codingGroupName;

    /**
     * 支付宝公钥
     */
    private String alipayPublicKey;

    /**
     * 企业微信应用ID
     */
    private String agentId;

    /**
     * stackoverflow api key
     */
    private String stackOverflowKey;

    /**
     * 设备ID
     */
    private String deviceId;

    /**
     * 客户端系统类型
     */
    private String clientOsType;

    /**
     * 自托管授权服务器地址
     */
    private String serverUrl;

    /**
     * 请求范围
     */
    private List<String> scopes;

}
