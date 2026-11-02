# Outline sidebar design

- Intent: make the note outline independently accessible beside the editor, like a collapsible VS Code side panel.
- UI: add a compact panel-toggle icon at the far right of the editor header. The icon toggles a full-height right outline sidebar; remove the text “显示大纲/隐藏大纲” controls.
- Behavior: keep the existing outline visibility state and V5Editor outline data; when visible, the editor and outline occupy separate columns, and the outline fills the available height. The outline can be toggled in edit and preview modes.
- Constraints: change only `v5notes-client2`; keep the mounted V5Editor instance and existing Markdown state intact; use an inline SVG icon with an accessible label and pressed state.
- Builder calls: sidebar width and responsive collapse behavior follow the existing workspace layout conventions.
