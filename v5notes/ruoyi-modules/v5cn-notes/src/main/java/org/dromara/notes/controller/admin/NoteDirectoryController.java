package org.dromara.notes.controller.admin;

import java.util.List;

import lombok.RequiredArgsConstructor;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.*;
import cn.dev33.satoken.annotation.SaCheckPermission;
import org.springframework.web.bind.annotation.*;
import org.springframework.validation.annotation.Validated;
import org.dromara.common.idempotent.annotation.RepeatSubmit;
import org.dromara.common.log.annotation.Log;
import org.dromara.common.web.core.BaseController;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.R;
import org.dromara.common.core.validate.AddGroup;
import org.dromara.common.core.validate.EditGroup;
import org.dromara.common.log.enums.BusinessType;
import org.dromara.common.excel.utils.ExcelUtil;
import org.dromara.notes.domain.vo.NoteDirectoryVo;
import org.dromara.notes.domain.bo.NoteDirectoryBo;
import org.dromara.notes.service.INoteDirectoryService;
import org.dromara.common.mybatis.core.page.TableDataInfo;

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
    public TableDataInfo<NoteDirectoryVo> list(NoteDirectoryBo bo, PageQuery pageQuery) {
        return noteDirectoryService.queryPageList(bo, pageQuery);
    }

    /**
     * 导出目录列表
     */
    @SaCheckPermission("notes:directory:export")
    @Log(title = "目录", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(NoteDirectoryBo bo, HttpServletResponse response) {
        List<NoteDirectoryVo> list = noteDirectoryService.queryList(bo);
        ExcelUtil.exportExcel(list, "目录", NoteDirectoryVo.class, response);
    }

    /**
     * 获取目录详细信息
     *
     * @param id 主键
     */
    @SaCheckPermission("notes:directory:query")
    @GetMapping("/{id}")
    public R<NoteDirectoryVo> getInfo(@NotNull(message = "主键不能为空")
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
    public R<Void> remove(@NotEmpty(message = "主键不能为空")
                          @PathVariable Long[] ids) {
        return toAjax(noteDirectoryService.deleteWithValidByIds(List.of(ids), true));
    }
}
