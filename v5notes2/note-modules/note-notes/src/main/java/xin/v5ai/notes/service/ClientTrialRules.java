package xin.v5ai.notes.service;

import java.time.LocalDateTime;

/**
 * 试用是否已经结束。时长和空间只要有一项超过即结束。
 */
public final class ClientTrialRules {

    private ClientTrialRules() {
    }

    public static boolean exceeded(LocalDateTime createTime, int trialDays, long usedBytes,
                                   long additionalBytes, long quotaBytes, LocalDateTime now) {
        long extra = Math.max(additionalBytes, 0);
        boolean timeOver = createTime != null && !now.isBefore(createTime.plusDays(Math.max(trialDays, 0)));
        boolean spaceOver = usedBytes + extra > quotaBytes;
        return timeOver || spaceOver;
    }
}
