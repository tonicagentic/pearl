import { generateText, Output, stepCountIs } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { MEAL_SLOTS, type MealSlot } from "@/lib/body/slots";

function aiConfigured() {
  return Boolean(
    process.env.EXA_API_KEY?.trim() ||
      process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim() ||
      process.env.VERCEL === "1",
  );
}

export function nutritionEstimateMissingConfigMessage() {
  return (
    "Nutrition estimates need Vercel AI Gateway (recommended) or an Exa Marketplace key. " +
    "Link this project (`vercel link`), enable AI Gateway, then run `vercel env pull`."
  );
}

const estimateSchema = z.object({
  name: z.string().describe("Normalized food name"),
  servingLabel: z
    .string()
    .describe('Typical serving size label, e.g. "1 cup (170g)" or "6 oz cooked"'),
  calories: z.number().nonnegative().describe("Calories per serving"),
  proteinG: z.number().nonnegative().describe("Protein grams per serving"),
  carbsG: z.number().nonnegative().describe("Carbohydrate grams per serving"),
  fatG: z.number().nonnegative().describe("Fat grams per serving"),
  notes: z.string().describe("Short note on sources or assumptions; empty string if none"),
});

export type NutritionEstimate = {
  name: string;
  servingLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  notes: string;
  suggestedSlot: MealSlot | null;
};

function suggestSlotFromName(name: string, hint?: MealSlot | null): MealSlot | null {
  if (hint && (MEAL_SLOTS as readonly string[]).includes(hint)) return hint;
  const n = name.toLowerCase();
  if (
    /\b(yogurt|yoghurt|bar|chips|crackers|apple|banana|nuts|trail mix|smoothie)\b/.test(
      n,
    )
  ) {
    return "snack";
  }
  if (/\b(oatmeal|eggs|egg|toast|cereal|pancake|waffle|bagel)\b/.test(n)) {
    return "breakfast";
  }
  if (/\b(steak|salmon|chicken breast|roast|pasta dinner)\b/.test(n)) {
    return "dinner";
  }
  return null;
}

export async function estimateNutrition(input: {
  name: string;
  slot?: MealSlot | null;
}): Promise<NutritionEstimate> {
  const name = input.name.trim();
  if (!name) throw new Error("name is required");
  if (!aiConfigured()) {
    throw new Error(nutritionEstimateMissingConfigMessage());
  }

  const slotHint = input.slot
    ? `The user categorized this as ${input.slot}.`
    : "No meal category was provided.";

  const result = await generateText({
    model: gateway("openai/gpt-5-mini"),
    tools: {
      exa_search: gateway.tools.exaSearch({ numResults: 6 }),
    } as Parameters<typeof generateText>[0]["tools"],
    stopWhen: stepCountIs(6),
    output: Output.object({ schema: estimateSchema }),
    prompt: `Estimate nutrition facts for this food or meal for a personal diet tracker.

Food: ${JSON.stringify(name)}
${slotHint}

Rules:
- Search for typical nutrition labels or USDA-style values when possible.
- Return macros for ONE typical serving; set servingLabel clearly.
- Prefer whole-food realistic portions people actually eat.
- calories, proteinG, carbsG, fatG must be non-negative numbers.
- notes: brief source/assumption or empty string.
- Do not invent brand-specific claims without search support.`,
  });

  if (!result.output) {
    throw new Error("No nutrition estimate returned");
  }

  const out = result.output;
  return {
    name: out.name.trim() || name,
    servingLabel: out.servingLabel.trim() || "1 serving",
    calories: Math.round(out.calories * 100) / 100,
    proteinG: Math.round(out.proteinG * 100) / 100,
    carbsG: Math.round(out.carbsG * 100) / 100,
    fatG: Math.round(out.fatG * 100) / 100,
    notes: out.notes ?? "",
    suggestedSlot: suggestSlotFromName(out.name || name, input.slot ?? null),
  };
}
