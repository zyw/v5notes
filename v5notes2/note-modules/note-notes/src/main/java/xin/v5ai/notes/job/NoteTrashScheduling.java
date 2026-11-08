package xin.v5ai.notes.job;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 开启回收站到期清除。SnailJob 默认关闭时，应用自身仍要跑这个定时任务。
 */
@Configuration
@EnableScheduling
public class NoteTrashScheduling {
}
