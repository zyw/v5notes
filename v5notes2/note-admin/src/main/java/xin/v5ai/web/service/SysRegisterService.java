package xin.v5ai.web.service;

import cn.hutool.core.util.IdUtil;
import cn.hutool.crypto.digest.BCrypt;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import me.zhyd.oauth.model.AuthUser;
import xin.v5ai.common.core.constant.Constants;
import xin.v5ai.common.core.constant.GlobalConstants;
import xin.v5ai.common.core.enums.UserSource;
import xin.v5ai.common.core.enums.UserType;
import xin.v5ai.common.core.exception.ServiceException;
import xin.v5ai.common.core.exception.user.CaptchaException;
import xin.v5ai.common.core.exception.user.CaptchaExpireException;
import xin.v5ai.common.core.exception.user.UserException;
import xin.v5ai.common.core.utils.MessageUtils;
import xin.v5ai.common.core.utils.ServletUtils;
import xin.v5ai.common.core.utils.SpringUtils;
import xin.v5ai.common.core.utils.StringUtils;
import xin.v5ai.common.log.event.LoginInfoEvent;
import xin.v5ai.common.redis.utils.RedisUtils;
import xin.v5ai.common.satoken.utils.LoginHelper;
import xin.v5ai.common.web.config.properties.CaptchaProperties;
import xin.v5ai.system.api.model.RegisterBody;
import xin.v5ai.system.domain.SysUser;
import xin.v5ai.system.domain.bo.SysUserBo;
import xin.v5ai.system.domain.vo.SysUserVo;
import xin.v5ai.system.mapper.SysUserMapper;
import xin.v5ai.system.service.ISysConfigService;
import xin.v5ai.system.service.ISysUserService;
import xin.v5ai.web.domain.bo.ClientRegisterBody;
import org.springframework.stereotype.Service;

/**
 * 注册校验方法
 *
 * @author Lion Li
 */
@RequiredArgsConstructor
@Service
public class SysRegisterService {

    private final ISysUserService userService;
    private final ISysConfigService configService;
    private final SysUserMapper userMapper;
    private final CaptchaProperties captchaProperties;

    /**
     * 注册
     *
     * @param registerBody 注册请求参数
     */
    public void register(RegisterBody registerBody) {
        String username = registerBody.getUsername();
        String password = registerBody.getPassword();
        // 校验用户类型是否存在
        String userType = UserType.getUserType(registerBody.getUserType()).getUserType();

        boolean captchaEnabled = captchaProperties.getEnable();
        // 验证码开关
        if (captchaEnabled) {
            validateCaptcha(username, registerBody.getCode(), registerBody.getUuid());
        }
        SysUserBo sysUser = new SysUserBo();
        sysUser.setUserName(username);
        sysUser.setNickName(username);
        sysUser.setPassword(BCrypt.hashpw(password));
        sysUser.setUserType(userType);
        sysUser.setUserSource(UserSource.ADMIN_REGISTER.getCode());

        boolean exist = userMapper.lambda()
            .eq(SysUser::getUserName, sysUser.getUserName())
            .exists();
        if (exist) {
            throw new UserException("user.register.save.error", username);
        }
        boolean regFlag = userService.registerUser(sysUser);
        if (!regFlag) {
            throw new UserException("user.register.error");
        }
        recordLoginInfo(username, Constants.REGISTER, MessageUtils.message("user.register.success"));
    }

