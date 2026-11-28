package xin.v5ai.vault.domain.vo.admin;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 同步变更按日趋势点。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VaultAdminTrendPointVo {

    private String day;

    private long upsertCount;

    private long deleteCount;

    private long renameCount;
}
