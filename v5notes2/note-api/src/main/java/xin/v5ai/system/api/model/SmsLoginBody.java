package xin.v5ai.system.api.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;
import lombok.EqualsAndHashCode;
import xin.v5ai.common.core.constant.RegexConstants;
import xin.v5ai.common.core.domain.model.LoginBody;

/**
 * 短信验证码登录请求对象。
 *
 * @author Lion Li
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class SmsLoginBody extends LoginBody {

    /**
     * 手机号
     */
    @NotBlank(message = "{user.phonenumber.not.blank}")
    @Pattern(regexp = RegexConstants.MOBILE, message = "{user.mobile.invalid}")
    private String phoneNumber;

    /**
     * 短信code
     */
    @NotBlank(message = "{sms.code.not.blank}")
    private String smsCode;

}
