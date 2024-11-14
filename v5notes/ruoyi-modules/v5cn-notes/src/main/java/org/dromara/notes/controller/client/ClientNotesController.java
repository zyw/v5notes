package org.dromara.notes.controller.client;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.R;
import org.dromara.common.core.validate.AddGroup;
import org.dromara.common.core.validate.EditGroup;
import org.dromara.common.core.validate.QueryGroup;
import org.dromara.common.core.validate.SearchGroup;
import org.dromara.common.idempotent.annotation.RepeatSubmit;
import org.dromara.common.log.annotation.Log;
import org.dromara.common.log.enums.BusinessType;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.mybatis.core.page.TableDataInfo;
import org.dromara.common.web.core.BaseController;
import org.dromara.notes.domain.bo.ClientNotesBo;
import org.dromara.notes.domain.bo.NoteNotesBo;
import org.dromara.notes.domain.vo.NewNotesVo;
import org.dromara.notes.domain.vo.NoteNotesVo;
import org.dromara.notes.domain.vo.NotesContentVo;
import org.dromara.notes.domain.vo.NotesSearchVo;
import org.dromara.notes.service.INoteNotesService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 客户端笔记管理
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/client/notes")
public class ClientNotesController extends BaseController {

    private final INoteNotesService noteNotesService;

    /**
     * 新增笔记
     */
    @Log(title = "笔记", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping()
    public R<Long> add(@Validated(AddGroup.class) @RequestBody NoteNotesBo bo) {
        Boolean result = noteNotesService.insertByBo(bo);
        if (!result) {
            return R.fail("添加笔记失败");
        }
        return R.ok("添加笔记成功", bo.getId());
    }

    /**
     * 修改笔记
     */
    @Log(title = "笔记", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping()
    public R<Void> edit(@Validated(EditGroup.class) @RequestBody NoteNotesBo bo) {
        return toAjax(noteNotesService.updateByBo(bo));
    }

    /**
     * 删除笔记
     *
     * @param ids 主键串
     */
    @Log(title = "笔记", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空")
                          @PathVariable Long[] ids) {
        return toAjax(noteNotesService.deleteWithValidByIds(List.of(ids), true));
    }

    /**
     * 查询笔记列表
     */
    @GetMapping("/list")
    public TableDataInfo<NoteNotesVo> list(@Validated({QueryGroup.class}) ClientNotesBo bo, PageQuery pageQuery) {
        return noteNotesService.queryPageClientList(bo, pageQuery);
    }

    /**
     * 搜索笔记列表
     */
    @GetMapping("/search")
    public R<List<NotesSearchVo>> search(@Validated({SearchGroup.class}) ClientNotesBo bo) {
        return R.ok(noteNotesService.searchNotesList(bo));
    }

    /**
     * 获取笔记详细信息
     *
     * @param id 主键
     */
    @GetMapping("/{id}")
    public R<NotesContentVo> getInfo(@NotNull(message = "主键不能为空")
                                     @PathVariable Long id) {
        return R.ok(noteNotesService.queryById(id));
    }

    /**
     * 最新笔记(UI左侧最新笔记选项卡的最新笔记)
     * @param pageQuery 分页条件
     * @return
     */
    @GetMapping("/new-notes")
    public TableDataInfo<NewNotesVo> newNotes(PageQuery pageQuery) {
        return noteNotesService.queryPageClientNewNotes(pageQuery);
    }
}
