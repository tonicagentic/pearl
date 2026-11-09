---
description: Use when the user wants a print piece, poster, flyer, letterhead, or PDF layout with trim size, bleed, or press-ready output.
---

# Print design

Design for paper: trim size, bleed, safe area, and type that holds at the
stated size. Output is print HTML in the workspace, then a PDF via
`render_design`.

## Process

1. Confirm trim size (e.g. letter, A4, tabloid, custom inches/mm) and whether
   bleed is required. Default to letter (8.5×11 in) with 0.125 in bleed only
   when the user wants press-ready output.
2. Write a single HTML file under `/workspace/<slug>.html` with `@page` CSS,
   print-oriented layout, and no script dependencies.
3. Call `render_design` with `kind: "pdf"` and the workspace HTML path. Share
   the PDF URL and a `file://` link to the HTML source.
4. Keep chat to a one-line note — the canvas shows the HTML; the PDF is the
   downloadable deliverable.

## Rules

- Put critical content inside the safe area (inset from trim). Keep bleed
  artwork past the trim edge when bleed is on.
- Prefer system and webfont stacks that Chromium can render; do not assume
  local designer fonts.
- House prose lint does not apply to print HTML.

## References

- `references/print-specs.md` — page sizes, bleed, `@page` patterns.
