package org.dromara.notes.controller.client;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.R;
import org.dromara.common.core.validate.AddGroup;
import org.dromara.common.core.validate.EditGroup;
import org.dromara.common.idempotent.annotation.RepeatSubmit;
import org.dromara.common.log.annotation.Log;
import org.dromara.common.log.enums.BusinessType;
import org.dromara.common.web.core.BaseController;
import org.dromara.notes.domain.bo.NoteDirectoryBo;
import org.dromara.notes.domain.vo.NoteDirectoryVo;
import org.dromara.notes.domain.vo.NotesTreeVo;
import org.dromara.notes.service.INoteDirectoryService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 客户端目录
 * @author ZYW
 * @date 2024-10-25
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/client/notes/dir")
public class ClientNotesDirController extends BaseController {

    private final INoteDirectoryService noteDirectoryService;

    /**
     * 新增目录
     * @param bo
     * @return
     */
    @Log(title = "Client目录", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping()
    public R<Void> add(@Validated(AddGroup.class) @RequestBody NoteDirectoryBo bo) {
        return toAjax(noteDirectoryService.insertByBo(bo));
    }

    /**
     * 编辑目录（重命名）
     * @param bo
     * @return
     */
    @Log(title = "Client目录", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping()
    public R<Void> edit(@Validated(EditGroup.class) @RequestBody NoteDirectoryBo bo) {
        return toAjax(noteDirectoryService.updateByBo(bo));
    }

    /**
     * 删除目录
     * @param ids
     * @return
     */
    @Log(title = "Client目录", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空")
                          @PathVariable Long[] ids) {
        return toAjax(noteDirectoryService.deleteWithValidByIds(List.of(ids), true));
    }

    /**
     * 获取目录详细信息
     *
     * @param id 主键
     */
    @GetMapping("/{id}")
    public R<NoteDirectoryVo> getInfo(@NotNull(message = "主键不能为空")
                                      @PathVariable Long id) {
        return R.ok(noteDirectoryService.queryById(id));
    }

    /**
     * 目录树
     * @return
     */
    @GetMapping("/tree-dir")
    public R<List<NotesTreeVo>> dirTreeList() {
        return R.ok(noteDirectoryService.dirTreeList());
    }

    /**
     * 目录和笔记树
     * @return
     */
    @GetMapping("/tree")
    public R<List<NotesTreeVo>> notesTreeList() {
        return R.ok(noteDirectoryService.notesTreeList());
    }
}
