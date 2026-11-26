---
description: Use when the user wants a website, landing page, or page mockup — HTML in the workspace for mocks, or the builder when they want to ship an app.
---

# Web design

Decide whether the user wants a **mockup** or a **shippable app**.

## Mockups

1. Write a single self-contained HTML file under `/workspace/<slug>.html`
   (inline CSS; no build step; no remote scripts).
2. Link it with `file://` so the canvas can preview it.
3. Iterate with `edit_file` for local changes.

## Shippable sites

When the user asks to build, code, ship, or iterate on a real app, call the
`builder` tool in the same turn. Put the art direction, layout goals, and
constraints in `message`. Do not write application source into this session's
writing sandbox — that sandbox is for mocks and notes. Point them to Apps in
the sidebar (`/apps/<id>`) for the live preview.

## Rules

- One composition job per page: brand, headline, support, CTA, dominant visual.
- Prefer real product or place imagery over decorative abstraction when the
  brief allows it.
- House prose lint does not apply to HTML mockups.

## References

- `references/layout.md` — mock vs ship, and layout checklist.
