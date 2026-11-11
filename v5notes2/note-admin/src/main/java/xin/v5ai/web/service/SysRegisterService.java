package xin.v5ai.web.service;

import cn.hutool.crypto.digest.BCrypt;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import xin.v5ai.common.core.constant.Constants;
import xin.v5ai.common.core.constant.GlobalConstants;
import xin.v5ai.common.core.enums.UserSource;
import xin.v5ai.common.core.enums.UserType;
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