    /**
     * 客户端自助注册。用户类型固定为客户端用户，来源固定为客户端注册。
     *
     * @param body 注册信息
     */
    public void registerClient(ClientRegisterBody body) {
        if (!configService.selectClientRegisterEnabled()) {
            throw new UserException("client.register.disabled");
        }
        String email = body.getEmail().trim();
        String key = GlobalConstants.CAPTCHA_CODE_KEY + email;
        String cached = RedisUtils.getCacheObject(key);
        if (StringUtils.isBlank(cached)) {
            throw new CaptchaExpireException();
        }
        if (!cached.equals(body.getEmailCode().trim())) {
            throw new UserException("user.jcaptcha.error");
        }
        boolean nameUsed = userMapper.lambda().eq(SysUser::getUserName, email).exists();
        boolean emailUsed = userMapper.lambda().eq(SysUser::getEmail, email).exists();
        if (nameUsed || emailUsed) {
            throw new UserException("client.register.email.exists");
        }
        String nickName = emailNickName(email);
        SysUserBo sysUser = new SysUserBo();
        // 登录名即邮箱；昵称取 @ 前本地部分，便于侧栏展示
        sysUser.setUserName(email);
        sysUser.setNickName(nickName);
        sysUser.setEmail(email);
        sysUser.setPassword(BCrypt.hashpw(body.getPassword()));
        sysUser.setUserType(UserType.CLIENT_USER.getUserType());
        sysUser.setUserSource(UserSource.CLIENT_REGISTER.getCode());
        if (!userService.registerUser(sysUser)) {
            throw new UserException("user.register.error");
        }
        RedisUtils.deleteObject(key);
        recordLoginInfo(email, Constants.REGISTER, MessageUtils.message("user.register.success"));
    }

    /**
     * 客户端第三方登录自动开户。用户类型固定 cli_user，来源 client_social；计入试用。
     *
     * @param authUser 第三方授权用户
     * @return 新建用户
     */
    public SysUserVo registerClientBySocial(AuthUser authUser) {
        if (!configService.selectClientRegisterEnabled()) {
            throw new UserException("client.register.disabled");
        }
        String email = StringUtils.trim(authUser.getEmail());
        // 登录名优先级：邮箱 → 平台 login（如 Gitee lxm09）→ 前缀 + uuid
        boolean useEmailAsName = StringUtils.isNotBlank(email) && email.length() <= 50;
        String userName;
        if (useEmailAsName) {
            boolean nameUsed = userMapper.lambda().eq(SysUser::getUserName, email).exists();
            boolean emailUsed = userMapper.lambda().eq(SysUser::getEmail, email).exists();
            if (nameUsed || emailUsed) {
                throw new ServiceException(MessageUtils.message("auth.social.email.occupied"));
            }
            userName = email;
        } else {
            userName = resolveSocialFallbackUserName(authUser);
            if (userMapper.lambda().eq(SysUser::getUserName, userName).exists()) {
                throw new UserException("user.register.save.error", userName);
            }
        }
        SysUserBo sysUser = new SysUserBo();
        sysUser.setUserName(userName);
        sysUser.setNickName(socialNickName(authUser));
        if (StringUtils.isNotBlank(email)) {
            sysUser.setEmail(email);
        }
        // 随机口令：禁止用账密冒充社交账号登录
        sysUser.setPassword(BCrypt.hashpw(IdUtil.fastSimpleUUID()));
        sysUser.setUserType(UserType.CLIENT_USER.getUserType());
        sysUser.setUserSource(UserSource.CLIENT_SOCIAL.getCode());
        if (StringUtils.isNotBlank(authUser.getAvatar())) {
            sysUser.setAvatar(authUser.getAvatar());
        }
        if (!userService.registerUser(sysUser)) {
            throw new UserException("user.register.error");
        }
        SysUserVo created = userService.selectUserByUserName(userName);
        if (created == null) {
            throw new UserException("user.register.error");
        }
        recordLoginInfo(userName, Constants.REGISTER, MessageUtils.message("user.register.success"));
        return created;
    }

    /**
     * 是否为无邮箱且无平台 login 时生成的社交占位登录名（gt_/wx_/gh_/gg_ 等）。
     */
    public static boolean isSocialGeneratedUserName(String userName) {
        String name = StringUtils.blankToDefault(userName, "");
        return name.startsWith("gt_")
            || name.startsWith("wx_")
            || name.startsWith("gh_")
            || name.startsWith("gg_")
            || name.matches("^[a-zA-Z]{1,2}_[a-zA-Z0-9]+$");
    }

    /**
     * 无邮箱时的登录名：优先平台 username（Gitee login 等），不可用或已占用则前缀 + uuid。
     */
    String resolveSocialFallbackUserName(AuthUser authUser) {
        String platformName = usablePlatformUserName(authUser == null ? null : authUser.getUsername());
        if (platformName != null && !userMapper.lambda().eq(SysUser::getUserName, platformName).exists()) {
            return platformName;
        }
        String source = authUser == null ? null : authUser.getSource();
        String uuid = authUser == null ? null : authUser.getUuid();
        return socialUserName(source, uuid);
    }

