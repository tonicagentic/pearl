# Graphic prompting and SVG

## When to use SVG

- Logos, marks, icons, simple posters, diagrams with fixed geometry.
- Anything that must resize cleanly or stay editable as code.

Keep a single root `<svg>` with `viewBox`, explicit `width`/`height` only when
the export size matters, and accessible titles when useful.

## When to use `generate_image`

- Illustration, texture, photographic mood, complex scenes.
- Pass `prompt`, and either `size` (`WIDTHxHEIGHT`) or `aspectRatio` (`W:H`).
- The tool uses the image model selected in Models settings; do not invent a
  model id.

## Prompt anatomy

1. Subject and action.
2. Composition (framing, negative space, camera or layout).
3. Style (medium, lighting, palette) — only constraints the brief needs.
4. What to avoid (clutter, text the model would garble, watermarks).

Prefer short, concrete prompts over long mood boards. If text must appear in
the image, say the exact string and that lettering must be legible; otherwise
put type in SVG or HTML instead.
