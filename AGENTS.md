# Repository guidance

以下「前端设计规则」适用于 `v5notes-admin2/` 和 `v5notes-clients/` 下所有前端项目。凡改动这些项目的界面，或新增、修改用户可见的文案，都按这三条规则执行。其余规则仅适用于 `v5notes-clients/v5notes-client2/` 及其笔记 API 集成。除非任务明确涉及旧版 `v5notes-client/`，否则保持其行为独立。

## 前端设计规则

### 1. 界面上只放用户需要的东西

每一块辅助标签、说明文字、状态行都必须回答：没有它，用户会不会做错事？回答不了的就删掉。必要的表单标签、校验与错误信息、破坏性操作的后果说明及无障碍名称仍须保留。

- 工具条、块菜单、表格工具条中的辅助操作用图标加 `aria-label`；现有规则要求显式呈现的关键操作（如预览中的「编辑」）保留文字。`title` 只用于补充信息。
- 页面不写标语、副标题、功能介绍或「这是某某版本」之类的身份说明。
- 状态由控件自身呈现：主题选中态在主题项上，模式切换在切换按钮上，字号在字号控件上，导出结果在导出按钮上；页面顶部不设独立状态行。
- 用户可见文案尽量只留操作名。空状态、加载态优先用图形与骨架表达，并提供必要的无障碍状态文本。

### 2. 让布局本身发挥解释作用

用户应从位置、分组、层级和对齐读出结构，而不是依赖旁白。

- 结构与控件同构：目录层级用树缩进，当前笔记用树选中态，块操作入口靠近光标或当前块，表格行操作靠近当前行。
- 当前态、悬停态、禁用态和焦点环先用空间与视觉层级表达，再考虑文字。
- 入口留在原地按需出现，例如悬停、聚焦或选中时淡入；常驻辅助面板应易于收起，默认让内容成为焦点。
- 同一类控件在后台和客户端项目中保持一致的分组、顺序和交互反馈。

### 3. 少写说明书，多花心思在 UI 和交互上

「用户需要被告知」是一种需求信号：先检查交互能否解决，再调整布局，最后才补文案。修复顺序是交互 → 布局 → 文案。

- 新增或改动控件时，同时补全悬停反馈、键盘路径、适用的快捷键提示（如查找、斜杠菜单、块操作）和空状态。
- 被动提示用交互表达：失效操作在执行位置就地解释，可撤销的改动提供撤销入口，而不是先弹一段说明。
- 常驻的一句说明，意味着交互还欠一次设计。
- 交互细节补全前，不用说明文字兜底。

## Page layout

- Treat the Markdown reading and editing canvas as the primary workspace. Use one compact left sidebar (about 260–290px on desktop) containing search, create actions, and a single nested tree of directories and notes; the editor receives all remaining width.
- Use the combined directory-and-note tree endpoint. Directory rows expand or collapse and expose add, rename, and delete actions. Note rows open that note in read-only preview mode.
- Show an explicit “编辑” action in preview mode. Entering and leaving preview must reuse the mounted V5Editor instance so the Markdown state and undo history are retained. Switching to preview with unsaved changes must save successfully first; keep the user in edit mode if saving fails.
- Keep preview mode actions compact: show the preview state and “编辑”; hide note rename, delete, and focus-writing controls until edit mode. Keep logout in one location at the bottom of the sidebar.
- Use consistent inline SVG folder, note, and disclosure icons in the tree; avoid text glyphs that vary by platform.
- Keep the tree sidebar toggleable. Focus mode hides the sidebar and expands the editor to the full available window, with a visible way to restore navigation or exit focus mode.
- Let the editor canvas use the available width and height. In edit mode, remove outer horizontal padding so the editor toolbar and canvas span the full main area; preserve only editor-internal spacing needed for readable content and block handles. Do not render a second large note title above the editor; show the note name once in the compact toolbar.
- Use an approved `src/assets` logo variant that matches the muted green and warm-white client palette. Do not recreate the mark with styled text when an image asset exists.

## Session and identity

- Restore the workspace after a WebView/browser refresh using the saved server and access token; restore the last directory and note when they are still available.
- Never persist the user's password. Remove the stored access token on explicit logout and when the server reports 401. Preserve unsaved in-memory content when asking the user to reauthenticate.
- Treat every backend snowflake ID as a string from response parsing through Vue state, URL construction, and request payloads. Never coerce IDs to JavaScript `number`.

## Dialog and form standard

- Use the client’s in-app modal components for forms, confirmations, and unsaved-change decisions. `window.alert`, `window.confirm`, and `window.prompt` are not part of the UI.
- A form dialog has a clear title, labeled controls, inline validation and server errors, Cancel, and one primary submit action. Trim required names and enforce the backend's 100-character name limit.
- A destructive confirmation names the object and explains the consequence. Directory deletion must state that it recursively deletes child directories and notes. Use the danger action style for irreversible operations.
- Dialogs use `role="dialog"`, `aria-modal="true"`, keyboard dismissal with Escape where cancellation is safe, and keep the page state unchanged when canceled or when the request fails.
- Save or explicitly resolve a dirty draft before navigation or destructive changes. Keep the draft available on save failure.

## CRUD and API

- Use the existing `/client/notes` and `/client/notes/dir` APIs for note and directory create, rename, and delete. Inspect their request and response contracts before adding endpoints; add backend APIs only when a required operation is genuinely unsupported.
- After successful create, rename, or delete, refresh the affected list/tree and keep selection consistent. A failed mutation leaves the dialog open with an inline error and leaves the selected object intact; report a refresh failure separately when the mutation already succeeded.
- The existing directory DELETE endpoint recursively deletes all descendant directories and notes. Clear an open note and persisted selection if it is within that deleted subtree.
- Keep API calls in `src/api.ts`; components handle user interaction and presentation rather than constructing endpoint URLs.

## CRUD flow

1. Open a labeled in-app form or confirmation.
2. Validate locally and show field-level or dialog-level errors without closing the dialog.
3. Apply the existing dirty-draft guard where navigation or deletion could discard edited content.
4. Call the API and wait for success.
5. After the mutation succeeds, close the dialog, refresh affected data, and update selection. On mutation failure, preserve the current state and show the server message in the dialog.


