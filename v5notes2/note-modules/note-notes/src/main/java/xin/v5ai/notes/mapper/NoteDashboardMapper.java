package xin.v5ai.notes.mapper;

import org.apache.ibatis.annotations.Param;
import xin.v5ai.notes.domain.vo.dashboard.DashboardDirVo;
import xin.v5ai.notes.domain.vo.dashboard.DashboardKpiVo;
import xin.v5ai.notes.domain.vo.dashboard.DashboardNameValueVo;
import xin.v5ai.notes.domain.vo.dashboard.DashboardRecentNoteVo;
import xin.v5ai.notes.domain.vo.dashboard.DashboardStorageVo;
import xin.v5ai.notes.domain.vo.dashboard.DashboardTrendVo;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 首页聚合统计 Mapper
 * <p>
 * <b>本接口刻意不标注 {@code @DataPermission}</b>：首页是全平台口径，复用
 * {@link NoteNotesMapper} / {@link NoteDirectoryMapper} 会被拼上「本部门 / 本人」条件导致数字偏小。
 * <p>
 * 同样因为手写 XML，逻辑删除必须自己写 {@code del_flag}：
 * note_notes / note_directory / basics_file 是 '0' 存在、'2' 删除，
 * sys_user 是 '0' 存在、'1' 删除，不可混用。
 * <p>
 * 说明：为了不引入一堆只用于承载单行聚合结果的中间类，下列返回 {@link DashboardKpiVo} 的语句
 * 只填充各自负责的字段，其余字段保持 VO 中的默认值 0。
 *
 * @author v5notes2
 */
public interface NoteDashboardMapper {

    /**
     * 笔记规模：notes / notesDelta7d / notesToday
     *
     * @param d7    近 7 天起点（今日 - 6 天的 00:00）
     * @param today 今日 00:00
     * @return 只含笔记规模字段的 KPI
     */
    DashboardKpiVo selectNoteStat(@Param("d7") LocalDateTime d7, @Param("today") LocalDateTime today);

    /**
     * 目录规模：dirs / emptyDirs
     *
     * @return 只含目录规模字段的 KPI
     */
    DashboardKpiVo selectDirStat();

    /**
     * 笔记编辑动作次数（sys_oper_log 中 title='笔记' 且 business_type=2）
     *
     * @param from 起始时间（含）
     * @param to   结束时间（不含）
     * @return 动作次数
     */
    Long selectEditCount(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /**
     * 用户规模：users / usersNewWeek
     *
     * @param weekStart 本周一 00:00
     * @return 只含用户规模字段的 KPI
     */
    DashboardKpiVo selectUserStat(@Param("weekStart") LocalDateTime weekStart);

    /**
     * 近 7 天有编辑行为的去重用户数
     *
     * @param from 起始时间（含）
     * @param to   结束时间（不含）
     * @return 去重用户数
     */
    Long selectActiveUserCount(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /**
     * 成功登录次数
     *
     * @param from 起始时间（含）
     * @param to   结束时间（不含）
     * @return 登录次数
     */
    Long selectLoginCount(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /**
     * 文件规模：files / storageGB / avgFileMB
     *
     * @return 只含文件规模字段的 KPI
     */
    DashboardKpiVo selectFileStat();

    /**
     * 操作日志条数
     *
     * @param from 起始时间（含）
     * @param to   结束时间（不含）
     * @return 条数
     */
    Long selectOperLogCount(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /**
     * 操作成功率（%），操作日志口径
     *
     * @param from 起始时间（含）
     * @param to   结束时间（不含）
     * @return 成功率，无数据时为 null
     */
    Double selectOperLogSuccessRate(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /**
     * 操作耗时 P95（毫秒），MySQL 8 窗口函数实现
     *
     * @param from 起始时间（含）
     * @param to   结束时间（不含）
     * @return P95 耗时，无数据时为 null
     */
    Long selectOperLogP95(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /**
     * 每日新增 / 编辑趋势，只返回有数据的日期，补零由 Service 完成
     *
     * @param from 起始时间（含）
     * @param to   结束时间（不含）
     * @return 行内 date 为 yyyy-MM-dd，created / edited 为当日计数
     */
    List<DashboardTrendVo> selectTrend(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /**
     * 笔记按直属目录的完整分布（不递归子目录），供 Service 取 Top N 并合并「其他目录」
     *
     * @param d7 近 7 天起点
     * @return 按笔记数倒序的全量分布
     */
    List<DashboardDirVo> selectDirDistribution(@Param("d7") LocalDateTime d7);

    /**
     * 登录设备构成
     *
     * @param from 起始时间（含）
     * @param to   结束时间（不含）
     * @return 按登录次数倒序
     */
    List<DashboardNameValueVo> selectDeviceDistribution(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /**
     * 附件按 MIME 大类构成
     *
     * @return 行内 size 为未取整的 GB 值，取整与守恒由 Service 完成
     */
    List<DashboardStorageVo> selectStorageDistribution();

    /**
     * 最近更新的笔记
     *
     * @param limit 条数
     * @return 按更新时间倒序
     */
    List<DashboardRecentNoteVo> selectRecentNotes(@Param("limit") int limit);
}
