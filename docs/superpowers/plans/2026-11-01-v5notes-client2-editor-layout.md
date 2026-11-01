# v5notes-client2 Editor-First Workspace Plan

> **For agentic workers:** Follow the repository's approved client2 design. This focused UI change preserves the API, draft/save behavior, and Markdown editor contract.

**Goal:** Give the editor substantially more usable window space while retaining fast access to navigation.

**Architecture:** Keep directory and note-list panes, make each collapsible, and add an editor focus mode that hides both. The editor canvas uses available width with a readable maximum text measure and enough left gutter for block handles.

**Tech Stack:** Vue 3, TypeScript, CSS, Vite.

## Tasks

### Task 1: Workspace pane controls

**Files:** Modify `v5notes-client2/src/App.vue`, `v5notes-client2/src/style.css`.

- [x] Add reactive pane visibility and focus-mode state.
- [x] Add accessible toolbar controls to toggle the directory pane, note list, and focus mode; provide a clear way to restore navigation while focused.
- [x] Replace fixed three-column sizing with grid states that preserve the editor's minimum width and hide collapsed panes cleanly.
- [x] Preserve existing navigation, note actions, dirty handling, and editor mounting behavior.

### Task 2: Editor-first visual hierarchy

**Files:** Modify `v5notes-client2/src/App.vue`, `v5notes-client2/src/style.css`.

- [x] Refine the editor toolbar into a compact application bar with note identity, save state, and primary save action.
- [x] Increase the available canvas width and vertical writing area; retain a comfortable maximum line width and block-handle gutter.
- [x] Add responsive breakpoints that automatically favor the editor and keep navigation reachable in narrow windows.
- [x] Ensure the empty state still offers an obvious path to browse or create a note.

### Verification

- [x] Run `npm run build` in `v5notes-client2`.
- [x] Inspect the resulting diff to confirm no API, save-controller, or editor behavior changes.

