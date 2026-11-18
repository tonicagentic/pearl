import { generateText, Output } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { readTaxDocumentBytes } from "@/lib/finance/tax/document-storage";

const taxCharacterSchema = z.enum([
  "interest",
  "ordinary_dividends",
  "qualified_dividend",
  "ltcg",
  "stcg",
  "tax_exempt",
]);

const extractedLineSchema = z.object({
  target: z.enum(["activity", "capital_gain"]),
  taxCharacter: taxCharacterSchema.nullable(),
  label: z.string(),
  amount: z.number().nullable(),
  description: z.string().nullable(),
  proceeds: z.number().nullable(),
  basis: z.number().nullable(),
  term: z.enum(["long", "short"]).nullable(),
  date: z.string().nullable().describe("ISO date YYYY-MM-DD if known"),
  sourceBox: z.string().describe("Form box or summary label, e.g. 1099-DIV box 1a"),
});

const extractSchema = z.object({
  formKind: z.enum([
    "1099_div",
    "1099_int",
    "1099_b",
    "consolidated_1099",
    "other",
  ]),
  payerName: z.string().describe("Payer / broker name; empty string if unknown"),
  lines: z.array(extractedLineSchema),
});

export type ExtractedTaxDocument = z.infer<typeof extractSchema>;

function aiConfigured() {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim() ||
      process.env.VERCEL === "1",
  );
}

const SYSTEM_PROMPT = `You extract US tax form boxes from brokerage 1099 packages (DIV, INT, B) or CSV tax exports.

Return structured lines the app can review before posting into a tax engine:

Activity lines (target=activity):
- 1099-DIV box 1a ordinary dividends → taxCharacter=ordinary_dividends, amount=box value
- 1099-DIV box 1b qualified dividends → taxCharacter=qualified_dividend
- 1099-INT box 1 interest → taxCharacter=interest
- Tax-exempt interest → taxCharacter=tax_exempt
- Prefer summary STCG/LTCG only if no proceeds/basis; otherwise use capital_gain

Capital gain lines (target=capital_gain):
- Prefer 1099-B **summary by term** (short-term covered, long-term covered, etc.) with proceeds + basis
- If a CSV lists individual lots and there are fewer than ~40 rows, also include per-lot capital_gain lines
- term=short or long; description like "1099-B short-term covered summary"

Skip zeros. Do not invent amounts. Use sourceBox for the form box label.`;

export async function extractTaxDocumentContent(opts: {
  year: number;
  fileName: string;
  contentType: string;
  blobUrl: string;
}): Promise<ExtractedTaxDocument> {
  if (!aiConfigured()) {
    throw new Error(
      "Document extract needs Vercel AI Gateway. Link the project and run vercel env pull.",
    );
  }

  const bytes = await readTaxDocumentBytes(opts.blobUrl);
  const isCsv =
    opts.contentType.includes("csv") ||
    opts.fileName.toLowerCase().endsWith(".csv") ||
    opts.contentType.includes("text/");

  const prompt = `Tax year ${opts.year}. File: ${opts.fileName} (${opts.contentType}).
Extract 1099-DIV / 1099-INT / 1099-B (or consolidated) boxes into review lines.`;

  if (isCsv) {
    const text = bytes.toString("utf8").slice(0, 120_000);
    const result = await generateText({
      model: gateway("openai/gpt-5-mini"),
      output: Output.object({ schema: extractSchema }),
      prompt: `${SYSTEM_PROMPT}\n\n${prompt}\n\nCSV contents:\n${text}`,
    });
    if (!result.output) throw new Error("No structured extract returned");
    return result.output;
  }

  const result = await generateText({
    model: gateway("openai/gpt-5-mini"),
    output: Output.object({ schema: extractSchema }),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `${SYSTEM_PROMPT}\n\n${prompt}` },
          {
            type: "file",
            data: { type: "data", data: bytes },
            mediaType: opts.contentType.startsWith("application/")
              ? opts.contentType
              : "application/pdf",
            filename: opts.fileName,
          },
        ],
      },
    ],
  });

  if (!result.output) throw new Error("No structured extract returned");
  return result.output;
}
