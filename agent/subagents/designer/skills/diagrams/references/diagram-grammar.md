# Diagram grammar

## Choose Mermaid when

- Flowcharts, sequence diagrams, state diagrams, ER-ish relationship maps.
- The structure is a graph of named nodes and typed edges.

Example `.mmd`:

```text
flowchart LR
  request[User request] --> route[Skill descriptions]
  route --> artifact[Workspace file]
```

Then `render_design` with `kind: "diagram"` and the `.mmd` path.

## Choose SVG when

- Spatial layouts, annotated screenshots, custom icons in the diagram,
  or precise positioning Mermaid cannot express.

## Naming

- Node ids: camelCase or PascalCase, no spaces.
- Prefer domain nouns over implementation jargon unless the audience is
  engineers reading the system itself.
