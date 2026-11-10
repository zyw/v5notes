package xin.v5ai.notes.mapper;

import xin.v5ai.common.mybatis.annotation.DataColumn;
import xin.v5ai.common.mybatis.annotation.DataPermission;
import xin.v5ai.notes.domain.NoteNotes;
import xin.v5ai.notes.domain.vo.NoteNotesVo;
import xin.v5ai.common.mybatis.core.mapper.BaseMapperPlus;
import xin.v5ai.notes.domain.vo.NotesSearchVo;

import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 笔记Mapper接口
 *
 * @author Lion Li
 * @date 2024-10-25
 */
@DataPermission({
    @DataColumn(key = "deptName", value = "dept_id"),
    @DataColumn(key = "userName", value = "user_id")
})
public interface NoteNotesMapper extends BaseMapperPlus<NoteNotes, NoteNotesVo> {
    List<NoteNotesVo> selectByUserId(Long userId);

    List<NotesSearchVo> selectBySearch(Long userId, String search);

    /**
     * 只补写尚未计算的正文哈希，并保持 update_time 不变。
     */
    int fillContentHash(@Param("id") Long id, @Param("contentHash") String contentHash);
}
