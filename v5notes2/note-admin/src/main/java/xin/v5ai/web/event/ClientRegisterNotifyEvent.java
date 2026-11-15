package xin.v5ai.web.event;

/**
 * 客户端注册成功后的管理员邮件通知事件（异步处理，不影响注册流程）。
 *
 * @param account  注册账号
 * @param nickName 昵称
 * @param source   用户来源（client_register / client_social）
 */
public record ClientRegisterNotifyEvent(String account, String nickName, String source) {
}
