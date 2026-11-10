# v5notes-client2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a new online desktop note client that retains Markdown and string IDs, then add block commands inside v5md.

**Architecture:** A typed HTTP boundary handles session, response normalization and endpoints; a draft controller owns explicit saves and navigation decisions. Vue pages render navigation and a keyed v5md editor. Tauri wraps the web app through a small window adapter. Block edits belong to the separate v5md repository.

**Tech Stack:** Vue 3, TypeScript, Vite, Tauri 2, @v5md/vue, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-31-v5notes-client2-design.md`

## Global Constraints

- Markdown remains the server content format.
- All backend IDs, including small sentinel IDs, are strings; unsafe numeric IDs are rejected.
- Only top-level blocks move; lists move as a whole.
- Saving is explicit. Switching/closing a dirty note requires save, discard or cancel.
- Do not modify the existing client or the existing server.

## Review Focus

- An unsafe numeric snowflake in a response raises an error, while numeric `total` remains a number (Task 1).
- A failed save leaves the same draft dirty (Task 2).
- Edits arriving during an in-flight save remain dirty (Task 2).
- A canceled or failed navigation never changes the selected note (Task 3).
- A late note load never replaces a newer selection (Task 3).

---

### Task 1: HTTP and identity boundary

**Files:** `v5notes-client2/src/api.ts`, `v5notes-client2/src/identity.ts`, `v5notes-client2/src/identity.test.ts`, project configuration.

**Interfaces:** `createApi(config: () => Connection, onUnauthorized: () => void)` produces `ping`, `login`, `tree`, `list`, `search`, `read`, `create`, `update`, `remove`, `upload`; `normalizeIds<T>(value: T): T` guarantees string IDs.

- [x] Write tests for small IDs, large string IDs, unsafe numeric IDs, and pagination counters.
- [x] Run tests and see missing implementation failure.
- [x] Implement typed fetch boundary and all endpoints, including encrypted login.
- [x] Run tests and typecheck.

### Task 2: Draft save controller

**Files:** `v5notes-client2/src/draft.ts`, `v5notes-client2/src/draft.test.ts`.

**Interfaces:** `Draft` exposes `load(note)`, `edit(markdown)`, `save(write)`, `dirty`, `note`; save snapshots id/content/revision and does not clear newer edits.

- [x] Write tests for save success, concurrent edits, failure and loading without edits.
- [x] Run tests and see missing implementation failure.
- [x] Implement snapshot and revision handling.
- [x] Run tests and typecheck.

### Task 3: Client UI and navigation

**Files:** `v5notes-client2/src/App.vue`, `src/main.ts`, `src/style.css`, `src/window.ts`, `src/navigation.ts`, `src/navigation.test.ts`.

**Interfaces:** `resolveDirty(draft, choose)` returns boolean; the app uses it before selection, logout and close. The keyed `V5Editor` receives content only on note load.

- [x] Write navigation tests for save, discard, cancel and failed save.
- [x] Run tests and see missing implementation failure.
- [x] Implement login, directory, list, search, CRUD, editor, upload and save UI.
- [x] Run tests, typecheck and production build; verify browser flow against a local mock API.

### Task 4: Editor block interactions (separate repository)

**Files:** `v5md/packages/core/src/*`, `v5md/packages/view/src/*`, associated tests. Requires writable access to the separate repository.

**Interfaces:** A core transaction for block conversion, insertion and movement; view menus and handles call those transactions without external `setMarkdown`.

- [x] Write core failing tests for block bounds, source preservation, history, invalid drops, frontmatter and CRLF.
- [x] Implement core block transactions and run tests.
- [x] Write view failing tests for slash, keyboard, selection and IME; drag requires desktop verification.
- [x] Implement view behavior and run tests; verify block movement and save in browser.
- [x] Package the built editor as integrity-pinned local npm tarballs under `v5notes-client2/vendor/v5md/`.
- [x] Run a browser smoke with the user-provided Markdown sample expanded in memory to 12 copies (~20 KB): render mixed Markdown, edit, undo, and save twice through a temporary same-origin mock API. The original file was not changed.
- [ ] Validate Chinese IME, long-document editing and desktop drag behavior against anonymized real notes in the target Tauri WebView; replace the local tarballs with a published package version when released.
