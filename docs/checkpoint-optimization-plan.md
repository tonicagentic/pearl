# Plan: checkpoint and turn-latency optimization

Symptom: turns take a long time to process messages and sometimes read as
never finishing. Diagnosis (2026-09-23, on the record):

1. `workflow.modelCallsPerStep` is unset, so the default `1` checkpoints after
   **every model call**. Each checkpoint serializes the full durable session
   state and dispatches the next step through the workflow queue — a silent
   gap in the stream per model call, multiplied by turn length.
2. `write_file`/`edit_file` poll up to ~20s for the browser's chat-row link
   **inside the durable step** on new chats.
3. The client persists **one server action per streamed event**
   (`onEvent: persistStreamEvent` → `appendChatEventAction`): ~6 POSTs/second
   observed in production logs during an active turn.
4. The new `onSession` Blob restore fetches without a timeout.

Also verified *not* a bug: follow-up messages do resolve parked
`ask_question` turns (recorded as `ignored` + consumed as a normal message),
and turns parked at `session.waiting` are waiting by design.

## Changes

| # | Change | File(s) | Risk |
| --- | --- | --- | --- |
| 1 | `experimental.workflow.modelCallsPerStep: 4` on the root agent and each subagent (it applies independently per agent) | `agent/agent.ts`, `agent/subagents/*/agent.ts` | An interrupted step re-runs earlier calls in its batch: duplicate model spend + duplicate events. Our tool side effects are replay-safe (file writes idempotent by path, lint is a read, artifact saves overwrite by slug, `send_notification` is ledger-protected, `delete_asset` is approval-gated — which forces a checkpoint anyway). |
| 2 | Trim the chat-link poll from ~20s to ~2.5s (10×250ms) | `agent/tools/write_file.ts`, `edit_file.ts` (shared helper) | First-turn file writes that miss the link lose only their chat-scoped DB mirror; durable copies go through `save_artifact`, and the tool result note already tells the model. |
| 3 | Batch stream-event persistence: buffer client-side, flush every 500ms via one batched action (multi-row insert); browser-storage mode keeps per-event local writes | `app/_components/assistant-chat.tsx`, `app/actions/chat.ts`, `lib/db/queries.ts`, `lib/chat/persistence-client.ts` | A client crash mid-flush loses ≤500ms of events; `persistSnapshot` still saves the full event set at turn end. |
| 4 | Timeout guard on the session-start Blob restore (10s per fetch, skip the rest on failure) | `agent/sandbox.ts` | None — best-effort by design. |

## Verification

- typecheck, suite, build, discovery all green.
- Timing proof is user-side: the Vercel dashboard's Workflow runs tab shows
  step count and per-step duration per turn — compare one slow turn before and
  after; expect step count to drop ~4× and the per-event POST flood
  (`POST /chat/[id]` at ~6/s) to disappear from runtime logs.

## Revisit triggers

- If replays start duplicating visible work (double streams after a redeploy),
  drop to 2 and re-measure.
- If turns still feel slow after this, the next lever is the steering UX
  (mid-turn replies cancel the active turn under the default `turnPolicy:
  "steer"`) and structured `inputResponses` for questions in the client —
  tracked separately from checkpointing.
