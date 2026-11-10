package xin.v5ai.system.controller.system;

import xin.v5ai.common.core.utils.MessageUtils;
import cn.dev33.satoken.annotation.SaCheckPermission;
import cn.hutool.core.convert.Convert;
import lombok.RequiredArgsConstructor;
import xin.v5ai.common.core.constant.SystemConstants;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.core.utils.StringUtils;
import xin.v5ai.common.log.annotation.Log;
import xin.v5ai.common.log.enums.BusinessType;
import xin.v5ai.common.redis.annotation.RepeatSubmit;
import xin.v5ai.common.web.core.BaseController;
import xin.v5ai.system.domain.bo.SysDeptBo;
import xin.v5ai.system.domain.vo.SysDeptVo;
import xin.v5ai.system.service.ISysDeptService;
import xin.v5ai.system.service.ISysPostService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 部门信息
 *
 * @author Lion Li
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/system/dept")
public class SysDeptController extends BaseController {

    private final ISysDeptService deptService;
    private final ISysPostService postService;

    /**
     * 查询部门列表。
     *
     * @param dept 查询条件
     * @return 部门列表
     */
    @SaCheckPermission("system:dept:list")
    @GetMapping("/list")
    public R<List<SysDeptVo>> list(SysDeptBo dept) {
        List<SysDeptVo> depts = deptService.selectDeptList(dept);
        return R.ok(depts);
    }

    /**
     * 查询部门列表（排除节点）
     *
     * @param deptId 部门ID
     * @return 过滤后的部门列表
     */
    @SaCheckPermission("system:dept:list")
    @GetMapping("/list/exclude/{deptId}")
    public R<List<SysDeptVo>> excludeChild(@PathVariable(value = "deptId") Long deptId) {
        List<SysDeptVo> depts = deptService.selectDeptList(new SysDeptBo());
        depts.removeIf(d -> d.getDeptId().equals(deptId)
            || StringUtils.splitList(d.getAncestors()).contains(Convert.toStr(deptId)));
        return R.ok(depts);
    }

    /**
     * 根据部门编号获取详细信息
     *
     * @param deptId 部门ID
     * @return 部门详情
     */
    @SaCheckPermission("system:dept:query")
    @GetMapping(value = "/{deptId}")
    public R<SysDeptVo> getInfo(@PathVariable Long deptId) {
        deptService.checkDeptDataScope(deptId);
        return R.ok(deptService.selectDeptById(deptId));
    }

    /**
     * 新增部门。
     *
     * @param dept 部门参数
     * @return 操作结果
     */
    @SaCheckPermission("system:dept:add")
    @Log(title = "部门管理", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping
    public R<Void> add(@Validated @RequestBody SysDeptBo dept) {
        if (!deptService.checkDeptNameUnique(dept)) {
            return R.fail(MessageUtils.message("dept.add.exists", dept.getDeptName()));
        }
        return toAjax(deptService.insertDept(dept));
    }

    /**
     * 修改部门。
     *
     * @param dept 部门参数
     * @return 操作结果
     */
    @SaCheckPermission("system:dept:edit")
    @Log(title = "部门管理", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping
    public R<Void> edit(@Validated @RequestBody SysDeptBo dept) {
        Long deptId = dept.getDeptId();
        deptService.checkDeptDataScope(deptId);
        if (!deptService.checkDeptNameUnique(dept)) {
            return R.fail(MessageUtils.message("dept.edit.exists", dept.getDeptName()));
        } else if (dept.getParentId().equals(deptId)) {
            return R.fail(MessageUtils.message("dept.edit.self", dept.getDeptName()));
        } else if (StringUtils.equals(SystemConstants.DISABLE, dept.getStatus())) {
            if (deptService.selectNormalChildrenDeptById(deptId) > 0) {
                return R.fail(MessageUtils.message("dept.disable.children"));
            } else if (deptService.checkDeptExistUser(deptId)) {
                return R.fail(MessageUtils.message("dept.disable.assigned"));
            }
        }
        return toAjax(deptService.updateDept(dept));
    }

    /**
     * 删除部门
     *
     * @param deptId 部门ID
     * @return 操作结果
     */
    @SaCheckPermission("system:dept:remove")
    @Log(title = "部门管理", businessType = BusinessType.DELETE)
    @DeleteMapping("/{deptId}")
    public R<Void> remove(@PathVariable Long deptId) {
        if (SystemConstants.DEFAULT_DEPT_ID.equals(deptId)) {
            return R.warn(MessageUtils.message("dept.delete.default"));
        }
        if (deptService.hasChildByDeptId(deptId)) {
            return R.warn(MessageUtils.message("dept.delete.children"));
        }
        if (deptService.checkDeptExistUser(deptId)) {
            return R.warn(MessageUtils.message("dept.delete.users"));
        }
        if (postService.countPostByDeptId(deptId) > 0) {
            return R.warn(MessageUtils.message("dept.delete.posts"));
        }
        deptService.checkDeptDataScope(deptId);
        return toAjax(deptService.deleteDeptById(deptId));
    }

    /**
     * 获取部门选择框列表
     *
     * @param deptIds 部门ID串
     * @return 部门列表
     */
    @SaCheckPermission("system:dept:query")
    @GetMapping("/optionselect")
    public R<List<SysDeptVo>> optionselect(@RequestParam(required = false) Long[] deptIds) {
        return R.ok(deptService.selectDeptByIds(deptIds == null ? null : List.of(deptIds)));
    }

}
