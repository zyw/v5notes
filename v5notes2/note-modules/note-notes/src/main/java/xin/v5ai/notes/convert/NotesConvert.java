package xin.v5ai.notes.convert;

import xin.v5ai.notes.domain.vo.NewNotesVo;
import xin.v5ai.notes.domain.vo.NoteDirectoryVo;
import xin.v5ai.notes.domain.vo.NoteNotesVo;
import xin.v5ai.notes.domain.vo.NotesSearchVo;
import xin.v5ai.notes.domain.vo.NotesTreeVo;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 笔记/目录视图对象转换工具。
 *
 * <p>说明：6.1.0 骨架使用 mapstruct-plus（io.github.linpeilie）；为降低与注解处理器的耦合，
 * 这里使用手写转换替代原 5.2.2 的 org.mapstruct.Mapper 动态实现，语义保持不变。</p>
 *
 * @author Lion Li
 * @date 2024-10-25
 */
public class NotesConvert {

    public static final NotesConvert INSTANCE = new NotesConvert();

    public NewNotesVo toNewNotesVo(NoteNotesVo vo) {
        if (vo == null) {
            return null;
        }
        NewNotesVo target = new NewNotesVo();
        target.setId(vo.getId());
        target.setDirId(vo.getDirId());
        target.setName(vo.getName());
        return target;
    }

    public NotesTreeVo dirVoToNotesTreeVo(NoteDirectoryVo dir) {
        if (dir == null) {
            return null;
        }
        NotesTreeVo target = new NotesTreeVo();
        target.setId(dir.getId());
        target.setPid(dir.getPid());
        target.setLabel(dir.getName());
        target.setType(1);
        return target;
    }

    public NotesTreeVo nnVoToNotesTreeVo(NoteNotesVo nnVo) {
        if (nnVo == null) {
            return null;
        }
        NotesTreeVo target = new NotesTreeVo();
        target.setId(nnVo.getId());
        target.setPid(nnVo.getDirId());
        target.setLabel(nnVo.getName());
        target.setType(2);
        return target;
    }

    public NotesSearchVo toNotesSearchVo(NoteNotesVo vo) {
        if (vo == null) {
            return null;
        }
        NotesSearchVo target = new NotesSearchVo();
        target.setId(vo.getId());
        target.setDirId(vo.getDirId());
        target.setName(vo.getName());
        target.setContent(vo.getContent());
        return target;
    }

    public List<NewNotesVo> toNewNotesVoList(List<NoteNotesVo> list) {
        return list.stream().map(this::toNewNotesVo).collect(Collectors.toList());
    }

    public List<NotesSearchVo> toNotesSearchVoList(List<NoteNotesVo> list) {
        return list.stream().map(this::toNotesSearchVo).collect(Collectors.toList());
    }
}
