# Attachment uploads — plan (multi-image, large PDFs, effective interpretation)

Branch: `feat/attachment-uploads`. Follows the eval-driven pattern: every
phase starts with failing evals that define the user flow, then the
infrastructure work that makes them pass.

## Current state (verified on `main`)

- Composer supports multiple staged attachments (images, text, PDFs via the
  template's adapters) — verified end to end for one image and one text file.
- Channel policy: `image/*`, `text/*`, `application/pdf`, 10 MB per file
  (`agent/channels/eve.ts`).
- Attachments travel as **inline base64 data URLs inside the message payload**
  (`createTextWithFileContent` → `createDataUrlFilePart` in eve's client).
  They are not uploaded anywhere — the payload *is* the attachment.
- The deployed model accepts inline images (screenshot eval passes) and reads
  them accurately.
- PDF attachments are accepted by policy but the model has never been probed
  with one — interpretation is unverified.

## Constraints that shape the design

1. **Vercel request body limit ≈ 4.5 MB** per serverless request. Base64
   inflates files by ~33%, so the practical inline ceiling is ~3 MB of
   attachments *per message, total* — not per file. Several screenshots fit;
   a long PDF does not.
2. **Token cost scales with payload.** Every image is a vision input; a
   30-page PDF passed raw would be enormous even if the provider accepted it.
3. **PDF interpretation is unverified.** The provider may reject PDF file
   parts outright, or accept them with poor extraction. Must be probed before
   building around it.
4. **Attachments are not persisted.** They live in the turn's message payload;
   later turns (and compaction) lose them unless content was extracted into
   the conversation or a sandbox file.
5. **Blob credentials already exist in production** (the memory provider uses
   Vercel Blob), so a Blob-backed upload path needs no new infrastructure.

## Design

### Tier 1 — multi-image (inline, no new infrastructure)

The 4.5 MB body limit comfortably fits 3–6 compressed screenshots. Work:

1. Channel policy: keep `image/*`, raise `maxBytes` to 8 MB per file, and add
   a **per-message attachment budget** check in `prepareSend` (client-side)
   so users get a clear message instead of a failed POST.
2. Image downscaling client-side before staging (canvas → JPEG/WebP at ~1600px
   long edge) keeps payloads small and vision tokens bounded. Screenshots do
   not need original resolution to be interpretable.

Evals first:

- `attachments/multi-image-compare` — attach two screenshots with different
  deploy statuses; the reply must reference both correctly (gate: both
  fixture values present; judge: no cross-contamination).
- `attachments/image-count-discipline` — three images, question about only
  one; reply answers from the right image (judge).

### Tier 2 — long PDFs (extract, don't paste)

Do not paste large PDFs into model context. Two-stage flow:

1. **Upload**: `POST /api/attachments` (auth-gated) stores the file in Vercel
   Blob and returns `{url, mediaType, byteLength, name}`. The composer's PDF
   adapter `add()` uploads here and stages a **URL-based** file part (the
   composer shows a chip immediately; upload progress is part of `add()`).
2. **Interpretation**: parse server-side with
   [`@firecrawl/pdf-inspector`](https://github.com/firecrawl/pdf-inspector)
   (`processPdf(bytes)` → `{pdfType, markdown, pages…}`, Rust/WASM, MIT,
   ~0.5 s runs). Its document classification routes the flow:
   - `TextBased`/`Mixed` → the position-aware **Markdown** (headings, tables,
     reading order, page markers) is written into the sandbox as
     `/workspace/attachments/<name>.md` (bounded — e.g. first 50k characters
     with a continuation marker), so the agent reads it with `read_file` like
     any document and answers from it.
   - `Scanned`/`ImageBased` → no text layer; the agent gets the graceful
     "this PDF is scanned, OCR is not supported yet" message instead of
     silence.
3. The message payload carries only the Blob URL + extracted-text summary —
   a few KB regardless of PDF size.

Evals first:

- `attachments/long-pdf-analysis` — fixture: a generated 24-page PDF with the
  answer to a specific question buried on page 19 (and a different fact on
  page 6). The reply must answer both (proves deep reading, not first-pages
  skimming). Extraction goes through `@firecrawl/pdf-inspector`; the eval
  also pins the scanned-PDF routing (a scanned fixture yields the graceful
  message).
- `attachments/pdf-graceful-limit` — a PDF over the byte budget produces a
  clear, actionable message (not a crash, not silence).
- `attachments/pdf-numbers-exact` — a page contains specific numbers; the
  reply quotes them exactly (no hallucinated figures).

### Aesthetics and vibes (images)

Reading the *look and feel* of an image, not just its facts. The agent should
be able to describe palette, mood, typography, and composition, and answer
comparative questions like "which of these feels more trustworthy for a
fintech landing page?" — the kind of design-feedback loop a thinking partner
needs.

Evals:

- `attachments/aesthetics-vibes` — two deliberately contrasting fixture
  images (a minimal light fintech screen vs a dark neon crypto screen); the
  reply must characterize each one's palette/mood and answer the comparative
  trust question with a reason. Judge criteria separate "aesthetic vocabulary"
  (colors, mood, typography, density) from mere content reading.
- `attachments/vibe-feedback` — one mood-board-style image; the agent gives
  concrete aesthetic feedback (what works, what clashes) rather than a
  content inventory.

### Tier 3 — multiple large images (Blob-backed vision)

Only if tier-1-style inline images hit the body limit in practice:

- Upload images to Blob like PDFs; pass URL-based image parts to the model.
- Risk: the provider must fetch the Blob URL. Probe GLM's gateway behavior
  with a public URL before building. Fallback: keep tier-1 inline and treat
  Blob as a persistence/archive layer only (so attachments survive compaction
  and later turns via `read_file`).

## Eval sequencing (all before infrastructure)

1. `attachments/multi-image-compare` + `image-count-discipline` — expect
   these to pass already or close to it; they pin the behavior.
2. `attachments/long-pdf-analysis` — expected to fail first (no extraction
   path); defines the PDF workstream's "done".
3. `attachments/pdf-numbers-exact`, `pdf-graceful-limit` — refine the PDF
   flow.
4. Size-budget UX eval after the per-message budget lands.

## Workstream order

1. Eval specs (this branch): `attachments/` suite with fixtures (generated
   PDF + two PNGs).
2. Tier 1: per-message budget + client downscale + multi-image evals green.
3. Probe: send a small PDF file part to the model once, record the result in
   this file (accepts / rejects / poor extraction).
4. Tier 2: Blob upload route + `unpdf` extraction + sandbox write + long-PDF
   evals green.
5. Tier 3: only if needed.

## Non-goals (for now)

- Audio/video attachments (the protocol supports them; no user flow yet).
- Editing or re-analyzing attachments from old turns (persistence design is
  out of scope until a user flow demands it).
- OCR for scanned PDFs (tier 2 is text-extraction only; scanned PDFs get the
  graceful-limit message).
