package xin.v5ai.system.domain.bo;

import io.github.linpeilie.annotations.AutoMapper;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;
import xin.v5ai.system.domain.SysDept;

import java.io.Serial;
import java.io.Serializable;
import java.util.HashMap;
import java.util.Map;

/**
 * 部门业务对象 sys_dept
 *
 * @author Michelle.Chung
 */

@Data
@AutoMapper(target = SysDept.class, reverseConvertGenerate = false)
public class SysDeptBo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 部门id
     */
    private Long deptId;

    /**
     * 父部门ID
     */
    private Long parentId;

    /**
     * 部门名称
     */
    @NotBlank(message = "{dept.name.not.blank}")
    @Size(min = 0, max = 30, message = "{dept.name.length}")
    private String deptName;

    /**
     * 部门类别编码
     */
    @Size(min = 0, max = 100, message = "{dept.category.length}")
    private String deptCategory;

    /**
     * 显示顺序
     */
    @NotNull(message = "{dept.order.not.null}")
    private Integer orderNum;

    /**
     * 负责人
     */
    private Long leader;

    /**
     * 联系电话
     */
    @Size(min = 0, max = 11, message = "{dept.phone.length}")
    private String phone;

    /**
     * 邮箱
     */
    @Email(message = "{user.email.incorrect}")
    @Size(min = 0, max = 50, message = "{dept.email.length}")
    private String email;

    /**
     * 部门状态（0正常 1停用）
     */
    private String status;

    /**
     * 归属部门id（部门树）
     */
    private Long belongDeptId;

    /**
     * 请求参数
     */
    private Map<String, Object> params = new HashMap<>();

}
