---
description: Use when the user wants to start, set up, or define a goal on Pearl’s Goals list — interview with ask_question, then save with create_goal.
---

# Goals

Trackable outcomes on Pearl’s Goals list. Not Issues (open loops) and not
plan-file bullets.

## Start / set up

When they say they want to set a new goal (including area rows like Health):

1. Call `ask_question` for the next missing field — one at a time.
2. Do **not** also ask that question in the message body.
3. Do **not** narrate the interview order or name tools in the reply.

Field order: outcome → what done looks like → optional target date → optional
project vs standalone. Chips when the fork is pickable; free text when they
must supply the wording. Month alone → next upcoming `YYYY-MM-DD`; offer a
no-date choice.

When those are known, emit a GoalDefinition card and call `create_goal`.

## Record

If title/outcome and timing are already clear, emit GoalDefinition and call
`create_goal` now — skip the interview.

## Do not

No SMART/OKR dump, no invented metrics, no mid-walkthrough save, no unsolicited
creates, no claiming tools are missing.
