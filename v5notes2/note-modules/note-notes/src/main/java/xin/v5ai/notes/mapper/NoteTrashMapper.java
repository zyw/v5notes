package xin.v5ai.notes.mapper;

import com.baomidou.mybatisplus.annotation.InterceptorIgnore;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Param;
import xin.v5ai.notes.domain.NoteTrash;
import xin.v5ai.notes.domain.NoteTrashSubject;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

/**
 * 回收站及跨逻辑删除的笔记、目录语句。不挂数据权限，归属在服务层按 user_id 校验。
 */
@InterceptorIgnore(dataPermission = "true")
public interface NoteTrashMapper extends BaseMapper<NoteTrash> {

    NoteTrashSubject selectNote(@Param("id") Long id);

    NoteTrashSubject lockNote(@Param("id") Long id);

    NoteTrashSubject lockDirectory(@Param("id") Long id);

    NoteTrashSubject selectLiveDirectory(@Param("id") Long id, @Param("userId") Long userId);

    List<NoteTrashSubject> selectLiveDirectories(@Param("userId") Long userId);

    List<Long> selectLiveNoteIds(@Param("userId") Long userId, @Param("dirIds") Collection<Long> dirIds);

    int markNotes(@Param("userId") Long userId, @Param("ids") Collection<Long> ids, @Param("trashId") Long trashId);

    int markDirectories(@Param("userId") Long userId, @Param("ids") Collection<Long> ids, @Param("trashId") Long trashId);

    int restoreNote(@Param("id") Long id, @Param("trashId") Long trashId, @Param("userId") Long userId, @Param("parentId") Long parentId);

    int restoreDirectory(@Param("id") Long id, @Param("trashId") Long trashId, @Param("userId") Long userId, @Param("parentId") Long parentId);

    int restoreChildDirectories(@Param("trashId") Long trashId, @Param("userId") Long userId, @Param("rootId") Long rootId);

    int restoreNotesByTrash(@Param("trashId") Long trashId, @Param("userId") Long userId);

    List<Long> selectNoteIdsByTrash(@Param("trashId") Long trashId, @Param("userId") Long userId);

    int deleteNotePhysical(@Param("id") Long id, @Param("trashId") Long trashId, @Param("userId") Long userId);

    int deleteNotesByTrash(@Param("trashId") Long trashId, @Param("userId") Long userId);

    int deleteDirectoriesByTrash(@Param("trashId") Long trashId, @Param("userId") Long userId);

    List<Long> selectIdsByUser(@Param("userId") Long userId);

    List<Long> selectExpiredIds(@Param("now") LocalDateTime now);
}
