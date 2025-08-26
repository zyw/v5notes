package org.dromara.basics.file.core.client.db;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import lombok.extern.slf4j.Slf4j;
import org.dromara.basics.file.core.client.AbstractFileClient;
import org.dromara.basics.file.domain.FileContent;
import org.dromara.basics.file.mapper.FileContentMapper;
import org.dromara.common.core.utils.SpringUtils;
import org.dromara.common.oss.entity.UploadResult;

/**
 * 基于 DB 存储的文件客户端的配置类
 *
 * @author 芋道源码
 */
@Slf4j
public class DBFileClient extends AbstractFileClient<DBFileClientConfig> {

    private FileContentMapper fileContentMapper;

    /**
     * 构造方法
     *
     * @param id     配置ID
     * @param config 配置信息
     */
    public DBFileClient(Long id, DBFileClientConfig config) {
        super(id, config);
    }

    @Override
    protected void doInit() {
        // 初始化文件内容 mapper
        fileContentMapper = SpringUtils.getBean(FileContentMapper.class);
    }

    @Override
    public UploadResult upload(byte[] content, String path, String type) throws Exception {
        FileContent fileContent = new FileContent();
        fileContent.setConfigId(getId());
        fileContent.setPath(path);
        fileContent.setContent(content);

        int count = fileContentMapper.insert(fileContent);
        if (count > 0) {
            log.info("文件内容上传成功。ID: [{}], 路径: [{}]", fileContent.getId(), path);
        }
        // 拼接返回路径
        return UploadResult.builder()
            .url(super.formatFileUrl(config.getDomain(), path))
            .path(path)
            .build();
    }

    @Override
    public void delete(String path) throws Exception {
        int count = fileContentMapper.delete(Wrappers.<FileContent>lambdaQuery().eq(FileContent::getConfigId, getId()).eq(FileContent::getPath, path));
        if (count == 0) {
            log.warn("文件内容ID: [{}] 路径：[{}] 不存在", getId(), path);
            return;
        }
        log.info("文件内容ID: [{}] 路径：[{}] 删除成功", getId(), path);
    }

    @Override
    public byte[] getContent(String path) throws Exception {
        return new byte[0];
    }
}
