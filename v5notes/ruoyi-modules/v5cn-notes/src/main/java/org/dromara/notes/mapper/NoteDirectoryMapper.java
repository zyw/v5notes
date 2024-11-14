package org.dromara.notes.mapper;

import org.dromara.notes.domain.NoteDirectory;
import org.dromara.notes.domain.vo.NoteDirectoryVo;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;

import java.util.List;

/**
 * 目录Mapper接口
 *
 * @author Lion Li
 * @date 2024-10-25
 */
public interface NoteDirectoryMapper extends BaseMapperPlus<NoteDirectory, NoteDirectoryVo> {
    List<NoteDirectoryVo> selectByUserId(Long userId);
}
