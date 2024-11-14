package org.dromara.common.core.service;

import org.dromara.common.core.domain.dto.FileDTO;

import java.util.List;

/**
 * 通用 OSS服务
 *
 * @author Lion Li
 */
public interface FileService {

    /**
     * 通过ossId查询对应的url
     *
     * @param fileIds ossId串逗号分隔
     * @return url串逗号分隔
     */
    String selectUrlByIds(String fileIds);

    /**
     * 通过ossId查询列表
     *
     * @param fileIds ossId串逗号分隔
     * @return 列表
     */
    List<FileDTO> selectByIds(String fileIds);
}
