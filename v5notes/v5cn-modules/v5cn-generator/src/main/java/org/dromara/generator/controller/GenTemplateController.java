package org.dromara.generator.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.R;
import org.dromara.common.core.validate.AddGroup;
import org.dromara.common.core.validate.EditGroup;
import org.dromara.common.idempotent.annotation.RepeatSubmit;
import org.dromara.common.log.annotation.Log;
import org.dromara.common.log.enums.BusinessType;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.mybatis.core.page.TableDataInfo;
import org.dromara.common.web.core.BaseController;
import org.dromara.generator.domain.GenTemplate;
import org.dromara.generator.domain.bo.GenEditTemplateBo;
import org.dromara.generator.domain.bo.GenTemplateBo;
import org.dromara.generator.service.IGenTemplateService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

/**
 * 代码模版
 *
 * @author zyw
 * @date 2025-10-09
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/tool/gen/template")
public class GenTemplateController extends BaseController {

    private final IGenTemplateService genTemplateService;

    /**
     * 查询代码模版列表
     */
    @SaCheckPermission("generator:template:list")
    @GetMapping("/list")
    public TableDataInfo<GenTemplate> list(GenTemplateBo bo, PageQuery pageQuery) {
        return genTemplateService.queryPageList(bo, pageQuery);
    }

    /**
     * 获取代码模版详细信息
     *
     * @param id 主键
     */
    @SaCheckPermission("generator:template:query")
    @GetMapping("/{id}")
    public R<GenTemplate> getInfo(@NotNull(message = "主键不能为空")
                                     @PathVariable Long id) {
        return R.ok(genTemplateService.queryById(id));
    }

    /**
     * 新增代码模版
     */
    @SaCheckPermission("generator:template:add")
    @Log(title = "代码模版", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping()
    public R<Void> add(@Validated(AddGroup.class) @RequestBody GenTemplateBo bo) {
        return toAjax(genTemplateService.insertByBo(bo));
    }

    /**
     * 修改代码模版
     */
    @SaCheckPermission("generator:template:edit")
    @Log(title = "代码模版", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping()
    public R<Void> edit(@Validated(EditGroup.class) @RequestBody GenTemplateBo bo) {
        return toAjax(genTemplateService.updateByBo(bo));
    }

    /**
     * 修改代码模版
     */
    @SaCheckPermission("generator:template:edit")
    @Log(title = "代码模版", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping("/edit/template")
    public R<Void> editTemplate(@Validated(EditGroup.class) @RequestBody GenEditTemplateBo bo) {
        return toAjax(genTemplateService.updateTemplateByBo(bo));
    }

    /**
     * 删除代码模版
     *
     * @param ids 主键串
     */
    @SaCheckPermission("generator:template:remove")
    @Log(title = "代码模版", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空")
                          @PathVariable Long[] ids) {
        return toAjax(genTemplateService.deleteWithValidByIds(List.of(ids), true));
    }

    /**
     * 获取所有文件路径
     * @param filePath
     * @return
     */
    @SaCheckPermission("generator:template:query-file-paths")
    @GetMapping("/query-file-paths")
    public R<Set<String>> getAllFilePath(@RequestParam(required = false) String filePath) {
        return R.ok(genTemplateService.getAllFilePath(filePath));
    }
}
