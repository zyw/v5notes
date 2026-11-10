package xin.v5ai.notes.controller.admin;

import cn.dev33.satoken.annotation.SaCheckPermission;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.web.core.BaseController;
import xin.v5ai.notes.domain.vo.dashboard.DashboardOverviewVo;
import xin.v5ai.notes.service.INoteDashboardService;

/**
 * 首页聚合统计
 * <p>
 * 权限点：{@code notes:dashboard:query}（sys_menu 类型 F，挂在「云笔记」下，见
 * {@code db/migration/common/V4__dashboard_permission.sql}）。
 *
 * @author v5notes2
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/notes/dashboard")
public class NoteDashboardController extends BaseController {

    private final INoteDashboardService dashboardService;

    /**
     * 首页聚合统计
     *
     * @param range 趋势窗口天数（7 / 30 / 90，默认 30，越界按 30 处理）
     * @return 完整结构的首页数据
     */
    @SaCheckPermission("notes:dashboard:query")
    @GetMapping("/overview")
    public R<DashboardOverviewVo> overview(@RequestParam(defaultValue = "30") Integer range) {
        return R.ok(dashboardService.overview(range));
    }
}