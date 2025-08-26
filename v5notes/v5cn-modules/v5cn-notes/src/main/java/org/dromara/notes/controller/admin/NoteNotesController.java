package org.dromara.notes.controller.admin;

import cn.dev33.satoken.annotation.SaCheckPermission;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.R;
import org.dromara.common.core.validate.AddGroup;
import org.dromara.common.core.validate.EditGroup;
import org.dromara.common.excel.utils.ExcelUtil;
import org.dromara.common.idempotent.annotation.RepeatSubmit;
import org.dromara.common.log.annotation.Log;
import org.dromara.common.log.enums.BusinessType;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.mybatis.core.page.TableDataInfo;
import org.dromara.common.web.core.BaseController;
import org.dromara.notes.domain.bo.NoteNotesBo;
import org.dromara.notes.domain.vo.NoteNotesVo;
import org.dromara.notes.domain.vo.NotesContentVo;
import org.dromara.notes.service.INoteNotesService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 笔记
 *
 * @author Lion Li
 * @date 2024-10-25
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/notes/notes")
public class NoteNotesController extends BaseController {

    private final INoteNotesService noteNotesService;

    /**
     * 查询笔记列表
     */
    @SaCheckPermission("notes:notes:list")
    @GetMapping("/list")
    public TableDataInfo<NoteNotesVo> list(NoteNotesBo bo, PageQuery pageQuery) {
        return noteNotesService.queryPageList(bo, pageQuery);
    }

    /**
     * 导出笔记列表
     */
    @SaCheckPermission("notes:notes:export")
    @Log(title = "笔记", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(NoteNotesBo bo, HttpServletResponse response) {
        List<NoteNotesVo> list = noteNotesService.queryList(bo);
        ExcelUtil.exportExcel(list, "笔记", NoteNotesVo.class, response);
    }

    /**
     * 获取笔记详细信息
     *
     * @param id 主键
     */
    @SaCheckPermission("notes:notes:query")
    @GetMapping("/{id}")
    public R<NotesContentVo> getInfo(@NotNull(message = "主键不能为空")
                                     @PathVariable Long id) {
        return R.ok(noteNotesService.queryById(id));
    }

    /**
     * 新增笔记
     */
    @SaCheckPermission("notes:notes:add")
    @Log(title = "笔记", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping()
    public R<Void> add(@Validated(AddGroup.class) @RequestBody NoteNotesBo bo) {
        return toAjax(noteNotesService.insertByBo(bo));
    }

    /**
     * 修改笔记
     */
    @SaCheckPermission("notes:notes:edit")
    @Log(title = "笔记", businessType = BusinessType.UPDATE)
    @RepeatSubmit(message = "内容保存中，请不要重复提交")
    @PutMapping()
    public R<Void> edit(@Validated(EditGroup.class) @RequestBody NoteNotesBo bo) {
        return toAjax(noteNotesService.updateByBo(bo));
    }

    /**
     * 删除笔记
     *
     * @param ids 主键串
     */
    @SaCheckPermission("notes:notes:remove")
    @Log(title = "笔记", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空")
                          @PathVariable Long[] ids) {
        return toAjax(noteNotesService.deleteWithValidByIds(List.of(ids), true));
    }
}
