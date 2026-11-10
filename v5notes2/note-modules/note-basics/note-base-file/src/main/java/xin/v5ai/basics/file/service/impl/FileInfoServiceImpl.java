package xin.v5ai.basics.file.service.impl;

import xin.v5ai.common.core.utils.MessageUtils;
import cn.hutool.core.date.DateUtil;
import cn.hutool.core.io.file.FileNameUtil;
import cn.hutool.core.lang.Assert;
import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.annotation.Resource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import xin.v5ai.basics.file.core.client.FileClient;
import xin.v5ai.basics.file.core.client.FileUploadResult;
import xin.v5ai.basics.file.core.client.s3.S3FileClient;
import xin.v5ai.basics.file.core.utils.FileTypeUtils;
import xin.v5ai.basics.file.domain.FileInfo;
import xin.v5ai.basics.file.domain.bo.FileInfoSearchBo;
import xin.v5ai.basics.file.domain.vo.FileInfoVo;
import xin.v5ai.basics.file.domain.vo.FileUploadVo;
import xin.v5ai.basics.file.mapper.FileInfoMapper;
import xin.v5ai.basics.file.service.IFileConfigService;
import xin.v5ai.basics.file.service.IFileInfoService;
import xin.v5ai.common.core.exception.ServiceException;
import xin.v5ai.common.core.utils.StringUtils;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.oss.enums.AccessPolicy;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.Date;
import java.util.List;

