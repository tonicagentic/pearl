# Print specs

## Common trim sizes

| Name | Trim | Notes |
| --- | --- | --- |
| Letter | 8.5 × 11 in | US default |
| A4 | 210 × 297 mm | International default |
| Tabloid | 11 × 17 in | Posters, spreads |
| Business card | 3.5 × 2 in | Often 0.125 in bleed |

## Bleed and safe area

- **Bleed:** typically 0.125 in (3 mm) beyond trim on every side.
- **Safe area:** keep type and critical marks at least 0.25 in inside trim.
- Set `@page { size: …; margin: … }` to match trim; size the body to the
  bleed box when exporting press-ready PDFs.

## HTML skeleton

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Piece title</title>
    <style>
      @page {
        size: letter;
        margin: 0;
      }
      html,
      body {
        margin: 0;
        padding: 0;
      }
      .page {
        width: 8.5in;
        height: 11in;
        box-sizing: border-box;
        padding: 0.5in;
      }
    </style>
  </head>
  <body>
    <div class="page">…</div>
  </body>
</html>
```

Call `render_design` with `kind: "pdf"` after the HTML is written.
