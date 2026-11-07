package xin.v5ai.notes.domain.vo.dashboard;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 首页通用的「名称 - 数值」项，用于设备构成等环形图
 *
 * @author v5notes2
 */
@Data
public class DashboardNameValueVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 名称
     */
    private String name;

    /**
     * 数值
     */
    private Long value = 0L;
}
