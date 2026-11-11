package xin.v5ai.web.controller;

import xin.v5ai.common.core.utils.MessageUtils;
import cn.dev33.satoken.annotation.SaIgnore;
import cn.hutool.captcha.generator.CodeGenerator;
import cn.hutool.captcha.generator.MathGenerator;
import cn.hutool.captcha.generator.RandomGenerator;
import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.RandomUtil;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import xin.v5ai.common.core.constant.Constants;
import xin.v5ai.common.core.constant.GlobalConstants;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.core.exception.ServiceException;
import xin.v5ai.common.core.utils.SpringUtils;
import xin.v5ai.common.core.utils.StringUtils;
import xin.v5ai.common.core.utils.regex.RegexValidator;
import xin.v5ai.common.mail.config.properties.MailProperties;
import xin.v5ai.common.mail.core.MailBuilder;
import xin.v5ai.common.redis.annotation.RateLimiter;
import xin.v5ai.common.redis.enums.LimitType;
import xin.v5ai.common.redis.utils.RedisUtils;
import xin.v5ai.system.domain.SysUser;
import xin.v5ai.system.mapper.SysUserMapper;
import xin.v5ai.system.service.ISysConfigService;
import xin.v5ai.common.web.config.properties.CaptchaProperties;
import xin.v5ai.common.web.core.WaveAndCircleCaptcha;
import org.dromara.sms4j.api.SmsBlend;
import org.dromara.sms4j.api.entity.SmsResponse;
import org.dromara.sms4j.core.factory.SmsFactory;
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.awt.*;
import java.time.Duration;
import java.util.LinkedHashMap;

/**
 * 验证码操作处理
 *
 * @author Lion Li
 */
@SaIgnore
@Slf4j
@Validated
@RequiredArgsConstructor
@RestController
public class CaptchaController {

    private final CaptchaProperties captchaProperties;
    private final MailProperties mailProperties;
    private final ISysConfigService configService;
    private final SysUserMapper userMapper;

    /**
     * 发送短信验证码。
     *
     * @param phoneNumber 用户手机号
     * @return 操作结果
     */
    @RateLimiter(key = "#phoneNumber", time = 60, count = 1)
    @GetMapping("/resource/sms/code")
    public R<Void> smsCode(@NotBlank(message = "{user.phonenumber.not.blank}") String phoneNumber) {
        if (!RegexValidator.isMobile(phoneNumber)) {
            return R.fail(MessageUtils.message("sms.phone.invalid"));
        }
        String key = GlobalConstants.CAPTCHA_CODE_KEY + phoneNumber;
        String code = RandomUtil.randomNumbers(6);
        // 验证码模板id 自行处理 (查数据库或写死均可)
        String templateId = "";
        LinkedHashMap<String, String> map = new LinkedHashMap<>(1);
        map.put("code", code);
        SmsBlend smsBlend = SmsFactory.getSmsBlend("config1");
        SmsResponse smsResponse = smsBlend.sendMessage(phoneNumber, templateId, map);
        if (!smsResponse.isSuccess()) {
            log.error("验证码短信发送异常 => {}", smsResponse);
            Object data = smsResponse.getData();
            return R.fail(data == null ? MessageUtils.message("sms.send.captcha.failed") : data.toString());
        }
        RedisUtils.setCacheObject(key, code, Duration.ofMinutes(Constants.CAPTCHA_EXPIRATION));
        return R.ok();
    }

