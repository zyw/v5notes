package org.dromara.basics.file.admin.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.dromara.basics.file.domain.bo.FileConfigBo;
import org.dromara.basics.file.domain.bo.FileConfigSearchBo;
import org.dromara.basics.file.domain.vo.FileConfigVo;
import org.dromara.basics.file.service.IFileConfigService;
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
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 文件存储配置接口
 *
 * @author ZYW
 * @date 2024-04-10
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/basics/admin/file-config")
public class FileConfigController extends BaseController {

    private final IFileConfigService fileConfigService;

    /**
     * 查询文件配置列表
     */
    @SaCheckPermission("basics:fileConfig:list")
    @GetMapping("/list")
    public TableDataInfo<FileConfigVo> list(FileConfigSearchBo bo, PageQuery pageQuery) {
        return fileConfigService.queryPageList(bo, pageQuery);
    }

    /**
     * 导出文件配置列表
     * Excel导出嵌套对象，hutool工具类封装了复杂的Excel导出功能，可以直接使用
     */
    @SaCheckPermission("basics:fileConfig:export")
    @Log(title = "文件配置", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(FileConfigSearchBo bo, HttpServletResponse response) {
        List<FileConfigVo> list = fileConfigService.queryList(bo);
        ExcelUtil.exportExcel(list, "文件配置", FileConfigVo.class, response);
    }

    /**
     * 获取文件配置详细信息
     *
     * @param id 主键
     */
    @SaCheckPermission("basics:fileConfig:query")
    @GetMapping("/{id}")
    public R<FileConfigVo> getInfo(@NotNull(message = "主键不能为空")
                                     @PathVariable Long id) {
        return R.ok(fileConfigService.queryById(id));
    }

    /**
     * 新增文件配置
     */
    @SaCheckPermission("basics:fileConfig:add")
    @Log(title = "文件配置", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping()
    public R<Void> add(@Validated(AddGroup.class) @RequestBody FileConfigBo bo) {
        return toAjax(fileConfigService.insertByBo(bo));
    }

    /**
     * 修改文件配置
     */
    @SaCheckPermission("basics:fileConfig:edit")
    @Log(title = "文件配置", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping()
    public R<Void> edit(@Validated(EditGroup.class) @RequestBody FileConfigBo bo) {
        return toAjax(fileConfigService.updateByBo(bo));
    }

    /**
     * 删除文件配置
     *
     * @param ids 主键串
     */
    @SaCheckPermission("basics:fileConfig:remove")
    @Log(title = "文件配置", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空")
                          @PathVariable Long[] ids) {
        return toAjax(fileConfigService.deleteWithValidByIds(List.of(ids), true));
    }

    /**
     * 更新文件配置主配置
     * @param id
     * @return
     */
    @SaCheckPermission("basics:fileConfig:edit")
    @Log(title = "文件配置主配置", businessType = BusinessType.UPDATE)
    @PutMapping("/master/{id}")
    public R<Void> updateFileConfigMaster(@PathVariable("id") Long id) {
        return toAjax(fileConfigService.updateFileConfigMaster(id));
    }
}
