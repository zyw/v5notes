package xin.v5ai.web.service;

import cn.dev33.satoken.stp.StpUtil;
import cn.hutool.crypto.SecureUtil;
import org.redisson.api.RBucket;
import xin.v5ai.common.redis.utils.RedisUtils;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;

/**
 * 刷新令牌存储：仅保存令牌哈希对应的 userId/clientId，令牌明文只返回给客户端。
 *
 * <p>Redis Key: {@code auth:refresh:<sha256(token)>} → {@code userId\nclientId}；
 * 同时在当前访问令牌的 Sa-Token Session 中记录哈希，便于登出时撤销。</p>
 */
public final class RefreshTokenStore {

    public static final String SESSION_KEY = "auth:refresh-token-hash";
    /** 刷新令牌有效期：30 天 */
    public static final Duration TTL = Duration.ofDays(30);
    private static final String REDIS_PREFIX = "auth:refresh:";
    private static final SecureRandom RANDOM = new SecureRandom();

    private RefreshTokenStore() {
    }

    /** 为指定用户/客户端签发刷新令牌，并记录在访问令牌会话中。 */
    public static String issue(Long userId, String clientId) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        RedisUtils.getClient().<String>getBucket(redisKey(token)).set(userId + "\n" + clientId, TTL);
        StpUtil.getTokenSession().set(SESSION_KEY, SecureUtil.sha256(token));
        return token;
    }

    public static String redisKey(String token) {
        return REDIS_PREFIX + SecureUtil.sha256(token);
    }

    public static String find(String token) {
        return RedisUtils.getClient().<String>getBucket(redisKey(token)).get();
    }

    /** 原子取出并删除，保证刷新令牌一次性使用。 */
    public static String consume(String token) {
        RBucket<String> bucket = RedisUtils.getClient().getBucket(redisKey(token));
        return bucket.getAndDelete();
    }

    public static void revoke(String hashedToken) {
        if (hashedToken != null && !hashedToken.isBlank()) {
            RedisUtils.deleteObject(REDIS_PREFIX + hashedToken);
        }
    }
}
