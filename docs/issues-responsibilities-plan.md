# Plan: Issues — bounded "open loops" for responsibilities

Job statement (guards scope): initial state — "I am holding an unresolved
responsibility in my head because I don't trust that I'll remember it at the
appropriate time." Desired state — "The unresolved responsibility is recorded,
associated with the relevant area of my life, and will return to my attention
when action becomes appropriate."

Every proposed feature must serve that state change. It is the test against
scope creep.

## Conceptual model

An **Issue** is an unresolved responsibility that requires future attention
before it can be considered settled. It is not a task: "email Quincy" is a
task; "resolve the rent situation with Quincy" is the Issue. Issues are
temporary unresolved states attached to a stable structure:

**Responsibilities** describe the relatively stable structure of the user's
life (an enduring area of stewardship — never "completed"):

```
Life
├── Health
├── Relationships
│   ├── Family
│   ├── Friends
│   └── Intimacy
├── Career
│   └── Tonic
├── Finances
└── Home
```

Responsibilities answer "what am I responsible for?" Issues answer "what
within those responsibilities currently needs resolution?"

## Dates, not states

Two optional dates carry the psychology of the tool:

- `dueDate` — when does this need to be resolved?
- `reviewDate` — when should this become active in my attention?

The distinction is the product: taxes due Oct 15 must return to attention
*before* Oct 15. Putting something down means the system has an explicit
contract to surface it again.

The issue lifecycle is therefore **derived, never stored**:

```
Captured → Dormant → Active → Resolved
```

- Resolved: `resolvedAt` is set.
- Active: not resolved, and "now" is at/after the effective attention date
  (`reviewDate ?? dueDate`, or no dates at all — an undated open issue is
  active; it was captured because it nags).
- Dormant: not resolved and `reviewDate` is in the future (deliberately
  parked; it will come back).

No status enum beyond `open`/`resolved`; everything else derives from dates.

## Explicitly out of scope (v1)

Tasks/subtasks, projects, reminders/push, priorities, tags, dependencies,
recurring issues, financial amounts, contacts, attachments, elaborate
statuses, a mind-map canvas. Each fails the job-statement test or defers to a
different system: the Issue is the common representation of "there's
something here I need to deal with", not the place where life data lives.
Finances, calendar, health, and travel stay their own systems and create or
resolve Issues when something actually needs intervention.

## Data model (v1)

Two objects, minimal fields. `userId` scopes every row to the principal
(`user.id` from better-auth), matching `lib/db/schema.ts` conventions.

```ts
// lib/db/schema.ts (new tables)
export const responsibility = pgTable("responsibility", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  parentId: uuid("parent_id"), // self-reference, set-null on delete; FK added via laterMigration
  sortIndex: integer("sort_index").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const issue = pgTable("issue", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  responsibilityId: uuid("responsibility_id").notNull().references(() => responsibility.id),
  status: text("status", { enum: ["open", "resolved"] }).notNull().default("open"),
  dueDate: date("due_date"),
  reviewDate: date("review_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});
```

Notes:

