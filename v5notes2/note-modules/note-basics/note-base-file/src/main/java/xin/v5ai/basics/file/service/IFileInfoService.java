package xin.v5ai.basics.file.service;

import xin.v5ai.basics.file.domain.FileInfo;
import xin.v5ai.basics.file.domain.bo.FileInfoSearchBo;
import xin.v5ai.basics.file.domain.vo.FileInfoVo;
import xin.v5ai.basics.file.domain.vo.FileUploadVo;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.common.core.domain.PageResult;

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
    PageResult<FileInfoVo> queryPageList(FileInfoSearchBo bo, PageQuery pageQuery);

    /**
     * 查询指定用户上传的图片
     */
    PageResult<FileInfoVo> queryMyImages(Long userId, String name, PageQuery pageQuery);

    /**
     * 查询文件路径列表
     */
    List<FileInfoVo> queryList(FileInfoSearchBo bo);

    /**
     * 查询文件路径列表
     */
    List<FileUploadVo> queryByIds(List<Long> asList);

    /**
     * 上传文件（写入 master 配置，既有行为不变）
     */
    FileInfo uploadByBo(String name, String path, byte[] content) throws Exception;

    /**
     * 上传文件到指定文件配置（设计 D2）。
     *
     * <p>与 {@link #uploadByBo} 的唯一差别是目标客户端由 {@code configId} 决定，
     * 而不是 master。路径仍强制落在当前用户目录下。</p>
     *
     * @param configId 目标文件配置
     * @param name     原始文件名（可为空，则用 path 填充）
     * @param path     相对路径；为空时按 {userId}/yyyy/MM/dd/{uuid}.ext 生成
     * @param content  文件字节
     */
    FileInfo uploadToConfig(Long configId, String name, String path, byte[] content) throws Exception;

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
