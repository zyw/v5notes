package xin.v5ai.common.social.utils;

import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.zhyd.oauth.model.AuthToken;
import me.zhyd.oauth.model.AuthUser;
import me.zhyd.oauth.utils.HttpUtils;
import me.zhyd.oauth.utils.JsonUtils;
import xin.v5ai.common.core.utils.StringUtils;

import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * Gitee 用户资料里的 {@code email} 常因隐私设置为空；需在授权 {@code emails}
 * scope 后另调 {@code GET /api/v5/emails} 才能拿到真实邮箱。JustAuth 未做这一步。
 */
@Slf4j
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class GiteeEmailSupport {

    private static final String EMAILS_URL = "https://gitee.com/api/v5/emails";

    /**
     * 当 {@link AuthUser#getEmail()} 为空时，用 access token 拉取邮箱列表并回填。
     */
    public static void enrichEmail(AuthUser authUser) {
        if (authUser == null || StringUtils.isNotBlank(authUser.getEmail())) {
            return;
        }
        AuthToken token = authUser.getToken();
        if (token == null || StringUtils.isBlank(token.getAccessToken())) {
            return;
        }
        try {
            String body = new HttpUtils()
                .get(EMAILS_URL + "?access_token=" + token.getAccessToken())
                .getBody();
            String email = pickPrimaryEmail(body);
            if (StringUtils.isNotBlank(email)) {
                authUser.setEmail(email);
            }
        } catch (Exception ex) {
            log.warn("Failed to fetch Gitee emails for uuid={}: {}", authUser.getUuid(), ex.getMessage());
        }
    }

    /**
     * 优先 confirmed + primary；否则取首个 confirmed；再否则取列表第一项。
     */
    @SuppressWarnings("unchecked")
    public static String pickPrimaryEmail(String body) {
        if (StringUtils.isBlank(body) || !body.trim().startsWith("[")) {
            return null;
        }
        List<?> emails;
        try {
            emails = JsonUtils.parseObject(body, List.class);
        } catch (Exception ex) {
            return null;
        }
        if (emails == null || emails.isEmpty()) {
            return null;
        }
        String firstConfirmed = null;
        String firstAny = null;
        for (Object item : emails) {
            if (!(item instanceof Map<?, ?> emailObj)) {
                continue;
            }
            String email = StringUtils.trim(stringVal(emailObj.get("email")));
            if (StringUtils.isBlank(email) || !email.contains("@")) {
                continue;
            }
            if (firstAny == null) {
                firstAny = email;
            }
            String state = StringUtils.blankToDefault(stringVal(emailObj.get("state")), "");
            if (!"confirmed".equalsIgnoreCase(state)) {
                continue;
            }
            if (firstConfirmed == null) {
                firstConfirmed = email;
            }
            if (hasPrimaryScope(emailObj.get("scope"))) {
                return email;
            }
        }
        return firstConfirmed != null ? firstConfirmed : firstAny;
    }

    private static boolean hasPrimaryScope(Object scope) {
        if (scope instanceof Collection<?> scopeItems) {
            for (Object s : scopeItems) {
                if ("primary".equalsIgnoreCase(String.valueOf(s))) {
                    return true;
                }
            }
            return false;
        }
        return scope != null && String.valueOf(scope).toLowerCase().contains("primary");
    }

    private static String stringVal(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
