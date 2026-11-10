package xin.v5ai.notes.job;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import xin.v5ai.notes.service.INoteTrashService;

/**
 * 每天 03:10 清除已到期的回收站记录。
 */
@Component
@RequiredArgsConstructor
public class NoteTrashPurgeJob {

    private final INoteTrashService noteTrashService;

    @Scheduled(cron = "0 10 3 * * ?")
    public void purgeExpiredTrash() {
        noteTrashService.purgeExpired();
    }
}
