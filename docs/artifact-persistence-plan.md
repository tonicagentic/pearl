# Plan: durable artifacts — blob-backed storage across sessions + a management UI

Problem: written works don't survive across chat sessions. Session 2 cannot
see the draft session 1 wrote.

## Diagnosis

- Each chat session gets its own ephemeral sandbox (a microsandbox VM). The
  written-works rule directs the agent to write pieces to
  `/workspace/<slug>.md` in that sandbox — so the file dies with the session.
- The Blob layer already exists and works: `upload_asset`, `list_assets`,
  `get_asset_info`, `download_asset`, `delete_asset` against Vercel Blob (the
  store is connected; `BLOB_READ_WRITE_TOKEN` is present; ambient OIDC also
  works per the tool docs). Nothing routes the agent's work products into it,
  and nothing in the UI shows what's stored.
- The reference (`vercel-labs/eve-content-agent-template`, the project this
  repo descends from) states the principle plainly: generated files and assets
  live in Vercel Blob.

Confirm before building (Phase 0): in one session write `/workspace/ping.md`;
in a second session show it's absent while `list_assets` still returns
earlier blobs. This pins the failure to sandbox ephemerality, not Blob.

## Target behavior

1. A draft written in any session is loadable, editable, and linkable in every
   later session — by the agent (tools) and by the user (a web page).
2. The canvas keeps working inside the live session (sandbox rendering,
   `file:///workspace/...` links, targeted `edit_file` revisions).
3. The user can browse, preview, download, and delete stored artifacts from
   the web UI without asking the agent.

## Architecture: the sandbox stays the workbench, Blob is the shelf

Keep the sandbox as the working surface (the canvas, targeted `edit_file`
revisions, and the content-research-writer flow all depend on it), and make
Blob the durable store, synced on every write:

```
write_file / edit_file (sandbox, unchanged)
        ↓  sync after each write (new tool)
Vercel Blob  artifacts/<principal-scope>/<slug>.md   ← source of truth
        ↓
UI page /artifacts  (list · preview · download · delete)
```

New session bootstrap: when the user references earlier work, the agent lists
Blob artifacts and pulls the relevant one back into the sandbox before
editing.

### Key design decisions

- **Sync, don't relocate.** A single tool (`save_artifact`) that writes the
  sandbox file through to Blob on every save beats making Blob the only home:
  the canvas and `edit_file` need sandbox paths, and a mid-session draft
  should persist even if the session dies mid-revision. `write_file` is a
  framework tool (not ours), so the sync is an explicit agent step —
  instructed in `instructions.md` and exercised in the eval, not invisible.
- **Principal-scoped keys, following the writer-preferences precedent.**
  `agent/lib/writer-preferences.ts` already owns a reserved Blob prefix with a
  principal-scoped key scheme and a guard keeping the general asset tools out
  of it. Artifacts copy that pattern (`artifacts/<scope>/<slug>.md`) so a
  future multi-user rollout needs no storage migration.
- **Server-side reads for the UI.** The page's API routes do the Blob calls in
  the app runtime behind the app's existing auth; the browser never receives
  Blob credentials. Deletion requires an explicit confirm (mirroring the
  agent's approval-gated `delete_asset`).

## Phases

| Phase | Work | Size |
| --- | --- | --- |
| 0 | Reproduce the failure (two sessions, sandbox vs Blob) to confirm the diagnosis on the record | s |
| A | `save_artifact` tool + `artifacts/` key scheme + reserved-path guard; instructions updated (the written-works rule gains "sync to Blob after each write"; new-session bootstrap: `list_assets` when the user references earlier work) | m |
| B | `/artifacts` page + API routes: list (name, size, uploadedAt), markdown preview for text, download, delete with confirm; empty and error states | m |
| C | Evals: a multi-session eval (write in session 1; session 2 lists, loads, and edits the persisted artifact) and a UI smoke eval | m |
| D | Polish: artifact links in chat that survive the session (`/artifacts/...` alongside `file:///workspace/...`), upload-from-UI if wanted | s |

Phase A is the minimum that fixes the user-visible bug; B is what makes the
store visible; C is the regression guard. The uni-reviews plan
(`docs/unified-reviewer-plan.md`) is unaffected — this storage layer sits under
both the writing flow and the eval suite.

## Open questions (decide at Phase A start)

1. Scope key: single-user (`artifacts/main/`) vs per-principal from day one?
   (Recommend per-principal — the helper already exists.)
2. Should the canvas gain a "stored artifacts" picker, or is the page enough?
3. Retention: any cleanup policy for stale artifacts, or keep everything?
