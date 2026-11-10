package xin.v5ai.notes.service;

import xin.v5ai.notes.domain.vo.dashboard.DashboardOverviewVo;

/**
 * 首页聚合统计服务
 *
 * @author v5notes2
 */
public interface INoteDashboardService {

    /**
     * 首页聚合统计
     *
     * @param range 趋势窗口天数，仅接受 7 / 30 / 90，其余按 30 处理
     * @return 完整结构的首页数据，任一区块失败被降级为空数组 + 对应 KPI 置 0，不会抛异常
     */
    DashboardOverviewVo overview(Integer range);
}
