package xin.v5ai.notes.controller.client;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.core.validate.AddGroup;
import xin.v5ai.common.core.validate.EditGroup;
import xin.v5ai.common.core.validate.QueryGroup;
import xin.v5ai.common.core.validate.SearchGroup;
import xin.v5ai.common.redis.annotation.RepeatSubmit;
import xin.v5ai.common.satoken.utils.LoginHelper;
import xin.v5ai.common.log.annotation.Log;
import xin.v5ai.common.log.enums.BusinessType;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.web.core.BaseController;
import xin.v5ai.notes.domain.bo.ClientNotesBo;
import xin.v5ai.notes.domain.bo.NoteNotesBo;
import xin.v5ai.notes.domain.vo.NewNotesVo;
import xin.v5ai.notes.domain.vo.NoteDirectoryVo;
import xin.v5ai.notes.domain.vo.NoteNotesVo;
import xin.v5ai.notes.domain.vo.NotesContentVo;
import xin.v5ai.notes.domain.vo.NotesSearchVo;
import xin.v5ai.notes.service.INoteDirectoryService;
import xin.v5ai.notes.service.INoteNotesService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 客户端笔记管理
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/client/notes")
public class ClientNotesController extends BaseController {

    private final INoteNotesService noteNotesService;
    private final INoteDirectoryService noteDirectoryService;

    /**
     * 新增笔记
     */
    @Log(title = "笔记", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping()
    public R<Long> add(@Validated(AddGroup.class) @RequestBody NoteNotesBo bo) {
        // 归属校验：非根目录时，目标目录必须属于当前用户
        if (bo.getDirId() != null && bo.getDirId() != 0L && !isOwnDirectory(bo.getDirId())) {
            return R.fail("无权使用该目录");
        }
        Boolean result = noteNotesService.insertByBo(bo);
        if (!result) {
            return R.fail("添加笔记失败");
        }
        return R.ok("添加笔记成功", bo.getId());
    }

    /**
     * 修改笔记
     */
    @Log(title = "笔记", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping()
    public R<Void> edit(@Validated(EditGroup.class) @RequestBody NoteNotesBo bo) {
        // 归属校验：原笔记必须属于当前用户
        NotesContentVo existing = noteNotesService.queryById(bo.getId());
        if (existing == null || !LoginHelper.getUserId().equals(existing.getUserId())) {
            return R.fail("无权操作该笔记");
        }
        // 若目录发生变更，还需校验目标目录归属
        if (bo.getDirId() != null && !bo.getDirId().equals(existing.getDirId())
            && bo.getDirId() != 0L && !isOwnDirectory(bo.getDirId())) {
            return R.fail("无权使用该目录");
        }
        return toAjax(noteNotesService.updateByBo(bo));
    }

    /**
     * 删除笔记
     *
     * @param ids 主键串
     */
    @Log(title = "笔记", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空")
                          @PathVariable Long[] ids) {
        // 归属校验：逐个校验，任一不属于当前用户则拒绝
        for (Long id : ids) {
            NotesContentVo existing = noteNotesService.queryById(id);
            if (existing == null || !LoginHelper.getUserId().equals(existing.getUserId())) {
                return R.fail("无权操作该笔记");
            }
        }
        return toAjax(noteNotesService.deleteWithValidByIds(List.of(ids), true));
    }

    /**
     * 查询笔记列表
     */
    @GetMapping("/list")
    public PageResult<NoteNotesVo> list(@Validated({QueryGroup.class}) ClientNotesBo bo, PageQuery pageQuery) {
        return noteNotesService.queryPageClientList(bo, pageQuery);
    }

    /**
     * 搜索笔记列表
     */
    @GetMapping("/search")
    public R<List<NotesSearchVo>> search(@Validated({SearchGroup.class}) ClientNotesBo bo) {
        return R.ok(noteNotesService.searchNotesList(bo));
    }

    /**
     * 获取笔记详细信息
     *
     * @param id 主键
     */
    @GetMapping("/{id}")
    public R<NotesContentVo> getInfo(@NotNull(message = "主键不能为空")
                                     @PathVariable Long id) {
        NotesContentVo vo = noteNotesService.queryById(id);
        if (vo == null || !LoginHelper.getUserId().equals(vo.getUserId())) {
            return R.fail("无权访问该笔记");
        }
        return R.ok(vo);
    }

    /**
     * 最新笔记(UI左侧最新笔记选项卡的最新笔记)
     * @param pageQuery 分页条件
     * @return
     */
    @GetMapping("/new-notes")
    public PageResult<NewNotesVo> newNotes(PageQuery pageQuery) {
        return noteNotesService.queryPageClientNewNotes(pageQuery);
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
