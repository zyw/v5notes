package xin.v5ai.web.listener;

import cn.hutool.core.convert.Convert;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import xin.v5ai.common.core.constant.ClientAccountConstants;
import xin.v5ai.common.core.constant.SystemConstants;
import xin.v5ai.common.core.enums.UserSource;
import xin.v5ai.common.core.utils.StringUtils;
import xin.v5ai.common.mail.config.properties.MailProperties;
import xin.v5ai.common.mail.core.MailBuilder;
import xin.v5ai.system.domain.vo.SysUserVo;
import xin.v5ai.system.service.ISysConfigService;
import xin.v5ai.system.service.ISysUserService;
import xin.v5ai.web.event.ClientRegisterNotifyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * 客户端注册成功后异步邮件通知管理员。发送失败不影响注册。
 */
@Slf4j
@RequiredArgsConstructor
@Component
public class ClientRegisterNotifyListener {

    private final ISysConfigService configService;
    private final ISysUserService userService;
    private final MailProperties mailProperties;

    @Async
    @EventListener
    public void onClientRegistered(ClientRegisterNotifyEvent event) {
        try {
            if (!Convert.toBool(configService.selectConfigByKey(ClientAccountConstants.REGISTER_NOTIFY_ADMIN))) {
                return;
            }
            String to = resolveAdminEmail();
            if (StringUtils.isBlank(to)) {
                log.warn("客户端注册通知管理员已开启，但未配置收件邮箱且 admin 用户也无邮箱");
                return;
            }
            if (!Boolean.TRUE.equals(mailProperties.getEnabled())) {
                log.warn("客户端注册通知管理员已开启，但邮件服务未启用");
                return;
            }
            if (Boolean.TRUE.equals(mailProperties.getDryRun())) {
                log.warn("mail.dry-run=true，跳过管理员注册通知。account={}, to={}", event.account(), to);
                return;
            }
            String safeAccount = escapeHtml(event.account());
            String safeNick = escapeHtml(StringUtils.blankToDefault(event.nickName(), event.account()));
            String sourceLabel = UserSource.CLIENT_SOCIAL.getCode().equals(event.source())
                ? "客户端第三方开户"
                : "客户端邮箱注册";
            MailBuilder.of()
                .to(to)
                .subject("【V5Notes云笔记】新客户端用户注册")
                .html("<p>有新的客户端用户注册成功。</p>"
                    + "<p>来源：" + sourceLabel + "</p>"
                    + "<p>账号：" + safeAccount + "</p>"
                    + "<p>昵称：" + safeNick + "</p>")
                .send();
        } catch (Exception e) {
            log.error("客户端注册通知管理员邮件发送失败 => {}", e.getMessage(), e);
        }
    }

    /**
     * 优先参数邮箱，否则回退超级管理员用户邮箱。
     */
    private String resolveAdminEmail() {
        String configured = StringUtils.trim(configService.selectConfigByKey(ClientAccountConstants.REGISTER_NOTIFY_ADMIN_EMAIL));
        if (StringUtils.isNotBlank(configured)) {
            return configured;
        }
        SysUserVo admin = userService.selectUserById(SystemConstants.SUPER_ADMIN_USER_ID);
        return admin == null ? null : StringUtils.trim(admin.getEmail());
    }

    private static String escapeHtml(String value) {
        return StringUtils.blankToDefault(value, "")
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;");
    }
}
