package xin.v5ai.notes.domain.vo;

import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class NotesTreeVo implements Serializable {

    private Long id;

    /**
     * 父节点ID
     */
    private Long pid;

    /**
     * 节点名称
     */
    private String label;

    /**
     * 节点类型，1：目录，2：笔记
     */
    private Integer type;

    /**
     * 最近更新时间。目录和笔记都带上，供客户端按最近更新排序。
     */
    private LocalDateTime updateTime;

    private List<NotesTreeVo> children;

}
