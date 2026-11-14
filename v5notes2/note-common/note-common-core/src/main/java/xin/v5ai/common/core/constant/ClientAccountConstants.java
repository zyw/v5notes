package xin.v5ai.common.core.constant;

/**
 * 客户端账号参数键。值在系统参数设置里修改。
 */
public final class ClientAccountConstants {

    /**
     * 是否开启客户端自助注册，true 开启，false 关闭。
     */
    public static final String REGISTER_USER = "client.account.registerUser";

    /**
     * 客户端自助注册用户的试用天数。
     */
    public static final String TRIAL_DAYS = "client.account.trialDays";

    /**
     * 客户端自助注册用户的试用空间，单位 MB。
     */
    public static final String TRIAL_STORAGE_MB = "client.account.trialStorageMb";

    /**
     * 是否开启客户端第三方登录，true 开启，false 关闭。
     */
    public static final String THIRD_PARTY_LOGIN = "client.thirdPartyLogin.enable";

    private ClientAccountConstants() {
    }
}
