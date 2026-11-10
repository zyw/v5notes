# v5notes-client2 Workspace and CRUD Plan

**Goal:** Fix session restoration and implement the editor-first two-column layout with a nested note tree and explicit preview/edit modes.

**Scope:** v5notes-client2 plus root AGENTS.md guidance. Reuse the existing notes backend endpoints; no API changes unless implementation reveals a contract mismatch.

### Task 1: Session persistence and refresh restoration

**Files:** Modify `v5notes-client2/src/App.vue`.

- [x] Persist the access token and username after successful login; never persist the password.
- [x] Restore the token, selected directory, and last opened note into the tree/editor after reload.
- [x] Clear persisted authentication on logout and remove an expired token on 401 while preserving the current in-memory draft.
- [x] Retain server URL and protect restoration from switching to another server/account.

### Task 2: Editor layout and brand

**Files:** Add `v5notes-client2/src/assets/brand-icon.png`; modify `src/App.vue` and `src/style.css`.

- [x] Use the dark teal note icon variant as the sidebar mark.
- [x] Replace the separate directory and note-list panes with one compact tree containing both directories and notes.
- [x] Open selected notes in read-only preview mode and expose a clear edit action; preserve the mounted editor and save dirty drafts before returning to preview.
- [x] Remove the duplicate large title above the editor and let the editor canvas use the available workspace height and width.
- [x] Make the single sidebar toggleable and let focus mode expand the editor across the window.
- [x] Replace platform-dependent tree glyphs with consistent SVG folder, note, and disclosure icons; keep logout only in the sidebar footer.
- [x] Hide rename, delete, and focus controls in preview mode, and remove outer horizontal padding from the editor in edit mode.

### Task 3: In-app dialogs and CRUD

**Files:** Modify `v5notes-client2/src/App.vue`, replace `src/DirectoryItem.vue` with `src/TreeItem.vue`, and modify `src/style.css`.

- [x] Replace all browser prompt/confirm dialogs with one reusable styled dialog state for name forms and destructive confirmation.
- [x] Wire note and directory create, rename, and delete flows to existing API methods; show validation/server failures in the dialog.
- [x] Warn that deleting a directory recursively deletes descendant directories and notes; clear stale editor and persisted-note state after deletion.
- [x] Preserve dirty-draft confirmation before destructive navigation or actions.

### Task 4: Agent guidance and verification

**Files:** Create root `AGENTS.md`; update this plan.

- [x] Record visual layout, modal, CRUD, session, API, and string-ID standards.
- [x] Run the client production build and inspect the final changes.

