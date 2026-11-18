import { generateText, Output } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";

function aiConfigured() {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim() ||
      process.env.VERCEL === "1",
  );
}

const suggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      key: z.string(),
      categorySlug: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

/**
 * One cheap batched call: map unique merchant keys → category slugs.
 * Returns only model suggestions; caller enforces ≥ 0.85 and valid slugs.
 */
export async function suggestCategoriesWithLlm(opts: {
  items: { key: string; sampleMemo: string }[];
  categories: { slug: string; name: string }[];
}): Promise<{
  ok: boolean;
  skippedReason?: string;
  suggestions: { key: string; categorySlug: string; confidence: number }[];
}> {
  if (opts.items.length === 0) {
    return { ok: true, suggestions: [] };
  }
  if (!aiConfigured()) {
    return {
      ok: false,
      skippedReason: "AI Gateway not configured",
      suggestions: [],
    };
  }

  const catalog = opts.categories
    .map((c) => `${c.slug} — ${c.name}`)
    .join("\n");
  const merchants = opts.items
    .map((i) => `- key=${JSON.stringify(i.key)} memo=${JSON.stringify(i.sampleMemo.slice(0, 40))}`)
    .join("\n");

  try {
    const result = await generateText({
      model: gateway("openai/gpt-5-mini"),
      output: Output.object({ schema: suggestionSchema }),
      prompt: `You categorize personal card/bank merchants for a lifestyle chart of accounts.

Use ONLY these category slugs:
${catalog}

Rules:
- Return exactly one suggestion for EVERY merchant key listed (same key string).
- confidence 0–1; use ≥0.85 when reasonably sure.
- Never use transfers or credit-card-payments for merchant purchases (Uber, Target, Netflix, etc.).
- transfers = payments between own wallets only (Venmo top-ups, Capital One payments).
- Foreign/person-name merchants that look like cafes/shops → restaurants or miscellaneous.
- Airlines (American, United, Delta, etc.) → flights.
- Software/SaaS → personal-software; streaming apps → streaming.
- Prefer a real category over miscellaneous when a fit is clear.

Merchants:
${merchants}`,
    });

    if (!result.output) {
      return { ok: false, skippedReason: "empty model output", suggestions: [] };
    }
    return { ok: true, suggestions: result.output.suggestions };
  } catch (err) {
    return {
      ok: false,
      skippedReason: err instanceof Error ? err.message : String(err),
      suggestions: [],
    };
  }
}
