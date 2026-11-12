package xin.v5ai.notes.domain.vo;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 当前用户的云服务额度。
 * <p>limited 为 false 时表示不受试用限制（如管理端创建的无限制用户）。
 * planName / planExpireAt 预留给后续付费套餐，当前可为空。
 */
@Data
public class ClientQuotaVo {

    private boolean limited;

    private boolean expired;

    private long usedBytes;

    private long noteBytes;

    private long fileBytes;

    private long quotaBytes;

    /** 试用结束时间；仅 limited 用户有值 */
    private LocalDateTime expireAt;

    /** 当前套餐名称；未开通付费套餐时为空 */
    private String planName;

    /** 套餐服务结束时间 */
    private LocalDateTime planExpireAt;
}
