---
description: Use when the user wants an illustration, scene graphic, editorial art, or decorative visual that is not a logo or icon set.
---

# Illustration design

Name the style, crop, and palette before generating.

## Process

1. Lock subject, mood, composition (crop / viewpoint), and a small hex palette.
2. **Editable or flat vector art** — load `vector-graphics` and call
   `generate_svg`. Suggest Arrow 2 Telos for dense detail by asking the user
   to switch the Vector picker; do not override it yourself.
3. **Painted texture, photographic mood, or complex shading** — use
   `generate_image` (Image picker). Share the returned URL.
4. Critique against hierarchy and the brief; revise with a tighter prompt or
   `edit_file` on SVG.

## Rules

- Prefer `generate_svg` when the result must stay editable.
- Put exact lettering in SVG or HTML, not in a pictorial render.
- Do not invent a brand system unless asked.
