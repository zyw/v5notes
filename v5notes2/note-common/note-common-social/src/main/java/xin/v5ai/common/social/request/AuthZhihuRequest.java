package xin.v5ai.common.social.request;

import com.xkcoding.http.support.HttpHeader;
import me.zhyd.oauth.cache.AuthStateCache;
import me.zhyd.oauth.config.AuthConfig;
import me.zhyd.oauth.constant.Keys;
import me.zhyd.oauth.enums.AuthUserGender;
import me.zhyd.oauth.exception.AuthException;
import me.zhyd.oauth.model.AuthCallback;
import me.zhyd.oauth.model.AuthToken;
import me.zhyd.oauth.model.AuthUser;
import me.zhyd.oauth.request.AuthDefaultRequest;
import me.zhyd.oauth.utils.HttpUtils;
import me.zhyd.oauth.utils.JsonObject;
import me.zhyd.oauth.utils.StringUtils;
import me.zhyd.oauth.utils.UrlBuilder;
import xin.v5ai.common.social.config.AuthZhihuSource;

/**
 * 知乎开放平台授权登录。
 * <p>
 * 与标准 OAuth2 差异：授权用 {@code app_id}；换票为 JSON body（{@code app_id}/{@code app_key}）；
 * 用户信息走 {@code Authorization: Bearer}，不用 query access_token。
 */
public class AuthZhihuRequest extends AuthDefaultRequest {

    public AuthZhihuRequest(AuthConfig config) {
        super(config, AuthZhihuSource.ZHIHU);
    }

    public AuthZhihuRequest(AuthConfig config, AuthStateCache authStateCache) {
        super(config, AuthZhihuSource.ZHIHU, authStateCache);
    }

    @Override
    public String authorize(String state) {
        return UrlBuilder.fromBaseUrl(source.authorize())
            .queryParam(Keys.OAUTH2_RESPONSE_TYPE, Keys.OAUTH2_CODE)
            .queryParam(Keys.VARIANT__APP_ID, config.getClientId())
            .queryParam(Keys.OAUTH2_REDIRECT_URI, config.getRedirectUri())
            .queryParam(Keys.OAUTH2_STATE, getRealState(state))
            .build();
    }

    @Override
    public AuthToken getAccessToken(AuthCallback authCallback) {
        JsonObject body = new JsonObject();
        body.put(Keys.VARIANT__APP_ID, config.getClientId());
        body.put(Keys.VARIANT__APP_KEY, config.getClientSecret());
        body.put(Keys.OAUTH2_GRANT_TYPE, Keys.OAUTH2_GRANT_TYPE__AUTHORIZATION_CODE);
        body.put(Keys.OAUTH2_REDIRECT_URI, config.getRedirectUri());
        body.put(Keys.OAUTH2_CODE, authCallback.getCode());

        HttpHeader header = new HttpHeader();
        header.add("Content-Type", "application/json");
        String response = new HttpUtils(config.getHttpConfig())
            .post(source.accessToken(), body.toJsonString(), header)
            .getBody();
        JsonObject accessTokenObject = JsonObject.parseObject(response);
        checkResponse(accessTokenObject);
        return AuthToken.builder()
            .accessToken(accessTokenObject.getString(Keys.OAUTH2_ACCESS_TOKEN))
            .tokenType(accessTokenObject.getString(Keys.OAUTH2_TOKEN_TYPE))
            .expireIn(accessTokenObject.getIntValue(Keys.OAUTH2_EXPIRES_IN))
            .build();
    }

    @Override
    public AuthUser getUserInfo(AuthToken authToken) {
        HttpHeader header = new HttpHeader();
        header.add("Authorization", "Bearer " + authToken.getAccessToken());
        String response = new HttpUtils(config.getHttpConfig())
            .get(source.userInfo(), null, header, false)
            .getBody();
        JsonObject object = JsonObject.parseObject(response);
        checkResponse(object);

        String uid = object.getString(Keys.UID);
        String fullName = object.getString("fullname");
        String username = StringUtils.isEmpty(fullName) ? uid : fullName;
        return AuthUser.builder()
            .rawUserInfo(object)
            .uuid(uid)
            .username(username)
            .nickname(fullName)
            .avatar(object.getString("avatar_path"))
            .email(object.getString(Keys.OAUTH2_SCOPE__EMAIL))
            .remark(firstNonBlank(object.getString("headline"), object.getString("description")))
            .gender(mapGender(object.getString("gender")))
            .token(authToken)
            .source(source.getName())
            .build();
    }

    private static AuthUserGender mapGender(String gender) {
        if (StringUtils.isEmpty(gender) || "unknown".equalsIgnoreCase(gender)) {
            return AuthUserGender.UNKNOWN;
        }
        return AuthUserGender.getRealGender(gender);
    }

    private static String firstNonBlank(String first, String second) {
        if (!StringUtils.isEmpty(first)) {
            return first;
        }
        return StringUtils.isEmpty(second) ? null : second;
    }

    private void checkResponse(JsonObject object) {
        if (object == null) {
            throw new AuthException("empty response from Zhihu");
        }
        if (object.containsKey(Keys.ERROR)) {
            String detail = object.getString(Keys.ERROR_DESCRIPTION);
            if (StringUtils.isEmpty(detail)) {
                detail = object.getString(Keys.ERROR);
            }
            throw new AuthException(detail);
        }
        if (object.containsKey(Keys.VARIANT__ERRCODE)) {
            throw new AuthException(object.getString(Keys.VARIANT__ERRMSG));
        }
    }
}
