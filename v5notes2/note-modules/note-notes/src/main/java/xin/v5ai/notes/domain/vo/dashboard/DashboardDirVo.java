package xin.v5ai.notes.domain.vo.dashboard;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 首页目录分布项（Top N 目录 + 「其他目录」兜底）
 *
 * @author v5notes2
 */
@Data
public class DashboardDirVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 目录名称（无目录 / 目录已删为「未归类」，兜底项为「其他目录」）
     */
    private String name;

    /**
     * 该目录直属笔记数
     */
    private Long notes = 0L;

    /**
     * 该目录近 7 天有更新的笔记数
     */
    private Long active7d = 0L;
}
