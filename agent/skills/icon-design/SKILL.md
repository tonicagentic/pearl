---
description: Use when the user wants an icon, toolbar glyph, app glyph, or a family of matching icons at a fixed pixel size.
---

# Icon design

Icons are judged at their real display size. Default to 24×24 unless the brief
says otherwise.

## Process

1. Lock size, padding inside the viewBox, and fill vs stroke treatment.
2. For a **family**, reuse one prompt skeleton and change only the subject so
   weight, corners, and optical size stay consistent.
3. Load `vector-graphics` and call `generate_svg`. Prefer Arrow 2 (default
   Vector picker). Suggest Arrow 2 Telos only for unusually dense sets — tell
   the user to switch the Vector picker; do not invent a model id.
4. Judge every icon at the target size. Adjust only silhouettes that lose
   identity.

## Prompt skeleton

```
Create a [size]px [subject] icon for [use].
Use a 0 0 [w] [h] viewBox, [viewpoint], [fill or stroke treatment],
[hex palette]. Center on a transparent background.
Avoid [text, shadows, extra detail].
```

## Rules

- One stroke or fill treatment for the whole set.
- Prefer vector via `generate_svg`. Hand-author with `write_file` only when
  geometry is trivial and exact.
- Do not use `generate_image` for UI icons.
