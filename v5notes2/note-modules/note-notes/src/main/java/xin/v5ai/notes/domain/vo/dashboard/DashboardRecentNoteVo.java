package xin.v5ai.notes.domain.vo.dashboard;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 首页最近更新笔记
 *
 * @author v5notes2
 */
@Data
public class DashboardRecentNoteVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 笔记ID，雪花 ID 一律字符串，前端不做 Number 转换
     */
    private String id;

    /**
     * 笔记名称
     */
    private String name;

    /**
     * 所属目录名称
     */
    private String dirName;

    /**
     * 最后编辑人昵称
     */
    private String authorName;

    /**
     * 正文字符数（CHAR_LENGTH）
     */
    private Long chars = 0L;

    /**
     * 最后更新时间，ISO-8601 带时区（由 SQL 直接格式化，避免缓存往返反序列化问题）
     */
    private String updatedAt;
}