package xin.v5ai.vault.domain.vo.admin;

import lombok.Data;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 * 管理端扩展目录列表项（不含 files 全文，P3）。
 */
@Data
public class VaultAdminCatalogItemVo {

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

    private String status;

    private int sortOrder;

    private int fileCount;

    private String packagePath;

    private Date createTime;

    private Date updateTime;
}
