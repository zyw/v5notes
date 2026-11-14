package xin.v5ai.web.controller;

import cn.dev33.satoken.annotation.SaIgnore;
import cn.dev33.satoken.stp.StpUtil;
import cn.hutool.core.util.ObjectUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.zhyd.oauth.model.AuthResponse;
import me.zhyd.oauth.model.AuthUser;
import me.zhyd.oauth.request.AuthRequest;
import me.zhyd.oauth.utils.AuthStateUtils;
import xin.v5ai.common.core.constant.SystemConstants;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.core.domain.model.LoginBody;
import xin.v5ai.common.core.enums.PushSourceEnum;
import xin.v5ai.common.core.enums.PushTypeEnum;
import xin.v5ai.common.core.utils.DateUtils;
import xin.v5ai.common.core.utils.MessageUtils;
import xin.v5ai.common.core.utils.StringUtils;
import xin.v5ai.common.core.utils.ValidatorUtils;
import xin.v5ai.common.encrypt.annotation.ApiEncrypt;
import xin.v5ai.common.json.utils.JsonUtils;
import xin.v5ai.common.satoken.utils.LoginHelper;
import xin.v5ai.common.social.config.properties.SocialLoginConfigProperties;
import xin.v5ai.common.social.config.properties.SocialProperties;
import xin.v5ai.common.social.utils.SocialUtils;
import xin.v5ai.system.api.MessageService;
import xin.v5ai.system.api.domain.PushPayloadDTO;
import xin.v5ai.system.api.model.RegisterBody;
import xin.v5ai.system.api.model.SocialLoginBody;
import xin.v5ai.system.domain.vo.SysClientVo;
import xin.v5ai.system.service.ISysClientService;
import xin.v5ai.system.service.ISysConfigService;
import xin.v5ai.system.service.ISysSocialService;
import xin.v5ai.web.domain.bo.ClientRegisterBody;
import xin.v5ai.web.domain.bo.RefreshTokenBody;
import xin.v5ai.web.domain.vo.LoginVo;
import xin.v5ai.web.service.AuthTokenService;
import xin.v5ai.web.service.IAuthStrategy;
import xin.v5ai.web.service.SysLoginService;
import xin.v5ai.web.service.SysRegisterService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Date;
import java.util.List;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * 认证控制器，提供登录、注册、社交绑定和退出能力。
 *
 * @author Lion Li
 */
