package xin.v5ai.common.social.utils;

import cn.hutool.core.util.ObjectUtil;
import me.zhyd.oauth.config.AuthConfig;
import me.zhyd.oauth.exception.AuthException;
import me.zhyd.oauth.model.AuthCallback;
import me.zhyd.oauth.model.AuthResponse;
import me.zhyd.oauth.model.AuthUser;
import me.zhyd.oauth.request.*;
import xin.v5ai.common.core.utils.MessageUtils;
import xin.v5ai.common.core.utils.SpringUtils;
import xin.v5ai.common.core.utils.StringUtils;
import xin.v5ai.common.social.config.properties.SocialLoginConfigProperties;
import xin.v5ai.common.social.config.properties.SocialProperties;

/**
 * 认证授权工具类
 *
 * @author thiszhc
 */
public class SocialUtils {

    private static final AuthRedisStateCache STATE_CACHE = SpringUtils.getBean(AuthRedisStateCache.class);

    /**
     * 执行第三方登录授权回调（默认管理端回调地址）。
     */
    public static AuthResponse<AuthUser> loginAuth(String source, String code, String state, SocialProperties socialProperties) throws AuthException {
        return loginAuth(source, code, state, socialProperties, "admin");
    }

    /**
     * 执行第三方登录授权回调。
     *
     * @param app {@code client} 使用 clientAddress，其它使用 address
     */
    public static AuthResponse<AuthUser> loginAuth(String source, String code, String state,
                                                   SocialProperties socialProperties, String app) throws AuthException {
        AuthRequest authRequest = getAuthRequest(source, socialProperties, app);
        AuthCallback callback = new AuthCallback();
        callback.setCode(code);
        callback.setState(state);
        AuthResponse<AuthUser> response = authRequest.login(callback);
        if (response != null && response.ok() && "gitee".equalsIgnoreCase(source) && response.getData() != null) {
            GiteeEmailSupport.enrichEmail(response.getData());
        }
        return response;
    }

    /**
     * 根据平台类型构建授权请求实例（默认管理端回调）。
     */
    public static AuthRequest getAuthRequest(String source, SocialProperties socialProperties) throws AuthException {
        return getAuthRequest(source, socialProperties, "admin");
    }

    /**
     * 根据平台类型与应用端构建授权请求实例。
     *
     * @param app {@code client} / {@code admin}
     */
    public static AuthRequest getAuthRequest(String source, SocialProperties socialProperties, String app) throws AuthException {
        SocialLoginConfigProperties obj = socialProperties.getType().get(source);
        if (ObjectUtil.isNull(obj)) {
            throw new AuthException(MessageUtils.message("social.type.unsupported"));
        }
        AuthConfig.AuthConfigBuilder builder = AuthConfig.builder()
            .clientId(obj.getClientId())
            .clientSecret(obj.getClientSecret())
            .redirectUri(resolveRedirectUri(source, obj, socialProperties, app))
            .serverUrl(obj.getServerUrl())
            .scopes(obj.getScopes());
        return switch (source.toLowerCase()) {
            case "dingtalk" -> new AuthDingTalkV2Request(builder.build(), STATE_CACHE);
            case "baidu" -> new AuthBaiduRequest(builder.build(), STATE_CACHE);
            case "github" -> new AuthGithubRequest(builder.build(), STATE_CACHE);
            case "google" -> new AuthGoogleRequest(builder.build(), STATE_CACHE);
            case "gitee" -> new AuthGiteeRequest(builder.build(), STATE_CACHE);
            case "weibo" -> new AuthWeiboRequest(builder.build(), STATE_CACHE);
            case "coding" -> new AuthCodingRequest(builder.build(), STATE_CACHE);
            case "oschina" -> new AuthOschinaRequest(builder.build(), STATE_CACHE);
            case "alipay_wallet" ->
                new AuthAlipayRequest(builder.build(), socialProperties.getType().get("alipay_wallet").getAlipayPublicKey(), STATE_CACHE);
            case "qq" -> new AuthQqRequest(builder.build(), STATE_CACHE);
            case "wechat_open" -> new AuthWeChatOpenRequest(builder.build(), STATE_CACHE);
            case "taobao" -> new AuthTaobaoRequest(builder.build(), STATE_CACHE);
            case "douyin" -> new AuthDouyinRequest(builder.build(), STATE_CACHE);
            case "linkedin" -> new AuthLinkedinRequest(builder.build(), STATE_CACHE);
            case "microsoft" -> new AuthMicrosoftRequest(builder.tenantId(obj.getTenantId()).build(), STATE_CACHE);
            case "renren" -> new AuthRenrenRequest(builder.build(), STATE_CACHE);
            case "stack_overflow" ->
                new AuthStackOverflowRequest(builder.stackOverflowKey(obj.getStackOverflowKey()).build(), STATE_CACHE);
            case "huawei" -> new AuthHuaweiV3Request(builder.build(), STATE_CACHE);
            case "wechat_enterprise" ->
                new AuthWeChatEnterpriseQrcodeV2Request(builder.agentId(obj.getAgentId()).build(), STATE_CACHE);
            case "gitlab" -> new AuthGitlabRequest(builder.build(), STATE_CACHE);
            case "wechat_mp" -> new AuthWeChatMpRequest(builder.build(), STATE_CACHE);
            case "aliyun" -> new AuthAliyunRequest(builder.build(), STATE_CACHE);
            case "maxkey" -> new AuthMaxKeyRequest(builder.build(), STATE_CACHE);
            case "topiam" -> new AuthTopIamRequest(builder.build(), STATE_CACHE);
            case "gitea" -> new AuthGiteaRequest(builder.build(), STATE_CACHE);
            default -> throw new AuthException(MessageUtils.message("social.config.missing"));
        };
    }

    /**
     * 优先用 address / clientAddress 拼装回调；未配置时回退 YAML redirect-uri。
     */
    public static String resolveRedirectUri(String source, SocialLoginConfigProperties obj,
                                            SocialProperties socialProperties, String app) {
        String base = "client".equalsIgnoreCase(StringUtils.blankToDefault(app, "admin"))
            ? socialProperties.getClientAddress()
            : socialProperties.getAddress();
        if (StringUtils.isNotBlank(base)) {
            String normalized = base.replaceAll("/+$", "");
            return normalized + "/social-callback?source=" + source;
        }
        return obj.getRedirectUri();
    }
}
