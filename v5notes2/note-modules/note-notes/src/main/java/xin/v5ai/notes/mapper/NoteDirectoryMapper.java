package xin.v5ai.notes.mapper;

import xin.v5ai.common.mybatis.annotation.DataColumn;
import xin.v5ai.common.mybatis.annotation.DataPermission;
import xin.v5ai.notes.domain.NoteDirectory;
import xin.v5ai.notes.domain.vo.NoteDirectoryVo;
import xin.v5ai.common.mybatis.core.mapper.BaseMapperPlus;

import java.util.List;

/**
 * 目录Mapper接口
 *
 * @author Lion Li
 * @date 2024-10-25
 */
@DataPermission({
    @DataColumn(key = "deptName", value = "dept_id"),
    @DataColumn(key = "userName", value = "user_id")
})
public interface NoteDirectoryMapper extends BaseMapperPlus<NoteDirectory, NoteDirectoryVo> {
    List<NoteDirectoryVo> selectByUserId(Long userId);
}
