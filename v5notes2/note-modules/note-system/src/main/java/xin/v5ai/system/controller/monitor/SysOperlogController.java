package xin.v5ai.system.controller.monitor;

import cn.dev33.satoken.annotation.SaCheckPermission;
import com.baomidou.lock.annotation.Lock4j;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.excel.utils.ExcelBuilder;
import xin.v5ai.common.log.annotation.Log;
import xin.v5ai.common.log.enums.BusinessType;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.common.web.core.BaseController;
import xin.v5ai.system.domain.bo.SysOperLogBo;
import xin.v5ai.system.domain.vo.SysOperLogVo;
import xin.v5ai.system.service.ISysOperLogService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 操作日志记录
 *
 * @author Lion Li
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/monitor/operlog")
public class SysOperlogController extends BaseController {

    private final ISysOperLogService operLogService;

    /**
     * 分页查询操作日志记录。
     *
     * @param operLog   查询条件
     * @param pageQuery 分页参数
     * @return 操作日志分页结果
     */
    @SaCheckPermission("monitor:operlog:list")
    @GetMapping("/list")
    public R<PageResult<SysOperLogVo>> list(SysOperLogBo operLog, PageQuery pageQuery) {
        return R.ok(operLogService.selectPageOperLogList(operLog, pageQuery));
    }

    /**
     * 导出操作日志记录列表。
     *
     * @param operLog  查询条件
     * @param response HTTP 响应
     */
    @Log(title = "操作日志", businessType = BusinessType.EXPORT)
    @SaCheckPermission("monitor:operlog:export")
    @PostMapping("/export")
    public void export(SysOperLogBo operLog, HttpServletResponse response) {
        List<SysOperLogVo> list = operLogService.selectOperLogList(operLog);
        ExcelBuilder.of(list, SysOperLogVo.class).sheetName("操作日志").toResponse(response);
    }

    /**
     * 批量删除操作日志记录
     *
     * @param operIds 日志ids
     * @return 操作结果
     */
    @Log(title = "操作日志", businessType = BusinessType.DELETE)
    @SaCheckPermission("monitor:operlog:remove")
    @DeleteMapping("/{operIds}")
    public R<Void> remove(@PathVariable Long[] operIds) {
        return toAjax(operLogService.deleteOperLogByIds(operIds));
    }

    /**
     * 清空操作日志记录。
     *
     * @return 操作结果
     */
    @Log(title = "操作日志", businessType = BusinessType.CLEAN)
    @SaCheckPermission("monitor:operlog:remove")
    @Lock4j
    @DeleteMapping("/clean")
    public R<Void> clean() {
        operLogService.cleanOperLog();
        return R.ok();
    }
}
