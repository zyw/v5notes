package xin.v5ai.notes.domain.vo.dashboard;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 首页 KPI 区块
 * <p>
 * 所有字段都有默认值 0，保证空库 / 降级时接口不返回 null 字段。
 *
 * @author v5notes2
 */
@Data
public class DashboardKpiVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 笔记总数（note_notes.del_flag='0'）
     */
    private Long notes = 0L;

    /**
     * 近 7 天新增笔记数
     */
    private Long notesDelta7d = 0L;

    /**
     * 近 7 天新增 / 期初存量 × 100，保留 1 位小数
     */
    private Double notesDeltaPct = 0.0;

    /**
     * 目录总数（note_directory.del_flag='0'）
     */
    private Long dirs = 0L;

    /**
     * 空目录数（无直属笔记）
     */
    private Long emptyDirs = 0L;

    /**
     * 今日新增笔记数
     */
    private Long notesToday = 0L;

    /**
     * 今日编辑次数（sys_oper_log：title='笔记' 且 business_type=2）
     */
    private Long editsToday = 0L;

    /**
     * 用户总数（sys_user.del_flag='0'）
     */
    private Long users = 0L;

    /**
     * 近 7 天新增用户数
     */
    private Long usersNewWeek = 0L;

    /**
     * 近 7 天有编辑行为的去重用户数
     */
    private Long activeUsers7d = 0L;

    /**
     * 当前在线会话数（Sa-Token 有效 token）
     */
    private Long online = 0L;

    /**
     * 今日成功登录次数（sys_login_info.status='0'）
     */
    private Long loginsToday = 0L;

    /**
     * 文件数（basics_file.del_flag='0'）
     */
    private Long files = 0L;

    /**
     * 总容量，单位 GB，保留 1 位小数
     */
    private Double storageGB = 0.0;

    /**
     * 平均单文件大小，单位 MB，保留 1 位小数
     */
    private Double avgFileMB = 0.0;

    /**
     * 近 24 小时操作成功率（%），保留 2 位小数
     */
    private Double successRate = 0.0;

    /**
     * 近 24 小时操作耗时 P95（毫秒）
     */
    private Long p95ms = 0L;

    /**
     * 缓存命中率（%），取自 Redis INFO stats，不可用时为 0
     */
    private Double cacheHit = 0.0;

    /**
     * 今日操作日志条数
     */
    private Long operlogToday = 0L;
}
