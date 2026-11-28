package xin.v5ai.vault.domain.bo.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 管理端新增/编辑官方扩展目录请求（P3）。
 */
@Data
public class VaultCatalogSaveBo {

    @NotBlank(message = "扩展 ID 不能为空")
    @Pattern(regexp = "^[a-z0-9-]+$", message = "扩展 ID 仅允许小写字母、数字与连字符")
    @Size(max = 64, message = "扩展 ID 长度不能超过 64")
    private String id;

    @NotBlank(message = "扩展名称不能为空")
    @Size(max = 100, message = "扩展名称长度不能超过 100")
    private String name;

    @NotBlank(message = "扩展类型不能为空")
    @Pattern(regexp = "^(plugin|theme)$", message = "扩展类型仅支持 plugin 或 theme")
    private String kind;

    @NotBlank(message = "版本号不能为空")
    @Size(max = 32, message = "版本号长度不能超过 32")
    private String version;

    @Size(max = 32, message = "最低客户端版本长度不能超过 32")
    private String minAppVersion;

    @Size(max = 500, message = "简介长度不能超过 500")
    private String description;

    @Size(max = 100, message = "作者长度不能超过 100")
    private String author;

    @Size(max = 255, message = "作者链接长度不能超过 255")
    private String authorUrl;

    private List<String> permissions = new ArrayList<>();

    private List<String> networkAllowlist = new ArrayList<>();

    private List<String> tags = new ArrayList<>();

    @NotEmpty(message = "包内文件不能为空")
    private Map<String, String> files = new LinkedHashMap<>();

    private Integer sortOrder = 0;
}
