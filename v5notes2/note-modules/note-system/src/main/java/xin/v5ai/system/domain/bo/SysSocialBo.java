package xin.v5ai.system.domain.bo;

import io.github.linpeilie.annotations.AutoMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.NoArgsConstructor;
import xin.v5ai.common.core.validate.AddGroup;
import xin.v5ai.common.core.validate.EditGroup;
import xin.v5ai.system.domain.SysSocial;

import java.io.Serial;
import java.io.Serializable;

/**
 * 社会化关系业务对象 sys_social
 *
 * @author Lion Li
 */
@Data
@NoArgsConstructor
@AutoMapper(target = SysSocial.class, reverseConvertGenerate = false)
public class SysSocialBo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 主键
     */
    @NotNull(message = "{id.not.null}", groups = {EditGroup.class})
    private Long id;

    /**
     * 认证唯一ID
     */
    @NotBlank(message = "{social.id.not.null}", groups = {AddGroup.class, EditGroup.class})
    private String authId;

    /**
     * 用户来源
     */
    @NotBlank(message = "{social.source.required}", groups = {AddGroup.class, EditGroup.class})
    private String source;

    /**
     * 用户的授权令牌
     */
    @NotBlank(message = "{social.token.not.blank}", groups = {AddGroup.class, EditGroup.class})
    private String accessToken;

    /**
     * 用户的授权令牌的有效期，部分平台可能没有
     */
    private int expireIn;

    /**
     * 刷新令牌，部分平台可能没有
     */
    private String refreshToken;

    /**
     * 平台唯一id
     */
    private String openId;

    /**
     * 用户的 ID
     */
    @NotBlank(message = "{social.user.not.blank}", groups = {AddGroup.class, EditGroup.class})
    private Long userId;

    /**
     * 平台的授权信息，部分平台可能没有
     */
    private String accessCode;

    /**
     * 用户的 unionid
     */
    private String unionId;

    /**
     * 授予的权限，部分平台可能没有
     */
    private String scope;

    /**
     * 授权的第三方账号
     */
    private String userName;

    /**
     * 授权的第三方昵称
     */
    private String nickName;

    /**
     * 授权的第三方邮箱
     */
    private String email;

    /**
     * 授权的第三方头像地址
     */
    private String avatar;

    /**
     * 个别平台的授权信息，部分平台可能没有
     */
    private String tokenType;

    /**
     * id token，部分平台可能没有
     */
    private String idToken;

    /**
     * 小米平台用户的附带属性，部分平台可能没有
     */
    private String macAlgorithm;

    /**
     * 小米平台用户的附带属性，部分平台可能没有
     */
    private String macKey;

    /**
     * 用户的授权code，部分平台可能没有
     */
    private String code;

    /**
     * Twitter平台用户的附带属性，部分平台可能没有
     */
    private String oauthToken;

    /**
     * Twitter平台用户的附带属性，部分平台可能没有
     */
    private String oauthTokenSecret;

}
