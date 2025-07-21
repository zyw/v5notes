package org.dromara.notes.convert;

import org.dromara.notes.domain.vo.*;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Mappings;
import org.mapstruct.factory.Mappers;

import java.util.List;
import java.util.stream.Collectors;

@Mapper
public interface NotesConvert {

    NotesConvert INSTANCE = Mappers.getMapper(NotesConvert.class);

    @Mappings({
        @Mapping(target = "id", source = "id"),
        @Mapping(target = "dirId", source = "dirId"),
        @Mapping(target = "name", source = "name"),
    })
    NewNotesVo toNewNotesVo(NoteNotesVo vo);

    @Mappings({
        @Mapping(target = "label", source = "name"),
        @Mapping(target = "type", constant = "1")
    })
    NotesTreeVo dirVoToNotesTreeVo(NoteDirectoryVo dir);

    @Mappings({
        @Mapping(target = "label", source = "name"),
        @Mapping(target = "pid", source = "dirId"),
        @Mapping(target = "type", constant = "2")
    })
    NotesTreeVo nnVoToNotesTreeVo(NoteNotesVo nnVo);

    NotesSearchVo toNotesSearchVo(NoteNotesVo vo);

    default List<NewNotesVo> toNewNotesVoList(List<NoteNotesVo> list) {
        return list.stream().map(this::toNewNotesVo).collect(Collectors.toList());
    }

    default List<NotesSearchVo> toNotesSearchVoList(List<NoteNotesVo> list) {
        return list.stream().map(this::toNotesSearchVo).collect(Collectors.toList());
    }
}