@Slf4j
@SaIgnore
@RequiredArgsConstructor
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final SocialProperties socialProperties;
    private final SysLoginService loginService;
    private final SysRegisterService registerService;
    private final ISysConfigService configService;
    private final ISysSocialService socialUserService;
    private final ISysClientService clientService;
    private final ScheduledExecutorService scheduledExecutorService;
    private final MessageService messageService;
    private final AuthTokenService authTokenService;


    /**
     * 登录方法
     *
     * @param body 登录信息
     * @return 结果
     */
    @ApiEncrypt
    @PostMapping("/login")
    public R<LoginVo> login(@RequestBody String body) {
        LoginBody loginBody = JsonUtils.parseObject(body, LoginBody.class);
        ValidatorUtils.validate(loginBody);
        // 授权类型和客户端id
        String clientId = loginBody.getClientId();
        String grantType = loginBody.getGrantType();
        SysClientVo client = clientService.queryByClientId(clientId);
        // 查询不到 client 或 client 内不包含 grantType
        if (ObjectUtil.isNull(client) || !StringUtils.contains(client.getGrantType(), grantType)) {
            log.info("客户端id: {} 认证类型：{} 异常!.", clientId, grantType);
            return R.fail(MessageUtils.message("auth.grant.type.error"));
        } else if (!SystemConstants.NORMAL.equals(client.getStatus())) {
            return R.fail(MessageUtils.message("auth.grant.type.blocked"));
        }
        // 登录
        LoginVo loginVo = IAuthStrategy.login(body, client, grantType);
        // 补充刷新令牌（对 password / clientPassword 等所有授权类型生效）
        authTokenService.attachRefreshToken(loginVo, client);

        Long userId = LoginHelper.getUserId();
        scheduledExecutorService.schedule(() -> {
            messageService.publishMessage(
                List.of(userId),
                PushPayloadDTO.of(
                    PushTypeEnum.MESSAGE,
                    PushSourceEnum.BACKEND,
                    DateUtils.getTodayHour(new Date()) + "好，欢迎登录 V5Notes",
                    null
                )
            );
        }, 5, TimeUnit.SECONDS);
        return R.ok(loginVo);
    }

    /**
     * 刷新令牌：用 refresh_token 换取新的 access_token + refresh_token（刷新令牌轮换）。
     */
    @ApiEncrypt
    @PostMapping("/refresh")
    public R<LoginVo> refresh(@RequestBody RefreshTokenBody body) {
        return R.ok(authTokenService.refresh(body.getRefreshToken()));
    }

    /**
     * 获取第三方绑定跳转地址。
     *
     * @param source 登录来源
     * @return 跳转地址
     */
    @GetMapping("/binding/{source}")
    public R<String> authBinding(@PathVariable("source") String source,
                                 @RequestParam(value = "app", required = false, defaultValue = "admin") String app) {
        SocialLoginConfigProperties obj = socialProperties.getType().get(source);
        if (ObjectUtil.isNull(obj)) {
            return R.fail(MessageUtils.message("auth.social.unsupported", source));
        }
        AuthRequest authRequest = SocialUtils.getAuthRequest(source, socialProperties, app);
        String authorizeUrl = authRequest.authorize(AuthStateUtils.createState());
        return R.data(authorizeUrl);
    }

    /**
     * 处理前端回调后的社交账号绑定。
     *
     * @param loginBody 请求体
     * @return 操作结果
     */
    @PostMapping("/social/callback")
    public R<Void> socialCallback(@RequestBody SocialLoginBody loginBody) {
        // 校验token
        StpUtil.checkLogin();
        // 笔记客户端绑定须与 authorize 时同一套 client 回调地址
        String app = resolveSocialApp(loginBody.getClientId());
        AuthResponse<AuthUser> response = SocialUtils.loginAuth(
            loginBody.getSource(), loginBody.getSocialCode(),
            loginBody.getSocialState(), socialProperties, app);
        AuthUser authUserData = response.getData();
        if (!response.ok()) {
            return R.fail(response.getMsg());
        }
        loginService.socialRegister(authUserData);
        return R.ok();
    }

    /**
     * 按登录客户端判断社交回调端：Vault → vault，笔记 client → client，其余 → admin。
     */
    private String resolveSocialApp(String clientId) {
        if (StringUtils.isBlank(clientId)) {
            return "admin";
        }
        SysClientVo client = clientService.queryByClientId(clientId);
        if (client == null) {
            return "admin";
        }
        String deviceType = client.getDeviceType();
        if ("vault_client".equals(deviceType)) {
            return "vault";
        }
        if ("client".equals(deviceType) || "pc_client".equals(deviceType)) {
            return "client";
        }
        return "admin";
    }


    /**
     * 取消当前用户的社交账号授权。
     *
     * @param socialId socialId
     * @return 操作结果
     */
    @DeleteMapping(value = "/unlock/{socialId}")
    public R<Void> unlockSocial(@PathVariable Long socialId) {
        // 校验token
        StpUtil.checkLogin();
        Boolean rows = socialUserService.deleteWithValidById(socialId);
        return rows ? R.ok() : R.fail(MessageUtils.message("auth.unbind.failed"));
    }


    /**
     * 退出登录
     */
    @PostMapping("/logout")
    public R<Void> logout() {
        loginService.logout();
        return R.ok(MessageUtils.message("user.logout.success"));
    }

    /**
     * 用户注册。
     *
     * @param user 注册信息
     * @return 操作结果
     */
    @ApiEncrypt
    @PostMapping("/register")
    public R<Void> register(@Validated @RequestBody RegisterBody user) {
        if (!configService.selectRegisterEnabled()) {
            return R.fail(MessageUtils.message("auth.register.disabled"));
        }
        registerService.register(user);
        return R.ok();
    }

    /**
     * 客户端自助注册是否开启。登录页据此决定是否展示注册入口。
     *
     * @return true 开启
     */
    @GetMapping("/client/register-enabled")
    public R<Boolean> clientRegisterEnabled() {
        return R.ok(configService.selectClientRegisterEnabled());
    }

    /**
     * 管理端第三方登录是否开启。登录页据此决定是否展示第三方入口。
     *
     * @return true 开启
     */
    @GetMapping("/third-party-login-enabled")
    public R<Boolean> thirdPartyLoginEnabled() {
        return R.ok(configService.selectThirdPartyLoginEnabled());
    }

    /**
     * 客户端第三方登录是否开启。登录页据此决定是否展示第三方入口。
     *
     * @return true 开启
     */
    @GetMapping("/client/third-party-login-enabled")
    public R<Boolean> clientThirdPartyLoginEnabled() {
        return R.ok(configService.selectClientThirdPartyLoginEnabled());
    }

    /**
     * 客户端自助注册。成功后用户类型为 cli_user，来源为 client_register。
     *
     * @param body 注册信息
     * @return 操作结果
     */
    @ApiEncrypt
    @PostMapping("/client/register")
    public R<Void> clientRegister(@Validated @RequestBody ClientRegisterBody body) {
        registerService.registerClient(body);
        return R.ok();
    }

}
