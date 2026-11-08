package xin.v5ai.notes.controller.client;

import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.log.annotation.Log;
import xin.v5ai.common.log.enums.BusinessType;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.common.satoken.utils.LoginHelper;
import xin.v5ai.common.web.core.BaseController;
import xin.v5ai.notes.domain.vo.NoteTrashEmptyVo;
import xin.v5ai.notes.domain.vo.NoteTrashItemVo;
import xin.v5ai.notes.domain.vo.NoteTrashRestoreVo;
import xin.v5ai.notes.service.INoteTrashService;

/**
 * 客户端回收站。路径独立于 /client/notes/{id}，避免被笔记详情路由接住。
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/client/notes/trash")
public class ClientNotesTrashController extends BaseController {

    private final INoteTrashService noteTrashService;

    @GetMapping
    public R<PageResult<NoteTrashItemVo>> list(PageQuery pageQuery) {
        return R.ok(noteTrashService.list(LoginHelper.getUserId(), pageQuery));
    }

    @Log(title = "回收站", businessType = BusinessType.UPDATE)
    @PostMapping("/{id}/restore")
    public R<NoteTrashRestoreVo> restore(@PathVariable Long id) {
        NoteTrashRestoreVo restored = noteTrashService.restore(id, LoginHelper.getUserId());
        if (Boolean.TRUE.equals(restored.getRelocated())) {
            return R.ok("原目录已不在，已恢复到根目录", restored);
        }
        return R.ok(restored);
    }

    @Log(title = "回收站", businessType = BusinessType.DELETE)
    @DeleteMapping("/{id}")
    public R<Void> purge(@PathVariable Long id) {
        noteTrashService.purge(id, LoginHelper.getUserId(), false);
        return R.ok();
    }

    @Log(title = "回收站", businessType = BusinessType.CLEAN)
    @DeleteMapping
    public R<NoteTrashEmptyVo> empty() {
        int failed = noteTrashService.empty(LoginHelper.getUserId());
        NoteTrashEmptyVo result = new NoteTrashEmptyVo();
        result.setFailed(failed);
        if (failed == 0) {
            return R.ok(result);
        }
        return R.ok(failed + " 条清除失败", result);
    }
}
