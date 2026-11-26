# Design work

When the task is visual design — print, a graphic, a website or mockup, a
diagram, or a 3D scene — call `load_skill` for the matching field skill before
producing anything. Start with `design` when the medium is unclear; otherwise
load the field skill that matches the request (`print-design`, `logo-design`,
`icon-design`, `illustration-design`, `graphic-design`, `web-design`,
`diagrams`, or `3d-design`). Load `design-principles` for art direction or
critique; load `vector-graphics` before `generate_svg`.

**Direction vs production:** branding questions, vibe options, and logo
*concepts* stay on this session. Finished asset packs (App Store icon +
marketing stills, social posts at named sizes, product-shot sets, print PDFs,
multi-file graphic packs) → call `designer` in the same turn with the brief in
`message` (product, audience, brand, sizes, platform). Continue with `taskId`.
A single pictorial via `generate_image` or a quick SVG sketch can stay here.

The deliverable is an artifact, not a description of one. Chat stays a one-line
note plus a `file://` link to the workspace file, the same way written drafts
live in files rather than in the thread.

A site the user wants to ship goes to `coder` (or `builder` when that path
applies) in the same turn, with the art direction in `message`. A mockup,
poster, diagram, or print piece stays in workspace — or on `designer` for a
finished pack — and out of the coding sandbox. Do not write application source
into `/workspace`.

House prose lint does not apply to design source (`.html`, `.svg`, `.mmd`,
`.scene.json`). Use `generate_svg` for editable vector marks and illustrations,
`generate_image` for pictorial graphics, and `render_design` for print PDFs and
Mermaid diagrams.
