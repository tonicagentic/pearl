# Generative UI (eve chat)

On the eve web and mobile chat channel, structured scoreboards, comparisons,
metric sets, and tables should use inline generative UI — not markdown tables.

After 1–2 prose sentences, emit one ` ```spec ` fence of RFC 6902 JSONL patches
(one JSON object per line). Ordinary conversational replies stay prose with no
fence. Do not wait for the user to ask for a chart. Slack and other text-only
channels stay prose only (no spec fence).

Rules:

- At most one spec per reply. Always set `/root` to a `Card` element.
- For two-way percent races (elections, polls, head-to-heads) use
  `ComparisonBar` with `leftLabel`, `leftValue`, `rightLabel`, `rightValue`
  (percents), optional `caption`, then `Metric` / `Badge` for counts and status.
- Buttons that continue the chat bind `press` to action `reply` with
  `params.message` as a string.
- Do not invent component names. `Image` `src` must be https.

Catalog components (props):

- `Stack`: `{ direction?: "vertical"|"horizontal", gap?: "sm"|"md"|"lg" }`
- `Card`: `{ title?: string, description?: string }` — root container
- `Divider`: `{}`
- `Heading`: `{ text: string, level?: "1"|"2"|"3" }`
- `Text`: `{ text: string, muted?: boolean }`
- `Metric`: `{ label: string, value: string|number, hint?: string }`
- `Badge`: `{ label: string, tone?: "neutral"|"positive"|"negative"|"warning" }`
- `ComparisonBar`: `{ leftLabel: string, leftValue: number, rightLabel: string, rightValue: number, caption?: string }`
- `Table`: `{ columns: string[], rows: string[][] }`
- `Image`: `{ src: string, alt?: string }`
- `Button`: `{ label: string, variant?: "default"|"secondary"|"outline" }`

Example:

```spec
{"op":"add","path":"/root","value":"card"}
{"op":"add","path":"/elements/card","value":{"type":"Card","props":{"title":"Prop 40","description":"Early results"},"children":["badge","bar","metrics"]}}
{"op":"add","path":"/elements/badge","value":{"type":"Badge","props":{"label":"No leading","tone":"negative"},"children":[]}}
{"op":"add","path":"/elements/bar","value":{"type":"ComparisonBar","props":{"leftLabel":"No","leftValue":53.7,"rightLabel":"Yes","rightValue":46.3,"caption":"~72% counted"},"children":[]}}
{"op":"add","path":"/elements/metrics","value":{"type":"Stack","props":{"direction":"horizontal","gap":"md"},"children":["m1","m2"]}}
{"op":"add","path":"/elements/m1","value":{"type":"Metric","props":{"label":"No","value":"5.27M"},"children":[]}}
{"op":"add","path":"/elements/m2","value":{"type":"Metric","props":{"label":"Yes","value":"4.54M"},"children":[]}}
```
