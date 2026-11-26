---
description: Use when producing or revising SVG — logos, icons, flat illustrations, or any editable vector deliverable via generate_svg or write_file.
---

# Vector graphics

Prefer hand-authored SVG (`write_file`) when geometry is exact and simple.
Prefer `generate_svg` when shapes are easier to describe than to construct.

## Construction

- One root `<svg>` with an explicit `viewBox`.
- Prefer fills or a consistent stroke weight; avoid embedded bitmaps and
  scripts.
- Exact text belongs in the SVG when lettering must stay precise.

## Prompt template (for `generate_svg`)

```
Create [subject] for [use and size].
Use [style], [hex colors], and [composition].
Include [required details].
Avoid [unwanted details].
```

Cover purpose, style, composition, construction, text, and constraints. Short
and concrete beats a long mood board.

## Tool contract

- Call `generate_svg` with `prompt` and optional `filePath` / `maxOutputTokens`.
- The Vector picker selects Arrow 2 or Arrow 2 Telos — do not pass a model id.
- Arrow 2 is the default; Telos for dense logos, tight geometry, or detailed
  illustrations (tell the user to switch the picker).
- Revisions: `edit_file` on the workspace SVG, or a new `generate_svg` that
  names the one change and what must stay fixed.
- This path is text-to-SVG only. No vectorize, edit-API, or animate endpoints.

## Data policy

`generate_svg` calls Quiver through the AI Gateway **without** Pearl’s usual
US / zero-data-retention / no-training filters. Quiver may train on inputs
unless Improve QuiverAI is turned off in their Data Controls. Do not describe
these calls as zero-retention.
