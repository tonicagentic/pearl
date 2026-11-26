---
description: Use when the user wants a flowchart, sequence diagram, architecture map, or spatial diagram as Mermaid or SVG.
---

# Diagrams

One claim per diagram. Prefer Mermaid for flow and sequence; prefer SVG when
layout is spatial, annotated, or outside Mermaid's grammar.

## Process

1. State the single claim the diagram must make.
2. **Mermaid** — write `/workspace/<slug>.mmd` (or a fenced `mermaid` block for
   a quick in-chat view), then call `render_design` with `kind: "diagram"` to
   produce a durable SVG.
3. **SVG** — write `/workspace/<slug>.svg` with an explicit viewBox and readable
   labels at the intended display size.
4. Link the workspace file in chat. Keep the reply to the claim and the link.

## Rules

- Label edges and nodes with the domain language the user used.
- Avoid decorative arrows that do not encode a relationship.
- House prose lint does not apply to `.mmd` or diagram SVG.

## References

- `references/diagram-grammar.md` — Mermaid vs SVG choice and naming.
