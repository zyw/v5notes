package xin.v5ai.vault.domain.vo;

import lombok.Data;

import java.util.Date;

/**
 * Phase 5 stub for optional version history (design §8.3 / Phase 5).
 * Full retention is deferred; API returns an empty list until implemented.
 */
@Data
public class VaultFileVersionVo {

    private String fileId;

    private long rev;

    private String contentHash;

    private long size;

    private Date capturedAt;
}
