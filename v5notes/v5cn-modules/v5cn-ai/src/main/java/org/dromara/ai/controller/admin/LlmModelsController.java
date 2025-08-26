package org.dromara.ai.controller.admin;

import java.util.List;

import lombok.RequiredArgsConstructor;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.*;
import cn.dev33.satoken.annotation.SaCheckPermission;
import org.dromara.ai.domain.bo.LlmModelsBo;
import org.dromara.ai.domain.vo.LlmModelsVo;
import org.dromara.ai.service.ILlmModelsService;
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
 * 模型
 *
 * @author Lion Li
 * @date 2025-07-21
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/ai-llm/models")
public class LlmModelsController extends BaseController {

    private final ILlmModelsService llmModelsService;

    /**
     * 查询模型列表
     */
    @SaCheckPermission("ai-llm:models:list")
    @GetMapping("/list")
    public TableDataInfo<LlmModelsVo> list(LlmModelsBo bo, PageQuery pageQuery) {
        return llmModelsService.queryPageList(bo, pageQuery);
    }

    /**
     * 导出模型列表
     */
    @SaCheckPermission("ai-llm:models:export")
    @Log(title = "模型", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(LlmModelsBo bo, HttpServletResponse response) {
        List<LlmModelsVo> list = llmModelsService.queryList(bo);
        ExcelUtil.exportExcel(list, "模型", LlmModelsVo.class, response);
    }

    /**
     * 获取模型详细信息
     *
     * @param id 主键
     */
    @SaCheckPermission("ai-llm:models:query")
    @GetMapping("/{id}")
    public R<LlmModelsVo> getInfo(@NotNull(message = "主键不能为空")
                                     @PathVariable Long id) {
        return R.ok(llmModelsService.queryById(id));
    }

    /**
     * 新增模型
     */
    @SaCheckPermission("ai-llm:models:add")
    @Log(title = "模型", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping()
    public R<Void> add(@Validated(AddGroup.class) @RequestBody LlmModelsBo bo) {
        return toAjax(llmModelsService.insertByBo(bo));
    }

    /**
     * 修改模型
     */
    @SaCheckPermission("ai-llm:models:edit")
    @Log(title = "模型", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping()
    public R<Void> edit(@Validated(EditGroup.class) @RequestBody LlmModelsBo bo) {
        return toAjax(llmModelsService.updateByBo(bo));
    }

    /**
     * 删除模型
     *
     * @param ids 主键串
     */
    @SaCheckPermission("ai-llm:models:remove")
    @Log(title = "模型", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空")
                          @PathVariable Long[] ids) {
        return toAjax(llmModelsService.deleteWithValidByIds(List.of(ids), true));
    }
}
