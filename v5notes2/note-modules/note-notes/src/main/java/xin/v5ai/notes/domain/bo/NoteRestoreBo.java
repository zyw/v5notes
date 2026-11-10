package xin.v5ai.notes.domain.bo;

import lombok.Data;

/**
 * 恢复某一版正文。
 */
@Data
public class NoteRestoreBo {

    /**
     * 打开笔记或上次保存时的正文哈希。
     */
    private String baseHash;

    /**
     * 为 true 时忽略哈希不一致，仍先补记库中正文。
     */
    private Boolean force;
}
