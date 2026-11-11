package xin.v5ai.web.domain.bo;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;
import org.hibernate.validator.constraints.Length;
import xin.v5ai.common.core.constant.RegexConstants;

/**
 * 客户端自助注册。登录名为邮箱（手机号下期），不单独收集用户名。
 */
@Data
public class ClientRegisterBody {

    /**
     * 邮箱（同时作为登录账号）
     */
    @NotBlank(message = "{user.email.not.blank}")
    @Email(message = "{user.email.incorrect}")
    @Length(max = 50, message = "{dept.email.length}")
    private String email;

    /**
     * 密码：至少 8 位，含大小写字母、数字及特殊字符 #$*@&
     */
    @NotBlank(message = "{user.password.not.blank}")
    @Length(min = 8, max = 30, message = "{user.password.length.valid}")
    @Pattern(regexp = RegexConstants.PASSWORD, message = "{user.password.format.valid}")
    private String password;

    /**
     * 邮箱验证码
     */
    @NotBlank(message = "{client.register.code.not.blank}")
    @Length(min = 6, max = 6, message = "{client.register.code.length.valid}")
    private String emailCode;
}
