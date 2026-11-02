# Repository guidance

These rules apply to `v5notes-client2/` and its notes API integrations. Keep the legacy `v5notes-client/` behavior separate unless a task explicitly targets it.

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


