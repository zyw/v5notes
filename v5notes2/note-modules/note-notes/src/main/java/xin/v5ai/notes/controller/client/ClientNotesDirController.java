package xin.v5ai.notes.controller.client;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.core.validate.AddGroup;
import xin.v5ai.common.core.validate.EditGroup;
import xin.v5ai.common.redis.annotation.RepeatSubmit;
import xin.v5ai.common.satoken.utils.LoginHelper;
import xin.v5ai.common.log.annotation.Log;
import xin.v5ai.common.log.enums.BusinessType;
import xin.v5ai.common.web.core.BaseController;
import xin.v5ai.notes.domain.bo.NoteDirectoryBo;
import xin.v5ai.notes.domain.vo.NoteDirectoryVo;
import xin.v5ai.notes.domain.vo.NotesTreeVo;
import xin.v5ai.notes.service.INoteDirectoryService;
import xin.v5ai.notes.service.INoteTrashService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 客户端目录
 * @author ZYW
 * @date 2024-10-25
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/client/notes/dir")
public class ClientNotesDirController extends BaseController {

    private final INoteDirectoryService noteDirectoryService;
    private final INoteTrashService noteTrashService;

    /**
     * 新增目录
     * @param bo
     * @return
     */
    @Log(title = "Client目录", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping()
    public R<Void> add(@Validated(AddGroup.class) @RequestBody NoteDirectoryBo bo) {
        // 归属校验：非根目录时，父目录必须属于当前用户
        if (bo.getPid() != null && bo.getPid() != 0L && !isOwnDirectory(bo.getPid())) {
            return R.fail("无权使用该父目录");
        }
        return toAjax(noteDirectoryService.insertByBo(bo));
    }

    /**
     * 编辑目录（重命名）
     * @param bo
     * @return
     */
    @Log(title = "Client目录", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping()
    public R<Void> edit(@Validated(EditGroup.class) @RequestBody NoteDirectoryBo bo) {
        // 归属校验：原目录必须属于当前用户
        NoteDirectoryVo existing = noteDirectoryService.queryById(bo.getId());
        if (existing == null || !LoginHelper.getUserId().equals(existing.getUserId())) {
            return R.fail("无权操作该目录");
        }
        // 若父目录发生变更，还需校验新父目录归属
        if (bo.getPid() != null && !bo.getPid().equals(existing.getPid())
            && bo.getPid() != 0L && !isOwnDirectory(bo.getPid())) {
            return R.fail("无权使用该父目录");
        }
        return toAjax(noteDirectoryService.updateByBo(bo));
    }

    /**
     * 删除目录
     * @param ids
     * @return
     */
    @Log(title = "Client目录", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空")
                          @PathVariable Long[] ids) {
        noteTrashService.moveDirectories(List.of(ids), true);
        return R.ok();
    }

    /**
     * 获取目录详细信息
     *
     * @param id 主键
     */
    @GetMapping("/{id}")
    public R<NoteDirectoryVo> getInfo(@NotNull(message = "主键不能为空")
                                      @PathVariable Long id) {
        NoteDirectoryVo vo = noteDirectoryService.queryById(id);
        if (vo == null || !LoginHelper.getUserId().equals(vo.getUserId())) {
            return R.fail("无权访问该目录");
        }
        return R.ok(vo);
    }

    /**
     * 目录树
     * @return
     */
    @GetMapping("/tree-dir")
    public R<List<NotesTreeVo>> dirTreeList() {
        return R.ok(noteDirectoryService.dirTreeList(LoginHelper.getUserId()));
    }

    /**
     * 目录和笔记树
     * @return
     */
    @GetMapping("/tree")
    public R<List<NotesTreeVo>> notesTreeList() {
        return R.ok(noteDirectoryService.notesTreeList(LoginHelper.getUserId()));
    }

    /**
     * 判断目录是否存在且属于当前登录用户。
     *
     * @param dirId 目录ID
     * @return true=属于当前用户
     */
    private boolean isOwnDirectory(Long dirId) {
        NoteDirectoryVo dir = noteDirectoryService.queryById(dirId);
        return dir != null && LoginHelper.getUserId().equals(dir.getUserId());
    }
}
