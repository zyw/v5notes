package xin.v5ai.notes.controller.admin;

import java.util.List;

import lombok.RequiredArgsConstructor;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.*;
import cn.dev33.satoken.annotation.SaCheckPermission;
import xin.v5ai.notes.domain.vo.NotesTreeVo;
import org.springframework.web.bind.annotation.*;
import org.springframework.validation.annotation.Validated;
import xin.v5ai.common.redis.annotation.RepeatSubmit;
import xin.v5ai.common.log.annotation.Log;
import xin.v5ai.common.web.core.BaseController;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.core.validate.AddGroup;
import xin.v5ai.common.core.validate.EditGroup;
import xin.v5ai.common.log.enums.BusinessType;
import xin.v5ai.common.excel.utils.ExcelBuilder;
import xin.v5ai.notes.domain.vo.NoteDirectoryVo;
import xin.v5ai.notes.domain.bo.NoteDirectoryBo;
import xin.v5ai.notes.service.INoteDirectoryService;
import xin.v5ai.common.core.domain.PageResult;

/**
 * 目录
 *
 * @author Lion Li
 * @date 2024-10-25
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/notes/directory")
public class NoteDirectoryController extends BaseController {

    private final INoteDirectoryService noteDirectoryService;

    /**
     * 查询目录列表
     */
    @SaCheckPermission("notes:directory:list")
    @GetMapping("/list")
    public R<PageResult<NoteDirectoryVo>> list(NoteDirectoryBo bo, PageQuery pageQuery) {
        return R.ok(noteDirectoryService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出目录列表
     */
    @SaCheckPermission("notes:directory:export")
    @Log(title = "目录", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(NoteDirectoryBo bo, HttpServletResponse response) {
        List<NoteDirectoryVo> list = noteDirectoryService.queryList(bo);
        ExcelBuilder.of(list, NoteDirectoryVo.class).sheetName("目录").toResponse(response);
    }

    /**
     * 获取目录详细信息
     *
     * @param id 主键
     */
    @SaCheckPermission("notes:directory:query")
    @GetMapping("/{id}")
    public R<NoteDirectoryVo> getInfo(@NotNull(message = "{id.not.null}")
                                     @PathVariable Long id) {
        return R.ok(noteDirectoryService.queryById(id));
    }

    /**
     * 新增目录
     */
    @SaCheckPermission("notes:directory:add")
    @Log(title = "目录", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping()
    public R<Void> add(@Validated(AddGroup.class) @RequestBody NoteDirectoryBo bo) {
        return toAjax(noteDirectoryService.insertByBo(bo));
    }

    /**
     * 修改目录
     */
    @SaCheckPermission("notes:directory:edit")
    @Log(title = "目录", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping()
    public R<Void> edit(@Validated(EditGroup.class) @RequestBody NoteDirectoryBo bo) {
        return toAjax(noteDirectoryService.updateByBo(bo));
    }

    /**
     * 删除目录
     *
     * @param ids 主键串
     */
    @SaCheckPermission("notes:directory:remove")
    @Log(title = "目录", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public R<Void> remove(@NotEmpty(message = "{id.not.null}")
                          @PathVariable Long[] ids) {
        return toAjax(noteDirectoryService.deleteWithValidByIds(List.of(ids), true));
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
