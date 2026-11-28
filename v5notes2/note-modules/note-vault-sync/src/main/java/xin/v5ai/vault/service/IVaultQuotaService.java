package xin.v5ai.vault.service;

import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.vault.domain.bo.admin.VaultQuotaPolicyBo;
import xin.v5ai.vault.domain.bo.admin.VaultUserQuotaBo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminUserQuotaVo;
import xin.v5ai.vault.domain.vo.admin.VaultQuotaPolicyVo;
import xin.v5ai.vault.service.model.ResolvedVaultQuota;

/**
 * Vault 同步两层配额服务：全局默认策略（sys_config）+ 用户级覆盖（vault_user_quota）。
 */
public interface IVaultQuotaService {

    VaultQuotaPolicyVo getPolicy();

    VaultQuotaPolicyVo updatePolicy(VaultQuotaPolicyBo bo);

    ResolvedVaultQuota resolveForUser(Long userId);

    PageResult<VaultAdminUserQuotaVo> listUserQuotas(String keyword, PageQuery pageQuery);

    void upsertUserQuota(Long userId, VaultUserQuotaBo bo);

    void deleteUserQuota(Long userId);
}
