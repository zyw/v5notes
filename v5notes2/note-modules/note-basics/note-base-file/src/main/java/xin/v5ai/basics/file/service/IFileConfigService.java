package xin.v5ai.basics.file.service;

import xin.v5ai.basics.file.core.client.FileClient;
import xin.v5ai.basics.file.core.enums.FileConfigPurpose;
import xin.v5ai.basics.file.domain.bo.FileConfigBo;
import xin.v5ai.basics.file.domain.bo.FileConfigSearchBo;
import xin.v5ai.basics.file.domain.vo.FileConfigVo;
import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.mybatis.core.page.PageQuery;

import java.util.Collection;
import java.util.List;

/**
 * 文件配置Service接口
 *
 * @author ZYW
 * @date 2024-04-10
 */
public interface IFileConfigService {

    /**
     * 查询文件配置
     */
    FileConfigVo queryById(Long id);

    /**
     * 查询文件配置列表
     */
    PageResult<FileConfigVo> queryPageList(FileConfigSearchBo bo, PageQuery pageQuery);

    /**
     * 查询文件配置列表
     */
    List<FileConfigVo> queryList(FileConfigSearchBo bo);

    FileClient getMasterFileClient();

    /**
     * 按用途取文件客户端（设计 D2）。
     *
     * <p>{@link #getMasterFileClient()} 的选路规则保持不变：图片库/头像仍取 {@code master=true} 那条。
     * 同步附件走这里，两者互不影响。</p>
     *
     * @param purpose 用途
     * @return 该用途下唯一启用配置对应的客户端
     * @throws xin.v5ai.common.core.exception.ServiceException 该用途未配置或配置了多条
     */
    FileClient getByPurpose(FileConfigPurpose purpose);

    /**
     * 新增文件配置
     */
    Boolean insertByBo(FileConfigBo bo);

    /**
     * 修改文件配置
     */
    Boolean updateByBo(FileConfigBo bo);

    /**
     * 更新文件配置主节点，将其他节点的主节点设置为非主节点
     * @param id 文件配置ID
     */
    Boolean updateFileConfigMaster(Long id);

    /**
     * 把指定配置接管某个用途（设计 §7.5「切换用途指针」）。
     *
     * <p>原子地完成两步：目标配置的用途改为 {@code purpose}，原先占用该用途的配置改回
     * {@code GENERIC} 并取消主配置。旧配置行保留，历史数据仍按各自 {@code config_id} 读回原后端
     * （设计 §7.4）。</p>
     *
     * @param id      目标配置编号
     * @param purpose 目标用途；不能为 {@code GENERIC}
     * @return 是否成功
     * @throws xin.v5ai.common.core.exception.ServiceException 用途为 {@code GENERIC}、
     *         目标已是该用途，或该用途被主配置占用（主配置只能从卡片上的「设为主配置」调整）
     */
    Boolean updateFileConfigPurpose(Long id, FileConfigPurpose purpose);

    /**
     * 校验并批量删除文件配置信息
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);

    FileClient getFileClient(Long id);
}
