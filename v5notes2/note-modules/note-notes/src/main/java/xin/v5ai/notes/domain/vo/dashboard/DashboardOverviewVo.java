package xin.v5ai.notes.domain.vo.dashboard;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.List;

/**
 * 首页聚合接口响应体
 * <p>
 * 结构与 {@code v5notes-admin2/design-demos/home/data/api-contract.md} 一一对应，
 * 不得增删字段；数组字段在无数据时返回空数组，数值字段返回 0，不返回 null。
 *
 * @author v5notes2
 */
@Data
public class DashboardOverviewVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 趋势窗口天数：7 / 30 / 90，非法入参按 30 处理
     */
    private Integer range = 30;

    /**
     * 数据生成时间，ISO-8601 带时区（如 2026-11-07T15:55:47+08:00），前端显示「数据截至」。
     * <p>
     * 刻意用 String 而不是 LocalDateTime：本对象会被 {@code @Cacheable} 写入 Redis，
     * Redisson 的 Jackson 编解码器只认全局日期格式，字段级 {@code @JsonSerialize} 没有配对的
     * 反序列化器，回读时会抛 {@code InvalidFormatException}。用 String 让缓存往返无损。
     */
    private String generatedAt;

    /**
     * 规模 KPI
     */
    private DashboardKpiVo kpi;

    /**
     * 每日新增 / 编辑趋势，长度 = range，按日期升序，最后一项是今天
     */
    private List<DashboardTrendVo> trend;

    /**
     * 笔记数最多的 8 个目录 + 「其他目录」，notes 合计 = kpi.notes
     */
    private List<DashboardDirVo> dirTop;

    /**
     * 近 7 天登录次数按客户端构成
     */
    private List<DashboardNameValueVo> device;

    /**
     * 附件按类型构成，size 合计 = kpi.storageGB
     */
    private List<DashboardStorageVo> storage;

    /**
     * 最近更新的 6 篇笔记
     */
    private List<DashboardRecentNoteVo> recentNotes;

    /**
     * 系统脉搏
     */
    private DashboardSystemVo system;
}