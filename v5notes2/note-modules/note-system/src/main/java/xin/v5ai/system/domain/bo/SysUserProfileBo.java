package xin.v5ai.system.domain.bo;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;
import xin.v5ai.common.core.constant.RegexConstants;
import xin.v5ai.common.core.xss.Xss;

import java.io.Serial;
import java.io.Serializable;

/**
 * 个人信息业务处理
 *
 * @author Michelle.Chung
 */

@Data
@NoArgsConstructor
public class SysUserProfileBo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 用户昵称
     */
    @Xss(message = "{user.nick.script}")
    @Size(min = 0, max = 30, message = "{user.nick.length}")
    private String nickName;

    /**
     * 用户邮箱
     */
    @Email(message = "{user.email.incorrect}")
    @Size(min = 0, max = 50, message = "{dept.email.length}")
    private String email;

    /**
     * 手机号码
     */
    @Pattern(regexp = RegexConstants.MOBILE, message = "{user.mobile.invalid}")
    private String phoneNumber;

    /**
     * 用户性别（0男 1女 2未知）
     */
    private String gender;

    /**
     * 头像地址
     */
    private String avatar;

}
