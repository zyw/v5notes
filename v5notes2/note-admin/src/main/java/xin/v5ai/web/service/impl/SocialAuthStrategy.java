package xin.v5ai.web.service.impl;

import xin.v5ai.common.core.utils.MessageUtils;
import cn.dev33.satoken.stp.StpUtil;
import cn.dev33.satoken.stp.parameter.SaLoginParameter;
import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.util.ObjectUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.zhyd.oauth.model.AuthResponse;
import me.zhyd.oauth.model.AuthUser;
import xin.v5ai.common.core.constant.SystemConstants;
import xin.v5ai.common.core.enums.DeviceType;
import xin.v5ai.common.core.exception.ServiceException;
import xin.v5ai.common.core.exception.user.UserException;
import xin.v5ai.common.core.utils.StringUtils;
import xin.v5ai.common.core.utils.ValidatorUtils;
import xin.v5ai.common.json.utils.JsonUtils;
import xin.v5ai.common.satoken.utils.LoginHelper;
import xin.v5ai.common.social.config.properties.SocialProperties;
import xin.v5ai.common.social.utils.SocialUtils;
import xin.v5ai.system.api.model.LoginUser;
import xin.v5ai.system.api.model.SocialLoginBody;
import xin.v5ai.system.domain.vo.SysClientVo;
import xin.v5ai.system.domain.vo.SysSocialVo;
import xin.v5ai.system.domain.vo.SysUserVo;
import xin.v5ai.system.mapper.SysUserMapper;
import xin.v5ai.system.service.ISysConfigService;
import xin.v5ai.system.service.ISysSocialService;
import xin.v5ai.web.domain.vo.LoginVo;
import xin.v5ai.web.service.IAuthStrategy;
import xin.v5ai.web.service.SysLoginService;
import xin.v5ai.web.service.SysRegisterService;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 第三方授权策略。
 * <p>管理端：须先绑定再登录。笔记客户端：未绑定则自动创建 cli_user 并登录。</p>
 *
 * @author thiszhc is 三三
 */
@Slf4j
@Service("social" + IAuthStrategy.BASE_NAME)
@RequiredArgsConstructor
public class SocialAuthStrategy implements IAuthStrategy {

    private final SocialProperties socialProperties;
    private final ISysSocialService sysSocialService;
    private final SysUserMapper userMapper;
    private final SysLoginService loginService;
    private final SysRegisterService registerService;
    private final ISysConfigService configService;

    /**
     * 执行第三方授权登录，并校验授权账号与系统账号的绑定关系。
     *
     * @param body   登录信息
     * @param client 客户端信息
     * @return 登录结果
     */
    @Override
    public LoginVo login(String body, SysClientVo client) {
        SocialLoginBody loginBody = JsonUtils.parseObject(body, SocialLoginBody.class);
        ValidatorUtils.validate(loginBody);
        if (isClientDevice(client)) {
            if (!configService.selectClientThirdPartyLoginEnabled()) {
                throw new ServiceException(MessageUtils.message("client.thirdPartyLogin.disabled"));
            }
        } else if (!configService.selectThirdPartyLoginEnabled()) {
            throw new ServiceException(MessageUtils.message("sys.thirdPartyLogin.disabled"));
        }
        String app = isClientDevice(client) ? "client" : "admin";
        AuthResponse<AuthUser> response = SocialUtils.loginAuth(
            loginBody.getSource(), loginBody.getSocialCode(),
            loginBody.getSocialState(), socialProperties, app);
        if (!response.ok()) {
            throw new ServiceException(response.getMsg());
        }
        AuthUser authUserData = response.getData();
        // JustAuth 写入的 source 多为枚举名（GITEE），统一小写便于 authId / 前端展示匹配
        String source = StringUtils.blankToDefault(authUserData.getSource(), "").toLowerCase();
        authUserData.setSource(source);

        List<SysSocialVo> list = findSocialByAuthUser(source, authUserData.getUuid());
        SysUserVo user;
        if (CollUtil.isNotEmpty(list)) {
            user = loadUser(list.getFirst().getUserId());
        } else if (isClientDevice(client)) {
            // 笔记客户端：社交登录即开户
            SysUserVo created = registerService.registerClientBySocial(authUserData);
            loginService.bindSocialUser(created.getUserId(), authUserData, false);
            user = created;
        } else {
            throw new ServiceException(MessageUtils.message("auth.social.unbound"));
        }

        LoginUser loginUser = loginService.buildLoginUser(user);
        loginService.checkClientUserType(client, user.getUserName(), loginUser.getUserType());
        loginUser.setClientKey(client.getClientKey());
        loginUser.setDeviceType(client.getDeviceType());
        SaLoginParameter model = IAuthStrategy.buildLoginParameter(client);
        LoginHelper.login(loginUser, model);

        LoginVo loginVo = new LoginVo();
        loginVo.setAccessToken(StpUtil.getTokenValue());
        loginVo.setExpireIn(StpUtil.getTokenTimeout());
        loginVo.setClientId(client.getClientId());
        return loginVo;
    }

    private static boolean isClientDevice(SysClientVo client) {
        String deviceType = client == null ? null : client.getDeviceType();
        return DeviceType.CLIENT.getDevice().equals(deviceType) || "pc_client".equals(deviceType);
    }

    /** 按小写 source 查 authId；兼容历史 JustAuth 枚举名大写（如 GITEE + uuid）。 */
    private List<SysSocialVo> findSocialByAuthUser(String source, String uuid) {
        List<SysSocialVo> list = sysSocialService.selectByAuthId(source + uuid);
        if (CollUtil.isNotEmpty(list) || StringUtils.isBlank(source)) {
            return list;
        }
        return sysSocialService.selectByAuthId(source.toUpperCase() + uuid);
    }

    /**
     * 根据用户ID加载用户，并校验账号状态是否允许登录。
     *
     * @param userId 用户ID
     * @return 用户信息
     */
    private SysUserVo loadUser(Long userId) {
        SysUserVo user = userMapper.selectVoById(userId);
        if (ObjectUtil.isNull(user)) {
            log.info("登录用户：{} 不存在.", "");
            throw new UserException("user.not.exists", "");
        } else if (SystemConstants.DISABLE.equals(user.getStatus())) {
            log.info("登录用户：{} 已被停用.", "");
            throw new UserException("user.blocked", "");
        }
        return user;
    }

}
