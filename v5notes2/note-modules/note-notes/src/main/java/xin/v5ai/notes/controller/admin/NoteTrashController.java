package xin.v5ai.notes.controller.admin;

import xin.v5ai.common.core.utils.MessageUtils;
import cn.dev33.satoken.annotation.SaCheckPermission;
import jakarta.validation.constraints.NotEmpty;
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
import xin.v5ai.common.web.core.BaseController;
import xin.v5ai.notes.domain.vo.NoteTrashEmptyVo;
import xin.v5ai.notes.domain.vo.NoteTrashItemVo;
import xin.v5ai.notes.domain.vo.NoteTrashRestoreVo;
import xin.v5ai.notes.service.INoteTrashService;

/**
 * 管理端回收站。列出全部用户的删除记录，恢复到记录所属用户的目录树。
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/notes/trash")
public class NoteTrashController extends BaseController {

    private final INoteTrashService noteTrashService;

    @SaCheckPermission("notes:trash:list")
    @GetMapping("/list")
    public R<PageResult<NoteTrashItemVo>> list(String name, String objectType, String userName, PageQuery pageQuery) {
        return R.ok(noteTrashService.listForAdmin(name, objectType, userName, pageQuery));
    }

    @SaCheckPermission("notes:trash:restore")
    @Log(title = "回收站", businessType = BusinessType.UPDATE)
    @PostMapping("/{id}/restore")
    public R<NoteTrashRestoreVo> restore(@PathVariable Long id) {
        NoteTrashRestoreVo restored = noteTrashService.restoreForAdmin(id);
        if (Boolean.TRUE.equals(restored.getRelocated())) {
            return R.ok(MessageUtils.message("note.restore.root"), restored);
        }
        return R.ok(restored);
    }

    @SaCheckPermission("notes:trash:remove")
    @Log(title = "回收站", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public R<Void> purge(@NotEmpty(message = "{id.not.null}") @PathVariable Long[] ids) {
        for (Long id : ids) {
            noteTrashService.purge(id, null, false);
        }
        return R.ok();
    }

    @SaCheckPermission("notes:trash:clean")
    @Log(title = "回收站", businessType = BusinessType.CLEAN)
    @DeleteMapping("/empty")
    public R<NoteTrashEmptyVo> empty() {
        int failed = noteTrashService.emptyAll();
        NoteTrashEmptyVo result = new NoteTrashEmptyVo();
        result.setFailed(failed);
        if (failed == 0) {
            return R.ok(result);
        }
        return R.ok(MessageUtils.message("note.purge.failed", failed), result);
    }
}
