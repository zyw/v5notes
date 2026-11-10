package xin.v5ai.system.controller.system;

import xin.v5ai.common.core.utils.MessageUtils;
import cn.hutool.core.bean.BeanUtil;
import cn.hutool.crypto.digest.BCrypt;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.core.utils.StringUtils;
import xin.v5ai.common.encrypt.annotation.ApiEncrypt;
import xin.v5ai.common.log.annotation.Log;
import xin.v5ai.common.log.enums.BusinessType;
import xin.v5ai.common.mybatis.helper.DataPermissionHelper;
import xin.v5ai.common.redis.annotation.RepeatSubmit;
import xin.v5ai.common.satoken.utils.LoginHelper;
import xin.v5ai.common.web.core.BaseController;
import xin.v5ai.system.domain.bo.SysUserBo;
import xin.v5ai.system.domain.bo.SysUserProfileBo;
import xin.v5ai.system.domain.vo.ProfileUserVo;
import xin.v5ai.system.domain.vo.SysUserVo;
import xin.v5ai.system.service.ISysUserService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/**
 * 个人信息 业务处理
 *
 * @author Lion Li
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/system/user/profile")
public class SysProfileController extends BaseController {

    private final ISysUserService userService;

    /**
     * 获取当前登录用户的个人中心信息。
     *
     * @return 用户信息、角色组和岗位组
     */
    @GetMapping
    public R<ProfileVo> profile() {
        SysUserVo user = userService.selectUserById(LoginHelper.getUserId());
        String roleGroup = userService.selectUserRoleGroup(user.getUserId());
        String postGroup = userService.selectUserPostGroup(user.getUserId());
        // 单独做一个vo专门给个人中心用 避免数据被脱敏
        ProfileUserVo profileUser = BeanUtil.toBean(user, ProfileUserVo.class);
        ProfileVo profileVo = new ProfileVo(profileUser, roleGroup, postGroup);
        return R.ok(profileVo);
    }

    /**
     * 修改当前登录用户的个人资料。
     *
     * @param profile 个人资料参数
     * @return 操作结果
     */
    @RepeatSubmit
    @Log(title = "个人信息", businessType = BusinessType.UPDATE)
    @PutMapping
    public R<Void> updateProfile(@Validated @RequestBody SysUserProfileBo profile) {
        SysUserBo user = BeanUtil.toBean(profile, SysUserBo.class);
        user.setUserId(LoginHelper.getUserId());
        String username = LoginHelper.getUsername();
        if (StringUtils.isNotEmpty(user.getPhoneNumber()) && !userService.checkPhoneUnique(user)) {
            return R.fail(MessageUtils.message("user.edit.phone.exists", username));
        }
        if (StringUtils.isNotEmpty(user.getEmail()) && !userService.checkEmailUnique(user)) {
            return R.fail(MessageUtils.message("user.edit.email.exists", username));
        }
        int rows = DataPermissionHelper.ignore(() -> userService.updateUserProfile(user));
        if (rows > 0) {
            return R.ok();
        }
        return R.fail(MessageUtils.message("user.profile.failed"));
    }

    /**
     * 重置密码
     *
     * @param bo 新旧密码
     * @return 操作结果
     */
    @RepeatSubmit
    @ApiEncrypt
    @Log(title = "个人信息", businessType = BusinessType.UPDATE)
    @PutMapping("/updatePwd")
    public R<Void> updatePwd(@Validated @RequestBody SysUserPasswordBo bo) {
        SysUserVo user = userService.selectUserById(LoginHelper.getUserId());
        String password = user.getPassword();
        if (!BCrypt.checkpw(bo.oldPassword(), password)) {
            return R.fail(MessageUtils.message("user.password.old.wrong"));
        }
        if (BCrypt.checkpw(bo.newPassword(), password)) {
            return R.fail(MessageUtils.message("user.password.same"));
        }
        int rows = DataPermissionHelper.ignore(() -> userService.resetUserPwd(user.getUserId(), BCrypt.hashpw(bo.newPassword())));
        if (rows > 0) {
            return R.ok();
        }
        return R.fail(MessageUtils.message("user.password.failed"));
    }

    /**
     * 用户个人信息
     *
     * @param user      用户信息
     * @param roleGroup 用户所属角色组
     * @param postGroup 用户所属岗位组
     */
    public record ProfileVo(ProfileUserVo user, String roleGroup, String postGroup) {
    }

    /**
     * 用户密码修改
     *
     * @param oldPassword 旧密码
     * @param newPassword 新密码
     */
    public record SysUserPasswordBo(
        @NotBlank(message = "{user.old.password.not.blank}") String oldPassword,
        @NotBlank(message = "{user.new.password.not.blank}") String newPassword) {
    }

}