- Dates as `date` (calendar semantics — no time zones bleeding into "due
  soon"); instants as `timestamptz`.
- Deleting a responsibility: only allowed when it has no open issues (server
  action checks); `parentId` self-reference goes in a follow-up migration to
  keep the first migration acyclic-simple. Cascade semantics: deleting a
  subtree requires resolving or re-parenting open issues first.
- Index on `(user_id, status)`; the inbox sorts by `COALESCE(review_date,
  due_date)` then `due_date`.

## Derived state helper

One shared module, used by UI and agent tools alike:

```ts
// lib/issues.ts
type DerivedState = "active" | "dormant" | "resolved";
function issueState(issue, now = new Date()): DerivedState
// resolved → "resolved"
// reviewDate > today → "dormant"
// else → "active"
```

Inbox grouping rules (v1, simple and readable):

- "Due soon": open, sorted by `due_date` ascending, due within 14 days or
  overdue (overdue rows flagged, never hidden).
- "Later": open with no `dueDate`, or `dueDate` beyond 14 days and
  `reviewDate` in the past.
- "Parked": open with `reviewDate` in the future (collapsed by default; the
  contract is that they return on their review date).

## UI

Web-only for v1 (the mobile app keeps its single-thread focus; an RN inbox is
a later parity item).

1. **`app/(chat)/issues/page.tsx`** — the inbox. Server component; groups per
   the rules above; each row: title, due date, responsibility name.
   `+ New issue` opens a small form (title, responsibility select,
   description, dueDate, reviewDate). Clicking a row opens a detail panel
   with only: title, description/notes, responsibility, due date, review
   date, and **Resolve** (and Edit). Resolve is a server action
   (`app/actions/issues.ts`) setting `status: "resolved"`, `resolvedAt: now`;
   the panel stays open with an "Undo" affordance in v1.1 rather than a
   separate archive view.
2. **`app/(chat)/settings/responsibilities/page.tsx`** — the tree editor. The
   structure is just `parentId`, so v1 renders a nested list (indent + drag
   is out of scope): rename, add child, delete (blocked while open issues
   exist), reorder within siblings. Default tree (root visualized as a mind
   map: Responsibilities → Body / Mind / Career / People / Home / Finances /
   Activity with their sub-areas — see `DEFAULT_RESPONSIBILITIES` in
   `lib/db/issues.ts`) is seeded idempotently on first visit —
   `responsibilities` are never empty, so issues always have a home. The
   same tree renders above the editor as a Mermaid mind map.
3. **Navigation** — an "Issues" entry in the `(chat)` sidebar next to
   Artifacts; responsibilities lives under the existing Settings page.

## Agent integration

The agent gets one clean primitive, not a life database:

> What unresolved things currently require the user's attention, and which
> areas of responsibility do they belong to?

New tools in `agent/tools/` (principal from `ctx.session.auth.current`, never
model input — same pattern as the writer-preferences tools):

| Tool | Input | Behavior | Approval |
| --- | --- | --- | --- |
| `list_issues` | `{ state?: "active" \| "dormant" \| "resolved" }` | Returns the user's issues with derived state; defaults to active-first ordering | not needed (read-only, own data) |
| `create_issue` | `{ title, responsibilityName?, description?, dueDate?, reviewDate? }` | Creates an issue; `responsibilityName` is matched case-insensitively against the user's tree, and a missing one creates it under the best-matching parent (or Life) | not needed (capture must be frictionless) |
| `resolve_issue` | `{ issueId }` or `{ titleSubstring }` | Sets resolved | always() — irreversible-ish, mirrors delete_asset |

Tool descriptions carry the scoping language (an Issue is an unresolved
responsibility, not a task), so the agent declines "track my monthly
spending" style requests into the right system instead.

`agent/instructions.md` gains a short "Open loops" section: when the user
mentions something unresolved that will need future attention, offer to
capture it as an Issue with a review date ("when should this come back to
you?"); when the user asks what needs attention, answer from `list_issues`.
Resurfacing (notification when a review date arrives) is a later phase — the
inbox plus the agent's session-start greeting from active issues is the v1
contract.

## Evals

Behavior evals (mirroring `evals/behavior/` conventions):

- `capture-open-loop.eval.ts`: "I still need to deal with the rent thing with
  Quincy" → creates an Issue with the Home responsibility, asks for/derives a
  review date, does not create a task file or a reminder.
- `scope-guard.eval.ts`: "track my monthly spending" → declines to store it
  as an Issue; explains the boundary.
- `attention-query.eval.ts`: "what needs my attention?" → answers from
  `list_issues`, grouped by responsibility, honors dormancy (a parked issue
  is not reported as active).
- `resolve-flow.eval.ts`: "the rent situation is settled" → resolves the
  matching Issue (approval-gated), leaves the responsibility structure
  untouched.

## Phases

1. **Phase 1 — structure.** Schema + migration; responsibilities tree editor
   page with idempotent default seeding; `lib/issues.ts` state helper. No
   agent involvement.
2. **Phase 2 — inbox.** Issues CRUD via server actions; inbox page with
   grouping and detail panel; Resolve/undo.
3. **Phase 3 — agent.** `list_issues` / `create_issue` / `resolve_issue`
   tools, instructions section, behavior evals.
4. **Phase 4 — later.** Review-date resurfacing (notification /
   session-start surfacing), mind-map visualization of responsibilities,
   mobile inbox, integrations creating Issues (calendar, finances).
