package xin.v5ai.notes.service;

/**
 * 保存时是否追加历史版本。预览勾选等静默保存只更新正文，不占用 50 条配额。
 */
public final class NoteRevisionRules {

    private NoteRevisionRules() {
    }

    public static boolean appendOnSave(boolean contentChanged, Boolean skipHistory) {
        return contentChanged && !Boolean.TRUE.equals(skipHistory);
    }
}
