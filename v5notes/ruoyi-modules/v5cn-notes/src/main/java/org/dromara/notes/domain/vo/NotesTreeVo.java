package org.dromara.notes.domain.vo;

import lombok.Data;

import java.io.Serializable;
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

    private List<NotesTreeVo> children;

}
