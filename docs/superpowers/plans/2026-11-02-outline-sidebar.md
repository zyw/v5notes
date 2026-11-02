# Outline Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the note outline into a right-side full-height panel that toggles from a toolbar icon.

**Architecture:** Keep V5Editor mounted and use its existing outline instance/API. Place the editor mount and outline area in separate columns within the workspace; control the right panel with the existing outline visibility state. Replace text toggles with an accessible icon button at the far right of the toolbar.

**Tech Stack:** Vue 3, TypeScript, V5Editor, CSS.

**Spec:** `docs/superpowers/specs/2026-11-02-outline-sidebar-design.md`

## Global Constraints

- Change only `v5notes-client2`.
- Preserve the mounted V5Editor and Markdown state.
- Toggle the outline in edit and preview modes.
- Use an inline SVG toggle icon with an accessible label and pressed state.

## Review Focus

- Preview and edit mode transitions keep the outline in the right panel: inspect both modes.
- Hiding the panel gives the editor its width back: inspect both visibility states.
- Focus mode and narrow windows do not cover the editor: inspect the responsive layout.
- Toggle remains keyboard accessible and exposes its state: inspect label and `aria-pressed`.
- V5Editor remains mounted during toggles: confirm the component key and mount location do not change.

---

### Task 1: Move outline into a workspace side panel

**Files:**
- Modify: `v5notes-client2/src/components/EditorPane.vue`
- Modify: `v5notes-client2/src/styles/style.css`

**Interfaces:**
- Consumes: existing `outlineVisible`, `editorInstance`, and `editorHost` workspace context values.
- Produces: a right-side outline panel controlled by `outlineVisible`, while the existing V5Editor stays mounted.

- [x] Remove the text “显示大纲/隐藏大纲” controls in preview and the view menu.
- [x] Add an inline SVG toolbar button at the far right that toggles `outlineVisible` and calls `editorInstance?.setOutlineVisible(outlineVisible)`, with a dynamic accessible label/title and `aria-pressed`.
- [x] Style the editor's existing outline column as a full-height right panel; the editor expands when the panel is hidden.
- [x] Inspect edit, preview, focus, and narrow-window states in the layout rules; the panel and editor share the existing V5Editor mount.
