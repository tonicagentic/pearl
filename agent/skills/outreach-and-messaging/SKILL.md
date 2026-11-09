---
description: Use when the user wants outreach written, tracked, or sent — cold email, follow-ups, sequences, reply handling, an outreach tracker in a Google Sheet or CSV, or Gmail drafts and sends. Triggers on "write outreach", "cold email", "follow-up", "track outreach", "draft this in Gmail", "send this".
---

# Outreach and messaging

Messages are written from a confirmed offer and ICP. If either is missing, load
`offer-discovery` or `market-positioning` first. Never invent a sender claim,
customer, result, mutual connection, or personal detail about a recipient.
Personalization comes only from facts you found and can cite.

## Writing

- One message, one ask. Short, specific, in the user's voice.
- Open with a real reason for reaching this person, from research or from the
  user. If there is none, say so and ask, rather than fabricating one.
- Offer two or three variants when tone is open; label them.
- For a sequence, give the touch count and spacing as a proposal and let the
  user adjust.

## Where the tracker lives

Pick one home and say which:

- **Company pipeline** (accounts, people, deals, activity) → the Tempo
  connection. Use the tools it exposes; do not guess names. Creates and updates
  are writes and need approval. If Tempo is not connected, say so and use a
  Sheet or CSV.
- **Project-only tracker** (a Pearl Project's outreach, a side effort, a one-off
  campaign) → a Google Sheet via the Sheets connection.

## Sheets playbook (project trackers)

1. Check whether the project already links a sheet (project instructions or
   plan). If yes, reuse it; do not create a second one.
2. If not, ask the user for an existing sheet URL (or have them create a blank
   spreadsheet in Google Sheets / Drive). The Sheets MCP has no create tool —
   it only reads and updates sheets you already have. Once you have a URL or
   spreadsheet id, write the header row and data through the connection
   (writes need approval each call).
3. Use a header row with these columns, adding only what the user asks for:
   `company`, `contact`, `role`, `email`, `source`, `status`, `last_touch`,
   `next_step`, `next_date`, `notes`. Mark unverified emails in `notes`.
4. `status` values: `new`, `drafted`, `sent`, `replied`, `meeting`,
   `not_a_fit`, `closed`.
5. Append one row per prospect; update rows by key (company + contact) instead
   of duplicating. After a draft or send, update `status`, `last_touch`, and
   `next_step`.
6. Save the sheet URL to the project's instructions or plan so later turns find
   it, and give the user the link.

**Fallback — Sheets not connected:** write a CSV with `write_file` using the
same columns, for example `outreach-tracker.csv`, and give the user the
`file://` link. Say that Sheets is not connected and that they can import the
CSV into Sheets or connect it later. Keep updating the same CSV rather than
creating new ones.

## Gmail draft and send flow

1. **Draft first.** Create a draft with the Gmail connection's draft tool when
   it is available; the draft is the default outcome of "write an email". If the
   connection exposes no draft tool, write the message to a workspace file and
   tell the user why.
2. **Show it.** Present recipient, subject, and body so the user can edit.
   Check the recipient address came from the user or a cited source.
3. **Confirm before send.** Sending is irreversible and never happens in the
   turn the user first asks. Restate the recipient, subject, and body, ask for
   explicit confirmation, and send only after they confirm and only through the
   approval step the send tool requires. Use `confirm_step` when no send tool is
   available but the user wants to rehearse the approval.
4. **One at a time.** One confirmation covers one message. Do not send a batch
   from a single approval; offer to walk through them in turn.
5. **Log it.** After a send, update Tempo (with approval) or the Sheet row, and
   propose the follow-up date.

If the connection has no send tool, hand the user the finished draft to send
themselves and update the tracker as `drafted`.

## Replies

Read the thread with the Gmail connection (read tools), summarize the reply,
and propose a response as a draft. Update the tracker status. Do not
characterize a reply as interest unless it says so.
