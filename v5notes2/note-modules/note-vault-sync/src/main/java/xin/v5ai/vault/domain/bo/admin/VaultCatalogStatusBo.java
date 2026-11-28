package xin.v5ai.vault.domain.bo.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

/**
 * 管理端扩展上下架切换请求（P3）。
 */
@Data
public class VaultCatalogStatusBo {

    @NotBlank(message = "状态不能为空")
    @Pattern(regexp = "^[12]$", message = "状态仅支持 1(上架) 或 2(下架)")
    private String status;
}
