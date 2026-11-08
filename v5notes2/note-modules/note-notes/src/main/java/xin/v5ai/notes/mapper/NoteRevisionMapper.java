package xin.v5ai.notes.mapper;

import xin.v5ai.common.mybatis.core.mapper.BaseMapperPlus;
import xin.v5ai.notes.domain.NoteRevision;
import xin.v5ai.notes.domain.vo.NoteRevisionVo;

/**
 * 笔记版本 Mapper。不挂数据权限，归属由笔记行校验。
 */
public interface NoteRevisionMapper extends BaseMapperPlus<NoteRevision, NoteRevisionVo> {
}
