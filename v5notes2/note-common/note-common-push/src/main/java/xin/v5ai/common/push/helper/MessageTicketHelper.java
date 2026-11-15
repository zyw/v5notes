package xin.v5ai.common.push.helper;

import cn.hutool.core.util.IdUtil;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import xin.v5ai.common.core.utils.StringUtils;
import xin.v5ai.common.redis.utils.RedisUtils;
import xin.v5ai.common.satoken.utils.LoginHelper;
import cn.dev33.satoken.stp.StpUtil;

import java.time.Duration;

/**
 * 消息长连接一次性票据：用于 WebSocket 等无法自定义 Header 的场景，避免把 JWT 放进 URL。
 */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class MessageTicketHelper {

    private static final String TICKET_KEY_PREFIX = "global:message:ticket:";
    private static final Duration TICKET_TTL = Duration.ofSeconds(30);

    /**
     * 为当前登录会话签发短时一次性 ticket。
     *
     * @return ticket
     */
    public static String issue() {
        String token = StpUtil.getTokenValue();
        Long userId = LoginHelper.getUserId();
        if (StringUtils.isBlank(token) || userId == null) {
            throw new IllegalStateException("未登录，无法签发消息连接票据");
        }
        String ticket = IdUtil.fastSimpleUUID();
        RedisUtils.setCacheObject(TICKET_KEY_PREFIX + ticket, token, TICKET_TTL);
        return ticket;
    }

    /**
     * 消费 ticket，返回对应 access token；无效或已使用则返回 null。
     *
     * @param ticket 一次性票据
     * @return access token（无 Bearer 前缀）
     */
    public static String consume(String ticket) {
        if (StringUtils.isBlank(ticket)) {
            return null;
        }
        String key = TICKET_KEY_PREFIX + ticket;
        String token = RedisUtils.getCacheObject(key);
        RedisUtils.deleteObject(key);
        return StringUtils.isBlank(token) ? null : token;
    }
}
