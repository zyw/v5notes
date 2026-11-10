package xin.v5ai.system.domain.bo;

import io.github.linpeilie.annotations.AutoMapper;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;
import xin.v5ai.common.core.constant.RegexConstants;
import xin.v5ai.common.core.constant.SystemConstants;
import xin.v5ai.common.core.xss.Xss;
import xin.v5ai.system.domain.SysUser;

import java.io.Serial;
import java.io.Serializable;
import java.util.HashMap;
import java.util.Map;

/**
 * 用户信息业务对象 sys_user
 *
 * @author Michelle.Chung
 */

@Data
@NoArgsConstructor
@AutoMapper(target = SysUser.class, reverseConvertGenerate = false)
public class SysUserBo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 用户ID
     */
    private Long userId;

    /**
     * 部门ID
     */
    private Long deptId;

    /**
     * 用户账号
     */
    @Xss(message = "{user.script}")
    @NotBlank(message = "{user.account.not.blank}")
    @Size(min = 2, max = 30, message = "{user.account.length}")
    private String userName;

    /**
     * 用户昵称
     */
    @Xss(message = "{user.nick.script}")
    @NotBlank(message = "{user.nick.not.blank}")
    @Size(min = 0, max = 30, message = "{user.nick.length}")
    private String nickName;

    /**
     * 模糊搜索关键字（同时匹配用户账号或用户昵称）
     */
    private String keyword;

    /**
     * 用户类型（sys_user系统用户）
     */
    private String userType;

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

    /**
     * 密码
     */
    private String password;

    /**
     * 账号状态（0正常 1停用）
     */
    private String status;

    /**
     * 备注
     */
    private String remark;

    /**
     * 角色组
     */
    @Size(min = 1, message = "{user.role.not.null}")
    private Long[] roleIds;

    /**
     * 岗位组
     */
    private Long[] postIds;

    /**
     * 数据权限 当前角色ID
     */
    private Long roleId;

    /**
     * 用户ID
     */
    private String userIds;

    /**
     * 排除不查询的用户(工作流用)
     */
    private String excludeUserIds;

    /**
     * 创建者
     */
    private Long createBy;

    /**
     * 更新者
     */
    private Long updateBy;

    /**
     * 请求参数
     */
    private Map<String, Object> params = new HashMap<>();

    /**
     * 判断当前用户是否为超级管理员。
     *
     * @return true 是超级管理员 false 不是超级管理员
     */
    public boolean isSuperAdmin() {
        return SystemConstants.SUPER_ADMIN_USER_ID.equals(this.userId);
    }

}
