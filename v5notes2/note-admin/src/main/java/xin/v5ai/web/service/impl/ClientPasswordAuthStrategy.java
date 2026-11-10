package xin.v5ai.web.service.impl;

import cn.dev33.satoken.stp.StpUtil;
import cn.dev33.satoken.stp.parameter.SaLoginParameter;
import cn.hutool.core.util.ObjectUtil;
import cn.hutool.crypto.digest.BCrypt;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import xin.v5ai.common.core.enums.LoginType;
import xin.v5ai.common.core.enums.UserType;
import xin.v5ai.common.core.exception.user.UserException;
import xin.v5ai.common.core.utils.StringUtils;
import xin.v5ai.common.core.utils.ValidatorUtils;
import xin.v5ai.common.json.utils.JsonUtils;
import xin.v5ai.common.satoken.utils.LoginHelper;
import xin.v5ai.system.api.model.LoginUser;
import xin.v5ai.system.api.model.PasswordLoginBody;
import xin.v5ai.system.domain.SysUser;
import xin.v5ai.system.domain.vo.SysClientVo;
import xin.v5ai.system.domain.vo.SysUserVo;
import xin.v5ai.system.mapper.SysUserMapper;
import xin.v5ai.web.domain.vo.LoginVo;
import xin.v5ai.web.service.IAuthStrategy;
import xin.v5ai.web.service.SysLoginService;
import org.springframework.stereotype.Service;

/**
 * 云笔记客户端密码认证策略。
 *
 * <p>沿用 v5notes 旧行为：只允许 {@link UserType#CLIENT_USER}（cli_user）登录，
 * 但 6.1.0 已移除多租户，登录不再做 TenantHelper.dynamic。</p>
 *
 * @author Michelle.Chung
 */
@Slf4j
@Service("clientPassword" + IAuthStrategy.BASE_NAME)
@RequiredArgsConstructor
public class ClientPasswordAuthStrategy implements IAuthStrategy {

    private final SysLoginService loginService;
    private final SysUserMapper userMapper;

    /**
     * 执行客户端账号密码登录，并按客户端配置生成访问令牌。
     *
     * @param body   登录请求体
     * @param client 当前客户端配置
     * @return 登录结果
     */
    @Override
    public LoginVo login(String body, SysClientVo client) {
        PasswordLoginBody loginBody = JsonUtils.parseObject(body, PasswordLoginBody.class);
        ValidatorUtils.validate(loginBody);
        String username = loginBody.getUsername();
        String password = loginBody.getPassword();

        SysUserVo user = loadUserByUsername(username);
        loginService.checkLogin(LoginType.PASSWORD, username, () -> !BCrypt.checkpw(password, user.getPassword()));
        // 此处可根据登录用户的数据不同 自行创建 loginUser
        LoginUser loginUser = loginService.buildLoginUser(user);
        // 验证用户类型：客户端接口只允许 cli_user 登录
        if (!StringUtils.equals(loginUser.getUserType(), UserType.CLIENT_USER.getUserType())) {
            throw new UserException("user.not.type.error");
        }
        loginUser.setClientKey(client.getClientKey());
        loginUser.setDeviceType(client.getDeviceType());
        // 按客户端配置生成登录参数（超时/设备类型/客户端标识）
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
     * 按用户名加载可登录用户，并校验是否存在或被停用。
     *
     * @param username 用户名
     * @return 用户信息
     */
    private SysUserVo loadUserByUsername(String username) {
        SysUserVo user = userMapper.lambda()
            .eq(SysUser::getUserName, username)
            .voOne();
        if (ObjectUtil.isNull(user)) {
            log.info("登录用户：{} 不存在.", username);
            throw new UserException("user.not.exists", username);
        } else if (xin.v5ai.common.core.constant.SystemConstants.DISABLE.equals(user.getStatus())) {
            log.info("登录用户：{} 已被停用.", username);
            throw new UserException("user.blocked", username);
        }
        return user;
    }

}
