package xin.v5ai.web.service;

import cn.dev33.satoken.stp.StpUtil;
import cn.dev33.satoken.stp.parameter.SaLoginParameter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import xin.v5ai.common.core.constant.HttpStatus;
import xin.v5ai.common.core.constant.SystemConstants;
import xin.v5ai.common.core.exception.ServiceException;
import xin.v5ai.common.satoken.utils.LoginHelper;
import xin.v5ai.system.api.model.LoginUser;
import xin.v5ai.system.domain.vo.SysClientVo;
import xin.v5ai.system.domain.vo.SysUserVo;
import xin.v5ai.system.mapper.SysUserMapper;
import xin.v5ai.system.service.ISysClientService;
import xin.v5ai.web.domain.vo.LoginVo;

/**
 * 访问令牌 / 刷新令牌 的签发与轮换。
 */
@Service
@RequiredArgsConstructor
public class AuthTokenService {

    private final SysLoginService loginService;
    private final ISysClientService clientService;
    private final SysUserMapper userMapper;

    /** 在已完成的登录结果上补充刷新令牌（登录策略内部已生成访问令牌）。 */
    public void attachRefreshToken(LoginVo loginVo, SysClientVo client) {
        loginVo.setRefreshToken(RefreshTokenStore.issue(LoginHelper.getUserId(), client.getClientId()));
        loginVo.setRefreshExpireIn(RefreshTokenStore.TTL.toSeconds());
    }

    /** 用刷新令牌换取新的访问令牌 + 轮换后的刷新令牌。 */
    public LoginVo refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw invalidRefreshToken();
        }
        String stored = RefreshTokenStore.find(refreshToken);
        if (stored == null) {
            throw invalidRefreshToken();
        }
        String[] parts = stored.split("\n", 2);
        if (parts.length != 2) {
            RefreshTokenStore.consume(refreshToken);
            throw invalidRefreshToken();
        }
        Long userId;
        try {
            userId = Long.valueOf(parts[0]);
        } catch (NumberFormatException ignored) {
            RefreshTokenStore.consume(refreshToken);
            throw invalidRefreshToken();
        }
        SysClientVo client = clientService.queryByClientId(parts[1]);
        SysUserVo user = userMapper.selectVoById(userId);
        if (client == null
            || !SystemConstants.NORMAL.equals(client.getStatus())
            || user == null
            || SystemConstants.DISABLE.equals(user.getStatus())) {
            RefreshTokenStore.consume(refreshToken);
            throw invalidRefreshToken();
        }
        // 一次性消费旧刷新令牌
        if (RefreshTokenStore.consume(refreshToken) == null) {
            throw invalidRefreshToken();
        }
        LoginUser loginUser = loginService.buildLoginUser(user);
        loginUser.setClientKey(client.getClientKey());
        loginUser.setDeviceType(client.getDeviceType());
        SaLoginParameter model = IAuthStrategy.buildLoginParameter(client);
        LoginHelper.login(loginUser, model);
        return tokenPair(client.getClientId(), RefreshTokenStore.issue(userId, client.getClientId()));
    }

    private LoginVo tokenPair(String clientId, String refreshToken) {
        LoginVo result = new LoginVo();
        result.setAccessToken(StpUtil.getTokenValue());
        result.setExpireIn(StpUtil.getTokenTimeout());
        result.setRefreshToken(refreshToken);
        result.setRefreshExpireIn(RefreshTokenStore.TTL.toSeconds());
        result.setClientId(clientId);
        return result;
    }

    private ServiceException invalidRefreshToken() {
        return new ServiceException("刷新令牌无效或已过期，请重新登录", HttpStatus.UNAUTHORIZED);
    }
}
