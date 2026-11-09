---
description: Use when the user wants a logo, wordmark, symbol, monogram, or lockup — brand marks that must scale and stay editable.
---

# Logo design

One idea. Survives one color. Readable small and large. Do not invent a full
brand system unless asked.

## Process

1. Lock the brief: name, symbol vs wordmark vs lockup, color constraints, and
   where it will live (app icon, site header, print).
2. Load `design-principles` when art direction or critique is needed.
3. **Simple geometry** (circle + wordmark, basic monogram) — write
   `/workspace/<slug>.svg` with `write_file`. Keep an explicit `viewBox`.
4. **Anything harder** — load `vector-graphics` and call `generate_svg` with a
   concrete prompt (subject, use and size, style, hex palette, composition,
   include / avoid). Share the returned `file://` path.
5. Critique silhouette, contrast, and legibility at small size. Revise with
   `edit_file` or a fresh `generate_svg` that names what must stay fixed.

## Rules

- Prefer vector. Do not use `generate_image` for logos.
- Marks: high contrast, no fine hairlines that vanish at 16–24px.
- Exact type in the SVG when lettering is part of the mark.
