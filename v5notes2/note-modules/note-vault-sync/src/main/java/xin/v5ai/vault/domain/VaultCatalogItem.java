package xin.v5ai.vault.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.Date;

/**
 * Vault 官方扩展与主题目录实体（P3，设计 §3.5 / §4.1）。
 */
@Data
@TableName("vault_catalog_item")
public class VaultCatalogItem implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.INPUT)
    private String id;

    private String name;

    /** plugin | theme */
    private String kind;

    private String version;

    private String minAppVersion;

    private String description;

    private String author;

    private String authorUrl;

    private String permissionsJson;

    private String allowlistJson;

    private String tagsJson;

    private String filesJson;

    /** 0草稿 1已上架 2已下架 */
    private String status;

    private Integer sortOrder;

    private Long createBy;

    private Date createTime;

    private Long updateBy;

    private Date updateTime;
}
