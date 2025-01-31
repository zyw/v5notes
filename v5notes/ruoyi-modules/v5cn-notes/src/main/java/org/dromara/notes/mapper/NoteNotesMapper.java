package org.dromara.notes.mapper;

import org.dromara.notes.domain.NoteNotes;
import org.dromara.notes.domain.vo.NoteNotesVo;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.notes.domain.vo.NotesSearchVo;

import java.util.List;

/**
 * 笔记Mapper接口
 *
 * @author Lion Li
 * @date 2024-10-25
 */
public interface NoteNotesMapper extends BaseMapperPlus<NoteNotes, NoteNotesVo> {
    List<NoteNotesVo> selectByUserId(Long userId);

    List<NotesSearchVo> selectBySearch(Long userId, String search);
}
