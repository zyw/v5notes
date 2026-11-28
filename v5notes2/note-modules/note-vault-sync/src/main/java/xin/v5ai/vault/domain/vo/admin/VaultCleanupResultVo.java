package xin.v5ai.vault.domain.vo.admin;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 存储维护清理结果（P2）。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VaultCleanupResultVo {

    private long deletedCount;

    private long freedBytes;

    private long failedCount;
}
