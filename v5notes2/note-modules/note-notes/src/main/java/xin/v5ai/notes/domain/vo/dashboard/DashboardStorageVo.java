package xin.v5ai.notes.domain.vo.dashboard;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 首页存储构成项（按 MIME 大类）
 *
 * @author v5notes2
 */
@Data
public class DashboardStorageVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 类型名称：图片 / 视频 / 音频 / 文档 / 压缩包 / 其他
     */
    private String name;

    /**
     * 该类型占用容量，单位 GB，保留 1 位小数
     */
    private Double size = 0.0;

    /**
     * 该类型文件数
     */
    private Long count = 0L;
}
