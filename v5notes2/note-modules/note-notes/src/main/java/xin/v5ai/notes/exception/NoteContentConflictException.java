package xin.v5ai.notes.exception;

import lombok.Getter;

import java.time.LocalDateTime;

/**
 * 客户端持有的正文哈希与库中当前正文不一致。
 */
@Getter
public class NoteContentConflictException extends RuntimeException {

    private final String contentHash;

    private final LocalDateTime updateTime;

    public NoteContentConflictException(String contentHash, LocalDateTime updateTime) {
        super("笔记已在其他地方保存，请查看历史或重新加载后再保存");
        this.contentHash = contentHash;
        this.updateTime = updateTime;
    }
}
