package xin.v5ai.notes.domain.vo.dashboard;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 首页系统脉搏区块（与 kpi 中的同名指标保持同源同值）
 *
 * @author v5notes2
 */
@Data
public class DashboardSystemVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 近 24 小时操作成功率（%）
     */
    private Double successRate = 0.0;

    /**
     * 近 24 小时操作耗时 P95（毫秒）
     */
    private Long p95ms = 0L;

    /**
     * 缓存命中率（%）
     */
    private Double cacheHit = 0.0;

    /**
     * 当前在线会话数
     */
    private Long online = 0L;

    /**
     * 今日操作日志条数
     */
    private Long operlogToday = 0L;
}
