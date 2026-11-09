# Design brief checklist

Capture only what changes the work:

1. **Audience** — who sees it, and in what context.
2. **Job** — what the viewer should understand, feel, or do.
3. **Medium** — print, graphic, web, diagram, or 3D.
4. **Constraints** — size, color, brand, deadline, accessibility, print specs.
5. **References** — examples to follow or avoid (optional).

## Medium routing

| Signal | Skill | Primary tool / file |
| --- | --- | --- |
| Poster, flyer, letterhead, trim size, bleed, PDF | `print-design` | HTML + `render_design` (`pdf`) |
| Logo, icon, social card, illustration | `graphic-design` | SVG or `generate_image` |
| Landing page, layout mock, ship a site | `web-design` | HTML mock, or `builder` to ship |
| Flowchart, sequence, system map | `diagrams` | Mermaid / SVG + `render_design` |
| Product mock, room, sculpture, orbit view | `3d-design` | `.scene.json` |

Do not invent brand systems the user did not ask for. Prefer one strong
composition over a kit of unused variants.