    /**
     * 发送邮箱验证码。scene=register 时用于客户端注册，并拒绝已注册邮箱。
     *
     * @param email 邮箱
     * @param scene 场景，register 为客户端注册，其他值按登录验证码处理
     * @return 操作结果
     */
    @GetMapping("/resource/email/code")
    public R<Void> emailCode(@NotBlank(message = "{user.email.not.blank}") String email,
                             @RequestParam(required = false) String scene) {
        if (!mailProperties.getEnabled()) {
            return R.fail(MessageUtils.message("auth.email.disabled"));
        }
        if (!RegexValidator.isEmail(email)) {
            return R.fail(MessageUtils.message("email.invalid"));
        }
        if ("register".equals(scene)) {
            if (!configService.selectClientRegisterEnabled()) {
                return R.fail(MessageUtils.message("client.register.disabled"));
            }
            boolean used = userMapper.lambda().eq(SysUser::getEmail, email.trim()).exists();
            if (used) {
                return R.fail(MessageUtils.message("client.register.email.exists"));
            }
        }
        try {
            SpringUtils.getAopProxy(this).emailCodeImpl(email, scene);
            return R.ok();
        } catch (ServiceException e) {
            // 业务异常已是系统文案，直接回传
            return R.fail(StringUtils.blankToDefault(e.getMessage(), MessageUtils.message("mail.send.captcha.failed")));
        } catch (Exception e) {
            // SMTP / 限流等底层异常统一包装，避免前端看到 AuthenticationFailedException 等原文
            log.error("验证码邮件发送失败 => {}", e.getMessage(), e);
            return R.fail(MessageUtils.message("mail.send.captcha.failed"));
        }
    }

    /**
     * 发送邮箱验证码的实际执行方法，拆分出来避免开关关闭时仍触发限流。
     *
     * @param email 邮箱
     * @param scene 场景
     */
    /** 重发间隔与验证码有效期一致（Constants.CAPTCHA_EXPIRATION 分钟） */
    @RateLimiter(key = "#email", time = 120, count = 1)
    public void emailCodeImpl(String email, String scene) {
        String key = GlobalConstants.CAPTCHA_CODE_KEY + email;
        String code = RandomUtil.randomNumbers(6);
        boolean register = "register".equals(scene);
        // 开发 dry-run：跳过 SMTP，验证码入 Redis 并打日志，便于本地联调注册流程
        if (Boolean.TRUE.equals(mailProperties.getDryRun())) {
            RedisUtils.setCacheObject(key, code, Duration.ofMinutes(Constants.CAPTCHA_EXPIRATION));
            log.warn("mail.dry-run=true，跳过真实发信。email={}, scene={}, code={}", email, scene, code);
            return;
        }
        try {
            MailBuilder.of()
                .to(email)
                .subject(register ? "【V5Notes云笔记】注册验证码" : "【V5Notes云笔记】登录验证码")
                .html(buildEmailCodeHtml(email, code, register))
                .send();
            RedisUtils.setCacheObject(key, code, Duration.ofMinutes(Constants.CAPTCHA_EXPIRATION));
        } catch (Exception e) {
            log.error("验证码邮件发送异常 => {}", e.getMessage(), e);
            throw new ServiceException(MessageUtils.message("mail.send.captcha.failed"));
        }
    }

