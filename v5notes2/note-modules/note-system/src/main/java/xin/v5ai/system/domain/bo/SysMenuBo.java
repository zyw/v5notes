package xin.v5ai.system.domain.bo;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.github.linpeilie.annotations.AutoMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import xin.v5ai.common.core.constant.RegexConstants;
import xin.v5ai.common.json.validate.JsonPattern;
import xin.v5ai.common.json.validate.JsonType;
import xin.v5ai.system.domain.SysMenu;

import java.io.Serial;
import java.io.Serializable;

/**
 * 菜单权限业务对象 sys_menu
 *
 * @author Michelle.Chung
 */

@Data
@AutoMapper(target = SysMenu.class, reverseConvertGenerate = false)
public class SysMenuBo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 菜单ID
     */
    private Long menuId;

    /**
     * 父菜单ID
     */
    private Long parentId;

    /**
     * 菜单名称
     */
    @NotBlank(message = "{menu.name.not.blank}")
    @Size(min = 0, max = 50, message = "{menu.name.length}")
    private String menuName;

    /**
     * 显示顺序
     */
    @NotNull(message = "{dept.order.not.null}")
    private Integer orderNum;

    /**
     * 路由地址
     */
    @Size(min = 0, max = 200, message = "{menu.path.length}")
    private String path;

    /**
     * 组件路径
     */
    @Size(min = 0, max = 200, message = "{menu.component.length}")
    private String component;

    /**
     * 路由参数
     */
    @JsonPattern(type = JsonType.OBJECT, message = "{menu.query.json}")
    private String queryParam;

    /**
     * 是否为外链（Y是 N否）
     */
    private String isFrame;

    /**
     * 是否缓存（Y缓存 N不缓存）
     */
    private String isCache;

    /**
     * 菜单类型（M目录 C菜单 F按钮）
     */
    @NotBlank(message = "{menu.type.not.blank}")
    private String menuType;

    /**
     * 显示状态（0显示 1隐藏）
     */
    private String visible;

    /**
     * 菜单状态（0正常 1停用）
     */
    private String status;

    /**
     * 权限标识
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @Size(min = 0, max = 100, message = "{menu.perms.length}")
    @Pattern(regexp = RegexConstants.PERMISSION_STRING, message = "{menu.perms.pattern}")
    private String perms;

    /**
     * 菜单图标
     */
    private String icon;

    /**
     * 激活菜单路径
     */
    @Size(min = 0, max = 255, message = "{menu.active.length}")
    private String activeMenu;

    /**
     * 扩展字段
     */
    @Size(min = 0, max = 2000, message = "{menu.ext.length}")
    private String ext;

    /**
     * 备注
     */
    private String remark;

}
