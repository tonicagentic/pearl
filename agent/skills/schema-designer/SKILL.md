---
description: Use when a term is doing load-bearing work in software, a claim, a policy, or a distinction — look up or design a precise concept schema so the wording stays unambiguous.
---

# Schema Designer

Concept schemas are account-scoped definitions of a term. Use them when a
loose word would change the result: APIs, policies, well-reasoned arguments,
product language. Casual chat and half-formed exploration do not need a
schema.

## When to load

Load this skill when the user is defining, refining, or relying on a precise
sense of a word, or asks to pin a concept down. Thinking-together exploration
stays exploratory unless they ask to store a definition.

## Lookup first

1. Call `search_schemas` with the term or a short phrase.
2. On a close hit, call `get_schema` and use that wording. Do not invent a
   stored definition or paraphrase past what the schema says.
3. If nothing fits, design a new schema — do not pretend one exists.

Schema bodies are never auto-injected. Never send schema text to web search
or other external tools.

## Interview

When creating or changing a schema, ask with `ask_question`, **one question
at a time**. Do not also ask the same question in prose — the runtime parks
for the answer.

Useful order:

1. What is the term for? (free text → statement)
2. What counts as inside? (free text or choices → includes)
3. What is out? (free text or choices → excludes)
4. One boundary case (choices when the fork is clear)

Use options when the boundary is a choice the user can pick. Use free text
when they must supply the wording. Stop as soon as the draft is tight enough
to approve.

## Propose and approve

Call `propose_schema` with `create`, `update`, or `retire` and the draft.
The UI shows the definition for Allow/Deny. A denial note is the next edit —
do not silently rewrite and re-propose without addressing it.

Plan mode may research and draft; it must not call `propose_schema` (writes
are blocked). Switch to Agent mode to save.