    /**
     * 组装验证码邮件 HTML，突出平台名称与验证码有效期。
     */
    private String buildEmailCodeHtml(String email, String code, boolean register) {
        String action = register ? "注册账号" : "登录";
        int minutes = Constants.CAPTCHA_EXPIRATION;
        String safeEmail = StringUtils.blankToDefault(email, "")
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;");
        return """
            <div style="margin:0;padding:0;background:#f4f0e2;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Helvetica Neue',sans-serif;color:#22302a;">
              <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
                <div style="background:#fffefa;border:1px solid rgba(11,74,82,.18);border-radius:12px;overflow:hidden;box-shadow:0 18px 40px rgba(11,74,82,.08);">
                  <div style="padding:22px 28px;background:linear-gradient(148deg,#0f3d33 0%%,#1c5a48 70%%,#256a55 100%%);color:#eafff5;">
                    <div style="font-size:12px;letter-spacing:.18em;opacity:.85;">V5 / NOTES</div>
                    <div style="margin-top:8px;font-size:22px;font-weight:700;">V5Notes云笔记平台</div>
                    <div style="margin-top:6px;font-size:13px;opacity:.88;">%s验证码</div>
                  </div>
                  <div style="padding:28px;">
                    <p style="margin:0 0 14px;font-size:15px;line-height:1.7;">你好，</p>
                    <p style="margin:0 0 18px;font-size:14px;line-height:1.75;color:#3a493f;">
                      你正在使用邮箱 <strong style="color:#22302a;">%s</strong> 进行<strong>%s</strong>。
                      请在页面输入以下验证码完成操作：
                    </p>
                    <div style="margin:0 0 18px;padding:18px 16px;border-radius:10px;background:#f3f7f2;border:1px dashed rgba(49,91,74,.28);text-align:center;">
                      <div style="font-size:12px;letter-spacing:.12em;color:#6b7d74;margin-bottom:8px;">验证码</div>
                      <div style="font-size:34px;font-weight:700;letter-spacing:.28em;color:#0b4a52;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">%s</div>
                    </div>
                    <p style="margin:0 0 10px;font-size:13px;line-height:1.7;color:#5f6f62;">
                      验证码 <strong style="color:#22302a;">%d 分钟</strong>内有效，请尽快填写。
                      如非本人操作，请忽略本邮件。
                    </p>
                    <p style="margin:0;font-size:12px;line-height:1.7;color:#8a978c;">
                      为保障账号安全，请勿将验证码告知他人。
                    </p>
                  </div>
                  <div style="padding:14px 28px 20px;border-top:1px solid #edf0ef;font-size:12px;color:#8a978c;">
                    本邮件由 V5Notes云笔记平台自动发送，请勿直接回复。
                  </div>
                </div>
              </div>
            </div>
            """.formatted(action, safeEmail, action, code, minutes);
    }

    /**
     * 获取图片验证码。
     *
     * @return 验证码信息
     */
    @GetMapping("/auth/code")
    public R<CaptchaVo> getCode() {
        boolean captchaEnabled = captchaProperties.getEnable();
        if (!captchaEnabled) {
            return R.ok(new CaptchaVo(false, null, null));
        }
        return R.ok(SpringUtils.getAopProxy(this).getCodeImpl());
    }

    /**
     * 实际生成图片验证码并缓存结果。
     *
     * @return 验证码信息
     */
    @RateLimiter(time = 60, count = 10, limitType = LimitType.IP)
    public CaptchaVo getCodeImpl() {
        // 保存验证码信息
        String uuid = IdUtil.simpleUUID();
        String verifyKey = GlobalConstants.CAPTCHA_CODE_KEY + uuid;
        // 生成验证码
        String captchaType = captchaProperties.getType();
        CodeGenerator codeGenerator;
        if ("math".equals(captchaType)) {
            codeGenerator = new MathGenerator(captchaProperties.getNumberLength(), false);
        } else {
            codeGenerator = new RandomGenerator(captchaProperties.getCharLength());
        }
        WaveAndCircleCaptcha captcha = new WaveAndCircleCaptcha(160, 60);
        // captcha.setBackground(Color.WHITE); // 不设置就是透明底
        captcha.setFont(new Font("Arial", Font.BOLD, 45));
        captcha.setGenerator(codeGenerator);
        captcha.createCode();
        // 如果是数学验证码，使用SpEL表达式处理验证码结果
        String code = captcha.getCode();
        if ("math".equals(captchaType)) {
            ExpressionParser parser = new SpelExpressionParser();
            Expression exp = parser.parseExpression(StringUtils.remove(code, "="));
            code = exp.getValue(String.class);
        }
        RedisUtils.setCacheObject(verifyKey, code, Duration.ofMinutes(Constants.CAPTCHA_EXPIRATION));
        return new CaptchaVo(true, uuid, captcha.getImageBase64());
    }

    /**
     * 图片验证码响应对象。
     *
     * @param captchaEnabled 是否启用验证码
     * @param uuid           验证码标识
     * @param img            Base64 图片数据
     */
    public record CaptchaVo(Boolean captchaEnabled, String uuid, String img) {
    }

}
