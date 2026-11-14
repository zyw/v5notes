package xin.v5ai.vault.domain.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class VaultSpaceVo {

    /** Snowflake id as string. */
    private String vaultId;

    private String name;

    private Long usedBytes;

    private Boolean empty;

    private LocalDateTime createdAt;
}
