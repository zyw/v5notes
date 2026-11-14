package xin.v5ai.common.social.config;

import me.zhyd.oauth.config.AuthSource;
import me.zhyd.oauth.request.AuthDefaultRequest;
import xin.v5ai.common.social.request.AuthZhihuRequest;

/**
 * 知乎开放平台 OAuth 端点（JustAuth 未内置，本地扩展）。
 * <p>
 * 凭证字段映射：YAML {@code client-id}/{@code client-secret} → 知乎 {@code app_id}/{@code app_key}。
 */
public enum AuthZhihuSource implements AuthSource {

    ZHIHU {
        @Override
        public String authorize() {
            return "https://openapi.zhihu.com/authorize";
        }

        @Override
        public String accessToken() {
            return "https://openapi.zhihu.com/access_token";
        }

        @Override
        public String userInfo() {
            return "https://openapi.zhihu.com/user";
        }

        @Override
        public Class<? extends AuthDefaultRequest> getTargetClass() {
            return AuthZhihuRequest.class;
        }
    };

    /**
     * 与前端 / YAML 的 {@code zhihu} 标识一致（避免枚举名 {@code ZHIHU} 直接入库）。
     */
    @Override
    public String getName() {
        return "zhihu";
    }
}
