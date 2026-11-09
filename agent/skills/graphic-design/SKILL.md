---
description: Use when the user wants a logo, mark, poster graphic, social image, icon, or illustration — geometric SVG or generative pictorial work.
---

# Graphic design

Prefer vector when the work is geometric, typographic, or a mark that must
scale. Prefer `generate_image` when the work is pictorial, photographic, or
needs painted texture.

## Process

1. Lock the brief: purpose, size/aspect ratio, color constraints, and whether
   the result must stay editable as SVG.
2. **SVG path** — write `/workspace/<slug>.svg`. Keep the viewBox explicit,
   avoid embedded bitmaps unless required, and link the file in chat.
3. **Image path** — call `generate_image` with a composed prompt, size or
   aspect ratio, and any style constraints from the brief. Share the returned
   URL in chat; optionally save a companion prompt note as markdown only if
   the user wants iteration history.
4. Critique the result against hierarchy, contrast, and legibility at the
   target size. Revise the file or regenerate with a tighter prompt.

## Rules

- Do not invent a full brand system unless asked.
- Marks and icons: one idea, high contrast, works at small sizes.
- House prose lint does not apply to SVG source.

## References

- `references/prompting.md` — image prompts and SVG conventions.
