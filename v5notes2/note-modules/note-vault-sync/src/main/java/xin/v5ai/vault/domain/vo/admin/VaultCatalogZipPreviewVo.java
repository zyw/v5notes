package xin.v5ai.vault.domain.vo.admin;

import lombok.Data;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 上传 .zip 扩展包解析结果预览（P3）。
 */
@Data
public class VaultCatalogZipPreviewVo {

    private String id;

    private String name;

    private String kind;

    private String version;

    private String minAppVersion;

    private String description;

    private String author;

    private String authorUrl;

    private List<String> permissions = new ArrayList<>();

    private List<String> networkAllowlist = new ArrayList<>();

    private List<String> tags = new ArrayList<>();

    private Map<String, String> files = new LinkedHashMap<>();

    private List<String> warnings = new ArrayList<>();
}
