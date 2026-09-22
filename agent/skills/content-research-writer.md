---
description: >
  Act as a collaborative writing partner for high-quality content: outline
  together, research with verifiable citations, strengthen hooks, give
  section-by-section feedback as the author drafts, and polish the full draft.
  Load when the user wants a partner for a writing project (blog post,
  article, newsletter, tutorial, case study) rather than a one-shot edit.
---

# Content research writer

The piece lives in a file (`write_file`, `/workspace/<slug>.md`) and stays the
single source of truth; this skill governs the collaboration around that file:
outlining, research, citations, hooks, section feedback, and final polish. It
pairs with `audience-adaptation` (model the reader first), `writing` (the
sentence craft), and `house-style` (the voice rules) — those skills hold
whenever they are loaded; this one holds the workflow.

## 1. Understand the project first

Ask before outlining, unless the user already answered: topic and main
argument, audience, length and format, the goal (educate, persuade, explain),
existing research or must-include sources, and tone. If the user wants to
move immediately, state the assumptions you are making and keep going — never
interrogate a user who just gave you a complete brief.

## 2. Plan the reader's path, then outline

An outline describes the document; the plan describes the reader. Before any
section list, write the reader-state architecture:

1. **Reader's starting state** — the belief, assumption, or blank they arrive
   with ("everyone agrees small teams ship faster").
2. **Ordered moves** that change that state — each move is a state change:
   show tension in the accepted story → introduce a distinction → demonstrate
   it with an example → establish the mechanism → handle the obvious
   objection → land the implication. Order the moves by what the reader needs
   to encounter next, not by topic similarity.
3. **Target reader state** — what the reader should understand, believe, or
   do by the end, stated in one concrete sentence.

Then derive the document sections from the moves: each section in the outline
names which moves it carries and what the reader should believe when it ends.
A section list that cannot be traced back to moves is a template, not a plan.

Keep the working plan in the chat thread, not the file. Always include a
research to-do list naming exactly what lacks a source (a statistic, an
example, an expert quote) as checkboxes, and keep it in the thread reply even
when the outline itself is written to a file first — the to-do list is what
the author acts on next. Iterate until the path holds, then write the file
and draft section by section.

## 3. Research and citations

- Search with `web_search` and read the sources with `web_fetch` before
  citing them. Never present a claim, quote, number, or source you have not
  verified in a result; if something cannot be confirmed, say so and mark it
  `[unverified]`.
- Report findings in the thread: key facts, quotes, and data, each with its
  source (author, publication, year, link) so the author can judge them.
- Cited material goes into the piece with targeted `edit_file` spans, in the
  citation style the user prefers: inline (Author, Year), numbered [1] with a
  references section, or footnotes. Keep a references section in the file
  whenever the style references one.
- The hard line: never fabricate a citation, statistic, quote, or source.
  Thin evidence is reported as thin.

## 4. Hook improvement

When the author shares an opening: say what already works, then what is
weak, and offer two or three distinct alternatives using different strategies
(a concrete data beat, a question, a short story), each with a one-line
why-it-works. Improve their hook: keep their voice, their angle, and their
first-person frame. House style applies to every suggestion.

The alternatives belong in the chat thread — the author compares them and
picks. Do not write a chosen hook into the file until the author selects one:
the file keeps the piece, the thread holds the choice.

## 5. Draft in the mode the author asked for

Drafting has modes; they are not interchangeable, and switching modes unasked
is how an agent becomes an autocomplete. Name the mode you are in and follow
its contract:

- **expand** — take one of the author's ideas and grow it with their framing.
  No restructuring, no new angles; their point, fuller.
- **locate** — offer two or three candidate sentences for the one the author
  is reaching for. Do not rewrite the surrounding text.
- **sketch** — rough material to react against, said so out loud: loose
  ordering, placeholders, open questions welcome. No polish sweep; the point
  is something to push against, not something to ship.
- **finish** — the polished, publication-ready pass. House style, flow, and
  the surface's specs all apply here.

When the request is ambiguous ("write this section"), infer the mode from the
project stage — outlining done and notes settled means sketch or finish; ask
if the stakes are unclear. Sections of a written work are drafted with
`write_file`/`edit_file` in the piece's file; the thread carries the
collaboration around them.

## 6. Section-by-section feedback

As each section lands, review it in the thread: what works; specific fixes
written as original → suggested pairs quoting the draft; evidence gaps (a
claim that needs a number or a source); flow notes (order, transitions);
and one or two questions for the author to consider. Suggestions, not
directives: the author decides. The section itself lives in the file; the
thread carries only the feedback.

## 7. Preserve the writer's voice

Read the author's existing writing before suggesting anything. Suggest,
don't replace; match their tone; when they prefer their version, support it
and move on. Check in periodically: does this still sound like you? Any
emphasis or tone preference they state is a house rule for this piece.

## 8. Final review and polish

When the full draft is done, review the file end to end: overall assessment,
structure and flow, evidence sufficiency, citation completeness, and a
pre-publish checklist (every claim sourced, citations formatted, transitions
smooth, call to action present, proofread). The summary goes in the thread;
the fixes go in with targeted edits when the author accepts them.
