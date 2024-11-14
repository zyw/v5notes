package org.dromara.basics.file.service;

import org.dromara.basics.file.domain.FileInfo;
import org.dromara.basics.file.domain.bo.FileInfoSearchBo;
import org.dromara.basics.file.domain.vo.FileInfoVo;
import org.dromara.basics.file.domain.vo.FileUploadVo;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.mybatis.core.page.TableDataInfo;

import java.util.Collection;
import java.util.List;

/**
 * 文件路径Service接口
 *
 * @author ZYW
 * @date 2024-04-10
 */
public interface IFileInfoService {

    /**
     * 查询文件路径
     */
    FileInfoVo queryById(Long id);

    /**
     * 查询文件路径列表
     */
    TableDataInfo<FileInfoVo> queryPageList(FileInfoSearchBo bo, PageQuery pageQuery);

    /**
     * 查询文件路径列表
     */
    List<FileInfoVo> queryList(FileInfoSearchBo bo);

    /**
     * 查询文件路径列表
     */
    List<FileUploadVo> queryByIds(List<Long> asList);

    /**
     * 上传文件
     */
    FileInfo uploadByBo(String name, String path, byte[] content) throws Exception;

    /**
     * 校验并批量删除文件路径信息
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);

    /**
     * 获得文件内容
     *
     * @param configId 配置编号
     * @param path     文件路径
     * @return 文件内容
     */
    byte[] getFileContent(Long configId, String path) throws Exception;

    /**
     * 匹配Url
     *
     * @param infoVo File存储对象
     * @return oss 匹配Url的OSS对象
     */
    FileInfoVo matchingUrl(FileInfoVo infoVo);
}
