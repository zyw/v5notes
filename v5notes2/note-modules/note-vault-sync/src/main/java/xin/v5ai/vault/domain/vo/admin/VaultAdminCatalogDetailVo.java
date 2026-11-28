package xin.v5ai.vault.domain.vo.admin;

import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 管理端扩展目录详情（含包内文件与 CSS 校验提示，P3）。
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class VaultAdminCatalogDetailVo extends VaultAdminCatalogItemVo {

    private Map<String, String> files = new LinkedHashMap<>();

    private List<String> warnings = new ArrayList<>();
}
