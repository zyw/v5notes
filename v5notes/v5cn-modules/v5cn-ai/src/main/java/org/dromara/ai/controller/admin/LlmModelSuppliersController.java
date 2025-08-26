package org.dromara.ai.controller.admin;

import java.util.List;

import lombok.RequiredArgsConstructor;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.*;
import cn.dev33.satoken.annotation.SaCheckPermission;
import org.dromara.ai.domain.bo.LlmModelSuppliersBo;
import org.dromara.ai.domain.vo.LlmModelSuppliersVo;
import org.dromara.ai.service.ILlmModelSuppliersService;
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
import org.dromara.common.mybatis.core.page.TableDataInfo;

/**
 * 模型供应商
 *
 * @author Lion Li
 * @date 2025-07-21
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/ai-llm/model-sup")
public class LlmModelSuppliersController extends BaseController {

    private final ILlmModelSuppliersService llmModelSuppliersService;

    /**
     * 查询模型供应商列表
     */
    @SaCheckPermission("ai-llm:model-sup:list")
    @GetMapping("/list")
    public TableDataInfo<LlmModelSuppliersVo> list(LlmModelSuppliersBo bo, PageQuery pageQuery) {
        return llmModelSuppliersService.queryPageList(bo, pageQuery);
    }

    /**
     * 导出模型供应商列表
     */
    @SaCheckPermission("ai-llm:model-sup:export")
    @Log(title = "模型供应商", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(LlmModelSuppliersBo bo, HttpServletResponse response) {
        List<LlmModelSuppliersVo> list = llmModelSuppliersService.queryList(bo);
        ExcelUtil.exportExcel(list, "模型供应商", LlmModelSuppliersVo.class, response);
    }

    /**
     * 获取模型供应商详细信息
     *
     * @param id 主键
     */
    @SaCheckPermission("ai-llm:model-sup:query")
    @GetMapping("/{id}")
    public R<LlmModelSuppliersVo> getInfo(@NotNull(message = "主键不能为空")
                                     @PathVariable Long id) {
        return R.ok(llmModelSuppliersService.queryById(id));
    }

    /**
     * 新增模型供应商
     */
    @SaCheckPermission("ai-llm:model-sup:add")
    @Log(title = "模型供应商", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping()
    public R<Void> add(@Validated(AddGroup.class) @RequestBody LlmModelSuppliersBo bo) {
        return toAjax(llmModelSuppliersService.insertByBo(bo));
    }

    /**
     * 修改模型供应商
     */
    @SaCheckPermission("ai-llm:model-sup:edit")
    @Log(title = "模型供应商", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping()
    public R<Void> edit(@Validated(EditGroup.class) @RequestBody LlmModelSuppliersBo bo) {
        return toAjax(llmModelSuppliersService.updateByBo(bo));
    }

    /**
     * 删除模型供应商
     *
     * @param ids 主键串
     */
    @SaCheckPermission("ai-llm:model-sup:remove")
    @Log(title = "模型供应商", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空")
                          @PathVariable Long[] ids) {
        return toAjax(llmModelSuppliersService.deleteWithValidByIds(List.of(ids), true));
    }
}
