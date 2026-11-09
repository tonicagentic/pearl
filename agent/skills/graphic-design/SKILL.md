---
description: Use when the user wants a social graphic, mixed graphic, or general visual that is not specifically a logo, icon set, or illustration brief.
---

# Graphic design

For logos → `logo-design`. For icons → `icon-design`. For illustrations →
`illustration-design`. This skill covers social cards and mixed graphics.

Prefer vector when the work is geometric, typographic, or must stay editable.
Prefer `generate_image` when the work is pictorial, photographic, or needs
painted texture.

## Process

1. Lock the brief: purpose, size/aspect ratio, color constraints, and whether
   the result must stay editable as SVG.
2. **SVG path** — load `vector-graphics`. Exact simple geometry →
   `write_file` to `/workspace/<slug>.svg`. Harder shapes → `generate_svg`.
3. **Image path** — call `generate_image` with a composed prompt, size or
   aspect ratio, and any style constraints from the brief. Share the returned
   URL in chat; optionally save a companion prompt note as markdown only if
   the user wants iteration history.
4. Critique the result against hierarchy, contrast, and legibility at the
   target size. Revise the file or regenerate with a tighter prompt.

## Rules

- Do not invent a full brand system unless asked.
- Marks and icons: route to `logo-design` / `icon-design` instead.
- House prose lint does not apply to SVG source.

## References

- `references/prompting.md` — image prompts and SVG conventions.
