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
import xin.v5ai.common.core.exception.ServiceException;
import xin.v5ai.common.core.exception.user.UserException;
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
import xin.v5ai.system.service.ISysSocialService;
import xin.v5ai.web.domain.vo.LoginVo;
import xin.v5ai.web.service.IAuthStrategy;
import xin.v5ai.web.service.SysLoginService;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 第三方授权策略
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
        AuthResponse<AuthUser> response = SocialUtils.loginAuth(
            loginBody.getSource(), loginBody.getSocialCode(),
            loginBody.getSocialState(), socialProperties);
        if (!response.ok()) {
            throw new ServiceException(response.getMsg());
        }
        AuthUser authUserData = response.getData();

        List<SysSocialVo> list = sysSocialService.selectByAuthId(authUserData.getSource() + authUserData.getUuid());
        if (CollUtil.isEmpty(list)) {
            throw new ServiceException(MessageUtils.message("auth.social.unbound"));
        }
        SysUserVo user = loadUser(list.getFirst().getUserId());
        // 此处可根据登录用户的数据不同 自行创建 loginUser 属性不够用继承扩展就行了
        LoginUser loginUser = loginService.buildLoginUser(user);
        loginService.checkClientUserType(client, user.getUserName(), loginUser.getUserType());
        loginUser.setClientKey(client.getClientKey());
        loginUser.setDeviceType(client.getDeviceType());
        SaLoginParameter model = IAuthStrategy.buildLoginParameter(client);
        // 生成token
        LoginHelper.login(loginUser, model);

        LoginVo loginVo = new LoginVo();
        loginVo.setAccessToken(StpUtil.getTokenValue());
        loginVo.setExpireIn(StpUtil.getTokenTimeout());
        loginVo.setClientId(client.getClientId());
        return loginVo;
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
