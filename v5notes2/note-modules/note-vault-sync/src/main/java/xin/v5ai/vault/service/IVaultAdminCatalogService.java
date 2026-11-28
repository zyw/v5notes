package xin.v5ai.vault.service;

import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.vault.domain.bo.admin.VaultCatalogSaveBo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminCatalogDetailVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminCatalogItemVo;
import xin.v5ai.vault.domain.vo.admin.VaultCatalogZipPreviewVo;

import java.io.InputStream;

/**
 * 管理端 Vault 扩展与主题目录维护服务（P3）。
 */
public interface IVaultAdminCatalogService {

    PageResult<VaultAdminCatalogItemVo> list(String kind, String status, String keyword, PageQuery pageQuery);

    VaultAdminCatalogDetailVo detail(String id);

    VaultCatalogZipPreviewVo parseZip(InputStream input);

    VaultAdminCatalogDetailVo create(VaultCatalogSaveBo bo);

    VaultAdminCatalogDetailVo update(String id, VaultCatalogSaveBo bo);

    void updateStatus(String id, String status);

    void delete(String id);
}
