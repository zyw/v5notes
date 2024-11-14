package org.dromara.basics.file.service.impl;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.convert.Convert;
import cn.hutool.core.io.file.FileNameUtil;
import cn.hutool.core.lang.Assert;
import cn.hutool.core.util.ObjectUtil;
import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.annotation.Resource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.basics.file.core.client.FileClient;
import org.dromara.basics.file.core.client.s3.S3FileClient;
import org.dromara.basics.file.core.utils.FileTypeUtils;
import org.dromara.basics.file.domain.FileInfo;
import org.dromara.basics.file.domain.bo.FileInfoSearchBo;
import org.dromara.basics.file.domain.vo.FileInfoVo;
import org.dromara.basics.file.domain.vo.FileUploadVo;
import org.dromara.basics.file.mapper.FileInfoMapper;
import org.dromara.basics.file.service.IFileConfigService;
import org.dromara.basics.file.service.IFileInfoService;
import org.dromara.common.core.domain.dto.FileDTO;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.common.core.service.FileService;
import org.dromara.common.core.utils.SpringUtils;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.common.core.utils.file.FileUtils;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.mybatis.core.page.TableDataInfo;
import org.dromara.common.oss.entity.UploadResult;
import org.dromara.common.oss.enumd.AccessPolicyType;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
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
public class FileInfoServiceImpl implements IFileInfoService, FileService {

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
    public TableDataInfo<FileInfoVo> queryPageList(FileInfoSearchBo bo, PageQuery pageQuery) {
        LambdaQueryWrapper<FileInfo> lqw = buildQueryWrapper(bo);
        Page<FileInfoVo> result = baseMapper.selectVoPage(pageQuery.build(), lqw);
        result.getRecords().forEach(item -> item.setSuffix(FileNameUtil.getSuffix(item.getPath())));

        result.getRecords().forEach(item -> item.setUrl(matchingUrl(item).getUrl()));

        return TableDataInfo.build(result);
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
        lqw.eq(StringUtils.isNotBlank(bo.getType()), FileInfo::getType, bo.getType());
        if(bo.getCreateTime() != null && bo.getCreateTime().length == 2) {
            lqw.between(FileInfo::getCreateTime, bo.getCreateTime()[0], bo.getCreateTime()[1]);
        }
        lqw.orderByDesc(FileInfo::getCreateTime);
        return lqw;
    }


    @Override
    public List<FileUploadVo> queryByIds(List<Long> asList) {
        List<FileInfoVo> fileInfoVos = baseMapper.selectVoBatchIds(asList);
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
            path = FileUtils.generatePath(content, name);
        }
        // 如果 name 为空，则使用 path 填充
        if (StrUtil.isEmpty(name)) {
            name = path;
        }

        // 上传到文件存储器
        FileClient client = fileConfigService.getMasterFileClient();
        log.info("上传文件到文件存储器，FileClient id:{}, ", client.getId());
        Assert.notNull(client, "客户端(master) 不能为空");
        UploadResult uploadResult = client.upload(content, path, type);

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
     * 保存前的数据校验
     */
    private void validEntityBeforeSave(FileInfo entity){
        //TODO 做一些数据校验,如唯一约束
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
            throw new ServiceException("文件不存在");
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
                    throw new ServiceException("删除文件失败:" + e.getMessage());
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

    private FileInfo validateFileConfigExists(Long id) {
        FileInfo info = baseMapper.selectById(id);
        if (info == null) {
            throw new ServiceException("文件不存在");
        }
        return info;
    }

    @Override
    public String selectUrlByIds(String fileIds) {
        List<String> list = new ArrayList<>();
        for (Long id : StringUtils.splitTo(fileIds, Convert::toLong)) {
            FileInfoVo vo = SpringUtils.getAopProxy(this).queryById(id);
            if (ObjectUtil.isNotNull(vo)) {
                try {
                    list.add(this.matchingUrl(vo).getUrl());
                } catch (Exception ignored) {
                    // 如果oss异常无法连接则将数据直接返回
                    list.add(vo.getUrl());
                }
            }
        }
        return String.join(StringUtils.SEPARATOR, list);
    }

    @Override
    public List<FileDTO> selectByIds(String fileIds) {
        List<FileDTO> list = new ArrayList<>();
        for (Long id : StringUtils.splitTo(fileIds, Convert::toLong)) {
            FileInfoVo vo = SpringUtils.getAopProxy(this).queryById(id);
            if (ObjectUtil.isNotNull(vo)) {
                try {
                    vo.setUrl(this.matchingUrl(vo).getUrl());
                    list.add(BeanUtil.toBean(vo, FileDTO.class));
                } catch (Exception ignored) {
                    // 如果oss异常无法连接则将数据直接返回
                    list.add(BeanUtil.toBean(vo, FileDTO.class));
                }
            }
        }
        return list;
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
            if (AccessPolicyType.PRIVATE == s3Client.getAccessPolicy()) {
                infoVo.setUrl(s3Client.getPrivateUrl(infoVo.getPath(), 120));
            }
        }
        return infoVo;
    }
}