    /**
     * 第三方平台 login/username；长度须符合账号 2–50，否则视为不可用。
     */
    public static String usablePlatformUserName(String platformUserName) {
        String name = StringUtils.trim(platformUserName);
        if (StringUtils.isBlank(name) || name.length() < 2 || name.length() > 50) {
            return null;
        }
        return name;
    }

    /**
     * 生成不超过 30 字符的社交登录名：短前缀 + 平台 uuid（平台 login 不可用时的兜底）。
     */
    static String socialUserName(String source, String uuid) {
        String prefix = switch (StringUtils.blankToDefault(source, "").toLowerCase()) {
            case "gitee" -> "gt_";
            case "github" -> "gh_";
            case "wechat_open" -> "wx_";
            case "google" -> "gg_";
            default -> {
                String cleaned = StringUtils.blankToDefault(source, "s").replaceAll("[^a-zA-Z0-9]", "");
                String head = cleaned.length() > 2 ? cleaned.substring(0, 2) : cleaned;
                yield (StringUtils.isBlank(head) ? "s" : head) + "_";
            }
        };
        String id = StringUtils.blankToDefault(uuid, IdUtil.fastSimpleUUID()).replaceAll("[^a-zA-Z0-9]", "");
        int remain = 30 - prefix.length();
        if (id.length() > remain) {
            id = id.substring(0, remain);
        }
        return prefix + id;
    }

    /**
     * 第三方昵称；空则回退用户名或通用名，并截断到 30 字。
     */
    private static String socialNickName(AuthUser authUser) {
        String nick = StringUtils.blankToDefault(authUser.getNickname(), authUser.getUsername());
        if (StringUtils.isBlank(nick)) {
            nick = "user";
        }
        return nick.length() > 30 ? nick.substring(0, 30) : nick;
    }

    /**
     * 从邮箱生成昵称：取 @ 前本地部分，超长截断，避免空昵称。
     */
    private static String emailNickName(String email) {
        int at = email.indexOf('@');
        String local = at > 0 ? email.substring(0, at) : email;
        if (StringUtils.isBlank(local)) {
            return "user";
        }
        return local.length() > 30 ? local.substring(0, 30) : local;
    }

    /**
     * 校验验证码
     *
     * @param username 用户名
     * @param code     验证码
     * @param uuid     唯一标识
     */
    public void validateCaptcha(String username, String code, String uuid) {
        String verifyKey = GlobalConstants.CAPTCHA_CODE_KEY + StringUtils.blankToDefault(uuid, "");
        String captcha = RedisUtils.getCacheObject(verifyKey);
        RedisUtils.deleteObject(verifyKey);
        if (captcha == null) {
            recordLoginInfo(username, Constants.LOGIN_FAIL, MessageUtils.message("user.jcaptcha.expire"));
            throw new CaptchaExpireException();
        }
        if (!StringUtils.equalsIgnoreCase(code, captcha)) {
            recordLoginInfo(username, Constants.LOGIN_FAIL, MessageUtils.message("user.jcaptcha.error"));
            throw new CaptchaException();
        }
    }

    /**
     * 记录登录信息
     *
     * @param username 用户名
     * @param status   状态
     * @param message  消息内容
     */
    private void recordLoginInfo(String username, String status, String message) {
        LoginInfoEvent loginInfoEvent = new LoginInfoEvent();
        loginInfoEvent.setUsername(username);
        loginInfoEvent.setStatus(status);
        loginInfoEvent.setMessage(message);
        HttpServletRequest request = ServletUtils.getRequest();
        if (request != null) {
            loginInfoEvent.setIp(ServletUtils.getClientIP(request));
            loginInfoEvent.setUserAgent(request.getHeader("User-Agent"));
            loginInfoEvent.setClientId(request.getHeader(LoginHelper.CLIENT_KEY));
        }
        SpringUtils.context().publishEvent(loginInfoEvent);
    }

}
