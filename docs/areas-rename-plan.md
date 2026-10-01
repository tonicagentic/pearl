# Plan: rename "Responsibilities" to "Areas"

Status: proposed, not implemented.

## Naming decisions

- **Areas** replaces **Responsibilities** everywhere a human or the model can
  see it: UI labels, routes, agent-facing copy, type names, database names.
- **Issue** keeps its name. An issue belongs to an area; the open-loops
  concept is unchanged — this is a vocabulary rename, not a redesign.
- The word "responsibility" survives only where it is plain English prose
  about stewardship (e.g. comments explaining the concept), which we rewrite
  to say "area" anyway for consistency.

## Inventory (old → new)

### Database (requires migration 0010)

| Today | After |
| --- | --- |
| table `responsibility` | table `area` |
| `issue.responsibility_id` column | `issue.area_id` |
| index `idx_responsibility_user` | `idx_area_user` |
| unique index `idx_responsibility_sibling_name` | `idx_area_sibling_name` |

- Generate with `pnpm db:generate`. drizzle-kit detects the table rename and
  prompts (needs a TTY): answer **rename**, not create. Column rename is
  prompted the same way.
- Verify the generated SQL is `ALTER TABLE ... RENAME TO` /
  `RENAME COLUMN` — no drop/create, no data loss. Indexes are dropped and
  recreated with the new names; that is non-destructive (rows untouched).
- The race-safe seed's conflict target references the unique index — the
  seed code updates with the rename.

### Types and lib (pure rename, no behavior change)

| Today | After |
| --- | --- |
| `Responsibility`, `ResponsibilityNode`, `ResponsibilityOption` | `Area`, `AreaNode`, `AreaOption` |
| `lib/db/issues.ts`, `lib/issues.ts` | function and field names follow (`responsibilityId` → `areaId`) |
| `lib/db/schema.ts` | table `area`, type `Area` |

### Backend surfaces

- `app/api/issues/route.ts` — route stays `/api/issues` (issue-centric);
  payload type `responsibility tree` → `area tree`.
- `app/actions/issues.ts` — server action names unchanged; `responsibility*`
  fields/types renamed.
- `agent/tools/{create,list,resolve}_issue.ts` + `agent/instructions.md` —
  tool names unchanged; descriptions and prompt copy say "areas".
- Evals (`evals/behavior/open-loops.eval.ts`, `evals/data/*.yaml`) — scenario
  and rubric wording updated; the agent's expected behavior is unchanged.

### Web UI

- Route moves: `/settings/responsibilities` → `/settings/areas`
  (`app/(chat)/settings/responsibilities/` → `app/(chat)/settings/areas/`).
- Files renamed: `responsibility-mindmap.tsx` → `areas-mindmap.tsx`,
  `responsibility-node-editor.tsx` → `area-node-editor.tsx`.
- Sidebar: label "Responsibilities" → "Areas", href + active-state check.
- Issues page copy: area picker labels.

### Mobile

- Route moves: `/responsibilities` → `/areas`
  (`mobile/app/responsibilities.tsx` → `mobile/app/areas.tsx`).
- Drawer link label + href; `mobile/src/issues-client.ts` types/fields;
  issues-screen copy.

### Docs

- `docs/issues-responsibilities-plan.md` is the historical design record for
  the issues feature — keep it as-is (it documents the original naming) and
  add this file as the rename plan.

## Execution order

1. Branch (this branch): `rename/responsibilities-areas`.
2. Schema rename in `lib/db/schema.ts`, generate migration 0010, confirm
   rename-only SQL, apply locally (`pnpm db:migrate`).
3. Mechanical rename across lib/app/agent/evals/docs (types, fields, file
   moves, route moves) — one pass, then grep for stragglers.
4. UI string pass (web + mobile labels, agent copy, evals).
5. Verify: `pnpm typecheck`, 134 behavior tests, `pnpm build`, mobile
   `tsc`/`expo lint`; manual smoke of `/settings/areas` and `/api/issues`.
6. Commit as a single rename commit (reviewable diff is mechanical).

## Rollout

- Local: migrate + verify first.
- Prod: run migration (`pnpm db:migrate:production`) **immediately before**
  deploying the renamed code, then `vercel deploy --prod`. The mismatch
  window (old code + renamed tables, or new code + old tables) is seconds;
  either direction 500s briefly on the issues surfaces only.
- Mobile: the phone build reads the renamed routes from its own bundle, so
  rebuild the device app after merge (Release build, per the established
  flow).
- Web deploys are self-contained; no data backfill is needed — the rename
  preserves every row and relationship.

## Risks

- drizzle-kit's rename detection: if it emits drop/create instead of rename,
  stop and hand-write the SQL — it must be data-preserving.
- The unique sibling-name index uses a `coalesce(parent_id, '__root__')`
  expression; the new index must keep that expression exactly or concurrent
  seeds stop being race-safe.
- Stale references: evals and agent instructions affect model behavior —
  a missed mention silently degrades the open-loops feature rather than
  erroring.
