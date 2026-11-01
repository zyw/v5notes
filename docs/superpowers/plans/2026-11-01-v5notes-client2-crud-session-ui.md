# v5notes-client2 Workspace and CRUD Plan

**Goal:** Fix session restoration and complete the editor-first CRUD experience shown in the supplied screenshot.

**Scope:** v5notes-client2 plus root AGENTS.md guidance. Reuse the existing notes backend endpoints; no API changes unless implementation reveals a contract mismatch.

### Task 1: Session persistence and refresh restoration

**Files:** Modify `v5notes-client2/src/App.vue`.

- [ ] Persist the access token and username after successful login; never persist the password.
- [ ] Restore the token, selected directory, note list, and last opened note after reload.
- [ ] Clear persisted authentication on logout and remove an expired token on 401 while preserving the current in-memory draft.
- [ ] Retain server URL and protect restoration from switching to another server/account.

### Task 2: Editor layout and brand

**Files:** Add `v5notes-client2/src/assets/brand-icon.png`; modify `src/App.vue` and `src/style.css`.

- [ ] Use the dark teal note icon variant as the sidebar mark.
- [ ] Reduce sidebar/list widths, remove the duplicate large title above the editor, and let the editor canvas use the available workspace height and width.
- [ ] Ensure focus mode hides both navigation panes and restores the prior pane state on exit.

### Task 3: In-app dialogs and CRUD

**Files:** Modify `v5notes-client2/src/App.vue`, `src/DirectoryItem.vue`, and `src/style.css`.

- [ ] Replace all browser prompt/confirm dialogs with one reusable styled dialog state for name forms and destructive confirmation.
- [ ] Wire note and directory create, rename, and delete flows to existing API methods; show validation/server failures in the dialog.
- [ ] Warn that deleting a directory recursively deletes descendant directories and notes; clear stale editor and persisted-note state after deletion.
- [ ] Preserve dirty-draft confirmation before destructive navigation or actions.

### Task 4: Agent guidance and verification

**Files:** Create root `AGENTS.md`; update this plan.

- [ ] Record visual layout, modal, CRUD, session, API, and string-ID standards.
- [ ] Run the client production build and inspect the final changes.

