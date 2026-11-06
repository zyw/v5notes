package xin.v5ai.basics.file.service;

import xin.v5ai.basics.file.core.client.FileClient;
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
     * 校验并批量删除文件配置信息
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);

    FileClient getFileClient(Long id);
}
