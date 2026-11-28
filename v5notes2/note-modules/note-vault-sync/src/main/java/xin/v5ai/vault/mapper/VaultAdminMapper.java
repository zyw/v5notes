package xin.v5ai.vault.mapper;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Param;
import xin.v5ai.vault.domain.vo.admin.VaultAdminAssetVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminReplicaVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminSpaceVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminStorageRankVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminUserQuotaVo;

import java.util.Date;
import java.util.List;
import java.util.Map;

/**
 * 管理端 Vault 同步聚合查询 Mapper。
 */
public interface VaultAdminMapper {

    Map<String, Object> selectOverviewCounts(@Param("defaultQuotaBytes") long defaultQuotaBytes);

    List<Map<String, Object>> selectChangeTrend(@Param("since") Date since);

    Page<VaultAdminStorageRankVo> selectStorageRank(Page<VaultAdminStorageRankVo> page,
                                                    @Param("defaultQuotaBytes") long defaultQuotaBytes);

    Page<VaultAdminSpaceVo> selectSpacePage(Page<VaultAdminSpaceVo> page,
                                            @Param("keyword") String keyword,
                                            @Param("name") String name,
                                            @Param("status") String status,
                                            @Param("defaultQuotaBytes") long defaultQuotaBytes,
                                            @Param("defaultReplicaLimit") int defaultReplicaLimit);

    VaultAdminSpaceVo selectSpaceById(@Param("vaultId") Long vaultId,
                                      @Param("defaultQuotaBytes") long defaultQuotaBytes,
                                      @Param("defaultReplicaLimit") int defaultReplicaLimit);

    Page<VaultAdminReplicaVo> selectReplicaPage(Page<VaultAdminReplicaVo> page,
                                                @Param("vaultId") Long vaultId,
                                                @Param("keyword") String keyword,
                                                @Param("deviceId") String deviceId,
                                                @Param("inactiveBefore") Date inactiveBefore);

    Page<VaultAdminAssetVo> selectAssetPage(Page<VaultAdminAssetVo> page,
                                            @Param("vaultId") Long vaultId,
                                            @Param("keyword") String keyword);

    List<Map<String, Object>> selectSysConfigsByPrefix(@Param("prefix") String prefix);

    int updateSysConfigValue(@Param("configKey") String configKey, @Param("configValue") String configValue);

    long existsUserById(@Param("userId") Long userId);

    Page<VaultAdminUserQuotaVo> selectUserQuotaPage(Page<VaultAdminUserQuotaVo> page,
                                                    @Param("keyword") String keyword,
                                                    @Param("defaultQuotaBytes") long defaultQuotaBytes,
                                                    @Param("defaultReplicaLimit") int defaultReplicaLimit,
                                                    @Param("defaultMaxFileBytes") long defaultMaxFileBytes);

    long selectExpiredTombstoneCount(@Param("cutoff") Date cutoff);

    int deleteExpiredTombstones(@Param("cutoff") Date cutoff);

    Map<String, Object> selectOrphanAssetStats(@Param("cutoff") Date cutoff);

    List<Map<String, Object>> selectOrphanAssetCandidates(@Param("cutoff") Date cutoff, @Param("limit") int limit);
}