/**
 * 文件路径Service业务层处理
 *
 * @author ZYW
 * @date 2024-04-10
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class FileInfoServiceImpl implements IFileInfoService {

    private final FileInfoMapper baseMapper;

    @Resource
    private IFileConfigService fileConfigService;

    /**
     * 查询文件路径
     */
    @Override
    public FileInfoVo queryById(Long id){
        return baseMapper.selectVoById(id);
    }

    /**
     * 查询文件路径列表
     */
    @Override
    public PageResult<FileInfoVo> queryPageList(FileInfoSearchBo bo, PageQuery pageQuery) {
        LambdaQueryWrapper<FileInfo> lqw = buildQueryWrapper(bo);
        Page<FileInfoVo> result = baseMapper.selectVoPage(pageQuery.build(), lqw);
        result.getRecords().forEach(item -> item.setSuffix(FileNameUtil.getSuffix(item.getPath())));
        result.getRecords().forEach(item -> item.setUrl(matchingUrl(item).getUrl()));
        return PageResult.build(result.getRecords(), result.getTotal());
    }

    /**
     * 查询指定用户上传的图片
     */
    @Override
    public PageResult<FileInfoVo> queryMyImages(Long userId, String name, PageQuery pageQuery) {
        if (userId == null) {
            return PageResult.build();
        }
        LambdaQueryWrapper<FileInfo> lqw = Wrappers.lambdaQuery();
        lqw.eq(FileInfo::getCreateBy, userId);
        lqw.likeRight(FileInfo::getType, "image/");
        lqw.like(StringUtils.isNotBlank(name), FileInfo::getName, name);
        lqw.orderByDesc(FileInfo::getCreateTime);
        Page<FileInfoVo> result = baseMapper.selectVoPage(pageQuery.build(), lqw);
        result.getRecords().forEach(item -> item.setUrl(matchingUrl(item).getUrl()));
        return PageResult.build(result.getRecords(), result.getTotal());
    }

    /**
     * 查询文件路径列表
     */
    @Override
    public List<FileInfoVo> queryList(FileInfoSearchBo bo) {
        LambdaQueryWrapper<FileInfo> lqw = buildQueryWrapper(bo);
        return baseMapper.selectVoList(lqw);
    }

    private LambdaQueryWrapper<FileInfo> buildQueryWrapper(FileInfoSearchBo bo) {
        LambdaQueryWrapper<FileInfo> lqw = Wrappers.lambdaQuery();
        lqw.eq(StringUtils.isNotBlank(bo.getPath()), FileInfo::getPath, bo.getPath());
        lqw.like(StringUtils.isNotBlank(bo.getName()), FileInfo::getName, bo.getName());
        lqw.eq(StringUtils.isNotBlank(bo.getType()), FileInfo::getType, bo.getType());
        if(bo.getCreateTime() != null && bo.getCreateTime().length == 2) {
            lqw.between(FileInfo::getCreateTime, bo.getCreateTime()[0], bo.getCreateTime()[1]);
        }
        lqw.orderByDesc(FileInfo::getCreateTime);
        return lqw;
    }

    @Override
    public List<FileUploadVo> queryByIds(List<Long> asList) {
        List<FileInfoVo> fileInfoVos = baseMapper.selectVoByIds(asList);
        fileInfoVos.forEach(item -> item.setUrl(matchingUrl(item).getUrl()));
        return fileInfoVos.stream().<FileUploadVo>map(item -> FileUploadVo.builder()
                .id(item.getId())
                .path(item.getPath())
                .url(item.getUrl())
                .build()).toList();
    }

    /**
     * 新增文件路径
     */
    @Override
    public FileInfo uploadByBo(String name, String path, byte[] content) throws Exception {
        // 计算默认的 path 名
        String type = FileTypeUtils.getMineType(content, name);
        if (StrUtil.isEmpty(path)) {
            path = generatePath(name);
        }
        // 如果 name 为空，则使用 path 填充
        if (StrUtil.isEmpty(name)) {
            name = path;
        }

        // 上传到文件存储器
        FileClient client = fileConfigService.getMasterFileClient();
        log.info("上传文件到文件存储器，FileClient id:{}, ", client.getId());
        Assert.notNull(client, "客户端(master) 不能为空");
        FileUploadResult uploadResult = client.upload(content, path, type);

        // 保存到数据库
        FileInfo file = new FileInfo();
        file.setConfigId(client.getId());
        file.setName(name);
        file.setPath(uploadResult.getPath());
        file.setUrl(uploadResult.getUrl());
        file.setType(type);
        file.setSize(content.length);
        baseMapper.insert(file);
        return file;
    }

    /**
     * 生成默认的文件相对路径（移植自旧 common-core 的 FileUtils.generatePath）。
     */
    private String generatePath(String name) {
        String ext = FileNameUtil.extName(name);
        String datePath = DateUtil.format(new Date(), "yyyy/MM/dd");
        String fileName = IdUtil.fastSimpleUUID() + (StrUtil.isBlank(ext) ? "" : "." + ext);
        return datePath + "/" + fileName;
    }

    /**
     * 批量删除文件路径
     */
    @Override
    public Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid) {
        if(isValid){
            //TODO 做一些业务上的校验,判断是否需要校验
        }
        List<FileInfo> fileInfos = baseMapper.selectBatchIds(ids);
        if (fileInfos.isEmpty()) {
            throw new ServiceException(MessageUtils.message("file.missing"));
        }
        fileInfos.forEach(item -> {
            // 如果多个数据库记录指向同一个文件，则在数据库记录大于1时不删除文件，防止删除后其他记录下载文件时找不到文件
            Long count = baseMapper.selectCount(Wrappers.lambdaQuery(FileInfo.class).eq(FileInfo::getPath, item.getPath()).eq(FileInfo::getConfigId, item.getConfigId()));
            if (count > 1) {
                return;
            }
            FileClient client = fileConfigService.getFileClient(item.getConfigId());
            if (client != null) {
                try {
                    client.delete(item.getPath());
                } catch (Exception e) {
                    throw new ServiceException(MessageUtils.message("file.delete.failed", e.getMessage()));
                }
            }
        });

        return baseMapper.deleteBatchIds(ids) > 0;
    }

    @Override
    public byte[] getFileContent(Long configId, String path) throws Exception {
        FileClient client = fileConfigService.getFileClient(configId);
        Assert.notNull(client, "客户端({}) 不能为空", configId);
        return client.getContent(path);
    }

    /**
     * 匹配Url
     *
     * @param infoVo File存储对象
     * @return oss 匹配Url的OSS对象
     */
    @Override
    public FileInfoVo matchingUrl(FileInfoVo infoVo) {
        FileClient client = fileConfigService.getFileClient(infoVo.getConfigId());
        if (client instanceof S3FileClient s3Client) {
            // 仅修改桶类型为 private 的URL，临时URL时长为120s
            if (AccessPolicy.PRIVATE == s3Client.getAccessPolicy()) {
                infoVo.setUrl(s3Client.getPrivateUrl(infoVo.getPath(), 120));
            }
        }
        return infoVo;
    }
}
