package xin.v5ai.notes.domain.vo.dashboard;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 首页趋势图单点
 *
 * @author v5notes2
 */
@Data
public class DashboardTrendVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 日期，格式 MM/dd
     */
    private String date;

    /**
     * 当日新增笔记数
     */
    private Integer created = 0;

    /**
     * 当日编辑动作次数（sys_oper_log）
     */
    private Integer edited = 0;
}
