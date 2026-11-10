package xin.v5ai.system.domain.bo;

import io.github.linpeilie.annotations.AutoMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;
import xin.v5ai.system.domain.SysPost;

import java.io.Serial;
import java.io.Serializable;
import java.util.HashMap;
import java.util.Map;

/**
 * 岗位信息业务对象 sys_post
 *
 * @author Michelle.Chung
 */

@Data
@AutoMapper(target = SysPost.class, reverseConvertGenerate = false)
public class SysPostBo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 岗位ID
     */
    private Long postId;

    /**
     * 部门id（单部门）
     */
    @NotNull(message = "{post.dept.not.null}")
    private Long deptId;

    /**
     * 归属部门id（部门树）
     */
    private Long belongDeptId;

    /**
     * 岗位编码
     */
    @NotBlank(message = "{post.code.not.blank}")
    @Size(min = 0, max = 64, message = "{post.code.length}")
    private String postCode;

    /**
     * 岗位名称
     */
    @NotBlank(message = "{post.name.not.blank}")
    @Size(min = 0, max = 50, message = "{post.name.length}")
    private String postName;

    /**
     * 岗位类别编码
     */
    @Size(min = 0, max = 100, message = "{post.category.length}")
    private String postCategory;

    /**
     * 显示顺序
     */
    @NotNull(message = "{dept.order.not.null}")
    private Integer postSort;

    /**
     * 状态（0正常 1停用）
     */
    private String status;

    /**
     * 备注
     */
    private String remark;

    /**
     * 请求参数
     */
    private Map<String, Object> params = new HashMap<>();

}
